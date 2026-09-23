(function () {
  const C = window.SWARGA_CONFIG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const form = $('#bookForm');
  const f = form.elements;
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s) => parse(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return ((h % 12) || 12) + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM'); };
  const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let rooms = [], available = null, picked = new Set(), toastTimer;
  function toast(t) { const m = $('#msg'); m.textContent = t; m.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => m.classList.remove('show'), 3500); }

  async function api(action, extra) {
    const r = await fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action }, extra || {})) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Something went wrong.');
    return j;
  }

  /* room photos */
  const photoData = {};
  function photoImg(p, alt, loading, w) {
    return p.url ? '<img src="' + esc(p.url.replace('=w1600', '=w' + w)) + '" alt="' + esc(alt) + '" loading="' + loading + '">'
      : '<img data-pid="' + esc(p.id) + '" alt="' + esc(alt) + '">';
  }
  async function hydrate(root) {
    for (const img of $$('img[data-pid]', root)) {
      const id = img.dataset.pid;
      try {
        if (!photoData[id]) { const r = await api('roomPhoto', { id }); photoData[id] = 'data:' + r.mime + ';base64,' + r.data; }
        img.src = photoData[id]; img.removeAttribute('data-pid');
      } catch (e) { /* skip */ }
    }
  }
  let lbRoom = null, lbI = 0;
  function openLightbox(roomId, i) {
    lbRoom = rooms.find(r => r.id === roomId); lbI = i;
    showLb();
    if (!$('#lightbox').open) $('#lightbox').showModal();
  }
  function showLb() {
    const ph = lbRoom.photos, p = ph[(lbI + ph.length) % ph.length];
    lbI = (lbI + ph.length) % ph.length;
    $('#lbImg').innerHTML = photoImg(p, lbRoom.name + ' photo ' + (lbI + 1), 'eager', 1600);
    $('#lbCap').textContent = lbRoom.name + ' · ' + (lbI + 1) + ' of ' + ph.length;
    $$('.lb-nav').forEach(b => b.classList.toggle('hidden', ph.length < 2));
    hydrate($('#lbImg'));
  }
  $('#lbPrev').addEventListener('click', () => { lbI--; showLb(); });
  $('#lbNext').addEventListener('click', () => { lbI++; showLb(); });
  $('#lbClose').addEventListener('click', () => $('#lightbox').close());
  $('#lightbox').addEventListener('click', e => { if (e.target === $('#lightbox')) $('#lightbox').close(); });
  $('#lightbox').addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { lbI--; showLb(); } if (e.key === 'ArrowRight') { lbI++; showLb(); } });
  let tx = null;
  $('#lightbox').addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  $('#lightbox').addEventListener('touchend', e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) { lbI += dx < 0 ? 1 : -1; showLb(); } tx = null; });

  /* dates */
  const today = new Date();
  f.checkIn.min = iso(today);
  f.checkIn.value = iso(new Date(today.getTime() + 864e5));
  f.checkOut.value = iso(new Date(today.getTime() + 2 * 864e5));
  $('#bInTime').textContent = fmtTime(C.CHECKIN_TIME || '13:00');
  $('#bOutTime').textContent = fmtTime(C.CHECKOUT_TIME || '11:00');
  const nights = () => Math.max(0, Math.round((parse(f.checkOut.value) - parse(f.checkIn.value)) / 864e5));

  function onDates() {
    if (f.checkOut.value <= f.checkIn.value) f.checkOut.value = iso(new Date(parse(f.checkIn.value).getTime() + 864e5));
    f.checkOut.min = iso(new Date(parse(f.checkIn.value).getTime() + 864e5));
    const n = nights();
    $('#bNights').textContent = n + (n === 1 ? ' night' : ' nights');
    checkAvailability();
  }
  f.checkIn.addEventListener('change', onDates);
  f.checkOut.addEventListener('change', onDates);

  /* steppers */
  $$('.stepper').forEach(st => {
    const name = st.dataset.name, min = +st.dataset.min, max = +st.dataset.max;
    const out = $('output', st), hidden = f[name];
    const [minus, plus] = $$('button', st);
    const sync = (v) => { hidden.value = v; out.textContent = v; minus.disabled = v <= min; plus.disabled = v >= max; renderRooms(); };
    st.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      sync(Math.min(max, Math.max(min, +hidden.value + +b.dataset.d)));
    });
    minus.disabled = +hidden.value <= min;
  });

  /* rooms */
  async function loadRooms() {
    try {
      rooms = (await api('rooms')).rooms;
      if (!rooms.length) {
        $('#roomSec').classList.add('hidden');
        estimate();
        return;
      }
      checkAvailability();
    } catch (e) {
      $('#roomHint').textContent = 'Could not load rooms. You can still send a request.';
    }
  }

  let availSeq = 0;
  async function checkAvailability() {
    if (!rooms.length) return estimate();
    const seq = ++availSeq;
    $('#roomHint').textContent = 'Checking availability…';
    try {
      const res = await api('availability', { from: f.checkIn.value, to: f.checkOut.value });
      if (seq !== availSeq) return;
      available = new Set(res.available);
      [...picked].forEach(id => { if (!available.has(id)) picked.delete(id); });
      const free = rooms.filter(r => available.has(r.id)).length;
      $('#roomHint').textContent = free ? free + ' of ' + rooms.length + ' available for your dates. Pick one or more, or leave it to us.' : 'All rooms look booked for these dates. Send a request anyway and we\'ll try to help.';
    } catch (e) {
      if (seq !== availSeq) return;
      available = null;
      $('#roomHint').textContent = e.message;
    }
    renderRooms();
  }

  function renderRooms() {
    if (!rooms.length) return estimate();
    const guests = +f.adults.value + +f.children.value;
    $('#roomList').innerHTML = rooms.map(r => {
      const free = !available || available.has(r.id);
      const on = picked.has(r.id);
      const ph = r.photos || [];
      return '<div class="room-box' + (ph.length ? ' has-ph' : '') + (on ? ' on' : '') + (free ? '' : ' off') + '">' + (ph.length ?
        '<div class="ro-gal"><div class="ro-track">' + ph.map((p, i) => '<button type="button" class="ro-ph" data-room="' + esc(r.id) + '" data-i="' + i + '" aria-label="View photo ' + (i + 1) + ' of ' + esc(r.name) + '">' + photoImg(p, r.name, i === 0 ? 'eager' : 'lazy', 900) + '</button>').join('') + '</div>' +
        (ph.length > 1 ? '<span class="ro-count">📷 ' + ph.length + '</span>' : '') + '</div>' : '') +
        '<button type="button" class="room-opt' + (on ? ' on' : '') + (free ? '' : ' off') + '" data-id="' + esc(r.id) + '"' + (free ? '' : ' disabled') + '>' +
        '<span class="ro-top"><strong>' + esc(r.name) + '</strong>' + (r.rate ? '<b>' + inr(r.rate) + '<small>/night</small></b>' : '') + '</span>' +
        '<small>' + esc([r.type, r.capacity ? 'Sleeps ' + r.capacity : ''].filter(Boolean).join(' · ')) + '</small>' +
        (r.description ? '<small class="ro-desc">' + esc(r.description) + '</small>' : '') +
        '<span class="ro-tag">' + (free ? (on ? '✓ Selected' : 'Available') : 'Booked') + '</span></button></div>';
    }).join('');
    hydrate($('#roomList'));
    const cap = [...picked].reduce((s, id) => s + ((rooms.find(r => r.id === id) || {}).capacity || 0), 0);
    if (picked.size && cap && guests > cap) $('#roomHint').textContent = 'Selected rooms sleep ' + cap + '. You have ' + guests + ' guests — add a room or we\'ll suggest options.';
    estimate();
  }
  $('#roomList').addEventListener('click', e => {
    const ph = e.target.closest('.ro-ph');
    if (ph) return openLightbox(ph.dataset.room, +ph.dataset.i);
    const b = e.target.closest('.room-opt'); if (!b || b.disabled) return;
    picked.has(b.dataset.id) ? picked.delete(b.dataset.id) : picked.add(b.dataset.id);
    renderRooms();
  });

  function estimate() {
    const n = nights();
    $('#estDates').textContent = fmtDate(f.checkIn.value) + ' → ' + fmtDate(f.checkOut.value) + ' · ' + n + (n === 1 ? ' night' : ' nights');
    const rate = [...picked].reduce((s, id) => s + ((rooms.find(r => r.id === id) || {}).rate || 0), 0);
    $('#estTotal').textContent = rate ? inr(rate * n) : 'Confirmed on call';
  }

  /* submit */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    for (const el of [f.checkIn, f.checkOut, f.guestName, f.mobile, f.email]) {
      if (!el.checkValidity() || (el.required && !el.value.trim())) {
        el.focus(); el.closest('.field, .stay-col').classList.add('invalid');
        el.addEventListener('input', () => el.closest('.field, .stay-col').classList.remove('invalid'), { once: true });
        return toast(el === f.mobile ? 'Please enter a valid mobile number.' : 'Please complete the highlighted field.');
      }
    }
    const btn = $('#bSubmit');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const res = await api('request', { data: {
        guestName: f.guestName.value, mobile: f.mobile.value, email: f.email.value,
        adults: f.adults.value, children: f.children.value, checkIn: f.checkIn.value, checkOut: f.checkOut.value,
        rooms: [...picked], requests: f.requests.value, website: f.website.value
      } });
      form.classList.add('hidden');
      $('#dName').textContent = f.guestName.value.trim().split(/\s+/)[0];
      $('#dIn').textContent = fmtDate(f.checkIn.value);
      $('#dOut').textContent = fmtDate(f.checkOut.value);
      $('#dRef').textContent = res.id;
      $('#bDone').classList.remove('hidden');
      window.scrollTo({ top: $('#bDone').offsetTop - 20, behavior: 'smooth' });
    } catch (err) {
      toast(err.message === 'Failed to fetch' ? 'Network issue. Please try again.' : err.message);
      btn.disabled = false; btn.textContent = 'Request booking';
    }
  });

  onDates();
  loadRooms();
})();
