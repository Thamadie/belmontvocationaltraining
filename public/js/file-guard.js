// Opened by double-clicking the file instead of through the server: nothing can load.
if (location.protocol === 'file:') document.addEventListener('DOMContentLoaded', function () {
  document.body.innerHTML = '<div style="font:16px/1.6 system-ui,sans-serif;max-width:620px;margin:12vh auto;padding:32px;border-radius:18px;background:#0d0d0d;color:#fff">' +
    '<div style="height:6px;border-radius:6px;margin-bottom:24px;background:linear-gradient(90deg,#444 33%,#dd0000 33% 66%,#ffce00 66%)"></div>' +
    '<h1 style="margin:0 0 12px;font-size:26px">Start the server to use Belmont Vocational Training</h1>' +
    '<p style="color:#ccc">This page was opened straight from your computer’s files, so programmes, accounts and the admin panel can’t work.</p>' +
    '<ol style="color:#ccc;padding-left:20px"><li>Open a terminal in the <b style="color:#fff">Belmont Vocational Training</b> folder.</li>' +
    '<li>Run <code style="background:#333;padding:2px 6px;border-radius:6px;color:#ffce00">npm install</code> (first time only), then <code style="background:#333;padding:2px 6px;border-radius:6px;color:#ffce00">npm start</code>.</li>' +
    '<li>Open <b style="color:#ffce00">http://localhost:3000</b> in your browser.</li></ol></div>';
});
