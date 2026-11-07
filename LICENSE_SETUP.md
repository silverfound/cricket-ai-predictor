# Device-bound licensing setup

This feature is designed for the AppsGeyser WebView wrapper. Each installation gets an app-local installation ID, and a unique customer code is bound to the first installation that redeems it. The server enforces the license on both protected cricket data APIs: `/matches` and `/predict`.

## Required Render environment variables

- `DATABASE_URL`: persistent PostgreSQL connection string. Use a Render PostgreSQL database; do not rely on the web service's temporary filesystem.
- `ADMIN_API_KEY`: long random secret (at least 32 random characters). Never put this key in website JavaScript or the APK.

## Deployment sequence

1. Create/attach a persistent PostgreSQL database and set `DATABASE_URL` on the Render web service.
2. Set `ADMIN_API_KEY` in Render environment settings.
3. Review and merge this PR, then deploy the backend and website.
4. Open `https://YOUR-RENDER-SERVICE.onrender.com/admin`, enter the admin key, create a unique code per customer, choose the number of days, and send the code privately.
5. Customer opens the AppsGeyser app and enters their code. The selected duration starts at first successful activation.

## Admin controls

- Create one or multiple unique codes; label each customer and choose 1–3650 days.
- Extend a license by additional days. If it is still active, the days are added to its current expiry.
- Block or unblock a license.
- Reset device binding only when intentionally transferring a customer to a replacement phone. Resetting unbinds the code and clears the previous expiry; the selected duration starts again on the next activation.

## Important limitations

- The AppsGeyser WebView implementation uses a per-installation ID stored in browser local storage, not cryptographically attested hardware identity. Clearing app storage or reinstalling may create a new ID; the same code remains bound on the server, so an admin device reset may be needed for a legitimate phone replacement.
- This is practical access control, not tamper-proof DRM. A technically skilled user may tamper with a WebView or copy local storage. Backend data endpoints still reject requests without a valid bound active installation.
- Internet access is required to activate and fetch protected data. Previously copied/exported data cannot be remotely erased.
- Plaintext activation codes are returned only once when generated; only SHA-256 hashes are stored in PostgreSQL.
- Admin endpoints require the `X-Admin-Key` header and must be used over HTTPS.
