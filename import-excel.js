// =============================================================
// IMPORT-EXCEL.JS
//
// Neraca, Laba Rugi & Arus Kas diimpor LANGSUNG dari file laporan hasil
// export software akuntansi (Jurnal, Accurate, Zahir, dll) — bukan lagi
// dari template Excel kustom. Setiap perusahaan bisa punya kode & nama
// akun yang berbeda-beda; formatnya dikenali dari STRUKTUR laporan,
// bukan dari daftar nama akun baku.
//
// Format yang dikenali (satu sheet = satu laporan):
//   Baris 1  : Nama Perusahaan
//   Baris 2  : "Neraca" / "Laba Rugi" / "Arus Kas"
//   Baris ...: baris "Tanggal" — satu tanggal (mis. Neraca, laporan "per
//              tanggal") atau rentang "dd/mm/yyyy - dd/mm/yyyy" (Laba
//              Rugi & Arus Kas, laporan satu periode). Bila laporan
//              tidak punya baris "Tanggal" tersendiri (mis. beberapa
//              export Arus Kas), tanggal/rentang di baris ke-3 (persis
//              di bawah baris jenis laporan) dipakai sebagai cadangan.
//   Baris akun: kolom A = kode akun, kolom B = nama akun, kolom C = nilai
//
// Tiga jenis baris akun dikenali dari kolom A:
//   1. Baris TEBAL tanpa kode & tanpa nilai      -> judul seksi
//      (mis. "Aset Lancar", "Aktivitas Operasional").
//   2. Baris berlabel diawali "Total" (atau "Laba Kotor" / "Laba
//      Operasional" / "Laba (Rugi)" / "Saldo kas awal" / "Kas bersih
//      yang diperoleh dari Aktivitas ...", dst) -> baris total/metrik
//      kunci yang dipetakan lewat pola kata kunci (lihat TOTAL_MATCHERS).
//   3. Baris kode akun yang TIDAK menjorok ke kanan, diikuti satu atau
//      lebih baris kode akun yang MENJOROK ke kanan -> baris pertama
//      adalah akun HEADER (nilainya sudah berupa akumulasi dari
//      akun-akun di bawahnya / sub-akun), baris menjorok di bawahnya
//      adalah SUB-AKUN (akun rincian yang sungguhan punya transaksi).
//      Kode akun yang tidak diikuti baris menjorok = akun berdiri
//      sendiri (bukan header). Pola ini dipakai pada Neraca; pada Arus
//      Kas setiap baris akun sudah rincian (tidak berjenjang) sehingga
//      cukup dibaca apa adanya per kategori.
// Karena nilai akun header sudah merupakan akumulasi sub-akunnya,
// sub-akun TIDAK dijumlahkan ulang — supaya tidak dobel hitung.
// =============================================================

function normalizeKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Dipertahankan untuk kompatibilitas: dipakai bila suatu saat ada jenis
// data impor lain yang formatnya label,nilai dua kolom sederhana (bukan
// laporan berjenjang akun seperti Neraca/Laba Rugi/Arus Kas).
function sheetToKeyValue(sheet, dictionary) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const out = {};
  const unrecognized = [];
  rows.forEach(row => {
    if (!row || row.length < 2) return;
    const label = normalizeKey(row[0]);
    if (!label) return;
    const value = Number(String(row[1]).toString().replace(/[^0-9.-]/g, '')) || 0;
    if (dictionary[label]) {
      out[dictionary[label]] = value;
    } else if (row[0] && row[1] !== '') {
      unrecognized.push(row[0]);
    }
  });
  return { data: out, unrecognized };
}

// Buku Besar: sheet opsional & bebas formatnya (bukan daftar akun baku).
// Setiap baris = satu akun buku besar milik perusahaan (kode, nama, saldo),
// disimpan apa adanya sebagai referensi rincian — tidak dipakai dalam
// perhitungan rasio otomatis.
function sheetToLedgerRows(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const out = [];
  rows.forEach((row, i) => {
    if (i === 0) return; // baris pertama adalah header (Kode Akun | Nama Akun | Saldo)
    if (!row || row.length < 2) return;
    const kode = String(row[0] || '').trim();
    const nama = String(row[1] || '').trim();
    if (!nama) return;
    const saldo = Number(String(row[2] ?? '').toString().replace(/[^0-9.-]/g, '')) || 0;
    out.push({ kode, nama, saldo });
  });
  return out;
}

function readInfoSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const info = {};
  rows.forEach(row => {
    const key = normalizeKey(row[0]);
    const val = row[1];
    if (key.includes('perusahaan')) info.companyName = String(val).trim();
    if (key.includes('tahun')) info.year = parseInt(val, 10);
    if (key.includes('jenis periode') || key.includes('periode')) info.periodTypeRaw = normalizeKey(val);
    if (key.includes('label')) info.periodLabel = String(val).trim();
  });
  return info;
}

const PERIOD_TYPE_MAP = {
  'bulanan': 'bulanan',
  'triwulan': 'triwulan',
  'kuartal': 'triwulan',
  'semester': 'semester',
  'tahunan': 'tahunan'
};

function inferPeriodIndex(periodType, periodLabel) {
  const label = normalizeKey(periodLabel);
  if (periodType === 'tahunan') return 1;
  const romanMatch = label.match(/\b(i|ii|iii|iv)\b/);
  const roman = { i: 1, ii: 2, iii: 3, iv: 4 };
  if (romanMatch) return roman[romanMatch[1]];
  const numMatch = label.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  const bulanList = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const idxBulan = bulanList.findIndex(b => label.includes(b));
  if (idxBulan >= 0) return idxBulan + 1;
  return 1;
}

// ---------- Parser baru: laporan hasil export software akuntansi ----------

const BULAN_ID = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];

function cap(s) { return s ? s.replace(/\b\w/g, c => c.toUpperCase()) : s; }

function toNumberOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

// Menghitung lebar indentasi (jumlah spasi/nbsp) di depan teks kolom A —
// inilah penanda apakah sebuah baris akun adalah sub-akun (menjorok) atau
// bukan.
function leadingIndentWidth(raw) {
  const m = String(raw || '').match(/^[ \t\u00A0]+/);
  return m ? m[0].length : 0;
}

function parseIndoDate(str) {
  const m = String(str || '').trim().match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  return { day, month, year };
}

function isLastDayOfMonth(d) {
  return d.day === new Date(d.year, d.month, 0).getDate();
}

// Menentukan year/periodType/periodIndex/periodLabel dari teks tanggal
// pada laporan: satu tanggal ("per tanggal", umum pada Neraca) atau
// rentang "dd/mm/yyyy - dd/mm/yyyy" (umum pada Laba Rugi).
function derivePeriodFromDateText(dateText) {
  const parts = String(dateText || '').split(/\s*-\s*/).filter(Boolean);
  const start = parseIndoDate(parts[0]);
  const end = parts.length > 1 ? parseIndoDate(parts[1]) : start;
  if (!start || !end) return null;

  const monthSpan = (end.year - start.year) * 12 + (end.month - start.month) + 1;
  const isFullMonthsRange = start.day === 1 && isLastDayOfMonth(end);

  if (isFullMonthsRange && start.month === 1 && end.month === 12 && end.year === start.year) {
    return { year: start.year, periodType: 'tahunan', periodIndex: 1, periodLabel: `Tahun ${start.year}` };
  }
  if (isFullMonthsRange && monthSpan === 1) {
    return { year: start.year, periodType: 'bulanan', periodIndex: start.month, periodLabel: `${cap(BULAN_ID[start.month - 1])} ${start.year}` };
  }
  if (isFullMonthsRange && monthSpan === 3 && start.month % 3 === 1) {
    const q = Math.ceil(start.month / 3);
    return { year: start.year, periodType: 'triwulan', periodIndex: q, periodLabel: `Triwulan ${['I', 'II', 'III', 'IV'][q - 1]} ${start.year}` };
  }
  if (isFullMonthsRange && monthSpan === 6 && (start.month === 1 || start.month === 7)) {
    const s = start.month === 1 ? 1 : 2;
    return { year: start.year, periodType: 'semester', periodIndex: s, periodLabel: `Semester ${s === 1 ? 'I' : 'II'} ${start.year}` };
  }
  // Titik waktu tunggal (mis. Neraca "per tanggal X") -> dianggap mewakili
  // bulan berjalan pada tanggal tersebut.
  return { year: end.year, periodType: 'bulanan', periodIndex: end.month, periodLabel: `${cap(BULAN_ID[end.month - 1])} ${end.year}` };
}

// Kata kunci yang dipakai mengenali baris TOTAL / metrik kunci pada
// laporan, supaya tetap terbaca meski nama & kode akun berbeda-beda
// antar perusahaan / software akuntansi.
const TOTAL_MATCHERS = {
  neraca: {
    totalAsetLancar: l => /^total\b.*aset lancar$/.test(l),
    totalAset: l => l === 'total aset',
    totalKewajibanLancar: l => /^total\b.*(kewajiban|liabilitas) jangka pendek$/.test(l) || /^total\b.*(kewajiban|liabilitas) lancar$/.test(l),
    totalKewajiban: l => l === 'total kewajiban' || l === 'total liabilitas',
    totalEkuitas: l => /^total\b.*(ekuitas|modal)/.test(l) && !/jangka/.test(l)
  },
  labaRugi: {
    pendapatan: l => l === 'total dari pendapatan' || l === 'total pendapatan',
    labaKotor: l => l === 'laba kotor',
    labaOperasional: l => l === 'laba operasional' || l === 'laba usaha',
    labaBersih: l => l === 'laba (rugi)' || l === 'laba bersih' || l === 'laba/rugi bersih'
  },
  arusKas: {
    kasAwal: l => /^saldo kas awal\b/.test(l) || l === 'kas awal periode',
    arusKasOperasi: l => /kas bersih/.test(l) && /aktivitas operasional/.test(l),
    arusKasInvestasi: l => /kas bersih/.test(l) && /aktivitas investasi/.test(l),
    arusKasPendanaan: l => /kas bersih/.test(l) && /aktivitas pendanaan/.test(l),
    kenaikanKasBersih: l => /^kenaikan\b.*kas/.test(l),
    kasAkhir: l => /^saldo kas akhir\b/.test(l) || l === 'kas akhir periode'
  }
};

// Label baris "jenis laporan" (baris ke-2) yang dikenali per statementKey.
const REPORT_TYPE_LABELS = { neraca: 'neraca', labaRugi: 'laba rugi', arusKas: 'arus kas' };

const CASH_NAME_RE = /\b(kas|bank|cash)\b/i;
const INVENTORY_NAME_RE = /\b(persediaan|inventory|stok|stock)\b/i;

// ---------- Parser Buku Besar: export general ledger asli ----------
// Format yang dikenali (hasil export software akuntansi seperti QuickBooks):
//   Baris 1 : Nama Perusahaan
//   Baris 2 : "Buku Besar"
//   Baris 3 : rentang tanggal "dd/mm/yyyy - dd/mm/yyyy"
//   Baris header kolom: "Nama Akun / Tanggal | Transaksi | Nomor |
//   Keterangan | Debit | Kredit | Saldo | Tags"
//   Lalu per akun: baris nama akun (hanya kolom A terisi), baris "Saldo
//   Awal" (kolom B, nilai di kolom G), baris-baris transaksi, dan baris
//   "Ending Balance" (kolom D berisi "(nama akun) | Ending Balance", total
//   debit/kredit di kolom E/F, saldo akhir di kolom G).
//
// Neraca & Laba Rugi diturunkan OTOMATIS dari akun-akun ini: Neraca
// memakai SALDO AKHIR per akun (posisi akhir periode), Laba Rugi memakai
// MUTASI periode (saldo akhir - saldo awal) supaya hanya aktivitas
// periode berjalan yang terhitung (bukan akumulasi sejak akun dibuka).
// Kategori akun (Aset/Kewajiban/Ekuitas/Pendapatan/Beban) dikenali dari
// digit pertama KODE AKUN sebelum tanda "-" (1=Aset, 2=Kewajiban,
// 3=Ekuitas, 4=Pendapatan, 5 ke atas=Beban) — asumsi konvensi penomoran
// akun yang umum dipakai; bisa disesuaikan bila konvensi perusahaan Anda
// berbeda. Kata kunci pada nama akun mempertajam sub-kategori (mis.
// "tetap"/"penyusutan" -> aset tidak lancar, "jangka panjang" -> kewajiban
// jangka panjang, "hpp"/"pokok penjualan" -> harga pokok penjualan,
// "pajak" -> pajak penghasilan, "bunga"/"lain-lain" -> beban/pendapatan
// di luar operasional utama). Akun dengan kode non-angka di luar 1-9
// dilewati & dilaporkan sebagai peringatan.

function parseLedgerAccountLabel(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/^\(([^)]+)\)\s*(.*)$/); // "(1-10001) Kas" -> code "1-10001", name "Kas"
  if (m) return { code: m[1].trim(), name: m[2].trim() || text };
  return { code: '', name: text };
}

function classifyLedgerAccount(code, name) {
  const n = normalizeKey(name);
  const prefixStr = String(code || '').split('-')[0].trim();
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix)) return { group: null, bucket: null, field: null };

  if (prefix === 1) {
    const nonCurrent = /(aset tetap|tidak lancar|jangka panjang|penyusutan|akumulasi)/.test(n);
    if (CASH_NAME_RE.test(n)) return { group: 'aset', bucket: nonCurrent ? 'tidakLancar' : 'lancar', field: 'kasSetaraKas' };
    if (INVENTORY_NAME_RE.test(n)) return { group: 'aset', bucket: nonCurrent ? 'tidakLancar' : 'lancar', field: 'persediaan' };
    return { group: 'aset', bucket: nonCurrent ? 'tidakLancar' : 'lancar', field: null };
  }
  if (prefix === 2) {
    const nonCurrent = /jangka panjang/.test(n);
    return { group: 'kewajiban', bucket: nonCurrent ? 'jangkaPanjang' : 'lancar', field: null };
  }
  if (prefix === 3) return { group: 'ekuitas', bucket: null, field: null };
  if (prefix === 4) {
    const lainnya = /(bunga|lain[- ]?lain|lainnya)/.test(n);
    return { group: 'pendapatan', bucket: lainnya ? 'lainnya' : 'inti', field: null };
  }
  if (prefix >= 5) {
    // Semua kode akun 5 ke atas dianggap Beban — sub-kategori (HPP, Pajak,
    // Beban Lain-lain di luar operasional, atau Beban Operasional) dikenali
    // dari kata kunci pada nama akun, bukan dari nilai digit prefix-nya,
    // supaya tetap cocok walau perusahaan memakai kode 5/6/7/8/9/... untuk
    // kelompok beban yang berbeda-beda.
    const hpp = /(hpp|harga pokok penjualan)/.test(n);
    const pajak = /pajak/.test(n);
    const nonOperating = /(bunga|lain[- ]?lain|lainnya)/.test(n);
    let bucket = 'operasional';
    if (hpp) bucket = 'hpp';
    else if (pajak) bucket = 'pajak';
    else if (nonOperating) bucket = 'lainnya';
    return { group: 'beban', bucket, field: null };
  }
  return { group: null, bucket: null, field: null };
}

/**
 * Mengubah daftar akun Buku Besar menjadi objek Neraca & Laba Rugi siap
 * pakai untuk perhitungan rasio, memakai kategori dari
 * classifyLedgerAccount di atas.
 */
function deriveStatementsFromLedgerAccounts(accounts) {
  const neraca = {
    kasSetaraKas: 0, persediaan: 0,
    totalAsetLancar: 0, totalAsetTidakLancar: 0, totalAset: 0,
    totalKewajibanLancar: 0, totalKewajibanJangkaPanjang: 0, totalKewajiban: 0,
    totalEkuitas: 0
  };
  const labaRugi = {
    pendapatan: 0, pendapatanLainnya: 0, hpp: 0, labaKotor: 0,
    bebanOperasional: 0, labaOperasional: 0, bebanLainnya: 0,
    labaSebelumPajak: 0, pajakPenghasilan: 0, labaBersih: 0
  };
  const unrecognized = [];

  accounts.forEach(a => {
    const c = classifyLedgerAccount(a.code, a.name);
    const akhir = a.saldoAkhir || 0;
    const mutasi = (a.saldoAkhir || 0) - (a.saldoAwal || 0);

    if (c.group === 'aset') {
      if (c.field === 'kasSetaraKas') neraca.kasSetaraKas += akhir;
      if (c.field === 'persediaan') neraca.persediaan += akhir;
      if (c.bucket === 'lancar') neraca.totalAsetLancar += akhir; else neraca.totalAsetTidakLancar += akhir;
    } else if (c.group === 'kewajiban') {
      if (c.bucket === 'lancar') neraca.totalKewajibanLancar += akhir; else neraca.totalKewajibanJangkaPanjang += akhir;
    } else if (c.group === 'ekuitas') {
      neraca.totalEkuitas += akhir;
    } else if (c.group === 'pendapatan') {
      if (c.bucket === 'inti') labaRugi.pendapatan += mutasi; else labaRugi.pendapatanLainnya += mutasi;
    } else if (c.group === 'beban') {
      if (c.bucket === 'hpp') labaRugi.hpp += mutasi;
      else if (c.bucket === 'operasional') labaRugi.bebanOperasional += mutasi;
      else if (c.bucket === 'lainnya') labaRugi.bebanLainnya += mutasi;
      else if (c.bucket === 'pajak') labaRugi.pajakPenghasilan += mutasi;
    } else {
      unrecognized.push(`${a.code ? '(' + a.code + ') ' : ''}${a.name}`);
    }
  });

  neraca.totalAset = neraca.totalAsetLancar + neraca.totalAsetTidakLancar;
  neraca.totalKewajiban = neraca.totalKewajibanLancar + neraca.totalKewajibanJangkaPanjang;

  labaRugi.labaKotor = labaRugi.pendapatan - labaRugi.hpp;
  labaRugi.labaOperasional = labaRugi.labaKotor - labaRugi.bebanOperasional;
  labaRugi.labaSebelumPajak = labaRugi.labaOperasional + labaRugi.pendapatanLainnya - labaRugi.bebanLainnya;
  labaRugi.labaBersih = labaRugi.labaSebelumPajak - labaRugi.pajakPenghasilan;

  const warnings = [];
  if (unrecognized.length) {
    warnings.push(`Kode akun berikut tidak dikenali kategorinya sehingga dilewati dari Neraca/Laba Rugi (kode akun harus diawali 1-8): ${unrecognized.join(', ')}.`);
  }

  return { neraca, labaRugi, warnings };
}

/**
 * Membaca satu sheet Buku Besar hasil export software akuntansi (format
 * per akun: baris nama akun, baris "Saldo Awal", baris-baris transaksi,
 * baris "Ending Balance") dan mengembalikan nama perusahaan, periode,
 * daftar akun mentah (untuk referensi/audit), serta Neraca & Laba Rugi
 * yang sudah diturunkan otomatis.
 */
function parseBukuBesarSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let companyName = '';
  let dateText = '';
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const label = normalizeKey(rows[i][0]);
    if (i === 0 && rows[i][0]) companyName = String(rows[i][0]).trim();
    if (!dateText && parseIndoDate(String(rows[i][0]).split(/\s*-\s*/)[0])) dateText = String(rows[i][0]).trim();
    if (label === 'nama akun / tanggal') { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) {
    throw new Error('File tidak dikenali sebagai Buku Besar. Pastikan file adalah hasil export Buku Besar apa adanya (berkolom "Nama Akun / Tanggal, Transaksi, Nomor, Keterangan, Debit, Kredit, Saldo").');
  }
  if (!dateText) {
    throw new Error('Tidak menemukan rentang tanggal periode pada Buku Besar.');
  }
  const period = derivePeriodFromDateText(dateText);
  if (!period) {
    throw new Error(`Format tanggal "${dateText}" pada Buku Besar tidak dikenali.`);
  }

  const accounts = [];
  let current = null;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const a = row[0], b = row[1], d = row[3], g = row[6];
    const isBlank = (v) => v === '' || v === null || v === undefined;

    if (!isBlank(a) && isBlank(b) && isBlank(row[2]) && isBlank(d) && isBlank(row[4]) && isBlank(row[5]) && isBlank(g)) {
      // Baris nama akun -> mulai akun baru
      const { code, name } = parseLedgerAccountLabel(a);
      current = { code, name, saldoAwal: null, saldoAkhir: null };
      accounts.push(current);
      continue;
    }
    if (!current) continue;
    if (isBlank(a) && !isBlank(d) && normalizeKey(d).includes('ending balance')) {
      current.saldoAkhir = toNumberOrNull(g) || 0;
      continue;
    }
    if (!isBlank(b) && normalizeKey(b) === 'saldo awal') {
      current.saldoAwal = toNumberOrNull(g) || 0;
    }
  }
  // Akun tanpa baris "Saldo Awal" eksplisit (baru dibuka periode ini) -> 0.
  accounts.forEach(acc => {
    if (acc.saldoAwal === null) acc.saldoAwal = 0;
    if (acc.saldoAkhir === null) acc.saldoAkhir = acc.saldoAwal;
  });

  const derived = deriveStatementsFromLedgerAccounts(accounts);

  return {
    companyName,
    period,
    accounts,
    neraca: derived.neraca,
    labaRugi: derived.labaRugi,
    warnings: derived.warnings
  };
}

/**
 * Membaca satu sheet laporan (Neraca atau Laba Rugi) hasil export
 * software akuntansi: mengenali nama perusahaan, tanggal/periode, judul
 * seksi, akun header/sub-akun (dari indentasi kolom A), dan baris total —
 * lalu memetakannya ke field standar yang dipakai perhitungan rasio.
 */
function parseAccountingReportSheet(sheet, statementKey) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const expected = REPORT_TYPE_LABELS[statementKey] || statementKey;
  const knownLabels = Object.values(REPORT_TYPE_LABELS);

  let companyName = '';
  let reportTypeText = '';
  let dateText = '';
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const label = normalizeKey(rows[i][0]);
    if (i === 0 && rows[i][0]) companyName = String(rows[i][0]).trim();
    if (!reportTypeText && knownLabels.includes(label)) reportTypeText = label;
    if (label === 'tanggal') {
      const vals = rows[i].slice(1).filter(v => v !== '' && v !== null && v !== undefined);
      if (vals.length) dateText = String(vals[vals.length - 1]).trim();
    }
  }
  // Sebagian laporan (mis. Arus Kas) tidak punya baris berlabel "Tanggal"
  // — tanggal/rentangnya tertulis langsung di baris ke-3 (persis di bawah
  // baris jenis laporan). Dipakai sebagai cadangan bila baris "Tanggal"
  // tidak ditemukan.
  if (!dateText && rows[2] && rows[2][0] && parseIndoDate(String(rows[2][0]).split(/\s*-\s*/)[0])) {
    dateText = String(rows[2][0]).trim();
  }
  if (reportTypeText && reportTypeText !== expected) {
    throw new Error(`File ini terbaca sebagai laporan "${cap(reportTypeText)}", bukan "${cap(expected)}". Pastikan Anda mengunggah laporan yang sesuai jenis data yang dipilih.`);
  }
  if (!dateText) {
    throw new Error('Tidak menemukan tanggal/periode pada laporan. Pastikan file adalah hasil export laporan apa adanya (strukturnya tidak diubah).');
  }
  const period = derivePeriodFromDateText(dateText);
  if (!period) {
    throw new Error(`Format tanggal "${dateText}" pada laporan tidak dikenali.`);
  }

  // Bangun daftar baris akun rata (flat) beserta level indentasinya.
  const entries = [];
  rows.forEach(row => {
    const rawCode = row[0];
    const name = row[1] !== undefined ? String(row[1]).trim() : '';
    const label = normalizeKey(rawCode);
    if (!label && !name) return;
    if (label === 'tanggal' || label === '(dalam idr)' || label === expected) return;
    entries.push({
      label,
      name,
      value: toNumberOrNull(row[2]),
      indent: leadingIndentWidth(rawCode),
      hasCode: /[0-9]/.test(label) && !!name
    });
  });

  // Tandai akun header: indent 0, diikuti baris akun dengan indent > 0.
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.hasCode || e.indent > 0) continue;
    const next = entries[i + 1];
    e.isHeaderAccount = !!(next && next.hasCode && next.indent > e.indent);
  }

  const data = {};
  const matchers = TOTAL_MATCHERS[statementKey] || {};
  entries.forEach(e => {
    if (e.value === null) return;
    for (const field of Object.keys(matchers)) {
      if (!(field in data) && matchers[field](e.label)) data[field] = e.value;
    }
    // Kas/Bank & Persediaan (Neraca): hanya akun tingkat atas (indent 0)
    // yang diambil — bila akun itu adalah akun header, sub-akun di
    // bawahnya sudah termasuk di dalam nilainya (tidak dijumlah lagi).
    if (statementKey === 'neraca' && e.hasCode && e.indent === 0) {
      if (CASH_NAME_RE.test(e.name)) data.kasSetaraKas = (data.kasSetaraKas || 0) + e.value;
      else if (INVENTORY_NAME_RE.test(e.name) && !('persediaan' in data)) data.persediaan = e.value;
    }
  });

  const warnings = [];
  const missingTotals = Object.keys(matchers).filter(f => !(f in data));
  if (missingTotals.length) {
    warnings.push(`Baris berikut tidak ditemukan pada laporan sehingga sebagian rasio mungkin tidak akurat: ${missingTotals.join(', ')}.`);
  }
  if (statementKey === 'neraca' && !('kasSetaraKas' in data)) {
    warnings.push('Tidak menemukan akun kas/bank pada Aset Lancar — Cash Ratio mungkin tidak akurat.');
  }

  return { companyName, period, data, warnings };
}

// Registri jenis data yang bisa diimpor. Setiap jenis punya file Excel
// SENDIRI (bukan lagi digabung satu file banyak sheet) — jadi Anda bisa
// mengimpor Neraca hari ini, lalu Laba Rugi menyusul di lain waktu, untuk
// periode yang sama. Data akan digabung (merge) di dokumen periode yang sama.
const IMPORT_TYPES = {
  neraca: {
    label: 'Neraca',
    badge: 'teal',
    statementKey: 'neraca',
    mode: 'accountingReport'
  },
  labaRugi: {
    label: 'Laba Rugi',
    badge: 'gold',
    statementKey: 'labaRugi',
    mode: 'accountingReport'
  },
  arusKas: {
    label: 'Arus Kas',
    badge: 'blue',
    statementKey: 'arusKas',
    mode: 'accountingReport'
  },
  bukuBesar: {
    label: 'Buku Besar',
    badge: 'purple',
    statementKey: 'bukuBesar',
    mode: 'bukuBesarLedger'
  }
};

/**
 * Parse satu file Excel (ArrayBuffer) yang berisi SATU jenis data saja
 * (Neraca, Laba Rugi, Arus Kas, atau Buku Besar — sesuai typeKey).
 * Melempar Error dengan pesan berbahasa Indonesia jika format tidak sesuai.
 */
function parseSingleTypeExcel(arrayBuffer, typeKey) {
  const type = IMPORT_TYPES[typeKey];
  if (!type) throw new Error('Jenis data impor tidak dikenali.');

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // ---- Neraca & Laba Rugi: laporan hasil export software akuntansi ----
  if (type.mode === 'accountingReport') {
    let lastError = null;
    for (const sheetName of workbook.SheetNames) {
      try {
        const parsed = parseAccountingReportSheet(workbook.Sheets[sheetName], type.statementKey);
        return {
          typeKey,
          typeLabel: type.label,
          badge: type.badge,
          statementKey: type.statementKey,
          companyName: parsed.companyName,
          period: parsed.period,
          data: parsed.data,
          warnings: parsed.warnings
        };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error(`File tidak dapat dibaca sebagai laporan ${type.label}.`);
  }

  // ---- Buku Besar: langsung dari hasil export software akuntansi ----
  if (type.mode === 'bukuBesarLedger') {
    let lastError = null;
    for (const sheetName of workbook.SheetNames) {
      try {
        const parsed = parseBukuBesarSheet(workbook.Sheets[sheetName]);
        return {
          typeKey,
          typeLabel: type.label,
          badge: type.badge,
          statementKey: type.statementKey,
          companyName: parsed.companyName,
          period: parsed.period,
          data: { ledger: parsed.accounts, neraca: parsed.neraca, labaRugi: parsed.labaRugi },
          warnings: parsed.warnings
        };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('File tidak dapat dibaca sebagai Buku Besar.');
  }

  // ---- Arus Kas: masih memakai template Info + sheet khusus ----
  const sheetNames = workbook.SheetNames.map(n => n.toLowerCase());
  const infoName = workbook.SheetNames[sheetNames.findIndex(n => n.includes('info'))];
  const dataName = workbook.SheetNames[sheetNames.findIndex(n => type.sheetMatch(n))];

  if (!dataName) {
    throw new Error(`File harus memiliki sheet "${type.label}". Gunakan template impor ${type.label} yang disediakan (bukan file jenis lain).`);
  }

  const info = infoName ? readInfoSheet(workbook.Sheets[infoName]) : {};
  if (!info.year) {
    throw new Error('Sheet "Info" harus mencantumkan baris "Tahun" dengan nilai tahun laporan (contoh: 2025).');
  }
  const periodType = PERIOD_TYPE_MAP[info.periodTypeRaw] || 'tahunan';
  const periodIndex = inferPeriodIndex(periodType, info.periodLabel || '');

  let data, warnings = [];
  if (type.mode === 'ledger') {
    data = sheetToLedgerRows(workbook.Sheets[dataName]);
  } else {
    const result = sheetToKeyValue(workbook.Sheets[dataName], type.dictionary);
    data = result.data;
    warnings = result.unrecognized.map(a => `Akun tidak dikenali dan dilewati: "${a}"`);
  }

  return {
    typeKey,
    typeLabel: type.label,
    badge: type.badge,
    statementKey: type.statementKey,
    companyName: info.companyName || '',
    period: {
      year: info.year,
      periodType,
      periodIndex,
      periodLabel: info.periodLabel || `${periodType} ${periodIndex} ${info.year}`
    },
    data,
    warnings
  };
}


