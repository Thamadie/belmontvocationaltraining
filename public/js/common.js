/* Shared helpers for the public site, the candidate area and the admin panel. */
(function () {
  'use strict';

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    language: '<path d="M4 5h8M8 3v2M10 5c-1 4-3.5 7-6 8.5M6 9c1.2 2 3 3.5 5 4.5M13 21l4-9 4 9M14.5 18h5"/>',
    passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUpRight: '<path d="M7 17L17 7M8 7h9v9"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    filter: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
    code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3.5v11L16 14"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2M3 11h18"/><circle cx="8" cy="13.5" r="1"/><circle cx="16" cy="13.5" r="1"/>',
    coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5zM4 20.5A1.5 1.5 0 0 0 5.5 22H20"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
    bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    plane: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1 4-4.5c1-1 2.5-1.5 3.5-.5s.5 2.5-.5 3.5l-4.5 4 1 8L15 22.5l-2.5-7.5-3 3V21l-1.5 1-1-4-4-1 1-1.5h3z"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1.5 6-1 6-1s.5 3-1 6l-7 7-5-5zM9 10H5l-2 3 4 1M14 15v4l-3 2-1-4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    phone: '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 7 7L16 14l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 13h5l1 3h6l1-3h5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    zip: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M11 5h1M11 8h1M11 11h1M10.5 14h2v3h-2z"/>',
  };

  const FIELD_ICONS = {
    Nursing: 'heart', 'Hotel & Hospitality': 'coffee', IT: 'code', Automobile: 'car', Mechatronics: 'gear', Other: 'grid',
  };

  function icon(name, cls) {
    return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  function allowanceRange(p) {
    if (p.allowanceMin && p.allowanceMax) return `${euro.format(p.allowanceMin)} – ${euro.format(p.allowanceMax)}`;
    if (p.allowanceMin) return `from ${euro.format(p.allowanceMin)}`;
    if (p.allowanceMax) return `up to ${euro.format(p.allowanceMax)}`;
    return p.type === 'Ausbildung' ? 'Paid training' : 'Tuition-free';
  }
  const hasAllowance = (p) => Boolean(p.allowanceMin || p.allowanceMax);
  const years = (n) => `${String(n).replace('.5', '½')} year${n === 1 ? '' : 's'}`;

  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [name, secs] of units) {
      const n = Math.floor(s / secs);
      if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  }

  const fmtDate = (iso) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  function initials(name) {
    return String(name || '?').split(/\s+/).filter((w) => /^[A-Za-zÄÖÜäöü]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  }

  function fieldBadge(field) {
    const v = { Nursing: 'v1', 'Hotel & Hospitality': 'v2', IT: '', Automobile: 'v1', Mechatronics: 'v2', Other: '' }[field] || '';
    return `<div class="company-logo ${v}" aria-hidden="true">${icon(FIELD_ICONS[field] || 'grid')}</div>`;
  }

  async function api(url, options = {}) {
    const opts = { credentials: 'same-origin', ...options };
    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
      opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      opts.body = JSON.stringify(opts.body);
    }
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      showServerNotice();
      throw new Error('Cannot reach the server. Please check your connection and try again.');
    }
    // An HTML reply to an API call means the page is served without the Node
    // server behind it (e.g. only the public/ folder on a static host).
    if (!/json/.test(res.headers.get('content-type') || '')) {
      showServerNotice();
      throw new Error('The website server is not running.');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // XHR upload so forms can show a progress bar.
  function uploadFile(url, formData, onProgress, method) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method || 'POST', url);
      xhr.upload.addEventListener('progress', (ev) => ev.lengthComputable && onProgress && onProgress(ev.loaded / ev.total));
      xhr.onload = () => {
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(res);
        else {
          const err = new Error(res.error || 'Upload failed. Please try again.');
          err.status = xhr.status;
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error('Network error. Please check your connection and try again.'));
      xhr.send(formData);
    });
  }

  function showServerNotice() {
    if (document.querySelector('.server-notice')) return;
    const el = document.createElement('div');
    el.className = 'server-notice';
    el.setAttribute('role', 'alert');
    el.innerHTML = '<strong>The website server isn’t running.</strong> Programmes, accounts and applications need it. ' +
      'Start it with <code>npm start</code> in the project folder and open the site at ' +
      '<a href="http://localhost:3000">http://localhost:3000</a>. See the README for hosting.';
    document.body.prepend(el);
  }

  function toast(message, type) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type || ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 3600);
  }

  // Scroll-triggered reveal animations
  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          revealObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    : null;

  function reveal(root) {
    (root || document).querySelectorAll('[data-reveal]:not(.in)').forEach((el) => {
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('in');
    });
  }

  // Count-up numbers
  function countUp(el, target) {
    const duration = 1600;
    const start = performance.now();
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + Math.round(target * eased).toLocaleString('en-US') + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function observeCounters(root) {
    const els = (root || document).querySelectorAll('[data-count]');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => (el.textContent = (el.dataset.prefix || '') + el.dataset.count + (el.dataset.suffix || '')));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          countUp(e.target, Number(e.target.dataset.count) || 0);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });
    els.forEach((el) => obs.observe(el));
  }

  // Button ripple effect
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  });

  // ---------------------------------------------------------------- layout

  const BRAND = `
    <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><b>B</b></span>
    <span class="brand-text"><strong>Belmont</strong><small>Vocational Training · Germany</small></span>`;

  function renderLayout() {
    const header = document.querySelector('[data-layout="header"]');
    if (header) {
      header.outerHTML = `
        <header class="site-header${header.dataset.solid !== undefined ? ' solid' : ''}">
          <div class="container nav">
            <a href="/" class="brand" aria-label="Belmont Vocational Training – home">${BRAND}</a>
            <nav aria-label="Main">
              <ul class="nav-links">
                <li><a href="/" data-path="/">Home</a></li>
                <li><a href="/programmes" data-path="/programmes">Programmes</a></li>
                <li><a href="/german-classes" data-path="/german-classes">German classes</a></li>
                <li><a href="/#requirements">Requirements</a></li>
                <li><a href="/#pathway">Your pathway</a></li>
                <li class="nav-account"><a href="/login" class="btn btn-primary btn-sm" data-account-link>${icon('user')} Sign in</a></li>
              </ul>
            </nav>
            <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span></button>
          </div>
        </header>`;
    }
    const footer = document.querySelector('[data-layout="footer"]');
    if (footer) {
      footer.outerHTML = `
        <footer class="site-footer">
          <div class="container">
            <div class="footer-grid">
              <div>
                <a href="/" class="brand brand-footer">${BRAND}</a>
                <p style="margin-top:18px">Belmont Migration Lawyers (Pvt) Ltd guides students from their first German lesson to their first day of training in Germany.</p>
                <div class="footer-flag" aria-hidden="true"><i></i><i></i><i></i></div>
              </div>
              <div>
                <h4>Programmes</h4>
                <ul>
                  <li><a href="/programmes?field=Nursing">Nursing</a></li>
                  <li><a href="/programmes?field=Hotel+%26+Hospitality">Hotel &amp; Hospitality</a></li>
                  <li><a href="/programmes?field=IT">IT</a></li>
                  <li><a href="/programmes?field=Automobile">Automobile</a></li>
                  <li><a href="/programmes?field=Mechatronics">Mechatronics</a></li>
                </ul>
              </div>
              <div>
                <h4>Guide</h4>
                <ul>
                  <li><a href="/german-classes">German classes</a></li>
                  <li><a href="/#ausbildung">What is Ausbildung?</a></li>
                  <li><a href="/#requirements">Requirements &amp; fees</a></li>
                  <li><a href="/#blocked-account">Blocked account</a></li>
                  <li><a href="/#pathway">Pathway to PR</a></li>
                  <li><a href="/#faq">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h4>Your account</h4>
                <ul>
                  <li><a href="/login?mode=register">Create an account</a></li>
                  <li><a href="/login">Sign in</a></li>
                  <li><a href="/account">My profile</a></li>
                </ul>
              </div>
            </div>
            <div class="footer-bottom">
              <span>© <span data-year></span> Belmont Migration Lawyers (Pvt) Ltd. All rights reserved.</span>
              <span class="photo-credit">Hero photo: Reichstag building, Berlin – Ansgar Koreng, <a href="https://commons.wikimedia.org/wiki/File:Reichstagsgeb%C3%A4ude_bei_Sonnenuntergang,_170325,_ako.jpg" target="_blank" rel="noopener">CC BY-SA 3.0 DE</a></span>
            </div>
          </div>
        </footer>
        <button class="to-top" aria-label="Back to top">${icon('arrowUp')}</button>`;
    }
  }

  // Swap "Sign in" for "My account" when a candidate is signed in.
  let mePromise = null;
  function currentUser() {
    if (!mePromise) mePromise = api('/api/auth/me').catch(() => null);
    return mePromise;
  }

  function initAccountLink() {
    const link = document.querySelector('[data-account-link]');
    if (!link) return;
    currentUser().then((me) => {
      if (!me) return;
      link.href = '/account';
      link.innerHTML = `<span class="nav-avatar">${esc(initials(`${me.user.firstName} ${me.user.lastName}`))}</span> My account`;
      link.classList.add('signed-in');
    });
  }

  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 30);
      header.classList.toggle('hide', y > 400 && y > lastY && !document.body.classList.contains('nav-open'));
      lastY = y;
      const top = document.querySelector('.to-top');
      if (top) top.classList.toggle('show', y > 700);
      const bar = document.querySelector('.scroll-progress');
      if (bar) bar.style.transform = `scaleX(${y / Math.max(1, document.documentElement.scrollHeight - innerHeight)})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const toggle = header.querySelector('.nav-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = document.body.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      header.querySelectorAll('.nav-links a').forEach((a) =>
        a.addEventListener('click', () => document.body.classList.remove('nav-open'))
      );
    }

    const path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    header.querySelectorAll('.nav-links a[data-path]').forEach((a) => {
      if (a.dataset.path === path) a.classList.add('active');
    });

    const top = document.querySelector('.to-top');
    if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    const year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
    initAccountLink();
  }

  function hideLoader() {
    const loader = document.querySelector('.loader');
    if (loader) setTimeout(() => loader.classList.add('done'), 250);
  }

  // ---------------------------------------------------------------- cards

  function programmeTags(p) {
    const tags = [
      `<span class="tag">${icon('pin')}${esc(p.location)}</span>`,
      `<span class="tag">${icon('clock')}${esc(years(p.durationYears))}</span>`,
      `<span class="tag">${icon('language')}German ${esc(p.germanLevel)}</span>`,
      `<span class="tag tag-gold">${icon('calendar')}${esc(p.intake)}</span>`,
    ];
    return tags.join('');
  }

  function programmeCard(p, i) {
    return `
      <article class="job-card${p.featured ? ' has-badge' : ''}" data-reveal style="--d:${(i % 6) * 0.07}s">
        ${p.featured ? '<span class="featured-badge">Featured</span>' : ''}
        <div class="job-top">
          ${fieldBadge(p.field)}
          <div>
            <h3 class="job-title"><a class="card-link" href="/programme?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>
            <div class="job-company">${esc(p.type)} · ${esc(p.field)}</div>
          </div>
        </div>
        ${p.summary ? `<p class="job-summary">${esc(p.summary)}</p>` : ''}
        <div class="tags">${programmeTags(p)}</div>
        <div class="job-bottom">
          <div class="salary">${esc(allowanceRange(p))} ${hasAllowance(p) ? '<small>/ month</small>' : ''}</div>
          <span class="posted">${p.seats ? `${icon('users')} ${p.seats} seats` : esc(timeAgo(p.createdAt))}</span>
        </div>
      </article>`;
  }

  function skeletonCards(n) {
    return Array.from({ length: n }, () => `
      <div class="job-card skeleton" aria-hidden="true">
        <div class="job-top"><div class="sk" style="width:54px;height:54px;border-radius:15px"></div>
          <div style="flex:1"><div class="sk" style="height:18px;width:70%;margin-bottom:10px"></div><div class="sk" style="height:12px;width:40%"></div></div></div>
        <div class="sk" style="height:12px;width:95%"></div>
        <div style="display:flex;gap:8px"><div class="sk" style="height:26px;width:80px;border-radius:99px"></div><div class="sk" style="height:26px;width:90px;border-radius:99px"></div><div class="sk" style="height:26px;width:70px;border-radius:99px"></div></div>
      </div>`).join('');
  }

  // Turn a plain-text description into headings, paragraphs and lists.
  function renderDescription(text) {
    const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/);
    return blocks.map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      let html = '';
      let list = [];
      const flush = () => {
        if (list.length) html += `<ul>${list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
        list = [];
      };
      lines.forEach((line) => {
        const bullet = line.match(/^[-*•]\s+(.*)$/);
        if (bullet) return list.push(bullet[1]);
        flush();
        if (/:$/.test(line) && line.length < 60) html += `<h3>${esc(line.slice(0, -1))}</h3>`;
        else html += `<p>${esc(line)}</p>`;
      });
      flush();
      return html;
    }).join('');
  }

  // ---------------------------------------------------------------- profile form

  // Renders the candidate profile form from the field list the server sends,
  // so the account page and the admin panel always show the same fields.
  function profileFormHtml(fields, values, prefix) {
    const id = (k) => `${prefix || 'pf'}-${k}`;
    const sections = [];
    fields.forEach((f) => {
      let s = sections.find((x) => x.name === f.section);
      if (!s) sections.push((s = { name: f.section, fields: [] }));
      s.fields.push(f);
    });
    return sections.map((s) => `
      <fieldset class="form-section">
        <legend>${esc(s.name)}</legend>
        <div class="form-grid">
          ${s.fields.map((f) => {
            const v = values[f.key] == null ? '' : values[f.key];
            let control;
            if (f.type === 'select') {
              control = `<select class="select" id="${id(f.key)}" name="${f.key}"><option value="">Select…</option>${f.options.map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
            } else if (f.type === 'textarea') {
              control = `<textarea class="input" id="${id(f.key)}" name="${f.key}" rows="4" maxlength="${f.max || 2000}">${esc(v)}</textarea>`;
            } else {
              control = `<input class="input" id="${id(f.key)}" name="${f.key}" type="${f.type}" value="${esc(v)}"${f.max ? ` maxlength="${f.max}"` : ''}>`;
            }
            return `<div class="field${f.full || f.type === 'textarea' ? ' full' : ''}">
              <label for="${id(f.key)}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
              ${control}
              ${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </fieldset>`).join('');
  }

  function readForm(form) {
    const body = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      body[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return body;
  }

  function showFormError(el, msg) {
    el.textContent = msg;
    el.classList.remove('show');
    void el.offsetWidth; // restart animation
    el.classList.add('show');
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#0d0d0d', '#dd0000', '#ffce00'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = colors[i % 3];
      c.style.animationDuration = `${2 + Math.random() * 2.5}s`;
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      document.body.appendChild(c);
      c.addEventListener('animationend', () => c.remove());
    }
  }

  // This script is loaded at the end of <body>, so the layout can be inserted
  // right away and the rest of the page's script sees the final DOM.
  renderLayout();

  function init() {
    hydrateIcons();
    initHeader();
    reveal();
    observeCounters();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', hideLoader);
  setTimeout(hideLoader, 2500);

  window.BVT = {
    icon, hydrateIcons, esc, allowanceRange, hasAllowance, years, timeAgo, fmtDate, initials, fieldBadge, api, uploadFile,
    toast, reveal, observeCounters, programmeCard, programmeTags, skeletonCards, renderDescription,
    profileFormHtml, readForm, showFormError, confetti, currentUser, FIELD_ICONS, euro,
  };
})();
