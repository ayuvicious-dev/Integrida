// Integrida Service Worker
// Caching dasar untuk shell aplikasi agar dapat dibuka ulang saat offline
// (data laporan keuangan tetap membutuhkan koneksi ke Firebase).

// v2: seluruh CSS & JS aplikasi sudah digabung ke dalam index.html,
// jadi app shell yang perlu di-cache jauh lebih sederhana.
// v3: pembaruan index.html.
// v4: strategi diubah menjadi network-first khusus untuk halaman HTML
//     (navigasi), supaya pembaruan index.html langsung terlihat tanpa
//     perlu menaikkan versi CACHE_NAME setiap kali. Aset statis lain
//     (manifest, ikon) tetap cache-first agar tetap cepat & bisa offline.
// v5: index.html diperbarui (fitur logo perusahaan) — cache lama tetap
//     tergantikan otomatis lewat strategi network-first di atas, tapi
//     versi dinaikkan sebagai penanda revisi.
// v6: index.html diperbarui (baris Ekuitas "Pendapatan Periode Ini" &
//     "Pendapatan s.d. Tahun Lalu" pada Neraca, supaya Total Aset
//     balance dengan Total Kewajiban + Total Ekuitas).
// v7: index.html diperbarui (ringkasan Total Aktiva vs Total Pasiva +
//     indikator Balance/Belum Balance pada tampilan Neraca).
// v8: index.html diperbarui (susunan baris Laba Rugi di Detail
//     Perusahaan disamakan urutannya dengan Pratinjau Impor: Pendapatan
//     → HPP → Laba Kotor → Beban Operasional → Laba Operasional →
//     Pendapatan Lainnya → Beban Lainnya → Beban Pajak → Laba Bersih).
// v9: index.html diperbarui (ringkasan Total Aktiva/Pasiva & indikator
//     Balance dihapus dari Pratinjau Impor Buku Besar — pratinjau belum
//     memasukkan Pendapatan Periode Ini/s.d. Tahun Lalu sehingga selalu
//     tampak "Belum Balance"; indikator tetap ada di Neraca pada fitur
//     Detail Perusahaan yang sudah memasukkan kedua komponen tersebut).
// v10: index.html diperbarui (jenis impor "Neraca" & "Laba Rugi"
//      dihapus dari halaman Impor Data — keduanya sudah otomatis
//      diturunkan dari impor Buku Besar. Jenis impor yang tersisa:
//      Arus Kas & Buku Besar).
// v11: index.html diperbarui — impor Buku Besar kini juga menurunkan
//      Laporan Arus Kas Metode Langsung secara otomatis dari transaksi
//      akun Kas & Setara Kas (dikelompokkan ke Aktivitas Operasi/
//      Investasi/Pendanaan berdasarkan kata kunci pada Keterangan),
//      ditampilkan di Pratinjau Impor & Detail Perusahaan.
// v12: index.html diperbarui (baris Kas Bersih dari Aktivitas Operasi/
//      Investasi/Pendanaan & Kas & Setara Kas Akhir Periode pada Arus
//      Kas kini diberi highlight hijau seperti subtotal pada Neraca,
//      berlaku di Detail Perusahaan maupun Pratinjau Impor Buku Besar).
// v13: index.html diperbarui — impor Buku Besar kini juga menurunkan
//      Laporan Perubahan Modal secara otomatis (mutasi akun Ekuitas
//      direkonsiliasi dengan Setoran Modal Pemilik & Penarikan Modal
//      Pemilik/Dividen dari Arus Kas, ditambah Laba Bersih periode
//      berjalan), ditampilkan di Pratinjau Impor & Detail Perusahaan.
// v14: index.html diperbarui — di Detail Perusahaan, kartu Arus Kas &
//      Perubahan Modal kini sejajar berdampingan (grid 2 kolom, sama
//      seperti Neraca & Laba Rugi), bukan lagi ditumpuk penuh lebar.
// v15: index.html diperbarui — jenis impor manual "Arus Kas" dihapus
//      dari halaman Impor Data (Neraca, Laba Rugi, Arus Kas, & Perubahan
//      Modal semuanya sudah diturunkan otomatis dari impor Buku Besar).
//      Jenis impor yang tersisa hanya Buku Besar; langkah "Pilih Jenis
//      Data" pada Impor Data ikut dihapus karena tidak relevan lagi.
// v16: index.html diperbarui — tampilan menu Perusahaan (tab "Tabel")
//      diganti jadi grid kartu ala folder (3 kartu per baris) yang cuma
//      menampilkan logo & nama perusahaan; kode, klasifikasi, induk
//      perusahaan, jumlah periode tersimpan, dan tombol hapus perusahaan
//      dipindahkan ke kartu "Informasi Bisnis" pada halaman Detail
//      Perusahaan (terbuka saat kartu grid diklik).
// v17: index.html diperbarui — kop/judul laporan (nama perusahaan, nama
//      laporan, "Per .../Untuk Periode ...", "(dalam IDR)") ditambahkan
//      di atas tabel Neraca, Laba Rugi, Arus Kas, dan Perubahan Modal
//      pada halaman Detail Perusahaan.
// v18: index.html diperbarui — kop/judul laporan (Neraca, Laba Rugi,
//      Arus Kas, Perubahan Modal) diratakan ke tengah (rata tengah),
//      bukan rata kiri.
// v19: index.html diperbarui — kop laporan Laba Rugi, Arus Kas, &
//      Perubahan Modal kini menampilkan rentang tanggal periode
//      (mis. "01/08/2026 - 31/08/2026"), dihitung otomatis dari
//      year/periodType/periodIndex, menggantikan baris "Untuk Periode
//      ...". Kop Neraca tidak berubah (tetap "Per [label periode]").
const CACHE_NAME = 'integrida-cache-v19';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Jangan cache request ke Firebase / API eksternal - selalu ambil dari jaringan
  if (req.url.includes('googleapis') || req.url.includes('firestore') || req.url.includes('firebase')) {
    return;
  }

  // NETWORK-FIRST untuk navigasi (index.html / rute SPA).
  // Ini memastikan pengguna selalu melihat versi terbaru aplikasi selama
  // online, dan hanya jatuh ke cache lama saat benar-benar offline.
  const isNavigation = req.mode === 'navigate' ||
    (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST untuk aset statis lain (manifest, ikon, dsb.)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response && response.status === 200 && req.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
