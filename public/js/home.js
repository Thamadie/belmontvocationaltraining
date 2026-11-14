(function () {
  'use strict';
  const { api, esc, icon, programmeCard, skeletonCards, reveal, FIELD_ICONS } = window.BVT;
  const $ = (id) => document.getElementById(id);

  const FIELD_INFO = {
    Nursing: 'Hospitals, care homes and community care',
    'Hotel & Hospitality': 'Hotels, restaurants and kitchens',
    IT: 'Software development and system integration',
    Automobile: 'Car mechatronics and vehicle technology',
    Mechatronics: 'Automation, machines and production',
  };

  // Rotating field name in the hero headline.
  const words = ['Nursing', 'IT', 'Hotel', 'Automotive', 'Mechatronics'];
  const rotator = $('rotator');
  let w = 0;
  if (rotator && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(() => {
      const current = rotator.firstElementChild;
      current.classList.add('out');
      setTimeout(() => {
        w = (w + 1) % words.length;
        rotator.innerHTML = `<span class="rotator-word">${words[w]}</span>`;
      }, 380);
    }, 2600);
  }

  // Ticker
  const items = ['Ausbildung', 'Nursing', 'Berlin', 'Hotel & Hospitality', 'Munich', 'IT', 'Hamburg', 'Automobile', 'Stuttgart', 'Mechatronics', 'Frankfurt', '€1,000 / month'];
  $('marquee').innerHTML = [...items, ...items].map((t) => `<span class="marquee-item">${esc(t)}</span>`).join('');

  function renderFields(counts) {
    $('field-grid').innerHTML = Object.keys(FIELD_INFO).map((f, i) => `
      <a class="cat-card" href="/programmes?field=${encodeURIComponent(f)}" data-reveal style="--d:${i * 0.07}s">
        <span class="cat-arrow">${icon('arrowUpRight')}</span>
        <span class="cat-icon">${icon(FIELD_ICONS[f])}</span>
        <span class="cat-name">${esc(f)}</span>
        <p class="cat-desc">${esc(FIELD_INFO[f])}</p>
        <span class="cat-count">${counts[f] ? `${counts[f]} open programme${counts[f] > 1 ? 's' : ''}` : 'Coming soon'}</span>
      </a>`).join('');
    reveal($('field-grid'));
  }
  renderFields({});

  function setCount(el, n) {
    el.dataset.count = n;
    window.BVT.observeCounters(el.parentElement);
  }

  api('/api/meta').then((meta) => {
    renderFields(meta.fieldCounts);
    setCount($('stat-programmes'), meta.stats.programmes);
    setCount($('stat-seats'), meta.stats.seats);
  }).catch(() => {});

  $('featured').innerHTML = skeletonCards(4);
  api('/api/programmes?featured=1&limit=6')
    .then(({ programmes }) => {
      if (!programmes.length) return api('/api/programmes?limit=6').then((r) => r.programmes);
      return programmes;
    })
    .then((list) => {
      $('featured').innerHTML = list.length
        ? list.map(programmeCard).join('')
        : '<div class="empty" style="grid-column:1/-1"><h3>New programmes are coming soon</h3><p style="color:var(--muted)">Create your profile now and we will contact you.</p></div>';
      reveal($('featured'));
    })
    .catch(() => { $('featured').innerHTML = ''; });

  // Fill the pathway line as the visitor scrolls through it.
  const timeline = $('timeline');
  const line = timeline.querySelector('.timeline-line');
  function onScroll() {
    const r = timeline.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.6 - r.top) / r.height));
    line.style.setProperty('--p', p.toFixed(3));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Gentle parallax on the hero photo.
  const heroImage = document.querySelector('.hero-image');
  if (heroImage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', () => {
      if (scrollY < innerHeight) heroImage.style.translate = `0 ${scrollY * 0.25}px`;
    }, { passive: true });
  }
})();
