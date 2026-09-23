/**
 * Swarga by the Bay — Bookings, Rooms and Payments.
 * Sheets: Bookings, Rooms, Payments (created automatically on first use).
 *
 * Booking status: Requested -> Confirmed -> Checked in -> Checked out
 *                 (or Cancelled / No-show at any point before check-out)
 * A room is blocked by bookings that are Confirmed or Checked in.
 */

const BOOKINGS = 'Bookings';
const ROOMS = 'Rooms';
const PAYMENTS = 'Payments';

const BOOKING_HEADERS = [
  'Booking ID', 'Created At', 'Source', 'Status',
  'Guest Name', 'Mobile', 'Email', 'Adults', 'Children',
  'Check-in Date', 'Check-out Date', 'Nights', 'Room IDs',
  'Room Charges', 'Discount', 'Total', 'Paid', 'Payment Status',
  'Special Requests', 'Internal Notes', 'Check-in Ref',
  'Cancel Reason', 'Updated At', 'Updated By'
];
const ROOM_HEADERS = ['Room ID', 'Name', 'Type', 'Capacity', 'Rate', 'Status', 'Description', 'Internal Notes', 'Sort', 'Photos'];
const PAYMENT_HEADERS = ['Payment ID', 'Booking ID', 'Recorded At', 'Kind', 'Amount', 'Mode', 'Reference', 'Note', 'Recorded By'];

const BLOCKING = ['Confirmed', 'Checked in'];
const BOOKING_STATUSES = ['Requested', 'Confirmed', 'Checked in', 'Checked out', 'Cancelled', 'No-show'];
const SOURCES = ['Website', 'Phone', 'WhatsApp', 'Walk-in', 'OTA', 'Other'];
const PAY_MODES = ['UPI', 'Cash', 'Bank transfer', 'Card', 'OTA', 'Other'];

/* ---------- generic table helpers ---------- */

function table_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < headers.length) {
    const w = sh.getLastColumn();
    sh.getRange(1, w + 1, 1, headers.length - w).setValues([headers.slice(w)]).setFontWeight('bold');
  }
  return sh;
}

function readAll_(name, headers) {
  const sh = table_(name, headers);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const vals = sh.getRange(2, 1, n, headers.length).getDisplayValues();
  return vals.map((r, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, j) => { o[h] = r[j]; });
    return o;
  }).filter(o => o[headers[0]]);
}

function findBy_(name, headers, id) {
  const hit = readAll_(name, headers).filter(o => o[headers[0]] === id)[0];
  if (!hit) throw new Error('Record not found: ' + id);
  return hit;
}

function writeFields_(name, headers, rowNum, fields) {
  const sh = table_(name, headers);
  Object.keys(fields).forEach(k => {
    const c = headers.indexOf(k);
    if (c > -1) sh.getRange(rowNum, c + 1).setValue(fields[k]);
  });
}

function appendObj_(name, headers, obj) {
  table_(name, headers).appendRow(headers.map(h => obj[h] === undefined ? '' : obj[h]));
}

function stamp_() { return "'" + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm'); }
function newId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
}
function isoOk_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function nightsOf_(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5); }
function money_(v) { const n = Number(String(v || '0').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : Math.round(n * 100) / 100; }
function roomList_(v) { return (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(Boolean); }
function todayIso_() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }

/* ---------- rooms ---------- */

function publicRooms_() {
  const rooms = readAll_(ROOMS, ROOM_HEADERS).filter(r => r.Status === 'Active')
    .sort((a, b) => (Number(a.Sort) || 99) - (Number(b.Sort) || 99))
    .map(r => ({ id: r['Room ID'], name: r.Name, type: r.Type, capacity: Number(r.Capacity) || 0, rate: money_(r.Rate), description: r.Description, photos: photoList_(r.Photos).map(photoRef_) }));
  return { ok: true, rooms: rooms };
}

function saveRoom_(d, sess) {
  const name = clean_(d.name);
  if (!name) throw new Error('Room name is required.');
  const status = ['Active', 'Maintenance', 'Inactive'].indexOf(d.status) > -1 ? d.status : 'Active';
  const fields = {
    'Name': name, 'Type': clean_(d.type), 'Capacity': Math.max(1, num_(d.capacity) || 1),
    'Rate': money_(d.rate), 'Status': status, 'Description': clean_(d.description),
    'Internal Notes': clean_(d.notes), 'Sort': num_(d.sort)
  };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (d.id) {
      const r = findBy_(ROOMS, ROOM_HEADERS, d.id);
      writeFields_(ROOMS, ROOM_HEADERS, r._row, fields);
      audit_(sess, 'room.update', d.id, name + ' · ' + status);
      return { ok: true, id: d.id };
    }
    const id = 'R' + String(readAll_(ROOMS, ROOM_HEADERS).length + 1).padStart(2, '0') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase();
    fields['Room ID'] = id;
    appendObj_(ROOMS, ROOM_HEADERS, fields);
    audit_(sess, 'room.create', id, name);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

/* ---------- availability ---------- */

function overlaps_(a1, b1, a2, b2) { return a1 < b2 && a2 < b1; } // [in, out) ranges

function conflicts_(rooms, from, to, ignoreId) {
  if (!rooms.length) return [];
  return readAll_(BOOKINGS, BOOKING_HEADERS).filter(b =>
    b['Booking ID'] !== ignoreId && BLOCKING.indexOf(b.Status) > -1 &&
    overlaps_(from, to, b['Check-in Date'], b['Check-out Date']) &&
    roomList_(b['Room IDs']).some(r => rooms.indexOf(r) > -1));
}

function availability_(from, to) {
  if (!isoOk_(from) || !isoOk_(to) || to <= from) throw new Error('Choose valid dates.');
  const active = readAll_(ROOMS, ROOM_HEADERS).filter(r => r.Status === 'Active').map(r => r['Room ID']);
  const busy = {};
  readAll_(BOOKINGS, BOOKING_HEADERS).forEach(b => {
    if (BLOCKING.indexOf(b.Status) > -1 && overlaps_(from, to, b['Check-in Date'], b['Check-out Date'])) {
      roomList_(b['Room IDs']).forEach(r => { busy[r] = true; });
    }
  });
  return { ok: true, available: active.filter(r => !busy[r]) };
}

/* ---------- bookings ---------- */

function priceFor_(rooms, nights) {
  const all = readAll_(ROOMS, ROOM_HEADERS);
  return rooms.reduce((sum, id) => {
    const r = all.filter(x => x['Room ID'] === id)[0];
    return sum + (r ? money_(r.Rate) : 0);
  }, 0) * nights;
}

function validateBookingInput_(d) {
  if (!clean_(d.guestName)) throw new Error('Guest name is required.');
  if (!/^\+?[0-9 ]{8,16}$/.test(String(d.mobile || '').trim())) throw new Error('Enter a valid mobile number.');
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) throw new Error('Invalid email.');
  if (!isoOk_(d.checkIn) || !isoOk_(d.checkOut) || d.checkOut <= d.checkIn) throw new Error('Check-out must be after check-in.');
  if (num_(d.adults) < 1) throw new Error('At least one adult is required.');
}

/** Public booking request from the website (status Requested, does not block rooms). */
function requestBooking_(d) {
  if (d.website) return { ok: true, id: 'OK' }; // honeypot: bots fill hidden field
  validateBookingInput_(d);
  if (!String(d.email || '').trim()) throw new Error('Email is required.');
  if (d.checkIn < todayIso_()) throw new Error('Check-in date is in the past.');
  const key = 'req_' + String(d.mobile).replace(/\D/g, '').slice(-10);
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key) || 0);
  if (n >= 3) throw new Error('Too many requests from this number. Please call us instead.');
  cache.put(key, String(n + 1), 3600);

  const active = readAll_(ROOMS, ROOM_HEADERS).filter(r => r.Status === 'Active').map(r => r['Room ID']);
  const rooms = roomList_(d.rooms).filter(r => active.indexOf(r) > -1);
  const nights = nightsOf_(d.checkIn, d.checkOut);
  const charges = priceFor_(rooms, nights);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let id;
  try {
    id = newId_('SBK');
    appendObj_(BOOKINGS, BOOKING_HEADERS, {
      'Booking ID': id, 'Created At': stamp_(), 'Source': 'Website', 'Status': 'Requested',
      'Guest Name': clean_(d.guestName), 'Mobile': txt_(d.mobile), 'Email': clean_(d.email),
      'Adults': num_(d.adults), 'Children': num_(d.children),
      'Check-in Date': txt_(d.checkIn), 'Check-out Date': txt_(d.checkOut), 'Nights': nights,
      'Room IDs': rooms.join(', '), 'Room Charges': charges, 'Discount': 0, 'Total': charges,
      'Paid': 0, 'Payment Status': 'Unpaid', 'Special Requests': clean_(d.requests),
      'Updated At': stamp_(), 'Updated By': 'Guest (website)'
    });
  } finally { lock.releaseLock(); }
  const b = findBy_(BOOKINGS, BOOKING_HEADERS, id);
  notify_('requestReceived', b, { once: true });
  notify_('staffNewRequest', b, { once: true });
  return { ok: true, id: id, total: charges, nights: nights };
}

/** Admin create / edit. */
function saveBooking_(d, sess) {
  const staff = sess.name;
  validateBookingInput_(d);
  const status = BOOKING_STATUSES.indexOf(d.status) > -1 ? d.status : 'Confirmed';
  const rooms = roomList_(d.rooms);
  const nights = nightsOf_(d.checkIn, d.checkOut);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let id = d.id;
  try {
    if (BLOCKING.indexOf(status) > -1) {
      const c = conflicts_(rooms, d.checkIn, d.checkOut, d.id || '');
      if (c.length) throw new Error('Room clash with ' + c.map(b => b['Booking ID'] + ' (' + b['Guest Name'] + ')').join(', '));
    }
    const charges = d.charges === '' || d.charges == null ? priceFor_(rooms, nights) : money_(d.charges);
    const discount = money_(d.discount);
    const total = Math.max(0, charges - discount);
    const fields = {
      'Source': SOURCES.indexOf(d.source) > -1 ? d.source : 'Phone', 'Status': status,
      'Guest Name': clean_(d.guestName), 'Mobile': txt_(d.mobile), 'Email': clean_(d.email),
      'Adults': num_(d.adults), 'Children': num_(d.children),
      'Check-in Date': txt_(d.checkIn), 'Check-out Date': txt_(d.checkOut), 'Nights': nights,
      'Room IDs': rooms.join(', '), 'Room Charges': charges, 'Discount': discount, 'Total': total,
      'Special Requests': clean_(d.requests), 'Internal Notes': clean_(d.notes),
      'Updated At': stamp_(), 'Updated By': clean_(staff)
    };
    if (id) {
      const b = findBy_(BOOKINGS, BOOKING_HEADERS, id);
      writeFields_(BOOKINGS, BOOKING_HEADERS, b._row, fields);
    } else {
      id = newId_('SBK');
      fields['Booking ID'] = id;
      fields['Created At'] = stamp_();
      fields['Paid'] = 0;
      appendObj_(BOOKINGS, BOOKING_HEADERS, fields);
    }
    refreshPaid_(id);
    audit_(sess, d.id ? 'booking.update' : 'booking.create', id, fields['Guest Name'] + ' · ' + fields['Check-in Date'] + ' → ' + fields['Check-out Date'] + ' · ' + status);
  } finally { lock.releaseLock(); }
  if (!d.id && status === 'Confirmed' && d.notifyGuest !== false) notify_('bookingConfirmed', findBy_(BOOKINGS, BOOKING_HEADERS, id), { once: true });
  return { ok: true, id: id };
}

/** Status moves from the Bookings screen. Keeps the linked guest-log row in sync. */
function bookingStatus_(id, status, reason, sess, notifyGuest) {
  const staff = sess.name;
  if (BOOKING_STATUSES.indexOf(status) === -1) throw new Error('Unknown status.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let from;
  try {
    const b = findBy_(BOOKINGS, BOOKING_HEADERS, id);
    const rooms = roomList_(b['Room IDs']);
    if (status === 'Confirmed' || status === 'Checked in') {
      const activeCount = readAll_(ROOMS, ROOM_HEADERS).filter(r => r.Status === 'Active').length;
      if (activeCount && !rooms.length) throw new Error('Assign a room before confirming.');
      const c = conflicts_(rooms, b['Check-in Date'], b['Check-out Date'], id);
      if (c.length) throw new Error('Room clash with ' + c.map(x => x['Booking ID'] + ' (' + x['Guest Name'] + ')').join(', '));
    }
    const ALLOWED = {
      'Requested': ['Confirmed', 'Cancelled'],
      'Confirmed': ['Checked in', 'Cancelled', 'No-show', 'Requested'],
      'Checked in': ['Checked out', 'Confirmed'],
      'Checked out': ['Checked in'],
      'Cancelled': ['Requested', 'Confirmed'],
      'No-show': ['Confirmed', 'Cancelled']
    };
    from = b.Status;
    if ((ALLOWED[b.Status] || []).indexOf(status) === -1) throw new Error('Cannot move a ' + b.Status + ' booking to ' + status + '.');
    if ((status === 'Cancelled' || status === 'No-show') && !clean_(reason)) throw new Error('Please give a reason.');
    const fields = { 'Status': status, 'Updated At': stamp_(), 'Updated By': clean_(staff) };
    if (status === 'Cancelled' || status === 'No-show') fields['Cancel Reason'] = clean_(reason);
    writeFields_(BOOKINGS, BOOKING_HEADERS, b._row, fields);

    // Mirror into the guest log (CheckIns) if a check-in form is linked.
    const ref = b['Check-in Ref'];
    if (ref && (status === 'Checked in' || status === 'Checked out' || status === 'Confirmed')) {
      syncStayFromBooking_(ref, status, staff);
    }
    audit_(sess, 'booking.status', id, from + ' → ' + status + (reason ? ' · ' + clean_(reason) : ''));
  } finally { lock.releaseLock(); }
  if (notifyGuest !== false) statusEmail_(id, from, status);
  return { ok: true };
}

/** Guest email for a status change. Each template goes out at most once per booking. */
function statusEmail_(id, from, status) {
  const key = status === 'Confirmed' && ['Requested', 'Cancelled', 'No-show'].indexOf(from) > -1 ? 'bookingConfirmed'
    : (status === 'Cancelled' || status === 'No-show') ? 'bookingCancelled'
    : status === 'Checked out' ? 'thankYou' : '';
  if (!key) return;
  const b = readAll_(BOOKINGS, BOOKING_HEADERS).filter(x => x['Booking ID'] === id)[0];
  if (b) notify_(key, b, { once: key !== 'bookingCancelled' });
}

function syncStayFromBooking_(submissionId, bookingStatus, staff) {
  const sh = sheet_();
  let r;
  try { r = findRow_(submissionId); } catch (e) { return; }
  const c = (n) => HEADERS.indexOf(n) + 1;
  const now = stamp_();
  const cur = String(sh.getRange(r, c('Stay Status')).getValue() || 'Expected');
  if (bookingStatus === 'Checked in' && cur === 'Expected') {
    sh.getRange(r, c('Stay Status'), 1, 3).setValues([['Checked in', now, clean_(staff)]]);
  } else if (bookingStatus === 'Checked out' && cur !== 'Checked out') {
    if (cur === 'Expected') sh.getRange(r, c('Stay Status'), 1, 3).setValues([['Checked in', now, clean_(staff)]]);
    sh.getRange(r, c('Stay Status')).setValue('Checked out');
    sh.getRange(r, c('Actual Check-out'), 1, 2).setValues([[now, clean_(staff)]]);
  } else if (bookingStatus === 'Confirmed' && cur !== 'Expected') {
    sh.getRange(r, c('Stay Status'), 1, 5).setValues([['Expected', '', '', '', '']]);
  }
}

/** Called from stay_() in Code.gs when a guest-log row changes. */
function syncBookingFromStay_(submissionId, stayStatus, staff) {
  const b = readAll_(BOOKINGS, BOOKING_HEADERS).filter(x => x['Check-in Ref'] === submissionId)[0];
  if (!b || b.Status === 'Cancelled' || b.Status === 'No-show') return;
  const map = { 'Expected': 'Confirmed', 'Checked in': 'Checked in', 'Checked out': 'Checked out' };
  const next = map[stayStatus];
  if (next && next !== b.Status) {
    writeFields_(BOOKINGS, BOOKING_HEADERS, b._row, { 'Status': next, 'Updated At': stamp_(), 'Updated By': clean_(staff) });
    if (next === 'Checked out') { b.Status = next; notify_('thankYou', b, { once: true }); }
  }
}

/** Public: prefill for the check-in form from a booking code. */
function bookingForCheckin_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^SBK-\d{6}-[A-Z0-9]{6}$/.test(code)) throw new Error('Invalid booking code.');
  const b = readAll_(BOOKINGS, BOOKING_HEADERS).filter(x => x['Booking ID'] === code)[0];
  if (!b || ['Cancelled', 'No-show', 'Checked out'].indexOf(b.Status) > -1) throw new Error('Booking not found or no longer active.');
  const rooms = readAll_(ROOMS, ROOM_HEADERS);
  const names = roomList_(b['Room IDs']).map(id => (rooms.filter(r => r['Room ID'] === id)[0] || {}).Name || id);
  return {
    ok: true, booking: {
      id: code, guestName: b['Guest Name'], checkIn: b['Check-in Date'], checkOut: b['Check-out Date'],
      adults: Number(b.Adults) || 1, children: Number(b.Children) || 0, rooms: names,
      alreadyCheckedIn: !!b['Check-in Ref']
    }
  };
}

/** Link a guest-log submission to its booking (called from submit_). */
function linkCheckin_(bookingId, submissionId, email) {
  const b = readAll_(BOOKINGS, BOOKING_HEADERS).filter(x => x['Booking ID'] === bookingId)[0];
  if (!b) return null;
  const fields = { 'Check-in Ref': submissionId, 'Updated At': stamp_() };
  if (!b.Email && email) { fields.Email = email; b.Email = email; }
  writeFields_(BOOKINGS, BOOKING_HEADERS, b._row, fields);
  b['Check-in Ref'] = submissionId;
  return b;
}

/* ---------- payments ---------- */

function addPayment_(d, sess) {
  const staff = sess.name;
  const amount = money_(d.amount);
  if (!(amount > 0)) throw new Error('Enter an amount greater than 0.');
  const kind = d.kind === 'Refund' ? 'Refund' : 'Payment';
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let payId, res;
  try {
    findBy_(BOOKINGS, BOOKING_HEADERS, d.bookingId);
    payId = newId_('PAY');
    appendObj_(PAYMENTS, PAYMENT_HEADERS, {
      'Payment ID': payId, 'Booking ID': d.bookingId, 'Recorded At': stamp_(), 'Kind': kind,
      'Amount': kind === 'Refund' ? -amount : amount, 'Mode': PAY_MODES.indexOf(d.mode) > -1 ? d.mode : 'Other',
      'Reference': clean_(d.reference), 'Note': clean_(d.note), 'Recorded By': clean_(staff)
    });
    res = Object.assign({ ok: true }, refreshPaid_(d.bookingId));
    audit_(sess, kind === 'Refund' ? 'payment.refund' : 'payment.add', d.bookingId, inr_(amount) + ' · ' + (PAY_MODES.indexOf(d.mode) > -1 ? d.mode : 'Other'));
  } finally { lock.releaseLock(); }
  if (d.notifyGuest !== false) {
    const p = readAll_(PAYMENTS, PAYMENT_HEADERS).filter(x => x['Payment ID'] === payId)[0];
    if (p) notify_('paymentReceipt', findBy_(BOOKINGS, BOOKING_HEADERS, d.bookingId), { extra: paymentVars_(p) });
  }
  return res;
}

/** "Mark as paid": records the outstanding balance as one payment. */
function markPaid_(d, sess) {
  const b = findBy_(BOOKINGS, BOOKING_HEADERS, d.bookingId);
  const bal = money_(b.Total) - paidFor_(d.bookingId);
  if (bal <= 0) throw new Error('Nothing outstanding on this booking.');
  return addPayment_({ bookingId: d.bookingId, amount: bal, mode: d.mode, reference: d.reference, note: 'Balance settled', notifyGuest: d.notifyGuest }, sess);
}

function paidFor_(bookingId) {
  return readAll_(PAYMENTS, PAYMENT_HEADERS).filter(p => p['Booking ID'] === bookingId)
    .reduce((s, p) => s + money_(p.Amount), 0);
}

function refreshPaid_(bookingId) {
  const b = findBy_(BOOKINGS, BOOKING_HEADERS, bookingId);
  const paid = paidFor_(bookingId);
  const total = money_(b.Total);
  const hasRefund = readAll_(PAYMENTS, PAYMENT_HEADERS).some(p => p['Booking ID'] === bookingId && p.Kind === 'Refund');
  const status = paid <= 0 ? (hasRefund ? 'Refunded' : 'Unpaid') : paid >= total ? 'Paid' : 'Partial';
  writeFields_(BOOKINGS, BOOKING_HEADERS, b._row, { 'Paid': paid, 'Payment Status': status });
  return { paid: paid, paymentStatus: status };
}

/* ---------- admin snapshot ---------- */

function adminData_() {
  const log = list_();
  return {
    ok: true,
    log: { headers: log.headers, rows: log.rows },
    bookings: readAll_(BOOKINGS, BOOKING_HEADERS).map(strip_).reverse(),
    rooms: readAll_(ROOMS, ROOM_HEADERS).map(strip_),
    payments: readAll_(PAYMENTS, PAYMENT_HEADERS).map(strip_),
    options: { statuses: BOOKING_STATUSES, sources: SOURCES, modes: PAY_MODES },
    today: todayIso_()
  };
}
function strip_(o) { const c = Object.assign({}, o); delete c._row; return c; }

/* ---------- room photos ---------- */
// Photos column: comma-separated Drive file IDs, first is the cover.
// "p:<id>" marks a file that could not be shared publicly; it is served through the roomPhoto action instead.
const MAX_ROOM_PHOTOS = 6;
const MAX_ROOM_PHOTO_BYTES = 3 * 1024 * 1024;

function photoList_(v) { return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }
function photoRef_(p) {
  const priv = p.indexOf('p:') === 0, id = priv ? p.slice(2) : p;
  return { id: id, url: priv ? '' : 'https://lh3.googleusercontent.com/d/' + id + '=w1600' };
}

function roomPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ROOM_PHOTO_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const masterId = props.getProperty('MASTER_FOLDER_ID');
  const parent = masterId ? DriveApp.getFolderById(masterId) : DriveApp.getRootFolder();
  const folder = parent.createFolder('Room Photos');
  props.setProperty('ROOM_PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function addRoomPhoto_(roomId, photo, sess) {
  if (!photo || !photo.data) throw new Error('Choose a photo.');
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(photo.mime) === -1) throw new Error('Photos must be JPG, PNG or WebP.');
  const bytes = Utilities.base64Decode(photo.data);
  if (bytes.length > MAX_ROOM_PHOTO_BYTES) throw new Error('Photo is larger than 3 MB.');
  const r = findBy_(ROOMS, ROOM_HEADERS, roomId);
  const list = photoList_(r.Photos);
  if (list.length >= MAX_ROOM_PHOTOS) throw new Error('A room can have up to ' + MAX_ROOM_PHOTOS + ' photos.');
  const ext = photo.mime === 'image/png' ? 'png' : photo.mime === 'image/webp' ? 'webp' : 'jpg';
  const file = roomPhotoFolder_().createFile(Utilities.newBlob(bytes, photo.mime, roomId + '_' + clean_(r.Name).replace(/[^\w]+/g, '_') + '_' + Date.now() + '.' + ext));
  let ref = file.getId();
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { ref = 'p:' + ref; } // domain policy blocks public links: serve through the app
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const fresh = photoList_(findBy_(ROOMS, ROOM_HEADERS, roomId).Photos);
    fresh.push(ref);
    writeFields_(ROOMS, ROOM_HEADERS, r._row, { 'Photos': fresh.join(', ') });
    audit_(sess, 'room.photo.add', roomId, r.Name + (ref.indexOf('p:') === 0 ? ' (private)' : ''));
    return { ok: true, photos: fresh.map(photoRef_) };
  } finally { lock.releaseLock(); }
}

function roomPhotoAction_(roomId, fileId, op, sess) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const r = findBy_(ROOMS, ROOM_HEADERS, roomId);
    const list = photoList_(r.Photos);
    const i = list.findIndex(p => p === fileId || p === 'p:' + fileId);
    if (i === -1) throw new Error('Photo not found.');
    const item = list.splice(i, 1)[0];
    if (op === 'cover') list.unshift(item);
    else if (op === 'remove') { try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {} }
    else throw new Error('Unknown photo action.');
    writeFields_(ROOMS, ROOM_HEADERS, r._row, { 'Photos': list.join(', ') });
    audit_(sess, 'room.photo.' + op, roomId, r.Name);
    return { ok: true, photos: list.map(photoRef_) };
  } finally { lock.releaseLock(); }
}

/** Public: only serves files that belong to an active room's photo list. */
function roomPhoto_(fileId, token) {
  fileId = String(fileId || '');
  let staff = false;
  if (token) { try { requireAdmin_(token); staff = true; } catch (e) {} }
  const owned = readAll_(ROOMS, ROOM_HEADERS).some(r => (staff || r.Status === 'Active') && photoList_(r.Photos).some(p => p === fileId || p === 'p:' + fileId));
  if (!owned) throw new Error('Photo not found.');
  const blob = DriveApp.getFileById(fileId).getBlob();
  return { ok: true, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}
