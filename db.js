// =============================================================
// DB.JS - Lapisan akses data Firestore untuk Integrida
// Struktur data:
// companies/{companyId}            { name, ownerUid, createdAt }
// companies/{companyId}/statements/{statementId}
//   {
//     year, periodType ('bulanan'|'triwulan'|'semester'|'tahunan'),
//     periodIndex (1..12 / 1..4 / 1..2 / 1),
//     periodLabel (contoh "Maret 2025" / "Triwulan II 2025"),
//     neraca: {...}, labaRugi: {...}, uploadedAt
//   }
// =============================================================

const DB = {
  async getCompanies(uid) {
    const snap = await db.collection('companies').where('ownerUid', '==', uid).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addCompany(uid, name) {
    const ref = await db.collection('companies').add({
      name,
      ownerUid: uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },

  async deleteCompany(companyId) {
    const statements = await db.collection('companies').doc(companyId).collection('statements').get();
    const batch = db.batch();
    statements.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('companies').doc(companyId));
    await batch.commit();
  },

  async getStatements(companyId) {
    const snap = await db.collection('companies').doc(companyId).collection('statements')
      .orderBy('year', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getAllStatementsForCompanies(companyIds) {
    const results = [];
    for (const id of companyIds) {
      const statements = await this.getStatements(id);
      statements.forEach(s => results.push({ ...s, companyId: id }));
    }
    return results;
  },

  async saveStatement(companyId, statement) {
    // ID unik per periode agar impor ulang menimpa data lama (bukan duplikat)
    const statementId = `${statement.year}_${statement.periodType}_${statement.periodIndex}`;
    await db.collection('companies').doc(companyId).collection('statements').doc(statementId).set({
      ...statement,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return statementId;
  },

  // Menyimpan HANYA satu kategori data (neraca / labaRugi / arusKas / bukuBesar)
  // untuk suatu periode, tanpa menimpa kategori lain yang sudah tersimpan
  // sebelumnya di periode yang sama — dipakai karena tiap kategori sekarang
  // diimpor dari file Excel yang terpisah, satu per satu.
  async saveStatementSection(companyId, period, sectionKey, sectionData) {
    const statementId = `${period.year}_${period.periodType}_${period.periodIndex}`;
    await db.collection('companies').doc(companyId).collection('statements').doc(statementId).set({
      year: period.year,
      periodType: period.periodType,
      periodIndex: period.periodIndex,
      periodLabel: period.periodLabel,
      [sectionKey]: sectionData,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return statementId;
  },

  async deleteStatement(companyId, statementId) {
    await db.collection('companies').doc(companyId).collection('statements').doc(statementId).delete();
  },

  // ===========================================================
  // REALTIME WATCHERS (untuk fitur sinkronisasi multi-device)
  // Setiap watcher mengembalikan fungsi unsubscribe(), dan memanggil
  // callback(data, meta) setiap kali ada perubahan — baik dari
  // perangkat ini sendiri maupun dari perangkat/sesi lain yang login
  // dengan akun yang sama.
  //
  // meta.pendingWrites = true  -> ada perubahan lokal yang BELUM
  //                                terkirim & terkonfirmasi ke server.
  // meta.fromCache     = true  -> data yang tampil berasal dari cache
  //                                lokal (biasanya karena sedang offline),
  //                                belum tentu versi terbaru dari server.
  // ===========================================================

  watchCompanies(uid, onData, onError) {
    return db.collection('companies').where('ownerUid', '==', uid)
      .onSnapshot({ includeMetadataChanges: true }, (snap) => {
        const companies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        onData(companies, {
          pendingWrites: snap.metadata.hasPendingWrites,
          fromCache: snap.metadata.fromCache
        });
      }, (err) => { if (onError) onError(err); else console.error('watchCompanies error', err); });
  },

  watchStatements(companyId, onData, onError) {
    return db.collection('companies').doc(companyId).collection('statements')
      .orderBy('year', 'asc')
      .onSnapshot({ includeMetadataChanges: true }, (snap) => {
        const statements = snap.docs.map(d => ({ id: d.id, companyId, ...d.data() }));
        onData(statements, {
          pendingWrites: snap.metadata.hasPendingWrites,
          fromCache: snap.metadata.fromCache
        });
      }, (err) => { if (onError) onError(err); else console.error('watchStatements error', err); });
  },

  // Menggabungkan watcher beberapa perusahaan sekaligus jadi satu
  // callback tunggal (dipakai di Dashboard & Perbandingan).
  watchAllStatements(companyIds, onData, onError) {
    const cache = {};
    const metaMap = {};
    const emit = () => {
      const merged = companyIds.flatMap(id => cache[id] || []);
      const aggMeta = {
        pendingWrites: Object.values(metaMap).some(m => m.pendingWrites),
        fromCache: Object.values(metaMap).some(m => m.fromCache)
      };
      onData(merged, aggMeta);
    };
    const unsubs = companyIds.map(id => this.watchStatements(id, (statements, meta) => {
      cache[id] = statements;
      metaMap[id] = meta;
      emit();
    }, onError));
    return () => unsubs.forEach(u => { if (typeof u === 'function') u(); });
  }
};

