(function () {
  'use strict';
  const {
    api, esc, icon, allowanceRange, hasAllowance, years, timeAgo, fmtDate, fieldBadge, initials, toast, reveal,
    hydrateIcons, renderDescription, showFormError, confetti, currentUser,
  } = window.BVT;

  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get('id');
  const here = `${location.pathname}${location.search}`;

  function fact(iconName, label, value) {
    return `<div class="fact"><div class="fact-icon">${icon(iconName)}</div><div><small>${esc(label)}</small><span>${esc(value)}</span></div></div>`;
  }

  function render(p, open) {
    document.title = `${p.title} – Belmont Vocational Training`;
    const tags = [
      `<span class="tag tag-dark">${icon('pin')}${esc(p.location)}</span>`,
      `<span class="tag">${icon('clock')}${esc(years(p.durationYears))}</span>`,
      `<span class="tag">${icon('language')}German ${esc(p.germanLevel)}</span>`,
      `<span class="tag tag-gold">${icon('calendar')}${esc(p.intake)}</span>`,
    ];
    if (p.featured) tags.push(`<span class="tag tag-red">${icon('star')}Featured</span>`);

    $('banner').innerHTML = `
      <nav class="breadcrumb" data-reveal><a href="/">Home</a> / <a href="/programmes">Programmes</a> / <a href="/programmes?field=${encodeURIComponent(p.field)}">${esc(p.field)}</a></nav>
      <div class="job-hero-meta" data-reveal style="--d:.1s">
        ${fieldBadge(p.field)}
        <div style="flex:1;min-width:260px">
          <h1 style="margin-bottom:8px">${esc(p.title)}</h1>
          <p>${esc(p.type)} · ${esc(p.employer)} · Posted ${esc(timeAgo(p.createdAt))}</p>
        </div>
      </div>
      <div class="tags" style="margin-top:24px;--d:.2s" data-reveal>${tags.join('')}</div>`;

    $('body').innerHTML = (p.summary ? `<p style="font-size:18px;color:var(--ink);font-weight:500">${esc(p.summary)}</p>` : '') + renderDescription(p.description);
    $('side-allowance').innerHTML = `${esc(allowanceRange(p))}${hasAllowance(p) ? ' <span style="font-size:15px;font-weight:500;opacity:.7">/ month</span>' : ''}`;

    const facts = [
      fact('cap', 'Programme type', p.type),
      fact('grid', 'Field', p.field),
      fact('briefcase', 'Training provider', p.employer),
      fact('clock', 'Duration', years(p.durationYears)),
      fact('language', 'German level', p.germanLevel),
      fact('calendar', 'Intake', p.intake),
    ];
    if (p.education) facts.push(fact('book', 'Education', p.education));
    if (p.seats) facts.push(fact('users', 'Training places', String(p.seats)));
    if (p.deadline) facts.push(fact('calendar', 'Apply before', fmtDate(p.deadline)));
    $('facts').innerHTML = facts.join('');

    const url = location.href;
    $('share-wa').href = `https://wa.me/?text=${encodeURIComponent(`${p.title} – ${url}`)}`;
    $('share-mail').href = `mailto:?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(url)}`;
    $('copy-link').addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => toast('Link copied to clipboard'), () => toast('Could not copy link', 'error'));
    });

    if (!open) {
      $('apply-area').innerHTML = '<div class="closed-note">This programme is no longer accepting applications.</div>';
      $('side-apply').remove();
    }
    $('detail').hidden = false;
    reveal();
  }

  function gate(iconName, title, text, actions, extra) {
    $('apply-area').innerHTML = `
      <div class="apply-gate">
        <div class="empty-icon">${icon(iconName)}</div>
        <h3>${title}</h3>
        <p>${text}</p>
        ${extra || ''}
        <div class="gate-actions">${actions}</div>
      </div>`;
  }

  async function setupApply(p) {
    const me = await currentUser();
    const next = encodeURIComponent(here + '#apply');
    if (!me) {
      return gate('user', 'Sign in to apply',
        'Applications use your Belmont profile, so you only fill in your details and upload your Europass CV once.',
        `<a class="btn btn-primary" href="/login?mode=register&next=${next}">Create free account</a><a class="btn btn-outline" href="/login?next=${next}">Sign in</a>`);
    }

    const mine = (await api('/api/account/applications').catch(() => ({ applications: [] }))).applications
      .find((a) => a.programmeId === p.id && a.status !== 'withdrawn');
    if (mine) {
      $('side-apply').outerHTML = `<span class="btn btn-gold btn-block" style="pointer-events:none">${icon('check')} Applied</span>`;
      return gate('check', 'You have already applied',
        `You applied on ${esc(fmtDate(mine.createdAt))}. Current status: <strong>${esc(mine.status)}</strong>.`,
        '<a class="btn btn-dark" href="/account#applications">View my applications</a>');
    }

    const c = me.completeness;
    if (!c.canApply) {
      const missing = [...c.missingFields, ...c.missingDocs.filter((d) => d === 'Europass CV')];
      return gate('file', 'Complete your profile to apply',
        'A few details are still missing from your profile:',
        `<a class="btn btn-primary" href="/account#${c.missingFields.length ? 'profile' : 'documents'}">Complete my profile ${icon('arrow')}</a>`,
        `<div class="missing-list">${missing.map((m) => `<span class="tag tag-red">${esc(m)}</span>`).join('')}</div>`);
    }

    const u = me.user;
    const cv = (u.documents || []).find((d) => d.type === 'cv');
    $('apply-area').innerHTML = `
      <form id="apply-form" novalidate>
        <div class="applicant-chip">
          <div class="company-logo v2">${esc(initials(`${u.firstName} ${u.lastName}`))}</div>
          <div style="flex:1;min-width:0"><strong>${esc(u.firstName)} ${esc(u.lastName)}</strong><small>${esc(u.email)} · German ${esc(u.germanLevel)} · ${esc(u.highestEducation)}</small></div>
          <a class="link-btn" href="/account#profile">Edit profile</a>
        </div>
        <div class="file-chip show" style="margin:0 0 18px">
          <div class="fi">${esc((cv.ext || '').replace('.', '').toUpperCase())}</div>
          <div class="fn"><strong>${esc(cv.name)}</strong><small>Europass CV · ${(u.documents || []).length} document${u.documents.length === 1 ? '' : 's'} in your profile</small></div>
          <a class="link-btn" href="/account#documents">Change</a>
        </div>
        <div class="field">
          <label for="a-motivation">Why this programme? <span style="color:var(--muted);font-weight:400">(optional)</span></label>
          <textarea class="input" id="a-motivation" name="motivation" maxlength="4000" placeholder="Tell us in a few sentences why you are interested in ${esc(p.field)} and in training in Germany."></textarea>
        </div>
        <label class="check" style="margin-top:16px"><input type="checkbox" id="a-consent"> I agree that Belmont Migration Lawyers shares my profile and documents with the training provider for this application.</label>
        <div class="form-error" id="form-error" role="alert"></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" id="submit-btn" style="margin-top:20px">Submit application ${icon('arrow')}</button>
      </form>`;

    $('apply-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!$('a-consent').checked) return showFormError($('form-error'), 'Please confirm that we may share your profile with the training provider.');
      const btn = $('submit-btn');
      btn.disabled = true;
      try {
        await api(`/api/programmes/${encodeURIComponent(p.id)}/apply`, { method: 'POST', body: { motivation: $('a-motivation').value } });
        $('success-name').textContent = u.firstName;
        $('apply-area').style.display = 'none';
        $('success').classList.add('show');
        $('apply').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('side-apply').outerHTML = `<span class="btn btn-gold btn-block" style="pointer-events:none">${icon('check')} Applied</span>`;
        confetti();
      } catch (err) {
        btn.disabled = false;
        showFormError($('form-error'), err.message);
      }
    });
  }

  async function loadSimilar(p) {
    try {
      const { programmes } = await api(`/api/programmes?field=${encodeURIComponent(p.field)}&limit=4`);
      const similar = programmes.filter((x) => x.id !== p.id).slice(0, 3);
      if (!similar.length) return;
      $('similar').innerHTML = `
        <div class="card" data-reveal="right" style="padding:20px 24px">
          <div style="font-weight:600;margin-bottom:6px">Similar programmes</div>
          ${similar.map((x) => `
            <a href="/programme?id=${encodeURIComponent(x.id)}" class="fact">
              ${fieldBadge(x.field).replace('class="company-logo', 'style="width:40px;height:40px;border-radius:12px" class="company-logo')}
              <div style="min-width:0"><span style="display:block;line-height:1.3">${esc(x.title)}</span><small style="text-transform:none;letter-spacing:0">${esc(x.location)} · ${esc(x.intake)}</small></div>
            </a>`).join('')}
        </div>`;
      reveal($('similar'));
    } catch (e) { /* optional */ }
  }

  function notFound() {
    $('banner').innerHTML = '<nav class="breadcrumb"><a href="/">Home</a> / <a href="/programmes">Programmes</a></nav><h1>Programme not found</h1>';
    $('not-found').hidden = false;
    hydrateIcons();
  }

  if (!id) return notFound();

  api(`/api/programmes/${encodeURIComponent(id)}`)
    .then(({ programme, open }) => {
      render(programme, open);
      if (open) setupApply(programme);
      loadSimilar(programme);
    })
    .catch(notFound);
})();
