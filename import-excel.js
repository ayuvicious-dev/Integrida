// =============================================================
// IMPORT-EXCEL.JS
// Membaca file .xlsx dengan 3 sheet: Info, Neraca, Laba Rugi
// dan menormalkannya menjadi objek statement siap simpan ke Firestore.
// =============================================================

// Kunci akun standar yang dikenali sistem (nama akun di Excel dicocokkan
// tanpa memandang huruf besar/kecil & spasi berlebih)
const AKUN_NERACA = {
  // Aset Lancar
  'piutang usaha': 'piutangUsaha',
  'piutang lain': 'piutangLain',
  'biaya dibayar di muka': 'biayaDibayarDiMuka',
  'pajak dibayar di muka': 'pajakDibayarDiMuka',
  'sewa dibayar di muka': 'sewaDibayarDiMuka',
  'total aset lancar': 'totalAsetLancar',
  // Aset Tidak Lancar
  'aset tetap': 'asetTetap',
  'aset tak berwujud': 'asetTakBerwujud',
  'investasi jangka panjang': 'investasiJangkaPanjang',
  'total aset tidak lancar': 'totalAsetTidakLancar',
  'total aset': 'totalAset',
  // Liabilitas (satu kategori, tidak dipisah lancar/jangka panjang)
  'hutang usaha': 'hutangUsaha',
  'hutang pendanaan': 'hutangPendanaan',
  'hutang direksi': 'hutangDireksi',
  'hutang aset': 'hutangAset',
  'total liabilitas': 'totalKewajiban',
  // Ekuitas
  'modal': 'modal',
  'total ekuitas': 'totalEkuitas'
};

const AKUN_LABA_RUGI = {
  'pendapatan': 'pendapatan',
  'harga pokok penjualan': 'hpp',
  'laba kotor': 'labaKotor',
  'beban operasional': 'bebanOperasional',
  'laba operasional': 'labaOperasional',
  'pendapatan lainnya': 'pendapatanLainnya',
  'beban lainnya': 'bebanLainnya',
  'laba sebelum pajak': 'labaSebelumPajak',
  'pajak penghasilan': 'pajakPenghasilan',
  'laba bersih': 'labaBersih'
};

function normalizeKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

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

/**
 * Parse sebuah file Excel (ArrayBuffer) menjadi objek statement.
 * Melempar Error dengan pesan berbahasa Indonesia jika format tidak sesuai.
 */
function parseFinancialExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames.map(n => n.toLowerCase());

  const infoName = workbook.SheetNames[sheetNames.findIndex(n => n.includes('info'))];
  const neracaName = workbook.SheetNames[sheetNames.findIndex(n => n.includes('neraca'))];
  const labaRugiName = workbook.SheetNames[sheetNames.findIndex(n => n.includes('laba'))];

  if (!neracaName || !labaRugiName) {
    throw new Error('File harus memiliki sheet "Neraca" dan "Laba Rugi". Gunakan template yang disediakan.');
  }

  const info = infoName ? readInfoSheet(workbook.Sheets[infoName]) : {};
  const neracaResult = sheetToKeyValue(workbook.Sheets[neracaName], AKUN_NERACA);
  const labaRugiResult = sheetToKeyValue(workbook.Sheets[labaRugiName], AKUN_LABA_RUGI);

  const periodType = PERIOD_TYPE_MAP[info.periodTypeRaw] || 'tahunan';
  const periodIndex = inferPeriodIndex(periodType, info.periodLabel || '');

  if (!info.year) {
    throw new Error('Sheet "Info" harus mencantumkan baris "Tahun" dengan nilai tahun laporan (contoh: 2025).');
  }

  return {
    companyName: info.companyName || '',
    statement: {
      year: info.year,
      periodType,
      periodIndex,
      periodLabel: info.periodLabel || `${periodType} ${periodIndex} ${info.year}`,
      neraca: neracaResult.data,
      labaRugi: labaRugiResult.data
    },
    warnings: [...neracaResult.unrecognized, ...labaRugiResult.unrecognized]
      .map(a => `Akun tidak dikenali dan dilewati: "${a}"`)
  };
}
