(function () {
  'use strict';
  const { api, icon, showFormError, readForm, currentUser } = window.BVT;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // Only same-site paths are allowed as a destination after signing in.
  const nextParam = params.get('next') || '';
  const next = /^\/(?!\/)/.test(nextParam) ? nextParam : '/account';

  currentUser().then((me) => { if (me) location.replace(next); });

  function setMode(mode) {
    $('tabs').dataset.mode = mode;
    $('tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('login-form').hidden = mode !== 'login';
    $('register-form').hidden = mode !== 'register';
    document.title = `${mode === 'login' ? 'Sign in' : 'Create account'} – Belmont Vocational Training`;
    const first = mode === 'login' ? $('l-email') : $('r-first');
    setTimeout(() => first.focus(), 50);
  }
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) {
      setMode(b.dataset.mode);
      history.replaceState(null, '', `?${new URLSearchParams({ ...(b.dataset.mode === 'register' ? { mode: 'register' } : {}), ...(nextParam ? { next: nextParam } : {}) })}`);
    }
  });
  setMode(params.get('mode') === 'register' ? 'register' : 'login');

  document.querySelectorAll('.pw-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'lock' : 'eye');
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  $('r-pass').addEventListener('input', (e) => {
    const v = e.target.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
    $('pw-meter').dataset.score = v ? Math.max(1, score) : 0;
  });

  function markInvalid(form, ids) {
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    ids.forEach((id) => {
      const field = $(id).closest('.field');
      void field.offsetWidth;
      field.classList.add('invalid');
    });
    if (ids[0]) $(ids[0]).focus();
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = [];
    if (!$('l-email').value.trim()) bad.push('l-email');
    if (!$('l-pass').value) bad.push('l-pass');
    markInvalid(e.target, bad);
    if (bad.length) return showFormError($('login-error'), 'Please enter your email and password.');
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await api('/api/auth/login', { method: 'POST', body: { email: $('l-email').value, password: $('l-pass').value } });
      location.href = next;
    } catch (err) {
      btn.disabled = false;
      showFormError($('login-error'), err.message);
    }
  });

  $('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = readForm(e.target);
    const bad = [];
    if (!body.firstName.trim()) bad.push('r-first');
    if (!body.lastName.trim()) bad.push('r-last');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) bad.push('r-email');
    if (body.password.length < 8) bad.push('r-pass');
    markInvalid(e.target, bad);
    const problems = [];
    if (bad.length) problems.push('Please check the highlighted fields.');
    if (!$('r-consent').checked) problems.push('Please accept the privacy notice.');
    if (problems.length) return showFormError($('register-error'), problems.join(' '));

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await api('/api/auth/register', { method: 'POST', body: { ...body, consent: true } });
      location.href = next === '/account' ? '/account?welcome=1#profile' : next;
    } catch (err) {
      btn.disabled = false;
      showFormError($('register-error'), err.message);
    }
  });
})();
