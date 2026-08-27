// =============================================================
// KONFIGURASI FIREBASE - INTEGRIDA
// =============================================================
// Config di bawah ini sudah diisi sesuai project Firebase "integrida-ee3fd".
// Jika suatu saat pindah/ganti project Firebase, salin ulang config baru
// dari: Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration
//
// Sebelum aplikasi bisa dipakai, pastikan pada project ini sudah aktif:
// 1. Authentication -> Sign-in method -> Email/Password (Enable)
// 2. Firestore Database -> Create database
// 3. Firestore Rules sudah diterapkan (lihat README.md bagian 1)
// 4. Domain hosting (GitHub Pages) sudah ditambahkan di
//    Authentication -> Settings -> Authorized domains
// =============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDMADohBX0R-JfMmjOb7KVY9nHmDkjc26M",
  authDomain: "integrida-ee3fd.firebaseapp.com",
  projectId: "integrida-ee3fd",
  storageBucket: "integrida-ee3fd.firebasestorage.app",
  messagingSenderId: "275935470585",
  appId: "1:275935470585:web:887c427ea862ab6b8d9328"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Aktifkan cache offline (opsional, memudahkan pemakaian saat koneksi lemah)
db.enablePersistence().catch(() => {
  /* Diabaikan jika gagal (mis. dibuka di banyak tab sekaligus) */
});
