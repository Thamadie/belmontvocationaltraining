(function () {
  'use strict';
  const {
    api, esc, icon, toast, fieldBadge, initials, timeAgo, fmtDate, allowanceRange, years, hydrateIcons,
    profileFormHtml, readForm, showFormError, observeCounters,
  } = window.BVT;

  const $ = (id) => document.getElementById(id);
  const VIEWS = {
    dashboard: ['Dashboard', 'Overview of programmes, applications and candidates'],
    programmes: ['Programmes', 'Publish and manage training programmes'],
    applications: ['Applications', 'Review applications and download documents'],
    candidates: ['Candidates', 'Manage candidate profiles, documents and progress'],
    lessons: ['German classes', 'Short video lessons from A1 to B2'],
  };
  const STATUS_LABELS = {
    new: 'New', reviewing: 'Reviewing', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offer',
    visa: 'Visa', enrolled: 'Enrolled', rejected: 'Rejected', withdrawn: 'Withdrawn',
    active: 'Active', draft: 'Draft', closed: 'Closed', suspended: 'Suspended',
  };

  let options = null;
  let programmes = [];
  let applications = [];
  let users = [];
  const progFilter = { q: '', status: '' };
  const appFilter = { q: '', programmeId: '', status: '' };
  const userFilter = { q: '', stage: '', payment: '' };

  const label = (pairs, v) => (pairs.find((p) => p[0] === v) || [v, v || '—'])[1];
  const fullName = (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || '(no name)';

  // ---------------------------------------------------------------- auth

  async function boot() {
    try {
      const me = await api('/api/admin/me');
      $('avatar').textContent = (me.username || 'A')[0].toUpperCase();
      $('pw-warning').hidden = !me.defaultPassword;
      showApp();
    } catch (e) {
      showLogin();
    }
  }

  function showLogin() {
    $('app').hidden = true;
    $('login').hidden = false;
    setTimeout(() => $('l-user').focus(), 50);
  }

  async function showApp() {
    $('login').hidden = true;
    $('app').hidden = false;
    options = options || (await api('/api/admin/options'));
    fillSelects();
    route();
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('login-error');
    err.classList.remove('show');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('/api/admin/login', { method: 'POST', body: { username: $('l-user').value, password: $('l-pass').value } });
      $('l-pass').value = '';
      await boot();
      toast('Welcome back!');
    } catch (ex) {
      showFormError(err, ex.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('logout').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  // Any 401 from the API means the session expired.
  async function call(url, opts) {
    try {
      return await api(url, opts);
    } catch (e) {
      if (e.status === 401) {
        showLogin();
        toast('Your session has expired. Please sign in again.', 'error');
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------- routing

  function route() {
    const [view, query] = (location.hash.slice(1) || 'dashboard').split('?');
    const name = VIEWS[view] ? view : 'dashboard';
    if (name === 'applications' && query) {
      const p = new URLSearchParams(query);
      appFilter.programmeId = p.get('programmeId') || '';
      appFilter.status = p.get('status') || '';
    }
    if (name === 'candidates' && query) {
      const p = new URLSearchParams(query);
      userFilter.stage = p.get('stage') || '';
    }
    document.querySelectorAll('.view').forEach((v) => (v.hidden = v.dataset.view !== name));
    document.querySelectorAll('.side-nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
    $('view-title').textContent = VIEWS[name][0];
    $('view-sub').textContent = VIEWS[name][1];
    $('new-programme-btn').hidden = name === 'lessons';
    $('new-lesson-btn').hidden = name !== 'lessons';
    closeSidebar();
    if (name === 'lessons') loadLessons();
    if (name === 'dashboard') loadDashboard();
    if (name === 'programmes') loadProgrammes();
    if (name === 'applications') loadApplications();
    if (name === 'candidates') loadUsers();
  }
  window.addEventListener('hashchange', () => !$('app').hidden && route());

  function refreshCounts() {
    $('nav-programmes').textContent = programmes.filter((p) => p.status === 'active').length || '';
    $('nav-apps').textContent = applications.filter((a) => a.status === 'new').length || '';
    $('nav-users').textContent = users.length || '';
  }

  function isVisible(view) {
    return !document.querySelector(`.view[data-view="${view}"]`).hidden;
  }

  // ---------------------------------------------------------------- dashboard

  function sbars(el, entries, total) {
    el.innerHTML = entries.map(([name, n], i) =>
      `<div class="sbar-row"><span>${esc(name)}</span><div class="sbar-track"><div class="sbar-fill" style="width:${(n / Math.max(1, total)) * 100}%;animation-delay:${i * 0.06}s"></div></div><strong>${n}</strong></div>`
    ).join('');
  }

  async function loadDashboard() {
    const s = await call('/api/admin/stats');
    const stat = (cls, ic, value, text) =>
      `<div class="stat ${cls}"><div class="stat-icon">${icon(ic)}</div><strong data-count="${value}">0</strong><span>${text}</span></div>`;
    $('stat-grid').innerHTML = [
      stat('', 'cap', s.programmes.active, `Active programmes · ${s.programmes.seats} places`),
      stat('red', 'inbox', s.applications.total, `Applications · ${s.applications.byStatus.new || 0} new`),
      stat('gold', 'users', s.users.total, 'Registered candidates'),
      stat('light', 'euro', s.users.paid, 'Candidates who have paid'),
    ].join('');
    observeCounters($('stat-grid'));

    // Two series (applications, sign-ups) as paired bars with a tooltip per day.
    const max = Math.max(1, ...s.days.map((d) => Math.max(d.applications, d.users)));
    const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    $('day-chart').innerHTML = s.days.map((d, i) => `
      <div class="bar-col" tabindex="0" aria-label="${dayLabel(d.date)}: ${d.applications} applications, ${d.users} sign-ups">
        <span class="bar-tip">${dayLabel(d.date)} · <strong>${d.applications}</strong> apps · <strong>${d.users}</strong> sign-ups</span>
        <div class="bar-pair">
          <div class="bar${d.applications ? '' : ' zero'}" style="height:${(d.applications / max) * 100}%;animation-delay:${i * 0.04}s"></div>
          <div class="bar users${d.users ? '' : ' zero'}" style="height:${(d.users / max) * 100}%;animation-delay:${i * 0.04 + 0.02}s"></div>
        </div>
      </div>`).join('') +
      `<div style="position:absolute;inset:0 auto auto 0;font-size:12px;color:var(--muted)">max ${max}</div>`;
    let labels = $('day-chart').nextElementSibling;
    if (!labels || !labels.classList.contains('bar-labels')) {
      labels = document.createElement('div');
      labels.className = 'bar-labels';
      $('day-chart').after(labels);
    }
    labels.innerHTML = s.days.map((d) => `<span>${dayLabel(d.date)}</span>`).join('');

    sbars($('stage-bars'), options.stages.map(([k, l]) => [l, s.users.byStage[k] || 0]), s.users.total);
    sbars($('status-bars'), options.applicationStatuses.map((k) => [STATUS_LABELS[k], s.applications.byStatus[k] || 0]), s.applications.total);

    $('top-programmes').innerHTML = s.topProgrammes.length
      ? s.topProgrammes.map((p) => `
        <div class="list-row">
          ${fieldBadge(p.field)}
          <div class="grow"><strong>${esc(p.title)}</strong><small>${esc(p.employer)}</small></div>
          <a class="count-pill" href="#applications?programmeId=${encodeURIComponent(p.id)}">${p.count}</a>
        </div>`).join('')
      : '<div class="empty-small">No programmes yet.</div>';

    $('recent-apps').innerHTML = s.recent.length
      ? s.recent.map((a) => `
        <div class="list-row" style="cursor:pointer" data-open-app="${esc(a.id)}">
          <div class="company-logo v2">${esc(initials(fullName(a.candidate)))}</div>
          <div class="grow"><strong>${esc(fullName(a.candidate))}</strong><small>${esc(a.programmeTitle)} · ${esc(timeAgo(a.createdAt))}</small></div>
          <span class="pill-select st-${esc(a.status)}" style="background-image:none;padding-right:12px">${STATUS_LABELS[a.status] || esc(a.status)}</span>
        </div>`).join('')
      : '<div class="empty-small">No applications yet. They appear here as soon as candidates apply.</div>';

    $('recent-users').innerHTML = s.recentUsers.length
      ? s.recentUsers.map((u) => `
        <div class="list-row" style="cursor:pointer" data-open-user="${esc(u.id)}">
          <div class="company-logo">${esc(initials(fullName(u)))}</div>
          <div class="grow"><strong>${esc(fullName(u))}</strong><small>${esc(u.email)} · ${esc(timeAgo(u.createdAt))}</small></div>
          <span class="pill-select st-${esc(u.stage)}" style="background-image:none;padding-right:12px">${esc(label(options.stages, u.stage))}</span>
        </div>`).join('')
      : '<div class="empty-small">No candidates have registered yet.</div>';

    // Keep sidebar counters fresh
    [programmes, applications, users, lessons] = await Promise.all([
      call('/api/admin/programmes').then((r) => r.programmes),
      call('/api/admin/applications').then((r) => r.applications),
      call('/api/admin/users').then((r) => r.users),
      call('/api/admin/lessons').then((r) => r.lessons),
    ]);
    refreshCounts();
    $('nav-lessons').textContent = lessons.length || '';
  }

  document.addEventListener('click', (e) => {
    const app = e.target.closest('[data-open-app]');
    if (app) return openApplication(app.dataset.openApp);
    const user = e.target.closest('[data-open-user]');
    if (user) openUser(user.dataset.openUser);
  });

  // ---------------------------------------------------------------- programmes

  async function loadProgrammes() {
    $('prog-body').innerHTML = '<tr><td colspan="7" class="empty-small">Loading…</td></tr>';
    programmes = (await call('/api/admin/programmes')).programmes;
    refreshCounts();
    renderProgrammes();
  }

  function statusSelect(kind, id, value, list, labels) {
    return `<select class="pill-select st-${esc(value)}" data-${kind}="${esc(id)}" aria-label="Status">${list
      .map((s) => {
        const [v, l] = Array.isArray(s) ? s : [s, (labels || STATUS_LABELS)[s] || s];
        return `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`;
      }).join('')}</select>`;
  }

  function renderProgrammes() {
    const q = progFilter.q.toLowerCase();
    const list = programmes.filter((p) =>
      (!progFilter.status || p.status === progFilter.status) &&
      (!q || `${p.title} ${p.employer} ${p.location} ${p.field}`.toLowerCase().includes(q))
    );
    if (!list.length) {
      $('prog-body').innerHTML = `<tr><td colspan="7"><div class="empty-small">${programmes.length ? 'No programmes match your filters.' : 'No programmes yet. Click “New programme” to publish your first one.'}</div></td></tr>`;
      return;
    }
    $('prog-body').innerHTML = list.map((p, i) => `
      <tr style="animation-delay:${Math.min(i, 12) * 0.03}s">
        <td><div class="cell-main">${fieldBadge(p.field)}<div><strong>${esc(p.title)}</strong><small>${esc(p.employer)} · ${esc(allowanceRange(p))}</small></div></div></td>
        <td><div class="mini-tags"><span class="tag">${esc(p.location)}</span><span class="tag">${esc(p.intake)}</span><span class="tag">German ${esc(p.germanLevel)}</span></div></td>
        <td>${statusSelect('prog-status', p.id, p.status, options.programmeStatuses)}</td>
        <td><a class="apps-link" href="#applications?programmeId=${encodeURIComponent(p.id)}">${p.applicationsCount}</a>${p.seats ? `<small class="muted"> / ${p.seats}</small>` : ''}</td>
        <td><button class="star-btn${p.featured ? ' on' : ''}" data-feature="${esc(p.id)}" aria-label="Toggle featured" aria-pressed="${p.featured}">${icon('star')}</button></td>
        <td style="white-space:nowrap">${fmtDate(p.createdAt)}</td>
        <td><div class="actions">
          <a class="icon-btn" href="/programme?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" title="View on website" aria-label="View on website">${icon('eye')}</a>
          <button class="icon-btn" data-edit="${esc(p.id)}" title="Edit" aria-label="Edit">${icon('edit')}</button>
          <button class="icon-btn" data-duplicate="${esc(p.id)}" title="Duplicate" aria-label="Duplicate">${icon('copy')}</button>
          <button class="icon-btn danger" data-delete-prog="${esc(p.id)}" title="Delete" aria-label="Delete">${icon('trash')}</button>
        </div></td>
      </tr>`).join('');
  }

  $('prog-search').addEventListener('input', (e) => { progFilter.q = e.target.value; renderProgrammes(); });
  $('prog-status-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    progFilter.status = b.dataset.value;
    $('prog-status-filter').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    renderProgrammes();
  });

  $('prog-body').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-prog-status]');
    if (!sel) return;
    const id = sel.dataset.progStatus;
    try {
      const { programme } = await call(`/api/admin/programmes/${id}`, { method: 'PATCH', body: { status: sel.value } });
      Object.assign(programmes.find((p) => p.id === id), programme);
      sel.className = `pill-select st-${programme.status}`;
      refreshCounts();
      toast(`Programme marked as ${STATUS_LABELS[programme.status].toLowerCase()}`);
    } catch (err) { toast(err.message, 'error'); }
  });

  $('prog-body').addEventListener('click', async (e) => {
    const t = (attr) => e.target.closest(`[data-${attr}]`);
    let el;
    if ((el = t('feature'))) {
      const p = programmes.find((x) => x.id === el.dataset.feature);
      try {
        const res = await call(`/api/admin/programmes/${p.id}`, { method: 'PATCH', body: { featured: !p.featured } });
        p.featured = res.programme.featured;
        el.classList.toggle('on', p.featured);
        el.setAttribute('aria-pressed', p.featured);
        el.animate([{ transform: 'scale(1.5) rotate(30deg)' }, { transform: 'none' }], { duration: 400, easing: 'ease-out' });
        toast(p.featured ? 'Programme is now featured on the homepage' : 'Programme removed from featured');
      } catch (err) { toast(err.message, 'error'); }
    } else if ((el = t('edit'))) {
      openProgrammeEditor(programmes.find((p) => p.id === el.dataset.edit));
    } else if ((el = t('duplicate'))) {
      try {
        await call(`/api/admin/programmes/${el.dataset.duplicate}/duplicate`, { method: 'POST' });
        toast('Programme duplicated as draft');
        loadProgrammes();
      } catch (err) { toast(err.message, 'error'); }
    } else if ((el = t('delete-prog'))) {
      const p = programmes.find((x) => x.id === el.dataset.deleteProg);
      if (!(await confirmDialog(`“${p.title}” will be removed from the website. Existing applications are kept.`))) return;
      try {
        await call(`/api/admin/programmes/${p.id}`, { method: 'DELETE' });
        toast('Programme deleted');
        loadProgrammes();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  // ---------------------------------------------------------------- programme editor

  function fillSelects() {
    const fill = (id, list, labels) => {
      $(id).innerHTML = list.map((v) => `<option value="${esc(v)}">${esc(labels ? labels[v] : v)}</option>`).join('');
    };
    fill('p-field', options.fields);
    fill('p-type', options.types);
    fill('p-intake', options.intakes);
    fill('p-german', options.germanLevels);
    fill('p-status', options.programmeStatuses, STATUS_LABELS);
    $('apps-status').innerHTML = '<option value="">All statuses</option>' +
      options.applicationStatuses.map((s) => `<option value="${s}">${STATUS_LABELS[s]}</option>`).join('');
    $('users-stage').innerHTML = '<option value="">All stages</option>' +
      options.stages.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
    $('users-payment').innerHTML = '<option value="">All payments</option>' +
      options.payments.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
  }

  let editingId = null;
  function openProgrammeEditor(p) {
    editingId = p ? p.id : null;
    const form = $('prog-form');
    form.reset();
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    $('prog-error').classList.remove('show');
    $('prog-modal-title').textContent = p ? 'Edit programme' : 'New programme';
    $('prog-save').textContent = p ? 'Save changes' : 'Publish programme';
    const defaults = { status: 'active', type: 'Ausbildung', field: 'Nursing', intake: options.intakes[0], germanLevel: 'B1', durationYears: 3, education: 'O/L or above' };
    const data = p || defaults;
    Array.from(form.elements).forEach((el) => {
      if (!el.name || !(el.name in data)) return;
      if (el.type === 'checkbox') el.checked = Boolean(data[el.name]);
      else el.value = data[el.name] == null ? '' : data[el.name];
    });
    if (!p) $('p-desc').value = 'About the programme:\n\n\nWhat you learn:\n- \n\nRequirements:\n- German B1 certificate\n- Updated Europass CV';
    openModal('prog-modal');
    setTimeout(() => $('p-title').focus(), 100);
  }

  $('new-programme-btn').addEventListener('click', () => openProgrammeEditor(null));

  $('prog-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = readForm(form);
    const missing = ['title', 'employer', 'location', 'description'].filter((k) => !String(body[k]).trim());
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    if (missing.length) {
      missing.forEach((k) => form.elements[k].closest('.field').classList.add('invalid'));
      form.elements[missing[0]].focus();
      return showFormError($('prog-error'), 'Please fill in all required fields.');
    }
    const btn = $('prog-save');
    btn.disabled = true;
    try {
      if (editingId) await call(`/api/admin/programmes/${editingId}`, { method: 'PUT', body });
      else await call('/api/admin/programmes', { method: 'POST', body });
      closeModal('prog-modal');
      toast(editingId ? 'Programme updated' : 'Programme published');
      if (location.hash.startsWith('#programmes')) loadProgrammes();
      else location.hash = '#programmes';
    } catch (err) {
      showFormError($('prog-error'), err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------------------------------------------------------------- applications

  function updateExportLinks() {
    const p = new URLSearchParams();
    if (appFilter.programmeId) p.set('programmeId', appFilter.programmeId);
    if (appFilter.status) p.set('status', appFilter.status);
    const qs = p.toString() ? `?${p}` : '';
    $('export-csv').href = `/api/admin/applications/export.csv${qs}`;
    $('export-zip').href = `/api/admin/applications/export.zip${qs}`;
  }

  async function loadApplications() {
    $('apps-body').innerHTML = '<tr><td colspan="6" class="empty-small">Loading…</td></tr>';
    const [progRes, appsRes] = await Promise.all([call('/api/admin/programmes'), call('/api/admin/applications')]);
    programmes = progRes.programmes;
    applications = appsRes.applications;
    refreshCounts();

    // The filter also lists deleted programmes that still have applications.
    const opts = new Map(programmes.map((p) => [p.id, `${p.title} – ${p.location}`]));
    applications.forEach((a) => { if (!opts.has(a.programmeId)) opts.set(a.programmeId, `${a.programmeTitle} (deleted)`); });
    $('apps-programme').innerHTML = '<option value="">All programmes</option>' +
      [...opts].map(([id, l]) => `<option value="${esc(id)}">${esc(l)}</option>`).join('');
    $('apps-programme').value = appFilter.programmeId;
    $('apps-status').value = appFilter.status;
    $('apps-search').value = appFilter.q;
    renderApplications();
  }

  function renderApplications() {
    updateExportLinks();
    const q = appFilter.q.toLowerCase();
    const list = applications.filter((a) =>
      (!appFilter.programmeId || a.programmeId === appFilter.programmeId) &&
      (!appFilter.status || a.status === appFilter.status) &&
      (!q || `${fullName(a.candidate)} ${a.candidate.email} ${a.programmeTitle} ${a.employer} ${a.location} ${a.candidate.nationality}`.toLowerCase().includes(q))
    );
    if (!list.length) {
      $('apps-body').innerHTML = `<tr><td colspan="6"><div class="empty-small">${applications.length ? 'No applications match your filters.' : 'No applications yet.'}</div></td></tr>`;
      return;
    }
    $('apps-body').innerHTML = list.map((a, i) => `
      <tr style="animation-delay:${Math.min(i, 12) * 0.03}s">
        <td><div class="cell-main" style="cursor:pointer;min-width:220px" data-open-app="${esc(a.id)}">
          <div class="company-logo v2">${esc(initials(fullName(a.candidate)))}</div>
          <div><strong>${esc(fullName(a.candidate))}</strong><small>${esc(a.candidate.email)}</small></div>
        </div></td>
        <td><strong style="font-weight:600">${esc(a.programmeTitle)}</strong><br><small class="muted">${esc(a.location)} · ${esc(a.intake || '')}</small></td>
        <td><div class="mini-tags">
          ${a.candidate.germanLevel ? `<span class="tag">German ${esc(a.candidate.germanLevel)}</span>` : ''}
          ${a.candidate.highestEducation ? `<span class="tag">${esc(a.candidate.highestEducation)}</span>` : ''}
          <span class="tag tag-gold">${a.candidate.documentsCount} docs</span>
        </div></td>
        <td style="white-space:nowrap" title="${esc(new Date(a.createdAt).toLocaleString())}">${fmtDate(a.createdAt)}</td>
        <td>${statusSelect('app-status', a.id, a.status, options.applicationStatuses)}</td>
        <td><div class="actions">
          <button class="icon-btn" data-open-app="${esc(a.id)}" title="View" aria-label="View application">${icon('eye')}</button>
          <a class="icon-btn" href="/api/admin/users/${encodeURIComponent(a.userId)}/documents.zip" title="Download documents (ZIP)" aria-label="Download documents">${icon('download')}</a>
          <button class="icon-btn danger" data-delete-app="${esc(a.id)}" title="Delete" aria-label="Delete application">${icon('trash')}</button>
        </div></td>
      </tr>`).join('');
  }

  let searchTimer;
  $('apps-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { appFilter.q = e.target.value; renderApplications(); }, 200);
  });
  $('apps-programme').addEventListener('change', (e) => { appFilter.programmeId = e.target.value; syncAppHash(); renderApplications(); });
  $('apps-status').addEventListener('change', (e) => { appFilter.status = e.target.value; syncAppHash(); renderApplications(); });

  function syncAppHash() {
    const p = new URLSearchParams();
    if (appFilter.programmeId) p.set('programmeId', appFilter.programmeId);
    if (appFilter.status) p.set('status', appFilter.status);
    history.replaceState(null, '', `#applications${p.toString() ? `?${p}` : ''}`);
  }

  async function setAppStatus(id, status, sel) {
    try {
      const { application } = await call(`/api/admin/applications/${id}`, { method: 'PATCH', body: { status } });
      const local = applications.find((a) => a.id === id);
      if (local) Object.assign(local, { status: application.status });
      if (sel) sel.className = `pill-select st-${status}`;
      refreshCounts();
      toast(`Status changed to ${STATUS_LABELS[status]}`);
      return application;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  }

  $('apps-body').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-app-status]');
    if (sel) setAppStatus(sel.dataset.appStatus, sel.value, sel);
  });

  async function deleteApplication(id) {
    const a = applications.find((x) => x.id === id);
    const name = a ? fullName(a.candidate) : 'this candidate';
    if (!(await confirmDialog(`The application from ${name} will be permanently deleted. Their profile and documents are kept.`))) return false;
    try {
      await call(`/api/admin/applications/${id}`, { method: 'DELETE' });
      applications = applications.filter((x) => x.id !== id);
      refreshCounts();
      renderApplications();
      toast('Application deleted');
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    }
  }

  $('apps-body').addEventListener('click', (e) => {
    const del = e.target.closest('[data-delete-app]');
    if (del) deleteApplication(del.dataset.deleteApp);
  });

  const kv = (k, v) => `<div><small>${esc(k)}</small><span>${v || '—'}</span></div>`;

  function docRows(user) {
    const docs = user.documents || [];
    if (!docs.length) return '<div class="empty-small" style="padding:16px">No documents uploaded yet.</div>';
    return docs.map((d) => {
      const url = `/api/admin/users/${encodeURIComponent(user.id)}/documents/${encodeURIComponent(d.id)}`;
      return `
        <div class="doc-row">
          <div class="fi">${esc(d.ext.replace('.', '').toUpperCase())}</div>
          <div class="grow"><strong title="${esc(d.name)}">${esc(options.documentTypes[d.type] || d.type)}</strong><small>${esc(d.name)} · ${Math.max(1, Math.round(d.size / 1024))} KB · ${esc(timeAgo(d.uploadedAt))}</small></div>
          ${['.pdf', '.jpg', '.jpeg', '.png'].includes(d.ext) ? `<a class="icon-btn" href="${url}?inline=1" target="_blank" rel="noopener" title="Open" aria-label="Open">${icon('eye')}</a>` : ''}
          <a class="icon-btn" href="${url}" title="Download" aria-label="Download">${icon('download')}</a>
          <button class="icon-btn danger" type="button" data-delete-doc="${esc(d.id)}" title="Delete" aria-label="Delete document">${icon('trash')}</button>
        </div>`;
    }).join('');
  }

  async function openApplication(id) {
    let res;
    try {
      res = await call(`/api/admin/applications/${id}`);
    } catch (err) {
      return toast(err.message, 'error');
    }
    const a = res.application;
    const u = res.user || { documents: [] };
    $('app-drawer-body').innerHTML = `
      <div class="cand-head">
        <div class="cand-avatar">${esc(initials(fullName(u)))}</div>
        <div><h3>${esc(fullName(u))}</h3><p>Applied for <strong>${esc(a.programmeTitle)}</strong> · ${esc(timeAgo(a.createdAt))}</p></div>
      </div>
      <label class="field"><span style="font-weight:600;font-size:14px;display:block;margin-bottom:6px">Status</span>${statusSelect('drawer-status', a.id, a.status, options.applicationStatuses).replace('<select', '<select style="font-size:14px;padding:9px 32px 9px 14px"')}</label>
      <div class="kv">
        ${kv('Programme', esc(a.programmeTitle))}
        ${kv('Training provider', esc(a.employer))}
        ${kv('Location / intake', `${esc(a.location)} · ${esc(a.intake || '')}`)}
        ${kv('Email', u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : '')}
        ${kv('Phone', u.phone ? `<a href="tel:${esc(u.phone)}">${esc(u.phone)}</a>` : '')}
        ${kv('German level', esc(u.germanLevel))}
        ${kv('Education', esc([u.highestEducation, u.alStream].filter(Boolean).join(' · ')))}
        ${kv('Nationality', esc(u.nationality))}
      </div>
      ${a.motivation ? `<div class="drawer-section"><h4>Motivation</h4><div class="cover">${esc(a.motivation)}</div></div>` : ''}
      <div class="drawer-section">
        <h4>Documents</h4>
        <div id="app-docs">${docRows(u)}</div>
        ${(u.documents || []).length ? `<a class="btn btn-dark btn-sm" href="/api/admin/users/${encodeURIComponent(u.id)}/documents.zip">${icon('zip')} Download all documents</a>` : ''}
      </div>
      <div class="drawer-section">
        <h4>Internal notes</h4>
        <textarea class="input" id="app-notes" rows="4" placeholder="Only visible to admins…">${esc(a.notes || '')}</textarea>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-dark btn-sm" id="save-app-notes" type="button">Save notes</button>
          ${u.id ? `<button class="btn btn-outline btn-sm" type="button" data-open-user="${esc(u.id)}">${icon('user')} Full profile</button>` : ''}
          ${u.email ? `<a class="btn btn-outline btn-sm" href="mailto:${esc(u.email)}?subject=${encodeURIComponent(`Your application: ${a.programmeTitle}`)}">${icon('mail')} Email</a>` : ''}
          <button class="btn btn-sm" style="margin-left:auto;color:var(--red)" id="app-drawer-delete" type="button">${icon('trash')} Delete</button>
        </div>
      </div>`;

    const body = $('app-drawer-body');
    body.querySelector('[data-drawer-status]').addEventListener('change', async (e) => {
      if (await setAppStatus(a.id, e.target.value, e.target)) renderIfVisible();
    });
    body.querySelector('#app-docs').addEventListener('click', (e) => onDeleteDoc(e, u, () => {
      body.querySelector('#app-docs').innerHTML = docRows(u);
    }));
    $('save-app-notes').addEventListener('click', async () => {
      try {
        await call(`/api/admin/applications/${a.id}`, { method: 'PATCH', body: { notes: $('app-notes').value } });
        toast('Notes saved');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('app-drawer-delete').addEventListener('click', async () => {
      if (await deleteApplication(a.id)) {
        closeModal('app-drawer');
        if (isVisible('dashboard')) loadDashboard();
      }
    });
    openModal('app-drawer');

    // Opening a new application moves it to "reviewing" automatically.
    if (a.status === 'new') {
      const sel = body.querySelector('[data-drawer-status]');
      if (await setAppStatus(a.id, 'reviewing', sel)) {
        sel.value = 'reviewing';
        renderIfVisible();
      }
    }
  }

  function renderIfVisible() {
    if (isVisible('applications')) renderApplications();
    if (isVisible('dashboard')) loadDashboard();
    if (isVisible('candidates')) renderUsers();
  }

  async function onDeleteDoc(e, user, after) {
    const b = e.target.closest('[data-delete-doc]');
    if (!b) return;
    const doc = (user.documents || []).find((d) => d.id === b.dataset.deleteDoc);
    if (!(await confirmDialog(`“${doc.name}” will be permanently deleted from ${fullName(user)}’s profile.`))) return;
    try {
      const res = await call(`/api/admin/users/${encodeURIComponent(user.id)}/documents/${encodeURIComponent(doc.id)}`, { method: 'DELETE' });
      user.documents = res.user.documents;
      after();
      toast('Document deleted');
    } catch (err) { toast(err.message, 'error'); }
  }

  // ---------------------------------------------------------------- candidates

  async function loadUsers() {
    $('users-body').innerHTML = '<tr><td colspan="6" class="empty-small">Loading…</td></tr>';
    users = (await call('/api/admin/users')).users;
    refreshCounts();
    $('users-stage').value = userFilter.stage;
    $('users-payment').value = userFilter.payment;
    $('users-search').value = userFilter.q;
    renderUsers();
  }

  function renderUsers() {
    const q = userFilter.q.toLowerCase();
    const list = users.filter((u) =>
      (!userFilter.stage || u.stage === userFilter.stage) &&
      (!userFilter.payment || u.payment === userFilter.payment) &&
      (!q || `${fullName(u)} ${u.email} ${u.phone} ${u.nationality} ${u.city}`.toLowerCase().includes(q))
    );
    if (!list.length) {
      $('users-body').innerHTML = `<tr><td colspan="6"><div class="empty-small">${users.length ? 'No candidates match your filters.' : 'No candidates yet. They appear here when they create an account on the website.'}</div></td></tr>`;
      return;
    }
    $('users-body').innerHTML = list.map((u, i) => `
      <tr style="animation-delay:${Math.min(i, 12) * 0.03}s">
        <td><div class="cell-main" style="cursor:pointer;min-width:220px" data-open-user="${esc(u.id)}">
          <div class="company-logo${u.accountStatus === 'suspended' ? '' : ' v2'}">${esc(initials(fullName(u)))}</div>
          <div><strong>${esc(fullName(u))}${u.accountStatus === 'suspended' ? ' <span class="tag tag-red" style="font-size:11px;padding:2px 8px">Suspended</span>' : ''}</strong><small>${esc(u.email)}</small><small>${u.phone ? `${esc(u.phone)} · ` : ''}joined ${esc(fmtDate(u.createdAt))}</small></div>
        </div></td>
        <td><div class="mini-tags">
          ${u.germanLevel ? `<span class="tag">German ${esc(u.germanLevel)}</span>` : ''}
          ${u.preferredField ? `<span class="tag">${esc(u.preferredField)}</span>` : ''}
          <span class="tag tag-gold">${u.documentsCount} docs · ${u.applicationsCount} apps</span>
        </div></td>
        <td><div class="meter"><div class="meter-track"><i style="width:${u.completeness}%"></i></div>${u.completeness}%</div></td>
        <td>${statusSelect('user-stage', u.id, u.stage, options.stages)}</td>
        <td>${statusSelect('user-payment', u.id, u.payment, options.payments)}</td>
        <td><div class="actions">
          <button class="icon-btn" data-open-user="${esc(u.id)}" title="Open profile" aria-label="Open profile">${icon('eye')}</button>
          <a class="icon-btn" href="/api/admin/users/${encodeURIComponent(u.id)}/documents.zip" title="Download documents (ZIP)" aria-label="Download documents">${icon('download')}</a>
          <button class="icon-btn danger" data-delete-user="${esc(u.id)}" title="Delete candidate" aria-label="Delete candidate">${icon('trash')}</button>
        </div></td>
      </tr>`).join('');
  }

  let userSearchTimer;
  $('users-search').addEventListener('input', (e) => {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(() => { userFilter.q = e.target.value; renderUsers(); }, 200);
  });
  $('users-stage').addEventListener('change', (e) => { userFilter.stage = e.target.value; renderUsers(); });
  $('users-payment').addEventListener('change', (e) => { userFilter.payment = e.target.value; renderUsers(); });

  async function patchUser(id, patch, sel) {
    try {
      const { user } = await call(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
      const local = users.find((u) => u.id === id);
      if (local) Object.assign(local, patch);
      if (sel) sel.className = `pill-select st-${sel.value}`;
      return user;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  }

  $('users-body').addEventListener('change', async (e) => {
    const stage = e.target.closest('[data-user-stage]');
    const pay = e.target.closest('[data-user-payment]');
    if (stage && (await patchUser(stage.dataset.userStage, { stage: stage.value }, stage))) toast(`Stage set to ${label(options.stages, stage.value)}`);
    if (pay && (await patchUser(pay.dataset.userPayment, { payment: pay.value }, pay))) toast(`Payment set to ${label(options.payments, pay.value)}`);
  });

  async function deleteUser(id) {
    const u = users.find((x) => x.id === id) || { firstName: 'this', lastName: 'candidate' };
    if (!(await confirmDialog(`${fullName(u)}’s account, profile, documents and applications will be permanently deleted.`))) return false;
    try {
      await call(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      users = users.filter((x) => x.id !== id);
      refreshCounts();
      renderUsers();
      toast('Candidate deleted');
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    }
  }

  $('users-body').addEventListener('click', (e) => {
    const del = e.target.closest('[data-delete-user]');
    if (del) deleteUser(del.dataset.deleteUser);
  });

  async function openUser(id) {
    let res;
    try {
      res = await call(`/api/admin/users/${encodeURIComponent(id)}`);
    } catch (err) {
      return toast(err.message, 'error');
    }
    const u = res.user;
    const apps = res.applications;
    const c = res.completeness;
    const body = $('user-drawer-body');
    const fields = options.profileFields;

    const summary = () => {
      const sections = [...new Set(fields.map((f) => f.section))];
      return sections.map((s) => `
        <div class="drawer-section">
          <h4>${esc(s)}</h4>
          ${fields.filter((f) => f.section === s && f.type !== 'textarea').length ? `<div class="kv" style="margin-top:0">${fields.filter((f) => f.section === s && f.type !== 'textarea').map((f) => kv(f.label, esc(f.type === 'date' ? fmtDate(u[f.key]) : u[f.key]))).join('')}</div>` : ''}
          ${fields.filter((f) => f.section === s && f.type === 'textarea').map((f) => `<small class="muted" style="display:block;margin:8px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em">${esc(f.label)}</small><div class="text-block">${u[f.key] ? esc(u[f.key]) : '—'}</div>`).join('')}
        </div>`).join('');
    };

    body.innerHTML = `
      <div class="cand-head">
        <div class="cand-avatar">${esc(initials(fullName(u)))}</div>
        <div style="flex:1;min-width:0"><h3>${esc(fullName(u))}</h3><p>${esc(u.email)} · joined ${esc(timeAgo(u.createdAt))}${u.lastLoginAt ? ` · last sign-in ${esc(timeAgo(u.lastLoginAt))}` : ''}</p></div>
        <div class="meter" style="min-width:110px"><div class="meter-track"><i style="width:${c.percent}%"></i></div>${c.percent}%</div>
      </div>
      <div class="manage-grid">
        <label>Stage ${statusSelect('d-stage', u.id, u.stage, options.stages)}</label>
        <label>Payment ${statusSelect('d-payment', u.id, u.payment, options.payments)}</label>
        <label>Account ${statusSelect('d-account', u.id, u.accountStatus, options.accountStatuses)}</label>
      </div>
      <div class="drawer-tabs" role="tablist">
        <button type="button" class="active" data-pane="profile">Profile</button>
        <button type="button" data-pane="edit">Edit profile</button>
        <button type="button" data-pane="documents">Documents (${(u.documents || []).length})</button>
        <button type="button" data-pane="apps">Applications (${apps.length})</button>
      </div>
      <div class="drawer-pane" data-pane-body="profile">
        ${c.missingFields.length || c.missingDocs.length ? `<div class="doc-missing">${[...c.missingFields, ...c.missingDocs].map((m) => `<span class="tag tag-red">Missing: ${esc(m)}</span>`).join('')}</div>` : '<div class="doc-missing"><span class="tag tag-green">Profile complete</span></div>'}
        ${summary()}
      </div>
      <div class="drawer-pane" data-pane-body="edit" hidden>
        <form id="user-edit-form" novalidate>
          <div class="field" style="margin-bottom:20px"><label for="ue-email">Email (sign-in)</label><input class="input" id="ue-email" name="email" type="email" value="${esc(u.email)}"></div>
          ${profileFormHtml(fields, u, 'ue')}
          <div class="form-error" id="user-edit-error" role="alert"></div>
          <button class="btn btn-primary" type="submit">Save profile</button>
        </form>
      </div>
      <div class="drawer-pane" data-pane-body="documents" hidden>
        ${c.missingDocs.length ? `<div class="doc-missing">${c.missingDocs.map((m) => `<span class="tag tag-red">Missing: ${esc(m)}</span>`).join('')}</div>` : ''}
        <div id="user-docs">${docRows(u)}</div>
        <a class="btn btn-dark btn-sm" href="/api/admin/users/${encodeURIComponent(u.id)}/documents.zip">${icon('zip')} Download profile &amp; documents (ZIP)</a>
      </div>
      <div class="drawer-pane" data-pane-body="apps" hidden>
        ${apps.length ? apps.map((a) => `
          <div class="list-row" style="cursor:pointer" data-open-app="${esc(a.id)}">
            ${fieldBadge(a.field)}
            <div class="grow"><strong>${esc(a.programmeTitle)}</strong><small>${esc(a.location)} · ${esc(fmtDate(a.createdAt))}</small></div>
            <span class="pill-select st-${esc(a.status)}" style="background-image:none;padding-right:12px">${STATUS_LABELS[a.status] || esc(a.status)}</span>
          </div>`).join('') : '<div class="empty-small">No applications yet.</div>'}
      </div>
      <div class="drawer-section">
        <h4>Internal notes</h4>
        <textarea class="input" id="user-notes" rows="4" placeholder="Only visible to admins – e.g. payment receipts, call notes…">${esc(u.notes || '')}</textarea>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-dark btn-sm" id="save-user-notes" type="button">Save notes</button>
          <a class="btn btn-outline btn-sm" href="mailto:${esc(u.email)}">${icon('mail')} Email</a>
          <button class="btn btn-outline btn-sm" id="reset-pw" type="button">${icon('key')} Reset password</button>
          <button class="btn btn-sm" style="margin-left:auto;color:var(--red)" id="user-drawer-delete" type="button">${icon('trash')} Delete</button>
        </div>
      </div>`;

    const tabs = body.querySelector('.drawer-tabs');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      body.querySelectorAll('[data-pane-body]').forEach((p) => (p.hidden = p.dataset.paneBody !== b.dataset.pane));
    });

    const afterPatch = () => { if (isVisible('candidates')) renderUsers(); if (isVisible('dashboard')) loadDashboard(); };
    body.querySelector('[data-d-stage]').addEventListener('change', async (e) => {
      if (await patchUser(u.id, { stage: e.target.value }, e.target)) { toast(`Stage set to ${label(options.stages, e.target.value)}`); afterPatch(); }
    });
    body.querySelector('[data-d-payment]').addEventListener('change', async (e) => {
      if (await patchUser(u.id, { payment: e.target.value }, e.target)) { toast(`Payment set to ${label(options.payments, e.target.value)}`); afterPatch(); }
    });
    body.querySelector('[data-d-account]').addEventListener('change', async (e) => {
      if (await patchUser(u.id, { accountStatus: e.target.value }, e.target)) {
        toast(e.target.value === 'suspended' ? 'Account suspended – the candidate is signed out' : 'Account re-activated');
        afterPatch();
      }
    });

    body.querySelector('#user-docs').addEventListener('click', (e) => onDeleteDoc(e, u, () => {
      body.querySelector('#user-docs').innerHTML = docRows(u);
      afterPatch();
    }));

    $('user-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await call(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: 'PUT', body: readForm(e.target) });
        toast('Profile updated');
        if (isVisible('candidates')) loadUsers();
        openUser(u.id);
      } catch (err) { showFormError($('user-edit-error'), err.message); }
    });

    $('save-user-notes').addEventListener('click', async () => {
      if (await patchUser(u.id, { notes: $('user-notes').value })) toast('Notes saved');
    });

    $('reset-pw').addEventListener('click', async () => {
      if (!(await confirmDialog(`Create a new temporary password for ${fullName(u)}? Their current password stops working and they are signed out.`, 'Reset password', 'key'))) return;
      try {
        const { password } = await call(`/api/admin/users/${encodeURIComponent(u.id)}/reset-password`, { method: 'POST' });
        $('pw-modal-text').textContent = `Give this password to ${fullName(u)} (${u.email}).`;
        $('temp-pw').textContent = password;
        openModal('pw-modal');
      } catch (err) { toast(err.message, 'error'); }
    });

    $('user-drawer-delete').addEventListener('click', async () => {
      if (await deleteUser(u.id)) {
        closeModal('user-drawer');
        if (isVisible('dashboard')) loadDashboard();
      }
    });

    openModal('user-drawer');
  }

  $('copy-pw').addEventListener('click', () => {
    navigator.clipboard.writeText($('temp-pw').textContent).then(() => toast('Password copied'), () => toast('Could not copy', 'error'));
  });

  // ---------------------------------------------------------------- German classes

  let lessons = [];
  let lessonLevels = ['A1', 'A2', 'B1', 'B2'];
  const lessonFilter = { q: '', level: '' };
  const fmtDuration = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '–');
  const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

  async function loadLessons() {
    $('lessons-list').innerHTML = '<div class="panel"><div class="empty-small">Loading…</div></div>';
    const res = await call('/api/admin/lessons');
    lessons = res.lessons;
    lessonLevels = res.levels;
    $('nav-lessons').textContent = lessons.length || '';
    $('lessons-level-filter').innerHTML = ['', ...lessonLevels].map((lv) =>
      `<button type="button" class="${lessonFilter.level === lv ? 'active' : ''}" data-value="${lv}">${lv || 'All'}</button>`).join('');
    renderLessons();
  }

  function renderLessons() {
    const q = lessonFilter.q.toLowerCase();
    const groups = lessonLevels.filter((lv) => !lessonFilter.level || lv === lessonFilter.level).map((lv) => ({
      lv,
      list: lessons.filter((l) => l.level === lv && (!q || `${l.title} ${l.topic} ${l.description}`.toLowerCase().includes(q))),
    })).filter((g) => g.list.length);

    if (!groups.length) {
      $('lessons-list').innerHTML = `
        <div class="panel"><div class="empty-small" style="padding:50px 10px">
          <div class="confirm-icon" style="background:var(--soft-gold);color:#7a5b00">${icon('video')}</div>
          <h3 style="color:var(--ink);margin-bottom:6px">${lessons.length ? 'No lessons match your filters' : 'No video lessons yet'}</h3>
          <p>${lessons.length ? 'Try another level or search word.' : 'Upload your first German lesson — short 1–5 minute videos work best.'}</p>
          ${lessons.length ? '' : `<button class="btn btn-primary" type="button" data-new-lesson>${icon('upload')} Add video lesson</button>`}
        </div></div>`;
      return;
    }

    $('lessons-list').innerHTML = groups.map(({ lv, list }) => `
      <div class="panel table-panel lesson-group">
        <div class="lesson-group-head"><span class="level-chip lv-${lv.toLowerCase()}">${lv}</span><h3>${list.length} lesson${list.length === 1 ? '' : 's'}</h3>
          <span class="muted" style="font-size:14px">${fmtDuration(list.reduce((s, l) => s + (l.durationSec || 0), 0))} total</span>
          <button class="link-btn" style="margin-left:auto" type="button" data-new-lesson="${lv}">${icon('plus')} Add to ${lv}</button></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th style="width:56px">#</th><th>Lesson</th><th>Who can watch</th><th>Status</th><th>Watched by</th><th class="right">Actions</th></tr></thead>
            <tbody>${list.map((l, i) => `
              <tr style="animation-delay:${Math.min(i, 12) * 0.03}s">
                <td><div class="order-btns">
                  <button class="icon-btn" type="button" data-move="${esc(l.id)}" data-dir="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${icon('arrowUp')}</button>
                  <span>${i + 1}</span>
                  <button class="icon-btn" type="button" data-move="${esc(l.id)}" data-dir="1" aria-label="Move down" ${i === list.length - 1 ? 'disabled' : ''}>${icon('arrowDown')}</button>
                </div></td>
                <td><div class="cell-main lesson-cell" style="cursor:pointer" data-preview-lesson="${esc(l.id)}">
                  <span class="mini-thumb">${l.poster ? `<img src="${esc(l.poster)}" alt="">` : `<b>${esc(l.level)}</b>`}<i>${fmtDuration(l.durationSec)}</i></span>
                  <div><strong>${esc(l.title)}</strong><small>${l.topic ? `${esc(l.topic)} · ` : ''}${l.source === 'youtube' ? 'YouTube' : `Upload · ${fmtSize(l.videoSize)}`}</small></div>
                </div></td>
                <td>${statusSelect('lesson-access', l.id, l.access, [['members', 'Signed-in'], ['free', 'Everyone']])}</td>
                <td>${statusSelect('lesson-status', l.id, l.status, [['published', 'Published'], ['draft', 'Draft']])}</td>
                <td><span class="count-pill" style="background:#e8f6ed;color:var(--green)">${l.watchedBy}</span></td>
                <td><div class="actions">
                  <button class="icon-btn" type="button" data-preview-lesson="${esc(l.id)}" title="Play" aria-label="Play">${icon('play')}</button>
                  <a class="icon-btn" href="/german-classes?lesson=${encodeURIComponent(l.id)}" target="_blank" rel="noopener" title="View on website" aria-label="View on website">${icon('eye')}</a>
                  <button class="icon-btn" type="button" data-edit-lesson="${esc(l.id)}" title="Edit" aria-label="Edit">${icon('edit')}</button>
                  <button class="icon-btn danger" type="button" data-delete-lesson="${esc(l.id)}" title="Delete" aria-label="Delete">${icon('trash')}</button>
                </div></td>
              </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`).join('');
  }

  $('lessons-search').addEventListener('input', (e) => { lessonFilter.q = e.target.value; renderLessons(); });
  $('lessons-level-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    lessonFilter.level = b.dataset.value;
    $('lessons-level-filter').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    renderLessons();
  });

  $('lessons-list').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-lesson-access], [data-lesson-status]');
    if (!sel) return;
    const id = sel.dataset.lessonAccess || sel.dataset.lessonStatus;
    const key = sel.dataset.lessonAccess ? 'access' : 'status';
    try {
      await call(`/api/admin/lessons/${encodeURIComponent(id)}`, { method: 'PATCH', body: { [key]: sel.value } });
      lessons.find((l) => l.id === id)[key] = sel.value;
      sel.className = `pill-select st-${sel.value}`;
      toast(key === 'access' ? (sel.value === 'free' ? 'Lesson is now free for everyone' : 'Lesson is now for signed-in candidates') : (sel.value === 'published' ? 'Lesson published' : 'Lesson hidden (draft)'));
    } catch (err) { toast(err.message, 'error'); }
  });

  $('lessons-list').addEventListener('click', async (e) => {
    const t = (attr) => e.target.closest(`[data-${attr}]`);
    let el;
    if ((el = t('new-lesson'))) return openLessonEditor(null, el.dataset.newLesson);
    if ((el = t('edit-lesson'))) return openLessonEditor(lessons.find((l) => l.id === el.dataset.editLesson));
    if ((el = t('preview-lesson'))) return previewLesson(lessons.find((l) => l.id === el.dataset.previewLesson));
    if ((el = t('move'))) return moveLesson(el.dataset.move, Number(el.dataset.dir));
    if ((el = t('delete-lesson'))) {
      const l = lessons.find((x) => x.id === el.dataset.deleteLesson);
      if (!(await confirmDialog(`“${l.title}” and its video will be permanently deleted.`))) return;
      try {
        await call(`/api/admin/lessons/${encodeURIComponent(l.id)}`, { method: 'DELETE' });
        toast('Lesson deleted');
        loadLessons();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  // Swaps a lesson with its neighbour; positions are renumbered 1..n within the level.
  async function moveLesson(id, dir) {
    const l = lessons.find((x) => x.id === id);
    const list = lessons.filter((x) => x.level === l.level);
    const i = list.indexOf(l);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const changes = list.map((x, k) => ({ x, order: k + 1 })).filter(({ x, order }) => x.order !== order);
    try {
      await Promise.all(changes.map(({ x, order }) => call(`/api/admin/lessons/${encodeURIComponent(x.id)}`, { method: 'PATCH', body: { order } })));
      loadLessons();
    } catch (err) { toast(err.message, 'error'); }
  }

  function previewLesson(l) {
    $('lp-title').textContent = `${l.level} · ${l.title}`;
    $('lp-stage').innerHTML = l.youtubeId
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(l.youtubeId)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="${esc(l.title)}"></iframe>`
      : `<video src="${esc(l.videoUrl)}" ${l.poster ? `poster="${esc(l.poster)}"` : ''} controls autoplay playsinline></video>`;
    openModal('lesson-preview');
  }
  $('lesson-preview').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) setTimeout(() => { $('lp-stage').innerHTML = ''; }, 260);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('lesson-preview').hidden) setTimeout(() => { $('lp-stage').innerHTML = ''; }, 260);
  });

  // ---- Lesson editor

  const editor = { lesson: null, video: null, poster: null, autoPoster: null, removePoster: false, objectUrl: '', orderTouched: false };

  function nextOrder(level) {
    return Math.max(0, ...lessons.filter((l) => l.level === level).map((l) => l.order || 0)) + 1;
  }

  function setSource(src) {
    $('l-source').value = src;
    $('source-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.source === src));
    $('upload-pane').hidden = src !== 'upload';
    $('youtube-pane').hidden = src !== 'youtube';
    $('poster-note').textContent = src === 'upload'
      ? 'A frame from the video is used automatically. You can also choose your own image.'
      : 'The YouTube thumbnail is used automatically. You can also choose your own image.';
    renderPosterPreview();
  }
  $('source-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-source]');
    if (b) setSource(b.dataset.source);
  });

  function clientYoutubeId(s) {
    s = String(s || '').trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : '';
  }

  $('l-youtube').addEventListener('input', () => {
    const id = clientYoutubeId($('l-youtube').value);
    $('yt-preview').hidden = !id;
    $('yt-preview').innerHTML = id ? `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt=""><span>${icon('check')} Video found</span>` : '';
    renderPosterPreview();
  });

  function renderPosterPreview() {
    const box = $('poster-preview');
    let src = '';
    if (editor.poster) src = URL.createObjectURL(editor.poster);
    else if (!editor.removePoster && editor.lesson && editor.lesson.hasPoster) src = editor.lesson.poster;
    else if ($('l-source').value === 'upload' && editor.autoPoster) src = URL.createObjectURL(editor.autoPoster);
    else if ($('l-source').value === 'youtube' && clientYoutubeId($('l-youtube').value)) src = `https://i.ytimg.com/vi/${clientYoutubeId($('l-youtube').value)}/hqdefault.jpg`;
    box.innerHTML = src ? `<img src="${esc(src)}" alt="">` : '<span>No cover</span>';
    $('poster-remove').hidden = !(editor.poster || (!editor.removePoster && editor.lesson && editor.lesson.hasPoster));
  }

  function showVideo(file, url, name, info) {
    $('video-drop').hidden = true;
    $('video-preview').hidden = false;
    $('preview-video').src = url;
    $('vp-name').textContent = name;
    $('vp-info').textContent = info;
  }

  function pickVideo(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['mp4', 'm4v', 'webm'].includes(ext)) return toast('Please choose an MP4 or WebM video.', 'error');
    if (file.size > 300 * 1024 * 1024) return toast('Videos must be smaller than 300 MB.', 'error');
    editor.video = file;
    editor.autoPoster = null;
    if (editor.objectUrl) URL.revokeObjectURL(editor.objectUrl);
    editor.objectUrl = URL.createObjectURL(file);
    showVideo(file, editor.objectUrl, file.name, fmtSize(file.size));
    if (!$('l-title').value.trim()) $('l-title').value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

    // Read the length and grab a frame for the cover image.
    const v = $('preview-video');
    v.muted = true;
    v.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(v.duration)) {
        $('l-duration').value = Math.round(v.duration);
        $('vp-info').textContent = `${fmtSize(file.size)} · ${fmtDuration(v.duration)}`;
        if (v.duration > 6 * 60) toast('Tip: lessons of 1–5 minutes are easier to watch.');
      }
      v.currentTime = Math.min(2, (v.duration || 2) / 3);
    }, { once: true });
    v.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = Math.round(640 * (v.videoHeight / v.videoWidth || 9 / 16));
        canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { if (blob) { editor.autoPoster = blob; renderPosterPreview(); } }, 'image/jpeg', 0.82);
      } catch (e) { /* codec without frame access: no automatic cover */ }
    }, { once: true });
  }

  $('l-video').addEventListener('change', (e) => e.target.files[0] && pickVideo(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => $('video-drop').addEventListener(ev, (e) => { e.preventDefault(); $('video-drop').classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => $('video-drop').addEventListener(ev, () => $('video-drop').classList.remove('drag')));
  $('video-drop').addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) pickVideo(e.dataTransfer.files[0]); });
  $('vp-change').addEventListener('click', () => $('l-video').click());

  $('l-poster').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast('The cover image must be smaller than 5 MB.', 'error');
    editor.poster = f;
    editor.removePoster = false;
    renderPosterPreview();
  });
  $('poster-remove').addEventListener('click', () => {
    editor.poster = null;
    $('l-poster').value = '';
    editor.removePoster = true;
    renderPosterPreview();
  });
  $('l-order').addEventListener('input', () => { editor.orderTouched = true; });
  $('l-level').addEventListener('change', () => {
    if (!editor.lesson && !editor.orderTouched) $('l-order').value = nextOrder($('l-level').value);
  });

  function openLessonEditor(l, level) {
    Object.assign(editor, { lesson: l || null, video: null, poster: null, autoPoster: null, removePoster: false, orderTouched: false });
    const form = $('lesson-form');
    form.reset();
    $('l-video').value = '';
    $('l-poster').value = '';
    $('lesson-error').classList.remove('show');
    $('lesson-progress').classList.remove('show');
    $('lesson-progress').firstElementChild.style.width = '0';
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    $('l-level').innerHTML = lessonLevels.map((lv) => `<option>${lv}</option>`).join('');
    $('lesson-modal-title').textContent = l ? 'Edit video lesson' : 'Add video lesson';
    $('lesson-save').textContent = l ? 'Save changes' : 'Publish lesson';
    $('video-drop').hidden = false;
    $('video-preview').hidden = true;
    $('preview-video').removeAttribute('src');
    $('yt-preview').hidden = true;

    if (l) {
      ['title', 'level', 'topic', 'order', 'access', 'status', 'description'].forEach((k) => { form.elements[k].value = l[k] == null ? '' : l[k]; });
      $('l-duration').value = l.durationSec || '';
      $('l-youtube').value = l.youtubeId ? `https://youtu.be/${l.youtubeId}` : '';
      $('l-youtube').dispatchEvent(new Event('input'));
      if (l.source === 'upload' && l.videoUrl) showVideo(null, l.videoUrl, l.videoName || 'Current video', `${fmtSize(l.videoSize)} · ${fmtDuration(l.durationSec)}`);
      setSource(l.source || 'upload');
    } else {
      $('l-level').value = level || lessonFilter.level || 'A1';
      $('l-order').value = nextOrder($('l-level').value);
      $('l-access').value = 'members';
      $('l-status').value = 'published';
      setSource('upload');
    }
    openModal('lesson-modal');
    setTimeout(() => (l ? $('l-title') : $('l-video').closest('label')).focus(), 100);
  }

  $('new-lesson-btn').addEventListener('click', () => openLessonEditor(null));

  $('lesson-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const source = $('l-source').value;
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    const problems = [];
    if (!$('l-title').value.trim()) { problems.push('Please enter a title.'); $('l-title').closest('.field').classList.add('invalid'); }
    if (source === 'upload' && !editor.video && !(editor.lesson && editor.lesson.videoUrl)) problems.push('Please choose a video file.');
    if (source === 'youtube' && !clientYoutubeId($('l-youtube').value)) { problems.push('Please paste a valid YouTube link.'); $('l-youtube').closest('.field').classList.add('invalid'); }
    if (problems.length) return showFormError($('lesson-error'), problems.join(' '));

    const fd = new FormData();
    ['title', 'level', 'topic', 'order', 'durationSec', 'access', 'status', 'description', 'source', 'youtubeUrl'].forEach((k) => fd.append(k, form.elements[k].value));
    if (source === 'upload' && editor.video) fd.append('video', editor.video, editor.video.name);
    // A newly chosen video brings a new automatic cover unless a custom image was picked.
    const poster = editor.poster || (source === 'upload' && editor.video && editor.autoPoster) || null;
    if (poster) fd.append('poster', poster, poster.name || 'cover.jpg');
    if (editor.removePoster && !poster) fd.append('removePoster', '1');

    const btn = $('lesson-save');
    const bar = $('lesson-progress');
    btn.disabled = true;
    bar.classList.add('show');
    const l = editor.lesson;
    try {
      await window.BVT.uploadFile(l ? `/api/admin/lessons/${encodeURIComponent(l.id)}` : '/api/admin/lessons', fd,
        (p) => {
          bar.firstElementChild.style.width = `${p * 100}%`;
          btn.textContent = p < 1 ? `Uploading… ${Math.round(p * 100)}%` : 'Saving…';
        }, l ? 'PUT' : 'POST');
      closeModal('lesson-modal');
      toast(l ? 'Lesson updated' : 'Lesson published');
      if (location.hash.startsWith('#lessons')) loadLessons();
      else location.hash = '#lessons';
    } catch (err) {
      if (err.status === 401) { showLogin(); return; }
      showFormError($('lesson-error'), err.message);
      bar.classList.remove('show');
    } finally {
      btn.disabled = false;
      btn.textContent = l ? 'Save changes' : 'Publish lesson';
    }
  });

  // Stop the editor's video when the modal closes.
  $('lesson-modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) $('preview-video').pause();
  });

  // ---------------------------------------------------------------- modals

  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    const m = $(id);
    m.classList.remove('closing');
    m.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const m = $(id);
    if (m.hidden) return;
    m.classList.add('closing');
    setTimeout(() => {
      m.hidden = true;
      m.classList.remove('closing');
      if (!document.querySelector('.modal:not([hidden]), .drawer:not([hidden])')) document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }, 260);
  }

  document.querySelectorAll('.modal, .drawer').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeModal(m.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal:not([hidden]), .drawer:not([hidden])')].pop();
    if (open) closeModal(open.id);
  });

  // Opening an application from inside the candidate drawer closes that drawer first.
  $('user-drawer').addEventListener('click', (e) => {
    if (e.target.closest('[data-open-app]')) closeModal('user-drawer');
  });
  $('app-drawer').addEventListener('click', (e) => {
    if (e.target.closest('[data-open-user]')) closeModal('app-drawer');
  });

  let confirmResolve = null;
  function confirmDialog(text, okText, iconName) {
    $('confirm-text').textContent = text;
    $('confirm-ok').textContent = okText || 'Delete';
    $('confirm').querySelector('.confirm-icon').innerHTML = icon(iconName || 'trash');
    $('confirm-title').textContent = 'Are you sure?';
    openModal('confirm');
    setTimeout(() => $('confirm-ok').focus(), 50);
    return new Promise((resolve) => { confirmResolve = resolve; });
  }
  $('confirm-ok').addEventListener('click', () => {
    closeModal('confirm');
    if (confirmResolve) confirmResolve(true);
    confirmResolve = null;
  });
  $('confirm').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') && confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmResolve) { confirmResolve(false); confirmResolve = null; }
  });

  // ---------------------------------------------------------------- mobile sidebar

  function closeSidebar() {
    $('sidebar').classList.remove('open');
    $('side-backdrop').classList.remove('show');
  }
  $('menu-btn').addEventListener('click', () => {
    $('sidebar').classList.add('open');
    $('side-backdrop').classList.add('show');
  });
  $('side-backdrop').addEventListener('click', closeSidebar);

  hydrateIcons();
  boot();
})();
