/**
 * Swarga by the Bay — Guest Check-In API (Google Apps Script)
 * Storage: bound Google Sheet (tab "CheckIns") + Drive folder for ID photos.
 * Front end (Cloudways) POSTs JSON as text/plain to avoid CORS preflight.
 *
 * Script Properties (set by running setup() / setAdmin() once):
 *   ADMIN_USER, ADMIN_SALT, ADMIN_HASH, ID_FOLDER_ID
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
  'Rep Name', 'Rep Verified At', 'Status', 'User Agent'
];

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
  if (!props.getProperty('ID_FOLDER_ID')) {
    const folder = DriveApp.createFolder('Swarga by the Bay — Guest ID Proofs');
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
    switch (body.action) {
      case 'submit': return json_(submit_(body.data || {}));
      case 'login':  return json_(login_(body.username, body.password));
      case 'logout': requireAdmin_(body.token); CacheService.getScriptCache().remove('tok_' + body.token); return json_({ ok: true });
      case 'list':   requireAdmin_(body.token); return json_(list_());
      case 'photo':  requireAdmin_(body.token); return json_(photo_(body.id));
      case 'verify': requireAdmin_(body.token); return json_(verify_(body.id, body.repName));
      default:       return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/* ---------- guest submit ---------- */

function submit_(d) {
  const req = ['guestName', 'mobile', 'adults', 'checkInDate', 'checkOutDate',
               'idType', 'idNumber', 'emergencyName', 'emergencyPhone', 'declarationName'];
  req.forEach(k => { if (!String(d[k] || '').trim()) throw new Error('Missing field: ' + k); });
  ['ackHouse', 'ackSea', 'ackWeather', 'ackLiability', 'ackData', 'declarationAgreed']
    .forEach(k => { if (d[k] !== true) throw new Error('All acknowledgements are required.'); });
  if (!/^\+?[0-9 ]{8,16}$/.test(d.mobile)) throw new Error('Invalid mobile number.');
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) throw new Error('Invalid email.');
  if (d.checkOutDate < d.checkInDate) throw new Error('Check-out is before check-in.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const id = 'SBB-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd') + '-' +
               Utilities.getUuid().slice(0, 6).toUpperCase();

    let fileId = '';
    if (d.idPhoto && d.idPhoto.data) fileId = savePhoto_(id, d.guestName, d.idPhoto);

    const row = [
      id, new Date(),
      clean_(d.guestName), txt_(d.mobile), clean_(d.email),
      num_(d.adults), num_(d.children), num_(d.vehicles),
      clean_(d.checkInDate), clean_(d.checkInTime), clean_(d.checkOutDate), clean_(d.checkOutTime),
      clean_(d.idType), txt_(d.idNumber), fileId,
      clean_(d.emergencyName), txt_(d.emergencyPhone),
      'Yes', 'Yes', 'Yes', 'Yes', 'Yes',
      d.groupBooking ? 'Yes' : 'No', clean_(d.leadGuestName),
      clean_(d.declarationName), 'Yes',
      '', '', 'Pending', clean_(d.userAgent).slice(0, 200)
    ];
    sheet_().appendRow(row);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
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

/* ---------- admin ---------- */

function login_(user, pass) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('login_fails') || 0);
  if (fails >= MAX_LOGIN_FAILS) throw new Error('Too many attempts. Try again in 15 minutes.');

  const ok = String(user || '') === prop_('ADMIN_USER') &&
             sha256_(prop_('ADMIN_SALT') + String(pass || '')) === prop_('ADMIN_HASH');
  if (!ok) {
    cache.put('login_fails', String(fails + 1), 900);
    Utilities.sleep(800);
    throw new Error('Invalid username or password.');
  }
  cache.remove('login_fails');
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('tok_' + token, '1', TOKEN_TTL_SEC);
  return { ok: true, token: token, expiresIn: TOKEN_TTL_SEC };
}

function requireAdmin_(token) {
  if (!token || !CacheService.getScriptCache().get('tok_' + token)) throw new Error('AUTH');
}

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

function verify_(id, repName) {
  if (!String(repName || '').trim()) throw new Error('Representative name required.');
  const sh = sheet_();
  const r = findRow_(id);
  sh.getRange(r, HEADERS.indexOf('Rep Name') + 1, 1, 3)
    .setValues([[clean_(repName), new Date(), 'Verified']]);
  return { ok: true };
}

/* ---------- helpers ---------- */

function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run setup() first.');
  return sh;
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
