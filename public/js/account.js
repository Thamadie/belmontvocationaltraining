(function () {
  'use strict';
  const {
    api, esc, icon, initials, fmtDate, timeAgo, toast, reveal, hydrateIcons, uploadFile, fieldBadge,
    profileFormHtml, readForm, showFormError, allowanceRange,
  } = window.BVT;
  const $ = (id) => document.getElementById(id);

  const STATUS_TEXT = {
    new: 'Submitted', reviewing: 'Under review', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offer',
    visa: 'Visa stage', enrolled: 'Enrolled', rejected: 'Not successful', withdrawn: 'Withdrawn',
  };
  const DOC_HINTS = {
    cv: 'Your updated Europass CV. Required to apply.',
    passport: 'Photo page of your passport.',
    photo: 'Recent passport-size photo.',
    education: 'O/L, A/L and other certificates.',
    language: 'Goethe / telc / IELTS certificates.',
    other: 'Anything else that supports your application.',
  };
  const SINGLE = ['cv', 'passport', 'photo'];

  let me = null;
  let options = null;
  let applications = [];

  // ---------------------------------------------------------------- boot

  async function boot() {
    try {
      [me, options] = await Promise.all([api('/api/auth/me'), api('/api/account/options')]);
    } catch (e) {
      location.replace(`/login?next=${encodeURIComponent('/account' + location.hash)}`);
      return;
    }
    renderHeader();
    renderProfile();
    renderDocuments();
    loadApplications();
    route();
    if (new URLSearchParams(location.search).has('welcome')) {
      toast(`Welcome, ${me.user.firstName}! Start by completing your profile.`);
      history.replaceState(null, '', `/account${location.hash}`);
    }
  }

  function update(res) {
    me = { user: res.user, completeness: res.completeness };
    renderHeader();
    renderOverview();
  }

  function renderHeader() {
    const u = me.user;
    $('avatar').textContent = initials(`${u.firstName} ${u.lastName}`);
    $('hello').textContent = `Hello, ${u.firstName}`;
    $('email-tag').innerHTML = `${icon('mail')} ${esc(u.email)}`;
    const pct = me.completeness.percent;
    $('ring-label').textContent = `${pct}%`;
    requestAnimationFrame(() => { $('ring').style.strokeDashoffset = String(264 - (264 * pct) / 100); });
    const missingDocs = me.completeness.missingDocs.length;
    $('badge-docs').hidden = !missingDocs;
    $('badge-docs').textContent = missingDocs;
  }

  // ---------------------------------------------------------------- tabs

  function route() {
    const tab = (location.hash.slice(1) || 'overview');
    const name = document.querySelector(`[data-panel="${tab}"]`) ? tab : 'overview';
    document.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = p.dataset.panel !== name));
    document.querySelectorAll('#account-nav [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    if (name === 'overview') renderOverview();
  }
  window.addEventListener('hashchange', route);
  $('account-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (isDirty() && !confirm('You have unsaved profile changes. Leave without saving?')) return;
    location.hash = b.dataset.tab;
  });

  // ---------------------------------------------------------------- overview

  function renderOverview() {
    if (!me || !options) return;
    const stages = options.stages;
    const current = Math.max(0, stages.findIndex((s) => s[0] === me.user.stage));
    $('stage-track').innerHTML = stages.map(([key, label], i) => `
      <div class="stage ${i < current ? 'done' : i === current ? 'current' : ''}">
        <span class="dot">${i < current ? icon('check') : i + 1}</span>${esc(label)}
      </div>`).join('');

    const c = me.completeness;
    const docs = new Set((me.user.documents || []).map((d) => d.type));
    const todo = [
      ['Personal details & education', !c.missingFields.length, c.missingFields.length ? `Missing: ${c.missingFields.join(', ')}` : 'Complete', 'profile'],
      ['Europass CV uploaded', docs.has('cv'), docs.has('cv') ? 'Uploaded' : 'Required to apply', 'documents'],
      ['Passport uploaded', docs.has('passport'), docs.has('passport') ? 'Uploaded' : 'Needed for your visa', 'documents'],
      ['German level B1', ['B1', 'B2', 'C1', 'C2'].includes(me.user.germanLevel), me.user.germanLevel ? `Current level: ${me.user.germanLevel}` : 'Add your level in your profile', 'profile'],
      ['First application sent', applications.some((a) => a.status !== 'withdrawn'), `${applications.length} application${applications.length === 1 ? '' : 's'}`, 'applications'],
    ];
    $('todo').innerHTML = todo.map(([title, ok, sub, tab]) => `
      <a class="todo${ok ? ' ok' : ''}" href="#${tab}">
        <span class="ti">${icon(ok ? 'check' : 'arrow')}</span>
        <span class="grow"><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>
      </a>`).join('');
    loadRecommended();
  }

  let recLoaded = null;
  function loadRecommended() {
    const field = me.user.preferredField || '';
    if (recLoaded === field) return;
    recLoaded = field;
    $('rec-sub').textContent = field ? `Open programmes in ${field}` : 'Programmes open now';
    api(`/api/programmes?limit=3${field ? `&field=${encodeURIComponent(field)}` : '&featured=1'}`).then(({ programmes }) => {
      $('recommended').innerHTML = programmes.length ? programmes.map((p) => `
        <a href="/programme?id=${encodeURIComponent(p.id)}" class="fact">
          ${fieldBadge(p.field).replace('class="company-logo', 'style="width:40px;height:40px;border-radius:12px" class="company-logo')}
          <div style="min-width:0"><span style="display:block;line-height:1.3">${esc(p.title)}</span><small style="text-transform:none;letter-spacing:0">${esc(p.location)} · ${esc(allowanceRange(p))}</small></div>
        </a>`).join('') : '<p class="muted" style="color:var(--muted)">No open programmes in this field right now.</p>';
    }).catch(() => {});
  }

  // ---------------------------------------------------------------- profile

  let savedSnapshot = '';
  const snapshot = () => JSON.stringify(readForm($('profile-form')));
  const isDirty = () => savedSnapshot && snapshot() !== savedSnapshot;

  function renderProfile() {
    $('profile-fields').innerHTML = profileFormHtml(options.profileFields, me.user, 'pf');
    savedSnapshot = snapshot();
    setDirty(false);
  }

  function setDirty(dirty) {
    $('save-bar').classList.toggle('dirty', dirty);
    $('save-state').textContent = dirty ? 'You have unsaved changes' : 'All changes saved';
  }
  $('profile-form').addEventListener('input', () => setDirty(isDirty()));
  window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = readForm(e.target);
    e.target.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    if (!body.firstName.trim() || !body.lastName.trim()) {
      ['firstName', 'lastName'].filter((k) => !body[k].trim()).forEach((k) => e.target.elements[k].closest('.field').classList.add('invalid'));
      return showFormError($('profile-error'), 'Please enter your first and last name.');
    }
    const btn = $('save-btn');
    btn.disabled = true;
    try {
      update(await api('/api/account/profile', { method: 'PUT', body }));
      savedSnapshot = snapshot();
      setDirty(false);
      $('profile-error').classList.remove('show');
      toast(me.completeness.missingFields.length ? 'Profile saved' : 'Profile saved — your details are complete!');
    } catch (err) {
      showFormError($('profile-error'), err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------------------------------------------------------------- documents

  function renderDocuments() {
    const docs = me.user.documents || [];
    const types = options.documentTypes;
    $('doc-grid').innerHTML = Object.keys(types).map((type, i) => {
      const files = docs.filter((d) => d.type === type);
      const required = options.requiredDocs.includes(type);
      const tag = files.length
        ? '<span class="req-tag ok-tag">Uploaded</span>'
        : required ? '<span class="req-tag">Required</span>' : '';
      return `
        <div class="doc-slot${files.length ? ' has' : ''}" data-type="${type}" data-reveal style="--d:${i * 0.05}s">
          <h4>${esc(types[type])} ${tag}</h4>
          <p>${esc(DOC_HINTS[type] || '')}</p>
          ${files.map((d) => `
            <div class="doc-file">
              <div class="fi">${esc(d.ext.replace('.', '').toUpperCase())}</div>
              <div class="fn"><strong title="${esc(d.name)}">${esc(d.name)}</strong><small>${Math.max(1, Math.round(d.size / 1024))} KB · ${esc(timeAgo(d.uploadedAt))}</small></div>
              <a class="icon-btn" href="/api/account/documents/${encodeURIComponent(d.id)}?inline=1" target="_blank" rel="noopener" title="Open" aria-label="Open ${esc(d.name)}">${icon('eye')}</a>
              <button class="icon-btn" type="button" data-delete-doc="${esc(d.id)}" title="Delete" aria-label="Delete ${esc(d.name)}">${icon('trash')}</button>
            </div>`).join('')}
          <div class="doc-progress"><i></i></div>
          <label class="doc-upload">
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" aria-label="Upload ${esc(types[type])}">
            <span class="btn ${files.length ? 'btn-outline' : 'btn-dark'} btn-sm">${icon('upload')} ${files.length ? (SINGLE.includes(type) ? 'Replace' : 'Add another') : 'Upload'}</span>
          </label>
        </div>`;
    }).join('');
    reveal($('doc-grid'));
  }

  async function uploadDoc(slot, file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(ext)) return toast('Please upload a PDF, Word document, JPG or PNG.', 'error');
    if (file.size > 8 * 1024 * 1024) return toast('Files must be smaller than 8 MB.', 'error');
    const data = new FormData();
    data.append('type', slot.dataset.type);
    data.append('file', file, file.name);
    const bar = slot.querySelector('.doc-progress');
    bar.classList.add('show');
    try {
      const res = await uploadFile('/api/account/documents', data, (p) => { bar.firstElementChild.style.width = `${p * 100}%`; });
      update(res);
      renderDocuments();
      toast(`${options.documentTypes[slot.dataset.type]} uploaded`);
    } catch (err) {
      bar.classList.remove('show');
      if (err.status === 401) location.replace('/login?next=/account%23documents');
      toast(err.message, 'error');
    }
  }

  $('doc-grid').addEventListener('change', (e) => {
    const input = e.target.closest('input[type=file]');
    if (input && input.files[0]) uploadDoc(input.closest('.doc-slot'), input.files[0]);
  });
  ['dragenter', 'dragover'].forEach((ev) => $('doc-grid').addEventListener(ev, (e) => {
    const slot = e.target.closest('.doc-slot');
    if (!slot) return;
    e.preventDefault();
    slot.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach((ev) => $('doc-grid').addEventListener(ev, (e) => {
    const slot = e.target.closest('.doc-slot');
    if (slot && (ev === 'drop' || !slot.contains(e.relatedTarget))) slot.classList.remove('drag');
  }));
  $('doc-grid').addEventListener('drop', (e) => {
    const slot = e.target.closest('.doc-slot');
    if (!slot) return;
    e.preventDefault();
    if (e.dataTransfer.files[0]) uploadDoc(slot, e.dataTransfer.files[0]);
  });
  $('doc-grid').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-delete-doc]');
    if (!del || !confirm('Delete this document?')) return;
    try {
      update(await api(`/api/account/documents/${encodeURIComponent(del.dataset.deleteDoc)}`, { method: 'DELETE' }));
      renderDocuments();
      toast('Document deleted');
    } catch (err) { toast(err.message, 'error'); }
  });

  // ---------------------------------------------------------------- applications

  async function loadApplications() {
    try {
      applications = (await api('/api/account/applications')).applications;
    } catch (e) { applications = []; }
    const active = applications.filter((a) => a.status !== 'withdrawn').length;
    $('badge-apps').hidden = !active;
    $('badge-apps').textContent = active;
    $('badge-apps').style.cssText = 'background:var(--soft-gold);color:#7a5b00';
    renderApplications();
    renderOverview();
  }

  function renderApplications() {
    if (!applications.length) {
      $('app-list').innerHTML = `
        <div class="empty">
          <div class="empty-icon">${icon('inbox')}</div>
          <h3>No applications yet</h3>
          <p style="color:var(--muted)">Find a programme you like and apply with your profile in one click.</p>
          <a class="btn btn-primary" href="/programmes">Browse programmes</a>
        </div>`;
      hydrateIcons($('app-list'));
      return;
    }
    $('app-list').innerHTML = applications.map((a, i) => `
      <article class="app-item" data-reveal style="--d:${Math.min(i, 8) * 0.05}s">
        ${fieldBadge(a.field)}
        <div class="grow">
          <h3><a href="/programme?id=${encodeURIComponent(a.programmeId)}">${esc(a.programmeTitle)}</a></h3>
          <small>${esc(a.employer)} · ${esc(a.location)} · ${esc(a.intake || '')} · Applied ${esc(fmtDate(a.createdAt))}</small>
        </div>
        <span class="status-pill st-${esc(a.status)}">${esc(STATUS_TEXT[a.status] || a.status)}</span>
        ${['new', 'reviewing'].includes(a.status) ? `<button class="btn btn-outline btn-sm" type="button" data-withdraw="${esc(a.id)}">Withdraw</button>` : ''}
      </article>`).join('');
    reveal($('app-list'));
  }

  $('app-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-withdraw]');
    if (!b || !confirm('Withdraw this application?')) return;
    try {
      await api(`/api/account/applications/${encodeURIComponent(b.dataset.withdraw)}/withdraw`, { method: 'POST' });
      toast('Application withdrawn');
      loadApplications();
    } catch (err) { toast(err.message, 'error'); }
  });

  // ---------------------------------------------------------------- password & logout

  $('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('pw-next').value.length < 8) return showFormError($('pw-error'), 'The new password must have at least 8 characters.');
    try {
      await api('/api/account/password', { method: 'POST', body: { current: $('pw-current').value, next: $('pw-next').value } });
      e.target.reset();
      $('pw-error').classList.remove('show');
      toast('Password updated');
    } catch (err) { showFormError($('pw-error'), err.message); }
  });

  $('logout').addEventListener('click', async () => {
    if (isDirty() && !confirm('You have unsaved profile changes. Sign out anyway?')) return;
    savedSnapshot = '';
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/';
  });

  boot();
})();
