(function () {
  const API = window.SWARGA_CONFIG.API_URL;
  const $ = (id) => document.getElementById(id);
  let token = null;
  let headers = [];
  let rows = [];
  let current = null;

  try { token = sessionStorage.getItem('sbb_token'); } catch (e) {}

  async function call(action, extra) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, token }, extra || {}))
    }).then(r => r.json());
    if (!res.ok && res.error === 'AUTH') { logout(true); throw new Error('Session expired. Please log in again.'); }
    if (!res.ok) throw new Error(res.error || 'Request failed.');
    return res;
  }

  function msg(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); }
  const col = (r, name) => r[headers.indexOf(name)] || '';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setView(loggedIn) {
    $('loginView').classList.toggle('hidden', loggedIn);
    $('listView').classList.toggle('hidden', !loggedIn);
  }

  function logout(silent) {
    if (!silent && token) call('logout').catch(() => {});
    token = null;
    try { sessionStorage.removeItem('sbb_token'); } catch (e) {}
    rows = [];
    $('rows').innerHTML = '';
    setView(false);
  }

  /* ---- login ---- */
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    $('loginBtn').disabled = true;
    try {
      const res = await call('login', { username: f.username.value, password: f.password.value });
      token = res.token;
      try { sessionStorage.setItem('sbb_token', token); } catch (e2) {}
      f.reset();
      $('loginMsg').className = 'msg';
      setView(true);
      await load();
    } catch (err) {
      msg($('loginMsg'), err.message);
    } finally {
      $('loginBtn').disabled = false;
    }
  });

  /* ---- list ---- */
  async function load() {
    $('count').textContent = 'Loading…';
    const res = await call('list');
    headers = res.headers;
    rows = res.rows;
    render();
  }

  function filtered() {
    const q = $('search').value.trim().toLowerCase();
    const st = $('statusFilter').value;
    return rows.filter(r => (!st || col(r, 'Status') === st) && (!q || r.join(' ').toLowerCase().includes(q)));
  }

  function render() {
    const list = filtered();
    $('count').textContent = list.length + ' of ' + rows.length + ' check-ins';
    $('rows').innerHTML = list.map(r => {
      const guests = (Number(col(r, 'Adults')) || 0) + ' A / ' + (Number(col(r, 'Children')) || 0) + ' C';
      const st = col(r, 'Status');
      return '<tr class="row" data-id="' + esc(col(r, 'Submission ID')) + '">' +
        '<td>' + esc(col(r, 'Submission ID')) + '</td>' +
        '<td>' + esc(col(r, 'Submitted At')) + '</td>' +
        '<td>' + esc(col(r, 'Guest Name')) + '</td>' +
        '<td>' + esc(col(r, 'Mobile')) + '</td>' +
        '<td>' + guests + '</td>' +
        '<td>' + esc(col(r, 'Check-in Date') + ' ' + col(r, 'Check-in Time')) + '</td>' +
        '<td>' + esc(col(r, 'Check-out Date') + ' ' + col(r, 'Check-out Time')) + '</td>' +
        '<td><span class="badge ' + esc(st) + '">' + esc(st) + '</span></td></tr>';
    }).join('');
  }

  $('search').addEventListener('input', render);
  $('statusFilter').addEventListener('change', render);
  $('refreshBtn').addEventListener('click', () => load().catch(err => alertBox(err)));
  $('logoutBtn').addEventListener('click', () => logout(false));
  function alertBox(err) { $('count').textContent = err.message; }

  /* ---- detail ---- */
  $('rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr.row');
    if (!tr) return;
    current = rows.find(r => col(r, 'Submission ID') === tr.dataset.id);
    const skip = ['ID Photo File ID', 'User Agent'];
    $('dlgTitle').textContent = col(current, 'Guest Name') + ' · ' + col(current, 'Submission ID');
    $('dlgFields').innerHTML = headers.map((h, i) => skip.includes(h) ? '' :
      '<dt>' + esc(h) + '</dt><dd>' + esc(current[i] || '—') + '</dd>').join('');
    $('idProof').innerHTML = col(current, 'ID Photo File ID')
      ? '<button type="button" class="ghost" id="loadPhoto">View ID proof</button>'
      : '<p style="color:var(--muted)">No file uploaded.</p>';
    const verified = col(current, 'Status') === 'Verified';
    $('verifyBlock').innerHTML = verified
      ? '<p>Verified by <strong>' + esc(col(current, 'Rep Name')) + '</strong> on ' + esc(col(current, 'Rep Verified At')) + '</p>'
      : '<label>Representative Name</label><input id="repName" maxlength="120"><div id="verifyMsg" class="msg" role="alert"></div><p><button type="button" id="verifyBtn">Mark as Verified</button></p>';
    $('detail').showModal();
  });

  $('closeDlg').addEventListener('click', () => $('detail').close());

  $('detail').addEventListener('click', async (e) => {
    if (e.target.id === 'loadPhoto') {
      e.target.disabled = true;
      e.target.textContent = 'Loading…';
      try {
        const res = await call('photo', { id: col(current, 'Submission ID') });
        const p = res.photo;
        if (!p) { $('idProof').textContent = 'No file uploaded.'; return; }
        const src = 'data:' + p.mime + ';base64,' + p.data;
        $('idProof').innerHTML = p.mime === 'application/pdf'
          ? '<a download="' + esc(col(current, 'Submission ID')) + '.pdf" href="' + src + '">Download ID proof (PDF)</a>'
          : '<img class="idimg" alt="ID proof" src="' + src + '">';
      } catch (err) {
        $('idProof').textContent = err.message;
      }
    }
    if (e.target.id === 'verifyBtn') {
      const name = $('repName').value.trim();
      if (!name) return msg($('verifyMsg'), 'Enter the representative name.');
      e.target.disabled = true;
      try {
        await call('verify', { id: col(current, 'Submission ID'), repName: name });
        $('detail').close();
        await load();
      } catch (err) {
        msg($('verifyMsg'), err.message);
        e.target.disabled = false;
      }
    }
  });

  /* ---- CSV ---- */
  $('csvBtn').addEventListener('click', () => {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = [headers].concat(filtered()).map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'swarga-checkins-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---- init ---- */
  if (token) { setView(true); load().catch(err => alertBox(err)); } else { setView(false); }
})();
