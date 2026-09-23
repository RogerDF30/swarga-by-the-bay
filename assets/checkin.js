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
    .forEach(([id, v]) => { if (v) $(id).textContent = v; });

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
    };
    st.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = Math.min(max, Math.max(min, +hidden.value + +b.dataset.d));
      sync(v);
      out.classList.remove('pop'); void out.offsetWidth; out.classList.add('pop');
    });
    sync(+hidden.value);
  });

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
      item('ID', f.idType.value + ' · ' + f.idNumber.value, 2) +
      item('Emergency', f.emergencyName.value + ' · ' + f.emergencyPhone.value, 1);
  }
  $('#summary').addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) go(+b.dataset.go, true);
  });

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
        checkInDate: f.checkInDate.value, checkInTime: f.checkInTime.value,
        checkOutDate: f.checkOutDate.value, checkOutTime: f.checkOutTime.value,
        idType: f.idType.value, idNumber: f.idNumber.value,
        idPhoto: await readFile(idFile),
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
})();
