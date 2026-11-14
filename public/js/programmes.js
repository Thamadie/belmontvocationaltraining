(function () {
  'use strict';
  const { api, esc, icon, allowanceRange, hasAllowance, programmeTags, fieldBadge, skeletonCards, reveal } = window.BVT;

  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get('q') || '',
    location: params.get('location') || '',
    field: params.get('field') || '',
    type: params.get('type') || '',
    intake: params.get('intake') || '',
    sort: params.get('sort') || '',
  };

  const $ = (id) => document.getElementById(id);
  const results = $('results');
  const filters = $('filters');

  function rowCard(p, i) {
    return `
      <article class="job-card" data-reveal style="--d:${Math.min(i, 8) * 0.05}s">
        <div class="job-main">
          <div class="job-top">
            ${fieldBadge(p.field)}
            <div>
              <h3 class="job-title"><a class="card-link" href="/programme?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>
              <div class="job-company">${esc(p.type)} · ${esc(p.field)} · ${esc(p.employer)}</div>
            </div>
          </div>
          ${p.summary ? `<p class="job-summary">${esc(p.summary)}</p>` : ''}
          <div class="tags">${programmeTags(p)}</div>
        </div>
        <div class="job-side">
          ${p.featured ? '<span class="featured-badge">Featured</span>' : ''}
          <div class="salary">${esc(allowanceRange(p))} ${hasAllowance(p) ? '<small>/ month</small>' : ''}</div>
          <span class="posted">${icon('users')} ${p.seats ? `${p.seats} seats` : 'Open'}</span>
          <span class="btn btn-dark btn-sm" aria-hidden="true">Details &amp; apply ${icon('arrow')}</span>
        </div>
      </article>`;
  }

  function syncUrl() {
    const p = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => v && p.set(k, v));
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    return qs;
  }

  let requestId = 0;
  async function load() {
    const qs = syncUrl();
    const id = ++requestId;
    results.innerHTML = skeletonCards(3);
    $('results-count').textContent = 'Searching…';
    try {
      const { programmes } = await api(`/api/programmes${qs ? `?${qs}` : ''}`);
      if (id !== requestId) return;
      $('results-count').innerHTML = `<span><strong>${programmes.length}</strong> programme${programmes.length === 1 ? '' : 's'} found</span>`;
      if (!programmes.length) {
        results.innerHTML = `
          <div class="empty">
            <div class="empty-icon">${icon('search')}</div>
            <h3>No programmes match your search</h3>
            <p style="color:var(--muted)">Try different keywords or remove some filters.</p>
            <button class="btn btn-primary" type="button" id="empty-clear">Clear filters</button>
          </div>`;
        $('empty-clear').addEventListener('click', clearAll);
        return;
      }
      results.innerHTML = programmes.map(rowCard).join('');
      reveal(results);
    } catch (err) {
      if (id !== requestId) return;
      $('results-count').textContent = '';
      results.innerHTML = `<div class="empty"><h3>Something went wrong</h3><p style="color:var(--muted)">${esc(err.message)}</p></div>`;
    }
  }

  function renderChips(meta) {
    const lists = { field: meta.fields, type: meta.types, intake: meta.intakes };
    document.querySelectorAll('[data-filter]').forEach((wrap) => {
      const key = wrap.dataset.filter;
      wrap.innerHTML = lists[key].map((v) => {
        const count = key === 'field' && meta.fieldCounts[v] ? ` <span style="opacity:.55">${meta.fieldCounts[v]}</span>` : '';
        return `<button type="button" class="chip${state[key] === v ? ' active' : ''}" data-value="${esc(v)}">${esc(v)}${count}</button>`;
      }).join('');
      wrap.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const value = chip.dataset.value;
        state[key] = state[key] === value ? '' : value;
        wrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.value === state[key]));
        load();
      });
    });

    const sel = $('f-location');
    const locations = new Set(meta.locations);
    if (state.location) locations.add(state.location);
    sel.innerHTML = '<option value="">All cities</option>' + [...locations].sort().map((l) => `<option${l === state.location ? ' selected' : ''}>${esc(l)}</option>`).join('');
  }

  function clearAll() {
    Object.assign(state, { q: '', location: '', field: '', type: '', intake: '' });
    $('f-q').value = '';
    $('f-location').value = '';
    document.querySelectorAll('.chip.active').forEach((c) => c.classList.remove('active'));
    load();
  }

  $('f-q').value = state.q;
  $('f-sort').value = state.sort;

  $('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = $('f-q').value.trim();
    load();
  });
  let debounce;
  $('f-q').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = $('f-q').value.trim(); load(); }, 350);
  });
  $('f-location').addEventListener('change', (e) => { state.location = e.target.value; load(); });
  $('f-sort').addEventListener('change', (e) => { state.sort = e.target.value; load(); });
  $('clear-filters').addEventListener('click', clearAll);
  $('open-filters').addEventListener('click', () => filters.classList.add('open'));
  $('close-filters').addEventListener('click', () => filters.classList.remove('open'));
  $('apply-filters').addEventListener('click', () => filters.classList.remove('open'));

  api('/api/meta').then(renderChips).catch(() => {});
  load();
})();
