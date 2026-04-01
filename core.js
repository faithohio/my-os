// ─────────────────────────────────────────────
// MY OPERATING SYSTEM — Core JS
// ─────────────────────────────────────────────

// !! REPLACE THIS WITH YOUR APPS SCRIPT URL !!
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxGro0DtAC8ELp8NqA443vXIEnyOeU3Yp7L105iEVTs2JlqdjzH6pVQLf1oMipGKhVNQA/exec';

const INCOME_SOURCES = [
  { id: 'lecture', label: 'Monthly Lecture', color: '#c8a84b' },
  { id: 'geniusproof', label: 'GeniusProof Lab', color: '#a08fc0' },
  { id: 'books', label: 'Book Sales', color: '#4ab89e' },
  { id: 'advisory', label: 'Advisory Services', color: '#6ba8d4' },
  { id: 'speaking', label: 'Speaking Engagements', color: '#d97b62' },
  { id: 'ministry', label: 'Ministry / Donations', color: '#6aad7e' },
  { id: 'other', label: 'Other', color: '#888' }
];

const OUTREACH_CHANNELS = ['WhatsApp', 'Instagram DM', 'LinkedIn', 'Email', 'Phone', 'In-person', 'Twitter/X'];
const OUTREACH_PURPOSES = ['Lecture invite', 'GeniusProof inquiry', 'Advisory pitch', 'Speaking pitch', 'Book sale', 'General follow-up', 'Referral ask'];
const OUTREACH_OUTCOMES = ['Interested', 'Registered', 'Not interested', 'No response', 'Follow-up scheduled', 'Converted'];
const CONTENT_TYPES = ['Lecture clip', 'Essay / newsletter', 'Thread', 'Caption / post', 'Video', 'Podcast', 'Other'];
const CONTENT_PLATFORMS = ['Instagram', 'LinkedIn', 'Twitter/X', 'Substack', 'YouTube', 'TikTok', 'WhatsApp status'];

// ── Local cache ──
let cache = {
  summary: null,
  outreach: [],
  income: [],
  lectures: [],
  content: [],
  daily: [],
  loaded: {}
};

// ── API ──
async function apiPost(sheetName, row) {
  if (SHEET_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    // Demo mode — store in localStorage
    const key = `demo_${sheetName}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(row);
    localStorage.setItem(key, JSON.stringify(existing));
    return { success: true };
  }
  try {
    const res = await fetch(SHEET_URL, {
      method: 'POST',
      body: JSON.stringify({ sheet: sheetName, row })
    });
    return await res.json();
  } catch (e) {
    console.error('API error:', e);
    return { success: false, error: e.message };
  }
}

async function apiGet(action, sheet) {
  if (SHEET_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    const key = `demo_${sheet}`;
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return { success: true, data };
  }
  try {
    const url = `${SHEET_URL}?action=${action}${sheet ? '&sheet=' + sheet : ''}`;
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    return { success: false, data: [] };
  }
}

async function loadSummary() {
  if (SHEET_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    return buildDemoSummary();
  }
  const res = await apiGet('summary');
  if (res.success) cache.summary = res.data;
  return cache.summary;
}

async function loadSheet(sheet) {
  if (cache.loaded[sheet]) return cache[sheet.toLowerCase()];
  const res = await apiGet('read', sheet);
  if (res.success) {
    cache[sheet.toLowerCase()] = res.data;
    cache.loaded[sheet] = true;
  }
  return cache[sheet.toLowerCase()] || [];
}

function buildDemoSummary() {
  // Build summary from localStorage demo data
  const income = JSON.parse(localStorage.getItem('demo_Income') || '[]');
  const outreach = JSON.parse(localStorage.getItem('demo_Outreach') || '[]');
  const lectures = JSON.parse(localStorage.getItem('demo_Lectures') || '[]');
  const content = JSON.parse(localStorage.getItem('demo_Content') || '[]');
  const daily = JSON.parse(localStorage.getItem('demo_DailyLog') || '[]');

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const totalIncome = income.reduce((s, r) => s + (parseFloat(r[1]) || 0), 0);
  const bySource = {};
  income.forEach(r => {
    const src = r[2] || 'Other';
    bySource[src] = (bySource[src] || 0) + (parseFloat(r[1]) || 0);
  });

  const totalAttendees = lectures.reduce((s, r) => s + (parseInt(r[2]) || 0), 0);
  const wins = daily.filter(r => r[2] === true || r[2] === 'Yes').length;

  return {
    income: { total: totalIncome, bySource },
    outreach: { monthCount: outreach.length },
    lectures: { latestAttendees: lectures.length ? (parseInt(lectures[lectures.length-1][2]) || 0) : 0, totalAttendees },
    content: { monthCount: content.length },
    winRate: daily.length ? Math.round((wins / daily.length) * 100) : 0,
    month: now.toLocaleString('default', { month: 'long', year: 'numeric' })
  };
}

// ── Navigation ──
let currentPanel = 'dashboard';

function navigate(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');
  const navItem = document.querySelector(`[data-nav="${id}"]`);
  if (navItem) navItem.classList.add('active');

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard', weekly: 'Weekly OS',
    outreach: 'Outreach', income: 'Finance',
    lectures: 'Lectures', content: 'Content',
    daily: 'Daily Log'
  };
  document.getElementById('topbar-title').textContent = titles[id] || id;
  currentPanel = id;

  // Load panel data
  if (id === 'dashboard') loadDashboard();
  if (id === 'outreach') loadOutreachPanel();
  if (id === 'income') loadIncomePanel();
  if (id === 'lectures') loadLecturesPanel();
  if (id === 'content') loadContentPanel();
  if (id === 'daily') loadDailyPanel();

  // Close sidebar on mobile
  if (window.innerWidth < 769) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// ── Toast ──
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Modal ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Formatting ──
function fmtMoney(n) {
  if (!n || isNaN(n)) return '₦0';
  return '₦' + Number(n).toLocaleString('en-NG');
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function today() { return new Date().toISOString().split('T')[0]; }

function sourceColor(sourceId) {
  const s = INCOME_SOURCES.find(x => x.id === sourceId || x.label === sourceId);
  return s ? s.color : '#888';
}
function sourceBadgeClass(sourceId) {
  const map = {
    lecture: 'badge-gold', geniusproof: 'badge-purple', books: 'badge-teal',
    advisory: 'badge-blue', speaking: 'badge-coral', ministry: 'badge-green', other: ''
  };
  return map[sourceId] || 'badge-gold';
}
function outcomeBadge(outcome) {
  const map = {
    'Interested': 'badge-amber', 'Registered': 'badge-teal', 'Converted': 'badge-green',
    'Not interested': 'badge-coral', 'No response': '', 'Follow-up scheduled': 'badge-blue'
  };
  return map[outcome] || '';
}

// ── Sync status ──
function setSyncStatus(online) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (online) {
    dot.className = 'sync-dot';
    label.textContent = SHEET_URL === 'YOUR_APPS_SCRIPT_URL_HERE' ? 'Demo mode' : 'Synced';
  } else {
    dot.className = 'sync-dot offline';
    label.textContent = 'Offline';
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // Set date
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  setSyncStatus(navigator.onLine);
  navigate('dashboard');
});
