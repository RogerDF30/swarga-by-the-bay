/**
 * Swarga by the Bay — Super admin deletes.
 * Rows are removed from their sheet; a full copy goes to the "Deleted" sheet first,
 * and Drive files (ID proofs, room photos) go to Drive trash (restorable for 30 days).
 */

const DELETED = 'Deleted';
const DELETED_HEADERS = ['Deleted At', 'By', 'Kind', 'Record ID', 'Summary', 'Data'];
const DELETE_KINDS = ['booking', 'payment', 'checkin', 'room', 'user'];

function deleteRecord_(kind, id, sess) {
  if (DELETE_KINDS.indexOf(kind) === -1) throw new Error('Unknown record type.');
  id = String(id || '').trim();
  if (!id) throw new Error('Nothing selected.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const out = ({ booking: delBooking_, payment: delPayment_, checkin: delCheckin_, room: delRoom_, user: delUser_ })[kind](id, sess);
    audit_(sess, kind + '.delete', id, out.summary);
    return { ok: true, summary: out.summary };
  } finally { lock.releaseLock(); }
}

/* ---------- helpers ---------- */

function archive_(kind, id, summary, data, sess) {
  appendObj_(DELETED, DELETED_HEADERS, {
    'Deleted At': stamp_(), 'By': sess.name, 'Kind': kind, 'Record ID': id,
    'Summary': String(summary).slice(0, 300), 'Data': JSON.stringify(data).slice(0, 45000)
  });
}

/** Delete rows (numbers) from a sheet, bottom-up so row numbers stay valid. */
function dropRows_(sh, rowNums) {
  rowNums.slice().sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
}

function trashFile_(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* already gone */ }
}

function checkinRow_(id) {
  const sh = sheet_();
  const r = findRow_(id);
  const vals = sh.getRange(r, 1, 1, HEADERS.length).getDisplayValues()[0];
  const o = {}; HEADERS.forEach((h, i) => { o[h] = vals[i]; });
  return { sh: sh, row: r, obj: o };
}

/* ---------- kinds ---------- */

/** Booking + its payments. A linked check-in stays in the guest log, unlinked. */
function delBooking_(id, sess) {
  const b = findBy_(BOOKINGS, BOOKING_HEADERS, id);
  const pays = readAll_(PAYMENTS, PAYMENT_HEADERS).filter(p => p['Booking ID'] === id);
  const summary = b['Guest Name'] + ' · ' + b['Check-in Date'] + ' → ' + b['Check-out Date'] + ' · ' + b.Status + (pays.length ? ' · ' + pays.length + ' payment(s)' : '');
  archive_('booking', id, summary, { booking: strip_(b), payments: pays.map(strip_) }, sess);
  if (b['Check-in Ref']) {
    try { const c = checkinRow_(b['Check-in Ref']); c.sh.getRange(c.row, HEADERS.indexOf('Booking ID') + 1).setValue(''); } catch (e) {}
  }
  dropRows_(table_(PAYMENTS, PAYMENT_HEADERS), pays.map(p => p._row));
  table_(BOOKINGS, BOOKING_HEADERS).deleteRow(findBy_(BOOKINGS, BOOKING_HEADERS, id)._row);
  return { summary: summary };
}

function delPayment_(id, sess) {
  const p = findBy_(PAYMENTS, PAYMENT_HEADERS, id);
  const summary = p['Booking ID'] + ' · ' + p.Kind + ' ' + inr_(Math.abs(money_(p.Amount))) + ' · ' + p.Mode + ' · ' + p['Recorded At'];
  archive_('payment', id, summary, strip_(p), sess);
  table_(PAYMENTS, PAYMENT_HEADERS).deleteRow(p._row);
  try { refreshPaid_(p['Booking ID']); } catch (e) {}
  return { summary: summary };
}

/** Guest-log entry + other guests + all ID files. A linked booking stays, unlinked. */
function delCheckin_(id, sess) {
  const c = checkinRow_(id);
  const guests = readAll_(GUESTS, GUEST_HEADERS).filter(g => g['Submission ID'] === id);
  const summary = c.obj['Guest Name'] + ' · ' + c.obj['Check-in Date'] + ' → ' + c.obj['Check-out Date'] + (guests.length ? ' · +' + guests.length + ' guest(s)' : '');
  const data = Object.assign({}, c.obj); delete data['User Agent'];
  archive_('checkin', id, summary + ' · ID files moved to Drive trash', { checkin: data, guests: guests.map(strip_) }, sess);
  trashFile_(c.obj['ID Photo File ID']);
  guests.forEach(g => trashFile_(g['ID Photo File ID']));
  dropRows_(table_(GUESTS, GUEST_HEADERS), guests.map(g => g._row));
  readAll_(BOOKINGS, BOOKING_HEADERS).filter(b => b['Check-in Ref'] === id)
    .forEach(b => writeFields_(BOOKINGS, BOOKING_HEADERS, b._row, { 'Check-in Ref': '' }));
  c.sh.deleteRow(findRow_(id));
  return { summary: summary };
}

/** Room + its photos. Blocked while a current or upcoming booking uses it. */
function delRoom_(id, sess) {
  const r = findBy_(ROOMS, ROOM_HEADERS, id);
  const today = todayIso_();
  const live = readAll_(BOOKINGS, BOOKING_HEADERS).filter(b =>
    ['Requested', 'Confirmed', 'Checked in'].indexOf(b.Status) > -1 && b['Check-out Date'] >= today && roomList_(b['Room IDs']).indexOf(id) > -1);
  if (live.length) throw new Error('This room has ' + live.length + ' current or upcoming booking(s): ' + live.map(b => b['Booking ID']).slice(0, 3).join(', ') + '. Move or cancel them first, or set the room to Inactive.');
  const summary = r.Name + ' · ' + inr_(money_(r.Rate)) + '/night';
  archive_('room', id, summary, strip_(r), sess);
  photoList_(r.Photos).forEach(p => trashFile_(p.indexOf('p:') === 0 ? p.slice(2) : p));
  table_(ROOMS, ROOM_HEADERS).deleteRow(r._row);
  return { summary: summary };
}

function delUser_(username, sess) {
  if (username === sess.u) throw new Error('You cannot delete your own account.');
  const all = readAll_(USERS, USER_HEADERS);
  const u = all.filter(x => x.Username === username)[0];
  if (!u) throw new Error('User not found.');
  if (u.Role === 'Super admin' && u.Status === 'Active' && all.filter(x => x.Role === 'Super admin' && x.Status === 'Active').length <= 1) {
    throw new Error('At least one active Super admin must remain.');
  }
  const summary = u.Name + ' · ' + u.Role;
  const data = strip_(u); delete data.Salt; delete data.Hash;
  archive_('user', username, summary, data, sess);
  table_(USERS, USER_HEADERS).deleteRow(u._row);
  return { summary: summary };
}

function deletedList_() {
  const rows = readAll_(DELETED, DELETED_HEADERS).map(r => { const c = strip_(r); delete c.Data; return c; }).reverse();
  return { ok: true, rows: rows.slice(0, 300) };
}
