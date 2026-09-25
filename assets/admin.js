(function () {
  const API = window.SWARGA_CONFIG.API_URL;
  const $ = (s) => document.querySelector(s);
  let token = null, headers = [], rows = [], current = null, view = 'all', me = null;
  let db = { bookings: [], rooms: [], payments: [], options: { statuses: [], sources: [], modes: [] }, today: '' };

  try { token = sessionStorage.getItem('sbb_token'); me = JSON.parse(sessionStorage.getItem('sbb_user') || 'null'); } catch (e) {}
  const isSuper = () => !!me && me.role === 'Super admin';

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
    try { sessionStorage.removeItem('sbb_token'); sessionStorage.removeItem('sbb_user'); } catch (e) {}
    rows = []; me = null;
    if ($('#panel').open) $('#panel').close();
    if ($('#detail').open) $('#detail').close();
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
      setMe(res.user);
      try { sessionStorage.setItem('sbb_token', token); } catch (e2) {}
      f.reset();
      showSection('bookings');
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
    setMe(res.user);
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
    renderOthers();
    $('#idProof').innerHTML = col(current, 'ID Photo File ID')
      ? '<button type="button" class="chip-btn dark" id="loadPhoto">View ID proof</button>'
      : '<p class="fine">No file uploaded.</p>';
    $('#verifyBlock').innerHTML = st === 'Verified'
      ? '<p>Verified by <strong>' + esc(col(current, 'Rep Name')) + '</strong><br><span class="fine">' + esc(col(current, 'Rep Verified At')) + '</span></p>'
      : '<p class="fine">Recorded as <b>' + esc(staffName) + '</b> once you confirm the ID matches the guest.</p><button type="button" class="btn btn-sea wide" id="verifyBtn">Mark as verified</button>';
    if (!$('#detail').open) $('#detail').showModal();
    $('.drawer-body').scrollTop = 0;
  }

  /* ---------- other guests ---------- */
  let othersList = [];
  async function renderOthers() {
    const sid = col(current, 'Submission ID');
    const summary = col(current, 'Other Guests');
    const needA = Math.max(0, (+col(current, 'Adults') || 0) - 1), needC = +col(current, 'Children') || 0;
    $('#othersSec').classList.remove('hidden');
    othersList = [];
    const draw = () => {
      const gotA = othersList.filter(g => g.kind === 'Adult').length, gotC = othersList.filter(g => g.kind === 'Child').length;
      const gap = [];
      if (gotA < needA) gap.push((needA - gotA) + ' adult' + (needA - gotA === 1 ? '' : 's'));
      if (gotC < needC) gap.push((needC - gotC) + ' child' + (needC - gotC === 1 ? '' : 'ren'));
      $('#othersBlock').innerHTML = (othersList.length ? othersList.map(g =>
        '<div class="oguest"><div><b>' + esc(g.no) + '. ' + esc(g.name) + '</b><small>' + (g.kind === 'Child' ? 'Child · age ' + esc(g.age) : 'Adult') +
        (g.idType ? ' · ' + esc(g.idType) + (g.idNumber ? ' ' + esc(g.idNumber) : '') : '') + '</small></div>' +
        '<div class="og-acts">' + (g.hasPhoto ? '<button type="button" class="chip-btn dark" data-gphoto="' + esc(g.id) + '">View ID proof</button>' : '<span class="fine">No ID file</span>') +
        '<button type="button" class="link-btn" data-gedit="' + esc(g.id) + '">Edit</button><button type="button" class="link-btn danger-link" data-gremove="' + esc(g.id) + '">Remove</button></div></div>').join('')
        : '<p class="fine">No other guests recorded.</p>') +
        (gap.length ? '<p class="form-warn">Missing details for ' + gap.join(' and ') + ' (declared ' + (needA + 1) + ' adults, ' + needC + ' children).</p>' : '') +
        '<button type="button" class="chip-btn dark" id="gAdd">+ Add guest</button>';
    };
    if (!summary) { draw(); return; }
    $('#othersBlock').innerHTML = '<div class="skeleton"></div>';
    try {
      const list = (await call('guests', { id: sid })).guests;
      if (col(current, 'Submission ID') !== sid) return;
      othersList = list; draw();
    } catch (err) { $('#othersBlock').innerHTML = '<p class="fine">' + esc(summary) + '</p>'; }
  }

  /* ---------- staff corrections to a check-in ---------- */
  const ID_TYPES = ['Aadhaar', 'Passport', 'Driving Licence', 'Voter ID', 'PAN', 'Other'];
  let editSid = '', editGuest = null;
  const fld = (id, label, val, type, extra) => '<div class="field"><input id="' + id + '" type="' + (type || 'text') + '" placeholder=" " value="' + esc(val || '') + '"' + (extra || '') + '><label for="' + id + '">' + label + '</label></div>';
  const lbl = (label, inner) => '<label class="lbl">' + label + inner + '</label>';
  const fileBox = (id, label) => '<label class="dropzone mini" id="' + id + 'Box"><input type="file" id="' + id + '" accept="image/jpeg,image/png,application/pdf"><span class="dz-text">📷 ' + label + '</span></label>';
  function readIdFile(file) {
    if (!file) return Promise.resolve(null);
    if (file.type === 'application/pdf') {
      if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('That PDF is larger than 5 MB.'));
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ mime: 'application/pdf', data: r.result.split(',')[1] }); r.onerror = () => rej(new Error('Could not read file.')); r.readAsDataURL(file); });
    }
    if (!/^image\/(jpeg|png)$/.test(file.type)) return Promise.reject(new Error('Use a JPG, PNG or PDF file.'));
    return shrinkImage(file, 1600);
  }
  function checkinForm() {
    editSid = col(current, 'Submission ID');
    const c = (k) => col(current, k);
    const body =
      '<p class="fine">Correct the guest\'s details. The declarations and signature stay as the guest submitted them. Every change is recorded in the activity log with your name.</p>' +
      '<div class="form-grid">' +
      '<div class="field full"><input id="ceName" maxlength="120" placeholder=" " value="' + esc(c('Guest Name')) + '"><label for="ceName">Primary guest name</label></div>' +
      fld('ceMobile', 'Mobile', c('Mobile'), 'tel') + fld('ceEmail', 'Email', c('Email'), 'email') +
      lbl('Check-in date', '<input id="ceIn" type="date" class="sel" value="' + esc(isoDate(c('Check-in Date'))) + '">') +
      lbl('Check-in time', '<input id="ceInT" type="time" class="sel" value="' + esc(c('Check-in Time')) + '">') +
      lbl('Check-out date', '<input id="ceOut" type="date" class="sel" value="' + esc(isoDate(c('Check-out Date'))) + '">') +
      lbl('Check-out time', '<input id="ceOutT" type="time" class="sel" value="' + esc(c('Check-out Time')) + '">') +
      lbl('Adults', '<input id="ceAdults" type="number" min="1" max="50" class="sel" value="' + esc(c('Adults') || 1) + '">') +
      lbl('Children', '<input id="ceKids" type="number" min="0" max="50" class="sel" value="' + esc(c('Children') || 0) + '">') +
      fld('ceEName', 'Emergency contact name', c('Emergency Contact Name')) + fld('ceEPhone', 'Emergency contact number', c('Emergency Contact No.'), 'tel') +
      lbl('ID type', '<select id="ceIdType" class="sel">' + opts(ID_TYPES, c('ID Type') || 'Aadhaar') + '</select>') +
      '</div>' +
      fileBox('ceIdFile', c('ID Photo File ID') ? 'Replace ID photo (optional)' : 'Add ID photo (missing)') +
      '<div class="act-row end"><button type="button" class="chip-btn dark" id="ceCancel">Cancel</button><button type="button" class="btn btn-sun" id="ceSave">Save changes</button></div>';
    openPanel('checkinForm', editSid, 'Edit ' + c('Guest Name'), '', body);
    $('#pBody').scrollTop = 0;
  }
  function guestForm(g) {
    editGuest = g || null;
    const isNew = !g; g = g || { kind: 'Adult', name: '', age: '', idType: '' };
    const body =
      '<div class="form-grid">' +
      lbl('Type', '<select id="geKind" class="sel">' + opts(['Adult', 'Child'], g.kind) + '</select>') +
      '<div class="field"><input id="geName" maxlength="120" placeholder=" " value="' + esc(g.name) + '"><label for="geName">Full name</label></div>' +
      lbl('Age (children)', '<input id="geAge" type="number" min="0" max="17" class="sel" value="' + esc(g.age) + '">') +
      lbl('ID type', '<select id="geIdType" class="sel"><option value="">—</option>' + opts(ID_TYPES, g.idType) + '</select>') +
      '</div>' +
      fileBox('geFile', isNew ? 'Add ID photo (required for adults)' : (g.hasPhoto ? 'Replace ID photo (optional)' : 'Add ID photo')) +
      '<div class="act-row end"><button type="button" class="chip-btn dark" id="geCancel">Cancel</button><button type="button" class="btn btn-sun" id="geSave">' + (isNew ? 'Add guest' : 'Save guest') + '</button></div>';
    openPanel('guestForm', col(current, 'Submission ID'), isNew ? 'Add a guest' : 'Edit ' + g.name, '', body);
    $('#pBody').scrollTop = 0;
    syncGuestKind();
  }
  function syncGuestKind() {
    const child = $('#geKind').value === 'Child';
    $('#geAge').closest('.lbl').classList.toggle('hidden', !child);
  }
  async function afterCheckinEdit(msg) {
    $('#panel').close();
    toast(msg);
    await quietReload();
    if (current) openDetail();
  }
  $('#pBody').addEventListener('change', e => {
    if (e.target.id === 'geKind') syncGuestKind();
    if (e.target.id === 'ceIdFile' || e.target.id === 'geFile') {
      const f = e.target.files[0], box = e.target.closest('.dropzone');
      if (f) { box.classList.add('has-file'); box.querySelector('.dz-text').textContent = '✓ ' + f.name; }
    }
  });
  $('#pBody').addEventListener('click', async e => {
    const t = e.target;
    if (panelMode === 'checkinForm') {
      if (t.id === 'ceCancel') return $('#panel').close();
      if (t.id === 'ceSave') {
        const data = {
          guestName: $('#ceName').value, mobile: $('#ceMobile').value, email: $('#ceEmail').value,
          checkInDate: $('#ceIn').value, checkInTime: $('#ceInT').value, checkOutDate: $('#ceOut').value, checkOutTime: $('#ceOutT').value,
          adults: $('#ceAdults').value, children: $('#ceKids').value,
          emergencyName: $('#ceEName').value, emergencyPhone: $('#ceEPhone').value, idType: $('#ceIdType').value
        };
        return busy(t, async () => {
          data.idPhoto = await readIdFile($('#ceIdFile').files[0]);
          const r = await call('updateCheckin', { id: editSid, data });
          await afterCheckinEdit(r.changed ? 'Saved ' + r.changed + ' change' + (r.changed === 1 ? '' : 's') + '.' : 'No changes.');
        });
      }
    }
    if (panelMode === 'guestForm') {
      if (t.id === 'geCancel') return $('#panel').close();
      if (t.id === 'geSave') {
        const data = { id: editGuest ? editGuest.id : '', kind: $('#geKind').value, name: $('#geName').value, age: $('#geAge').value, idType: $('#geIdType').value };
        return busy(t, async () => {
          data.idPhoto = await readIdFile($('#geFile').files[0]);
          await call('saveGuest', { id: col(current, 'Submission ID'), data });
          await afterCheckinEdit(editGuest ? 'Guest updated.' : 'Guest added.');
        });
      }
    }
  });

  /* ---------- stay actions ---------- */
  let staffName = me ? me.name : '';
  function setMe(u) {
    if (!u) return;
    me = { username: u.username, name: u.name || u.username, role: u.role };
    staffName = me.name;
    try { sessionStorage.setItem('sbb_user', JSON.stringify(me)); } catch (e) {}
    $('#meChip').innerHTML = '<span class="avatar sm">' + esc(initials(me.name)) + '</span><span>' + esc(me.name) + '<small>' + esc(me.role) + '</small></span>';
    document.body.classList.toggle('is-super', isSuper());
  }
  function renderStay() {
    const st = stayOf(current), fl = flag(current);
    const line = (label, at, by) => at ? '<dt>' + label + '</dt><dd>' + esc(at) + (by ? ' · ' + esc(by) : '') + '</dd>' : '';
    let html = '<div class="stay-status"><span class="badge st-' + st.replace(/\s/g, '') + '">' + esc(st) + '</span>' +
      (fl ? '<span class="flag ' + fl[0] + '">' + fl[1] + '</span>' : '') + '</div>' +
      '<dl>' + line('Checked in', col(current, 'Actual Check-in'), col(current, 'Checked-in By')) +
      line('Checked out', col(current, 'Actual Check-out'), col(current, 'Checked-out By')) + '</dl>';
    if (st !== 'Checked out') {
      html += '<button type="button" class="btn ' + (st === 'Expected' ? 'btn-sun' : 'btn-sea') + ' wide" data-move="' + (st === 'Expected' ? 'in' : 'out') + '">' +
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
    const staff = staffName;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Saving…';
    try {
      await call('stay', { id: col(current, 'Submission ID'), move });
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
    const gp = e.target.closest('[data-gphoto]');
    if (gp) {
      gp.disabled = true; gp.textContent = 'Loading…';
      try {
        const p = (await call('guestPhoto', { id: gp.dataset.gphoto })).photo;
        if (!p) { gp.outerHTML = '<span class="fine">No file.</span>'; return; }
        if (p.mime === 'application/pdf') { const box = gp.parentElement; gp.outerHTML = pdfLink(p.data); const a = box.querySelector('.pdf-open'); if (a) a.click(); return; }
        gp.outerHTML = '<img class="idimg" alt="ID proof" src="data:' + p.mime + ';base64,' + p.data + '">';
      } catch (err) { toast(err.message); gp.disabled = false; gp.textContent = 'View ID proof'; }
      return;
    }
    if (e.target.id === 'pdfBtn') return downloadCheckinPdf(col(current, 'Submission ID'), e.target);
    if (e.target.id === 'editCheckin') return checkinForm();
    if (e.target.id === 'gAdd') return guestForm(null);
    const ge = e.target.closest('[data-gedit]');
    if (ge) return guestForm(othersList.find(g => g.id === ge.dataset.gedit));
    const gr = e.target.closest('[data-gremove]');
    if (gr) {
      if (!gr.dataset.armed) { gr.dataset.armed = '1'; gr.textContent = 'Confirm remove'; setTimeout(() => { if (gr.isConnected) { delete gr.dataset.armed; gr.textContent = 'Remove'; } }, 4000); return; }
      gr.disabled = true;
      try { await call('removeGuest', { id: gr.dataset.gremove }); toast('Guest removed.'); await quietReload(); if (current) openDetail(); }
      catch (err) { toast(err.message); gr.disabled = false; }
      return;
    }
    if (e.target.id === 'delCheckin') {
      const sid = col(current, 'Submission ID');
      return confirmDelete('checkin', sid, 'Delete check-in ' + sid + '?', col(current, 'Guest Name') + ' · ' + niceDate(col(current, 'Check-in Date')) + ' → ' + niceDate(col(current, 'Check-out Date')) + '. The check-in, the other guests and all ID files are removed (ID files go to Drive trash for 30 days).', () => { $('#detail').close(); current = null; });
    }
    if (e.target.id === 'loadPhoto') {
      e.target.disabled = true;
      e.target.textContent = 'Loading…';
      try {
        const res = await call('photo', { id: col(current, 'Submission ID') });
        const p = res.photo;
        if (!p) { $('#idProof').innerHTML = '<p class="fine">No file uploaded.</p>'; return; }
        if (p.mime === 'application/pdf') { $('#idProof').innerHTML = pdfLink(p.data); $('#idProof .pdf-open').click(); return; }
        $('#idProof').innerHTML = '<img class="idimg" alt="ID proof" src="data:' + p.mime + ';base64,' + p.data + '">';
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
      e.target.disabled = true;
      e.target.textContent = 'Saving…';
      try {
        await call('verify', { id: col(current, 'Submission ID') });
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
    ['bookings', 'log', 'rooms', 'settings'].forEach(k => $('#sec-' + k).classList.toggle('hidden', k !== sec));
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
  const staffField = () => '';
  const takeStaff = () => staffName || 'staff';
  const notifyOn = () => { const c = $('#pNotify'); return c ? c.checked : true; };
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
      '<div class="act-row">' + actions + '</div>' + notifyBox(b) +
      '<div id="reasonBox" class="hidden"><div class="field"><input id="pReason" maxlength="200" placeholder=" "><label for="pReason">Reason</label></div>' +
      '<div class="act-row"><button type="button" class="chip-btn dark" id="reasonCancel">Back</button><button type="button" class="btn btn-sea" id="reasonGo">Confirm</button></div></div>' +
      (b['Cancel Reason'] && (b.Status === 'Cancelled' || b.Status === 'No-show') ? '<p class="fine">Reason: ' + esc(b['Cancel Reason']) + '</p>' : '') + '</section>' +

      '<section class="dsec"><h3>💳 Payments</h3>' +
      '<div class="pay-sum"><div><small>Total</small><strong>' + inr(b.Total) + '</strong></div><div><small>Paid</small><strong>' + inr(b.Paid) + '</strong></div><div class="' + (bal > 0.5 ? 'owe' : 'clear') + '"><small>Balance</small><strong>' + inr(Math.max(bal, 0)) + '</strong></div></div>' +
      (pays.length ? '<div class="pay-list">' + pays.map(p => '<div class="pay-row"><span><b>' + inr(Math.abs(num(p.Amount))) + '</b> ' + esc(p.Kind) + ' · ' + esc(p.Mode) + (p.Reference ? ' · ' + esc(p.Reference) : '') + '</span><small>' + esc(p['Recorded At']) + ' · ' + esc(p['Recorded By']) + '</small>' +
        (isSuper() ? '<button type="button" class="pay-del" data-delpay="' + esc(p['Payment ID']) + '" title="Delete this payment" aria-label="Delete payment">✕</button>' : '') + '</div>').join('') + '</div>' : '<p class="fine">No payments recorded yet.</p>') +
      '<div class="pay-form"><div class="field"><input id="payAmt" inputmode="decimal" placeholder=" " value="' + (bal > 0.5 ? Math.round(bal) : '') + '"><label for="payAmt">Amount (₹)</label></div>' +
      '<select id="payMode" class="sel">' + opts(db.options.modes, 'UPI') + '</select>' +
      '<div class="field"><input id="payRef" maxlength="80" placeholder=" "><label for="payRef">Reference / UTR (optional)</label></div></div>' +
      '<div class="act-row"><button type="button" class="btn btn-sea" id="payAdd">Record payment</button>' +
      (bal > 0.5 ? '<button type="button" class="btn btn-sun" id="payFull">Mark as paid (' + inr(bal) + ')</button>' : '') +
      '<button type="button" class="chip-btn dark" id="payRefund">Record refund</button></div></section>' +

      '<section class="dsec"><h3>✉️ Guest emails</h3>' + (b.Email
        ? '<p class="fine">Sends to ' + esc(b.Email) + '. Every email is recorded in Settings → Activity.</p><div class="act-row">' +
          (['Confirmed', 'Checked in'].indexOf(b.Status) > -1 ? '<button type="button" class="chip-btn dark" data-mail="bookingConfirmed">Resend confirmation</button>' : '') +
          (b.Status === 'Confirmed' && !b['Check-in Ref'] ? '<button type="button" class="chip-btn dark" data-mail="preArrival">Send check-in reminder</button>' : '') +
          (pays.length ? '<button type="button" class="chip-btn dark" data-mail="paymentReceipt">Send latest receipt</button>' : '') +
          (b.Status === 'Requested' ? '<button type="button" class="chip-btn dark" data-mail="requestReceived">Resend request acknowledgement</button>' : '') + '</div>'
        : '<p class="form-warn">No guest email on this booking, so no emails can go out. Add it with Edit below.</p>') + '</section>' +

      '<section class="dsec"><h3>📝 Guest check-in form</h3>' +
      (b['Check-in Ref']
        ? '<button type="button" class="hist" data-open-log="' + esc(b['Check-in Ref']) + '"><b>Received · ' + esc(b['Check-in Ref']) + '</b><small>' + (logRow ? esc(col(logRow, 'Status')) + ' ID · ' + esc(col(logRow, 'Stay Status') || 'Expected') : 'Open in guest log') + '</small></button>'
        : '<p class="fine">Not received yet. Send the guest their check-in link:</p>') +
      '<div class="act-row">' + (b['Check-in Ref'] ? '<button type="button" class="chip-btn dark" id="bkPdf">⬇ Check-in PDF</button>' : '') + '<a class="chip-btn dark" target="_blank" rel="noopener" href="' + esc(wa) + '">💬 WhatsApp link</a><button type="button" class="chip-btn dark" id="copyLink" data-link="' + esc(link) + '">🔗 Copy link</button></div></section>' +

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
      '<dt>Updated</dt><dd>' + esc(b['Updated At']) + (b['Updated By'] ? ' · ' + esc(b['Updated By']) : '') + '</dd></dl></section>' +
      (isSuper() ? '<section class="dsec"><h3>🗑 Delete</h3><p class="fine">Removes this booking and its ' + pays.length + ' payment record(s). A linked check-in stays in the guest log.</p><button type="button" class="chip-btn danger" id="delBooking">Delete booking</button></section>' : '');

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
        return busy(st, async () => { await call('bookingStatus', { id: openBookingId, status: to, notifyGuest: notifyOn() }); toast('Booking ' + to.toLowerCase() + '.'); await quietReload(); });
      }
      if (t.id === 'reasonCancel') { $('#reasonBox').classList.add('hidden'); return; }
      if (t.id === 'reasonGo') {
        const staff = takeStaff(); if (!staff) return;
        const reason = $('#pReason').value.trim();
        if (!reason) return toast('Please give a reason.');
        return busy(t, async () => { await call('bookingStatus', { id: openBookingId, status: pendingStatus, reason, notifyGuest: notifyOn() }); toast('Booking marked ' + pendingStatus.toLowerCase() + '.'); await quietReload(); });
      }
      if (t.id === 'payAdd' || t.id === 'payRefund' || t.id === 'payFull') {
        const staff = takeStaff(); if (!staff) return;
        const mode = $('#payMode').value, reference = $('#payRef').value.trim();
        if (t.id === 'payFull') return busy(t, async () => { await call('markPaid', { data: { bookingId: openBookingId, mode, reference, notifyGuest: notifyOn() } }); toast('Marked as paid.'); await quietReload(); });
        const amount = num($('#payAmt').value);
        if (!(amount > 0)) return toast('Enter an amount.');
        const kind = t.id === 'payRefund' ? 'Refund' : 'Payment';
        return busy(t, async () => { await call('addPayment', { data: { bookingId: openBookingId, amount, mode, reference, kind, notifyGuest: notifyOn() } }); toast(kind + ' of ' + inr(amount) + ' recorded.'); await quietReload(); });
      }
      const ml = t.closest('[data-mail]');
      if (ml) return busy(ml, async () => { await call('sendForBooking', { key: ml.dataset.mail, id: openBookingId }); toast('Email sent to ' + b.Email + '.'); });
      if (t.id === 'bkPdf') return downloadCheckinPdf(b['Check-in Ref'], t);
      if (t.id === 'copyLink') {
        try { await navigator.clipboard.writeText(t.dataset.link); toast('Check-in link copied.'); }
        catch (err) { window.prompt('Copy this link', t.dataset.link); }
        return;
      }
      if (t.id === 'editBooking') return bookingForm(b);
      if (t.id === 'delBooking') return confirmDelete('booking', openBookingId, 'Delete booking ' + openBookingId + '?',
        b['Guest Name'] + ' · ' + niceDate(b['Check-in Date']) + ' → ' + niceDate(b['Check-out Date']) + '. The booking and its payments are removed. A copy is kept in the Deleted log.',
        () => { $('#panel').close(); });
      const dp = t.closest('[data-delpay]');
      if (dp) { const p = db.payments.find(x => x['Payment ID'] === dp.dataset.delpay) || {}; return confirmDelete('payment', dp.dataset.delpay, 'Delete this payment?', inr(Math.abs(num(p.Amount))) + ' ' + (p.Kind || '') + ' · ' + (p.Mode || '') + ' · ' + (p['Recorded At'] || '') + '. The paid total is recalculated.'); }
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
      if (t.id === 'rfDelete') { const r = db.rooms.find(x => x['Room ID'] === editRoomId) || {}; return confirmDelete('room', editRoomId, 'Delete room ' + (r.Name || '') + '?', 'The room and its photos are removed. Past bookings keep their records. To hide a room without deleting it, set its status to Inactive.', () => $('#panel').close()); }
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
      '<div class="field"><input id="bfEmail" type="email" placeholder=" " value="' + esc(b.Email || '') + '"><label for="bfEmail">Email (needed for confirmations)</label></div>' +
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
      (isNew ? '<label class="chk-line"><input type="checkbox" id="bfNotify" checked> Email the confirmation and check-in link to the guest (Confirmed bookings with an email)</label>' : '') +
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
    const data = {
      notifyGuest: $('#bfNotify') ? $('#bfNotify').checked : false,
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
      const res = await call('saveBooking', { data });
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
      const cover = photoRefs(r.Photos)[0];
      return '<button type="button" class="room-card" data-rid="' + esc(r['Room ID']) + '">' +
        (cover ? '<span class="rc-img">' + imgTag(cover, r.Name) + '</span>' : '<span class="rc-img empty">📷 Add photos</span>') +
        '<span class="rc-top"><strong>' + esc(r.Name) + '</strong><span class="badge rs-' + slug(r.Status) + '">' + esc(r.Status) + '</span></span>' +
        '<small>' + esc([r.Type, 'Sleeps ' + (r.Capacity || '?')].filter(Boolean).join(' · ')) + '</small>' +
        '<b class="rc-rate">' + inr(r.Rate) + '<small>/night</small></b>' +
        '<span class="rc-now">' + (occ ? '🟢 In house: ' + esc(occ['Guest Name']) + ' until ' + esc(niceDate(occ['Check-out Date'])) : next ? '📅 Next: ' + esc(next['Guest Name']) + ' · ' + esc(niceDate(next['Check-in Date'])) : '✨ Free') + '</span></button>';
    }).join('') : '<div class="empty"><span>🛏️</span><p>No rooms yet. Add your first room.</p></div>';
    hydratePhotos($('#roomCards'));
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
      '<h3 class="mini">Photos <small>up to 6 · the first is the cover</small></h3>' +
      (editRoomId ? '<div id="rfPhotos" class="ph-grid"></div><label class="chip-btn dark ph-add"><input type="file" id="rfPhotoIn" accept="image/jpeg,image/png,image/webp" multiple hidden>+ Add photos</label>'
        : '<p class="fine">Save the room first, then add photos.</p>') +
      '<div class="act-row end">' + (editRoomId && isSuper() ? '<button type="button" class="chip-btn danger push-left" id="rfDelete">Delete room</button>' : '') + '<button type="button" class="chip-btn dark" id="rfCancel">Cancel</button><button type="button" class="btn btn-sun" id="rfSave">' + (editRoomId ? 'Save room' : 'Add room') + '</button></div>';
    roomPhotos = photoRefs(r.Photos);
    openPanel('roomForm', editRoomId || 'New room', editRoomId ? r.Name : 'Add a room', editRoomId ? '<span class="badge rs-' + slug(r.Status) + '">' + esc(r.Status) + '</span>' : '', body);
    $('#pBody').scrollTop = 0;
    if (editRoomId) renderRoomPhotos();
  }
  function saveRoomForm(btn) {
    const data = { id: editRoomId, name: $('#rfName').value, type: $('#rfType').value, status: $('#rfStatus').value, capacity: $('#rfCap').value, rate: $('#rfRate').value, sort: $('#rfSort').value, description: $('#rfDesc').value, notes: $('#rfNotes').value };
    if (!data.name.trim()) return toast('Enter a room name.');
    return busy(btn, async () => {
      const res = await call('saveRoom', { data });
      await quietReload();
      if (editRoomId) { toast('Room saved.'); return $('#panel').close(); }
      toast('Room added. Now add photos.');
      roomForm(db.rooms.find(x => x['Room ID'] === res.id));
      $('#rfPhotos').scrollIntoView({ block: 'center' });
    });
  }

  /* ---------- room photos ---------- */
  let roomPhotos = [];
  const photoCache = {};
  function photoRefs(v) {
    return String(v || '').split(',').map(x => x.trim()).filter(Boolean).map(p => {
      const priv = p.indexOf('p:') === 0, id = priv ? p.slice(2) : p;
      return { id: id, url: priv ? '' : 'https://lh3.googleusercontent.com/d/' + id + '=w1600' };
    });
  }
  const imgTag = (ph, alt) => ph.url
    ? '<img src="' + esc(ph.url.replace('=w1600', '=w600')) + '" alt="' + esc(alt || '') + '" loading="lazy">'
    : '<img data-pid="' + esc(ph.id) + '" alt="' + esc(alt || '') + '">';
  async function hydratePhotos(root) {
    for (const img of root.querySelectorAll('img[data-pid]')) {
      const id = img.dataset.pid;
      try {
        if (!photoCache[id]) { const r = await call('roomPhoto', { id }); photoCache[id] = 'data:' + r.mime + ';base64,' + r.data; }
        img.src = photoCache[id]; img.removeAttribute('data-pid');
      } catch (e) { /* leave blank */ }
    }
  }
  function renderRoomPhotos() {
    const box = $('#rfPhotos'); if (!box) return;
    box.innerHTML = roomPhotos.length ? roomPhotos.map((ph, i) =>
      '<div class="ph">' + imgTag(ph, 'Room photo ' + (i + 1)) +
      (i === 0 ? '<span class="ph-cover">Cover</span>' : '<button type="button" class="ph-btn" data-ph-op="cover" data-fid="' + esc(ph.id) + '" title="Make cover">★</button>') +
      '<button type="button" class="ph-btn del" data-ph-op="remove" data-fid="' + esc(ph.id) + '" title="Remove photo">✕</button></div>').join('')
      : '<p class="fine">No photos yet.</p>';
    $('.ph-add').classList.toggle('hidden', roomPhotos.length >= 6);
    hydratePhotos(box);
  }
  function shrinkImage(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.84).split(',')[1] });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(file.name + ' is not a readable image.')); };
      img.src = url;
    });
  }
  $('#pBody').addEventListener('change', async e => {
    if (e.target.id !== 'rfPhotoIn') return;
    const files = [...e.target.files].slice(0, 6 - roomPhotos.length);
    e.target.value = '';
    const label = $('.ph-add');
    for (let i = 0; i < files.length; i++) {
      label.classList.add('busy'); label.lastChild.textContent = 'Uploading ' + (i + 1) + ' of ' + files.length + '…';
      try {
        const photo = await shrinkImage(files[i], 1600);
        const r = await call('addRoomPhoto', { id: editRoomId, photo });
        roomPhotos = r.photos;
      } catch (err) { toast(err.message); break; }
    }
    label.classList.remove('busy'); label.lastChild.textContent = '+ Add photos';
    renderRoomPhotos();
    quietReload();
  });
  $('#pBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-ph-op]');
    if (!b || panelMode !== 'roomForm') return;
    const op = b.dataset.phOp;
    if (op === 'remove' && !b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Remove?'; b.classList.add('armed'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '✕'; b.classList.remove('armed'); } }, 4000); return; }
    b.disabled = true;
    try { const r = await call('roomPhotoOp', { id: editRoomId, fileId: b.dataset.fid, op }); roomPhotos = r.photos; renderRoomPhotos(); toast(op === 'cover' ? 'Cover photo set.' : 'Photo removed.'); quietReload(); }
    catch (err) { toast(err.message); b.disabled = false; }
  });

  function notifyBox(b) {
    return b.Email ? '<label class="chk-line"><input type="checkbox" id="pNotify" checked> Email the guest about this change</label>' : '';
  }

  /* =====================================================================
     SETTINGS · USERS · EMAIL · ACTIVITY
     ===================================================================== */
  let stab = 'account', sdata = null, users = [], roles = [], mailerCode = '', trChoice = '';
  const STABS = [
    ['account', '👤 My account', false], ['users', '👥 Users', true], ['email', '✉️ Email setup', true],
    ['notify', '🔔 Notifications', true], ['activity', '🧾 Activity', false]
  ];
  const TRANSPORTS = [
    ['off', 'Off', 'No emails are sent. Everything else works as before.'],
    ['relay', 'Sender’s Google account', 'Emails go out from another Gmail or Google Workspace account (for example Chirag’s) through a small Mailer script in that account. Limit 100 emails a day on Gmail, 1,500 on Workspace.'],
    ['brevo', 'Brevo', 'Transactional email service. Needs a free Brevo account, an API key and a verified sender address. Best for a custom domain.'],
    ['self', 'This script’s account', 'Sends from the Google account that runs the app. Use for testing.']
  ];
  const field = (id, label, val, type, extra) => '<div class="field"><input id="' + id + '" type="' + (type || 'text') + '" placeholder=" " value="' + esc(val || '') + '"' + (extra || '') + '><label for="' + id + '">' + label + '</label></div>';

  function renderSTabs() {
    $('#sTabs').innerHTML = STABS.filter(t => !t[2] || isSuper()).map(t => '<button type="button" data-s="' + t[0] + '"' + (t[0] === stab ? ' class="on"' : '') + '>' + t[1] + '</button>').join('');
  }
  async function openSettings(tab) {
    if (tab) stab = tab;
    showSection('settings');
    if (!me) {
      $('#sBody').innerHTML = '<div class="skeleton"></div>';
      try { setMe((await call('me')).user); } catch (err) { return toast(err.message); }
    }
    if (STABS.find(t => t[0] === stab)[2] && !isSuper()) stab = 'account';
    renderSTabs();
    $('#sBody').innerHTML = '<div class="skeleton"></div>';
    try {
      if (stab === 'account') return renderAccount();
      if (stab === 'users') { const r = await call('users'); users = r.users; roles = r.roles; return renderUsers(); }
      if (stab === 'email' || stab === 'notify') { sdata = await call('settings'); return stab === 'email' ? renderEmail() : renderNotify(); }
      if (stab === 'activity') return renderActivity();
    } catch (err) { $('#sBody').innerHTML = '<p class="form-warn">' + esc(err.message) + '</p>'; }
  }
  $('#sTabs').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) openSettings(b.dataset.s); });
  $('#meChip').addEventListener('click', () => openSettings('account'));
  $('#secNav').addEventListener('click', e => { const b = e.target.closest('[data-sec="settings"]'); if (b) openSettings(); });

  /* ---- my account ---- */
  function renderAccount() {
    $('#sBody').innerHTML =
      '<div class="scard"><h3>' + esc(me.name) + '</h3><p class="fine">Username <b>' + esc(me.username) + '</b> · ' + esc(me.role) + '</p>' +
      '<p class="fine">Your name is recorded automatically on every check-in, payment and status change.</p></div>' +
      '<div class="scard"><h3>Change password</h3>' +
      field('cpOld', 'Current password', '', 'password', ' autocomplete="current-password"') +
      field('cpNew', 'New password (10+ characters)', '', 'password', ' autocomplete="new-password"') +
      field('cpNew2', 'Repeat new password', '', 'password', ' autocomplete="new-password"') +
      '<div class="act-row end"><button type="button" class="btn btn-sea" id="cpSave">Update password</button></div></div>';
  }

  /* ---- users ---- */
  function renderUsers() {
    $('#sBody').innerHTML =
      '<div class="sec-head"><h2>Users</h2><button type="button" class="btn btn-sun" id="uNew">+ Add user</button></div>' +
      '<p class="fine"><b>Super admin</b>: everything, plus users, email setup and notifications. <b>Admin</b>: bookings, guest log, rooms and payments.</p>' +
      '<div class="guest-list">' + users.map(u =>
        '<button type="button" class="gcard" data-user="' + esc(u.username) + '"><span class="avatar">' + esc(initials(u.name)) + '</span>' +
        '<span class="g-main"><strong>' + esc(u.name) + (u.username === me.username ? ' <em class="src">you</em>' : '') + '</strong><small>' + esc(u.username) + (u.email ? ' · ' + esc(u.email) : '') + '</small></span>' +
        '<span class="g-stay"><small>Last sign-in</small><b>' + esc(u.lastLogin || 'Never') + '</b></span>' +
        '<span class="g-badges"><span class="badge role-' + slug(u.role) + '">' + esc(u.role) + '</span>' + (u.status !== 'Active' ? '<span class="flag late">' + esc(u.status) + '</span>' : '') + '</span></button>').join('') + '</div>';
  }
  function userForm(u) {
    const isNew = !u; u = u || { role: 'Admin', status: 'Active' };
    const body = '<div class="form-grid">' +
      (isNew ? field('ufUser', 'Username (sign-in name)', '', 'text', ' maxlength="30" autocomplete="off"') : '') +
      field('ufName', 'Full name (shown on records)', u.name, 'text', ' maxlength="60"') +
      field('ufEmail', 'Email (optional)', u.email, 'email') +
      '<label class="lbl">Role<select id="ufRole" class="sel">' + opts(roles, u.role) + '</select></label>' +
      '<label class="lbl">Status<select id="ufStatus" class="sel">' + opts(['Active', 'Disabled'], u.status) + '</select></label>' +
      '</div>' +
      field('ufPass', isNew ? 'Password (10+ characters)' : 'New password (leave blank to keep)', '', 'text', ' autocomplete="off"') +
      '<button type="button" class="link-btn" id="ufGen">Generate a strong password</button>' +
      '<p class="fine">Share the password privately. The user can change it under My account.</p>' +
      '<div class="act-row end">' + (!isNew && u.username !== me.username ? '<button type="button" class="chip-btn danger push-left" id="ufDelete">Delete user</button>' : '') + '<button type="button" class="chip-btn dark" id="ufCancel">Cancel</button><button type="button" class="btn btn-sun" id="ufSave">' + (isNew ? 'Create user' : 'Save user') + '</button></div>';
    openPanel('userForm', isNew ? 'New user' : u.username, isNew ? 'Add a user' : u.name, isNew ? '' : '<span class="badge role-' + slug(u.role) + '">' + esc(u.role) + '</span>', body);
    $('#pBody').dataset.uname = isNew ? '' : u.username;
  }
  function genPass() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const a = new Uint32Array(14); crypto.getRandomValues(a);
    return Array.from(a, x => c[x % c.length]).join('');
  }

  /* ---- email setup ---- */
  function renderEmail() {
    const ig = sdata.integration, tr = sdata.triggers, cur = trChoice || ig.transport;
    $('#sBody').innerHTML =
      '<div class="scard"><h3>How emails are sent</h3><div class="tr-list">' + TRANSPORTS.map(t =>
        '<label class="tr-opt' + (cur === t[0] ? ' on' : '') + '"><input type="radio" name="tr" value="' + t[0] + '"' + (cur === t[0] ? ' checked' : '') + '><span><b>' + t[1] + '</b><small>' + t[2] + '</small></span></label>').join('') + '</div></div>' +

      '<div class="scard tr-cfg" data-for="relay"><h3>Sender’s Google account (Mailer)</h3>' +
      '<ol class="steps-list"><li>Generate the Mailer code below and send it privately to the sender (for example Chirag).</li>' +
      '<li>Signed in to <b>their</b> Google account, they open <b>script.new</b>, replace everything with the code and save.</li>' +
      '<li>They click <b>Deploy → New deployment → Web app</b>, set <b>Execute as: Me</b> and <b>Who has access: Anyone</b>, deploy and approve the permission.</li>' +
      '<li>They send back the <b>Web app URL</b> (ends in /exec). Paste it below, choose this option above and save.</li></ol>' +
      '<p class="fine">Signing key: ' + (ig.relaySecretSet ? '<b>' + esc(ig.relaySecretMasked) + '</b>' : 'not generated yet') + '. Generating a new key stops the old Mailer code from working until it is replaced.</p>' +
      '<div class="act-row"><button type="button" class="chip-btn dark" id="mGen">' + (ig.relaySecretSet ? 'Generate new key + code' : 'Generate Mailer code') + '</button></div>' +
      (mailerCode ? '<textarea id="mCode" class="code-box" rows="8" readonly>' + esc(mailerCode) + '</textarea><div class="act-row"><button type="button" class="chip-btn dark" id="mCopy">Copy code</button></div>' : '') +
      field('mUrl', 'Mailer web app URL', ig.relayUrl, 'url') + '</div>' +

      '<div class="scard tr-cfg" data-for="brevo"><h3>Brevo</h3>' +
      field('bvKey', 'API key' + (ig.brevoKeyMasked ? ' (saved ' + ig.brevoKeyMasked + ', leave blank to keep)' : ''), '', 'password', ' autocomplete="off"') +
      field('bvSender', 'Verified sender email', ig.brevoSender, 'email') + '</div>' +

      '<div class="act-row end"><button type="button" class="btn btn-sun" id="igSave">Save email setup</button></div>' +

      '<div class="scard"><h3>Send a test</h3>' + field('tTo', 'Send test to', me.email || '', 'email') +
      '<div class="act-row"><button type="button" class="btn btn-sea" id="tSend">Send test email</button></div>' +
      (ig.lastTest ? '<p class="fine">Last test: ' + esc(ig.lastTest) + '</p>' : '') + '</div>' +

      '<div class="scard"><h3>Automatic jobs</h3>' +
      '<p class="fine">Daily at 8:00 AM IST: staff summary and pre-arrival reminders. Hourly: retry failed emails (up to 3 tries).</p>' +
      '<p>' + (tr.daily && tr.retry ? '🟢 Running' + (tr.installedAt ? ' · installed ' + esc(tr.installedAt) : '') : '⚪ Not installed') + '</p>' +
      '<div class="act-row"><button type="button" class="chip-btn dark" id="trInstall">' + (tr.daily ? 'Reinstall' : 'Install') + ' automatic jobs</button></div></div>';
    syncTr();
  }
  function syncTr() {
    const v = (document.querySelector('input[name="tr"]:checked') || {}).value;
    document.querySelectorAll('.tr-opt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    document.querySelectorAll('.tr-cfg').forEach(c => c.classList.toggle('hidden', c.dataset.for !== v));
  }

  /* ---- notifications ---- */
  const SFIELDS = [
    ['senderName', 'Sender name (shown in the inbox)'], ['replyTo', 'Reply-to email (guest replies go here)'],
    ['staffEmails', 'Staff emails for alerts (comma separated)'], ['siteUrl', 'Website address'],
    ['caretakerName', 'Caretaker name'], ['caretakerPhone', 'Caretaker phone'], ['propertyPhone', 'Property phone'],
    ['checkInTime', 'Check-in time'], ['checkOutTime', 'Check-out time']
  ];
  function renderNotify() {
    const st = sdata.settings;
    $('#sBody').innerHTML =
      '<div class="scard"><h3>Details used in emails</h3><div class="form-grid">' + SFIELDS.map(f => field('sf_' + f[0], f[1], st[f[0]])).join('') + '</div>' +
      '<div class="act-row end"><button type="button" class="btn btn-sea" id="sfSave">Save details</button></div></div>' +
      (sdata.integration.transport === 'off' ? '<p class="form-warn">Email is switched off. Choose a sender under Email setup to start sending.</p>' : '') +
      '<div class="scard"><h3>Emails</h3><div class="tpl-list">' + Object.keys(st.templates).map(k => {
        const t = st.templates[k];
        return '<div class="tpl"><label class="switch"><input type="checkbox" data-tpl-on="' + k + '"' + (t.on ? ' checked' : '') + '><span></span></label>' +
          '<span class="tpl-main"><b>' + esc(t.label) + '</b><small>' + esc(t.audience) + ' · ' + esc(t.when) + (t.customised ? ' · edited' : '') + '</small></span>' +
          '<button type="button" class="chip-btn dark" data-tpl="' + k + '">Edit</button></div>';
      }).join('') + '</div></div>';
  }
  function templateForm(k) {
    const t = sdata.settings.templates[k];
    const body =
      '<p class="fine">' + esc(t.audience) + ' · ' + esc(t.when) + '</p>' +
      field('tpSubject', 'Subject', t.subject) +
      '<div class="field"><textarea id="tpBody" rows="12" placeholder=" ">' + esc(t.body) + '</textarea><label for="tpBody">Message</label></div>' +
      '<p class="fine">Placeholders: {{guestName}} {{guestFirstName}} {{bookingId}} {{checkIn}} {{checkOut}} {{nights}} {{guests}} {{rooms}} {{total}} {{paid}} {{balance}} {{checkinLink}} {{senderName}} {{caretakerName}} {{caretakerPhone}} {{propertyPhone}} {{checkInTime}} {{checkOutTime}}. A line with only a link becomes a button.</p>' +
      '<div class="act-row"><button type="button" class="chip-btn dark" id="tpPreview">Preview</button>' + (t.customised ? '<button type="button" class="chip-btn danger" id="tpReset">Reset to default</button>' : '') + '</div>' +
      '<div id="tpOut"></div>' +
      '<div class="act-row end"><button type="button" class="chip-btn dark" id="tpCancel">Cancel</button><button type="button" class="btn btn-sun" id="tpSave">Save email</button></div>';
    openPanel('tplForm', t.audience + ' email', t.label, '', body);
    $('#pBody').dataset.tpl = k;
  }

  /* ---- activity ---- */
  let actTab = 'audit';
  async function renderActivity() {
    const tabs = '<div class="tabs" id="actTabs"><button type="button" data-a="audit"' + (actTab === 'audit' ? ' class="on"' : '') + '>Changes</button><button type="button" data-a="email"' + (actTab === 'email' ? ' class="on"' : '') + '>Emails</button>' + (isSuper() ? '<button type="button" data-a="deleted"' + (actTab === 'deleted' ? ' class="on"' : '') + '>Deleted</button>' : '') + '</div>';
    $('#sBody').innerHTML = tabs + '<div class="skeleton"></div>';
    if (actTab === 'audit') {
      const r = await call('audit');
      $('#sBody').innerHTML = tabs + (isSuper() ? '' : '<p class="fine">Showing your own actions.</p>') +
        '<div class="log-table">' + (r.rows.length ? r.rows.map(x => '<div class="lrow"><span class="lt">' + esc(x.At) + '</span><span><b>' + esc(x.User) + '</b> ' + esc(x.Action) + ' <em>' + esc(x.Record) + '</em><small>' + esc(x.Summary) + '</small></span></div>').join('') : '<p class="fine">Nothing yet.</p>') + '</div>';
    } else if (actTab === 'deleted') {
      const r = await call('deletedList');
      $('#sBody').innerHTML = tabs + '<p class="fine">A full copy of every deleted record is kept in the "Deleted" tab of the Google Sheet.</p><div class="log-table">' + (r.rows.length ? r.rows.map(x =>
        '<div class="lrow"><span class="lt">' + esc(x['Deleted At']) + '</span><span><b>' + esc(x.By) + '</b> deleted ' + esc(x.Kind) + ' <em>' + esc(x['Record ID']) + '</em><small>' + esc(x.Summary) + '</small></span>' +
        ((x.Kind === 'checkin' || x.Kind === 'booking') && !/^Restored/.test(x.Summary) ? '<button type="button" class="chip-btn dark" data-restore="' + esc(x.Kind) + '|' + esc(x['Record ID']) + '">Restore</button>' : '') + '</div>').join('') : '<p class="fine">Nothing deleted.</p>') + '</div>';
    } else {
      const r = await call('emailLog');
      $('#sBody').innerHTML = tabs + '<div class="log-table">' + (r.rows.length ? r.rows.map(x =>
        '<div class="lrow"><span class="lt">' + esc(x.At) + '</span><span><span class="badge em-' + slug(x.Status) + '">' + esc(x.Status) + '</span> <b>' + esc(x.Subject) + '</b><small>' + esc(x.To) + (x.Booking ? ' · ' + esc(x.Booking) : '') + ' · ' + esc(x.Template) + (x.Transport ? ' · ' + esc(x.Transport) : '') + (x.Error ? ' · ' + esc(x.Error) : '') + '</small></span>' +
        (isSuper() && x.Status !== 'Sent' ? '<button type="button" class="chip-btn dark" data-resend="' + esc(x['Email ID']) + '">Retry</button>' : '') + '</div>').join('') : '<p class="fine">No emails yet.</p>') + '</div>';
    }
  }

  /* ---- settings events ---- */
  $('#sBody').addEventListener('change', e => {
    if (e.target.name === 'tr') { trChoice = e.target.value; return syncTr(); }
    const on = e.target.dataset.tplOn;
    if (on) {
      const box = e.target;
      call('saveSettings', { data: { templates: { [on]: { on: box.checked } } } })
        .then(r => { sdata.settings = r.settings; toast(sdata.settings.templates[on].label + (box.checked ? ' on.' : ' off.')); })
        .catch(err => { box.checked = !box.checked; toast(err.message); });
    }
  });
  $('#sBody').addEventListener('click', async e => {
    const t = e.target;
    const at = t.closest('[data-a]');
    if (at) { actTab = at.dataset.a; return renderActivity().catch(err => toast(err.message)); }
    if (t.id === 'cpSave') {
      const o = $('#cpOld').value, n = $('#cpNew').value;
      if (n.length < 10) return toast('New password must be at least 10 characters.');
      if (n !== $('#cpNew2').value) return toast('The new passwords do not match.');
      return busy(t, async () => { await call('changePassword', { oldPassword: o, newPassword: n }); toast('Password updated.'); renderAccount(); });
    }
    if (t.id === 'uNew') return userForm(null);
    const uc = t.closest('[data-user]');
    if (uc) return userForm(users.find(u => u.username === uc.dataset.user));
    if (t.id === 'mGen') {
      if (sdata.integration.relaySecretSet && !confirmInline(t, 'Replace the key? The current Mailer stops working until updated.')) return;
      return busy(t, async () => { const r = await call('newMailerSecret'); mailerCode = r.code; sdata = await call('settings'); renderEmail(); toast('Mailer code ready. Copy it and send it privately.'); });
    }
    if (t.id === 'mCopy') {
      try { await navigator.clipboard.writeText(mailerCode); toast('Mailer code copied.'); } catch (err) { $('#mCode').select(); toast('Press Ctrl/Cmd + C to copy.'); }
      return;
    }
    if (t.id === 'igSave') {
      const data = { transport: (document.querySelector('input[name="tr"]:checked') || {}).value || 'off', relayUrl: $('#mUrl').value.trim(), brevoSender: $('#bvSender').value.trim() };
      if ($('#bvKey').value.trim()) data.brevoKey = $('#bvKey').value.trim();
      return busy(t, async () => { const r = await call('saveIntegration', { data }); sdata.integration = r; trChoice = ''; renderEmail(); toast('Email setup saved.'); });
    }
    if (t.id === 'tSend') {
      const to = $('#tTo').value.trim();
      if (!to) return toast('Enter an email address.');
      return busy(t, async () => { const r = await call('testEmail', { to }); toast('Test sent to ' + to + (r.remaining != null ? ' · ' + r.remaining + ' left today' : '') + '.'); sdata = await call('settings'); renderEmail(); });
    }
    if (t.id === 'trInstall') return busy(t, async () => { await call('installTriggers'); sdata = await call('settings'); renderEmail(); toast('Automatic jobs installed.'); });
    if (t.id === 'sfSave') {
      const data = {}; SFIELDS.forEach(f => { data[f[0]] = $('#sf_' + f[0]).value.trim(); });
      return busy(t, async () => { const r = await call('saveSettings', { data }); sdata.settings = r.settings; toast('Details saved.'); });
    }
    const tp = t.closest('[data-tpl]');
    if (tp) return templateForm(tp.dataset.tpl);
    const rst = t.closest('[data-restore]');
    if (rst) { const [kind, id] = rst.dataset.restore.split('|'); return busy(rst, async () => { await call('restoreRecord', { kind, id }); toast(id + ' restored.'); await quietReload(); await renderActivity(); }); }
    const rs = t.closest('[data-resend]');
    if (rs) return busy(rs, async () => { await call('resendEmail', { id: rs.dataset.resend }); toast('Email sent.'); await renderActivity(); });
  });
  function confirmInline(btn, text) {
    if (btn.dataset.armed) { delete btn.dataset.armed; return true; }
    btn.dataset.armed = '1'; toast(text + ' Click again to confirm.');
    setTimeout(() => { delete btn.dataset.armed; }, 5000);
    return false;
  }

  /* ---- panel forms: users and templates ---- */
  $('#pBody').addEventListener('click', async e => {
    const t = e.target;
    if (panelMode === 'userForm') {
      if (t.id === 'ufCancel') return $('#panel').close();
      if (t.id === 'ufGen') { $('#ufPass').value = genPass(); return; }
      if (t.id === 'ufDelete') { const un = $('#pBody').dataset.uname; return confirmDelete('user', un, 'Delete user ' + un + '?', 'They are signed out and can no longer sign in. Their past actions stay in the activity log. To pause access instead, set Status to Disabled.', async () => { $('#panel').close(); await openSettings('users'); }); }
      if (t.id === 'ufSave') {
        const existing = $('#pBody').dataset.uname;
        const data = { isNew: !existing, username: existing || $('#ufUser').value.trim().toLowerCase(), name: $('#ufName').value.trim(), email: $('#ufEmail').value.trim(), role: $('#ufRole').value, status: $('#ufStatus').value, password: $('#ufPass').value };
        if (!data.username || !data.name) return toast('Enter the username and name.');
        if ((data.isNew || data.password) && data.password.length < 10) return toast('Password must be at least 10 characters.');
        return busy(t, async () => { await call('saveUser', { data }); $('#panel').close(); toast(data.isNew ? 'User ' + data.username + ' created.' : 'User saved.'); await openSettings('users'); });
      }
    }
    if (panelMode === 'tplForm') {
      const k = $('#pBody').dataset.tpl;
      if (t.id === 'tpCancel') return $('#panel').close();
      if (t.id === 'tpPreview') return busy(t, async () => {
        const r = await call('previewEmail', { key: k, draft: { subject: $('#tpSubject').value, body: $('#tpBody').value } });
        $('#tpOut').innerHTML = '<p class="fine"><b>Subject:</b> ' + esc(r.email.subject) + '</p><iframe class="mail-prev" sandbox="" title="Email preview"></iframe>';
        $('#tpOut iframe').srcdoc = r.email.html;
      });
      const save = (tpl) => busy(t, async () => { const r = await call('saveSettings', { data: { templates: { [k]: tpl } } }); sdata.settings = r.settings; $('#panel').close(); renderNotify(); toast('Email saved.'); });
      if (t.id === 'tpSave') return save({ subject: $('#tpSubject').value, body: $('#tpBody').value });
      if (t.id === 'tpReset') return save({ reset: true });
    }
  });

  /* ---------- check-in PDF ---------- */
  function b64Blob(mime, b64) {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  /** Link that opens a PDF ID proof in a new browser tab. */
  function pdfLink(b64) {
    const url = URL.createObjectURL(b64Blob('application/pdf', b64));
    return '<a class="btn btn-sea pdf-open" target="_blank" rel="noopener" href="' + url + '">📄 Open ID proof (PDF) ↗</a>';
  }
  function saveB64(name, mime, b64) {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function downloadCheckinPdf(id, btn) {
    const label = btn.textContent; btn.disabled = true; btn.textContent = 'Preparing PDF…';
    try {
      const r = await call('checkinPdf', { id });
      saveB64(r.name, r.mime || 'application/pdf', r.data);
      toast(r.kind === 'zip' ? 'Zip downloaded: check-in PDF + ' + (r.count - 1) + ' PDF ID file(s).' : 'PDF downloaded.');
    } catch (err) { toast(err.message); }
    finally { btn.disabled = false; btn.textContent = label; }
  }

  /* ---------- delete (Super admin) ---------- */
  let cfJob = null;
  function confirmDelete(kind, id, title, text, after) {
    cfJob = { kind, id, after };
    $('#cfTitle').textContent = title;
    $('#cfText').textContent = text;
    $('#cfInput').value = ''; $('#cfGo').disabled = true;
    $('#confirmDlg').showModal();
    $('#cfInput').focus();
  }
  $('#cfInput').addEventListener('input', () => { $('#cfGo').disabled = $('#cfInput').value.trim().toUpperCase() !== 'DELETE'; });
  $('#cfCancel').addEventListener('click', () => $('#confirmDlg').close());
  $('#cfGo').addEventListener('click', async () => {
    const job = cfJob, btn = $('#cfGo');
    if (!job) return;
    btn.disabled = true; btn.textContent = 'Deleting…';
    try {
      await call('deleteRecord', { kind: job.kind, id: job.id });
      $('#confirmDlg').close();
      toast('Deleted.');
      if (job.after) await job.after();
      await quietReload();
    } catch (err) { toast(err.message); btn.disabled = false; }
    finally { btn.textContent = 'Delete permanently'; }
  });

  /* ---------- init ---------- */
  if (token) { setView(true); load().catch(err => toast(err.message)); } else setView(false);
})();
