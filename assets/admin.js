(function () {
  const API = window.SWARGA_CONFIG.API_URL;
  const $ = (s) => document.querySelector(s);
  let token = null, headers = [], rows = [], current = null, view = 'all';

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

  /* ---------- stay logic ---------- */
  const stayOf = (r) => col(r, 'Stay Status') || 'Expected';
  const inDate = (r) => isoDate(col(r, 'Check-in Date'));
  const outDate = (r) => isoDate(col(r, 'Check-out Date'));
  const phoneKey = (r) => String(col(r, 'Mobile')).replace(/\D/g, '').slice(-10);
  const nowStamp = () => { const d = new Date(); return todayIso + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  function flag(r) {
    const s = stayOf(r), a = inDate(r), b = outDate(r);
    if (s === 'Expected' && a && a < todayIso) return ['late', 'Late arrival'];
    if (s === 'Expected' && a === todayIso) return ['due', 'Arriving today'];
    if (s === 'Checked in' && b && b < todayIso) return ['late', 'Overdue checkout'];
    if (s === 'Checked in' && b === todayIso) return ['due', 'Departing today'];
    return null;
  }
  const VIEWS = {
    all: () => true,
    arrivals: (r) => stayOf(r) === 'Expected' && inDate(r) && inDate(r) <= todayIso,
    inhouse: (r) => stayOf(r) === 'Checked in',
    departures: (r) => stayOf(r) === 'Checked in' && outDate(r) && outDate(r) <= todayIso,
    checkedout: (r) => stayOf(r) === 'Checked out',
    unverified: (r) => col(r, 'Status') !== 'Verified'
  };
  function stayCount(r) { const k = phoneKey(r); return k ? rows.filter(x => phoneKey(x) === k).length : 1; }

  function stats() {
    $('#stArr').textContent = rows.filter(VIEWS.arrivals).length;
    $('#stHouse').textContent = rows.filter(VIEWS.inhouse).length;
    $('#stDep').textContent = rows.filter(VIEWS.departures).length;
    $('#stPending').textContent = rows.filter(VIEWS.unverified).length;
  }

  function filtered() {
    const q = $('#search').value.trim().toLowerCase();
    const qc = q.replace(/[\s\-+()]/g, '');
    const from = $('#fromDate').value, to = $('#toDate').value;
    const list = rows.filter(r => {
      if (!VIEWS[view](r)) return false;
      if (from && outDate(r) && outDate(r) < from) return false;
      if (to && inDate(r) && inDate(r) > to) return false;
      if (!q) return true;
      const hay = r.join(' ').toLowerCase();
      return hay.includes(q) || (qc.length >= 3 && hay.replace(/[\s\-+()]/g, '').includes(qc));
    });
    if (view === 'arrivals') list.sort((a, b) => inDate(a).localeCompare(inDate(b)));
    if (view === 'departures') list.sort((a, b) => outDate(a).localeCompare(outDate(b)));
    return list;
  }

  function render() {
    const list = filtered();
    $('#count').textContent = 'Showing ' + list.length + ' of ' + rows.length;
    $('#empty').classList.toggle('hidden', list.length > 0);
    $('#rows').innerHTML = list.map((r, i) => {
      const st = stayOf(r), fl = flag(r), n = stayCount(r);
      const a = +col(r, 'Adults') || 0, c = +col(r, 'Children') || 0;
      return '<button type="button" class="gcard" style="animation-delay:' + Math.min(i * 30, 400) + 'ms" data-id="' + esc(col(r, 'Submission ID')) + '">' +
        '<span class="avatar">' + esc(initials(col(r, 'Guest Name'))) + '</span>' +
        '<span class="g-main"><strong>' + esc(col(r, 'Guest Name')) + (n > 1 ? ' <em class="ret">↺ ' + n + ' stays</em>' : '') + '</strong><small>' + esc(col(r, 'Submission ID')) + ' · ' + esc(col(r, 'Mobile')) + '</small></span>' +
        '<span class="g-stay"><b>' + esc(niceDate(col(r, 'Check-in Date'))) + '</b> → <b>' + esc(niceDate(col(r, 'Check-out Date'))) + '</b><small>' + a + ' adult' + (a === 1 ? '' : 's') + (c ? ' · ' + c + ' child' + (c === 1 ? '' : 'ren') : '') + (+col(r, 'Vehicles') ? ' · 🚗 ' + esc(col(r, 'Vehicle Numbers') || col(r, 'Vehicles') + ' (no number)') : '') + '</small></span>' +
        '<span class="g-badges"><span class="badge st-' + st.replace(/\s/g, '') + '">' + esc(st) + '</span>' +
        (fl ? '<span class="flag ' + fl[0] + '">' + fl[1] + '</span>' : '') +
        (col(r, 'Status') !== 'Verified' ? '<span class="flag muted">Unverified</span>' : '') + '</span>' +
        '</button>';
    }).join('');
  }

  function setViewTab(v) {
    view = v;
    [...$('#viewTabs').children].forEach(x => x.classList.toggle('on', x.dataset.view === v));
    render();
  }
  $('#search').addEventListener('input', render);
  $('#viewTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setViewTab(b.dataset.view); });
  document.querySelectorAll('.stats .stat').forEach(b => b.addEventListener('click', () => { setViewTab(b.dataset.view); $('#viewTabs').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  ['fromDate', 'toDate'].forEach(id => $('#' + id).addEventListener('change', render));
  $('#clearFilters').addEventListener('click', () => { $('#search').value = ''; $('#fromDate').value = ''; $('#toDate').value = ''; setViewTab('all'); });
  $('#refreshBtn').addEventListener('click', () => load().catch(err => toast(err.message)));
  $('#logoutBtn').addEventListener('click', () => logout(false));

  /* ---------- detail drawer ---------- */
  const SECTIONS = [
    ['👤 Guest', ['Guest Name', 'Mobile', 'Email', 'Adults', 'Children']],
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
    renderStay();
    renderHistory();
    renderVehicles(false);
    $('#idProof').innerHTML = col(current, 'ID Photo File ID')
      ? '<button type="button" class="chip-btn dark" id="loadPhoto">View ID proof</button>'
      : '<p class="fine">No file uploaded.</p>';
    $('#verifyBlock').innerHTML = st === 'Verified'
      ? '<p>Verified by <strong>' + esc(col(current, 'Rep Name')) + '</strong><br><span class="fine">' + esc(col(current, 'Rep Verified At')) + '</span></p>'
      : '<div class="field"><input id="repName" maxlength="120" placeholder=" "><label for="repName">Representative name</label></div><button type="button" class="btn btn-sea wide" id="verifyBtn">Mark as verified</button>';
    if (!$('#detail').open) $('#detail').showModal();
    $('.drawer-body').scrollTop = 0;
  }

  /* ---------- stay actions ---------- */
  let staffName = '';
  try { staffName = sessionStorage.getItem('sbb_staff') || ''; } catch (e) {}
  function renderStay() {
    const st = stayOf(current), fl = flag(current);
    const line = (label, at, by) => at ? '<dt>' + label + '</dt><dd>' + esc(at) + (by ? ' · ' + esc(by) : '') + '</dd>' : '';
    let html = '<div class="stay-status"><span class="badge st-' + st.replace(/\s/g, '') + '">' + esc(st) + '</span>' +
      (fl ? '<span class="flag ' + fl[0] + '">' + fl[1] + '</span>' : '') + '</div>' +
      '<dl>' + line('Checked in', col(current, 'Actual Check-in'), col(current, 'Checked-in By')) +
      line('Checked out', col(current, 'Actual Check-out'), col(current, 'Checked-out By')) + '</dl>';
    if (st !== 'Checked out') {
      html += '<div class="field"><input id="staffName" maxlength="80" placeholder=" " value="' + esc(staffName) + '"><label for="staffName">Staff name</label></div>' +
        '<button type="button" class="btn ' + (st === 'Expected' ? 'btn-sun' : 'btn-sea') + ' wide" data-move="' + (st === 'Expected' ? 'in' : 'out') + '">' +
        (st === 'Expected' ? '🔑 Check in now' : '👋 Check out now') + '</button>';
    }
    if (st !== 'Expected') html += '<button type="button" class="link-btn undo" data-move="undo">Undo ' + (st === 'Checked out' ? 'check-out' : 'check-in') + '</button>';
    $('#stayBlock').innerHTML = html;
  }
  function renderHistory() {
    const k = phoneKey(current);
    const others = k ? rows.filter(r => r !== current && phoneKey(r) === k) : [];
    $('#historySec').classList.toggle('hidden', !others.length);
    $('#historyBlock').innerHTML = '<p class="fine">Same mobile number · ' + (others.length + 1) + ' stays in total</p>' +
      others.map(r => '<button type="button" class="hist" data-id="' + esc(col(r, 'Submission ID')) + '"><b>' + esc(niceDate(col(r, 'Check-in Date'))) + ' → ' + esc(niceDate(col(r, 'Check-out Date'))) + '</b><small>' + esc(col(r, 'Submission ID')) + ' · ' + esc(stayOf(r)) + '</small></button>').join('');
  }
  async function doMove(btn) {
    const move = btn.dataset.move;
    const input = $('#staffName');
    const staff = input ? input.value.trim() : staffName;
    if (move !== 'undo' && !staff) { toast('Enter the staff name.'); if (input) input.focus(); return; }
    if (staff) { staffName = staff; try { sessionStorage.setItem('sbb_staff', staff); } catch (e) {} }
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Saving…';
    try {
      await call('stay', { id: col(current, 'Submission ID'), move, staff });
      const set = (k, v) => { let i = headers.indexOf(k); if (i === -1) { headers.push(k); rows.forEach(r => r.push('')); i = headers.length - 1; } current[i] = v; };
      const st = stayOf(current);
      if (move === 'in') { set('Stay Status', 'Checked in'); set('Actual Check-in', nowStamp()); set('Checked-in By', staff); }
      if (move === 'out') { set('Stay Status', 'Checked out'); set('Actual Check-out', nowStamp()); set('Checked-out By', staff); }
      if (move === 'undo' && st === 'Checked out') { set('Stay Status', 'Checked in'); set('Actual Check-out', ''); set('Checked-out By', ''); }
      if (move === 'undo' && st === 'Checked in') { set('Stay Status', 'Expected'); set('Actual Check-in', ''); set('Checked-in By', ''); }
      renderStay(); stats(); render();
      toast(move === 'in' ? 'Checked in. Welcome them to Swarga!' : move === 'out' ? 'Checked out.' : 'Undone.');
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  /* ---------- vehicles (view / edit) ---------- */
  function renderVehicles(editing) {
    const n = +col(current, 'Vehicles') || 0;
    const nums = String(col(current, 'Vehicle Numbers') || '').split(',').map(x => x.trim()).filter(Boolean);
    $('#vehEdit').classList.toggle('hidden', editing);
    if (!editing) {
      $('#vehBlock').innerHTML = !n && !nums.length
        ? '<p class="fine">No vehicle declared.</p>'
        : '<dl><dt>Vehicles</dt><dd>' + n + '</dd><dt>Numbers</dt><dd>' +
          (nums.length ? nums.map(x => '<span class="plate-tag">' + esc(x) + '</span>').join(' ') : '<span class="missing">Not given — add it</span>') +
          '</dd></dl>';
      return;
    }
    const rowsN = Math.max(n, nums.length, 1);
    $('#vehBlock').innerHTML =
      '<div class="veh-count"><span>Number of vehicles</span><div class="stepper" id="vehStep"><button type="button" data-d="-1">−</button><output>' + rowsN + '</output><button type="button" data-d="1">+</button></div></div>' +
      '<div id="vehInputs"></div>' +
      '<div class="veh-actions"><button type="button" class="chip-btn dark" id="vehCancel">Cancel</button><button type="button" class="btn btn-sea" id="vehSave">Save vehicles</button></div>';
    drawVehInputs(rowsN, nums);
  }
  function drawVehInputs(n, vals) {
    const keep = vals || [...document.querySelectorAll('#vehInputs input')].map(i => i.value);
    $('#vehInputs').innerHTML = Array.from({ length: n }, (_, i) =>
      '<div class="field"><input class="plate" id="vp' + i + '" maxlength="15" placeholder=" " value="' + esc(keep[i] || '') + '"><label for="vp' + i + '">Vehicle ' + (i + 1) + ' number</label></div>').join('');
    $('#vehStep output').textContent = n;
  }
  $('#vehEdit').addEventListener('click', () => renderVehicles(true));

  $('#closeDlg').addEventListener('click', () => $('#detail').close());
  $('#detail').addEventListener('click', async (e) => {
    if (e.target === $('#detail')) return $('#detail').close(); // backdrop
    const mv = e.target.closest('[data-move]');
    if (mv) return doMove(mv);
    const h = e.target.closest('.hist');
    if (h) { current = rows.find(r => col(r, 'Submission ID') === h.dataset.id); return openDetail(); }
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
    const vs = e.target.closest('#vehStep button');
    if (vs) {
      const n = Math.min(20, Math.max(0, +$('#vehStep output').textContent + +vs.dataset.d));
      return drawVehInputs(n);
    }
    if (e.target.id === 'vehCancel') return renderVehicles(false);
    if (e.target.id === 'vehSave') {
      const count = +$('#vehStep output').textContent;
      const numbers = [...document.querySelectorAll('#vehInputs input')].map(i => i.value.trim().toUpperCase()).filter(Boolean);
      e.target.disabled = true;
      e.target.textContent = 'Saving…';
      try {
        await call('vehicles', { id: col(current, 'Submission ID'), count, numbers });
        current[headers.indexOf('Vehicles')] = String(count);
        const vi = headers.indexOf('Vehicle Numbers');
        if (vi === -1) { headers.push('Vehicle Numbers'); rows.forEach(r => r.push('')); }
        current[headers.indexOf('Vehicle Numbers')] = numbers.join(', ');
        renderVehicles(false);
        render();
        toast('Vehicle details saved.');
      } catch (err) {
        toast(err.message);
        e.target.disabled = false;
        e.target.textContent = 'Save vehicles';
      }
      return;
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
