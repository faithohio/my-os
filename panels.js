// ─────────────────────────────────────────────
// PANELS — Dashboard, Outreach, Income, Lectures, Content, Daily
// ─────────────────────────────────────────────

// ══════════════ DASHBOARD ══════════════
async function loadDashboard() {
  document.getElementById('dash-loading').style.display = 'block';
  const s = await loadSummary();
  document.getElementById('dash-loading').style.display = 'none';
  if (!s) return;

  // Metrics
  document.getElementById('d-income').textContent = fmtMoney(s.income.total);
  document.getElementById('d-outreach').textContent = s.outreach.monthCount;
  document.getElementById('d-attendees').textContent = s.lectures.latestAttendees;
  document.getElementById('d-content').textContent = s.content.monthCount;
  document.getElementById('d-winrate').textContent = s.winRate + '%';

  // Income bar (target 3M)
  const incPct = Math.min(100, Math.round((s.income.total / 3000000) * 100));
  document.getElementById('income-bar').style.width = incPct + '%';
  document.getElementById('income-pct').textContent = incPct + '% of ₦3M target';

  // Attendees bar (target 50)
  const attPct = Math.min(100, Math.round((s.lectures.latestAttendees / 50) * 100));
  document.getElementById('att-bar').style.width = attPct + '%';
  document.getElementById('att-pct').textContent = `${s.lectures.latestAttendees} / 50 May goal`;

  // Income by source
  renderIncomeBreakdown(s.income.bySource, s.income.total);
}

function renderIncomeBreakdown(bySource, total) {
  const el = document.getElementById('income-breakdown');
  if (!bySource || Object.keys(bySource).length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:1rem 0">No income logged yet</div>';
    return;
  }
  el.innerHTML = Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([src, amt]) => {
    const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
    const color = sourceColor(src);
    return `
      <div class="income-source-item">
        <div class="income-source-top">
          <span class="income-source-name">${src}</span>
          <span>${fmtMoney(amt)} <span style="color:var(--text-muted)">(${pct}%)</span></span>
        </div>
        <div class="income-bar-wrap">
          <div class="income-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }).join('');
}

// ══════════════ OUTREACH ══════════════
async function loadOutreachPanel() {
  document.getElementById('outreach-loading').style.display = 'block';
  const rows = await loadSheet('Outreach');
  document.getElementById('outreach-loading').style.display = 'none';
  renderOutreachTable(rows);
  updateOutreachStats(rows);
}

function updateOutreachStats(rows) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const monthRows = rows.filter(r => {
    const d = new Date(r.Date || r[0]);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  document.getElementById('o-month').textContent = monthRows.length;
  document.getElementById('o-total').textContent = rows.length;
  const converted = rows.filter(r => (r.Outcome || r[4]) === 'Converted' || (r.Outcome || r[4]) === 'Registered').length;
  document.getElementById('o-converted').textContent = converted;
}

function renderOutreachTable(rows) {
  const tbody = document.getElementById('outreach-tbody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">📭</div>No outreach logged yet. Start by logging today's conversations.</div></td></tr>`;
    return;
  }
  // Show most recent first
  tbody.innerHTML = [...rows].reverse().slice(0, 100).map(r => {
    const date = r.Date || r[0];
    const name = r.Name || r[1];
    const channel = r.Channel || r[2];
    const purpose = r.Purpose || r[3];
    const outcome = r.Outcome || r[4];
    const notes = r.Notes || r[6];
    return `<tr>
      <td>${fmtDate(date)}</td>
      <td style="color:var(--text);font-weight:400">${name || ''}</td>
      <td>${channel || ''}</td>
      <td>${purpose || ''}</td>
      <td>${outcome ? `<span class="badge ${outcomeBadge(outcome)}">${outcome}</span>` : ''}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--text-muted)">${notes || ''}</td>
    </tr>`;
  }).join('');
}

async function submitOutreach() {
  const form = document.getElementById('outreach-form');
  const row = [
    form.querySelector('[name=date]').value,
    form.querySelector('[name=name]').value,
    form.querySelector('[name=channel]').value,
    form.querySelector('[name=purpose]').value,
    form.querySelector('[name=outcome]').value,
    form.querySelector('[name=followup]').value,
    form.querySelector('[name=notes]').value
  ];
  if (!row[0] || !row[1]) { toast('Date and name are required', 'error'); return; }

  const btn = document.getElementById('outreach-submit');
  btn.textContent = 'Saving...';
  const res = await apiPost('Outreach', row);
  btn.textContent = 'Log outreach';

  if (res.success) {
    toast('Outreach logged ✓', 'success');
    closeModal('outreach-modal');
    form.reset();
    form.querySelector('[name=date]').value = today();
    cache.loaded['Outreach'] = false;
    await loadOutreachPanel();
  } else {
    toast('Error saving — check connection', 'error');
  }
}

// ══════════════ INCOME ══════════════
async function loadIncomePanel() {
  document.getElementById('income-loading').style.display = 'block';
  const rows = await loadSheet('Income');
  document.getElementById('income-loading').style.display = 'none';
  renderIncomeTable(rows);
  updateIncomeStats(rows);
  renderIncomeChartBySource(rows);
}

function updateIncomeStats(rows) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  let monthTotal = 0, allTotal = 0;
  const bySource = {};
  rows.forEach(r => {
    const amt = parseFloat(r.Amount || r[1]) || 0;
    allTotal += amt;
    const d = new Date(r.Date || r[0]);
    if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
      monthTotal += amt;
      const src = r.Source || r[2] || 'Other';
      bySource[src] = (bySource[src] || 0) + amt;
    }
  });
  document.getElementById('inc-month').textContent = fmtMoney(monthTotal);
  document.getElementById('inc-total').textContent = fmtMoney(allTotal);
  document.getElementById('inc-target-pct').textContent = Math.round((monthTotal / 3000000) * 100) + '%';
  document.getElementById('inc-bar-fill').style.width = Math.min(100, (monthTotal / 3000000) * 100) + '%';
  renderIncomeBreakdownFull(bySource, monthTotal);
}

function renderIncomeBreakdownFull(bySource, total) {
  const el = document.getElementById('inc-breakdown-full');
  if (!bySource || Object.keys(bySource).length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No income this month yet</div>';
    return;
  }
  el.innerHTML = Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([src, amt]) => {
    const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
    const color = sourceColor(src);
    return `
      <div class="income-source-item">
        <div class="income-source-top">
          <span class="income-source-name">${src}</span>
          <span>${fmtMoney(amt)} <span style="color:var(--text-muted)">(${pct}%)</span></span>
        </div>
        <div class="income-bar-wrap"><div class="income-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
  }).join('');
}

function renderIncomeChartBySource(rows) {
  // Group all-time by source
  const bySource = {};
  rows.forEach(r => {
    const src = r.Source || r[2] || 'Other';
    const amt = parseFloat(r.Amount || r[1]) || 0;
    bySource[src] = (bySource[src] || 0) + amt;
  });

  // Monthly trend — last 6 months
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleString('default', { month: 'short' }), month: d.getMonth(), year: d.getFullYear(), total: 0 });
  }
  rows.forEach(r => {
    const d = new Date(r.Date || r[0]);
    const m = months.find(x => x.month === d.getMonth() && x.year === d.getFullYear());
    if (m) m.total += parseFloat(r.Amount || r[1]) || 0;
  });

  const el = document.getElementById('income-trend-chart');
  const max = Math.max(...months.map(m => m.total), 1);
  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:8px;height:100px;">
      ${months.map(m => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="font-size:10px;color:var(--text-muted)">${m.total > 0 ? fmtMoney(m.total).replace('₦','') : ''}</div>
          <div style="width:100%;background:${m.total > 0 ? 'var(--gold)' : 'var(--surface3)'};border-radius:3px 3px 0 0;height:${Math.max(4, Math.round((m.total / max) * 80))}px;transition:height 0.5s"></div>
          <div style="font-size:10px;color:var(--text-muted);font-family:'DM Mono',monospace">${m.label}</div>
        </div>
      `).join('')}
    </div>`;
}

function renderIncomeTable(rows) {
  const tbody = document.getElementById('income-tbody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">💰</div>No income logged yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = [...rows].reverse().slice(0, 100).map(r => {
    const date = r.Date || r[0];
    const amt = r.Amount || r[1];
    const src = r.Source || r[2];
    const desc = r.Description || r[3];
    const status = r.Status || r[5];
    const srcId = INCOME_SOURCES.find(x => x.label === src)?.id || 'other';
    return `<tr>
      <td>${fmtDate(date)}</td>
      <td style="color:var(--gold);font-family:'Cormorant Garamond',serif;font-size:1.1rem">${fmtMoney(amt)}</td>
      <td><span class="badge ${sourceBadgeClass(srcId)}">${src || ''}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${desc || ''}</td>
      <td>${status ? `<span class="badge ${status === 'Received' ? 'badge-green' : 'badge-amber'}">${status}</span>` : ''}</td>
    </tr>`;
  }).join('');
}

async function submitIncome() {
  const form = document.getElementById('income-form');
  const row = [
    form.querySelector('[name=date]').value,
    form.querySelector('[name=amount]').value,
    form.querySelector('[name=source]').value,
    form.querySelector('[name=description]').value,
    form.querySelector('[name=payment]').value,
    form.querySelector('[name=status]').value
  ];
  if (!row[0] || !row[1] || !row[2]) { toast('Date, amount and source required', 'error'); return; }

  const btn = document.getElementById('income-submit');
  btn.textContent = 'Saving...';
  const res = await apiPost('Income', row);
  btn.textContent = 'Log income';

  if (res.success) {
    toast('Income logged ✓', 'success');
    closeModal('income-modal');
    form.reset();
    form.querySelector('[name=date]').value = today();
    cache.loaded['Income'] = false;
    cache.summary = null;
    await loadIncomePanel();
  } else {
    toast('Error saving', 'error');
  }
}

// ══════════════ LECTURES ══════════════
async function loadLecturesPanel() {
  document.getElementById('lectures-loading').style.display = 'block';
  const rows = await loadSheet('Lectures');
  document.getElementById('lectures-loading').style.display = 'none';
  renderLecturesTable(rows);
  updateLectureStats(rows);
}

function updateLectureStats(rows) {
  const total = rows.reduce((s, r) => s + (parseInt(r.Attendees || r[2]) || 0), 0);
  const latest = rows.length ? (parseInt(rows[rows.length - 1].Attendees || rows[rows.length - 1][2]) || 0) : 0;
  const totalReferrals = rows.reduce((s, r) => s + (parseInt(r.Referrals || r[3]) || 0), 0);
  document.getElementById('lec-count').textContent = rows.length;
  document.getElementById('lec-attendees').textContent = total;
  document.getElementById('lec-latest').textContent = latest;
  document.getElementById('lec-referrals').textContent = totalReferrals;
  document.getElementById('lec-goal-bar').style.width = Math.min(100, (latest / 50) * 100) + '%';
  document.getElementById('lec-goal-pct').textContent = `${latest}/50 — May target`;

  // Growth chart
  const el = document.getElementById('lec-chart');
  if (rows.length === 0) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No lectures yet</div>'; return; }
  const max = Math.max(...rows.map(r => parseInt(r.Attendees || r[2]) || 0), 1);
  el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:8px;height:80px">
    ${rows.map((r, i) => {
      const att = parseInt(r.Attendees || r[2]) || 0;
      const h = Math.max(4, Math.round((att / max) * 70));
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="font-size:10px;color:var(--gold)">${att}</div>
        <div style="width:100%;background:var(--gold);opacity:${0.5 + (i/rows.length)*0.5};border-radius:3px 3px 0 0;height:${h}px"></div>
        <div style="font-size:9px;color:var(--text-muted);font-family:'DM Mono',monospace">L${i+1}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderLecturesTable(rows) {
  const tbody = document.getElementById('lectures-tbody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🎙️</div>No lectures logged yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = [...rows].reverse().map(r => {
    return `<tr>
      <td>${fmtDate(r.Date || r[0])}</td>
      <td style="color:var(--text);font-weight:400">${r.EventName || r[1] || ''}</td>
      <td style="color:var(--gold);font-family:'Cormorant Garamond',serif;font-size:1.1rem">${r.Attendees || r[2] || 0}</td>
      <td>${r.Referrals || r[3] || 0}</td>
      <td>${r.Revenue ? fmtMoney(r.Revenue || r[4]) : '—'}</td>
      <td style="font-size:11px;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.Topic || r[5] || ''}</td>
    </tr>`;
  }).join('');
}

async function submitLecture() {
  const form = document.getElementById('lecture-form');
  const row = [
    form.querySelector('[name=date]').value,
    form.querySelector('[name=eventname]').value,
    form.querySelector('[name=attendees]').value,
    form.querySelector('[name=referrals]').value,
    form.querySelector('[name=revenue]').value,
    form.querySelector('[name=topic]').value,
    form.querySelector('[name=notes]').value
  ];
  if (!row[0] || !row[2]) { toast('Date and attendees required', 'error'); return; }

  const btn = document.getElementById('lecture-submit');
  btn.textContent = 'Saving...';
  const res = await apiPost('Lectures', row);
  btn.textContent = 'Log lecture';

  if (res.success) {
    toast('Lecture logged ✓', 'success');
    closeModal('lecture-modal');
    form.reset();
    form.querySelector('[name=date]').value = today();
    cache.loaded['Lectures'] = false;
    cache.summary = null;
    await loadLecturesPanel();
  } else {
    toast('Error saving', 'error');
  }
}

// ══════════════ CONTENT ══════════════
async function loadContentPanel() {
  document.getElementById('content-loading').style.display = 'block';
  const rows = await loadSheet('Content');
  document.getElementById('content-loading').style.display = 'none';
  renderContentTable(rows);
  updateContentStats(rows);
}

function updateContentStats(rows) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const monthRows = rows.filter(r => {
    const d = new Date(r.Date || r[0]);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const clips = monthRows.filter(r => (r.Type || r[1]) === 'Lecture clip').length;
  const essays = monthRows.filter(r => (r.Type || r[1]) === 'Essay / newsletter').length;
  document.getElementById('con-month').textContent = monthRows.length;
  document.getElementById('con-clips').textContent = clips;
  document.getElementById('con-essays').textContent = essays;
  document.getElementById('con-total').textContent = rows.length;
  document.getElementById('con-clip-bar').style.width = Math.min(100, (clips / 10) * 100) + '%';
  document.getElementById('con-clip-pct').textContent = `${clips}/10 clips — lecture target`;
}

function renderContentTable(rows) {
  const tbody = document.getElementById('content-tbody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">✏️</div>No content logged yet.</div></td></tr>`;
    return;
  }
  const typeColors = {
    'Lecture clip': 'badge-teal', 'Essay / newsletter': 'badge-coral',
    'Thread': 'badge-blue', 'Caption / post': 'badge-purple',
    'Video': 'badge-gold', 'Podcast': 'badge-amber'
  };
  tbody.innerHTML = [...rows].reverse().slice(0, 100).map(r => {
    const type = r.Type || r[1];
    return `<tr>
      <td>${fmtDate(r.Date || r[0])}</td>
      <td><span class="badge ${typeColors[type] || ''}">${type || ''}</span></td>
      <td style="color:var(--text)">${r.Title || r[2] || ''}</td>
      <td>${r.Platform || r[3] || ''}</td>
      <td style="font-size:11px;color:var(--text-muted)">${r.LectureRef || r[4] || ''}</td>
      <td>${r.Status ? `<span class="badge ${r.Status === 'Published' ? 'badge-green' : 'badge-amber'}">${r.Status}</span>` : ''}</td>
    </tr>`;
  }).join('');
}

async function submitContent() {
  const form = document.getElementById('content-form');
  const row = [
    form.querySelector('[name=date]').value,
    form.querySelector('[name=type]').value,
    form.querySelector('[name=title]').value,
    form.querySelector('[name=platform]').value,
    form.querySelector('[name=lecture_ref]').value,
    form.querySelector('[name=status]').value,
    form.querySelector('[name=notes]').value
  ];
  if (!row[0] || !row[1]) { toast('Date and type required', 'error'); return; }

  const btn = document.getElementById('content-submit');
  btn.textContent = 'Saving...';
  const res = await apiPost('Content', row);
  btn.textContent = 'Log content';

  if (res.success) {
    toast('Content logged ✓', 'success');
    closeModal('content-modal');
    form.reset();
    form.querySelector('[name=date]').value = today();
    cache.loaded['Content'] = false;
    await loadContentPanel();
  } else {
    toast('Error saving', 'error');
  }
}

// ══════════════ DAILY LOG ══════════════
async function loadDailyPanel() {
  document.getElementById('daily-loading').style.display = 'block';
  const rows = await loadSheet('DailyLog');
  document.getElementById('daily-loading').style.display = 'none';
  renderDailyTable(rows);
  updateDailyStats(rows);
}

function updateDailyStats(rows) {
  const wins = rows.filter(r => r.WinAchieved === true || r.WinAchieved === 'Yes' || r[2] === true || r[2] === 'Yes').length;
  const rate = rows.length > 0 ? Math.round((wins / rows.length) * 100) : 0;
  document.getElementById('dl-days').textContent = rows.length;
  document.getElementById('dl-wins').textContent = wins;
  document.getElementById('dl-rate').textContent = rate + '%';
  document.getElementById('dl-rate-bar').style.width = rate + '%';
}

function renderDailyTable(rows) {
  const tbody = document.getElementById('daily-tbody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📅</div>No daily logs yet. Score your first day.</div></td></tr>`;
    return;
  }
  const dayColors = { Monday: '#c8a84b', Tuesday: '#4ab89e', Wednesday: '#d4a43e', Thursday: '#d97b62', Friday: '#6ba8d4' };
  tbody.innerHTML = [...rows].reverse().slice(0, 60).map(r => {
    const win = r.WinAchieved || r[2];
    const isWin = win === true || win === 'Yes' || win === 'TRUE';
    const day = r.Day || r[1];
    return `<tr>
      <td>${fmtDate(r.Date || r[0])}</td>
      <td style="color:${dayColors[day] || 'var(--text)'}">${day || ''}</td>
      <td>${isWin ? '<span class="badge badge-green">Win ✓</span>' : '<span class="badge badge-coral">Miss</span>'}</td>
      <td style="color:var(--gold)">${r.Score || r[3] || '—'}/5</td>
      <td style="font-size:12px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.Notes || r[4] || ''}</td>
    </tr>`;
  }).join('');
}

async function submitDaily() {
  const form = document.getElementById('daily-form');
  const win = form.querySelector('[name=win]').value;
  const row = [
    form.querySelector('[name=date]').value,
    form.querySelector('[name=day]').value,
    win === 'yes' ? 'Yes' : 'No',
    form.querySelector('[name=score]').value,
    form.querySelector('[name=notes]').value
  ];
  if (!row[0] || !row[1]) { toast('Date and day required', 'error'); return; }

  const btn = document.getElementById('daily-submit');
  btn.textContent = 'Saving...';
  const res = await apiPost('DailyLog', row);
  btn.textContent = 'Log day';

  if (res.success) {
    toast('Day logged ✓', 'success');
    closeModal('daily-modal');
    form.reset();
    form.querySelector('[name=date]').value = today();
    cache.loaded['DailyLog'] = false;
    await loadDailyPanel();
  } else {
    toast('Error saving', 'error');
  }
}

// ══════════════ WEEKLY OS ══════════════
const OS_DAYS = [
  { name: 'Monday', theme: 'Plan & Study', color: '#c8a84b', output: 'Weekly agenda + 1 essay',
    question: 'What does a winning week look like?',
    tasks: [
      { label: 'Define', items: ['Draft week agenda & milestones', 'Identify your #1 priority for the week'] },
      { label: 'Write', items: ['Write one essay or newsletter (lecture offshoot)', 'Prep or update next lecture notes'] },
      { label: 'Learn', items: ['Read one Substack, book chapter, or directed video', 'Capture one key insight in your notes'] },
      { label: 'Reset', items: ['Clear workspace & inbox', 'Review last week\'s milestones'] }
    ], win: 'Agenda written + one piece of writing done' },
  { name: 'Tuesday', theme: 'Sales & Outreach', color: '#4ab89e', output: 'Conversations started + leads updated',
    question: 'Who needs to hear from me today?',
    tasks: [
      { label: 'Referrals', items: ['Reach out to all referrals from last lecture', 'Send follow-up to warm leads'] },
      { label: 'Outreach', items: ['Start 5 new conversations (DMs, email, connections)', 'Engage meaningfully with followers'] },
      { label: 'Past clients', items: ['Check in with past clients or advisory contacts', 'Pitch one speaking or advisory opportunity'] },
      { label: 'Admin', items: ['Update your lead tracker', 'Set targets for next cycle'] }
    ], win: '5+ outreach messages sent + tracker updated' },
  { name: 'Wednesday', theme: 'Content & Editing', color: '#d4a43e', output: 'Clips cut + content scheduled',
    question: 'What content moves people toward the next lecture?',
    tasks: [
      { label: 'Video', items: ['Retrieve lecture video (if available)', 'Cut or brief 2–3 clips for the week'] },
      { label: 'Captions', items: ['Draft captions & hooks for each clip', 'Schedule posts for the next 2 weeks'] },
      { label: 'Repurpose', items: ['Turn Monday essay into a thread or caption', 'Pull one quote from lecture for a standalone post'] },
      { label: 'Review', items: ['Check content calendar — any gaps?', 'Every post should funnel to next lecture'] }
    ], win: '2–3 clips ready + content scheduled ahead' },
  { name: 'Thursday', theme: 'Build & Prepare', color: '#d97b62', output: 'Systems, scripts & lecture prep advanced',
    question: 'What do I need to build so next week runs smoothly?',
    tasks: [
      { label: 'Lecture prep', items: ['Advance preparation for next lecture', 'Research, structure or rehearse one section'] },
      { label: 'Systems', items: ['Write or refine referral scripts', 'Build or update any ops template or process'] },
      { label: 'Ministry', items: ['Dedicated ministry work — outreach, prep, content', 'Review ministry goals for the month'] },
      { label: 'Wildcards', items: ['Handle anything that slipped Mon–Wed', 'One strategic task toward facility / income goal'] }
    ], win: 'Lecture 1 step more ready + 1 system improved' },
  { name: 'Friday', theme: 'Review & Rest', color: '#6ba8d4', output: 'Week scored + energy restored',
    question: 'Did I win this week? What do I carry forward?',
    tasks: [
      { label: 'Review', items: ['Score each day: did you hit the daily win?', 'Note what worked and what didn\'t'] },
      { label: 'Metrics', items: ['Check lecture registrations vs. May 50 goal', 'Count: outreach sent, clips made, essays written'] },
      { label: 'Reset', items: ['Clear desk, notes, and task list', 'Reschedule or drop anything incomplete'] },
      { label: 'Recharge', items: ['Protect Friday evenings — non-negotiable', 'Read, rest, or do something that fills you up'] }
    ], win: 'Week reviewed + score logged + energy protected' }
];

let activeOsDay = (() => {
  const d = new Date().getDay();
  const map = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
  return map[d] !== undefined ? map[d] : 0;
})();

function renderWeeklyOS() {
  const grid = document.getElementById('os-week-grid');
  grid.innerHTML = OS_DAYS.map((d, i) => `
    <div class="day-card ${i === activeOsDay ? 'active' : ''}" style="--accent-c:${d.color}" onclick="setOsDay(${i})">
      <div class="day-dot"></div>
      <div class="day-name">${d.name}</div>
      <div class="day-theme">${d.theme}</div>
      <div class="day-output">${d.output}</div>
    </div>`).join('');

  const d = OS_DAYS[activeOsDay];
  document.getElementById('os-detail').innerHTML = `
    <div style="margin-bottom:6px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted)">${d.name}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;color:${d.color};margin-bottom:4px">${d.theme}</div>
    <div style="font-size:12px;color:var(--text-muted);font-style:italic;margin-bottom:18px">"${d.question}"</div>
    <div class="tasks-grid">
      ${d.tasks.map(t => `
        <div class="task-block">
          <div class="task-label" style="color:${d.color}">${t.label}</div>
          ${t.items.map(item => `<div class="task-item"><div class="task-bullet" style="background:${d.color}"></div>${item}</div>`).join('')}
        </div>`).join('')}
    </div>
    <div class="win-bar" style="background:${d.color}18;border-color:${d.color}33;margin-top:14px">
      <span class="win-label" style="color:${d.color}">Daily win</span>
      <span class="win-text">${d.win}</span>
    </div>`;
}

function setOsDay(i) {
  activeOsDay = i;
  renderWeeklyOS();
}
