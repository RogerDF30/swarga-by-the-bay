/**
 * Swarga by the Bay — Guest Check-In API (Google Apps Script)
 * Storage: bound Google Sheet (tab "CheckIns") + Drive folder for ID photos.
 * Front end (Cloudflare Pages) POSTs JSON as text/plain to avoid CORS preflight.
 *
 * Script Properties (set by running setup() / setAdmin() once):
 *   ADMIN_USER, ADMIN_SALT, ADMIN_HASH, ID_FOLDER_ID, MASTER_FOLDER_ID (optional)
 */

const SHEET_NAME = 'CheckIns';
const TOKEN_TTL_SEC = 6 * 60 * 60;      // admin session: 6 h
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB after client compression
const MAX_LOGIN_FAILS = 5;              // per 15 min

const HEADERS = [
  'Submission ID', 'Submitted At',
  'Guest Name', 'Mobile', 'Email', 'Adults', 'Children', 'Vehicles',
  'Check-in Date', 'Check-in Time', 'Check-out Date', 'Check-out Time',
  'ID Type', 'ID Number', 'ID Photo File ID',
  'Emergency Contact Name', 'Emergency Contact No.',
  'Ack House Rules', 'Ack Sea Safety', 'Ack Weather', 'Ack Liability', 'Ack Data Consent',
  'Group Booking', 'Lead Guest Name',
  'Declaration Name', 'Declaration Agreed',
  'Rep Name', 'Rep Verified At', 'Status', 'User Agent',
  'Vehicle Numbers',   // columns below were appended later; keep new columns at the end
  'Stay Status', 'Actual Check-in', 'Checked-in By', 'Actual Check-out', 'Checked-out By',
  'Booking ID', 'Other Guests'
];
const GUESTS = 'Guests';
const GUEST_HEADERS = ['Guest ID', 'Submission ID', 'No.', 'Kind', 'Name', 'Age', 'ID Type', 'ID Number', 'ID Photo File ID', 'Added At'];
const ID_TYPES = ['Aadhaar', 'Passport', 'Driving Licence', 'Voter ID', 'PAN', 'Other'];

/* ---------- one-time setup ---------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Kolkata');
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  const props = PropertiesService.getScriptProperties();
  // Optional MASTER_FOLDER_ID: Sheet + ID proofs folder live inside it.
  const masterId = props.getProperty('MASTER_FOLDER_ID');
  const master = masterId ? DriveApp.getFolderById(masterId) : DriveApp.getRootFolder();
  if (masterId) DriveApp.getFileById(ss.getId()).moveTo(master);
  if (!props.getProperty('ID_FOLDER_ID')) {
    const folder = master.createFolder('Guest ID Proofs');
    props.setProperty('ID_FOLDER_ID', folder.getId());
  }
  Logger.log('Setup done. Now edit and run setAdmin().');
}

/** Edit the two values, run once, then clear them from the code. */
function setAdmin() {
  const USER = 'CHANGE_ME';
  const PASS = 'CHANGE_ME';
  if (USER === 'CHANGE_ME' || PASS.length < 10) throw new Error('Set USER and a password of 10+ characters.');
  const salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({
    ADMIN_USER: USER,
    ADMIN_SALT: salt,
    ADMIN_HASH: sha256_(salt + PASS)
  });
  Logger.log('Admin credentials saved. Remove the password from this function now.');
}

/* ---------- routing ---------- */

function doGet() {
  return json_({ ok: true, service: 'swarga-checkin' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const a = body.action;

    // public
    switch (a) {
      case 'submit':       return json_(submit_(body.data || {}));
      case 'login':        return json_(login_(body.username, body.password));
      case 'rooms':        return json_(publicRooms_());
      case 'availability': return json_(availability_(body.from, body.to));
      case 'request':      return json_(requestBooking_(body.data || {}));
      case 'booking':      return json_(bookingForCheckin_(body.code));
      case 'roomPhoto':    return json_(roomPhoto_(body.id, body.token));
    }

    // Super admin only
    const SUPER = {
      users:           (b, s) => listUsers_(),
      saveUser:        (b, s) => saveUser_(b.data || {}, s),
      settings:        (b, s) => ({ ok: true, settings: getSettings_(), integration: getIntegration_(), triggers: triggerStatus_() }),
      saveSettings:    (b, s) => saveSettings_(b.data || {}, s),
      saveIntegration: (b, s) => saveIntegration_(b.data || {}, s),
      newMailerSecret: (b, s) => newMailerSecret_(s),
      testEmail:       (b, s) => testEmail_(b.to, s),
      previewEmail:    (b, s) => previewEmail_(b.key, b.draft),
      installTriggers: (b, s) => installTriggers_(s),
      resendEmail:     (b, s) => resendEmail_(b.id, s),
      deleteRecord:    (b, s) => deleteRecord_(b.kind, b.id, s),
      deletedList:     (b, s) => deletedList_()
    };
    if (SUPER[a]) return json_(SUPER[a](body, requireSuper_(body.token)));

    // any signed-in user (staff name comes from the session, never from the client)
    const ADMIN = {
      me:             (b, s) => ({ ok: true, user: { username: s.u, name: s.name, role: s.role } }),
      logout:         (b, s) => { CacheService.getScriptCache().remove('tok_' + b.token); audit_(s, 'logout', s.u, ''); return { ok: true }; },
      changePassword: (b, s) => changePassword_(s, b.oldPassword, b.newPassword),
      audit:          (b, s) => auditList_(s),
      emailLog:       (b, s) => emailLog_(),
      sendForBooking: (b, s) => sendForBooking_(b.key, b.id, s),
      list:           (b, s) => list_(),
      photo:          (b, s) => photo_(b.id),
      guests:         (b, s) => ({ ok: true, guests: guestsOf_(b.id) }),
      guestPhoto:     (b, s) => guestPhoto_(b.id),
      verify:         (b, s) => verify_(b.id, s),
      vehicles:       (b, s) => updateVehicles_(b.id, b.count, b.numbers, s),
      stay:           (b, s) => stay_(b.id, b.move, s),
      data:           (b, s) => Object.assign(adminData_(), { user: { username: s.u, name: s.name, role: s.role } }),
      saveRoom:       (b, s) => saveRoom_(b.data || {}, s),
      addRoomPhoto:   (b, s) => addRoomPhoto_(b.id, b.photo, s),
      roomPhotoOp:    (b, s) => roomPhotoAction_(b.id, b.fileId, b.op, s),
      saveBooking:    (b, s) => saveBooking_(b.data || {}, s),
      bookingStatus:  (b, s) => bookingStatus_(b.id, b.status, b.reason, s, b.notifyGuest),
      addPayment:     (b, s) => addPayment_(b.data || {}, s),
      markPaid:       (b, s) => markPaid_(b.data || {}, s)
    };
    if (ADMIN[a]) return json_(ADMIN[a](body, requireAdmin_(body.token)));

    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/* ---------- guest submit ---------- */

function submit_(d) {
  const req = ['guestName', 'mobile', 'adults', 'checkInDate', 'checkOutDate',
               'idType', 'emergencyName', 'emergencyPhone', 'declarationName'];
  req.forEach(k => { if (!String(d[k] || '').trim()) throw new Error('Missing field: ' + k); });
  if (!String(d.email || '').trim()) throw new Error('Email is required.');
  if (!d.idPhoto || !d.idPhoto.data) throw new Error('Please add a photo of your ID proof.');
  const vehCount = num_(d.vehicles);
  const vehNums = (Array.isArray(d.vehicleNumbers) ? d.vehicleNumbers : String(d.vehicleNumbers || '').split(',')).map(v => String(v).trim()).filter(Boolean);
  if (vehCount > 0 && vehNums.length < vehCount) throw new Error('Please enter the number of every vehicle (' + vehCount + ').');
  const others = checkOtherGuests_(d);
  ['ackHouse', 'ackSea', 'ackWeather', 'ackLiability', 'ackData', 'declarationAgreed']
    .forEach(k => { if (d[k] !== true) throw new Error('All acknowledgements are required.'); });
  if (!/^\+?[0-9 ]{8,16}$/.test(d.mobile)) throw new Error('Invalid mobile number.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email).trim())) throw new Error('Invalid email.');
  if (d.checkOutDate < d.checkInDate) throw new Error('Check-out is before check-in.');

  let booking = null;
  const bookingId = /^SBK-\d{6}-[A-Z0-9]{6}$/.test(String(d.bookingId || '').toUpperCase()) ? String(d.bookingId).toUpperCase() : '';
  const id = 'SBB-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd') + '-' +
             Utilities.getUuid().slice(0, 6).toUpperCase();
  // Save ID files before taking the lock: uploads are slow and must not block other guests.
  const fileId = savePhoto_(id, d.guestName, d.idPhoto);
  others.forEach((g, i) => { g.fileId = g.idPhoto ? savePhoto_(id + '-G' + (i + 2), g.name, g.idPhoto) : ''; });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {

    const row = [
      id, new Date(),
      clean_(d.guestName), txt_(d.mobile), clean_(d.email),
      num_(d.adults), num_(d.children), num_(d.vehicles),
      txt_(d.checkInDate), txt_(d.checkInTime), txt_(d.checkOutDate), txt_(d.checkOutTime),
      clean_(d.idType), txt_(d.idNumber), fileId,
      clean_(d.emergencyName), txt_(d.emergencyPhone),
      'Yes', 'Yes', 'Yes', 'Yes', 'Yes',
      d.groupBooking ? 'Yes' : 'No', clean_(d.leadGuestName),
      clean_(d.declarationName), 'Yes',
      '', '', 'Pending', clean_(d.userAgent).slice(0, 200),
      plates_(d.vehicleNumbers),
      'Expected', '', '', '', '',
      bookingId,
      others.map(g => g.name + (g.kind === 'Child' ? ' (child, ' + g.age + ')' : ' (' + g.idType + ')')).join('; ')
    ];
    others.forEach((g, i) => {
      appendObj_(GUESTS, GUEST_HEADERS, {
        'Guest ID': id + '-G' + (i + 2), 'Submission ID': id, 'No.': i + 2, 'Kind': g.kind, 'Name': g.name,
        'Age': g.kind === 'Child' ? g.age : '', 'ID Type': g.idType, 'ID Number': g.idNumber,
        'ID Photo File ID': g.fileId,
        'Added At': stamp_()
      });
    });
    sheet_().appendRow(row);
    if (bookingId) booking = linkCheckin_(bookingId, id, clean_(d.email));
  } finally {
    lock.releaseLock();
  }
  const veh = num_(d.vehicles);
  notify_('staffCheckinReceived', booking || {
    'Booking ID': '', 'Guest Name': clean_(d.guestName), 'Mobile': txt_(d.mobile), 'Email': clean_(d.email),
    'Adults': num_(d.adults), 'Children': num_(d.children), 'Check-in Date': txt_(d.checkInDate), 'Check-out Date': txt_(d.checkOutDate)
  }, { ref: id, extra: { submissionId: id, bookingId: bookingId || 'Not linked', vehicles: veh ? veh + (plates_(d.vehicleNumbers) ? ' · ' + plates_(d.vehicleNumbers) : '') : 'None' } });
  return { ok: true, id: id };
}

function savePhoto_(id, name, photo) {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowed.indexOf(photo.mime) === -1) throw new Error('ID proof must be JPG, PNG or PDF.');
  const bytes = Utilities.base64Decode(photo.data);
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('ID proof file is larger than 5 MB.');
  const ext = photo.mime === 'application/pdf' ? 'pdf' : (photo.mime === 'image/png' ? 'png' : 'jpg');
  const blob = Utilities.newBlob(bytes, photo.mime, id + '_' + clean_(name).replace(/[^\w]+/g, '_') + '.' + ext);
  const folder = DriveApp.getFolderById(prop_('ID_FOLDER_ID'));
  return folder.createFile(blob).getId(); // stays private to the script owner
}

/**
 * Every guest beyond the primary one must be listed.
 * Adults: name, ID type, ID number and ID photo. Children: name and age (ID optional).
 */
function checkOtherGuests_(d) {
  const adults = num_(d.adults), kids = num_(d.children);
  const list = Array.isArray(d.guests) ? d.guests : [];
  const needAdults = Math.max(0, adults - 1);
  const gotAdults = list.filter(g => g && g.kind === 'Adult'), gotKids = list.filter(g => g && g.kind === 'Child');
  if (gotAdults.length !== needAdults || gotKids.length !== kids) throw new Error('Please add the details of every guest (' + needAdults + ' more adult' + (needAdults === 1 ? '' : 's') + ', ' + kids + ' child' + (kids === 1 ? '' : 'ren') + ').');
  return gotAdults.concat(gotKids).map((g, i) => {
    const name = clean_(g.name).slice(0, 120);
    const who = 'Guest ' + (i + 2);
    if (!name) throw new Error(who + ': name is required.');
    if (g.kind === 'Adult') {
      if (ID_TYPES.indexOf(g.idType) === -1) throw new Error(name + ': choose the ID type.');
      if (!g.idPhoto || !g.idPhoto.data) throw new Error(name + ': ID proof photo is required.');
      return { kind: 'Adult', name: name, idType: g.idType, idNumber: String(g.idNumber || '').trim() ? txt_(g.idNumber).slice(0, 40) : '', idPhoto: g.idPhoto };
    }
    const age = Number(g.age);
    if (!(age >= 0 && age <= 17) || String(g.age).trim() === '') throw new Error(name + ': enter an age from 0 to 17.');
    return { kind: 'Child', name: name, age: Math.floor(age), idType: '', idNumber: '', idPhoto: g.idPhoto && g.idPhoto.data ? g.idPhoto : null };
  });
}

/** Admin: other guests on a check-in, with an ID photo flag (no image data). */
function guestsOf_(submissionId) {
  return readAll_(GUESTS, GUEST_HEADERS).filter(g => g['Submission ID'] === submissionId)
    .map(g => ({ id: g['Guest ID'], no: g['No.'], kind: g.Kind, name: g.Name, age: g.Age, idType: g['ID Type'], idNumber: g['ID Number'], hasPhoto: !!g['ID Photo File ID'] }));
}

function guestPhoto_(guestId) {
  const g = readAll_(GUESTS, GUEST_HEADERS).filter(x => x['Guest ID'] === guestId)[0];
  if (!g || !g['ID Photo File ID']) return { ok: true, photo: null };
  const blob = DriveApp.getFileById(g['ID Photo File ID']).getBlob();
  return { ok: true, photo: { mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) } };
}

/* ---------- admin ---------- */

function list_() {
  const sh = sheet_();
  const values = sh.getDataRange().getDisplayValues();
  const head = values.shift();
  return { ok: true, headers: head, rows: values.reverse() }; // newest first
}

function photo_(id) {
  const r = findRow_(id);
  const fileId = sheet_().getRange(r, HEADERS.indexOf('ID Photo File ID') + 1).getValue();
  if (!fileId) return { ok: true, photo: null };
  const blob = DriveApp.getFileById(fileId).getBlob();
  return { ok: true, photo: { mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) } };
}

function verify_(id, sess) {
  const sh = sheet_();
  const r = findRow_(id);
  sh.getRange(r, HEADERS.indexOf('Rep Name') + 1, 1, 3)
    .setValues([[clean_(sess.name), new Date(), 'Verified']]);
  audit_(sess, 'checkin.verify', id, 'ID verified');
  return { ok: true };
}

function updateVehicles_(id, count, numbers, sess) {
  const sh = sheet_();
  const r = findRow_(id);
  sh.getRange(r, HEADERS.indexOf('Vehicles') + 1).setValue(Math.min(num_(count), 20));
  sh.getRange(r, HEADERS.indexOf('Vehicle Numbers') + 1).setValue(plates_(numbers));
  audit_(sess, 'checkin.vehicles', id, Math.min(num_(count), 20) + ' · ' + plates_(numbers));
  return { ok: true };
}

/**
 * Stay lifecycle: Expected -> Checked in -> Checked out.
 * move: 'in' | 'out' | 'undo'. Records actual time (IST) and staff name.
 */
function stay_(id, move, sess) {
  const staff = sess.name;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const r = findRow_(id);
    const c = (name) => HEADERS.indexOf(name) + 1;
    const now = "'" + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm');
    const who = clean_(staff).slice(0, 80);
    const status = String(sh.getRange(r, c('Stay Status')).getValue() || 'Expected');

    if (move === 'in') {
      if (!who) throw new Error('Staff name required.');
      if (status !== 'Expected') throw new Error('Guest is already ' + status.toLowerCase() + '.');
      sh.getRange(r, c('Stay Status'), 1, 3).setValues([['Checked in', now, who]]);
    } else if (move === 'out') {
      if (!who) throw new Error('Staff name required.');
      if (status !== 'Checked in') throw new Error('Guest must be checked in first.');
      sh.getRange(r, c('Stay Status')).setValue('Checked out');
      sh.getRange(r, c('Actual Check-out'), 1, 2).setValues([[now, who]]);
    } else if (move === 'undo') {
      if (status === 'Checked out') {
        sh.getRange(r, c('Stay Status')).setValue('Checked in');
        sh.getRange(r, c('Actual Check-out'), 1, 2).setValues([['', '']]);
      } else if (status === 'Checked in') {
        sh.getRange(r, c('Stay Status'), 1, 3).setValues([['Expected', '', '']]);
      } else {
        throw new Error('Nothing to undo.');
      }
    } else {
      throw new Error('Unknown move.');
    }
    syncBookingFromStay_(id, String(sh.getRange(r, c('Stay Status')).getValue()), who);
    audit_(sess, 'checkin.stay', id, move === 'undo' ? 'undo → ' + sh.getRange(r, c('Stay Status')).getValue() : 'checked ' + move);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */

function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run setup() first.');
  // Add any header columns introduced after the sheet was created.
  const width = sh.getLastColumn();
  if (width < HEADERS.length) {
    sh.getRange(1, width + 1, 1, HEADERS.length - width).setValues([HEADERS.slice(width)]).setFontWeight('bold');
  }
  return sh;
}

/** Vehicle numbers: array or comma list -> "KA20AB1234, MH12CD5678" (uppercase, safe chars only). */
function plates_(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(',');
  return list.map(x => String(x || '').toUpperCase().replace(/[^A-Z0-9 -]/g, '').replace(/\s+/g, ' ').replace(/^[ -]+/, '').trim().slice(0, 15))
    .filter(Boolean).slice(0, 20).join(', ');
}

function findRow_(id) {
  const ids = sheet_().getRange(2, 1, Math.max(sheet_().getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  throw new Error('Record not found.');
}

function prop_(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('Missing script property ' + k + '. Run setup()/setAdmin().');
  return v;
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** Strip leading formula characters so guest input can't become a Sheet formula. */
function clean_(v) {
  return String(v == null ? '' : v).trim().replace(/^[=+\-@]+/, '').slice(0, 500);
}

/** Force a value to plain text (keeps leading + or 0 on phone and ID numbers). */
function txt_(v) {
  return "'" + String(v == null ? '' : v).trim().slice(0, 50);
}

function num_(v) {
  const n = parseInt(v, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
