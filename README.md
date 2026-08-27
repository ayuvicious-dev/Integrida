# Integrida — Konsolidasi Laporan Keuangan

Integrida adalah aplikasi web (PWA) untuk mengonsolidasikan laporan keuangan
(neraca & laba rugi) beberapa perusahaan, membandingkannya antar periode
(bulanan, triwulan, semester, tahunan), serta menghitung analisis
**likuiditas**, **solvabilitas**, dan **profitabilitas**.

Dibangun dengan HTML/CSS/JavaScript murni (tanpa build tool) + **Firebase**
(Authentication & Firestore) sehingga bisa langsung di-hosting gratis di
**GitHub Pages** atau **Firebase Hosting**.

## Struktur File

```
integrida/
├── index.html                  # Halaman utama aplikasi
├── manifest.json                # Konfigurasi PWA
├── service-worker.js            # Caching offline dasar
├── css/style.css                 # Seluruh styling
├── js/
│   ├── firebase-config.js       # ⚠️ ISI dengan config Firebase Anda
│   ├── db.js                    # Akses data Firestore
│   ├── import-excel.js          # Parsing file Excel (neraca & laba rugi)
│   ├── analysis.js              # Perhitungan rasio keuangan
│   └── app.js                   # Logika UI & routing
├── icons/icon-192.png, icon-512.png
└── template/Template_Import_Neraca_LabaRugi.xlsx   # Template impor untuk pengguna
```

## 1. Setup Firebase (wajib sebelum digunakan)

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. Di project tersebut, klik ikon **Web (`</>`)** untuk mendaftarkan web app,
   beri nama bebas (misal "Integrida"), lalu salin objek `firebaseConfig`
   yang muncul.
3. Tempelkan nilai tersebut ke dalam `js/firebase-config.js`, menggantikan
   nilai `"GANTI_..."`.
4. Di menu **Build → Authentication → Sign-in method**, aktifkan
   **Email/Password**.
5. Di menu **Build → Firestore Database**, klik **Create database**
   (pilih mode *production*, region terdekat misalnya `asia-southeast2`).
6. Atur **Firestore Rules** minimal seperti berikut agar setiap pengguna
   hanya bisa mengakses datanya sendiri:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /companies/{companyId} {
         allow read, delete, update: if request.auth != null && resource.data.ownerUid == request.auth.uid;
         allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
         match /statements/{statementId} {
           allow read, write, delete: if request.auth != null &&
             get(/databases/$(database)/documents/companies/$(companyId)).data.ownerUid == request.auth.uid;
         }
       }
     }
   }
   ```

## 2. Menjalankan secara lokal

Karena aplikasi ini murni file statis, cukup jalankan server statis apa
saja dari dalam folder `integrida/`, misalnya:

```bash
npx serve .
# atau
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

> Membuka `index.html` langsung lewat `file://` **tidak disarankan** karena
> beberapa browser membatasi Service Worker & modul pada protokol file.

## 3. Deploy ke GitHub Pages

1. Buat repository baru di GitHub, misal `integrida`.
2. Upload seluruh isi folder `integrida/` (bukan folder itu sendiri, tapi
   isinya) ke root repository tersebut.
3. Buka **Settings → Pages** pada repository, pilih source branch `main`
   dan folder `/ (root)`.
4. Tunggu beberapa menit, aplikasi akan aktif di
   `https://<username>.github.io/<nama-repo>/`.
5. Di **Firebase Console → Authentication → Settings → Authorized domains**,
   tambahkan domain GitHub Pages Anda agar login tidak diblokir.

### (Opsional) Deploy ke Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # pilih folder ini sebagai public directory
firebase deploy
```

## 4. Cara Memakai Aplikasi

1. **Daftar/Masuk** menggunakan email & kata sandi.
2. Buka menu **Perusahaan** → tambahkan perusahaan yang akan dikonsolidasikan.
3. Buka menu **Impor Data** → unduh **Template Excel** yang tersedia, isi
   sesuai data neraca & laba rugi perusahaan pada periode tertentu, lalu
   unggah kembali filenya. Setiap file mewakili **satu perusahaan pada satu
   periode** (bulanan/triwulan/semester/tahunan).
4. Buka menu **Perbandingan** untuk membandingkan beberapa perusahaan pada
   jenis periode yang sama (grafik + tabel).
5. Buka menu **Analisis Rasio** untuk melihat rasio likuiditas (Current
   Ratio, Quick Ratio, Cash Ratio), solvabilitas (Debt to Asset, Debt to
   Equity, Equity Multiplier), dan profitabilitas (Gross/Operating/Net
   Profit Margin, ROA, ROE) beserta tren antar periode.

## 5. Format Template Excel

File template memiliki 3 sheet:

- **Info** — Nama Perusahaan, Tahun, Jenis Periode, Label Periode.
- **Neraca** — daftar akun neraca standar (jangan ubah nama akun di kolom
  A; isi hanya kolom B). Baris **Total** sudah berisi formula otomatis.
- **Laba Rugi** — daftar akun laba rugi standar dengan formula otomatis
  pada baris Laba Kotor, Laba Operasional, Laba Sebelum Pajak, dan Laba
  Bersih.

Mengunggah ulang file dengan Perusahaan, Tahun, Jenis Periode, dan Label
Periode yang sama akan **menimpa** data periode tersebut (bukan membuat
duplikat).

## 6. Teknologi

- **Firebase Authentication** — login email/password.
- **Firebase Firestore** — penyimpanan data perusahaan & laporan keuangan.
- **SheetJS (xlsx)** — parsing file Excel di sisi browser.
- **Chart.js** — visualisasi grafik.
- **Vanilla JavaScript** — tanpa framework/bundler, mudah di-deploy statis.
- **PWA** (manifest + service worker) — dapat "Add to Home Screen".

## Catatan Keamanan

- Kredensial Firebase pada `firebase-config.js` (apiKey, dsb.) **aman
  untuk bersifat publik/di-commit ke GitHub** — proteksi data yang
  sesungguhnya diatur melalui **Firestore Security Rules**, bukan dengan
  menyembunyikan config tersebut.
- Pastikan Firestore Rules pada bagian 1 sudah diterapkan sebelum
  menggunakan data sungguhan.
