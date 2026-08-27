// =============================================================
// APP.JS - Inti aplikasi Integrida
// =============================================================

const state = {
  user: null,
  companies: [],
  view: 'dashboard',
  compareCompanyIds: [],
  comparePeriodType: 'tahunan',
  ratioCompanyId: null,
  ratioStatementId: null,
  chartInstances: {}
};

const PERIOD_LABELS = {
  bulanan: 'Bulanan',
  triwulan: 'Triwulan',
  semester: 'Semester',
  tahunan: 'Tahunan'
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'companies', label: 'Perusahaan', icon: 'building' },
  { id: 'import', label: 'Impor Data', icon: 'upload' },
  { id: 'compare', label: 'Perbandingan', icon: 'bars' },
  { id: 'ratios', label: 'Analisis Rasio', icon: 'pulse' },
  { id: 'settings', label: 'Pengaturan', icon: 'gear' }
];

const ICONS = {
  grid: '<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M14 21v-9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v9M4 21h16M7 8h1M7 11h1M7 14h1M11 8h1M11 11h1M11 14h1" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  upload: '<path d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  bars: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  pulse: '<path d="M3 12h4l2 7 4-14 2 7h6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  gear: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none">${ICONS[name] || ''}</svg>`;
}

// ---------- Utilitas ----------
function formatIDR(v) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return 'Rp ' + Math.round(v).toLocaleString('id-ID');
}

function toast(message, type = 'default') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type !== 'default' ? ' ' + type : '');
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Auth ----------
function renderAuthScreen(mode = 'login', errorMsg = '') {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="mark">IN</div>
          <div class="name">Integrida</div>
        </div>
        <div class="auth-tabs">
          <div class="auth-tab ${mode === 'login' ? 'active' : ''}" data-mode="login">Masuk</div>
          <div class="auth-tab ${mode === 'register' ? 'active' : ''}" data-mode="register">Daftar</div>
        </div>
        ${errorMsg ? `<div class="auth-error">${errorMsg}</div>` : ''}
        <form id="auth-form">
          <div class="field">
            <label>Email</label>
            <input type="email" id="auth-email" required autocomplete="email">
          </div>
          <div class="field">
            <label>Kata sandi</label>
            <input type="password" id="auth-password" required minlength="6" autocomplete="current-password">
          </div>
          <button type="submit" class="btn primary" style="width:100%;justify-content:center;">
            ${mode === 'login' ? 'Masuk' : 'Buat akun'}
          </button>
        </form>
        <div class="auth-hint">
          Integrida &mdash; konsolidasi laporan keuangan multi-perusahaan.
          Data disimpan pada Firebase project Anda sendiri.
        </div>
      </div>
    </div>`;

  root.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => renderAuthScreen(tab.dataset.mode));
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    try {
      if (mode === 'login') {
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        await auth.createUserWithEmailAndPassword(email, password);
      }
    } catch (err) {
      renderAuthScreen(mode, translateAuthError(err));
    }
  });
}

function translateAuthError(err) {
  const map = {
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/user-not-found': 'Akun tidak ditemukan.',
    'auth/wrong-password': 'Kata sandi salah.',
    'auth/email-already-in-use': 'Email sudah terdaftar.',
    'auth/weak-password': 'Kata sandi minimal 6 karakter.',
    'auth/invalid-credential': 'Email atau kata sandi salah.'
  };
  return map[err.code] || ('Terjadi kesalahan: ' + err.message);
}

// ---------- Shell ----------
function renderShell() {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div id="app-shell">
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="mark">IN</div>
          <div>
            <div class="name">Integrida</div>
            <div class="tag">Konsolidasi Keuangan</div>
          </div>
        </div>
        <div class="sidebar-section" id="nav-list"></div>
        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="dot">${(state.user.email || '?')[0].toUpperCase()}</div>
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${state.user.email}</div>
          </div>
          <button class="logout-btn" id="logout-btn">Keluar</button>
        </div>
      </nav>
      <div class="main">
        <div class="topbar">
          <div>
            <h1 id="topbar-title">Dashboard</h1>
            <div class="sub" id="topbar-sub">Ringkasan seluruh perusahaan</div>
          </div>
          <button class="btn ghost" id="refresh-btn">Muat ulang data</button>
        </div>
        <div class="content" id="view-root"></div>
      </div>
    </div>
    <div class="toast-wrap" id="toast-wrap"></div>
  `;

  const navList = document.getElementById('nav-list');
  NAV_ITEMS.forEach(item => {
    const navEl = el(`<div class="nav-item" data-view="${item.id}">${icon(item.icon)}<span>${item.label}</span></div>`);
    navEl.addEventListener('click', () => setView(item.id));
    navList.appendChild(navEl);
  });

  document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
  document.getElementById('refresh-btn').addEventListener('click', reloadCompanies);
}

function setView(viewId) {
  state.view = viewId;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === viewId));
  const titles = {
    dashboard: ['Dashboard', 'Ringkasan seluruh perusahaan'],
    companies: ['Perusahaan', 'Kelola daftar entitas yang dikonsolidasikan'],
    import: ['Impor Data', 'Unggah neraca & laba rugi dari file Excel'],
    compare: ['Perbandingan', 'Bandingkan kinerja antar perusahaan & periode'],
    ratios: ['Analisis Rasio', 'Likuiditas, solvabilitas, dan profitabilitas'],
    settings: ['Pengaturan', 'Akun dan konfigurasi']
  };
  document.getElementById('topbar-title').textContent = titles[viewId][0];
  document.getElementById('topbar-sub').textContent = titles[viewId][1];
  renderCurrentView();
}

function renderCurrentView() {
  const map = {
    dashboard: renderDashboard,
    companies: renderCompanies,
    import: renderImport,
    compare: renderCompare,
    ratios: renderRatios,
    settings: renderSettings
  };
  (map[state.view] || renderDashboard)();
}

async function reloadCompanies() {
  state.companies = await DB.getCompanies(state.user.uid);
  renderCurrentView();
}

// ---------- Dashboard ----------
async function renderDashboard() {
  const root = document.getElementById('view-root');
  if (state.companies.length === 0) {
    root.innerHTML = emptyState('Belum ada perusahaan', 'Tambahkan perusahaan lalu impor data laporan keuangan untuk melihat ringkasan di sini.', 'companies', 'Tambah Perusahaan');
    bindEmptyStateNav(root);
    return;
  }
  root.innerHTML = `<div class="section-block"><div class="section-title">Memuat ringkasan…</div></div>`;

  const allStatements = await DB.getAllStatementsForCompanies(state.companies.map(c => c.id));

  const totalAset = allStatements.reduce((sum, s) => Math.max(sum, 0) + 0, 0); // placeholder, recalculated below
  const latestByCompany = {};
  allStatements.forEach(s => {
    const cur = latestByCompany[s.companyId];
    if (!cur || s.year > cur.year || (s.year === cur.year && s.periodIndex > cur.periodIndex)) {
      latestByCompany[s.companyId] = s;
    }
  });
  const latestList = Object.values(latestByCompany);
  const sumTotalAset = latestList.reduce((a, s) => a + (s.neraca.totalAset || 0), 0);
  const sumPendapatan = latestList.reduce((a, s) => a + (s.labaRugi.pendapatan || 0), 0);
  const sumLabaBersih = latestList.reduce((a, s) => a + (s.labaRugi.labaBersih || 0), 0);
  const avgCurrentRatio = latestList.length
    ? latestList.reduce((a, s) => a + (computeRatios(s).likuiditas.currentRatio || 0), 0) / latestList.length
    : 0;

  root.innerHTML = `
    <div class="section-block grid grid-4">
      <div class="card kpi-card">
        <div class="kpi-label">Total Perusahaan</div>
        <div class="kpi-value">${state.companies.length}</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-label">Total Aset (periode terbaru)</div>
        <div class="kpi-value">${formatIDR(sumTotalAset)}</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-label">Total Pendapatan (periode terbaru)</div>
        <div class="kpi-value">${formatIDR(sumPendapatan)}</div>
      </div>
      <div class="card kpi-card">
        <div class="kpi-label">Rata-rata Current Ratio</div>
        <div class="kpi-value">${avgCurrentRatio.toFixed(2)}x</div>
      </div>
    </div>

    <div class="section-block grid grid-2">
      <div class="chart-box">
        <div class="section-title">Total Aset per Perusahaan (Periode Terbaru)</div>
        <canvas id="chart-aset"></canvas>
      </div>
      <div class="chart-box">
        <div class="section-title">Laba Bersih per Perusahaan (Periode Terbaru)</div>
        <canvas id="chart-laba"></canvas>
      </div>
    </div>

    <div class="section-block">
      <div class="section-title">Ringkasan Perusahaan</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Perusahaan</th><th>Periode Terbaru</th><th class="num">Total Aset</th><th class="num">Pendapatan</th><th class="num">Laba Bersih</th><th class="num">Current Ratio</th></tr></thead>
          <tbody>
            ${state.companies.map(c => {
              const s = latestByCompany[c.id];
              if (!s) return `<tr><td>${c.name}</td><td colspan="5" style="text-align:left;color:var(--slate-light);">Belum ada data</td></tr>`;
              const r = computeRatios(s);
              return `<tr>
                <td>${c.name}</td>
                <td>${s.periodLabel}</td>
                <td class="num">${formatIDR(s.neraca.totalAset)}</td>
                <td class="num">${formatIDR(s.labaRugi.pendapatan)}</td>
                <td class="num">${formatIDR(s.labaRugi.labaBersih)}</td>
                <td class="num">${formatRatio(r.likuiditas.currentRatio, 'x')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const labels = latestList.map(s => state.companies.find(c => c.id === s.companyId)?.name || '?');
  renderBarChart('chart-aset', labels, [{ label: 'Total Aset', data: latestList.map(s => s.neraca.totalAset || 0), color: '#1B7A6B' }]);
  renderBarChart('chart-laba', labels, [{ label: 'Laba Bersih', data: latestList.map(s => s.labaRugi.labaBersih || 0), color: '#C08A3E' }]);
}

function emptyState(title, desc, navTarget, actionLabel) {
  return `<div class="card empty-state">
    <div class="mark">📊</div>
    <h3 style="margin:6px 0;font-family:var(--font-display);">${title}</h3>
    <p style="max-width:420px;margin:0 auto 16px auto;">${desc}</p>
    <button class="btn primary" data-nav="${navTarget}">${actionLabel}</button>
  </div>`;
}
function bindEmptyStateNav(root) {
  const btn = root.querySelector('[data-nav]');
  if (btn) btn.addEventListener('click', () => setView(btn.dataset.nav));
}

// ---------- Perusahaan ----------
function renderCompanies() {
  const root = document.getElementById('view-root');
  root.innerHTML = `
    <div class="section-block" style="display:flex;justify-content:flex-end;">
      <button class="btn primary" id="add-company-btn">+ Tambah Perusahaan</button>
    </div>
    ${state.companies.length === 0 ? emptyState('Belum ada perusahaan', 'Mulai dengan menambahkan perusahaan pertama Anda.', '', '') : `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama Perusahaan</th><th class="num">Jumlah Periode Tersimpan</th><th></th></tr></thead>
        <tbody id="company-rows"></tbody>
      </table>
    </div>`}
  `;
  document.getElementById('add-company-btn').addEventListener('click', openAddCompanyModal);
  if (state.companies.length) fillCompanyRows();
}

async function fillCompanyRows() {
  const tbody = document.getElementById('company-rows');
  tbody.innerHTML = state.companies.map(c => `<tr data-id="${c.id}"><td>${c.name}</td><td class="num">…</td><td style="text-align:right;"><button class="btn ghost" data-del="${c.id}">Hapus</button></td></tr>`).join('');
  for (const c of state.companies) {
    const statements = await DB.getStatements(c.id);
    const row = tbody.querySelector(`tr[data-id="${c.id}"] td:nth-child(2)`);
    if (row) row.textContent = statements.length;
  }
  tbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus perusahaan ini beserta seluruh data laporannya?')) return;
      await DB.deleteCompany(btn.dataset.del);
      toast('Perusahaan dihapus', 'success');
      await reloadCompanies();
    });
  });
}

function openAddCompanyModal() {
  const backdrop = el(`<div class="modal-backdrop"><div class="modal">
    <h3>Tambah Perusahaan</h3>
    <div class="modal-sub">Perusahaan yang akan dikonsolidasikan laporan keuangannya.</div>
    <div class="field"><label>Nama Perusahaan</label><input type="text" id="new-company-name" placeholder="Contoh: PT Sumber Makmur"></div>
    <div class="modal-actions">
      <button class="btn ghost" id="cancel-modal">Batal</button>
      <button class="btn primary" id="save-company">Simpan</button>
    </div>
  </div></div>`);
  document.body.appendChild(backdrop);
  backdrop.querySelector('#cancel-modal').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.querySelector('#save-company').addEventListener('click', async () => {
    const name = backdrop.querySelector('#new-company-name').value.trim();
    if (!name) { toast('Nama perusahaan wajib diisi', 'error'); return; }
    await DB.addCompany(state.user.uid, name);
    backdrop.remove();
    toast('Perusahaan ditambahkan', 'success');
    await reloadCompanies();
  });
}

// ---------- Import ----------
function renderImport() {
  const root = document.getElementById('view-root');
  if (state.companies.length === 0) {
    root.innerHTML = emptyState('Tambahkan perusahaan terlebih dahulu', 'Anda perlu memiliki minimal satu perusahaan sebelum mengimpor data.', 'companies', 'Tambah Perusahaan');
    bindEmptyStateNav(root);
    return;
  }
  root.innerHTML = `
    <div class="grid grid-2" style="align-items:start;">
      <div class="card">
        <div class="section-title">1. Pilih Perusahaan Tujuan</div>
        <div class="field">
          <label>Perusahaan</label>
          <select id="import-company">
            ${state.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="section-title" style="margin-top:20px;">2. Unggah File Excel</div>
        <div class="dropzone" id="dropzone">
          ${icon('upload')}
          <div>Seret file .xlsx ke sini, atau klik untuk memilih</div>
          <div style="font-size:11.5px;margin-top:6px;">Gunakan template dengan sheet: Info, Neraca, Laba Rugi</div>
        </div>
        <input type="file" id="file-input" accept=".xlsx,.xls" style="display:none;">
        <a href="template/Template_Import_Neraca_LabaRugi.xlsx" download class="btn ghost" style="margin-top:14px;width:100%;justify-content:center;">Unduh Template Excel</a>
      </div>
      <div class="card" id="preview-panel">
        <div class="section-title">Pratinjau Data</div>
        <div style="color:var(--slate);font-size:13px;">Belum ada file dipilih.</div>
      </div>
    </div>
  `;

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  dropzone.addEventListener('click', () => fileInput.click());
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleImportFile(e.target.files[0]); });
}

let pendingImport = null;

async function handleImportFile(file) {
  const panel = document.getElementById('preview-panel');
  try {
    const buffer = await file.arrayBuffer();
    const result = parseFinancialExcel(buffer);
    pendingImport = result;

    const s = result.statement;
    panel.innerHTML = `
      <div class="section-title">Pratinjau Data</div>
      <div style="font-size:13px;margin-bottom:10px;">
        <strong>${result.companyName || '(nama tidak terbaca dari Info)'}</strong><br>
        Periode: ${s.periodLabel} &middot; Jenis: ${PERIOD_LABELS[s.periodType]} &middot; Tahun: ${s.year}
      </div>
      ${result.warnings.length ? `<div class="ratio-note">${result.warnings.join('<br>')}</div>` : ''}
      <div class="grid grid-2" style="margin-top:12px;">
        <div>
          <div class="badge teal">Neraca</div>
          <table style="margin-top:8px;">
            ${Object.entries(s.neraca).map(([k, v]) => `<tr><td>${k}</td><td class="num">${formatIDR(v)}</td></tr>`).join('') || '<tr><td colspan="2">Tidak ada data terbaca</td></tr>'}
          </table>
        </div>
        <div>
          <div class="badge gold">Laba Rugi</div>
          <table style="margin-top:8px;">
            ${Object.entries(s.labaRugi).map(([k, v]) => `<tr><td>${k}</td><td class="num">${formatIDR(v)}</td></tr>`).join('') || '<tr><td colspan="2">Tidak ada data terbaca</td></tr>'}
          </table>
        </div>
      </div>
      <button class="btn primary" id="confirm-import" style="margin-top:16px;width:100%;justify-content:center;">Simpan ke Sistem</button>
    `;
    document.getElementById('confirm-import').addEventListener('click', confirmImport);
  } catch (err) {
    panel.innerHTML = `<div class="section-title">Pratinjau Data</div><div class="auth-error">${err.message}</div>`;
  }
}

async function confirmImport() {
  const companyId = document.getElementById('import-company').value;
  if (!pendingImport) return;
  await DB.saveStatement(companyId, pendingImport.statement);
  toast('Data laporan keuangan berhasil disimpan', 'success');
  pendingImport = null;
  renderImport();
}

// ---------- Perbandingan ----------
async function renderCompare() {
  const root = document.getElementById('view-root');
  if (state.companies.length === 0) {
    root.innerHTML = emptyState('Belum ada perusahaan', 'Tambahkan perusahaan dan data untuk mulai membandingkan.', 'companies', 'Tambah Perusahaan');
    bindEmptyStateNav(root);
    return;
  }
  root.innerHTML = `
    <div class="section-block">
      <div class="pill-row" id="company-pills">
        ${state.companies.map(c => `<div class="pill ${state.compareCompanyIds.includes(c.id) ? 'active' : ''}" data-id="${c.id}">${c.name}</div>`).join('')}
      </div>
      <div class="pill-row" id="period-pills">
        ${Object.entries(PERIOD_LABELS).map(([k, v]) => `<div class="pill ${state.comparePeriodType === k ? 'active' : ''}" data-period="${k}">${v}</div>`).join('')}
      </div>
    </div>
    <div id="compare-result"><div class="card" style="color:var(--slate);">Pilih minimal satu perusahaan untuk melihat perbandingan.</div></div>
  `;

  document.querySelectorAll('#company-pills .pill').forEach(p => {
    p.addEventListener('click', () => {
      const id = p.dataset.id;
      const idx = state.compareCompanyIds.indexOf(id);
      if (idx >= 0) state.compareCompanyIds.splice(idx, 1); else state.compareCompanyIds.push(id);
      renderCompare();
    });
  });
  document.querySelectorAll('#period-pills .pill').forEach(p => {
    p.addEventListener('click', () => { state.comparePeriodType = p.dataset.period; renderCompare(); });
  });

  if (state.compareCompanyIds.length === 0) return;

  const statements = (await DB.getAllStatementsForCompanies(state.compareCompanyIds))
    .filter(s => s.periodType === state.comparePeriodType)
    .sort((a, b) => a.year - b.year || a.periodIndex - b.periodIndex);

  const resultEl = document.getElementById('compare-result');
  if (statements.length === 0) {
    resultEl.innerHTML = `<div class="card" style="color:var(--slate);">Tidak ada data dengan jenis periode "${PERIOD_LABELS[state.comparePeriodType]}" untuk perusahaan terpilih.</div>`;
    return;
  }

  const periodKeys = [...new Set(statements.map(s => `${s.year}-${s.periodIndex}-${s.periodLabel}`))]
    .sort();

  resultEl.innerHTML = `
    <div class="section-block grid grid-2">
      <div class="chart-box"><div class="section-title">Total Aset per Periode</div><canvas id="cmp-aset"></canvas></div>
      <div class="chart-box"><div class="section-title">Laba Bersih per Periode</div><canvas id="cmp-laba"></canvas></div>
    </div>
    <div class="section-block">
      <div class="section-title">Tabel Perbandingan</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Perusahaan</th><th>Periode</th><th class="num">Total Aset</th><th class="num">Total Kewajiban</th><th class="num">Ekuitas</th><th class="num">Pendapatan</th><th class="num">Laba Bersih</th></tr></thead>
          <tbody>
            ${statements.map(s => `<tr>
              <td>${state.companies.find(c => c.id === s.companyId)?.name}</td>
              <td>${s.periodLabel}</td>
              <td class="num">${formatIDR(s.neraca.totalAset)}</td>
              <td class="num">${formatIDR(s.neraca.totalKewajiban)}</td>
              <td class="num">${formatIDR(s.neraca.totalEkuitas)}</td>
              <td class="num">${formatIDR(s.labaRugi.pendapatan)}</td>
              <td class="num">${formatIDR(s.labaRugi.labaBersih)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const datasetsAset = state.compareCompanyIds.map((id, i) => {
    const company = state.companies.find(c => c.id === id);
    const byPeriod = {};
    statements.filter(s => s.companyId === id).forEach(s => byPeriod[`${s.year}-${s.periodIndex}-${s.periodLabel}`] = s.neraca.totalAset || 0);
    return { label: company.name, data: periodKeys.map(k => byPeriod[k] ?? null), color: palette(i) };
  });
  const datasetsLaba = state.compareCompanyIds.map((id, i) => {
    const company = state.companies.find(c => c.id === id);
    const byPeriod = {};
    statements.filter(s => s.companyId === id).forEach(s => byPeriod[`${s.year}-${s.periodIndex}-${s.periodLabel}`] = s.labaRugi.labaBersih || 0);
    return { label: company.name, data: periodKeys.map(k => byPeriod[k] ?? null), color: palette(i) };
  });

  const labels = periodKeys.map(k => k.split('-').slice(2).join('-'));
  renderLineChart('cmp-aset', labels, datasetsAset);
  renderLineChart('cmp-laba', labels, datasetsLaba);
}

function palette(i) {
  const colors = ['#1B7A6B', '#C08A3E', '#B5453B', '#3B5BA5', '#7A5CC0', '#2D9CDB'];
  return colors[i % colors.length];
}

// ---------- Rasio ----------
async function renderRatios() {
  const root = document.getElementById('view-root');
  if (state.companies.length === 0) {
    root.innerHTML = emptyState('Belum ada perusahaan', 'Tambahkan perusahaan dan data untuk melihat analisis rasio.', 'companies', 'Tambah Perusahaan');
    bindEmptyStateNav(root);
    return;
  }
  if (!state.ratioCompanyId) state.ratioCompanyId = state.companies[0].id;

  root.innerHTML = `
    <div class="section-block" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
      <div class="field" style="margin:0;min-width:220px;">
        <label>Perusahaan</label>
        <select id="ratio-company">
          ${state.companies.map(c => `<option value="${c.id}" ${c.id === state.ratioCompanyId ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="ratio-content"></div>
  `;
  document.getElementById('ratio-company').addEventListener('change', (e) => {
    state.ratioCompanyId = e.target.value;
    renderRatios();
  });

  const statements = (await DB.getStatements(state.ratioCompanyId)).sort((a, b) => a.year - b.year || a.periodIndex - b.periodIndex);
  const content = document.getElementById('ratio-content');
  if (statements.length === 0) {
    content.innerHTML = `<div class="card" style="color:var(--slate);margin-top:16px;">Belum ada data laporan keuangan untuk perusahaan ini.</div>`;
    return;
  }
  const latest = statements[statements.length - 1];
  const ratios = computeRatios(latest);

  function ratioGroup(title, groupKey, badgeClass) {
    return `<div class="section-block">
      <div class="section-title"><span class="badge ${badgeClass}">${title}</span></div>
      <div class="grid grid-3">
        ${Object.entries(ratios[groupKey]).map(([key, val]) => `
          <div class="card kpi-card">
            <div class="kpi-label">${RATIO_LABELS[key].label}</div>
            <div class="kpi-value">${formatRatio(val, RATIO_LABELS[key].fmt)}</div>
            <div class="ratio-note" style="margin-top:2px;">${RATIO_LABELS[key].desc}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  content.innerHTML = `
    <div style="margin:14px 0;color:var(--slate);font-size:13px;">Data periode terbaru: <strong>${latest.periodLabel}</strong></div>
    ${ratioGroup('Likuiditas', 'likuiditas', 'teal')}
    ${ratioGroup('Solvabilitas', 'solvabilitas', 'gold')}
    ${ratioGroup('Profitabilitas', 'profitabilitas', 'danger')}
    <div class="section-block">
      <div class="section-title">Tren Rasio Utama Antar Periode</div>
      <div class="chart-box"><canvas id="ratio-trend"></canvas></div>
    </div>
  `;

  const trendLabels = statements.map(s => s.periodLabel);
  const trendData = statements.map(s => computeRatios(s));
  renderLineChart('ratio-trend', trendLabels, [
    { label: 'Current Ratio', data: trendData.map(r => r.likuiditas.currentRatio), color: '#1B7A6B' },
    { label: 'Debt to Equity', data: trendData.map(r => r.solvabilitas.debtToEquityRatio), color: '#C08A3E' },
    { label: 'Net Profit Margin', data: trendData.map(r => r.profitabilitas.netProfitMargin), color: '#B5453B' }
  ]);
}

// ---------- Pengaturan ----------
function renderSettings() {
  const root = document.getElementById('view-root');
  root.innerHTML = `
    <div class="card" style="max-width:520px;">
      <div class="section-title">Akun</div>
      <p style="font-size:13.5px;color:var(--slate);">Masuk sebagai <strong>${state.user.email}</strong></p>
      <div class="section-title" style="margin-top:20px;">Tentang Integrida</div>
      <p style="font-size:13.5px;color:var(--slate);line-height:1.6;">
        Integrida adalah aplikasi konsolidasi laporan keuangan untuk beberapa perusahaan.
        Data neraca dan laba rugi diimpor dari Excel, kemudian dibandingkan per bulan, triwulan,
        semester, maupun tahunan, lengkap dengan analisis likuiditas, solvabilitas, dan profitabilitas.
        Seluruh data tersimpan pada Firebase project yang Anda konfigurasikan sendiri.
      </p>
      <button class="btn ghost" id="logout-btn-2">Keluar dari akun</button>
    </div>
  `;
  document.getElementById('logout-btn-2').addEventListener('click', () => auth.signOut());
}

// ---------- Charts ----------
function destroyChart(id) {
  if (state.chartInstances[id]) { state.chartInstances[id].destroy(); delete state.chartInstances[id]; }
}

function renderBarChart(canvasId, labels, datasets) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  state.chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: datasets.map(d => ({ label: d.label, data: d.data, backgroundColor: d.color, borderRadius: 5 })) },
    options: { responsive: true, plugins: { legend: { display: datasets.length > 1 } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderLineChart(canvasId, labels, datasets) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  state.chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: datasets.map(d => ({ label: d.label, data: d.data, borderColor: d.color, backgroundColor: d.color, tension: 0.3, spanGaps: true })) },
    options: { responsive: true, plugins: { legend: { display: true } } }
  });
}

// ---------- Bootstrap ----------
auth.onAuthStateChanged(async (user) => {
  if (user) {
    state.user = user;
    renderShell();
    await reloadCompanies();
    setView('dashboard');
  } else {
    state.user = null;
    renderAuthScreen('login');
  }
});
