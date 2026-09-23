(function () {
  const API = window.SWARGA_CONFIG.API_URL;
  const $ = (s) => document.querySelector(s);
  let token = null, headers = [], rows = [], current = null, status = '';

  try { token = sessionStorage.getItem('sbb_token'); } catch (e) {}

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const col = (r, name) => (r && r[headers.indexOf(name)]) || '';
  const pad = (n) => String(n).padStart(2, '0');
  // Accepts yyyy-mm-dd or m/d/yyyy (Sheets display format); returns yyyy-mm-dd or ''.
  function isoDate(v) {
    v = String(v || '').trim();
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + '-' + pad(m[1]) + '-' + pad(m[2]);
    return '';
  }
  const todayIso = (() => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); })();
  function niceDate(v) {
    const i = isoDate(v);
    if (!i) return v || '—';
    const [y, mo, d] = i.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function niceTime(v) {
    const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return v || '';
    const h = +m[1];
    return ((h % 12) || 12) + ':' + m[2] + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  let toastTimer;
  function toast(text) {
    const t = $('#msg');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  async function call(action, extra) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, token }, extra || {}))
    }).then(r => r.json());
    if (!res.ok && res.error === 'AUTH') { logout(true); throw new Error('Session expired. Please sign in again.'); }
    if (!res.ok) throw new Error(res.error || 'Request failed.');
    return res;
  }

  function setView(loggedIn) {
    $('#loginView').classList.toggle('hidden', loggedIn);
    $('#listView').classList.toggle('hidden', !loggedIn);
  }

  function logout(silent) {
    if (!silent && token) call('logout').catch(() => {});
    token = null;
    try { sessionStorage.removeItem('sbb_token'); } catch (e) {}
    rows = [];
    $('#rows').innerHTML = '';
    setView(false);
  }

  /* ---------- login ---------- */
  $('#pwToggle').addEventListener('click', () => {
    const p = $('#password');
    const show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('#pwToggle').textContent = show ? 'Hide' : 'Show';
  });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('#loginBtn');
    if (!f.username.value.trim() || !f.password.value) return toast('Enter username and password.');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const res = await call('login', { username: f.username.value.trim(), password: f.password.value });
      token = res.token;
      try { sessionStorage.setItem('sbb_token', token); } catch (e2) {}
      f.reset();
      setView(true);
      await load();
    } catch (err) {
      toast(err.message);
      f.classList.add('shake');
      setTimeout(() => f.classList.remove('shake'), 400);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  /* ---------- dashboard ---------- */
  $('#greetDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function load() {
    $('#count').textContent = 'Loading…';
    $('#rows').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    const res = await call('list');
    headers = res.headers;
    rows = res.rows;
    stats();
    render();
  }

  function stats() {
    let today = 0, house = 0, pending = 0;
    rows.forEach(r => {
      const a = isoDate(col(r, 'Check-in Date')), b = isoDate(col(r, 'Check-out Date'));
      if (a === todayIso) today++;
      if (a && b && a <= todayIso && todayIso <= b) house++;
      if (col(r, 'Status') !== 'Verified') pending++;
    });
    $('#stTotal').textContent = rows.length;
    $('#stToday').textContent = today;
    $('#stHouse').textContent = house;
    $('#stPending').textContent = pending;
  }

  function filtered() {
    const q = $('#search').value.trim().toLowerCase();
    return rows.filter(r => (!status || col(r, 'Status') === status) && (!q || r.join(' ').toLowerCase().includes(q)));
  }

  function render() {
    const list = filtered();
    $('#count').textContent = 'Showing ' + list.length + ' of ' + rows.length;
    $('#empty').classList.toggle('hidden', list.length > 0);
    $('#rows').innerHTML = list.map((r, i) => {
      const st = col(r, 'Status') || 'Pending';
      const a = +col(r, 'Adults') || 0, c = +col(r, 'Children') || 0;
      return '<button type="button" class="gcard" style="animation-delay:' + Math.min(i * 30, 400) + 'ms" data-id="' + esc(col(r, 'Submission ID')) + '">' +
        '<span class="avatar">' + esc(initials(col(r, 'Guest Name'))) + '</span>' +
        '<span class="g-main"><strong>' + esc(col(r, 'Guest Name')) + '</strong><small>' + esc(col(r, 'Submission ID')) + ' · ' + esc(col(r, 'Mobile')) + '</small></span>' +
        '<span class="g-stay"><b>' + esc(niceDate(col(r, 'Check-in Date'))) + '</b> → <b>' + esc(niceDate(col(r, 'Check-out Date'))) + '</b><small>' + a + ' adult' + (a === 1 ? '' : 's') + (c ? ' · ' + c + ' child' + (c === 1 ? '' : 'ren') : '') + '</small></span>' +
        '<span class="badge ' + esc(st) + '">' + esc(st) + '</span>' +
        '</button>';
    }).join('');
  }

  $('#search').addEventListener('input', render);
  $('#statusSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    status = b.dataset.s;
    [...$('#statusSeg').children].forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  $('#refreshBtn').addEventListener('click', () => load().catch(err => toast(err.message)));
  $('#logoutBtn').addEventListener('click', () => logout(false));

  /* ---------- detail drawer ---------- */
  const SECTIONS = [
    ['👤 Guest', ['Guest Name', 'Mobile', 'Email', 'Adults', 'Children', 'Vehicles']],
    ['🆘 Emergency contact', ['Emergency Contact Name', 'Emergency Contact No.']],
    ['🪪 ID', ['ID Type', 'ID Number']],
    ['✅ Acknowledgements', ['Ack House Rules', 'Ack Sea Safety', 'Ack Weather', 'Ack Liability', 'Ack Data Consent', 'Group Booking', 'Lead Guest Name', 'Declaration Name', 'Declaration Agreed', 'Submitted At']]
  ];

  $('#rows').addEventListener('click', (e) => {
    const b = e.target.closest('.gcard');
    if (!b) return;
    current = rows.find(r => col(r, 'Submission ID') === b.dataset.id);
    openDetail();
  });

  function openDetail() {
    const st = col(current, 'Status') || 'Pending';
    $('#dlgRef').textContent = col(current, 'Submission ID');
    $('#dlgTitle').textContent = col(current, 'Guest Name');
    $('#dlgBadge').className = 'badge ' + st;
    $('#dlgBadge').textContent = st;
    $('#dlgStay').innerHTML =
      '<div><small>Check-in</small><strong>' + esc(niceDate(col(current, 'Check-in Date'))) + '</strong><small>' + esc(niceTime(col(current, 'Check-in Time'))) + '</small></div>' +
      '<div class="ticket-sep">🌊</div>' +
      '<div><small>Check-out</small><strong>' + esc(niceDate(col(current, 'Check-out Date'))) + '</strong><small>' + esc(niceTime(col(current, 'Check-out Time'))) + '</small></div>';
    $('#dlgSections').innerHTML = SECTIONS.map(([title, keys]) =>
      '<section class="dsec"><h3>' + title + '</h3><dl>' +
      keys.filter(k => headers.includes(k) && (col(current, k) !== '' || k === 'Email'))
        .map(k => '<dt>' + esc(k.replace(/^Ack /, '')) + '</dt><dd>' + esc(col(current, k) || '—') + '</dd>').join('') +
      '</dl></section>').join('');
    $('#idProof').innerHTML = col(current, 'ID Photo File ID')
      ? '<button type="button" class="chip-btn dark" id="loadPhoto">View ID proof</button>'
      : '<p class="fine">No file uploaded.</p>';
    $('#verifyBlock').innerHTML = st === 'Verified'
      ? '<p>Verified by <strong>' + esc(col(current, 'Rep Name')) + '</strong><br><span class="fine">' + esc(col(current, 'Rep Verified At')) + '</span></p>'
      : '<div class="field"><input id="repName" maxlength="120" placeholder=" "><label for="repName">Representative name</label></div><button type="button" class="btn btn-sea wide" id="verifyBtn">Mark as verified</button>';
    $('#detail').showModal();
  }

  $('#closeDlg').addEventListener('click', () => $('#detail').close());
  $('#detail').addEventListener('click', async (e) => {
    if (e.target === $('#detail')) return $('#detail').close(); // backdrop
    if (e.target.id === 'loadPhoto') {
      e.target.disabled = true;
      e.target.textContent = 'Loading…';
      try {
        const res = await call('photo', { id: col(current, 'Submission ID') });
        const p = res.photo;
        if (!p) { $('#idProof').innerHTML = '<p class="fine">No file uploaded.</p>'; return; }
        const src = 'data:' + p.mime + ';base64,' + p.data;
        $('#idProof').innerHTML = p.mime === 'application/pdf'
          ? '<a class="chip-btn dark" download="' + esc(col(current, 'Submission ID')) + '.pdf" href="' + src + '">⬇ Download ID proof (PDF)</a>'
          : '<img class="idimg" alt="ID proof" src="' + src + '">';
      } catch (err) {
        toast(err.message);
        e.target.disabled = false;
        e.target.textContent = 'View ID proof';
      }
    }
    if (e.target.id === 'verifyBtn') {
      const name = $('#repName').value.trim();
      if (!name) return toast('Enter the representative name.');
      e.target.disabled = true;
      e.target.textContent = 'Saving…';
      try {
        await call('verify', { id: col(current, 'Submission ID'), repName: name });
        $('#detail').close();
        toast('Marked as verified.');
        await load();
      } catch (err) {
        toast(err.message);
        e.target.disabled = false;
        e.target.textContent = 'Mark as verified';
      }
    }
  });

  /* ---------- CSV ---------- */
  $('#csvBtn').addEventListener('click', () => {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = [headers].concat(filtered()).map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'swarga-checkins-' + todayIso + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- init ---------- */
  if (token) { setView(true); load().catch(err => toast(err.message)); } else setView(false);
})();
