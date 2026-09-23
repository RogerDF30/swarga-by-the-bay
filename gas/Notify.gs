/**
 * Swarga by the Bay — email notifications.
 * Transports (Script Property MAIL_TRANSPORT):
 *   'off'   : nothing is sent (default)
 *   'relay' : Mailer web app deployed in the sender's own Google account (e.g. Chirag's). Signed with MAILER_SECRET.
 *   'brevo' : Brevo transactional API (BREVO_KEY, verified sender address)
 *   'self'  : MailApp from the account running this script (testing)
 * Settings (templates, switches, staff list) live in the "Settings" sheet; secrets only in Script Properties.
 */

const SETTINGS = 'Settings';
const EMAIL_LOG = 'EmailLog';
const SETTINGS_HEADERS = ['Key', 'Value'];
const EMAIL_HEADERS = ['Email ID', 'At', 'Template', 'To', 'Booking', 'Subject', 'Status', 'Transport', 'Error', 'Attempts', 'Payload'];

const TEMPLATES = {
  requestReceived: {
    label: 'Request received', audience: 'Guest', when: 'Website booking request submitted', on: true,
    subject: 'We received your stay request · {{bookingId}}',
    body: 'Hello {{guestFirstName}},\n\nThank you for choosing Swarga by the Bay. We have received your request for {{checkIn}} to {{checkOut}} ({{nights}}) for {{guests}}.\n\nWe will confirm availability and payment details shortly by phone or WhatsApp.\n\nYour request reference: {{bookingId}}\n\nWarm regards,\n{{senderName}}'
  },
  staffNewRequest: {
    label: 'New booking request', audience: 'Staff', when: 'Website booking request submitted', on: true,
    subject: 'New request: {{guestName}} · {{checkIn}} → {{checkOut}}',
    body: 'A new booking request came in from the website.\n\nGuest: {{guestName}}\nMobile: {{mobile}}\nEmail: {{email}}\nDates: {{checkIn}} → {{checkOut}} ({{nights}})\nGuests: {{guests}}\nRooms: {{rooms}}\nRequests: {{requests}}\n\nOpen admin: {{adminLink}}'
  },
  bookingConfirmed: {
    label: 'Booking confirmed + check-in link', audience: 'Guest', when: 'Admin confirms a booking', on: true,
    subject: 'Your stay is confirmed · {{checkIn}} · Swarga by the Bay',
    body: 'Hello {{guestFirstName}},\n\nYour stay at Swarga by the Bay is confirmed.\n\nCheck-in: {{checkIn}} from {{checkInTime}}\nCheck-out: {{checkOut}} by {{checkOutTime}}\nRooms: {{rooms}}\nGuests: {{guests}}\nTotal: {{total}} · Balance due: {{balance}}\n\nPlease complete your guest check-in before you arrive (about 4 minutes, keep an ID proof handy):\n{{checkinLink}}\n\nCaretaker: {{caretakerName}}, {{caretakerPhone}}\nBooking reference: {{bookingId}}\n\nSee you by the sea,\n{{senderName}}'
  },
  paymentReceipt: {
    label: 'Payment receipt', audience: 'Guest', when: 'Payment or refund recorded', on: true,
    subject: '{{paymentKind}} received · {{paymentAmount}} · {{bookingId}}',
    body: 'Hello {{guestFirstName}},\n\nWe have recorded a {{paymentKindLower}} of {{paymentAmount}} ({{paymentMode}}) for booking {{bookingId}}.\n\nTotal: {{total}}\nPaid so far: {{paid}}\nBalance due: {{balance}}\n\nThank you,\n{{senderName}}'
  },
  bookingCancelled: {
    label: 'Cancellation / no-show notice', audience: 'Guest', when: 'Admin cancels or marks no-show', on: true,
    subject: 'Your booking {{bookingId}} has been {{statusLower}}',
    body: 'Hello {{guestFirstName}},\n\nYour booking {{bookingId}} for {{checkIn}} to {{checkOut}} has been {{statusLower}}.\n\nIf this is unexpected, please call us on {{propertyPhone}}.\n\nRegards,\n{{senderName}}'
  },
  preArrival: {
    label: 'Pre-arrival reminder + check-in link', audience: 'Guest', when: '1 day before check-in, if the check-in form is not yet received', on: true,
    subject: 'See you tomorrow · please complete your check-in',
    body: 'Hello {{guestFirstName}},\n\nWe look forward to welcoming you tomorrow, {{checkIn}}, from {{checkInTime}}.\n\nTo save time on arrival, please complete your guest check-in now:\n{{checkinLink}}\n\nCaretaker: {{caretakerName}}, {{caretakerPhone}}\n\nSafe travels,\n{{senderName}}'
  },
  staffCheckinReceived: {
    label: 'Check-in form received', audience: 'Staff', when: 'A guest submits the check-in form', on: true,
    subject: 'Check-in form received: {{guestName}} · {{checkIn}}',
    body: '{{guestName}} submitted the guest check-in form.\n\nReference: {{submissionId}}\nBooking: {{bookingId}}\nDates: {{checkIn}} → {{checkOut}}\nGuests: {{guests}}\nVehicles: {{vehicles}}\n\nReview and verify ID: {{adminLink}}'
  },
  thankYou: {
    label: 'Thank you after check-out', audience: 'Guest', when: 'Guest checked out', on: false,
    subject: 'Thank you for staying at Swarga by the Bay',
    body: 'Hello {{guestFirstName}},\n\nThank you for staying with us. We hope the sea was kind to you.\n\nWe would love to host you again.\n\nWarm regards,\n{{senderName}}'
  },
  dailySummary: {
    label: 'Daily summary', audience: 'Staff', when: 'Every day at 8:00 AM IST', on: true,
    subject: 'Today at Swarga · {{today}}',
    body: 'Arrivals today ({{arrivalCount}}):\n{{arrivalList}}\n\nDepartures today ({{departureCount}}):\n{{departureList}}\n\nIn house: {{inHouseCount}}\nNew requests waiting: {{requestCount}}\nBalance due across bookings: {{balanceDue}}\n\nOpen admin: {{adminLink}}'
  }
};

const DEFAULT_SETTINGS = {
  senderName: 'Swarga by the Bay',
  replyTo: '',
  staffEmails: '',
  siteUrl: 'https://swarga-by-the-bay.pages.dev',
  caretakerName: 'Mrs. Jalja',
  caretakerPhone: '+91 9108368198',
  propertyPhone: '+91 9448054505',
  checkInTime: '1:00 PM',
  checkOutTime: '11:00 AM'
};

/* ---------- settings ---------- */

function settingsMap_() {
  const m = {};
  readAll_(SETTINGS, SETTINGS_HEADERS).forEach(r => { m[r.Key] = r.Value; });
  return m;
}

function getSettings_() {
  const m = settingsMap_();
  const s = Object.assign({}, DEFAULT_SETTINGS);
  Object.keys(DEFAULT_SETTINGS).forEach(k => { if (m[k] !== undefined && m[k] !== '') s[k] = m[k]; });
  const t = {};
  Object.keys(TEMPLATES).forEach(k => {
    const d = TEMPLATES[k];
    t[k] = {
      label: d.label, audience: d.audience, when: d.when,
      on: m['tpl.' + k + '.on'] === undefined || m['tpl.' + k + '.on'] === '' ? d.on : m['tpl.' + k + '.on'] === 'true',
      subject: m['tpl.' + k + '.subject'] || d.subject,
      body: m['tpl.' + k + '.body'] || d.body,
      customised: !!(m['tpl.' + k + '.subject'] || m['tpl.' + k + '.body'])
    };
  });
  s.templates = t;
  return s;
}

function setSetting_(key, value) {
  const hit = readAll_(SETTINGS, SETTINGS_HEADERS).filter(r => r.Key === key)[0];
  const v = String(value == null ? '' : value);
  if (hit) writeFields_(SETTINGS, SETTINGS_HEADERS, hit._row, { 'Value': "'" + v });
  else appendObj_(SETTINGS, SETTINGS_HEADERS, { 'Key': key, 'Value': "'" + v });
}

function saveSettings_(d, sess) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (d.staffEmails !== undefined) {
      const bad = splitEmails_(d.staffEmails).filter(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (bad.length) throw new Error('Invalid staff email: ' + bad.join(', '));
    }
    if (d.replyTo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.replyTo).trim())) throw new Error('Invalid reply-to email.');
    if (d.siteUrl !== undefined && !/^https:\/\/[^\s]+$/.test(String(d.siteUrl).trim())) throw new Error('Website address must start with https://');
    Object.keys(DEFAULT_SETTINGS).forEach(k => { if (d[k] !== undefined) setSetting_(k, String(d[k]).trim().slice(0, 2000)); });
    if (d.templates) {
      Object.keys(d.templates).forEach(k => {
        if (!TEMPLATES[k]) return;
        const t = d.templates[k];
        if (t.on !== undefined) setSetting_('tpl.' + k + '.on', t.on ? 'true' : 'false');
        if (t.reset) { setSetting_('tpl.' + k + '.subject', ''); setSetting_('tpl.' + k + '.body', ''); }
        else {
          if (t.subject !== undefined) setSetting_('tpl.' + k + '.subject', String(t.subject).slice(0, 300));
          if (t.body !== undefined) setSetting_('tpl.' + k + '.body', String(t.body).slice(0, 8000));
        }
      });
    }
    audit_(sess, 'settings.save', '', Object.keys(d).join(', '));
    return { ok: true, settings: getSettings_() };
  } finally { lock.releaseLock(); }
}

function splitEmails_(v) { return String(v || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean); }

/* ---------- integration (Super admin) ---------- */

function mask_(v) { v = String(v || ''); return v ? '••••' + v.slice(-4) : ''; }

function getIntegration_() {
  const p = PropertiesService.getScriptProperties();
  return {
    ok: true,
    transport: p.getProperty('MAIL_TRANSPORT') || 'off',
    relayUrl: p.getProperty('MAILER_URL') || '',
    relaySecretSet: !!p.getProperty('MAILER_SECRET'),
    relaySecretMasked: mask_(p.getProperty('MAILER_SECRET')),
    brevoKeyMasked: mask_(p.getProperty('BREVO_KEY')),
    brevoSender: p.getProperty('BREVO_SENDER') || '',
    lastTest: p.getProperty('MAIL_LAST_TEST') || ''
  };
}

function saveIntegration_(d, sess) {
  const p = PropertiesService.getScriptProperties();
  const transports = ['off', 'relay', 'brevo', 'self'];
  if (d.transport !== undefined) {
    if (transports.indexOf(d.transport) === -1) throw new Error('Unknown transport.');
    if (d.transport === 'relay' && !(d.relayUrl || p.getProperty('MAILER_URL'))) throw new Error('Paste the Mailer web app URL first.');
    if (d.transport === 'brevo' && !(d.brevoKey || p.getProperty('BREVO_KEY'))) throw new Error('Enter the Brevo API key first.');
    p.setProperty('MAIL_TRANSPORT', d.transport);
  }
  if (d.relayUrl !== undefined) {
    const u = String(d.relayUrl).trim();
    if (u && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)) throw new Error('Mailer URL must look like https://script.google.com/macros/s/…/exec');
    p.setProperty('MAILER_URL', u);
  }
  if (d.brevoKey) p.setProperty('BREVO_KEY', String(d.brevoKey).trim());
  if (d.brevoSender !== undefined) {
    const e = String(d.brevoSender).trim();
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Invalid sender email.');
    p.setProperty('BREVO_SENDER', e);
  }
  audit_(sess, 'integration.save', d.transport || '', 'transport/settings updated');
  return getIntegration_();
}

/** Creates a new signing secret and returns the ready-to-paste Mailer code for the sender's Google account. */
function newMailerSecret_(sess) {
  const secret = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('MAILER_SECRET', secret);
  audit_(sess, 'integration.secret', '', 'new Mailer signing key generated');
  return { ok: true, code: MAILER_SOURCE_.replace('__SECRET__', secret), masked: mask_(secret) };
}

/* ---------- rendering ---------- */

function inr_(n) {
  n = Math.round(Number(n) || 0);
  const s = String(Math.abs(n));
  const last3 = s.slice(-3), rest = s.slice(0, -3);
  return (n < 0 ? '-' : '') + '₹' + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3;
}

function niceDate_(iso) {
  if (!isoOk_(iso)) return iso || '';
  const d = new Date(iso + 'T12:00:00Z');
  return Utilities.formatDate(d, 'Asia/Kolkata', 'EEE, d MMM yyyy');
}

function bookingVars_(b, s) {
  const rooms = readAll_(ROOMS, ROOM_HEADERS);
  const names = roomList_(b['Room IDs']).map(id => (rooms.filter(r => r['Room ID'] === id)[0] || {}).Name || id);
  const nights = Number(b.Nights) || nightsOf_(b['Check-in Date'], b['Check-out Date']);
  const adults = Number(b.Adults) || 0, kids = Number(b.Children) || 0;
  const paid = money_(b.Paid), total = money_(b.Total);
  return {
    bookingId: b['Booking ID'], guestName: b['Guest Name'], guestFirstName: String(b['Guest Name'] || '').split(/\s+/)[0],
    mobile: b.Mobile, email: b.Email || '—', checkIn: niceDate_(b['Check-in Date']), checkOut: niceDate_(b['Check-out Date']),
    nights: nights + (nights === 1 ? ' night' : ' nights'),
    guests: adults + (adults === 1 ? ' adult' : ' adults') + (kids ? ', ' + kids + (kids === 1 ? ' child' : ' children') : ''),
    rooms: names.join(', ') || 'To be assigned', total: inr_(total), paid: inr_(paid), balance: inr_(Math.max(0, total - paid)),
    requests: b['Special Requests'] || '—', status: b.Status, statusLower: String(b.Status || '').toLowerCase(),
    checkinLink: String(s.siteUrl).replace(/\/+$/, '') + '/?b=' + encodeURIComponent(b['Booking ID'])
  };
}

function baseVars_(s) {
  return {
    senderName: s.senderName, caretakerName: s.caretakerName, caretakerPhone: s.caretakerPhone,
    propertyPhone: s.propertyPhone, checkInTime: s.checkInTime, checkOutTime: s.checkOutTime,
    adminLink: String(s.siteUrl).replace(/\/+$/, '') + '/admin', today: niceDate_(todayIso_())
  };
}

function fill_(text, vars) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => vars[k] === undefined || vars[k] === null ? '' : String(vars[k]));
}

function escHtml_(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/** Plain-text template body -> branded HTML email. URLs become links; a line that is only a link becomes a button. */
function toHtml_(text, s) {
  const paras = String(text).split(/\n{2,}/).map(p => {
    const lines = p.split('\n');
    if (lines.length === 1 && /^https?:\/\/\S+$/.test(lines[0].trim())) {
      const u = escHtml_(lines[0].trim());
      return '<p style="margin:22px 0"><a href="' + u + '" style="background:#ff6a4d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">Open link →</a><br><span style="font-size:12px;color:#62727a;word-break:break-all">' + u + '</span></p>';
    }
    return '<p style="margin:0 0 14px">' + lines.map(l => escHtml_(l).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#11607a">$1</a>')).join('<br>') + '</p>';
  }).join('');
  return '<div style="background:#f7efe2;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#17252b">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">' +
    '<div style="background:#0b3d52;color:#ffffff;padding:18px 24px;font-family:Georgia,serif;font-size:22px;font-weight:bold">Swarga <span style="font-style:italic;font-weight:normal;font-size:16px">by the Bay</span></div>' +
    '<div style="padding:24px;font-size:15px;line-height:1.55">' + paras + '</div>' +
    '<div style="padding:14px 24px;background:#e6f5f4;font-size:12px;color:#62727a">' + escHtml_(s.senderName) + ' · Kodi Beach, Udupi · ' + escHtml_(s.propertyPhone) + '</div>' +
    '</div></div>';
}

function render_(key, vars, s) {
  const t = s.templates[key];
  const all = Object.assign(baseVars_(s), vars || {});
  const subject = fill_(t.subject, all).replace(/\s+/g, ' ').trim();
  const text = fill_(t.body, all);
  return { subject: subject, text: text, html: toHtml_(text, s) };
}

/* ---------- sending ---------- */

function transportSend_(to, msg, s) {
  const p = PropertiesService.getScriptProperties();
  const transport = p.getProperty('MAIL_TRANSPORT') || 'off';
  const replyTo = s.replyTo || '';
  if (transport === 'off') throw new Error('Email is switched off (Settings → Integration).');
  if (transport === 'self') {
    MailApp.sendEmail({ to: to, subject: msg.subject, body: msg.text, htmlBody: msg.html, name: s.senderName, replyTo: replyTo || undefined });
    return { transport: 'self' };
  }
  if (transport === 'relay') {
    const url = p.getProperty('MAILER_URL'), secret = p.getProperty('MAILER_SECRET');
    if (!url || !secret) throw new Error('Mailer not configured.');
    const ts = String(Date.now()), nonce = Utilities.getUuid();
    const sig = hmacHex_(secret, [ts, nonce, to, msg.subject].join('\n'));
    const res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'text/plain', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ ts: ts, nonce: nonce, to: to, subject: msg.subject, text: msg.text, html: msg.html, name: s.senderName, replyTo: replyTo, sig: sig })
    });
    let j;
    try { j = JSON.parse(res.getContentText()); } catch (e) { throw new Error('Mailer returned HTTP ' + res.getResponseCode() + ' (check the Mailer deployment access is "Anyone").'); }
    if (!j.ok) throw new Error('Mailer: ' + j.error);
    return { transport: 'relay', remaining: j.remaining };
  }
  if (transport === 'brevo') {
    const key = p.getProperty('BREVO_KEY'), sender = p.getProperty('BREVO_SENDER');
    if (!key || !sender) throw new Error('Brevo key or sender missing.');
    const body = { sender: { name: s.senderName, email: sender }, to: [{ email: to }], subject: msg.subject, htmlContent: msg.html, textContent: msg.text };
    if (replyTo) body.replyTo = { email: replyTo };
    const res = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'api-key': key, 'accept': 'application/json' }, payload: JSON.stringify(body)
    });
    if (res.getResponseCode() >= 300) throw new Error('Brevo HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
    return { transport: 'brevo' };
  }
  throw new Error('Unknown transport.');
}

function hmacHex_(secret, text) {
  return Utilities.computeHmacSha256Signature(text, secret).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** Log, send, update the log. Never throws: notification problems must not block bookings. */
function deliver_(key, to, msg, bookingId, s) {
  const id = newId_('EML');
  appendObj_(EMAIL_LOG, EMAIL_HEADERS, {
    'Email ID': id, 'At': stamp_(), 'Template': key, 'To': to, 'Booking': bookingId || '', 'Subject': msg.subject,
    'Status': 'Queued', 'Transport': '', 'Error': '', 'Attempts': 0, 'Payload': JSON.stringify({ text: msg.text }).slice(0, 45000)
  });
  return attempt_(id, to, msg, s);
}

function attempt_(id, to, msg, s) {
  const row = readAll_(EMAIL_LOG, EMAIL_HEADERS).filter(r => r['Email ID'] === id)[0];
  const attempts = (Number(row.Attempts) || 0) + 1;
  try {
    const r = transportSend_(to, msg, s);
    writeFields_(EMAIL_LOG, EMAIL_HEADERS, row._row, { 'Status': 'Sent', 'Transport': r.transport, 'Error': '', 'Attempts': attempts });
    return { ok: true, id: id, remaining: r.remaining };
  } catch (e) {
    writeFields_(EMAIL_LOG, EMAIL_HEADERS, row._row, { 'Status': 'Failed', 'Error': String(e.message || e).slice(0, 300), 'Attempts': attempts });
    return { ok: false, id: id, error: String(e.message || e) };
  }
}

function alreadySent_(key, bookingId, to) {
  return readAll_(EMAIL_LOG, EMAIL_HEADERS).some(r => r.Template === key && r.Booking === bookingId && r.To === to && r.Status === 'Sent');
}

/**
 * Fire a notification. Guest templates go to the booking email; staff templates to the staff list.
 * opts: { once: skip if already sent for this booking, extra: more placeholder values }
 */
function notify_(key, booking, opts) {
  try {
    opts = opts || {};
    const s = getSettings_();
    const t = s.templates[key];
    if (!t || !t.on) return;
    if ((PropertiesService.getScriptProperties().getProperty('MAIL_TRANSPORT') || 'off') === 'off') return;
    const vars = Object.assign(booking ? bookingVars_(booking, s) : {}, opts.extra || {});
    const msg = render_(key, vars, s);
    const bid = booking ? booking['Booking ID'] : (opts.ref || '');
    const to = t.audience === 'Staff' ? splitEmails_(s.staffEmails) : [String((booking && booking.Email) || opts.to || '').trim()].filter(Boolean);
    to.forEach(addr => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return;
      if (opts.once && alreadySent_(key, bid, addr)) return;
      deliver_(key, addr, msg, bid, s);
    });
  } catch (e) { /* notifications never break the main action */ }
}

/* ---------- admin actions ---------- */

function previewEmail_(key, draft) {
  const s = getSettings_();
  if (!s.templates[key]) throw new Error('Unknown template.');
  if (draft) {
    if (draft.subject !== undefined) s.templates[key].subject = String(draft.subject);
    if (draft.body !== undefined) s.templates[key].body = String(draft.body);
  }
  const sample = {
    'Booking ID': 'SBK-260101-ABC123', 'Guest Name': 'Asha Rao', 'Mobile': '+91 98450 12345', 'Email': 'asha@example.com',
    'Adults': 2, 'Children': 1, 'Check-in Date': todayIso_(), 'Check-out Date': todayIso_(), 'Nights': 2, 'Room IDs': '',
    'Total': 9000, 'Paid': 4000, 'Status': 'Confirmed', 'Special Requests': 'Late arrival'
  };
  const vars = Object.assign(bookingVars_(sample, s), sampleExtras_());
  vars.rooms = 'Sea View Suite';
  return { ok: true, email: render_(key, vars, s) };
}

function sampleExtras_() {
  return {
    paymentKind: 'Payment', paymentKindLower: 'payment', paymentAmount: '₹4,000', paymentMode: 'UPI',
    submissionId: 'SBB-260101-1A2B3C', vehicles: '1 · KA 20 AB 1234',
    arrivalCount: 1, arrivalList: '• Asha Rao · Sea View Suite · 2 adults', departureCount: 0, departureList: '• None',
    inHouseCount: 2, requestCount: 1, balanceDue: '₹5,000'
  };
}

function testEmail_(to, sess) {
  to = String(to || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('Enter a valid email address.');
  const s = getSettings_();
  const msg = {
    subject: 'Test email from Swarga by the Bay',
    text: 'This is a test from the Swarga by the Bay admin.\n\nSent by ' + sess.name + ' at ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'd MMM yyyy, HH:mm') + ' IST.\n\nIf you can read this, email notifications are working.'
  };
  msg.html = toHtml_(msg.text, s);
  const r = deliver_('test', to, msg, '', s);
  PropertiesService.getScriptProperties().setProperty('MAIL_LAST_TEST', stamp_().slice(1) + ' · ' + (r.ok ? 'Sent' : 'Failed: ' + r.error));
  audit_(sess, 'email.test', to, r.ok ? 'sent' : r.error);
  if (!r.ok) throw new Error(r.error);
  return { ok: true, remaining: r.remaining };
}

function emailLog_() {
  const rows = readAll_(EMAIL_LOG, EMAIL_HEADERS).map(r => { const c = strip_(r); delete c.Payload; return c; }).reverse();
  return { ok: true, rows: rows.slice(0, 300) };
}

function resendEmail_(id, sess) {
  const row = readAll_(EMAIL_LOG, EMAIL_HEADERS).filter(r => r['Email ID'] === id)[0];
  if (!row) throw new Error('Email not found.');
  const s = getSettings_();
  let text = '';
  try { text = JSON.parse(row.Payload).text; } catch (e) { throw new Error('Original content not available.'); }
  const msg = { subject: row.Subject, text: text, html: toHtml_(text, s) };
  const r = attempt_(id, row.To, msg, s);
  audit_(sess, 'email.resend', id, r.ok ? 'sent' : r.error);
  if (!r.ok) throw new Error(r.error);
  return { ok: true };
}

/** Admin: send a guest template for a booking now (e.g. resend confirmation). */
function sendForBooking_(key, bookingId, sess) {
  if (['bookingConfirmed', 'preArrival', 'paymentReceipt', 'requestReceived', 'thankYou', 'bookingCancelled'].indexOf(key) === -1) throw new Error('Not a guest email.');
  const b = findBy_(BOOKINGS, BOOKING_HEADERS, bookingId);
  if (!b.Email) throw new Error('This booking has no guest email. Add it via Edit booking.');
  const s = getSettings_();
  const vars = bookingVars_(b, s);
  if (key === 'paymentReceipt') {
    const last = readAll_(PAYMENTS, PAYMENT_HEADERS).filter(p => p['Booking ID'] === bookingId).pop();
    if (!last) throw new Error('No payment recorded yet.');
    Object.assign(vars, paymentVars_(last));
  }
  const r = deliver_(key, b.Email, render_(key, vars, s), bookingId, s);
  audit_(sess, 'email.send', bookingId, key + (r.ok ? ' sent' : ' failed: ' + r.error));
  if (!r.ok) throw new Error(r.error);
  return { ok: true };
}

function paymentVars_(p) {
  const kind = p.Kind === 'Refund' ? 'Refund' : 'Payment';
  return { paymentKind: kind, paymentKindLower: kind.toLowerCase(), paymentAmount: inr_(Math.abs(money_(p.Amount))), paymentMode: p.Mode };
}

/* ---------- scheduled jobs ---------- */

/** Installed by a Super admin from Settings. Runs daily 8 AM IST + hourly retry. */
function installTriggers_(sess) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['dailyJobs', 'retryFailedEmails'].indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyJobs').timeBased().atHour(8).everyDays(1).inTimezone('Asia/Kolkata').create();
  ScriptApp.newTrigger('retryFailedEmails').timeBased().everyHours(1).create();
  PropertiesService.getScriptProperties().setProperty('TRIGGERS_AT', stamp_().slice(1));
  audit_(sess, 'triggers.install', '', 'daily 8 AM + hourly retry');
  return { ok: true, installedAt: PropertiesService.getScriptProperties().getProperty('TRIGGERS_AT') };
}

function triggerStatus_() {
  let names = [];
  try { names = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()); } catch (e) {}
  return { daily: names.indexOf('dailyJobs') > -1, retry: names.indexOf('retryFailedEmails') > -1, installedAt: PropertiesService.getScriptProperties().getProperty('TRIGGERS_AT') || '' };
}

function dailyJobs() {
  const today = todayIso_();
  const tomorrow = Utilities.formatDate(new Date(Date.now() + 864e5), 'Asia/Kolkata', 'yyyy-MM-dd');
  const bookings = readAll_(BOOKINGS, BOOKING_HEADERS);

  // Pre-arrival reminders: confirmed, arriving tomorrow, check-in form not yet received.
  bookings.filter(b => b.Status === 'Confirmed' && b['Check-in Date'] === tomorrow && !b['Check-in Ref'] && b.Email)
    .forEach(b => notify_('preArrival', b, { once: true }));

  // Staff daily summary.
  const rooms = readAll_(ROOMS, ROOM_HEADERS);
  const rn = (b) => roomList_(b['Room IDs']).map(id => (rooms.filter(r => r['Room ID'] === id)[0] || {}).Name || id).join(', ') || 'room TBA';
  const arr = bookings.filter(b => b.Status === 'Confirmed' && b['Check-in Date'] === today);
  const dep = bookings.filter(b => b.Status === 'Checked in' && b['Check-out Date'] <= today);
  const line = (b) => '• ' + b['Guest Name'] + ' · ' + rn(b) + ' · ' + b.Mobile;
  const due = bookings.filter(b => ['Cancelled', 'No-show'].indexOf(b.Status) === -1).reduce((t, b) => t + Math.max(0, money_(b.Total) - money_(b.Paid)), 0);
  notify_('dailySummary', null, {
    ref: 'daily-' + today, once: true,
    extra: {
      arrivalCount: arr.length, arrivalList: arr.map(line).join('\n') || '• None',
      departureCount: dep.length, departureList: dep.map(line).join('\n') || '• None',
      inHouseCount: bookings.filter(b => b.Status === 'Checked in').length,
      requestCount: bookings.filter(b => b.Status === 'Requested').length,
      balanceDue: inr_(due)
    }
  });
}

function retryFailedEmails() {
  const s = getSettings_();
  readAll_(EMAIL_LOG, EMAIL_HEADERS).filter(r => r.Status === 'Failed' && (Number(r.Attempts) || 0) < 3).forEach(r => {
    let text = '';
    try { text = JSON.parse(r.Payload).text; } catch (e) { return; }
    attempt_(r['Email ID'], r.To, { subject: r.Subject, text: text, html: toHtml_(text, s) }, s);
  });
}

/** Run once from the Apps Script editor after deploying, to grant the email/trigger permissions. */
function authorize() {
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.getRequest('https://www.google.com');
  ScriptApp.getProjectTriggers();
  Logger.log('Permissions granted.');
}

/* ---------- Mailer source (deployed in the SENDER's Google account) ---------- */

const MAILER_SOURCE_ = [
  '/**',
  ' * Swarga by the Bay — Mailer. Deploy this in the Google account that should SEND the emails.',
  ' * 1. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.',
  ' * 2. Approve the "Send email as you" permission.',
  ' * 3. Copy the Web app URL (ends in /exec) and give it to the Super admin.',
  ' * Only requests signed with the key below are accepted. Do not share this code.',
  ' */',
  "const SECRET = '__SECRET__';",
  '',
  'function doGet() {',
  "  return out_({ ok: true, service: 'swarga-mailer' });",
  '}',
  '',
  'function doPost(e) {',
  '  try {',
  "    const b = JSON.parse(e.postData.contents || '{}');",
  "    if (!b.sig || !b.ts || !b.nonce || !b.to) throw new Error('Bad request.');",
  "    if (Math.abs(Date.now() - Number(b.ts)) > 5 * 60 * 1000) throw new Error('Request expired.');",
  "    const expect = Utilities.computeHmacSha256Signature([b.ts, b.nonce, b.to, b.subject].join('\\n'), SECRET)",
  "      .map(x => ('0' + (x & 0xff).toString(16)).slice(-2)).join('');",
  "    if (expect !== b.sig) throw new Error('Invalid signature.');",
  '    const cache = CacheService.getScriptCache();',
  "    if (cache.get('n_' + b.nonce)) throw new Error('Replay blocked.');",
  "    cache.put('n_' + b.nonce, '1', 600);",
  "    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(b.to)) throw new Error('Invalid recipient.');",
  "    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Daily email quota reached.');",
  '    const opts = { to: b.to, subject: String(b.subject).slice(0, 250), body: String(b.text || \'\'), htmlBody: String(b.html || \'\'), name: b.name || \'Swarga by the Bay\' };',
  '    if (b.replyTo) opts.replyTo = b.replyTo;',
  '    MailApp.sendEmail(opts);',
  '    return out_({ ok: true, remaining: MailApp.getRemainingDailyQuota() });',
  '  } catch (err) {',
  '    return out_({ ok: false, error: String(err.message || err) });',
  '  }',
  '}',
  '',
  'function out_(o) {',
  '  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);',
  '}',
  '',
  '/** Optional: run once in the editor to approve the permission before deploying. */',
  'function authorize() { MailApp.getRemainingDailyQuota(); }'
].join('\n');
