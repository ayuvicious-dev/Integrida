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

  async deleteStatement(companyId, statementId) {
    await db.collection('companies').doc(companyId).collection('statements').doc(statementId).delete();
  }
};
