(function () {
  const C = window.SWARGA_CONFIG;
  const form = document.getElementById('checkin');
  const msg = document.getElementById('msg');
  const btn = document.getElementById('submitBtn');
  const MAX_BYTES = 5 * 1024 * 1024;

  // Emergency contacts from config
  [['cfgEmergency', C.PROPERTY_EMERGENCY], ['cfgCaretaker', C.CARETAKER], ['cfgHospital', C.NEAREST_HOSPITAL]]
    .forEach(([id, v]) => { if (v) document.getElementById(id).textContent = v; });

  // Group booking toggle
  const group = document.getElementById('groupBooking');
  const groupBlock = document.getElementById('groupBlock');
  group.addEventListener('change', () => {
    groupBlock.classList.toggle('hidden', !group.checked);
    form.leadGuestName.required = group.checked;
  });

  // Check-out cannot precede check-in
  form.checkInDate.addEventListener('change', () => { form.checkOutDate.min = form.checkInDate.value; });

  function show(text, ok) {
    msg.textContent = text;
    msg.className = 'msg ' + (ok ? 'ok' : 'err');
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Resize photos to max 1600px JPEG; pass PDFs through.
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (file.type === 'application/pdf') {
        if (file.size > MAX_BYTES) return reject(new Error('PDF is larger than 5 MB.'));
        const r = new FileReader();
        r.onload = () => resolve({ mime: file.type, data: r.result.split(',')[1] });
        r.onerror = () => reject(new Error('Could not read file.'));
        return r.readAsDataURL(file);
      }
      if (!/^image\/(jpeg|png)$/.test(file.type)) return reject(new Error('ID proof must be JPG, PNG or PDF.'));
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'msg';
    if (!form.checkValidity()) {
      form.reportValidity();
      return show('Please complete all required fields and acknowledgements.');
    }
    if (form.checkOutDate.value < form.checkInDate.value) return show('Check-out date is before check-in date.');

    btn.disabled = true;
    btn.textContent = 'Submitting…';
    try {
      const f = form.elements;
      const data = {
        guestName: f.guestName.value, mobile: f.mobile.value, email: f.email.value,
        adults: f.adults.value, children: f.children.value, vehicles: f.vehicles.value,
        checkInDate: f.checkInDate.value, checkInTime: f.checkInTime.value,
        checkOutDate: f.checkOutDate.value, checkOutTime: f.checkOutTime.value,
        idType: f.idType.value, idNumber: f.idNumber.value,
        idPhoto: await readFile(f.idPhoto.files[0]),
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
      form.classList.add('hidden');
      document.getElementById('refId').textContent = res.id;
      document.getElementById('done').classList.remove('hidden');
      window.scrollTo(0, 0);
    } catch (err) {
      show(err.message || 'Network error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Check-In';
    }
  });
})();
