(function () {
  const C = window.SWARGA_CONFIG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const form = $('#checkin');
  const f = form.elements;
  const steps = $$('.step');
  const TOTAL = steps.length;
  const MAX_BYTES = 5 * 1024 * 1024;
  const CIN = C.CHECKIN_TIME || '13:00';
  const COUT = C.CHECKOUT_TIME || '11:00';
  let current = 0;
  let idFile = null;
  let bookingId = '';
  const setters = {};

  /* ---------- helpers ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s) => s ? parse(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
  const fmtTime = (t) => {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    return ((h % 12) || 12) + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM');
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer;
  function toast(text) {
    const t = $('#msg');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- config contacts ---------- */
  [['#cfgEmergency', C.PROPERTY_EMERGENCY], ['#cfgCaretaker', C.CARETAKER], ['#cfgHospital', C.NEAREST_HOSPITAL]]
    .forEach(([id, v]) => {
      if (!v) return;
      if (typeof v === 'string') { $(id).textContent = v; return; }
      let html = '<b>' + esc(v.name || '') + '</b>';
      if (v.phone) html += '<a class="tel" href="tel:' + esc(v.phone.replace(/[^+0-9]/g, '')) + '">📞 ' + esc(v.phone) + '</a>';
      if (v.map) html += '<a class="tel" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v.map) + '">📍 Directions</a>';
      $(id).innerHTML = html;
    });

  /* ---------- stay: dates + fixed times ---------- */
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 864e5);
  f.checkInDate.value = iso(today);
  f.checkOutDate.value = iso(tomorrow);
  f.checkInTime.value = CIN;
  f.checkOutTime.value = COUT;
  $('#checkInTimeLabel').textContent = fmtTime(CIN);
  $('#checkOutTimeLabel').textContent = fmtTime(COUT);

  function updateNights() {
    const a = f.checkInDate.value, b = f.checkOutDate.value;
    f.checkOutDate.min = a;
    if (a && b && b < a) {
      f.checkOutDate.value = iso(new Date(parse(a).getTime() + 864e5));
    }
    const n = Math.round((parse(f.checkOutDate.value) - parse(a)) / 864e5);
    $('#nights').textContent = n <= 0 ? 'Same day' : n + (n === 1 ? ' night' : ' nights');
  }
  f.checkInDate.addEventListener('change', updateNights);
  f.checkOutDate.addEventListener('change', updateNights);
  updateNights();

  $$('.time-chip').forEach(chip => chip.addEventListener('click', () => {
    const input = f[chip.dataset.time];
    chip.classList.add('hidden');
    input.classList.remove('hidden');
    input.focus();
  }));

  /* ---------- steppers ---------- */
  $$('.stepper').forEach(st => {
    const name = st.dataset.name, min = +st.dataset.min, max = +st.dataset.max;
    const out = $('output', st), hidden = f[name];
    const [minus, plus] = $$('button', st);
    const sync = (v) => {
      hidden.value = v;
      out.textContent = v;
      minus.disabled = v <= min;
      plus.disabled = v >= max;
      if (name === 'vehicles') renderPlates(v);
      if (name === 'adults' || name === 'children') renderGuests();
    };
    st.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = Math.min(max, Math.max(min, +hidden.value + +b.dataset.d));
      sync(v);
      out.classList.remove('pop'); void out.offsetWidth; out.classList.add('pop');
    });
    sync(+hidden.value);
    setters[name] = (v) => sync(Math.min(max, Math.max(min, v)));
  });

  /* ---------- vehicle numbers ---------- */
  function renderPlates(n) {
    const list = $('#plateList');
    const keep = $$('input', list).map(i => i.value);
    list.innerHTML = Array.from({ length: n }, (_, i) =>
      '<div class="field"><input id="plate' + i + '" class="plate" required minlength="4" maxlength="15" autocomplete="off" autocapitalize="characters" placeholder=" " value="' + esc(keep[i] || '') + '">' +
      '<label for="plate' + i + '">Vehicle ' + (i + 1) + ' number (e.g. KA 20 AB 1234)</label></div>').join('');
    $('#plateBlock').classList.toggle('hidden', n === 0);
  }
  const plates = () => $$('#plateList input').map(i => i.value.trim().toUpperCase()).filter(Boolean);
  $('#plateList').addEventListener('input', e => {
    if (e.target.classList.contains('plate')) {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.toUpperCase();
      e.target.setSelectionRange(pos, pos);
    }
  });

  /* ---------- other guests ---------- */
  var ID_TYPES = ['Aadhaar', 'Passport', 'Driving Licence', 'Voter ID', 'PAN', 'Other'];
  var others = []; // { kind, name, age, idType, idNumber, file }
  function renderGuests() {
    if (!others || !f.adults || !f.children) return;
    const na = Math.max(0, +f.adults.value - 1), nc = +f.children.value;
    const adults = others.filter(g => g.kind === 'Adult'), kids = others.filter(g => g.kind === 'Child');
    while (adults.length < na) adults.push({ kind: 'Adult', name: '', idType: '', idNumber: '', file: null });
    while (kids.length < nc) kids.push({ kind: 'Child', name: '', age: '', file: null });
    others.length = 0;
    others.push(...adults.slice(0, na), ...kids.slice(0, nc));
    const list = $('#guestList');
    if (!list) return;
    list.innerHTML = others.map((g, i) => {
      const n = i + 2, k = 'g' + i;
      const drop = '<label class="dropzone mini' + (g.file ? ' has-file' : '') + '" data-i="' + i + '"><input type="file" data-i="' + i + '" data-k="file" accept="image/jpeg,image/png,application/pdf">' +
        '<span class="dz-text">' + (g.file ? '✓ ' + esc(g.file.name) + ' · <u>Change</u>' : '📷 ' + (g.kind === 'Adult' ? 'Add ID photo <em class="req">required</em>' : 'Add ID photo (optional)')) + '</span></label>';
      return '<div class="gform" data-i="' + i + '"><h3 class="g-head"><span class="g-num">' + n + '</span> ' + (g.kind === 'Adult' ? 'Adult' : 'Child') + '</h3>' +
        '<div class="field"><input id="' + k + 'n" data-i="' + i + '" data-k="name" maxlength="120" placeholder=" " value="' + esc(g.name) + '"><label for="' + k + 'n">Full name</label></div>' +
        (g.kind === 'Adult'
          ? '<div class="field sel-field"><select id="' + k + 't" data-i="' + i + '" data-k="idType"><option value="">Choose…</option>' + ID_TYPES.map(t => '<option' + (t === g.idType ? ' selected' : '') + '>' + t + '</option>').join('') + '</select><label for="' + k + 't">ID type</label></div>' +
            '<div class="field"><input id="' + k + 'd" data-i="' + i + '" data-k="idNumber" maxlength="40" autocomplete="off" placeholder=" " value="' + esc(g.idNumber) + '"><label for="' + k + 'd">ID number</label></div>'
          : '<div class="field"><input id="' + k + 'a" data-i="' + i + '" data-k="age" type="number" inputmode="numeric" min="0" max="17" placeholder=" " value="' + esc(g.age) + '"><label for="' + k + 'a">Age</label></div>') +
        drop + '</div>';
    }).join('');
  }
  $('#guestList').addEventListener('input', e => { const i = e.target.dataset.i, k = e.target.dataset.k; if (i != null && k && k !== 'file') others[+i][k] = e.target.value; });
  $('#guestList').addEventListener('change', e => {
    const t = e.target, i = t.dataset.i;
    if (i == null) return;
    if (t.dataset.k === 'idType') others[+i].idType = t.value;
    if (t.dataset.k === 'file' && t.files[0]) {
      const file = t.files[0];
      if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(file.type)) return toast('Please use a JPG, PNG or PDF file.');
      if (file.type === 'application/pdf' && file.size > MAX_BYTES) return toast('That PDF is larger than 5 MB.');
      others[+i].file = file;
      renderGuests();
    }
  });
  function validateGuests() {
    for (let i = 0; i < others.length; i++) {
      const g = others[i], box = $('.gform[data-i="' + i + '"]'), who = 'guest ' + (i + 2);
      const bad = (sel, text) => fail($(sel, box).closest('.field, .dropzone'), text, $(sel, box));
      if (!g.name.trim()) return bad('[data-k=name]', 'Please enter the full name of ' + who + '.');
      if (g.kind === 'Adult') {
        if (!g.idType) return bad('[data-k=idType]', 'Please choose the ID type for ' + g.name + '.');
        if (!g.idNumber.trim()) return bad('[data-k=idNumber]', 'Please enter the ID number for ' + g.name + '.');
        if (!g.file) return bad('[data-k=file]', 'Please add an ID photo for ' + g.name + '.');
      } else {
        const a = String(g.age).trim();
        if (a === '' || !(+a >= 0 && +a <= 17)) return bad('[data-k=age]', 'Please enter an age from 0 to 17 for ' + g.name + '.');
      }
    }
    return true;
  }
  renderGuests();

  /* ---------- ID dropzone ---------- */
  const dz = $('#dropzone');
  const dzInput = f.idPhoto;
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove('drag')));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  dzInput.addEventListener('change', () => setFile(dzInput.files[0]));

  function setFile(file) {
    if (!file) return;
    if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(file.type)) return toast('Please use a JPG, PNG or PDF file.');
    if (file.type === 'application/pdf' && file.size > MAX_BYTES) return toast('That PDF is larger than 5 MB.');
    idFile = file;
    $('.dz-empty', dz).classList.add('hidden');
    const pv = $('.dz-preview', dz);
    pv.classList.remove('hidden');
    $('.dz-name', pv).textContent = file.name;
    const img = $('img', pv);
    if (file.type === 'application/pdf') { img.removeAttribute('src'); img.alt = 'PDF'; }
    else { img.src = URL.createObjectURL(file); img.alt = 'ID preview'; }
  }

  // Resize images to max 1600px JPEG; pass PDFs through.
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (file.type === 'application/pdf') {
        const r = new FileReader();
        r.onload = () => resolve({ mime: file.type, data: r.result.split(',')[1] });
        r.onerror = () => reject(new Error('Could not read file.'));
        return r.readAsDataURL(file);
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve({ mime: 'image/jpeg', data: cv.toDataURL('image/jpeg', 0.82).split(',')[1] });
      };
      img.onerror = () => reject(new Error('Could not read image.'));
      img.src = url;
    });
  }

  /* ---------- group + signature ---------- */
  f.groupBooking.addEventListener('change', () => {
    $('#groupBlock').classList.toggle('hidden', !f.groupBooking.checked);
    f.leadGuestName.required = f.groupBooking.checked;
    if (f.groupBooking.checked && !f.leadGuestName.value) f.leadGuestName.value = f.guestName.value;
  });

  const sig = $('#sigRender');
  let sigTimer;
  f.declarationName.addEventListener('input', () => {
    clearTimeout(sigTimer);
    sigTimer = setTimeout(() => {
      sig.textContent = f.declarationName.value;
      sig.classList.remove('ink'); void sig.offsetWidth; sig.classList.add('ink');
    }, 250);
  });
  $('#sigDate').textContent = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  /* ---------- summary ---------- */
  function renderSummary() {
    const guests = f.adults.value + ' adult' + (f.adults.value === '1' ? '' : 's') +
      (+f.children.value ? ', ' + f.children.value + ' child' + (f.children.value === '1' ? '' : 'ren') : '');
    const item = (label, value, step) =>
      '<div><small>' + label + ' <button type="button" class="edit" data-go="' + step + '">Edit</button></small><strong>' + esc(value) + '</strong></div>';
    $('#summary').innerHTML =
      item('Guest', f.guestName.value, 1) +
      item('Guests', guests, 0) +
      item('Check-in', fmtDate(f.checkInDate.value) + ' · ' + fmtTime(f.checkInTime.value), 0) +
      item('Check-out', fmtDate(f.checkOutDate.value) + ' · ' + fmtTime(f.checkOutTime.value), 0) +
      (+f.vehicles.value ? item('Vehicles', f.vehicles.value + (plates().length ? ' · ' + plates().join(', ') : ' · number not given'), 0) : '') +
      item('ID', f.idType.value + ' · ' + f.idNumber.value, 2) +
      (others.length ? item('Other guests', others.map(g => g.name + (g.kind === 'Child' ? ' (' + g.age + ')' : '')).join(', '), 2) : '') +
      item('Emergency', f.emergencyName.value + ' · ' + f.emergencyPhone.value, 1);
  }
  $('#summary').addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) go(+b.dataset.go, true);
  });

  /* ---------- desktop side panel ---------- */
  $('#sideSteps').innerHTML = steps.map((st, n) => '<li><span>' + (n + 1) + '</span>' + esc(st.dataset.title) + '</li>').join('');
  $('#sideIn').textContent = fmtTime(CIN);
  $('#sideOut').textContent = fmtTime(COUT);
  function syncSide(i) {
    $$('#sideSteps li').forEach((li, n) => {
      li.classList.toggle('is-done', n < i);
      li.classList.toggle('is-now', n === i);
    });
  }

  /* ---------- navigation ---------- */
  function go(i, backward) {
    $('#msg').classList.remove('show');
    steps[current].classList.remove('active', 'back');
    current = i;
    const s = steps[i];
    s.classList.add('active');
    s.classList.toggle('back', !!backward);
    $$('.rules li', s).forEach((li, n) => { li.style.animationDelay = Math.min(n * 40, 600) + 'ms'; });
    if (i === TOTAL - 1) renderSummary();
    if (s.dataset.step === '3') $('#youName').textContent = f.guestName.value.trim();
    syncSide(i);
    $('#stepCount').textContent = (i + 1) + ' / ' + TOTAL;
    $('#progressFill').style.width = ((i + 1) / TOTAL * 100) + '%';
    $('#actionHint').textContent = s.dataset.title;
    const next = $('#nextBtn');
    next.textContent = i === TOTAL - 1 ? 'Complete check-in' : 'Continue';
    next.classList.toggle('final', i === TOTAL - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validate(step) {
    const els = $$('input[required]', step);
    for (const el of els) {
      if (el.type === 'radio') {
        if (!$$('input[name="' + el.name + '"]', step).some(r => r.checked)) return fail(el.closest('.chips'), 'Please choose your ID type.');
        continue;
      }
      if (el.type === 'checkbox') {
        if (!el.checked) return fail(el.closest('.agree'), 'Please tick to confirm before continuing.');
        continue;
      }
      if (!el.value.trim() || !el.checkValidity()) {
        const label = ((step.querySelector('label[for="' + el.id + '"]') || {}).textContent || 'this field').toLowerCase();
        const text = !el.value.trim() ? 'Please enter your ' + label + '.'
          : el.type === 'tel' ? 'Please check your ' + label + ' (digits only, optional + country code).'
          : 'Please check your ' + label + '.';
        return fail(el.closest('.field') || el, text, el);
      }
    }
    if (step.dataset.step === '1' && f.checkOutDate.value < f.checkInDate.value) return fail(f.checkOutDate, 'Check-out must be after check-in.');
    if (step.dataset.step === '3') {
      if (!idFile) return fail(dz, 'Please add a photo of your ID proof.');
      if (!validateGuests()) return false;
      const bytes = [idFile].concat(others.map(g => g.file)).filter(Boolean).reduce((s, x) => s + (x.type === 'application/pdf' ? x.size : 400000), 0);
      if (bytes > 35 * 1024 * 1024) return fail(dz, 'The ID files are too large together. Please use photos instead of PDFs.');
    }
    return true;
  }

  function fail(box, text, focusEl) {
    toast(text);
    if (box) {
      box.classList.add('invalid', 'shake');
      setTimeout(() => box.classList.remove('shake'), 400);
      box.addEventListener('input', () => box.classList.remove('invalid'), { once: true });
      box.addEventListener('change', () => box.classList.remove('invalid'), { once: true });
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (focusEl) focusEl.focus({ preventScroll: true });
    return false;
  }

  $('#startBtn').addEventListener('click', () => {
    $('#welcome').classList.add('hidden');
    $('#wizard').classList.remove('hidden');
    go(0);
  });
  $('#backBtn').addEventListener('click', () => {
    if (current === 0) {
      $('#wizard').classList.add('hidden');
      $('#welcome').classList.remove('hidden');
    } else go(current - 1, true);
  });
  $('#nextBtn').addEventListener('click', () => {
    if (!validate(steps[current])) return;
    if (current < TOTAL - 1) go(current + 1);
    else submit();
  });
  form.addEventListener('submit', e => { e.preventDefault(); $('#nextBtn').click(); });

  /* ---------- submit ---------- */
  async function submit() {
    const btn = $('#nextBtn');
    btn.disabled = true;
    btn.textContent = 'Checking you in…';
    try {
      const data = {
        guestName: f.guestName.value, mobile: f.mobile.value, email: f.email.value,
        adults: f.adults.value, children: f.children.value, vehicles: f.vehicles.value,
        vehicleNumbers: plates(),
        bookingId: bookingId,
        checkInDate: f.checkInDate.value, checkInTime: f.checkInTime.value,
        checkOutDate: f.checkOutDate.value, checkOutTime: f.checkOutTime.value,
        idType: f.idType.value, idNumber: f.idNumber.value,
        idPhoto: await readFile(idFile),
        guests: await Promise.all(others.map(async g => ({ kind: g.kind, name: g.name, age: g.age, idType: g.idType || '', idNumber: g.idNumber || '', idPhoto: await readFile(g.file) }))),
        emergencyName: f.emergencyName.value, emergencyPhone: f.emergencyPhone.value,
        ackHouse: f.ackHouse.checked, ackSea: f.ackSea.checked, ackWeather: f.ackWeather.checked,
        ackLiability: f.ackLiability.checked, ackData: f.ackData.checked,
        groupBooking: f.groupBooking.checked, leadGuestName: f.leadGuestName.value,
        declarationName: f.declarationName.value, declarationAgreed: f.declarationAgreed.checked,
        userAgent: navigator.userAgent
      };
      const res = await fetch(C.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight
        body: JSON.stringify({ action: 'submit', data })
      }).then(r => r.json());
      if (!res.ok) throw new Error(res.error || 'Submission failed.');
      showDone(res.id);
    } catch (err) {
      toast(err.message && err.message !== 'Failed to fetch' ? err.message : 'Network issue. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Complete check-in';
    }
  }

  function showDone(id) {
    $('#wizard').classList.add('hidden');
    $('#doneName').textContent = f.guestName.value.trim().split(/\s+/)[0];
    $('#doneIn').textContent = fmtDate(f.checkInDate.value) + ', ' + fmtTime(f.checkInTime.value);
    $('#doneOut').textContent = fmtDate(f.checkOutDate.value) + ', ' + fmtTime(f.checkOutTime.value);
    $('#refId').textContent = id;
    $('#done').classList.remove('hidden');
    window.scrollTo(0, 0);
    confetti();
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ff6a4d', '#ffb347', '#2aa6a8', '#11607a', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (2.2 + Math.random() * 2) + 's';
      c.style.animationDelay = Math.random() * .6 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }
  /* ---------- booking link (?b=SBK-...) ---------- */
  (async function prefillFromBooking() {
    const code = (new URLSearchParams(location.search).get('b') || '').trim().toUpperCase();
    if (!code) return;
    const banner = $('#bookingBanner');
    banner.classList.remove('hidden');
    banner.textContent = 'Finding your booking…';
    try {
      const res = await fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'booking', code }) }).then(r => r.json());
      if (!res.ok) throw new Error(res.error);
      const b = res.booking;
      bookingId = b.id;
      f.guestName.value = b.guestName || '';
      if (b.checkIn) f.checkInDate.value = b.checkIn;
      if (b.checkOut) f.checkOutDate.value = b.checkOut;
      updateNights();
      if (setters.adults) setters.adults(+b.adults || 1);
      if (setters.children) setters.children(+b.children || 0);
      banner.innerHTML = '<strong>Welcome, ' + esc((b.guestName || '').split(/\s+/)[0]) + '</strong> · Booking ' + esc(b.id) +
        (b.rooms && b.rooms.length ? ' · ' + esc(b.rooms.join(', ')) : '') +
        (b.alreadyCheckedIn ? '<br><small>A check-in form was already sent for this booking. Submitting again adds another record.</small>' : '');
    } catch (e) {
      banner.innerHTML = 'We couldn\'t find that booking link. You can still check in below.';
    }
  })();
})();
