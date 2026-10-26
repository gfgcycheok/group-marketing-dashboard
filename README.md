# Group Marketing Performance Dashboard

A single dashboard for every Wonderspace Group brand (LaBéBé, Event Spaces, MICE Team, Kingston Hotels, Swing & Pillow, Lilla Resort). It shows ad spend, leads, appointments, bookings, revenue and ROAS, filtered by date, brand and branch. All numbers are pulled live from Google Sheets.

## How it fits together

```
Google Sheets (daily branch tabs)
        │  read by
        ▼
Apps Script web app  (apps-script/Code.gs)   ← holds the ACCESS_KEY
        │  JSON, only when the key matches
        ▼
GitHub Pages  (index.html)                    ← no data or secrets in this repo
```

## 1. Set up the Apps Script (once)

1. Open the **Labebe Ads Data** sheet → **Extensions → Apps Script**.
2. Replace the code in `Code.gs` with `apps-script/Code.gs` from this repo.
3. Click **+ → HTML**, name the file `Dashboard`, and paste in `apps-script/Dashboard.html`.
4. In `Code.gs`, change `ACCESS_KEY` to a long secret phrase of your own.
5. Fill in `BRANDS` with each brand's spreadsheet ID and daily tab names.
6. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Approve the permissions, then copy the **Web app URL** (it ends in `/exec`).

> After any edit to `Code.gs`, go to **Deploy → Manage deployments → Edit → Version: New version** or the web app keeps running the old code.

## 2. Turn on GitHub Pages

1. In this repo, open **Settings → Pages**.
2. Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)**. Save.
3. After about a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

## 3. Connect the dashboard

Open the Pages link, click **Connect data**, then paste the Web app URL and your `ACCESS_KEY`. These are saved only in that browser. Each person on your team enters them once on their own device.

## Security notes

- The repo contains no data, sheet IDs or keys, so it is safe as a public repo.
- Anyone who wants to see numbers needs both the Web app URL and the `ACCESS_KEY`.
- To revoke access, change `ACCESS_KEY` in `Code.gs` and deploy a new version.

## Files

| File | Purpose |
|---|---|
| `index.html` | The dashboard served by GitHub Pages |
| `vendor/chart.umd.min.js` | Chart.js 4.4.1, bundled so no CDN is needed |
| `apps-script/Code.gs` | Reads the sheets and serves JSON (paste into Apps Script) |
| `apps-script/Dashboard.html` | The same dashboard for use inside Google Sheets |
