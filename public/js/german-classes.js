(function () {
  'use strict';
  const { api, esc, icon, toast, reveal, hydrateIcons, observeCounters } = window.BVT;
  const $ = (id) => document.getElementById(id);

  const LEVEL_INFO = {
    A1: ['Beginner', 'Greetings, numbers, introducing yourself and everyday phrases.'],
    A2: ['Elementary', 'Shopping, directions, appointments and simple conversations.'],
    B1: ['Intermediate', 'The level you need for an Ausbildung: work, opinions and the B1 exam.'],
    B2: ['Upper intermediate', 'Fluent conversations, workplace German and nursing vocabulary.'],
  };

  let lessons = [];
  let levels = [];
  let signedIn = false;
  let level = new URLSearchParams(location.search).get('level') || '';
  let query = '';
  let current = null;

  const fmtDuration = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
  const byLevel = (lv) => lessons.filter((l) => l.level === lv);
  const lessonNumber = (l) => byLevel(l.level).indexOf(l) + 1;

  async function load() {
    $('lessons').innerHTML = `<div class="lesson-grid">${Array.from({ length: 6 }, () => '<div class="lesson-card skeleton"><div class="sk" style="aspect-ratio:16/9;border-radius:16px"></div><div class="sk" style="height:16px;width:70%;margin:14px 0 8px"></div><div class="sk" style="height:12px;width:40%"></div></div>').join('')}</div>`;
    try {
      const res = await api('/api/lessons');
      lessons = res.lessons;
      levels = res.levels;
      signedIn = res.signedIn;
    } catch (err) {
      $('lessons').innerHTML = `<div class="empty"><h3>Something went wrong</h3><p style="color:var(--muted)">${esc(err.message)}</p></div>`;
      return;
    }
    $('join-note').hidden = signedIn || !lessons.some((l) => l.locked);
    renderStats();
    renderTabs();
    render();
    reveal();
    const deepLink = new URLSearchParams(location.search).get('lesson');
    if (deepLink && lessons.find((l) => l.id === deepLink)) openPlayer(deepLink);
  }

  function renderStats() {
    const minutes = Math.round(lessons.reduce((s, l) => s + (l.durationSec || 0), 0) / 60);
    $('stat-lessons').dataset.count = lessons.length;
    $('stat-minutes').dataset.count = minutes;
    observeCounters($('stat-lessons').parentElement.parentElement);
    if (signedIn && lessons.length) {
      const pct = Math.round((lessons.filter((l) => l.watched).length / lessons.length) * 100);
      $('my-progress').hidden = false;
      $('ring-label').textContent = `${pct}%`;
      requestAnimationFrame(() => { $('ring').style.strokeDashoffset = String(264 - (264 * pct) / 100); });
    }
  }

  function renderTabs() {
    const tab = (value, label, list) => {
      const done = list.filter((l) => l.watched).length;
      const pct = list.length ? (done / list.length) * 100 : 0;
      return `
        <button type="button" role="tab" class="level-tab${level === value ? ' active' : ''}" data-level="${value}" aria-selected="${level === value}">
          <span class="lt-top"><strong>${esc(label)}</strong><small>${list.length} lesson${list.length === 1 ? '' : 's'}</small></span>
          ${signedIn ? `<span class="lt-bar"><i style="width:${pct}%"></i></span>` : ''}
        </button>`;
    };
    $('level-tabs').innerHTML = tab('', 'All levels', lessons) + levels.map((lv) => tab(lv, lv, byLevel(lv))).join('');
  }

  $('level-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    level = b.dataset.level;
    const url = new URL(location.href);
    if (level) url.searchParams.set('level', level); else url.searchParams.delete('level');
    history.replaceState(null, '', url);
    renderTabs();
    render();
  });

  let searchTimer;
  $('lesson-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query = e.target.value.trim().toLowerCase(); render(); }, 200);
  });

  function card(l, i) {
    return `
      <article class="lesson-card${l.locked ? ' locked' : ''}${l.watched ? ' watched' : ''}" data-reveal style="--d:${Math.min(i, 8) * 0.05}s">
        <button type="button" class="lesson-thumb" data-play="${esc(l.id)}" aria-label="${l.locked ? 'Locked: ' : 'Play: '}${esc(l.title)}">
          ${l.poster ? `<img src="${esc(l.poster)}" alt="" loading="lazy">` : `<span class="thumb-fallback"><b>${esc(l.level)}</b></span>`}
          <span class="play-btn">${icon(l.locked ? 'lock' : 'play')}</span>
          ${l.durationSec ? `<span class="duration">${fmtDuration(l.durationSec)}</span>` : ''}
          ${l.access === 'free' ? '<span class="free-badge">Free</span>' : ''}
          ${l.watched ? `<span class="watched-badge" title="Watched">${icon('check')}</span>` : ''}
        </button>
        <div class="lesson-body">
          <span class="lesson-num">${esc(l.level)} · Lesson ${lessonNumber(l)}</span>
          <h3>${esc(l.title)}</h3>
          ${l.topic ? `<span class="tag">${esc(l.topic)}</span>` : ''}
        </div>
      </article>`;
  }

  function render() {
    const match = (l) => !query || `${l.title} ${l.topic} ${l.description}`.toLowerCase().includes(query);
    const shown = levels.filter((lv) => !level || lv === level);
    let html = '';
    let i = 0;
    shown.forEach((lv) => {
      const list = byLevel(lv).filter(match);
      if (!list.length) return;
      const done = list.filter((l) => l.watched).length;
      html += `
        <section class="level-section">
          <div class="level-head" data-reveal>
            <span class="level-chip lv-${lv.toLowerCase()}">${lv}</span>
            <div><h2>${esc(LEVEL_INFO[lv][0])}</h2><p>${esc(LEVEL_INFO[lv][1])}</p></div>
            ${signedIn ? `<span class="level-done">${done} / ${list.length} watched</span>` : ''}
          </div>
          <div class="lesson-grid">${list.map((l) => card(l, i++)).join('')}</div>
        </section>`;
    });
    if (!html) {
      html = `
        <div class="empty">
          <div class="empty-icon">${icon(lessons.length ? 'search' : 'play')}</div>
          <h3>${lessons.length ? 'No lessons match your search' : 'Lessons are coming soon'}</h3>
          <p style="color:var(--muted)">${lessons.length ? 'Try another word or level.' : 'Our teachers are recording the first German lessons. Check back soon!'}</p>
        </div>`;
    }
    $('lessons').innerHTML = html;
    reveal($('lessons'));
  }

  $('lessons').addEventListener('click', (e) => {
    const b = e.target.closest('[data-play]');
    if (b) openPlayer(b.dataset.play);
  });

  // ---------------------------------------------------------------- player

  function stopMedia() {
    $('player-stage').innerHTML = '';
  }

  function openPlayer(id) {
    const l = lessons.find((x) => x.id === id);
    if (!l) return;
    if (l.locked) {
      toast('Create a free account or sign in to watch this lesson.');
      location.href = `/login?mode=register&next=${encodeURIComponent(`/german-classes?lesson=${l.id}`)}`;
      return;
    }
    current = l;
    stopMedia();
    if (l.youtubeId) {
      $('player-stage').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(l.youtubeId)}?autoplay=1&rel=0&modestbranding=1" title="${esc(l.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    } else {
      $('player-stage').innerHTML = `<video src="${esc(l.videoUrl)}" ${l.poster ? `poster="${esc(l.poster)}"` : ''} controls autoplay playsinline controlslist="nodownload" preload="metadata"></video>`;
      const video = $('player-stage').querySelector('video');
      video.addEventListener('contextmenu', (e) => e.preventDefault());
      video.addEventListener('timeupdate', () => {
        if (video.duration && video.currentTime / video.duration > 0.9) markWatched(l);
      });
      video.addEventListener('ended', () => {
        markWatched(l);
        const next = neighbour(1);
        if (next) $('next-lesson').classList.add('pulse');
      });
    }

    $('player-meta').innerHTML = `<span class="level-chip lv-${l.level.toLowerCase()}">${esc(l.level)}</span> Lesson ${lessonNumber(l)}${l.topic ? ` · ${esc(l.topic)}` : ''}${l.durationSec ? ` · ${fmtDuration(l.durationSec)}` : ''}`;
    $('player-title').textContent = l.title;
    $('player-desc').textContent = l.description || '';
    $('player-desc').hidden = !l.description;
    // YouTube videos can't report progress, so the candidate marks them by hand.
    $('mark-watched').hidden = !signedIn || !l.youtubeId || l.watched;
    $('prev-lesson').disabled = !neighbour(-1);
    $('next-lesson').disabled = !neighbour(1);
    const next = neighbour(1);
    $('next-lesson').innerHTML = next && next.locked ? `${icon('lock')} Sign up for the next lesson` : `Next lesson ${icon('arrow')}`;
    $('next-lesson').classList.remove('pulse');
    renderUpNext();

    const url = new URL(location.href);
    url.searchParams.set('lesson', l.id);
    history.replaceState(null, '', url);
    const player = $('player');
    if (player.hidden) {
      player.hidden = false;
      player.classList.remove('closing');
      document.body.style.overflow = 'hidden';
      hydrateIcons(player);
      setTimeout(() => $('player').querySelector('.player-close').focus(), 50);
    }
  }

  // Locked neighbours are included: opening one sends the visitor to sign up.
  function neighbour(step) {
    const list = byLevel(current.level);
    return list[list.indexOf(current) + step] || null;
  }

  function renderUpNext() {
    const list = byLevel(current.level);
    $('side-title').textContent = `${current.level} · ${LEVEL_INFO[current.level][0]}`;
    $('up-next').innerHTML = list.map((l, i) => `
      <button type="button" class="next-item${l === current ? ' current' : ''}${l.locked ? ' locked' : ''}" data-play-next="${esc(l.id)}">
        <span class="ni-thumb">${l.poster ? `<img src="${esc(l.poster)}" alt="" loading="lazy">` : ''}<span>${l === current ? icon('pulse') : l.locked ? icon('lock') : l.watched ? icon('check') : i + 1}</span></span>
        <span class="ni-text"><strong>${esc(l.title)}</strong><small>${l.durationSec ? fmtDuration(l.durationSec) : ''}${l.topic ? ` · ${esc(l.topic)}` : ''}</small></span>
      </button>`).join('');
    const active = $('up-next').querySelector('.current');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  $('up-next').addEventListener('click', (e) => {
    const b = e.target.closest('[data-play-next]');
    if (b) openPlayer(b.dataset.playNext);
  });
  $('prev-lesson').addEventListener('click', () => { const p = neighbour(-1); if (p) openPlayer(p.id); });
  $('next-lesson').addEventListener('click', () => { const n = neighbour(1); if (n) openPlayer(n.id); });
  $('mark-watched').addEventListener('click', () => markWatched(current));

  const marking = new Set();
  async function markWatched(l) {
    if (!signedIn || l.watched || marking.has(l.id)) return;
    marking.add(l.id);
    try {
      await api(`/api/account/lessons/${encodeURIComponent(l.id)}/watched`, { method: 'POST' });
      l.watched = true;
      $('mark-watched').hidden = true;
      toast(`Lesson complete: ${l.title}`);
      renderUpNext();
      renderTabs();
      render();
      renderStats();
    } catch (err) {
      marking.delete(l.id);
    }
  }

  function closePlayer() {
    const player = $('player');
    if (player.hidden) return;
    player.classList.add('closing');
    stopMedia();
    setTimeout(() => {
      player.hidden = true;
      player.classList.remove('closing');
      document.body.style.overflow = '';
    }, 260);
    const url = new URL(location.href);
    url.searchParams.delete('lesson');
    history.replaceState(null, '', url);
  }
  $('player').addEventListener('click', (e) => { if (e.target.closest('[data-close-player]')) closePlayer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlayer(); });

  load();
})();
