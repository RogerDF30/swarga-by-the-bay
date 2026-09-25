/**
 * Swarga by the Bay — consent text shown on the check-in form, and the check-in PDF.
 * Keep CONSENT_TEXT in step with index.html. When the form wording changes, copy the new
 * text here and bump CONSENT_VERSION; each check-in stores the version it was signed under.
 */

const CONSENT_VERSION = '2026-09-23';

const CONSENT_TEXT = {
  "sections": [
    {
      "key": "house",
      "title": "House rules",
      "paras": [],
      "items": [
        "Check-in and check-out times must be followed unless prior permission is obtained.",
        "The property is provided for the number of guests declared at the time of booking. Additional guests require prior approval.",
        "Guests are requested to maintain cleanliness and take care of the property, furniture, appliances and other facilities.",
        "Any damage, breakage or loss caused by a guest will be chargeable.",
        "Please switch off lights, air conditioners, fans and electrical appliances when not required.",
        "Smoking is not permitted inside rooms or enclosed areas. Cigarette butts must not be discarded on the beach or property.",
        "Alcohol consumption, where permitted by law, must be responsible and must not disturb other guests or neighbours.",
        "Loud music, parties, shouting or activities disturbing neighbours or other guests are not permitted.",
        "Illegal activities, possession or use of prohibited substances, weapons or other unlawful activities are strictly prohibited.",
        "Guests are responsible for their personal belongings. The management is not responsible for loss or damage to valuables left unattended.",
        "Children must be supervised by their parents/guardians at all times, particularly around the beach, balconies, stairs and water.",
        "Pets are allowed only with prior approval and must be supervised by their owners. Pet owners are responsible for cleaning up after their pets.",
        "Cooking, where kitchen facilities are provided, must be done safely. Gas/electrical appliances must be switched off after use.",
        "Do not move furniture or outdoor equipment to the beach without permission.",
        "Please do not take property items, towels, furniture or equipment onto the sea or beach unless specifically permitted."
      ],
      "ack": "I/We have read and agree to the House Rules."
    },
    {
      "key": "sea",
      "title": "Beach & sea safety",
      "paras": [
        "Swarga by the Bay is a beachfront property. The sea is a natural environment and conditions can change rapidly. Guests acknowledge that entering the sea is at their own risk."
      ],
      "items": [
        "There may be strong currents, waves, sudden changes in water depth and underwater hazards.",
        "Swimming or entering the sea should be avoided during rough weather, heavy rain, storms, high waves or strong currents.",
        "Do not enter the sea after consuming alcohol or any substance that may impair judgment or coordination.",
        "Children must never enter the sea or play near the water without direct adult supervision.",
        "Never swim alone. Stay within your ability and remain close to shore.",
        "Do not venture into deeper water, rocks, fishing areas or restricted areas.",
        "Do not attempt to rescue another person from the sea by entering the water unless you are trained to do so. Call for professional assistance immediately.",
        "Guests should follow warnings from local authorities, lifeguards or property staff regarding sea conditions.",
        "Beach toys, bodyboards, life jackets or other equipment provided by the property must be used responsibly and only for their intended purpose.",
        "Life jackets are not a substitute for supervision or swimming ability.",
        "Equipment must be returned after use and any damage must be reported immediately.",
        "Avoid the sea during lightning, thunderstorms or other dangerous weather conditions.",
        "At night, guests are advised not to enter the sea, as visibility and awareness of currents and hazards are significantly reduced.",
        "Do not consume food or alcohol while swimming or engaging in water activities.",
        "Please be alert for sharp objects, shells, rocks, fishing equipment and other hazards on the beach.",
        "The beach is a natural environment. Guests should not disturb marine life or remove shells, creatures or other natural material."
      ],
      "ack": "I/We have read and understood the Beach & Sea Safety guidelines and accept that entering the sea is at my/our own risk."
    },
    {
      "key": "weather",
      "title": "Good to know",
      "blocks": [
        {
          "title": "Emergency & safety",
          "paras": [
            "In case of an emergency:"
          ],
          "items": [
            "Immediately inform the property caretaker/management.",
            "Call 112 for emergency assistance where required.",
            "For a medical emergency, seek professional medical assistance immediately.",
            "In case of a fire, evacuate the building and inform the caretaker/management immediately.",
            "Do not attempt to handle dangerous electrical, gas or fire-related situations unless you are trained to do so."
          ]
        },
        {
          "title": "Weather & natural conditions",
          "paras": [
            "Guests acknowledge that beachfront properties are exposed to natural conditions including:",
            "Such natural conditions are beyond the reasonable control of the property management.",
            "Management may restrict beach or sea access whenever conditions are considered unsafe."
          ],
          "items": [
            "Strong winds",
            "Heavy rain and storms",
            "High waves and strong currents",
            "Lightning and thunderstorms",
            "Temporary power or internet interruptions",
            "Sand, salt and moisture",
            "Insects and other natural wildlife"
          ]
        },
        {
          "title": "Respect for the property & environment",
          "paras": [
            "Guests are requested to:"
          ],
          "items": [
            "Keep the beach and property clean.",
            "Use waste bins provided.",
            "Avoid plastic or other waste entering the sea.",
            "Respect local residents, fishermen and other beach users.",
            "Avoid unnecessary disturbance to marine life.",
            "Conserve water and electricity.",
            "Report leaks, electrical problems or other safety concerns immediately."
          ]
        }
      ],
      "ack": "I/We acknowledge the Weather & Natural Conditions."
    },
    {
      "key": "liability",
      "title": "Liability & acknowledgement",
      "paras": [
        "I/We confirm that I/we have read and understood the above house rules and sea-safety guidelines.",
        "I/We understand that the property is located directly beside the sea and that the sea, beach, weather and surrounding natural environment involve inherent risks.",
        "I/We agree to exercise reasonable care and accept responsibility for our own safety and the safety of children/minors under our supervision.",
        "I/We understand that parents/guardians remain responsible for children and that the property staff cannot provide continuous supervision of guests or children.",
        "I/We agree to follow instructions given by the property management/caretaker concerning safety, weather conditions and access to the beach or sea.",
        "I/We further agree to compensate the property for any damage caused by me/us through negligence, misuse or violation of the house rules."
      ],
      "items": [],
      "ack": "I/We accept the Liability & Acknowledgement above."
    }
  ],
  "extra": {
    "group": "I confirm that I have communicated the relevant house rules and sea-safety instructions to all members of my group.",
    "data": "I consent to Swarga by the Bay storing the details and ID proof above for guest registration and safety purposes during and after my stay.",
    "signature": "I agree that typing my name above is my signature on this declaration. Date and time are recorded on submission."
  }
};

/* ---------- check-in PDF ---------- */

function pdfEsc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function pdfFile_(fileId) {
  if (!fileId) return null;
  try {
    const f = DriveApp.getFileById(fileId), blob = f.getBlob();
    return { mime: blob.getContentType(), name: f.getName(), data: Utilities.base64Encode(blob.getBytes()) };
  } catch (e) { return null; }
}

function pdfSection_(sec) {
  let h = '<h3>' + pdfEsc_(sec.title) + '</h3>';
  const block = (b) => {
    let o = b.title ? '<h4>' + pdfEsc_(b.title) + '</h4>' : '';
    const paras = b.paras || [], items = b.items || [];
    if (paras[0]) o += '<p>' + pdfEsc_(paras[0]) + '</p>';
    if (items.length) o += '<ol>' + items.map(i => '<li>' + pdfEsc_(i) + '</li>').join('') + '</ol>';
    paras.slice(1).forEach(p => { o += '<p>' + pdfEsc_(p) + '</p>'; });
    return o;
  };
  h += sec.blocks ? sec.blocks.map(block).join('') : block({ paras: sec.paras, items: sec.items });
  return h;
}

/** Builds the check-in record + signed consent + ID proofs as one PDF. */
function checkinPdf_(submissionId, sess) {
  const c = checkinRow_(submissionId).obj;
  const others = readAll_(GUESTS, GUEST_HEADERS).filter(g => g['Submission ID'] === submissionId);
  const s = getSettings_();
  const v = (k) => pdfEsc_(c[k] || '—');
  const version = c['Consent Version'] || CONSENT_VERSION;
  const accepted = (label) => '<div class="ack"><span class="tick">✔</span> <b>Accepted:</b> ' + pdfEsc_(label) + '</div>';
  const row = (k, val) => '<tr><th>' + pdfEsc_(k) + '</th><td>' + val + '</td></tr>';

  const idImgs = [], attachments = [];
  const addId = (label, fileId) => {
    const f = pdfFile_(fileId);
    if (!f) { idImgs.push({ label: label, html: '<p class="muted">No ID file on record.</p>' }); return; }
    if (f.mime === 'application/pdf') {
      attachments.push({ label: label, name: f.name, mime: f.mime, data: f.data });
      idImgs.push({ label: label, html: '<p class="muted">ID proof was supplied as a PDF file (' + pdfEsc_(f.name) + '). It is downloaded alongside this document.</p>' });
    } else {
      idImgs.push({ label: label, html: '<img class="idimg" src="data:' + f.mime + ';base64,' + f.data + '">' });
    }
  };
  addId('Guest 1 · ' + (c['Guest Name'] || '') + ' · ' + (c['ID Type'] || ''), c['ID Photo File ID']);
  others.forEach(g => { if (g.Kind === 'Adult' || g['ID Photo File ID']) addId('Guest ' + g['No.'] + ' · ' + g.Name + (g['ID Type'] ? ' · ' + g['ID Type'] : ''), g['ID Photo File ID']); });

  const guestRows = '<tr><td>1</td><td>' + v('Guest Name') + ' <span class="muted">(primary)</span></td><td>Adult</td><td>' + v('ID Type') + (c['ID Number'] ? ' · ' + v('ID Number') : '') + '</td></tr>' +
    others.map(g => '<tr><td>' + pdfEsc_(g['No.']) + '</td><td>' + pdfEsc_(g.Name) + '</td><td>' + (g.Kind === 'Child' ? 'Child, age ' + pdfEsc_(g.Age) : 'Adult') + '</td><td>' +
      (g['ID Type'] ? pdfEsc_(g['ID Type']) + (g['ID Number'] ? ' · ' + pdfEsc_(g['ID Number']) : '') : '—') + '</td></tr>').join('');

  const sec = CONSENT_TEXT.sections, ex = CONSENT_TEXT.extra;
  const html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Helvetica,Arial,sans-serif;font-size:10.5pt;color:#17252b;line-height:1.45}' +
    '.brand{color:#0b3d52;padding:0 0 8px;border-bottom:3px solid #2aa6a8}.brand b{font-family:Georgia,serif;font-size:20pt}.brand i{font-family:Georgia,serif;font-size:13pt;color:#11607a}' +
    '.brand small{display:block;color:#62727a;font-size:9pt;margin-top:2px}' +
    'h2{font-family:Georgia,serif;color:#0b3d52;font-size:14pt;margin:18px 0 6px;border-bottom:2px solid #2aa6a8;padding-bottom:3px}' +
    'h3{font-family:Georgia,serif;color:#0b3d52;font-size:12pt;margin:14px 0 4px}h4{margin:8px 0 2px;font-size:10.5pt}' +
    'table{width:100%;border-collapse:collapse;margin:4px 0}th,td{text-align:left;vertical-align:top;padding:4px 6px;border-bottom:1px solid #e3e7e8;font-size:10pt}th{width:34%;color:#62727a;font-weight:normal}' +
    'table.g th{width:auto;color:#0b3d52;font-weight:bold;background:#e6f5f4}' +
    'ol{margin:2px 0 6px 18px;padding:0}li{margin:1px 0}p{margin:3px 0}' +
    '.ack{background:#e8f4ec;border-left:4px solid #1f8a5b;padding:6px 10px;margin:6px 0 10px}.tick{color:#1f8a5b}' +
    '.sig{border:1px solid #cfd8da;border-radius:6px;padding:10px 14px;margin-top:8px}.sig .name{font-family:Georgia,serif;font-style:italic;font-size:20pt;color:#0b3d52}' +
    '.muted{color:#62727a}.page{page-break-before:always}.idimg{max-width:100%;max-height:22cm;border:1px solid #cfd8da}' +
    '.foot{margin-top:14px;font-size:8.5pt;color:#62727a}' +
    '</style></head><body>' +
    '<div class="brand"><b>Swarga</b> <i>by the Bay</i><small>Guest check-in record &amp; signed declaration · Kodi Beach, Udupi · ' + pdfEsc_(s.propertyPhone) + '</small></div>' +

    '<h2>Check-in record</h2><table>' +
    row('Reference', v('Submission ID')) + row('Submitted', v('Submitted At') + ' (IST)') +
    row('Booking', v('Booking ID')) +
    row('Check-in', v('Check-in Date') + ' · ' + v('Check-in Time')) + row('Check-out', v('Check-out Date') + ' · ' + v('Check-out Time')) +
    row('Primary guest', v('Guest Name')) + row('Mobile', v('Mobile')) + row('Email', v('Email')) +
    row('Guests', v('Adults') + ' adult(s), ' + (c.Children || '0') + ' child(ren)') +
    row('Vehicles', (Number(c.Vehicles) || 0) ? v('Vehicles') + (c['Vehicle Numbers'] ? ' · ' + v('Vehicle Numbers') : '') : 'None') +
    row('Emergency contact', v('Emergency Contact Name') + ' · ' + v('Emergency Contact No.')) +
    row('ID verified by staff', c.Status === 'Verified' ? v('Rep Name') + ' · ' + v('Rep Verified At') : 'Not yet verified') +
    row('Stay status', v('Stay Status') + (c['Actual Check-in'] ? ' · in ' + v('Actual Check-in') : '') + (c['Actual Check-out'] ? ' · out ' + v('Actual Check-out') : '')) +
    '</table>' +
    '<h3>All guests</h3><table class="g"><tr><th>#</th><th>Name</th><th>Type</th><th>ID</th></tr>' + guestRows + '</table>' +

    '<div class="page"></div><h2>Declarations accepted by the guest</h2>' +
    '<p class="muted">The guest read and accepted each section below on the online check-in form before submitting. Form text version ' + pdfEsc_(version) + '.</p>' +
    pdfSection_(sec[0]) + accepted(sec[0].ack) +
    pdfSection_(sec[1]) + accepted(sec[1].ack) +
    pdfSection_(sec[2]) + accepted(sec[2].ack) +
    pdfSection_(sec[3]) + accepted(sec[3].ack) +
    (c['Group Booking'] === 'Yes' ? '<h3>Group booking</h3><p>' + pdfEsc_(ex.group) + '</p>' + accepted('Group booking · lead guest ' + (c['Lead Guest Name'] || c['Guest Name'])) : '') +
    '<h3>Data consent</h3>' + accepted(ex.data) +

    '<h3>Signature</h3><div class="sig"><div class="name">' + v('Declaration Name') + '</div>' +
    '<div class="muted">' + pdfEsc_(ex.signature) + '</div>' +
    '<div>Signed electronically on ' + v('Submitted At') + ' IST · Reference ' + v('Submission ID') + '</div></div>' +

    idImgs.map(x => '<div class="page"></div><h2>ID proof · ' + pdfEsc_(x.label) + '</h2>' + x.html).join('') +

    '<div class="foot">Generated ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'd MMM yyyy, HH:mm') + ' IST by ' + pdfEsc_(sess.name) + '. Confidential: contains identity documents. Store and share only for guest registration and safety purposes.</div>' +
    '</body></html>';

  const pdf = Utilities.newBlob(html, 'text/html', submissionId + '.html').getAs('application/pdf');
  const name = 'Check-in ' + submissionId + ' ' + String(c['Guest Name'] || '').replace(/[^\w ]+/g, '').trim() + '.pdf';
  audit_(sess, 'checkin.pdf', submissionId, 'PDF generated' + (attachments.length ? ' + ' + attachments.length + ' PDF ID file(s)' : ''));
  return { ok: true, name: name, data: Utilities.base64Encode(pdf.getBytes()), attachments: attachments };
}
