'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Load settings from .env (MONGODB_URI, ADMIN_PASSWORD, ...) when present.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const express = require('express');
const multer = require('multer');
const archiver = require('archiver');

const store = require('./lib/store');
const auth = require('./lib/auth');

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.disable('x-powered-by');
// Behind a hosting proxy (Render, Railway, Heroku…) set TRUST_PROXY=1 so
// rate limits see the visitor's IP instead of the proxy's.
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy ? (/^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy) : 'loopback');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '200kb' }));

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const FIELDS = ['Nursing', 'Hotel & Hospitality', 'IT', 'Automobile', 'Mechatronics', 'Other'];
const PROGRAMME_TYPES = ['Ausbildung', 'Nursing degree', 'Study programme'];
const INTAKES = ['Winter (Sep / Oct)', 'Summer (Mar / Apr)'];
const GERMAN_LEVELS = ['None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const EDUCATION_LEVELS = ['O/L', 'A/L', 'Diploma', "Bachelor's degree", 'Other'];
const PROGRAMME_STATUSES = ['active', 'draft', 'closed'];
const APP_STATUSES = ['new', 'reviewing', 'shortlisted', 'interview', 'offer', 'visa', 'enrolled', 'rejected', 'withdrawn'];
const ACCOUNT_STATUSES = ['active', 'suspended'];
const STAGES = [
  ['registered', 'Registered'],
  ['german-course', 'German course'],
  ['b1-passed', 'B1 passed'],
  ['applying', 'Applying'],
  ['offer', 'Offer received'],
  ['blocked-account', 'Blocked account'],
  ['visa', 'Visa'],
  ['departed', 'In Germany'],
];
const PAYMENTS = [
  ['not-paid', 'Not paid'],
  ['initial-paid', 'Initial payment received'],
  ['fully-paid', 'Fully paid'],
];
const DOC_TYPES = {
  cv: 'Europass CV',
  passport: 'Passport',
  photo: 'Passport photo',
  education: 'Education certificates',
  language: 'Language certificate',
  other: 'Other document',
};

// The candidate profile, described once and rendered by both the account page
// and the admin panel. `required` fields must be filled in before applying.
const PROFILE_FIELDS = [
  { section: 'Personal details', key: 'firstName', label: 'First name', type: 'text', required: true, max: 80 },
  { section: 'Personal details', key: 'lastName', label: 'Last name', type: 'text', required: true, max: 80 },
  { section: 'Personal details', key: 'phone', label: 'Phone / WhatsApp', type: 'tel', required: true, max: 40 },
  { section: 'Personal details', key: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
  { section: 'Personal details', key: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male', 'Other', 'Prefer not to say'] },
  { section: 'Personal details', key: 'nationality', label: 'Nationality', type: 'text', required: true, max: 80 },
  { section: 'Personal details', key: 'country', label: 'Country of residence', type: 'text', max: 80 },
  { section: 'Personal details', key: 'city', label: 'City', type: 'text', max: 80 },
  { section: 'Personal details', key: 'address', label: 'Address', type: 'text', max: 200, full: true },
  { section: 'Education & experience', key: 'highestEducation', label: 'Highest education', type: 'select', options: EDUCATION_LEVELS, required: true },
  { section: 'Education & experience', key: 'alStream', label: 'A/L stream / main subjects', type: 'text', max: 120, hint: 'e.g. Biology, Maths, Technology, Commerce, Arts' },
  { section: 'Education & experience', key: 'educationDetails', label: 'Education and training (with years)', type: 'textarea', max: 4000, full: true, hint: 'One per line, e.g. 2019–2021 · G.C.E. A/L · School name' },
  { section: 'Education & experience', key: 'workExperience', label: 'Work experience (with years)', type: 'textarea', max: 4000, full: true, hint: 'One per line, e.g. 2022–2024 · Hotel receptionist · Hotel name' },
  { section: 'Language & skills', key: 'germanLevel', label: 'German level', type: 'select', options: GERMAN_LEVELS, required: true },
  { section: 'Language & skills', key: 'germanCertificate', label: 'German certificate', type: 'select', options: ['None yet', 'Goethe-Institut', 'telc', 'ÖSD', 'ECL', 'Other'] },
  { section: 'Language & skills', key: 'englishLevel', label: 'English (e.g. IELTS 5.5)', type: 'text', max: 80 },
  { section: 'Language & skills', key: 'digitalSkills', label: 'Digital skills', type: 'text', max: 200 },
  { section: 'Language & skills', key: 'hobbies', label: 'Hobbies and interests', type: 'text', max: 200, full: true },
  { section: 'Your goals', key: 'preferredField', label: 'Preferred field', type: 'select', options: FIELDS },
  { section: 'Your goals', key: 'preferredIntake', label: 'Preferred intake', type: 'select', options: INTAKES },
  { section: 'Your goals', key: 'sponsorInGermany', label: 'Sponsor in Germany?', type: 'select', options: ['No', 'Yes'], hint: 'A qualifying sponsor can replace the blocked account.' },
  { section: 'Your goals', key: 'about', label: 'Europass profile – about you', type: 'textarea', max: 2000, full: true, hint: 'A short introduction: who you are and why you want to train in Germany.' },
];
const REQUIRED_DOCS = ['cv', 'passport'];

const DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
const MAX_DOC_BYTES = 8 * 1024 * 1024;
const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};
const INLINE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

// German class videos
const LESSON_LEVELS = ['A1', 'A2', 'B1', 'B2'];
const LESSON_ACCESS = ['members', 'free'];
const LESSON_STATUSES = ['published', 'draft'];
const VIDEO_TYPES = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm' };
const POSTER_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const keys = (pairs) => pairs.map((p) => p[0]);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function sanitizeProgramme(body) {
  const errors = [];
  const years = parseFloat(body.durationYears);
  const p = {
    title: str(body.title, 140),
    employer: str(body.employer, 120),
    location: str(body.location, 80),
    field: oneOf(body.field, FIELDS, 'Other'),
    type: oneOf(body.type, PROGRAMME_TYPES, 'Ausbildung'),
    intake: oneOf(body.intake, INTAKES, INTAKES[0]),
    durationYears: Number.isFinite(years) && years > 0 && years <= 8 ? Math.round(years * 2) / 2 : 3,
    germanLevel: oneOf(body.germanLevel, GERMAN_LEVELS, 'B1'),
    education: str(body.education, 80),
    allowanceMin: toInt(body.allowanceMin),
    allowanceMax: toInt(body.allowanceMax),
    seats: toInt(body.seats),
    featured: Boolean(body.featured),
    status: oneOf(body.status, PROGRAMME_STATUSES, 'active'),
    summary: str(body.summary, 300),
    description: str(body.description, 20000),
    deadline: isDate(body.deadline) ? body.deadline : '',
  };
  if (!p.title) errors.push('Title is required.');
  if (!p.employer) errors.push('Training provider is required.');
  if (!p.location) errors.push('Location is required.');
  if (!p.description) errors.push('Description is required.');
  if (p.allowanceMin != null && p.allowanceMax != null && p.allowanceMin > p.allowanceMax) {
    errors.push('Minimum allowance cannot be higher than maximum allowance.');
  }
  return { programme: p, errors };
}

function isOpen(p) {
  if (p.status !== 'active') return false;
  if (p.deadline && p.deadline < new Date().toISOString().slice(0, 10)) return false;
  return true;
}

function sanitizeProfile(body) {
  const profile = {};
  PROFILE_FIELDS.forEach((f) => {
    if (!(f.key in body)) return;
    const v = body[f.key];
    if (f.type === 'select') profile[f.key] = oneOf(v, f.options, '');
    else if (f.type === 'date') profile[f.key] = isDate(v) ? v : '';
    else profile[f.key] = str(v, f.max || 200);
  });
  return profile;
}

// What is still missing before the candidate can apply, plus a % for the UI.
function completeness(user) {
  const docs = new Set((user.documents || []).map((d) => d.type));
  const missingFields = PROFILE_FIELDS.filter((f) => f.required && !user[f.key]).map((f) => f.label);
  const missingDocs = REQUIRED_DOCS.filter((t) => !docs.has(t)).map((t) => DOC_TYPES[t]);
  const emptyOptional = PROFILE_FIELDS.filter((f) => !f.required && !user[f.key]).length;
  const total = PROFILE_FIELDS.length + REQUIRED_DOCS.length;
  const done = total - missingFields.length - missingDocs.length - emptyOptional;
  return {
    percent: Math.round((done / total) * 100),
    missingFields,
    missingDocs,
    // A CV is enough to apply; the passport can follow later.
    canApply: !missingFields.length && docs.has('cv'),
  };
}

function publicUser(user) {
  const { notes, payment, ...rest } = user; // internal admin fields stay internal
  return rest;
}

// ---------------------------------------------------------------------------
// File uploads (documents)
// ---------------------------------------------------------------------------

// Documents are held in memory (max 8 MB) and then written to MongoDB GridFS.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_BYTES, files: 1, fields: 10, fieldSize: 2000 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!DOC_EXTENSIONS.includes(ext)) return cb(new Error('Please upload a PDF, Word document, JPG or PNG.'));
    cb(null, true);
  },
});

function parseUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (!err) return resolve();
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Files must be smaller than 8 MB.';
      reject(err);
    });
  });
}

// Videos can be large, so they go to a temp file on disk and are then streamed into GridFS.
const videoUpload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 2, fields: 20, fieldSize: 5000 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'video' && !VIDEO_TYPES[ext]) return cb(new Error('Videos must be MP4 or WebM files.'));
    if (file.fieldname === 'poster' && !POSTER_TYPES[ext]) return cb(new Error('The cover image must be a JPG, PNG or WebP.'));
    if (!['video', 'poster'].includes(file.fieldname)) return cb(new Error('Unexpected file.'));
    cb(null, true);
  },
});

function parseVideoUpload(req, res) {
  return new Promise((resolve, reject) => {
    videoUpload.fields([{ name: 'video', maxCount: 1 }, { name: 'poster', maxCount: 1 }])(req, res, (err) => {
      if (!err) return resolve();
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Videos must be smaller than 300 MB.';
      reject(err);
    });
  });
}

// Accepts youtu.be, youtube.com/watch, /embed and /shorts links, or a bare video id.
function youtubeId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : '';
}

// Simple per-IP rate limits.
function rateLimit(name, max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    list.push(now);
    hits.set(req.ip, list);
    next();
  };
}

function safeFileName(name) {
  return path.basename(name).replace(/[^\w.\- ()]/g, '_').slice(0, 120);
}

function docDownloadName(user, doc) {
  const base = `${user.firstName || ''}-${user.lastName || ''}-${DOC_TYPES[doc.type] || 'Document'}`.replace(/[^\w\-]+/g, '_');
  return `${base}${doc.ext}`;
}

async function sendDocument(res, user, doc, inline) {
  if (!doc || !(await store.fileExists(doc.fileId))) return res.status(404).json({ error: 'Document not found.' });
  const asInline = inline && INLINE_EXTENSIONS.includes(doc.ext);
  res.setHeader('Content-Type', CONTENT_TYPES[doc.ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${asInline ? 'inline' : 'attachment'}; filename="${docDownloadName(user, doc)}"`);
  if (doc.size) res.setHeader('Content-Length', doc.size);
  store.openFile(doc.fileId).on('error', () => res.destroy()).pipe(res);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

app.get('/api/health', async (req, res) => {
  try {
    await store.ping();
    res.json({ ok: true, database: 'connected' });
  } catch (e) {
    res.status(503).json({ ok: false, database: 'unreachable' });
  }
});

app.get('/api/meta', async (req, res) => {
  const open = (await store.listProgrammes({ status: 'active' })).filter(isOpen);
  const count = (key) => open.reduce((acc, p) => ((acc[p[key]] = (acc[p[key]] || 0) + 1), acc), {});
  res.json({
    fields: FIELDS,
    types: PROGRAMME_TYPES,
    intakes: INTAKES,
    germanLevels: GERMAN_LEVELS,
    fieldCounts: count('field'),
    locations: Object.keys(count('location')).sort(),
    stats: {
      programmes: open.length,
      seats: open.reduce((s, p) => s + (p.seats || 0), 0),
      cities: new Set(open.map((p) => p.location)).size,
    },
  });
});

app.get('/api/programmes', async (req, res) => {
  const q = str(req.query.q).toLowerCase();
  const location = str(req.query.location).toLowerCase();
  const { field, type, intake } = req.query;
  const sort = req.query.sort;

  let list = (await store.listProgrammes({ status: 'active' })).filter(isOpen);
  if (q) {
    list = list.filter((p) =>
      [p.title, p.employer, p.summary, p.field, p.location, p.description].join(' ').toLowerCase().includes(q)
    );
  }
  if (location) list = list.filter((p) => p.location.toLowerCase().includes(location));
  if (field) list = list.filter((p) => p.field === field);
  if (type) list = list.filter((p) => p.type === type);
  if (intake) list = list.filter((p) => p.intake === intake);
  if (req.query.featured === '1') list = list.filter((p) => p.featured);
  if (sort === 'allowance') list.sort((a, b) => (b.allowanceMax || 0) - (a.allowanceMax || 0));

  const limit = toInt(req.query.limit);
  if (limit) list = list.slice(0, limit);
  res.json({ programmes: list });
});

app.get('/api/programmes/:id', async (req, res) => {
  const p = await store.getProgramme(req.params.id);
  if (!p || p.status === 'draft') return res.status(404).json({ error: 'Programme not found.' });
  res.json({ programme: p, open: isOpen(p) });
});

// ---------------------------------------------------------------------------
// Candidate accounts
// ---------------------------------------------------------------------------

app.post('/api/auth/register', rateLimit('register', 10, 60 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot
  const firstName = str(b.firstName, 80);
  const lastName = str(b.lastName, 80);
  const email = str(b.email, 160).toLowerCase();
  const phone = str(b.phone, 40);
  const password = typeof b.password === 'string' ? b.password : '';

  const errors = [];
  if (!firstName || !lastName) errors.push('Please enter your full name.');
  if (!isEmail(email)) errors.push('Please enter a valid email address.');
  if (password.length < 8) errors.push('Your password must have at least 8 characters.');
  if (b.consent !== true) errors.push('Please accept the privacy notice.');
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const exists = 'An account with this email already exists. Please sign in instead.';
  if (await store.getUserWithHash({ email })) return res.status(409).json({ error: exists });

  try {
    const user = await store.createUser({
      email, firstName, lastName, phone,
      passwordHash: await auth.hashPassword(password),
      accountStatus: 'active',
      stage: 'registered',
      payment: 'not-paid',
      notes: '',
    });
    await auth.startSession(req, res, 'user', user.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: exists });
    throw err;
  }
});

app.post('/api/auth/login', auth.userLogin);
app.post('/api/auth/logout', auth.userLogout);

app.get('/api/auth/me', async (req, res) => {
  const user = await auth.currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: publicUser(user), completeness: completeness(user) });
});

const account = express.Router();
account.use(auth.requireUser);

account.get('/options', (req, res) => {
  res.json({
    profileFields: PROFILE_FIELDS,
    documentTypes: DOC_TYPES,
    requiredDocs: REQUIRED_DOCS,
    stages: STAGES,
    applicationStatuses: APP_STATUSES,
  });
});

account.put('/profile', async (req, res) => {
  const profile = sanitizeProfile(req.body || {});
  if ('firstName' in profile && !profile.firstName) return res.status(400).json({ error: 'First name cannot be empty.' });
  if ('lastName' in profile && !profile.lastName) return res.status(400).json({ error: 'Last name cannot be empty.' });
  const user = await store.updateUser(req.user.id, profile);
  res.json({ user: publicUser(user), completeness: completeness(user) });
});

account.post('/password', async (req, res) => {
  const { current, next } = req.body || {};
  const full = await store.getUserWithHash({ id: req.user.id });
  if (!(await auth.verifyPassword(current || '', full.passwordHash))) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  if (typeof next !== 'string' || next.length < 8) return res.status(400).json({ error: 'The new password must have at least 8 characters.' });
  await store.updateUser(req.user.id, { passwordHash: await auth.hashPassword(next) });
  await store.deleteUserSessions(req.user.id, req.userToken); // sign out other devices
  res.json({ ok: true });
});

account.post('/documents', rateLimit('upload', 60, 60 * 60 * 1000), async (req, res) => {
  try {
    await parseUpload(req, res);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Please choose a file.' });
  const type = oneOf((req.body || {}).type, Object.keys(DOC_TYPES), 'other');
  if ((req.user.documents || []).length >= 30) return res.status(400).json({ error: 'You can upload up to 30 documents.' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const name = safeFileName(req.file.originalname);
  const fileId = await store.saveFile(req.file.buffer, name, CONTENT_TYPES[ext], { userId: req.user.id, type });
  const doc = { id: store.newId(), type, fileId, name, ext, size: req.file.size, uploadedAt: new Date().toISOString() };

  // CV, passport and photo are single documents: a new upload replaces the old one.
  let user = req.user;
  if (['cv', 'passport', 'photo'].includes(type)) {
    for (const old of (user.documents || []).filter((d) => d.type === type)) {
      user = await store.removeUserDocument(user.id, old.id);
      await store.deleteFile(old.fileId);
    }
  }
  user = await store.addUserDocument(user.id, doc);
  res.status(201).json({ user: publicUser(user), completeness: completeness(user) });
});

account.get('/documents/:docId', async (req, res) => {
  const doc = (req.user.documents || []).find((d) => d.id === req.params.docId);
  await sendDocument(res, req.user, doc, req.query.inline === '1');
});

account.delete('/documents/:docId', async (req, res) => {
  const doc = (req.user.documents || []).find((d) => d.id === req.params.docId);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  const user = await store.removeUserDocument(req.user.id, doc.id);
  await store.deleteFile(doc.fileId);
  res.json({ user: publicUser(user), completeness: completeness(user) });
});

account.get('/applications', async (req, res) => {
  const list = await store.listApplications({ userId: req.user.id });
  res.json({ applications: list.map(({ notes, ...a }) => a) });
});

account.post('/applications/:id/withdraw', async (req, res) => {
  const a = await store.getApplication(req.params.id);
  if (!a || a.userId !== req.user.id) return res.status(404).json({ error: 'Application not found.' });
  if (!['new', 'reviewing'].includes(a.status)) {
    return res.status(400).json({ error: 'This application is already being processed. Please contact Belmont to withdraw it.' });
  }
  const { notes, ...updated } = await store.updateApplication(a.id, { status: 'withdrawn' });
  res.json({ application: updated });
});

app.use('/api/account', account);

app.post('/api/programmes/:id/apply', rateLimit('apply', 20, 60 * 60 * 1000), auth.requireUser, async (req, res) => {
  const p = await store.getProgramme(req.params.id);
  if (!p || !isOpen(p)) return res.status(404).json({ error: 'This programme is no longer accepting applications.' });

  const c = completeness(req.user);
  if (!c.canApply) {
    const missing = [...c.missingFields, ...(c.missingDocs.includes(DOC_TYPES.cv) ? [DOC_TYPES.cv] : [])];
    return res.status(400).json({ error: `Please complete your profile first. Missing: ${missing.join(', ')}.`, incomplete: true });
  }

  const duplicateMsg = 'You have already applied for this programme.';
  const existing = await store.findApplication(p.id, req.user.id);
  if (existing && existing.status !== 'withdrawn') return res.status(409).json({ error: duplicateMsg });

  const data = {
    motivation: str((req.body || {}).motivation, 4000),
    programmeTitle: p.title,
    employer: p.employer,
    field: p.field,
    location: p.location,
    intake: p.intake,
  };
  try {
    // Re-applying after withdrawing reopens the old application.
    const application = existing
      ? await store.updateApplication(existing.id, { ...data, status: 'new', createdAt: new Date().toISOString() })
      : await store.createApplication({ ...data, programmeId: p.id, userId: req.user.id });
    if (['registered', 'german-course', 'b1-passed'].includes(req.user.stage)) {
      await store.updateUser(req.user.id, { stage: 'applying' });
    }
    res.status(201).json({ ok: true, id: application.id });
  } catch (err) {
    // Unique index on (programmeId, userId) catches two simultaneous submissions.
    if (err.code === 11000) return res.status(409).json({ error: duplicateMsg });
    throw err;
  }
});

// ---------------------------------------------------------------------------
// German classes (video lessons)
// ---------------------------------------------------------------------------

// "free" lessons are open to everyone; "members" lessons need a candidate account.
async function canWatch(req, lesson) {
  if (lesson.access === 'free' && lesson.status === 'published') return true;
  if (await auth.isAdmin(req)) return true;
  return lesson.status === 'published' && Boolean(await auth.currentUser(req));
}

function publicLesson(l, allowed, watched) {
  const version = encodeURIComponent(l.updatedAt || '');
  return {
    id: l.id,
    title: l.title,
    level: l.level,
    topic: l.topic,
    description: l.description,
    order: l.order,
    access: l.access,
    durationSec: l.durationSec,
    source: l.source,
    createdAt: l.createdAt,
    poster: l.posterFileId
      ? `/api/lessons/${l.id}/poster?v=${version}`
      : l.youtubeId ? `https://i.ytimg.com/vi/${l.youtubeId}/hqdefault.jpg` : '',
    locked: !allowed,
    videoUrl: allowed && l.videoFileId ? `/api/lessons/${l.id}/video?v=${version}` : '',
    youtubeId: allowed ? l.youtubeId || '' : '',
    watched: Boolean(watched),
  };
}

app.get('/api/lessons', async (req, res) => {
  const user = await auth.currentUser(req);
  const watched = new Set((user && user.watchedLessons) || []);
  const list = await store.listLessons({ status: 'published' });
  res.json({
    levels: LESSON_LEVELS,
    signedIn: Boolean(user),
    lessons: list.map((l) => publicLesson(l, l.access === 'free' || Boolean(user), watched.has(l.id))),
  });
});

// Streams a video with HTTP Range support so the player can seek.
async function streamVideo(req, res, fileId, contentType) {
  const info = await store.videoInfo(fileId);
  if (!info) return res.status(404).json({ error: 'Video not found.' });
  const size = info.length;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType || 'video/mp4');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] !== '' || m[2] !== '')) {
    let start;
    let end;
    if (m[1] === '') { // suffix range: the last N bytes
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    return store.openVideo(fileId, { start, end }).on('error', () => res.destroy()).pipe(res);
  }
  res.setHeader('Content-Length', size);
  store.openVideo(fileId).on('error', () => res.destroy()).pipe(res);
}

app.get('/api/lessons/:id/video', async (req, res) => {
  const lesson = await store.getLesson(req.params.id);
  if (!lesson || !lesson.videoFileId || (lesson.status !== 'published' && !(await auth.isAdmin(req)))) {
    return res.status(404).json({ error: 'Video not found.' });
  }
  if (!(await canWatch(req, lesson))) return res.status(401).json({ error: 'Please sign in to watch this lesson.' });
  await streamVideo(req, res, lesson.videoFileId, lesson.videoMime);
});

app.get('/api/lessons/:id/poster', async (req, res) => {
  const lesson = await store.getLesson(req.params.id);
  if (!lesson || !lesson.posterFileId) return res.status(404).json({ error: 'Image not found.' });
  await streamVideo(req, res, lesson.posterFileId, lesson.posterMime);
});

account.post('/lessons/:id/watched', async (req, res) => {
  const lesson = await store.getLesson(req.params.id);
  if (!lesson || lesson.status !== 'published') return res.status(404).json({ error: 'Lesson not found.' });
  await store.markLessonWatched(req.user.id, lesson.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

app.post('/api/admin/login', auth.adminLogin);
app.post('/api/admin/logout', auth.adminLogout);
app.get('/api/admin/me', async (req, res) => {
  if (!(await auth.isAdmin(req))) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ username: auth.ADMIN_USERNAME, defaultPassword: auth.USING_DEFAULT_PASSWORD });
});

const admin = express.Router();
admin.use(auth.requireAdmin);

admin.get('/options', (req, res) => {
  res.json({
    fields: FIELDS, types: PROGRAMME_TYPES, intakes: INTAKES, germanLevels: GERMAN_LEVELS,
    programmeStatuses: PROGRAMME_STATUSES, applicationStatuses: APP_STATUSES,
    accountStatuses: ACCOUNT_STATUSES, stages: STAGES, payments: PAYMENTS,
    profileFields: PROFILE_FIELDS, documentTypes: DOC_TYPES,
  });
});

admin.get('/stats', async (req, res) => {
  const [progs, apps, userList, counts] = await Promise.all([
    store.listProgrammes(), store.listApplications(), store.listUsers(), store.countApplicationsBy('programmeId'),
  ]);
  const byStatus = Object.fromEntries(APP_STATUSES.map((s) => [s, 0]));
  apps.forEach((a) => (byStatus[a.status] = (byStatus[a.status] || 0) + 1));
  const byStage = Object.fromEntries(keys(STAGES).map((s) => [s, 0]));
  userList.forEach((u) => (byStage[u.stage] = (byStage[u.stage] || 0) + 1));

  // Sign-ups and applications per day for the last 14 days.
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({
      date: d,
      applications: apps.filter((a) => a.createdAt.slice(0, 10) === d).length,
      users: userList.filter((u) => u.createdAt.slice(0, 10) === d).length,
    });
  }
  const userMap = new Map(userList.map((u) => [u.id, u]));

  res.json({
    programmes: {
      total: progs.length,
      active: progs.filter((p) => p.status === 'active').length,
      seats: progs.filter((p) => p.status === 'active').reduce((s, p) => s + (p.seats || 0), 0),
    },
    applications: { total: apps.length, byStatus },
    users: {
      total: userList.length,
      byStage,
      paid: userList.filter((u) => u.payment && u.payment !== 'not-paid').length,
    },
    days,
    topProgrammes: progs
      .map((p) => ({ id: p.id, title: p.title, employer: p.employer, field: p.field, count: counts[p.id] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    recent: apps.slice(0, 6).map((a) => withCandidate(a, userMap)),
    recentUsers: userList.slice(0, 6).map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, createdAt: u.createdAt, stage: u.stage })),
  });
});

// ---- Programmes

admin.get('/programmes', async (req, res) => {
  const [list, counts] = await Promise.all([store.listProgrammes(), store.countApplicationsBy('programmeId')]);
  res.json({ programmes: list.map((p) => ({ ...p, applicationsCount: counts[p.id] || 0 })) });
});

admin.get('/programmes/:id', async (req, res) => {
  const p = await store.getProgramme(req.params.id);
  if (!p) return res.status(404).json({ error: 'Programme not found.' });
  res.json({ programme: p });
});

admin.post('/programmes', async (req, res) => {
  const { programme, errors } = sanitizeProgramme(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  res.status(201).json({ programme: await store.createProgramme(programme) });
});

admin.put('/programmes/:id', async (req, res) => {
  const { programme, errors } = sanitizeProgramme(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const updated = await store.updateProgramme(req.params.id, programme);
  if (!updated) return res.status(404).json({ error: 'Programme not found.' });
  res.json({ programme: updated });
});

admin.patch('/programmes/:id', async (req, res) => {
  const p = await store.getProgramme(req.params.id);
  if (!p) return res.status(404).json({ error: 'Programme not found.' });
  const patch = {};
  if ('status' in req.body) patch.status = oneOf(req.body.status, PROGRAMME_STATUSES, p.status);
  if ('featured' in req.body) patch.featured = Boolean(req.body.featured);
  res.json({ programme: await store.updateProgramme(p.id, patch) });
});

admin.post('/programmes/:id/duplicate', async (req, res) => {
  const p = await store.getProgramme(req.params.id);
  if (!p) return res.status(404).json({ error: 'Programme not found.' });
  const { id, createdAt, updatedAt, ...rest } = p;
  res.status(201).json({ programme: await store.createProgramme({ ...rest, title: `${p.title} (copy)`, status: 'draft' }) });
});

admin.delete('/programmes/:id', async (req, res) => {
  if (!(await store.deleteProgramme(req.params.id))) return res.status(404).json({ error: 'Programme not found.' });
  res.json({ ok: true });
});

// ---- Applications

function withCandidate(a, userMap) {
  const u = userMap.get(a.userId) || {};
  return {
    ...a,
    candidate: {
      firstName: u.firstName || '', lastName: u.lastName || '', email: u.email || '', phone: u.phone || '',
      germanLevel: u.germanLevel || '', nationality: u.nationality || '', highestEducation: u.highestEducation || '',
      documentsCount: (u.documents || []).length,
    },
  };
}

async function filterApplications(query) {
  const filter = {};
  if (typeof query.programmeId === 'string' && query.programmeId) filter.programmeId = query.programmeId;
  if (typeof query.status === 'string' && query.status) filter.status = query.status;
  if (typeof query.userId === 'string' && query.userId) filter.userId = query.userId;
  const [list, userList] = await Promise.all([store.listApplications(filter), store.listUsers()]);
  const userMap = new Map(userList.map((u) => [u.id, u]));
  let apps = list.map((a) => withCandidate(a, userMap));
  const q = str(query.q).toLowerCase();
  if (q) {
    apps = apps.filter((a) =>
      [a.candidate.firstName, a.candidate.lastName, a.candidate.email, a.programmeTitle, a.employer, a.location, a.candidate.nationality]
        .join(' ').toLowerCase().includes(q)
    );
  }
  return { apps, userMap };
}

admin.get('/applications', async (req, res) => {
  res.json({ applications: (await filterApplications(req.query)).apps });
});

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(cols, rows) {
  const lines = [cols.map((c) => csvCell(c[0])).join(',')];
  rows.forEach((r) => lines.push(cols.map((c) => csvCell(c[1](r))).join(',')));
  return '﻿' + lines.join('\r\n');
}

const label = (pairs, value) => (pairs.find((p) => p[0] === value) || [null, value || ''])[1];

const profileCols = (get) => PROFILE_FIELDS.map((f) => [f.label, (r) => get(r)[f.key]]);

function applicationsCsv(apps, userMap) {
  return toCsv([
    ['Applied at', (a) => a.createdAt],
    ['Status', (a) => a.status],
    ['Programme', (a) => a.programmeTitle],
    ['Training provider', (a) => a.employer],
    ['Field', (a) => a.field],
    ['Location', (a) => a.location],
    ['Intake', (a) => a.intake],
    ['Email', (a) => (userMap.get(a.userId) || {}).email],
    ...profileCols((a) => userMap.get(a.userId) || {}),
    ['Motivation', (a) => a.motivation],
    ['Notes', (a) => a.notes],
  ], apps);
}

function usersCsv(list) {
  return toCsv([
    ['Registered at', (u) => u.createdAt],
    ['Email', (u) => u.email],
    ...profileCols((u) => u),
    ['Account status', (u) => u.accountStatus],
    ['Stage', (u) => label(STAGES, u.stage)],
    ['Payment', (u) => label(PAYMENTS, u.payment)],
    ['Documents', (u) => (u.documents || []).map((d) => `${DOC_TYPES[d.type]}: ${d.name}`).join('; ')],
    ['Notes', (u) => u.notes],
  ], list);
}

async function exportName(prefix, query, ext) {
  const p = typeof query.programmeId === 'string' && query.programmeId && (await store.getProgramme(query.programmeId));
  const slug = p ? p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : 'all';
  return `${prefix}-${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

const folderName = (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim().replace(/[^\w\- ]+/g, '_') || u.id;

// Adds every document of the given candidates to the zip, one folder each.
async function appendUserDocuments(zip, userList, prefix = '') {
  const usedFolders = new Set();
  for (const u of userList) {
    let folder = folderName(u);
    if (usedFolders.has(folder)) folder = `${folder} (${u.id})`;
    usedFolders.add(folder);
    const usedNames = new Set();
    for (const d of u.documents || []) {
      if (!(await store.fileExists(d.fileId))) continue;
      let name = `${DOC_TYPES[d.type] || 'Document'} - ${d.name}`;
      if (usedNames.has(name)) name = `${d.id}-${name}`;
      usedNames.add(name);
      // archiver reads the streams one at a time, so only one file is open at once.
      zip.append(store.openFile(d.fileId), { name: `${prefix}${folder}/${name}` });
    }
  }
}

function startZip(res, filename) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.on('error', () => res.destroy());
  zip.pipe(res);
  return zip;
}

admin.get('/applications/export.csv', async (req, res) => {
  const { apps, userMap } = await filterApplications(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${await exportName('applications', req.query, 'csv')}"`);
  res.send(applicationsCsv(apps, userMap));
});

admin.get('/applications/export.zip', async (req, res) => {
  const { apps, userMap } = await filterApplications(req.query);
  const zip = startZip(res, await exportName('applications', req.query, 'zip'));
  zip.append(applicationsCsv(apps, userMap), { name: 'applications.csv' });
  const applicants = [...new Set(apps.map((a) => a.userId))].map((id) => userMap.get(id)).filter(Boolean);
  await appendUserDocuments(zip, applicants, 'documents/');
  zip.finalize();
});

admin.get('/applications/:id', async (req, res) => {
  const a = await store.getApplication(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found.' });
  const user = await store.getUser(a.userId);
  res.json({ application: a, user, completeness: user ? completeness(user) : null });
});

admin.patch('/applications/:id', async (req, res) => {
  const a = await store.getApplication(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found.' });
  const patch = {};
  if ('status' in req.body) patch.status = oneOf(req.body.status, APP_STATUSES, a.status);
  if ('notes' in req.body) patch.notes = str(req.body.notes, 5000);
  res.json({ application: await store.updateApplication(a.id, patch) });
});

admin.delete('/applications/:id', async (req, res) => {
  const removed = await store.deleteApplication(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Application not found.' });
  res.json({ ok: true });
});

// ---- Candidates (user profiles)

admin.get('/users', async (req, res) => {
  const [list, counts] = await Promise.all([store.listUsers(), store.countApplicationsBy('userId')]);
  res.json({
    users: list.map((u) => ({
      ...u,
      applicationsCount: counts[u.id] || 0,
      documentsCount: (u.documents || []).length,
      completeness: completeness(u).percent,
    })),
  });
});

admin.get('/users/export.csv', async (req, res) => {
  const list = await store.listUsers();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="candidates-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(usersCsv(list));
});

admin.get('/users/:id', async (req, res) => {
  const user = await store.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Candidate not found.' });
  const apps = await store.listApplications({ userId: user.id });
  res.json({ user, applications: apps, completeness: completeness(user) });
});

admin.put('/users/:id', async (req, res) => {
  const user = await store.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Candidate not found.' });
  const profile = sanitizeProfile(req.body || {});
  if (!profile.firstName || !profile.lastName) return res.status(400).json({ error: 'First and last name are required.' });
  const email = str((req.body || {}).email, 160).toLowerCase();
  if (email && email !== user.email) {
    if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (await store.getUserWithHash({ email })) return res.status(409).json({ error: 'Another account already uses this email.' });
    profile.email = email;
  }
  const updated = await store.updateUser(user.id, profile);
  res.json({ user: updated, completeness: completeness(updated) });
});

admin.patch('/users/:id', async (req, res) => {
  const user = await store.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Candidate not found.' });
  const b = req.body || {};
  const patch = {};
  if ('accountStatus' in b) patch.accountStatus = oneOf(b.accountStatus, ACCOUNT_STATUSES, user.accountStatus);
  if ('stage' in b) patch.stage = oneOf(b.stage, keys(STAGES), user.stage);
  if ('payment' in b) patch.payment = oneOf(b.payment, keys(PAYMENTS), user.payment);
  if ('notes' in b) patch.notes = str(b.notes, 5000);
  const updated = await store.updateUser(user.id, patch);
  if (patch.accountStatus === 'suspended') await store.deleteUserSessions(user.id);
  res.json({ user: updated });
});

admin.post('/users/:id/reset-password', async (req, res) => {
  const user = await store.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Candidate not found.' });
  // Readable temporary password without look-alike characters.
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const password = Array.from(crypto.randomBytes(12), (b) => alphabet[b % alphabet.length]).join('');
  await store.updateUser(user.id, { passwordHash: await auth.hashPassword(password) });
  await store.deleteUserSessions(user.id);
  res.json({ password });
});

admin.delete('/users/:id', async (req, res) => {
  if (!(await store.deleteUser(req.params.id))) return res.status(404).json({ error: 'Candidate not found.' });
  res.json({ ok: true });
});

admin.get('/users/:id/documents.zip', async (req, res) => {
  const user = await store.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Candidate not found.' });
  const zip = startZip(res, `${folderName(user).replace(/ /g, '-')}-documents.zip`);
  zip.append(usersCsv([user]), { name: 'profile.csv' });
  await appendUserDocuments(zip, [user]);
  zip.finalize();
});

admin.get('/users/:id/documents/:docId', async (req, res) => {
  const user = await store.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'Candidate not found.' });
  const doc = (user.documents || []).find((d) => d.id === req.params.docId);
  await sendDocument(res, user, doc, req.query.inline === '1');
});

admin.delete('/users/:id/documents/:docId', async (req, res) => {
  const user = await store.getUser(req.params.id);
  const doc = user && (user.documents || []).find((d) => d.id === req.params.docId);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  const updated = await store.removeUserDocument(user.id, doc.id);
  await store.deleteFile(doc.fileId);
  res.json({ user: updated });
});

// ---- German class videos

function sanitizeLesson(body, existing, hasNewVideo) {
  const errors = [];
  const duration = toInt(body.durationSec);
  const order = parseInt(body.order, 10);
  const lesson = {
    title: str(body.title, 140),
    level: oneOf(body.level, LESSON_LEVELS, 'A1'),
    topic: str(body.topic, 80),
    description: str(body.description, 2000),
    order: Number.isFinite(order) ? order : 0,
    access: oneOf(body.access, LESSON_ACCESS, 'members'),
    status: oneOf(body.status, LESSON_STATUSES, 'published'),
    durationSec: duration != null && duration <= 4 * 3600 ? duration : (existing && existing.durationSec) || null,
    source: oneOf(body.source, ['upload', 'youtube'], 'upload'),
  };
  if (!lesson.title) errors.push('Title is required.');
  if (lesson.source === 'youtube') {
    lesson.youtubeId = youtubeId(body.youtubeUrl);
    if (!lesson.youtubeId) errors.push('Please paste a valid YouTube link.');
  } else if (!hasNewVideo && !(existing && existing.videoFileId)) {
    errors.push('Please choose a video file.');
  }
  return { lesson, errors };
}

function removeTempFiles(req) {
  Object.values(req.files || {}).flat().forEach((f) => fs.unlink(f.path, () => {}));
}

async function saveLesson(req, res, existing) {
  try {
    await parseVideoUpload(req, res);
  } catch (err) {
    removeTempFiles(req);
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  }
  try {
    const video = req.files && req.files.video && req.files.video[0];
    const poster = req.files && req.files.poster && req.files.poster[0];
    const b = req.body || {};
    const { lesson, errors } = sanitizeLesson(b, existing, Boolean(video));
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const oldFiles = [];
    if (lesson.source === 'upload' && video) {
      const ext = path.extname(video.originalname).toLowerCase();
      lesson.videoFileId = await store.saveVideoFromPath(video.path, safeFileName(video.originalname), VIDEO_TYPES[ext]);
      lesson.videoMime = VIDEO_TYPES[ext];
      lesson.videoSize = video.size;
      lesson.videoName = safeFileName(video.originalname);
      if (existing && existing.videoFileId) oldFiles.push(existing.videoFileId);
    }
    if (lesson.source === 'youtube') {
      Object.assign(lesson, { videoFileId: '', videoMime: '', videoSize: 0, videoName: '' });
      if (existing && existing.videoFileId) oldFiles.push(existing.videoFileId);
    } else {
      lesson.youtubeId = '';
    }
    if (poster) {
      const ext = path.extname(poster.originalname).toLowerCase();
      lesson.posterFileId = await store.saveVideoFromPath(poster.path, safeFileName(poster.originalname), POSTER_TYPES[ext]);
      lesson.posterMime = POSTER_TYPES[ext];
      if (existing && existing.posterFileId) oldFiles.push(existing.posterFileId);
    } else if (b.removePoster === '1' && existing && existing.posterFileId) {
      lesson.posterFileId = '';
      oldFiles.push(existing.posterFileId);
    }

    const saved = existing ? await store.updateLesson(existing.id, lesson) : await store.createLesson(lesson);
    await Promise.all(oldFiles.map((id) => store.deleteVideo(id)));
    res.status(existing ? 200 : 201).json({ lesson: saved });
  } finally {
    removeTempFiles(req);
  }
}

admin.get('/lessons', async (req, res) => {
  const list = await store.listLessons();
  const userList = await store.listUsers();
  const watchCounts = {};
  userList.forEach((u) => (u.watchedLessons || []).forEach((id) => (watchCounts[id] = (watchCounts[id] || 0) + 1)));
  res.json({
    levels: LESSON_LEVELS,
    lessons: list.map((l) => ({ ...publicLesson(l, true, false), status: l.status, youtubeId: l.youtubeId || '', videoSize: l.videoSize || 0, videoName: l.videoName || '', hasPoster: Boolean(l.posterFileId), watchedBy: watchCounts[l.id] || 0 })),
  });
});

admin.post('/lessons', (req, res) => saveLesson(req, res, null));

admin.put('/lessons/:id', async (req, res) => {
  const existing = await store.getLesson(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Lesson not found.' });
  await saveLesson(req, res, existing);
});

admin.patch('/lessons/:id', async (req, res) => {
  const l = await store.getLesson(req.params.id);
  if (!l) return res.status(404).json({ error: 'Lesson not found.' });
  const b = req.body || {};
  const patch = {};
  if ('status' in b) patch.status = oneOf(b.status, LESSON_STATUSES, l.status);
  if ('access' in b) patch.access = oneOf(b.access, LESSON_ACCESS, l.access);
  if ('order' in b && Number.isFinite(parseInt(b.order, 10))) patch.order = parseInt(b.order, 10);
  res.json({ lesson: await store.updateLesson(l.id, patch) });
});

admin.delete('/lessons/:id', async (req, res) => {
  if (!(await store.deleteLesson(req.params.id))) return res.status(404).json({ error: 'Lesson not found.' });
  res.json({ ok: true });
});

app.use('/api/admin', admin);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------------------------------------------------------------------------
// Static site
// ---------------------------------------------------------------------------

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

function connectionHint(err) {
  const msg = `${err.message} ${err.cause ? err.cause.message : ''}`;
  if (['ENOTFOUND', 'ENODATA'].includes(err.code) || /ENOTFOUND|ENODATA/.test(msg)) {
    return 'The cluster address was not found. Copy the connection string again from Atlas → Connect → Drivers and check the part after the @.';
  }
  if (err.syscall === 'querySrv' || /querySrv|queryTxt/.test(msg)) {
    return 'Your network\'s DNS server refused the lookup that mongodb+srv:// addresses need. Set DNS_SERVERS=8.8.8.8,1.1.1.1 in .env, ' +
      'switch your computer\'s DNS to 8.8.8.8 / 1.1.1.1, or use the standard (non-SRV) connection string from Atlas. See README → Troubleshooting.';
  }
  if (/auth|Authentication failed|bad auth/i.test(msg)) {
    return 'Atlas rejected the username or password. Check the database user in Atlas → Database Access, and URL-encode special characters in the password.';
  }
  if (err.name === 'MongoServerSelectionError' || /Server selection timed out|ETIMEDOUT|ECONNRESET/.test(msg)) {
    return 'The cluster could not be reached. Make sure Atlas → Network Access allows this computer\'s IP address, and that your network allows outgoing connections on port 27017.';
  }
  return 'Check MONGODB_URI, your database user/password, and that Atlas Network Access allows this server\'s IP address.';
}

store
  .connect()
  .then(() => {
    console.log('Connected to MongoDB.');
    const server = app.listen(PORT, () => {
      console.log(`Belmont Vocational Training running on http://localhost:${PORT}`);
      console.log(`Admin panel: http://localhost:${PORT}/admin`);
      if (auth.USING_DEFAULT_PASSWORD) {
        console.warn('WARNING: using the default admin password. Set ADMIN_PASSWORD before going live.');
      }
    });
    const shutdown = () => server.close(() => store.close().finally(() => process.exit(0)));
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    console.error(`Could not connect to MongoDB: ${err.message}`);
    console.error(connectionHint(err));
    process.exit(1);
  });
