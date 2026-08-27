// =============================================================
// ANALYSIS.JS
// Perhitungan rasio keuangan dari satu objek statement
// (neraca + labaRugi). Semua fungsi aman terhadap pembagian 0.
// =============================================================

function safeDiv(a, b) {
  if (!b) return null;
  return a / b;
}

function computeRatios(statement) {
  const n = statement.neraca || {};
  const l = statement.labaRugi || {};

  const totalAsetLancar = n.totalAsetLancar || 0;
  const totalKewajibanLancar = n.totalKewajibanLancar || 0;
  const persediaan = n.persediaan || 0;
  const totalAset = n.totalAset || 0;
  const totalKewajiban = n.totalKewajiban || 0;
  const totalEkuitas = n.totalEkuitas || 0;
  const kasSetaraKas = n.kasSetaraKas || 0;

  const pendapatan = l.pendapatan || 0;
  const labaKotor = l.labaKotor || 0;
  const labaOperasional = l.labaOperasional || 0;
  const labaBersih = l.labaBersih || 0;

  return {
    likuiditas: {
      currentRatio: safeDiv(totalAsetLancar, totalKewajibanLancar),
      quickRatio: safeDiv(totalAsetLancar - persediaan, totalKewajibanLancar),
      cashRatio: safeDiv(kasSetaraKas, totalKewajibanLancar)
    },
    solvabilitas: {
      debtToAssetRatio: safeDiv(totalKewajiban, totalAset),
      debtToEquityRatio: safeDiv(totalKewajiban, totalEkuitas),
      equityMultiplier: safeDiv(totalAset, totalEkuitas)
    },
    profitabilitas: {
      grossProfitMargin: safeDiv(labaKotor, pendapatan),
      operatingMargin: safeDiv(labaOperasional, pendapatan),
      netProfitMargin: safeDiv(labaBersih, pendapatan),
      roa: safeDiv(labaBersih, totalAset),
      roe: safeDiv(labaBersih, totalEkuitas)
    }
  };
}

const RATIO_LABELS = {
  currentRatio: { label: 'Current Ratio', fmt: 'x', desc: 'Aset lancar dibagi kewajiban lancar. Idealnya > 1.5–2x.' },
  quickRatio: { label: 'Quick Ratio', fmt: 'x', desc: '(Aset lancar - persediaan) dibagi kewajiban lancar.' },
  cashRatio: { label: 'Cash Ratio', fmt: 'x', desc: 'Kas & setara kas dibagi kewajiban lancar.' },
  debtToAssetRatio: { label: 'Debt to Asset Ratio', fmt: '%', desc: 'Proporsi aset yang dibiayai utang. Makin rendah makin aman.' },
  debtToEquityRatio: { label: 'Debt to Equity Ratio', fmt: 'x', desc: 'Total kewajiban dibagi ekuitas.' },
  equityMultiplier: { label: 'Equity Multiplier', fmt: 'x', desc: 'Total aset dibagi ekuitas (tingkat leverage).' },
  grossProfitMargin: { label: 'Gross Profit Margin', fmt: '%', desc: 'Laba kotor dibagi pendapatan.' },
  operatingMargin: { label: 'Operating Margin', fmt: '%', desc: 'Laba operasional dibagi pendapatan.' },
  netProfitMargin: { label: 'Net Profit Margin', fmt: '%', desc: 'Laba bersih dibagi pendapatan.' },
  roa: { label: 'Return on Assets (ROA)', fmt: '%', desc: 'Laba bersih dibagi total aset.' },
  roe: { label: 'Return on Equity (ROE)', fmt: '%', desc: 'Laba bersih dibagi total ekuitas.' }
};

function formatRatio(value, fmt) {
  if (value === null || value === undefined || isNaN(value)) return '–';
  if (fmt === '%') return (value * 100).toFixed(1) + '%';
  return value.toFixed(2) + 'x';
}
