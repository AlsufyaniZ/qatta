// ─────────────────────────────────────────────
// Firebase backend — Auth (Email + Google) + Cloud Firestore
// يُحمَّل Firebase JS SDK مباشرة من CDN (بدون أي build step)
// ─────────────────────────────────────────────

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export async function createFirebaseBackend(config) {
  const [appMod, authMod, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);

  const app = appMod.initializeApp(config);

  // ── Auth ──
  const auth = authMod.getAuth(app);
  auth.languageCode = 'ar'; // رسائل التحقق وإعادة التعيين بالعربية
  authMod.getRedirectResult(auth).catch(() => {});

  // ── Firestore (مع تخزين محلي للعمل دون اتصال) ──
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }
  const expensesCol = fs.collection(db, 'expenses');

  const toUser = (u) => u && ({
    uid: u.uid,
    email: (u.email || '').toLowerCase(),
    displayName: u.displayName || '',
    emailVerified: !!u.emailVerified,
    isGoogle: u.providerData.some(p => p.providerId === 'google.com'),
  });

  const toDate = (v) => (v && typeof v.toDate === 'function') ? v.toDate() : (v ? new Date(v) : new Date());

  const fromDoc = (d) => {
    const x = d.data({ serverTimestamps: 'estimate' });
    return { ...x, id: d.id, createdAt: toDate(x.createdAt), updatedAt: toDate(x.updatedAt) };
  };

  return {
    mode: 'firebase',

    // ── Authentication ──
    onAuth(cb) {
      return authMod.onAuthStateChanged(auth, (u) => cb(toUser(u)));
    },

    async signInEmail(email, password) {
      await authMod.signInWithEmailAndPassword(auth, email, password);
    },

    async signUpEmail(name, email, password, profile) {
      const { user } = await authMod.createUserWithEmailAndPassword(auth, email, password);
      await authMod.updateProfile(user, { displayName: name });
      await fs.setDoc(fs.doc(db, 'users', user.uid), {
        ...profile,
        email: (user.email || '').toLowerCase(),
        createdAt: fs.serverTimestamp(),
      });
      authMod.sendEmailVerification(user).catch(() => {});
    },

    async signInGoogle() {
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await authMod.signInWithPopup(auth, provider);
      } catch (e) {
        // بعض المتصفحات (خصوصاً داخل التطبيقات) تمنع النوافذ المنبثقة
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
          await authMod.signInWithRedirect(auth, provider);
        } else {
          throw e;
        }
      }
    },

    async resetPassword(email) {
      await authMod.sendPasswordResetEmail(auth, email);
    },

    async resendVerification() {
      if (auth.currentUser) await authMod.sendEmailVerification(auth.currentUser);
    },

    /** يعيد تحميل المستخدم ويجدد التوكن حتى تقرأ قواعد Firestore حالة email_verified الجديدة */
    async reloadUser() {
      if (!auth.currentUser) return null;
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      return toUser(auth.currentUser);
    },

    async signOut() {
      await authMod.signOut(auth);
    },

    // ── User profile: users/{uid} ──
    async getProfile(uid) {
      const snap = await fs.getDoc(fs.doc(db, 'users', uid));
      return snap.exists() ? snap.data() : null;
    },

    async saveProfile(uid, data) {
      await fs.setDoc(fs.doc(db, 'users', uid), { ...data, updatedAt: fs.serverTimestamp() }, { merge: true });
    },

    // ── Expenses: expenses/{id} ──
    /**
     * يستمع لحظياً لمصاريف المستخدم:
     *  1) التي أنشأها (ownerId == uid)
     *  2) التي أُضيف إليها ببريده (memberEmails array-contains email) — تتطلب بريداً موثّقاً
     */
    subscribeExpenses(user, onData, onError) {
      const owned = new Map();
      const shared = new Map();
      const emit = () => onData([...new Map([...shared, ...owned]).values()]);

      const unsubOwned = fs.onSnapshot(
        fs.query(expensesCol, fs.where('ownerId', '==', user.uid)),
        (snap) => { owned.clear(); snap.forEach(d => owned.set(d.id, fromDoc(d))); emit(); },
        onError,
      );

      let unsubShared = () => {};
      if (user.email && user.emailVerified) {
        unsubShared = fs.onSnapshot(
          fs.query(expensesCol, fs.where('memberEmails', 'array-contains', user.email)),
          (snap) => { shared.clear(); snap.forEach(d => shared.set(d.id, fromDoc(d))); emit(); },
          (e) => console.warn('[Qatta] shared expenses listener:', e),
        );
      }
      return () => { unsubOwned(); unsubShared(); };
    },

    async addExpense(expense) {
      const { id, ...data } = expense;
      const ref = await fs.addDoc(expensesCol, {
        ...data,
        createdAt: fs.Timestamp.fromDate(expense.createdAt || new Date()),
        updatedAt: fs.serverTimestamp(),
      });
      return ref.id;
    },

    async updateParticipants(expenseId, participants) {
      await fs.updateDoc(fs.doc(db, 'expenses', expenseId), {
        participants,
        updatedAt: fs.serverTimestamp(),
      });
    },

    async deleteExpense(expenseId) {
      await fs.deleteDoc(fs.doc(db, 'expenses', expenseId));
    },
  };
}
