// =============================================================
// IMPORT-EXCEL.JS
// Membaca file .xlsx dengan 3 sheet: Info, Neraca, Laba Rugi
// dan menormalkannya menjadi objek statement siap simpan ke Firestore.
// =============================================================

// Kunci akun standar yang dikenali sistem (nama akun di Excel dicocokkan
// tanpa memandang huruf besar/kecil & spasi berlebih)
const AKUN_NERACA = {
  'kas dan setara kas': 'kasSetaraKas',
  'piutang usaha': 'piutangUsaha',
  'persediaan': 'persediaan',
  'aset lancar lainnya': 'asetLancarLainnya',
  'total aset lancar': 'totalAsetLancar',
  'aset tetap': 'asetTetap',
  'aset tidak lancar lainnya': 'asetTidakLancarLainnya',
  'total aset tidak lancar': 'totalAsetTidakLancar',
  'total aset': 'totalAset',
  'utang usaha': 'utangUsaha',
  'utang jangka pendek lainnya': 'utangJangkaPendekLainnya',
  'total kewajiban lancar': 'totalKewajibanLancar',
  'utang jangka panjang': 'utangJangkaPanjang',
  'total kewajiban jangka panjang': 'totalKewajibanJangkaPanjang',
  'total kewajiban': 'totalKewajiban',
  'modal saham': 'modalSaham',
  'laba ditahan': 'labaDitahan',
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

// =============================================================
// BUKU BESAR -> label klasifikasi standar (harus cocok dengan nama
// akun di AKUN_NERACA di atas) & pengelompokan ke bagian Neraca.
// Label di kolom "Klasifikasi" pada Excel Buku Besar dicocokkan ke
// sini tanpa memandang huruf besar/kecil & spasi berlebih.
// =============================================================
const KLASIFIKASI_LABEL = {
  kasSetaraKas: 'Kas Setara Kas',
  piutangUsaha: 'Piutang Usaha',
  persediaan: 'Persediaan',
  asetLancarLainnya: 'Aset Lancar Lainnya',
  asetTetap: 'Aset Tetap',
  asetTidakLancarLainnya: 'Aset Tidak Lancar Lainnya',
  utangUsaha: 'Utang Usaha',
  utangJangkaPendekLainnya: 'Utang Jangka Pendek Lainnya',
  utangJangkaPanjang: 'Utang Jangka Panjang',
  modalSaham: 'Modal Saham',
  labaDitahan: 'Laba Ditahan'
};

const KLASIFIKASI_KE_GROUP = {
  kasSetaraKas: 'ASET LANCAR',
  piutangUsaha: 'ASET LANCAR',
  persediaan: 'ASET LANCAR',
  asetLancarLainnya: 'ASET LANCAR',
  asetTetap: 'ASET TIDAK LANCAR',
  asetTidakLancarLainnya: 'ASET TIDAK LANCAR',
  utangUsaha: 'LIABILITAS LANCAR',
  utangJangkaPendekLainnya: 'LIABILITAS LANCAR',
  utangJangkaPanjang: 'LIABILITAS JANGKA PANJANG',
  modalSaham: 'EKUITAS',
  labaDitahan: 'EKUITAS'
};

const GROUP_ORDER = ['ASET LANCAR', 'ASET TIDAK LANCAR', 'LIABILITAS LANCAR', 'LIABILITAS JANGKA PANJANG', 'EKUITAS', 'LAINNYA'];

function resolveKlasifikasiKey(label) {
  const norm = normalizeKey(label);
  const found = Object.entries(KLASIFIKASI_LABEL).find(([, v]) => normalizeKey(v) === norm);
  return found ? found[0] : null;
}

function formatTanggal(v) {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v)) return v.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  return String(v).trim();
}

function sumGroup(klasifikasiMap, groupName) {
  return Object.values(klasifikasiMap)
    .filter(k => k.group === groupName)
    .reduce((sum, k) => sum + k.totalSaldo, 0);
}

/**
 * Parse file Excel Buku Besar (ArrayBuffer) menjadi struktur pohon:
 * grup (bagian Neraca) -> klasifikasi akun -> sub-akun -> daftar transaksi.
 * Sheet yang dibaca: sheet pertama yang namanya mengandung "buku besar",
 * atau sheet pertama jika tidak ditemukan.
 *
 * Kolom yang wajib ada di baris header (baris pertama):
 * Klasifikasi | Kode Akun | Nama Akun | Tanggal | Keterangan | Debit | Kredit
 */
function parseBukuBesarExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames.map(n => n.toLowerCase());
  const bbIdx = sheetNames.findIndex(n => n.includes('buku besar'));
  const bbName = workbook.SheetNames[bbIdx >= 0 ? bbIdx : 0];

  if (!bbName) {
    throw new Error('File Excel tidak memiliki sheet yang bisa dibaca sebagai Buku Besar.');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[bbName], { header: 1, defval: '' });
  if (rows.length < 2) {
    throw new Error('Sheet Buku Besar kosong atau tidak memiliki baris data.');
  }

  const header = rows[0].map(h => normalizeKey(h));
  const idx = {
    klasifikasi: header.indexOf('klasifikasi'),
    kode: header.indexOf('kode akun'),
    nama: header.indexOf('nama akun'),
    tanggal: header.indexOf('tanggal'),
    keterangan: header.indexOf('keterangan'),
    debit: header.indexOf('debit'),
    kredit: header.indexOf('kredit')
  };
  const wajib = ['klasifikasi', 'kode', 'nama', 'debit', 'kredit'];
  if (wajib.some(k => idx[k] === -1)) {
    throw new Error('Sheet Buku Besar harus memiliki kolom: Klasifikasi, Kode Akun, Nama Akun, Tanggal, Keterangan, Debit, Kredit. Gunakan template yang disediakan.');
  }

  const accounts = {}; // kode|nama -> { kode, nama, klasifikasiKey, klasifikasiLabel, transaksi:[], saldo }
  const unrecognizedKlasifikasi = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '')) continue;

    const kode = String(row[idx.kode] || '').trim();
    const nama = String(row[idx.nama] || '').trim();
    if (!kode && !nama) continue;

    const debit = Number(String(row[idx.debit]).replace(/[^0-9.-]/g, '')) || 0;
    const kredit = Number(String(row[idx.kredit]).replace(/[^0-9.-]/g, '')) || 0;
    const tanggal = idx.tanggal >= 0 ? formatTanggal(row[idx.tanggal]) : '';
    const keterangan = idx.keterangan >= 0 ? String(row[idx.keterangan] || '').trim() : '';

    const klasifikasiRaw = row[idx.klasifikasi];
    const klasifikasiKey = resolveKlasifikasiKey(klasifikasiRaw);
    if (!klasifikasiKey && klasifikasiRaw) unrecognizedKlasifikasi.add(String(klasifikasiRaw).trim());

    const accKey = `${kode}||${nama}`;
    if (!accounts[accKey]) {
      accounts[accKey] = {
        kode,
        nama,
        klasifikasiKey: klasifikasiKey || 'lainnya',
        klasifikasiLabel: klasifikasiKey ? KLASIFIKASI_LABEL[klasifikasiKey] : (String(klasifikasiRaw || '').trim() || 'Lainnya'),
        transaksi: [],
        saldo: 0
      };
    }
    if (tanggal || keterangan || debit || kredit) {
      accounts[accKey].transaksi.push({ tanggal, keterangan, debit, kredit });
    }
    accounts[accKey].saldo += debit - kredit;
  }

  // Susun per klasifikasi
  const klasifikasiMap = {};
  Object.values(accounts).forEach(acc => {
    const key = acc.klasifikasiKey;
    if (!klasifikasiMap[key]) {
      klasifikasiMap[key] = {
        key,
        label: acc.klasifikasiLabel,
        group: KLASIFIKASI_KE_GROUP[key] || 'LAINNYA',
        totalSaldo: 0,
        akun: []
      };
    }
    klasifikasiMap[key].akun.push(acc);
    klasifikasiMap[key].totalSaldo += acc.saldo;
  });
  Object.values(klasifikasiMap).forEach(k => {
    k.akun.sort((a, b) => a.kode.localeCompare(b.kode, 'id'));
  });

  // Totals turunan untuk menimpa/melengkapi statement.neraca
  const neracaTurunan = {};
  Object.values(klasifikasiMap).forEach(k => {
    if (k.key !== 'lainnya') neracaTurunan[k.key] = k.totalSaldo;
  });
  const totalAsetLancar = sumGroup(klasifikasiMap, 'ASET LANCAR');
  const totalAsetTidakLancar = sumGroup(klasifikasiMap, 'ASET TIDAK LANCAR');
  const totalKewajibanLancar = sumGroup(klasifikasiMap, 'LIABILITAS LANCAR');
  const totalKewajibanJangkaPanjang = sumGroup(klasifikasiMap, 'LIABILITAS JANGKA PANJANG');
  const totalEkuitas = sumGroup(klasifikasiMap, 'EKUITAS');

  neracaTurunan.totalAsetLancar = totalAsetLancar;
  neracaTurunan.totalAsetTidakLancar = totalAsetTidakLancar;
  neracaTurunan.totalAset = totalAsetLancar + totalAsetTidakLancar;
  neracaTurunan.totalKewajibanLancar = totalKewajibanLancar;
  neracaTurunan.totalKewajibanJangkaPanjang = totalKewajibanJangkaPanjang;
  neracaTurunan.totalKewajiban = totalKewajibanLancar + totalKewajibanJangkaPanjang;
  neracaTurunan.totalEkuitas = totalEkuitas;

  // Kelompokkan per grup, urut sesuai GROUP_ORDER, untuk memudahkan render
  const groups = GROUP_ORDER
    .map(g => ({
      group: g,
      klasifikasi: Object.values(klasifikasiMap).filter(k => k.group === g)
    }))
    .filter(g => g.klasifikasi.length > 0);

  return {
    groups,          // [{ group, klasifikasi: [{key,label,totalSaldo,akun:[{kode,nama,saldo,transaksi}]}] }]
    neracaTurunan,
    warnings: [...unrecognizedKlasifikasi].map(k => `Klasifikasi tidak dikenali dan dikelompokkan sebagai "Lainnya": "${k}"`)
  };
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
