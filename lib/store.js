'use strict';

// MongoDB data layer. Programmes, applications, candidate accounts and sessions
// live in their own collections; uploaded documents are stored in GridFS
// (bucket "documents") so the app needs no local disk.
// Documents carry their own string `id`; Mongo's `_id` never leaves this file.

const crypto = require('crypto');
const dns = require('dns');
const fs = require('fs');
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const seedProgrammes = require('./seed');

const NO_ID = { projection: { _id: 0 } };
// Password hashes never leave the data layer either.
const PUBLIC_USER = { projection: { _id: 0, passwordHash: 0 } };

let client;
let db;
let programmes;
let applications;
let users;
let sessions;
let lessons;
let docBucket;
let videoBucket;

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env (see .env.example).');

  if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));

  try {
    client = await openClient(uri);
  } catch (err) {
    // mongodb+srv:// addresses need a DNS "SRV" lookup, which some routers,
    // ISPs and VPNs refuse (querySrv ECONNREFUSED). Retry with public DNS.
    if (!isSrvLookupError(err) || process.env.DNS_SERVERS) throw err;
    console.warn(`DNS lookup for the Atlas cluster failed (${err.code}). Retrying with public DNS servers…`);
    dns.setServers(PUBLIC_DNS);
    client = await openClient(uri);
  }
  db = client.db(process.env.MONGODB_DB || 'belmontvocational');
  await db.command({ ping: 1 });

  programmes = db.collection('programmes');
  applications = db.collection('applications');
  users = db.collection('users');
  sessions = db.collection('sessions');
  lessons = db.collection('lessons');
  docBucket = new GridFSBucket(db, { bucketName: 'documents' });
  // Videos are read in byte ranges while they play, so they use larger chunks.
  videoBucket = new GridFSBucket(db, { bucketName: 'videos', chunkSizeBytes: 1024 * 1024 });

  await Promise.all([
    programmes.createIndex({ id: 1 }, { unique: true }),
    programmes.createIndex({ status: 1, createdAt: -1 }),
    applications.createIndex({ id: 1 }, { unique: true }),
    applications.createIndex({ programmeId: 1, userId: 1 }, { unique: true }),
    applications.createIndex({ userId: 1 }),
    applications.createIndex({ createdAt: -1 }),
    users.createIndex({ id: 1 }, { unique: true }),
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ createdAt: -1 }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ userId: 1 }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    lessons.createIndex({ id: 1 }, { unique: true }),
    lessons.createIndex({ level: 1, order: 1 }),
  ]);

  if ((await programmes.estimatedDocumentCount()) === 0) await seed();
  return db;
}

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1'];

function isSrvLookupError(err) {
  return ['querySrv', 'queryTxt'].includes(err.syscall) || /^query(Srv|Txt) /.test(err.message || '');
}

async function openClient(uri) {
  const c = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: 'belmont-vocational' });
  await c.connect();
  return c;
}

async function seed() {
  const now = Date.now();
  await programmes.insertMany(seedProgrammes.map((p, i) => ({
    id: newId(),
    ...p,
    deadline: '',
    status: 'active',
    createdAt: new Date(now - i * 36e5 * 19).toISOString(),
    updatedAt: new Date(now - i * 36e5 * 19).toISOString(),
  })));
}

function close() {
  return client ? client.close() : Promise.resolve();
}

function ping() {
  return db.command({ ping: 1 });
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

// ---------- Programmes ----------

function listProgrammes(filter = {}) {
  return programmes.find(filter, NO_ID).sort({ createdAt: -1 }).toArray();
}

function getProgramme(id) {
  return programmes.findOne({ id: String(id) }, NO_ID);
}

async function createProgramme(data) {
  const now = new Date().toISOString();
  const programme = { id: newId(), ...data, createdAt: now, updatedAt: now };
  await programmes.insertOne({ ...programme });
  return programme;
}

function updateProgramme(id, data) {
  const { id: _ignore, createdAt, _id, ...rest } = data;
  return programmes.findOneAndUpdate(
    { id: String(id) },
    { $set: { ...rest, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', ...NO_ID }
  );
}

async function deleteProgramme(id) {
  // Applications are kept (they hold the programme title as a snapshot) so nothing is lost.
  const res = await programmes.deleteOne({ id: String(id) });
  return res.deletedCount === 1;
}

// ---------- Applications ----------

function listApplications(filter = {}) {
  return applications.find(filter, NO_ID).sort({ createdAt: -1 }).toArray();
}

function getApplication(id) {
  return applications.findOne({ id: String(id) }, NO_ID);
}

function findApplication(programmeId, userId) {
  return applications.findOne({ programmeId, userId }, NO_ID);
}

async function createApplication(data) {
  const app = { id: newId(), status: 'new', notes: '', ...data, createdAt: new Date().toISOString() };
  await applications.insertOne({ ...app });
  return app;
}

function updateApplication(id, data) {
  return applications.findOneAndUpdate(
    { id: String(id) },
    { $set: { ...data, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', ...NO_ID }
  );
}

function deleteApplication(id) {
  return applications.findOneAndDelete({ id: String(id) }, NO_ID);
}

async function countApplicationsBy(field) {
  const rows = await applications.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}

// ---------- Candidate accounts ----------

function listUsers(filter = {}) {
  return users.find(filter, PUBLIC_USER).sort({ createdAt: -1 }).toArray();
}

function getUser(id) {
  return users.findOne({ id: String(id) }, PUBLIC_USER);
}

// Only used for sign-in and password changes.
function getUserWithHash(query) {
  return users.findOne(query, NO_ID);
}

async function createUser(data) {
  const now = new Date().toISOString();
  const user = { id: newId(), documents: [], ...data, createdAt: now, updatedAt: now };
  await users.insertOne({ ...user });
  const { passwordHash, ...safe } = user;
  return safe;
}

function updateUser(id, data) {
  const { id: _ignore, createdAt, _id, email, documents, ...rest } = data;
  const set = { ...rest, updatedAt: new Date().toISOString() };
  if (email) set.email = email;
  return users.findOneAndUpdate({ id: String(id) }, { $set: set }, { returnDocument: 'after', ...PUBLIC_USER });
}

function addUserDocument(id, doc) {
  return users.findOneAndUpdate(
    { id: String(id) },
    { $push: { documents: doc }, $set: { updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', ...PUBLIC_USER }
  );
}

function removeUserDocument(id, docId) {
  return users.findOneAndUpdate(
    { id: String(id) },
    { $pull: { documents: { id: String(docId) } }, $set: { updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', ...PUBLIC_USER }
  );
}

async function deleteUser(id) {
  const user = await users.findOneAndDelete({ id: String(id) }, PUBLIC_USER);
  if (!user) return null;
  await Promise.all([
    ...(user.documents || []).map((d) => deleteFile(d.fileId)),
    applications.deleteMany({ userId: user.id }),
    sessions.deleteMany({ userId: user.id }),
  ]);
  return user;
}

// ---------- Uploaded documents (GridFS) ----------

function saveFile(buffer, filename, contentType, metadata = {}) {
  return new Promise((resolve, reject) => {
    const upload = docBucket.openUploadStream(filename, { metadata: { contentType, ...metadata } });
    upload.on('error', reject);
    upload.on('finish', () => resolve(upload.id.toString()));
    upload.end(buffer);
  });
}

function toObjectId(fileId) {
  return ObjectId.isValid(fileId) ? new ObjectId(String(fileId)) : null;
}

async function fileExists(fileId) {
  const _id = toObjectId(fileId);
  return Boolean(_id && (await docBucket.find({ _id }).limit(1).hasNext()));
}

function openFile(fileId) {
  return docBucket.openDownloadStream(toObjectId(fileId));
}

async function deleteFile(fileId) {
  const _id = toObjectId(fileId);
  if (!_id) return;
  await docBucket.delete(_id).catch(() => {});
}

// ---------- German class videos ----------

const LEVEL_ORDER = { A1: 1, A2: 2, B1: 3, B2: 4 };

async function listLessons(filter = {}) {
  const list = await lessons.find(filter, NO_ID).toArray();
  return list.sort((a, b) =>
    (LEVEL_ORDER[a.level] || 9) - (LEVEL_ORDER[b.level] || 9) || (a.order || 0) - (b.order || 0) || a.createdAt.localeCompare(b.createdAt));
}

function getLesson(id) {
  return lessons.findOne({ id: String(id) }, NO_ID);
}

async function createLesson(data) {
  const now = new Date().toISOString();
  const lesson = { id: newId(), ...data, createdAt: now, updatedAt: now };
  await lessons.insertOne({ ...lesson });
  return lesson;
}

function updateLesson(id, data) {
  const { id: _ignore, createdAt, _id, ...rest } = data;
  return lessons.findOneAndUpdate(
    { id: String(id) },
    { $set: { ...rest, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', ...NO_ID }
  );
}

async function deleteLesson(id) {
  const lesson = await lessons.findOneAndDelete({ id: String(id) }, NO_ID);
  if (!lesson) return null;
  await Promise.all([deleteVideo(lesson.videoFileId), deleteVideo(lesson.posterFileId)]);
  await users.updateMany({}, { $pull: { watchedLessons: lesson.id } });
  return lesson;
}

function markLessonWatched(userId, lessonId) {
  return users.updateOne({ id: String(userId) }, { $addToSet: { watchedLessons: String(lessonId) } });
}

// Streams a file from disk (multer's temp upload) into GridFS.
function saveVideoFromPath(filePath, filename, contentType) {
  return new Promise((resolve, reject) => {
    const upload = videoBucket.openUploadStream(filename, { metadata: { contentType } });
    const source = fs.createReadStream(filePath);
    source.on('error', reject);
    upload.on('error', reject);
    upload.on('finish', () => resolve(upload.id.toString()));
    source.pipe(upload);
  });
}

async function videoInfo(fileId) {
  const _id = toObjectId(fileId);
  return _id ? videoBucket.find({ _id }).limit(1).next() : null;
}

// `range` is { start, end } with `end` inclusive, as in an HTTP Range header.
function openVideo(fileId, range) {
  return videoBucket.openDownloadStream(toObjectId(fileId), range ? { start: range.start, end: range.end + 1 } : undefined);
}

async function deleteVideo(fileId) {
  const _id = toObjectId(fileId);
  if (!_id) return;
  await videoBucket.delete(_id).catch(() => {});
}

// ---------- Sessions (admin and candidates) ----------

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createSession(token, expiresAt, kind, userId) {
  return sessions.insertOne({ tokenHash: hashToken(token), kind, userId: userId || null, expiresAt });
}

async function getSession(token, kind) {
  const s = await sessions.findOne({ tokenHash: hashToken(token), kind });
  return s && s.expiresAt > new Date() ? s : null;
}

function deleteSession(token) {
  return sessions.deleteOne({ tokenHash: hashToken(token) });
}

function deleteUserSessions(userId, exceptToken) {
  const filter = { userId: String(userId) };
  if (exceptToken) filter.tokenHash = { $ne: hashToken(exceptToken) };
  return sessions.deleteMany(filter);
}

module.exports = {
  connect,
  close,
  ping,
  newId,
  listProgrammes,
  getProgramme,
  createProgramme,
  updateProgramme,
  deleteProgramme,
  listApplications,
  getApplication,
  findApplication,
  createApplication,
  updateApplication,
  deleteApplication,
  countApplicationsBy,
  listUsers,
  getUser,
  getUserWithHash,
  createUser,
  updateUser,
  addUserDocument,
  removeUserDocument,
  deleteUser,
  saveFile,
  fileExists,
  openFile,
  deleteFile,
  listLessons,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  markLessonWatched,
  saveVideoFromPath,
  videoInfo,
  openVideo,
  deleteVideo,
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
};
