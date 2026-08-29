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
// v20: index.html diperbarui — tabel Riwayat Impor (Detail Perusahaan)
//      kini punya kolom "Verifikasi": checkbox per periode yang saat
//      dicentang menandai laporan periode itu "Terverifikasi" (field
//      `verified` pada dokumen statement) dan menampilkan badge hijau
//      "✓ Terverifikasi" di sebelah nama periode.
// v21: index.html diperbarui — perbaikan bug: hasil impor Buku Besar
//      (bukuBesar, Neraca, Laba Rugi, Arus Kas, Perubahan Modal) kini
//      disimpan dalam SATU kali write Firestore (DB.saveStatementSections)
//      alih-alih 5 write terpisah berurutan, supaya tidak ada lagi
//      kondisi "tersimpan sebagian" (mis. Buku Besar tersimpan tapi
//      4 laporan turunannya tidak) saat terjadi gangguan koneksi di
//      tengah proses simpan. confirmImport() juga kini menampilkan
//      pesan error yang jelas via toast jika penyimpanan gagal, alih-
//      alih gagal diam-diam.
// v22: index.html diperbarui — perbaikan bug lanjutan: rincian mentah
//      Buku Besar (per transaksi) ternyata bisa melebihi batas ukuran
//      1 dokumen Firestore (1.048.576 byte) untuk perusahaan dengan
//      banyak transaksi (mis. impor tahunan), menyebabkan penyimpanan
//      gagal dengan pesan "...exceeds the maximum allowed size...".
//      Sekarang Buku Besar disimpan TERPISAH dari dokumen statement, di
//      subcollection `ledgerChunks`, dipecah otomatis jadi beberapa
//      dokumen kecil (dan bila perlu, satu akun dengan transaksi sangat
//      banyak ikut dipecah) — masing-masing jauh di bawah batas
//      tersebut, lalu disatukan kembali otomatis saat dibutuhkan
//      (rincian klik-baris di Detail Perusahaan dimuat sesuai
//      kebutuhan/lazy). Dokumen statement sendiri jadi jauh lebih kecil
//      (hanya berisi Neraca/Laba Rugi/Arus Kas/Perubahan Modal yang
//      memang selalu ringkas), sekaligus mempercepat sinkronisasi
//      realtime lintas perangkat.
// v23: index.html diperbarui — kolom "Verifikasi" (checkbox tandai-valid
//      manual per periode) pada tabel Riwayat Impor (Detail Perusahaan)
//      diganti jadi kolom "Persentase Sinkron": progress bar + persentase
//      otomatis dari checkbox "Sinkron" yang sudah dicentang di baris-baris
//      rincian Neraca, Laba Rugi, Arus Kas, & Perubahan Modal pada kartu di
//      atasnya (bukan lagi status tunggal yang ditandai manual per periode).
// v24: index.html diperbarui — grid kartu Perusahaan (halaman Perusahaan)
//      kini menampilkan progress bar persentase impor per perusahaan:
//      dari periode pertama yang pernah diimpor perusahaan itu sampai
//      periode terakhir yang seharusnya sudah selesai per hari ini (mis.
//      hari ini Agustus -> periode bulanan terakhir yang dicek = Juli),
//      berapa persen periode di rentang itu yang datanya sudah ada. 100%
//      berarti tidak ada periode yang tertunggak/bolong.
// v25: index.html diperbarui — persentase pada progress bar kartu grid
//      Perusahaan (halaman Utama/Perusahaan) diganti dari "kelengkapan
//      periode" menjadi "Persentase Sinkron" yang SAMA PERSIS dengan
//      kolom Persentase Sinkron di tabel Riwayat Impor (Detail
//      Perusahaan): checkbox "Sinkron" yang tercentang pada seluruh
//      baris Neraca/Laba Rugi/Arus Kas/Perubahan Modal, dijumlahkan dari
//      SELURUH periode perusahaan tsb (companySyncProgress(), memakai
//      ulang statementSyncProgress() per periode). Kartu kini menampilkan
//      "Memuat…" sesaat saat rincian Buku Besar sebagian periode masih
//      diambil dari server, lalu otomatis ter-update begitu selesai.
// v26: index.html diperbarui — label persentase pada kartu grid
//      Perusahaan kini menyertakan tahun periode yang dihitung, mis.
//      "1/58 tersinkron (2023–2026)" atau "(2026)" kalau hanya satu
//      tahun, supaya jelas rentang periode mana yang diwakili angka itu
//      (companySyncProgress() kini juga mengembalikan yearFrom/yearTo).
const CACHE_NAME = 'integrida-cache-v26';
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
