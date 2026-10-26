/**
 * Group Marketing Performance Dashboard
 * Reads the DAILY branch tabs (Date | Ads Spend | Revenue | FB Lead | Sales Lead | Organic Lead | Appointment | No Booking ...)
 * from every brand's Google Sheet and serves the dashboard. Monthly / weekly numbers are rebuilt from the
 * daily rows, so any date range works and always matches your sheet.
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────
 * 1. Fill in BRANDS below: one entry per brand, its spreadsheet ID, and its daily tabs.
 *    spreadsheetId: ''  means "the spreadsheet this script is attached to".
 *    tabs: { 'Exact tab name' : 'Name to show on the dashboard' }
 * 2. Columns are found by their header text (see HEADERS), so column order can differ between brands.
 */

const BRANDS = [
  {
    name: 'LaBéBé',
    spreadsheetId: '', // this file (Labebe Ads Data)
    tabs: {
      'Puchong':     'Puchong',
      'SKembangan':  'Seri Kembangan',
      'Kuchai':      'Kuchai Lama - Confinement',
      'Selayang':    'Ninso Selayang',
      'Klang':       'Klang',
      'Amansari':    'JB',               // check: is Amansari your JB tab?
      'Google':      'Google',
      'InfantCare':  'Infant Care',
      'C.Meal':      'Confinement Meal',
      'Retargeting': 'Retargeting',
    },
  },
  // Paste each brand's spreadsheet ID (the long code in its URL between /d/ and /edit) and its tab names:
  {
    name: 'Event Spaces',
    spreadsheetId: '1ykPjj4asKP_0z98sFH-a9fC_ayIaOs_uW-Brokm4X7E', // Event Space Ads Data
    tabs: {
      'Glasshouse': 'Glasshouse',
      'Artelier':   'Artelier Hall',
      'Lena':       'Lena Hall',
      'Dynasty':    'Dynasty Hall',
      'Gocos':      'Gocos',
      'DeGarden':   'De Garden',
      'Penang':     'Penang',
      'Ipoh':       'Ipoh',
      'Melaka':     'Melaka',
      'BP':         'Batu Pahat',
      'Google':     'Event Spaces - Google',
    },
  },
  {
    name: 'MICE Team',
    spreadsheetId: '1Cf-oUUgCjX2Dp99AAJz0jsBOoa9UEVaxGRMP0brznUA', // MICE Team Ads Data
    tabs: {
      'K10-WS':            'K10 - WS',
      'K10-LF':            'K10 - LF',
      'K11 - PWTC':        'K11 - PWTC',
      'K12 - Romania':     'K12 - Romania',
      'K15 - Ipoh':        'K15 - Tower Regency (Ipoh)',
      'K17 - Melaka':      'K17 - Melaka',
      'KL - ALL':          'KL - All',
      'K19 - Penang':      'K19 - Royal Penang',
      'K25 - Batu Pahat':  'K25 - Batu Pahat',
    },
  },
  { name: 'Kingston Hotels', spreadsheetId: '', tabs: {} },
  { name: 'Swing & Pillow',  spreadsheetId: '', tabs: {} },
  { name: 'Lilla Resort',    spreadsheetId: '', tabs: {} },
];

// Header text the script accepts for each field. Matching ignores capitals and spaces,
// so 'FBLead' matches 'fb lead' and 'NoBooking' matches 'no booking'.
// Add your other brands' wording here, e.g. 'enquiry' for leads or 'event confirmed' for bookings.
const HEADERS = {
  date:        ['date', 'day', '日期'],
  spend:       ['ads spend', 'ad spend', 'spend', 'spending', 'amount spent', '广告费'],
  revenue:     ['revenue', 'sales', 'sales amount', '销售额'],
  fbLead:      ['fb lead', 'meta lead', 'lead (marketing)', 'marketing lead', 'leads'],
  salesLead:   ['sales lead', 'sales team lead', 'lead (sales)', 'whatsapp lead', 'enquiry'],
  organicLead: ['organic lead', 'organic'],
  appt:        ['appointment', 'no appointment', 'no appt', 'appointments', 'site visit', 'viewing'],
  booking:     ['no booking', 'booking', 'bookings', 'closed'],
};

// The sheets take ~2 minutes to read, so a background job (installAutoRefresh) re-reads them
// every 15 minutes and the dashboard always gets the saved copy instantly.
const CACHE_MINUTES = 360; // Apps Script's maximum (6 hours)
const REFRESH_EVERY_MINUTES = 15;

// Access key for the GitHub Pages dashboard. Set it in Project Settings → Script Properties
// (property name: ACCESS_KEY), then enter the same key on the dashboard's "Connect data" screen.
// Anyone without this key gets nothing back from the data link.
const ACCESS_KEY = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY') || 'change-me-to-a-long-secret';

/* ─── Entry points ─────────────────────────────────────────────────────── */

// Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
//   …/exec                       → the dashboard itself
//   …/exec?format=json&key=XXXX  → raw data for the GitHub Pages dashboard
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.format === 'json') {
    let body;
    if (!ACCESS_KEY || ACCESS_KEY === 'change-me-to-a-long-secret') body = { error: 'Set ACCESS_KEY in Code.gs first.' };
    else if (p.key !== ACCESS_KEY) body = { error: 'Wrong access key.' };
    else body = getDashboardData(p.refresh === '1');
    return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Group Marketing Performance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Adds a "Dashboard" menu inside the sheet
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Dashboard')
    .addItem('Open dashboard', 'openDashboard')
    .addItem('Clear data cache', 'clearCache')
    .addToUi();
}

function openDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('Dashboard').setWidth(1500).setHeight(920);
  SpreadsheetApp.getUi().showModalDialog(html, 'Group Marketing Performance');
}

// Run this ONCE from the editor (select it in the function list, click Run) to start the
// 15-minute background refresh. Running it again replaces the old schedule.
function installAutoRefresh() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshDashboardCache')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshDashboardCache').timeBased().everyMinutes(REFRESH_EVERY_MINUTES).create();
  refreshDashboardCache();
}

// Called by the background trigger: reads every sheet and saves the result for the dashboard.
function refreshDashboardCache() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // a refresh is already running
  try { getDashboardData(true); } finally { lock.releaseLock(); }
}

function clearCache() {
  const c = CacheService.getScriptCache();
  const n = Number(c.get('dash_n') || 0);
  const keys = ['dash_n']; for (let i = 0; i < n; i++) keys.push('dash_' + i);
  c.removeAll(keys);
}

/* ─── Data ─────────────────────────────────────────────────────────────── */

function getDashboardData(force) {
  if (!force) { const hit = readCache_(); if (hit) return hit; }
  else clearCache();

  const tz = Session.getScriptTimeZone();
  const out = {
    brands: BRANDS.map(b => b.name),
    rows: [], errors: [], live: true,
    today: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
    pulled: Utilities.formatDate(new Date(), tz, 'd MMM, h:mm a'),
  };

  BRANDS.forEach(brand => {
    const tabNames = Object.keys(brand.tabs || {});
    if (!tabNames.length) return;

    let ss;
    try {
      ss = brand.spreadsheetId ? SpreadsheetApp.openById(brand.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) throw new Error('paste this file\'s spreadsheet ID into BRANDS');
    } catch (e) { out.errors.push(brand.name + ': cannot open spreadsheet (' + e.message + ')'); return; }

    tabNames.forEach(tab => {
      const sh = ss.getSheetByName(tab);
      if (!sh) { out.errors.push(brand.name + ': tab "' + tab + '" not found'); return; }
      const values = sh.getDataRange().getValues();
      const hr = findHeaderRow_(values);
      if (hr < 0) { out.errors.push(brand.name + ' / ' + tab + ': no "Date" header in the first 10 rows'); return; }
      const col = mapColumns_(values[hr]);
      const product = brand.tabs[tab];

      for (let r = hr + 1; r < values.length; r++) {
        const row = values[r];
        const d = toISO_(row[col.date], tz);
        if (!d) continue;
        const rec = [brand.name, product, d,
          num_(row, col.spend), num_(row, col.revenue), num_(row, col.fbLead), num_(row, col.salesLead),
          num_(row, col.organicLead), num_(row, col.appt), num_(row, col.booking)];
        if (rec.slice(3).some(v => v)) out.rows.push(rec);
      }
    });
  });

  writeCache_(out);
  return out;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function norm_(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }

function findHeaderRow_(values) {
  for (let r = 0; r < Math.min(10, values.length); r++) {
    if (values[r].some(c => HEADERS.date.map(norm_).indexOf(norm_(c)) > -1)) return r;
  }
  return -1;
}

function mapColumns_(header) {
  const col = {};
  const h = header.map(norm_);
  Object.keys(HEADERS).forEach(field => {
    for (const alias of HEADERS[field]) {
      const i = h.indexOf(norm_(alias));
      if (i > -1 && Object.values(col).indexOf(i) === -1) { col[field] = i; break; }
    }
  });
  return col;
}

function num_(row, i) {
  if (i == null) return 0;
  const v = row[i];
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

function toISO_(v, tz) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const m = String(v || '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); // dd/mm/yyyy
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  const m2 = String(v || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m2 ? m2[0] : null;
}

// Cache in 90 KB chunks (Apps Script limit is 100 KB per key)
function writeCache_(obj) {
  try {
    const s = JSON.stringify(obj), size = 90000, c = CacheService.getScriptCache(), map = {};
    const n = Math.ceil(s.length / size);
    for (let i = 0; i < n; i++) map['dash_' + i] = s.substr(i * size, size);
    map.dash_n = String(n);
    c.putAll(map, CACHE_MINUTES * 60);
  } catch (e) { /* cache is optional */ }
}

function readCache_() {
  try {
    const c = CacheService.getScriptCache(), n = Number(c.get('dash_n') || 0);
    if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push('dash_' + i);
    const got = c.getAll(keys); let s = '';
    for (const k of keys) { if (got[k] == null) return null; s += got[k]; }
    return JSON.parse(s);
  } catch (e) { return null; }
}
