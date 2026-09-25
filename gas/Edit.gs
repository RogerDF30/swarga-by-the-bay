/**
 * Swarga by the Bay — staff corrections to a guest's check-in (Admin and Super admin).
 * Declarations and the signature are the guest's own and cannot be edited.
 * Every change is written to the audit log with old → new values, and the check-in
 * records who last edited it (shown on the check-in PDF).
 */

const EDITABLE = {
  guestName: 'Guest Name', mobile: 'Mobile', email: 'Email',
  checkInDate: 'Check-in Date', checkInTime: 'Check-in Time', checkOutDate: 'Check-out Date', checkOutTime: 'Check-out Time',
  adults: 'Adults', children: 'Children',
  emergencyName: 'Emergency Contact Name', emergencyPhone: 'Emergency Contact No.',
  idType: 'ID Type'
};

function validEmail_(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim()); }
function validPhone_(v) { return /^\+?[0-9 ]{8,16}$/.test(String(v || '').trim()); }
function validDate_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
function validTime_(v) { return /^\d{2}:\d{2}$/.test(String(v || '')); }

function markEdited_(sh, row, sess) {
  sh.getRange(row, HEADERS.indexOf('Edited By') + 1, 1, 2).setValues([[clean_(sess.name), stamp_()]]);
}

/** Primary guest details (and optionally a replacement ID photo). */
function updateCheckin_(id, d, sess) {
  d = d || {};
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let changes = [];
  try {
    const c = checkinRow_(id), cur = c.obj, next = {};
    Object.keys(EDITABLE).forEach(k => { if (d[k] !== undefined) next[EDITABLE[k]] = String(d[k]).trim(); });
    const v = (h) => next[h] !== undefined ? next[h] : cur[h];

    if (!v('Guest Name')) throw new Error('Guest name is required.');
    if (!validPhone_(v('Mobile'))) throw new Error('Enter a valid mobile number.');
    if (!validEmail_(v('Email'))) throw new Error('Enter a valid email.');
    if (!validDate_(v('Check-in Date')) || !validDate_(v('Check-out Date'))) throw new Error('Enter valid dates.');
    if (v('Check-out Date') < v('Check-in Date')) throw new Error('Check-out must be on or after check-in.');
    ['Check-in Time', 'Check-out Time'].forEach(h => { if (next[h] !== undefined && next[h] && !validTime_(next[h])) throw new Error('Enter a valid time (HH:MM).'); });
    if (!(Number(v('Adults')) >= 1 && Number(v('Adults')) <= 50)) throw new Error('Adults must be 1 to 50.');
    if (!(Number(v('Children')) >= 0 && Number(v('Children')) <= 50)) throw new Error('Children must be 0 to 50.');
    if (!v('Emergency Contact Name')) throw new Error('Emergency contact name is required.');
    if (!validPhone_(v('Emergency Contact No.'))) throw new Error('Enter a valid emergency contact number.');
    if (next['ID Type'] !== undefined && ID_TYPES.indexOf(next['ID Type']) === -1) throw new Error('Choose a valid ID type.');

    Object.keys(next).forEach(h => {
      if (String(next[h]) === String(cur[h] || '')) return;
      const val = ['Adults', 'Children'].indexOf(h) > -1 ? Number(next[h]) : (h === 'Guest Name' || h === 'Emergency Contact Name') ? clean_(next[h]) : txt_(next[h]);
      c.sh.getRange(c.row, HEADERS.indexOf(h) + 1).setValue(val);
      changes.push(h + ': ' + (cur[h] || '—') + ' → ' + next[h]);
    });
    if (d.idPhoto && d.idPhoto.data) {
      const newFile = savePhoto_(id, v('Guest Name'), d.idPhoto);
      trashFile_(cur['ID Photo File ID']);
      c.sh.getRange(c.row, HEADERS.indexOf('ID Photo File ID') + 1).setValue(newFile);
      changes.push(cur['ID Photo File ID'] ? 'ID photo replaced' : 'ID photo added');
    }
    if (!changes.length) return { ok: true, changed: 0 };
    markEdited_(c.sh, c.row, sess);
  } finally { lock.releaseLock(); }
  audit_(sess, 'checkin.edit', id, changes.join('; '));
  return { ok: true, changed: changes.length };
}

/** Add or correct one of the other guests. */
function saveGuest_(submissionId, g, sess) {
  g = g || {};
  const kind = g.kind === 'Child' ? 'Child' : 'Adult';
  const name = clean_(g.name).slice(0, 120);
  if (!name) throw new Error('Name is required.');
  let age = '';
  if (kind === 'Child') {
    age = Number(g.age);
    if (String(g.age).trim() === '' || !(age >= 0 && age <= 17)) throw new Error('Enter an age from 0 to 17.');
    age = Math.floor(age);
  }
  const idType = String(g.idType || '');
  if (kind === 'Adult' && ID_TYPES.indexOf(idType) === -1) throw new Error('Choose the ID type.');
  if (idType && ID_TYPES.indexOf(idType) === -1) throw new Error('Choose a valid ID type.');

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let summary;
  try {
    const c = checkinRow_(submissionId);
    const all = readAll_(GUESTS, GUEST_HEADERS).filter(x => x['Submission ID'] === submissionId);
    if (g.id) {
      const cur = all.filter(x => x['Guest ID'] === g.id)[0];
      if (!cur) throw new Error('Guest not found.');
      const fields = { 'Kind': kind, 'Name': name, 'Age': age, 'ID Type': idType };
      if (g.idPhoto && g.idPhoto.data) {
        fields['ID Photo File ID'] = savePhoto_(g.id, name, g.idPhoto);
        trashFile_(cur['ID Photo File ID']);
      }
      if (kind === 'Adult' && !cur['ID Photo File ID'] && !fields['ID Photo File ID']) throw new Error('Add an ID photo for ' + name + '.');
      writeFields_(GUESTS, GUEST_HEADERS, cur._row, fields);
      summary = 'Guest ' + cur['No.'] + ' updated: ' + name + (fields['ID Photo File ID'] ? ' · ID photo ' + (cur['ID Photo File ID'] ? 'replaced' : 'added') : '');
    } else {
      if (kind === 'Adult' && !(g.idPhoto && g.idPhoto.data)) throw new Error('Add an ID photo for ' + name + '.');
      const no = all.reduce((m, x) => Math.max(m, Number(x['No.']) || 1), 1) + 1;
      const gid = submissionId + '-G' + no;
      appendObj_(GUESTS, GUEST_HEADERS, {
        'Guest ID': gid, 'Submission ID': submissionId, 'No.': no, 'Kind': kind, 'Name': name, 'Age': age,
        'ID Type': idType, 'ID Number': '', 'ID Photo File ID': g.idPhoto && g.idPhoto.data ? savePhoto_(gid, name, g.idPhoto) : '', 'Added At': stamp_()
      });
      summary = 'Guest ' + no + ' added by staff: ' + name + ' (' + kind + ')';
    }
    refreshOtherGuests_(c, submissionId);
    markEdited_(c.sh, c.row, sess);
  } finally { lock.releaseLock(); }
  audit_(sess, 'checkin.guest', submissionId, summary);
  return { ok: true, guests: guestsOf_(submissionId) };
}

/** Remove a wrongly added guest. A copy goes to the Deleted log; the ID file to Drive trash. */
function removeGuest_(guestId, sess) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let g;
  try {
    g = readAll_(GUESTS, GUEST_HEADERS).filter(x => x['Guest ID'] === guestId)[0];
    if (!g) throw new Error('Guest not found.');
    archive_('guest', guestId, g.Name + ' (' + g.Kind + ') from ' + g['Submission ID'], strip_(g), sess);
    trashFile_(g['ID Photo File ID']);
    table_(GUESTS, GUEST_HEADERS).deleteRow(g._row);
    const c = checkinRow_(g['Submission ID']);
    refreshOtherGuests_(c, g['Submission ID']);
    markEdited_(c.sh, c.row, sess);
  } finally { lock.releaseLock(); }
  audit_(sess, 'checkin.guest.remove', g['Submission ID'], g.Name + ' (' + g.Kind + ')');
  return { ok: true, guests: guestsOf_(g['Submission ID']) };
}

function refreshOtherGuests_(c, submissionId) {
  const list = readAll_(GUESTS, GUEST_HEADERS).filter(x => x['Submission ID'] === submissionId)
    .sort((a, b) => (Number(a['No.']) || 0) - (Number(b['No.']) || 0));
  const text = list.map(g => g.Name + (g.Kind === 'Child' ? ' (child, ' + g.Age + ')' : ' (' + (g['ID Type'] || 'ID') + ')')).join('; ');
  c.sh.getRange(c.row, HEADERS.indexOf('Other Guests') + 1).setValue(text);
}
