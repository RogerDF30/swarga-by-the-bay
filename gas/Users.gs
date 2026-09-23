/**
 * Swarga by the Bay — user accounts, roles, sessions and audit log.
 * Roles: 'Super admin' (users, integrations, notifications, settings) and 'Admin' (daily operations).
 * The first login with the legacy single admin (ADMIN_USER / ADMIN_HASH) creates the first Super admin.
 */

const USERS = 'Users';
const AUDIT = 'AuditLog';
const USER_HEADERS = ['Username', 'Name', 'Email', 'Role', 'Status', 'Salt', 'Hash', 'Created At', 'Last Login', 'Updated By'];
const AUDIT_HEADERS = ['At', 'User', 'Role', 'Action', 'Record', 'Summary'];
const ROLES = ['Super admin', 'Admin'];

/* ---------- sessions ---------- */

function login_(user, pass) {
  user = String(user || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + user;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_LOGIN_FAILS) throw new Error('Too many attempts. Try again in 15 minutes.');

  let u = readAll_(USERS, USER_HEADERS).filter(x => x.Username.toLowerCase() === user)[0];

  // One-time migration from the original single admin login.
  if (!u && !readAll_(USERS, USER_HEADERS).length) {
    const props = PropertiesService.getScriptProperties();
    const legacyUser = String(props.getProperty('ADMIN_USER') || '').toLowerCase();
    if (legacyUser && user === legacyUser && sha256_(props.getProperty('ADMIN_SALT') + String(pass || '')) === props.getProperty('ADMIN_HASH')) {
      appendObj_(USERS, USER_HEADERS, {
        'Username': legacyUser, 'Name': 'Roger', 'Email': '', 'Role': 'Super admin', 'Status': 'Active',
        'Salt': props.getProperty('ADMIN_SALT'), 'Hash': props.getProperty('ADMIN_HASH'), 'Created At': stamp_(), 'Updated By': 'migration'
      });
      u = readAll_(USERS, USER_HEADERS).filter(x => x.Username.toLowerCase() === user)[0];
    }
  }

  const ok = u && u.Status === 'Active' && sha256_(u.Salt + String(pass || '')) === u.Hash;
  if (!ok) {
    cache.put(failKey, String(fails + 1), 900);
    Utilities.sleep(800);
    throw new Error('Invalid username or password.');
  }
  cache.remove(failKey);
  writeFields_(USERS, USER_HEADERS, u._row, { 'Last Login': stamp_() });
  const token = Utilities.getUuid() + Utilities.getUuid();
  const sess = { u: u.Username, name: u.Name || u.Username, role: u.Role };
  cache.put('tok_' + token, JSON.stringify(sess), TOKEN_TTL_SEC);
  audit_(sess, 'login', u.Username, '');
  return { ok: true, token: token, expiresIn: TOKEN_TTL_SEC, user: publicUser_(u) };
}

/** Returns the session for a valid token, or throws AUTH. Disabled users are signed out on their next action. */
function requireAdmin_(token) {
  const raw = token && CacheService.getScriptCache().get('tok_' + token);
  if (!raw) throw new Error('AUTH');
  let sess;
  try { sess = JSON.parse(raw); } catch (e) { sess = null; }
  if (!sess || !sess.u) throw new Error('AUTH'); // tokens from before roles existed
  const u = readAll_(USERS, USER_HEADERS).filter(x => x.Username === sess.u)[0];
  if (!u || u.Status !== 'Active') { CacheService.getScriptCache().remove('tok_' + token); throw new Error('AUTH'); }
  sess.role = u.Role; sess.name = u.Name || u.Username;
  return sess;
}

function requireSuper_(token) {
  const s = requireAdmin_(token);
  if (s.role !== 'Super admin') throw new Error('Only a Super admin can do this.');
  return s;
}

function publicUser_(u) {
  return { username: u.Username, name: u.Name, email: u.Email, role: u.Role, status: u.Status, lastLogin: u['Last Login'], createdAt: u['Created At'] };
}

/* ---------- user management (Super admin) ---------- */

function listUsers_() {
  return { ok: true, users: readAll_(USERS, USER_HEADERS).map(publicUser_), roles: ROLES };
}

function validPassword_(p) {
  if (String(p || '').length < 10) throw new Error('Password must be at least 10 characters.');
}

function saveUser_(d, sess) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const all = readAll_(USERS, USER_HEADERS);
    const role = ROLES.indexOf(d.role) > -1 ? d.role : 'Admin';
    const status = d.status === 'Disabled' ? 'Disabled' : 'Active';
    const name = clean_(d.name).slice(0, 60);
    const email = String(d.email || '').trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Invalid email.');
    if (!name) throw new Error('Name is required.');

    if (d.isNew) {
      const username = String(d.username || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Username: 3–30 letters, numbers, dot, dash or underscore.');
      if (all.some(x => x.Username.toLowerCase() === username)) throw new Error('That username is taken.');
      validPassword_(d.password);
      const salt = Utilities.getUuid();
      appendObj_(USERS, USER_HEADERS, {
        'Username': username, 'Name': name, 'Email': email, 'Role': role, 'Status': status,
        'Salt': salt, 'Hash': sha256_(salt + d.password), 'Created At': stamp_(), 'Updated By': sess.name
      });
      audit_(sess, 'user.create', username, role);
      return { ok: true };
    }

    const u = all.filter(x => x.Username === d.username)[0];
    if (!u) throw new Error('User not found.');
    const activeSupers = all.filter(x => x.Role === 'Super admin' && x.Status === 'Active');
    if (u.Role === 'Super admin' && u.Status === 'Active' && (role !== 'Super admin' || status !== 'Active') && activeSupers.length <= 1) {
      throw new Error('At least one active Super admin must remain.');
    }
    const fields = { 'Name': name, 'Email': email, 'Role': role, 'Status': status, 'Updated By': sess.name };
    if (d.password) {
      validPassword_(d.password);
      const salt = Utilities.getUuid();
      fields.Salt = salt; fields.Hash = sha256_(salt + d.password);
    }
    writeFields_(USERS, USER_HEADERS, u._row, fields);
    audit_(sess, 'user.update', u.Username, [role, status, d.password ? 'password reset' : ''].filter(Boolean).join(', '));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function changePassword_(sess, oldPass, newPass) {
  const u = readAll_(USERS, USER_HEADERS).filter(x => x.Username === sess.u)[0];
  if (!u || sha256_(u.Salt + String(oldPass || '')) !== u.Hash) throw new Error('Current password is wrong.');
  validPassword_(newPass);
  const salt = Utilities.getUuid();
  writeFields_(USERS, USER_HEADERS, u._row, { 'Salt': salt, 'Hash': sha256_(salt + newPass), 'Updated By': sess.name });
  audit_(sess, 'user.password', u.Username, 'changed own password');
  return { ok: true };
}

/* ---------- audit ---------- */

function audit_(sess, action, record, summary) {
  try {
    appendObj_(AUDIT, AUDIT_HEADERS, {
      'At': stamp_(), 'User': sess ? sess.name : 'system', 'Role': sess ? sess.role : '',
      'Action': action, 'Record': record || '', 'Summary': String(summary || '').slice(0, 300)
    });
  } catch (e) { /* never block the action on logging */ }
}

function auditList_(sess) {
  let rows = readAll_(AUDIT, AUDIT_HEADERS).map(strip_).reverse();
  if (sess.role !== 'Super admin') rows = rows.filter(r => r.User === sess.name);
  return { ok: true, rows: rows.slice(0, 500) };
}
