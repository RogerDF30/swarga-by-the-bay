(function () {
  const API = window.SWARGA_CONFIG.API_URL;
  const $ = (s) => document.querySelector(s);
  let token = null, headers = [], rows = [], current = null, view = 'all';
  let db = { bookings: [], rooms: [], payments: [], options: { statuses: [], sources: [], modes: [] }, today: '' };

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
    const res = await call('data');
    headers = res.log.headers;
    rows = res.log.rows;
    db = res;
    stats();
    render();
    renderBookings();
    renderRoomsSec();
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

  function stats() { overallStats(); }

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
    const bk = col(current, 'Booking ID');
    const bObj = bk && db.bookings.find(b => b['Booking ID'] === bk);
    $('#bookingLinkSec').classList.toggle('hidden', !bk);
    $('#bookingLinkBlock').innerHTML = bk ? (bObj
      ? '<button type="button" class="hist" data-open-booking="' + esc(bk) + '"><b>' + esc(bk) + ' · ' + esc(bObj.Status) + '</b><small>' + esc(roomNames(bObj['Room IDs']) || 'No room') + ' · ' + esc(bObj['Payment Status']) + '</small></button>'
      : '<p class="fine">' + esc(bk) + ' (booking not found)</p>') : '';
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
      quietReload();
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
    const ob = e.target.closest('[data-open-booking]');
    if (ob) { $('#detail').close(); return openBooking(ob.dataset.openBooking); }
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

  /* =====================================================================
     BOOKINGS · ROOMS · PAYMENTS
     ===================================================================== */
  const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const num = (v) => { const n = Number(String(v || '0').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const BLOCK = ['Confirmed', 'Checked in'];
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); };
  const nightsBetween = (a, b) => (a && b) ? Math.round((Date.parse(b) - Date.parse(a)) / 864e5) : 0;
  const bIn = (b) => isoDate(b['Check-in Date']), bOut = (b) => isoDate(b['Check-out Date']);
  const roomById = (id) => db.rooms.find(r => r['Room ID'] === id);
  const roomIds = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  function roomNames(v) { return roomIds(v).map(id => (roomById(id) || {}).Name || id).join(', '); }
  const balanceOf = (b) => num(b.Total) - num(b.Paid);
  const today = () => db.today || todayIso;
  const slug = (s) => String(s || '').replace(/[^A-Za-z]/g, '');

  async function quietReload() {
    try {
      const res = await call('data');
      headers = res.log.headers; rows = res.log.rows; db = res;
      if (current) current = rows.find(r => col(r, 'Submission ID') === col(current, 'Submission ID')) || current;
      stats(); render(); renderBookings(); renderRoomsSec();
      if (openBookingId && $('#panel').open && panelMode === 'booking') openBooking(openBookingId, true);
    } catch (e) { toast(e.message); }
  }

  function overallStats() {
    const t = today();
    $('#stReq').textContent = db.bookings.filter(b => b.Status === 'Requested').length;
    $('#stArr').textContent = db.bookings.filter(BVIEWS.arrivals).length;
    $('#stHouse').textContent = db.bookings.filter(b => b.Status === 'Checked in').length;
    $('#stDep').textContent = db.bookings.filter(BVIEWS.departures).length;
    $('#stDue').textContent = inr(db.bookings.filter(BVIEWS.due).reduce((s, b) => s + balanceOf(b), 0));
  }

  /* ---------- section navigation ---------- */
  let section = 'bookings';
  function showSection(sec) {
    section = sec;
    document.querySelectorAll('#secNav button').forEach(b => b.classList.toggle('on', b.dataset.sec === sec));
    ['bookings', 'log', 'rooms'].forEach(k => $('#sec-' + k).classList.toggle('hidden', k !== sec));
  }
  $('#secNav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showSection(b.dataset.sec); });
  document.querySelectorAll('.stats .stat').forEach(b => b.addEventListener('click', () => {
    const [sec, v] = b.dataset.go.split(':');
    showSection(sec); setBView(v);
    $('#bTabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  /* ---------- bookings list ---------- */
  let bview = 'upcoming';
  const BVIEWS = {
    requests: b => b.Status === 'Requested',
    arrivals: b => b.Status === 'Confirmed' && bIn(b) && bIn(b) <= today(),
    inhouse: b => b.Status === 'Checked in',
    departures: b => b.Status === 'Checked in' && bOut(b) && bOut(b) <= today(),
    upcoming: b => ['Requested', 'Confirmed', 'Checked in'].indexOf(b.Status) > -1,
    due: b => ['Cancelled', 'No-show'].indexOf(b.Status) === -1 && balanceOf(b) > 0.5,
    past: b => b.Status === 'Checked out',
    cancelled: b => b.Status === 'Cancelled' || b.Status === 'No-show',
    all: () => true
  };
  function bflag(b) {
    const t = today();
    if (b.Status === 'Requested') return ['due', 'Needs reply'];
    if (b.Status === 'Confirmed' && bIn(b) < t) return ['late', 'Late arrival'];
    if (b.Status === 'Confirmed' && bIn(b) === t) return ['due', 'Arriving today'];
    if (b.Status === 'Checked in' && bOut(b) < t) return ['late', 'Overdue checkout'];
    if (b.Status === 'Checked in' && bOut(b) === t) return ['due', 'Departing today'];
    return null;
  }
  function setBView(v) {
    bview = v;
    document.querySelectorAll('#bTabs button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
    renderBookings();
  }
  function filteredBookings() {
    const q = $('#bSearch').value.trim().toLowerCase(), qc = q.replace(/[\s\-+()]/g, '');
    const from = $('#bFrom').value, to = $('#bTo').value;
    const list = db.bookings.filter(b => {
      if (!BVIEWS[bview](b)) return false;
      if (from && bOut(b) && bOut(b) < from) return false;
      if (to && bIn(b) && bIn(b) > to) return false;
      if (!q) return true;
      const hay = (Object.values(b).join(' ') + ' ' + roomNames(b['Room IDs'])).toLowerCase();
      return hay.includes(q) || (qc.length >= 3 && hay.replace(/[\s\-+()]/g, '').includes(qc));
    });
    if (['requests', 'arrivals', 'upcoming', 'inhouse'].indexOf(bview) > -1) list.sort((a, b) => bIn(a).localeCompare(bIn(b)));
    if (bview === 'departures') list.sort((a, b) => bOut(a).localeCompare(bOut(b)));
    if (bview === 'past') list.sort((a, b) => bOut(b).localeCompare(bOut(a)));
    return list;
  }
  function renderBookings() {
    const list = filteredBookings();
    $('#bCount').textContent = 'Showing ' + list.length + ' of ' + db.bookings.length + ' bookings';
    $('#bEmpty').classList.toggle('hidden', list.length > 0);
    $('#bRows').innerHTML = list.map((b, i) => {
      const fl = bflag(b), bal = balanceOf(b), n = num(b.Nights);
      return '<button type="button" class="gcard" style="animation-delay:' + Math.min(i * 30, 400) + 'ms" data-bid="' + esc(b['Booking ID']) + '">' +
        '<span class="avatar">' + esc(initials(b['Guest Name'])) + '</span>' +
        '<span class="g-main"><strong>' + esc(b['Guest Name']) + ' <em class="src">' + esc(b.Source) + '</em></strong><small>' + esc(b['Booking ID']) + ' · ' + esc(b.Mobile) + '</small></span>' +
        '<span class="g-stay"><b>' + esc(niceDate(b['Check-in Date'])) + '</b> → <b>' + esc(niceDate(b['Check-out Date'])) + '</b><small>' + n + (n === 1 ? ' night' : ' nights') + ' · ' + esc(roomNames(b['Room IDs']) || 'Room not assigned') + ' · ' + inr(b.Total) + '</small></span>' +
        '<span class="g-badges"><span class="badge st-' + slug(b.Status) + '">' + esc(b.Status) + '</span>' +
        '<span class="badge pay-' + slug(b['Payment Status']) + '">' + esc(b['Payment Status'] || 'Unpaid') + (bal > 0.5 && b['Payment Status'] !== 'Unpaid' ? ' · ' + inr(bal) + ' due' : '') + '</span>' +
        (fl ? '<span class="flag ' + fl[0] + '">' + fl[1] + '</span>' : '') + '</span></button>';
    }).join('');
  }
  $('#bSearch').addEventListener('input', renderBookings);
  $('#bTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setBView(b.dataset.v); });
  ['bFrom', 'bTo'].forEach(id => $('#' + id).addEventListener('change', renderBookings));
  $('#bClear').addEventListener('click', () => { $('#bSearch').value = ''; $('#bFrom').value = ''; $('#bTo').value = ''; setBView('upcoming'); });
  $('#bRows').addEventListener('click', e => { const c = e.target.closest('[data-bid]'); if (c) openBooking(c.dataset.bid); });
  $('#bCsv').addEventListener('click', () => {
    const H = Object.keys(db.bookings[0] || { 'Booking ID': '' });
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [H.concat(['Room Names', 'Balance'])].concat(filteredBookings().map(b => H.map(h => b[h]).concat([roomNames(b['Room IDs']), balanceOf(b)]))).map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'swarga-bookings-' + todayIso + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- panel helpers ---------- */
  let panelMode = '', openBookingId = '';
  function openPanel(mode, ref, title, badges, body) {
    panelMode = mode;
    $('#pRef').textContent = ref || '';
    $('#pTitle').textContent = title || '';
    $('#pBadges').innerHTML = badges || '';
    $('#pBody').innerHTML = body;
    if (!$('#panel').open) $('#panel').showModal();
  }
  $('#pClose').addEventListener('click', () => $('#panel').close());
  $('#panel').addEventListener('click', e => { if (e.target === $('#panel')) $('#panel').close(); });
  $('#panel').addEventListener('close', () => { openBookingId = ''; panelMode = ''; });
  const opts = (list, sel) => list.map(o => '<option' + (o === sel ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
  const staffField = () => '<div class="field"><input id="pStaff" maxlength="80" placeholder=" " value="' + esc(staffName) + '"><label for="pStaff">Staff name</label></div>';
  function takeStaff() {
    const v = ($('#pStaff') || {}).value;
    const s = String(v == null ? staffName : v).trim();
    if (!s) { toast('Enter the staff name.'); if ($('#pStaff')) $('#pStaff').focus(); return null; }
    staffName = s; try { sessionStorage.setItem('sbb_staff', s); } catch (e) {}
    return s;
  }
  async function busy(btn, fn) {
    const label = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
    try { await fn(); } catch (err) { toast(err.message); } finally { btn.disabled = false; btn.textContent = label; }
  }

  /* ---------- booking detail ---------- */
  const ACTIONS = {
    'Requested': [['Confirmed', '✓ Confirm booking', 'btn-sun'], ['Cancelled', 'Decline / cancel', 'danger']],
    'Confirmed': [['Checked in', '🔑 Check in', 'btn-sun'], ['No-show', 'Mark no-show', 'ghost'], ['Cancelled', 'Cancel booking', 'danger'], ['Requested', 'Move back to request', 'ghost']],
    'Checked in': [['Checked out', '👋 Check out', 'btn-sea'], ['Confirmed', 'Undo check-in', 'ghost']],
    'Checked out': [['Checked in', 'Undo check-out', 'ghost']],
    'Cancelled': [['Confirmed', 'Reinstate as confirmed', 'btn-sea'], ['Requested', 'Reopen as request', 'ghost']],
    'No-show': [['Confirmed', 'Reinstate as confirmed', 'btn-sea'], ['Cancelled', 'Cancel booking', 'danger']]
  };
  function openBooking(id, keepScroll) {
    const b = db.bookings.find(x => x['Booking ID'] === id);
    if (!b) return toast('Booking not found.');
    openBookingId = id;
    const pays = db.payments.filter(p => p['Booking ID'] === id);
    const bal = balanceOf(b), fl = bflag(b);
    const link = location.origin + location.pathname.replace(/admin(\.html)?$/, '') + '?b=' + encodeURIComponent(id);
    const phone = String(b.Mobile || '').replace(/\D/g, '');
    const wa = 'https://wa.me/' + (phone.length === 10 ? '91' + phone : phone) + '?text=' + encodeURIComponent(
      'Hello ' + (b['Guest Name'] || '').split(/\s+/)[0] + ', your stay at Swarga by the Bay (' + niceDate(b['Check-in Date']) + ' → ' + niceDate(b['Check-out Date']) + ') is ' + (b.Status === 'Requested' ? 'received' : 'confirmed') +
      '. Booking ref ' + id + '. Please complete your guest check-in before arrival: ' + link);
    const logRow = b['Check-in Ref'] && rows.find(r => col(r, 'Submission ID') === b['Check-in Ref']);

    const actions = (ACTIONS[b.Status] || []).map(a =>
      '<button type="button" class="' + (a[2] === 'danger' ? 'chip-btn danger' : a[2] === 'ghost' ? 'chip-btn dark' : 'btn ' + a[2]) + '" data-status="' + esc(a[0]) + '">' + esc(a[1]) + '</button>').join('');
    const body =
      '<div class="ticket"><div><small>Check-in</small><strong>' + esc(niceDate(b['Check-in Date'])) + '</strong><small>' + esc(niceTime(window.SWARGA_CONFIG.CHECKIN_TIME || '13:00')) + '</small></div><div class="ticket-sep">🌊</div>' +
      '<div><small>Check-out</small><strong>' + esc(niceDate(b['Check-out Date'])) + '</strong><small>' + esc(niceTime(window.SWARGA_CONFIG.CHECKOUT_TIME || '11:00')) + '</small></div></div>' +

      '<section class="dsec"><div class="dsec-head"><h3>⚡ Actions</h3>' + (fl ? '<span class="flag ' + fl[0] + '">' + fl[1] + '</span>' : '') + '</div>' +
      staffField() + '<div class="act-row">' + actions + '</div>' +
      '<div id="reasonBox" class="hidden"><div class="field"><input id="pReason" maxlength="200" placeholder=" "><label for="pReason">Reason</label></div>' +
      '<div class="act-row"><button type="button" class="chip-btn dark" id="reasonCancel">Back</button><button type="button" class="btn btn-sea" id="reasonGo">Confirm</button></div></div>' +
      (b['Cancel Reason'] && (b.Status === 'Cancelled' || b.Status === 'No-show') ? '<p class="fine">Reason: ' + esc(b['Cancel Reason']) + '</p>' : '') + '</section>' +

      '<section class="dsec"><h3>💳 Payments</h3>' +
      '<div class="pay-sum"><div><small>Total</small><strong>' + inr(b.Total) + '</strong></div><div><small>Paid</small><strong>' + inr(b.Paid) + '</strong></div><div class="' + (bal > 0.5 ? 'owe' : 'clear') + '"><small>Balance</small><strong>' + inr(Math.max(bal, 0)) + '</strong></div></div>' +
      (pays.length ? '<div class="pay-list">' + pays.map(p => '<div class="pay-row"><span><b>' + inr(Math.abs(num(p.Amount))) + '</b> ' + esc(p.Kind) + ' · ' + esc(p.Mode) + (p.Reference ? ' · ' + esc(p.Reference) : '') + '</span><small>' + esc(p['Recorded At']) + ' · ' + esc(p['Recorded By']) + '</small></div>').join('') + '</div>' : '<p class="fine">No payments recorded yet.</p>') +
      '<div class="pay-form"><div class="field"><input id="payAmt" inputmode="decimal" placeholder=" " value="' + (bal > 0.5 ? Math.round(bal) : '') + '"><label for="payAmt">Amount (₹)</label></div>' +
      '<select id="payMode" class="sel">' + opts(db.options.modes, 'UPI') + '</select>' +
      '<div class="field"><input id="payRef" maxlength="80" placeholder=" "><label for="payRef">Reference / UTR (optional)</label></div></div>' +
      '<div class="act-row"><button type="button" class="btn btn-sea" id="payAdd">Record payment</button>' +
      (bal > 0.5 ? '<button type="button" class="btn btn-sun" id="payFull">Mark as paid (' + inr(bal) + ')</button>' : '') +
      '<button type="button" class="chip-btn dark" id="payRefund">Record refund</button></div></section>' +

      '<section class="dsec"><h3>📝 Guest check-in form</h3>' +
      (b['Check-in Ref']
        ? '<button type="button" class="hist" data-open-log="' + esc(b['Check-in Ref']) + '"><b>Received · ' + esc(b['Check-in Ref']) + '</b><small>' + (logRow ? esc(col(logRow, 'Status')) + ' ID · ' + esc(col(logRow, 'Stay Status') || 'Expected') : 'Open in guest log') + '</small></button>'
        : '<p class="fine">Not received yet. Send the guest their check-in link:</p>') +
      '<div class="act-row"><a class="chip-btn dark" target="_blank" rel="noopener" href="' + esc(wa) + '">💬 WhatsApp link</a><button type="button" class="chip-btn dark" id="copyLink" data-link="' + esc(link) + '">🔗 Copy link</button></div></section>' +

      '<section class="dsec"><div class="dsec-head"><h3>🛏️ Booking details</h3><button type="button" class="link-btn" id="editBooking">Edit</button></div><dl>' +
      '<dt>Mobile</dt><dd><a href="tel:' + esc(phone) + '">' + esc(b.Mobile) + '</a></dd>' +
      (b.Email ? '<dt>Email</dt><dd>' + esc(b.Email) + '</dd>' : '') +
      '<dt>Guests</dt><dd>' + esc(b.Adults) + ' adults' + (num(b.Children) ? ', ' + esc(b.Children) + ' children' : '') + '</dd>' +
      '<dt>Rooms</dt><dd>' + esc(roomNames(b['Room IDs']) || 'Not assigned') + '</dd>' +
      '<dt>Nights</dt><dd>' + esc(b.Nights) + '</dd>' +
      '<dt>Charges</dt><dd>' + inr(b['Room Charges']) + (num(b.Discount) ? ' − ' + inr(b.Discount) + ' discount' : '') + '</dd>' +
      '<dt>Source</dt><dd>' + esc(b.Source) + '</dd>' +
      (b['Special Requests'] ? '<dt>Requests</dt><dd>' + esc(b['Special Requests']) + '</dd>' : '') +
      (b['Internal Notes'] ? '<dt>Notes</dt><dd>' + esc(b['Internal Notes']) + '</dd>' : '') +
      '<dt>Created</dt><dd>' + esc(b['Created At']) + '</dd>' +
      '<dt>Updated</dt><dd>' + esc(b['Updated At']) + (b['Updated By'] ? ' · ' + esc(b['Updated By']) : '') + '</dd></dl></section>';

    const scroll = keepScroll ? $('#pBody').scrollTop : 0;
    openPanel('booking', id, b['Guest Name'],
      '<span class="badge st-' + slug(b.Status) + '">' + esc(b.Status) + '</span> <span class="badge pay-' + slug(b['Payment Status']) + '">' + esc(b['Payment Status'] || 'Unpaid') + '</span>', body);
    $('#pBody').scrollTop = scroll;
  }

  let pendingStatus = '';
  $('#pBody').addEventListener('click', async e => {
    const t = e.target;
    if (panelMode === 'booking') {
      const b = db.bookings.find(x => x['Booking ID'] === openBookingId);
      const st = t.closest('[data-status]');
      if (st) {
        const to = st.dataset.status;
        if (to === 'Cancelled' || to === 'No-show') {
          pendingStatus = to;
          $('#reasonBox').classList.remove('hidden');
          $('#pReason').focus();
          return;
        }
        const staff = takeStaff(); if (!staff) return;
        if (to === 'Checked in' && !b['Check-in Ref']) toast('Note: guest check-in form not received yet.');
        return busy(st, async () => { await call('bookingStatus', { id: openBookingId, status: to, staff }); toast('Booking ' + to.toLowerCase() + '.'); await quietReload(); });
      }
      if (t.id === 'reasonCancel') { $('#reasonBox').classList.add('hidden'); return; }
      if (t.id === 'reasonGo') {
        const staff = takeStaff(); if (!staff) return;
        const reason = $('#pReason').value.trim();
        if (!reason) return toast('Please give a reason.');
        return busy(t, async () => { await call('bookingStatus', { id: openBookingId, status: pendingStatus, reason, staff }); toast('Booking marked ' + pendingStatus.toLowerCase() + '.'); await quietReload(); });
      }
      if (t.id === 'payAdd' || t.id === 'payRefund' || t.id === 'payFull') {
        const staff = takeStaff(); if (!staff) return;
        const mode = $('#payMode').value, reference = $('#payRef').value.trim();
        if (t.id === 'payFull') return busy(t, async () => { await call('markPaid', { data: { bookingId: openBookingId, mode, reference }, staff }); toast('Marked as paid.'); await quietReload(); });
        const amount = num($('#payAmt').value);
        if (!(amount > 0)) return toast('Enter an amount.');
        const kind = t.id === 'payRefund' ? 'Refund' : 'Payment';
        return busy(t, async () => { await call('addPayment', { data: { bookingId: openBookingId, amount, mode, reference, kind }, staff }); toast(kind + ' of ' + inr(amount) + ' recorded.'); await quietReload(); });
      }
      if (t.id === 'copyLink') {
        try { await navigator.clipboard.writeText(t.dataset.link); toast('Check-in link copied.'); }
        catch (err) { window.prompt('Copy this link', t.dataset.link); }
        return;
      }
      if (t.id === 'editBooking') return bookingForm(b);
      const lg = t.closest('[data-open-log]');
      if (lg) {
        const r = rows.find(x => col(x, 'Submission ID') === lg.dataset.openLog);
        if (!r) return toast('Check-in record not found.');
        $('#panel').close(); current = r; showSection('log'); return openDetail();
      }
    }
    if (panelMode === 'bookingForm') {
      if (t.id === 'bfCancel') return openBookingId ? openBooking(openBookingId) : $('#panel').close();
      if (t.closest('.room-chk')) return setTimeout(bfRecalc, 0);
      if (t.id === 'bfSave') return saveBookingForm(t);
    }
    if (panelMode === 'roomForm') {
      if (t.id === 'rfCancel') return $('#panel').close();
      if (t.id === 'rfSave') return saveRoomForm(t);
    }
  });
  $('#pBody').addEventListener('input', e => { if (panelMode === 'bookingForm' && /^bf/.test(e.target.id)) bfRecalc(e.target.id); });
  $('#pBody').addEventListener('change', e => { if (panelMode === 'bookingForm' && /^bf(In|Out)$/.test(e.target.id)) bfRecalc(e.target.id); });

  /* ---------- booking form (new / edit) ---------- */
  let chargesTouched = false;
  function bookingForm(b) {
    b = b || {};
    const isNew = !b['Booking ID'];
    openBookingId = b['Booking ID'] || '';
    chargesTouched = !isNew && num(b['Room Charges']) > 0;
    const inD = bIn(b) || today(), outD = bOut(b) || addDays(inD, 1);
    const picked = roomIds(b['Room IDs']);
    const statuses = isNew ? ['Confirmed', 'Requested'] : [b.Status];
    const body =
      '<div class="form-grid">' +
      '<div class="field full"><input id="bfName" maxlength="120" placeholder=" " value="' + esc(b['Guest Name'] || '') + '"><label for="bfName">Guest name</label></div>' +
      '<div class="field"><input id="bfMobile" type="tel" inputmode="tel" placeholder=" " value="' + esc(b.Mobile || '') + '"><label for="bfMobile">Mobile</label></div>' +
      '<div class="field"><input id="bfEmail" type="email" placeholder=" " value="' + esc(b.Email || '') + '"><label for="bfEmail">Email (optional)</label></div>' +
      '<label class="lbl">Check-in<input id="bfIn" type="date" class="sel" value="' + inD + '"></label>' +
      '<label class="lbl">Check-out<input id="bfOut" type="date" class="sel" value="' + outD + '"></label>' +
      '<label class="lbl">Adults<input id="bfAdults" type="number" min="1" max="30" class="sel" value="' + esc(b.Adults || 2) + '"></label>' +
      '<label class="lbl">Children<input id="bfChildren" type="number" min="0" max="30" class="sel" value="' + esc(b.Children || 0) + '"></label>' +
      '<label class="lbl">Source<select id="bfSource" class="sel">' + opts(db.options.sources, b.Source || 'Phone') + '</select></label>' +
      '<label class="lbl">Status<select id="bfStatus" class="sel"' + (isNew ? '' : ' disabled') + '>' + opts(statuses, statuses[0]) + '</select></label>' +
      '</div>' +
      '<h3 class="mini">Rooms <small id="bfNights"></small></h3>' +
      (db.rooms.length ? '<div id="bfRooms" class="room-chk-list">' + db.rooms.map(r =>
        '<label class="room-chk" data-id="' + esc(r['Room ID']) + '"><input type="checkbox" value="' + esc(r['Room ID']) + '"' + (picked.indexOf(r['Room ID']) > -1 ? ' checked' : '') + '>' +
        '<span><b>' + esc(r.Name) + '</b><small>' + esc([r.Type, 'Sleeps ' + (r.Capacity || '?'), inr(r.Rate) + '/night'].filter(Boolean).join(' · ')) + '</small><em class="avail"></em></span></label>').join('') + '</div>'
        : '<p class="fine">No rooms set up yet. Add rooms in the Rooms section, or save without a room.</p>') +
      '<div class="form-grid">' +
      '<label class="lbl">Room charges (₹)<input id="bfCharges" inputmode="decimal" class="sel" value="' + (isNew ? '' : esc(num(b['Room Charges']))) + '"></label>' +
      '<label class="lbl">Discount (₹)<input id="bfDiscount" inputmode="decimal" class="sel" value="' + esc(num(b.Discount) || '') + '"></label>' +
      '</div>' +
      '<p class="total-line">Total <strong id="bfTotal">₹0</strong> <button type="button" class="link-btn" id="bfAuto">Use room rates</button></p>' +
      '<div class="field"><textarea id="bfRequests" rows="2" maxlength="500" placeholder=" ">' + esc(b['Special Requests'] || '') + '</textarea><label for="bfRequests">Guest requests</label></div>' +
      '<div class="field"><textarea id="bfNotes" rows="2" maxlength="500" placeholder=" ">' + esc(b['Internal Notes'] || '') + '</textarea><label for="bfNotes">Internal notes (staff only)</label></div>' +
      staffField() +
      '<p id="bfWarn" class="form-warn hidden"></p>' +
      '<div class="act-row end"><button type="button" class="chip-btn dark" id="bfCancel">Cancel</button><button type="button" class="btn btn-sun" id="bfSave">' + (isNew ? 'Create booking' : 'Save changes') + '</button></div>';
    openPanel('bookingForm', isNew ? 'New booking' : b['Booking ID'], isNew ? 'New booking' : 'Edit ' + b['Guest Name'], '', body);
    $('#pBody').scrollTop = 0;
    $('#bfAuto').addEventListener('click', () => { chargesTouched = false; bfRecalc(); });
    bfRecalc();
  }
  function roomBusy(roomId, from, to, ignoreId) {
    return db.bookings.find(x => x['Booking ID'] !== ignoreId && BLOCK.indexOf(x.Status) > -1 &&
      bIn(x) < to && from < bOut(x) && roomIds(x['Room IDs']).indexOf(roomId) > -1);
  }
  function bfRecalc(changed) {
    if (changed === 'bfCharges') chargesTouched = true;
    const inD = $('#bfIn').value, outD = $('#bfOut').value;
    if (changed === 'bfIn' && inD && (!outD || outD <= inD)) $('#bfOut').value = addDays(inD, 1);
    const from = $('#bfIn').value, to = $('#bfOut').value;
    const n = Math.max(0, nightsBetween(from, to));
    $('#bfNights').textContent = n ? '· ' + n + (n === 1 ? ' night' : ' nights') : '';
    let rate = 0, cap = 0, clash = [];
    document.querySelectorAll('.room-chk').forEach(l => {
      const id = l.dataset.id, r = roomById(id), box = l.querySelector('input');
      const other = from && to ? roomBusy(id, from, to, openBookingId) : null;
      const maint = r && r.Status !== 'Active';
      l.classList.toggle('busy', !!other); l.classList.toggle('maint', !!maint);
      l.querySelector('.avail').textContent = other ? 'Booked · ' + other['Guest Name'] : maint ? r.Status : 'Free';
      if (box.checked) { rate += num(r && r.Rate); cap += num(r && r.Capacity); if (other) clash.push(r.Name + ' (' + other['Guest Name'] + ')'); }
    });
    if (!chargesTouched) $('#bfCharges').value = rate * n || '';
    const total = Math.max(0, num($('#bfCharges').value) - num($('#bfDiscount').value));
    $('#bfTotal').textContent = inr(total);
    const guests = num($('#bfAdults').value) + num($('#bfChildren').value);
    const warns = [];
    if (clash.length) warns.push('Room clash: ' + clash.join(', ') + '. Confirmed bookings cannot overlap.');
    if (cap && guests > cap) warns.push('Selected rooms sleep ' + cap + ' but there are ' + guests + ' guests.');
    if (n <= 0) warns.push('Check-out must be after check-in.');
    $('#bfWarn').textContent = warns.join(' ');
    $('#bfWarn').classList.toggle('hidden', !warns.length);
  }
  function saveBookingForm(btn) {
    const staff = takeStaff(); if (!staff) return;
    const data = {
      id: openBookingId || '', guestName: $('#bfName').value, mobile: $('#bfMobile').value, email: $('#bfEmail').value,
      checkIn: $('#bfIn').value, checkOut: $('#bfOut').value, adults: $('#bfAdults').value, children: $('#bfChildren').value,
      source: $('#bfSource').value, status: $('#bfStatus').value,
      rooms: [...document.querySelectorAll('.room-chk input:checked')].map(i => i.value),
      charges: $('#bfCharges').value, discount: $('#bfDiscount').value,
      requests: $('#bfRequests').value, notes: $('#bfNotes').value
    };
    if (!data.guestName.trim()) return toast('Enter the guest name.');
    if (!/^\+?[0-9 ]{8,16}$/.test(data.mobile.trim())) return toast('Enter a valid mobile number.');
    return busy(btn, async () => {
      const res = await call('saveBooking', { data, staff });
      openBookingId = res.id;
      toast(data.id ? 'Booking updated.' : 'Booking ' + res.id + ' created.');
      panelMode = 'booking';
      await quietReload();
      openBooking(res.id);
    });
  }
  $('#newBooking').addEventListener('click', () => bookingForm(null));

  /* ---------- rooms ---------- */
  let occStart = '';
  function renderRoomsSec() {
    const rooms = db.rooms.slice().sort((a, b) => (num(a.Sort) || 99) - (num(b.Sort) || 99));
    const t = today();
    $('#roomCards').innerHTML = rooms.length ? rooms.map(r => {
      const occ = db.bookings.find(b => b.Status === 'Checked in' && roomIds(b['Room IDs']).indexOf(r['Room ID']) > -1);
      const next = db.bookings.filter(b => b.Status === 'Confirmed' && bIn(b) >= t && roomIds(b['Room IDs']).indexOf(r['Room ID']) > -1).sort((a, b) => bIn(a).localeCompare(bIn(b)))[0];
      return '<button type="button" class="room-card" data-rid="' + esc(r['Room ID']) + '">' +
        '<span class="rc-top"><strong>' + esc(r.Name) + '</strong><span class="badge rs-' + slug(r.Status) + '">' + esc(r.Status) + '</span></span>' +
        '<small>' + esc([r.Type, 'Sleeps ' + (r.Capacity || '?')].filter(Boolean).join(' · ')) + '</small>' +
        '<b class="rc-rate">' + inr(r.Rate) + '<small>/night</small></b>' +
        '<span class="rc-now">' + (occ ? '🟢 In house: ' + esc(occ['Guest Name']) + ' until ' + esc(niceDate(occ['Check-out Date'])) : next ? '📅 Next: ' + esc(next['Guest Name']) + ' · ' + esc(niceDate(next['Check-in Date'])) : '✨ Free') + '</span></button>';
    }).join('') : '<div class="empty"><span>🛏️</span><p>No rooms yet. Add your first room.</p></div>';
    renderOcc();
  }
  function renderOcc() {
    const start = occStart || today();
    const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
    const rooms = db.rooms.slice().sort((a, b) => (num(a.Sort) || 99) - (num(b.Sort) || 99));
    if (!rooms.length) { $('#occGrid').innerHTML = ''; return; }
    const t = today();
    const head = '<div class="oc-h oc-room">Room</div>' + days.map(d => {
      const dt = new Date(d + 'T00:00:00');
      return '<div class="oc-h' + (d === t ? ' oc-today' : '') + '"><small>' + dt.toLocaleDateString('en-IN', { weekday: 'short' }) + '</small>' + dt.getDate() + '</div>';
    }).join('');
    const body = rooms.map(r => '<div class="oc-room">' + esc(r.Name) + '</div>' + days.map(d => {
      if (r.Status !== 'Active') return '<div class="oc-c c-maint" title="' + esc(r.Status) + '"></div>';
      const b = db.bookings.find(x => ['Confirmed', 'Checked in', 'Requested'].indexOf(x.Status) > -1 && bIn(x) <= d && d < bOut(x) && roomIds(x['Room IDs']).indexOf(r['Room ID']) > -1);
      if (!b) return '<div class="oc-c' + (d === t ? ' oc-today' : '') + '"></div>';
      const first = bIn(b) === d || d === start;
      return '<button type="button" class="oc-c c-' + slug(b.Status) + '" data-bid="' + esc(b['Booking ID']) + '" title="' + esc(b['Guest Name'] + ' · ' + b.Status) + '">' + (first ? esc(initials(b['Guest Name'])) : '') + '</button>';
    }).join('')).join('');
    $('#occGrid').style.gridTemplateColumns = '120px repeat(14, minmax(34px, 1fr))';
    $('#occGrid').innerHTML = head + body;
  }
  document.querySelectorAll('.occ-nav button').forEach(b => b.addEventListener('click', () => {
    const s = +b.dataset.shift;
    occStart = s === 0 ? '' : addDays(occStart || today(), s);
    renderOcc();
  }));
  $('#occGrid').addEventListener('click', e => { const c = e.target.closest('[data-bid]'); if (c) openBooking(c.dataset.bid); });
  $('#roomCards').addEventListener('click', e => { const c = e.target.closest('[data-rid]'); if (c) roomForm(db.rooms.find(r => r['Room ID'] === c.dataset.rid)); });
  $('#newRoom').addEventListener('click', () => roomForm(null));

  let editRoomId = '';
  function roomForm(r) {
    r = r || {};
    editRoomId = r['Room ID'] || '';
    const body =
      '<div class="form-grid">' +
      '<div class="field full"><input id="rfName" maxlength="60" placeholder=" " value="' + esc(r.Name || '') + '"><label for="rfName">Room name (e.g. Sea View Suite)</label></div>' +
      '<div class="field"><input id="rfType" maxlength="40" placeholder=" " value="' + esc(r.Type || '') + '"><label for="rfType">Type (e.g. Double, Family)</label></div>' +
      '<label class="lbl">Status<select id="rfStatus" class="sel">' + opts(['Active', 'Maintenance', 'Inactive'], r.Status || 'Active') + '</select></label>' +
      '<label class="lbl">Sleeps<input id="rfCap" type="number" min="1" max="30" class="sel" value="' + esc(r.Capacity || 2) + '"></label>' +
      '<label class="lbl">Rate per night (₹)<input id="rfRate" inputmode="decimal" class="sel" value="' + esc(num(r.Rate) || '') + '"></label>' +
      '<label class="lbl">Display order<input id="rfSort" type="number" min="0" class="sel" value="' + esc(r.Sort || '') + '"></label>' +
      '</div>' +
      '<div class="field"><textarea id="rfDesc" rows="2" maxlength="300" placeholder=" ">' + esc(r.Description || '') + '</textarea><label for="rfDesc">Description (shown to guests)</label></div>' +
      '<div class="field"><textarea id="rfNotes" rows="2" maxlength="300" placeholder=" ">' + esc(r['Internal Notes'] || '') + '</textarea><label for="rfNotes">Internal notes</label></div>' +
      '<p class="fine">Only <b>Active</b> rooms appear on the booking page. Maintenance or Inactive rooms stay out of availability.</p>' +
      '<div class="act-row end"><button type="button" class="chip-btn dark" id="rfCancel">Cancel</button><button type="button" class="btn btn-sun" id="rfSave">' + (editRoomId ? 'Save room' : 'Add room') + '</button></div>';
    openPanel('roomForm', editRoomId || 'New room', editRoomId ? r.Name : 'Add a room', editRoomId ? '<span class="badge rs-' + slug(r.Status) + '">' + esc(r.Status) + '</span>' : '', body);
    $('#pBody').scrollTop = 0;
  }
  function saveRoomForm(btn) {
    const data = { id: editRoomId, name: $('#rfName').value, type: $('#rfType').value, status: $('#rfStatus').value, capacity: $('#rfCap').value, rate: $('#rfRate').value, sort: $('#rfSort').value, description: $('#rfDesc').value, notes: $('#rfNotes').value };
    if (!data.name.trim()) return toast('Enter a room name.');
    return busy(btn, async () => { await call('saveRoom', { data, staff: staffName }); toast(editRoomId ? 'Room saved.' : 'Room added.'); $('#panel').close(); await quietReload(); });
  }

  /* ---------- init ---------- */
  if (token) { setView(true); load().catch(err => toast(err.message)); } else setView(false);
})();
