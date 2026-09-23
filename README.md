# Swarga by the Bay — Guest Check-In

Static site (GitHub → Cloudways) + Google Apps Script API + Google Sheet.

```
Guest (QR / link) → index.html ──POST──┐
                                       ├─► Apps Script web app ─► Sheet "CheckIns"
Admin → admin.html (login) ──POST──────┘                        └► Drive folder (ID proofs, private)
```

## Structure
```
site/                 → deploy to Cloudways public_html
  index.html          guest form (full house rules, sea safety, declaration)
  admin.html          admin login, list, search, detail, ID view, verify, CSV export
  assets/config.js    API_URL + property emergency contacts (edit before deploy)
  assets/*.js|css
  .htaccess           HTTPS, security headers, noindex on admin
gas/
  Code.gs             API: submit, login, logout, list, photo, verify
  appsscript.json
```

## 1. Google Sheet + Apps Script
1. Create a Google Sheet (owner: the property's Google account). Extensions → Apps Script.
2. Paste `Code.gs`; replace `appsscript.json` (Project Settings → show manifest).
3. Run `setup()` → creates tab `CheckIns` and Drive folder "Swarga by the Bay — Guest ID Proofs". Authorise.
4. In `setAdmin()` set USER and PASS (10+ chars), run it, then change both back to `CHANGE_ME` and save. Only a salted SHA-256 hash is stored in Script Properties.
5. Deploy → New deployment → Web app → Execute as **Me**, Access **Anyone**. Copy the `/exec` URL.
6. To change the admin password later: repeat step 4. Existing sessions expire within 6 h.

## 2. Site
1. Put `/exec` URL into `site/assets/config.js` → `API_URL`. Fill PROPERTY_EMERGENCY, CARETAKER, NEAREST_HOSPITAL.
2. Push repo to GitHub.
3. Cloudways → Application → Deployment via Git → add the repo SSH key to GitHub deploy keys → branch `main`, deployment path `public_html` (point it at the `site/` contents, or keep `site/` as repo root for this deploy).
4. Enable SSL (Let's Encrypt) on the domain. `.htaccess` forces HTTPS.
5. Generate a QR code for `https://<domain>/` and place it at reception.

## Admin
- URL: `https://<domain>/admin.html`
- Session token in sessionStorage; closes with the tab; server side expires after 6 h.
- 5 failed logins lock login for 15 min.
- "Mark as Verified" fills the Property Representative section (name, timestamp, status).

## Data protection (DPDP Act 2023)
- Guest gives explicit consent checkbox before submit.
- ID files stay private in the owner's Drive; admin views them through the API only.
- Restrict Sheet sharing to the property owner. Agree a retention period with the client and delete old rows/files accordingly.

## Test checklist
- [ ] Submit with no fields → blocked, message shown
- [ ] Submit full form with JPG, PNG and PDF → row + Drive file created
- [ ] Wrong password → error; 6th attempt → lockout message
- [ ] Admin list, search, status filter, CSV export
- [ ] View ID proof, Mark as Verified → Sheet columns updated
- [ ] Mobile (375 px) layout
