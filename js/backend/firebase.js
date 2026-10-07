// ─────────────────────────────────────────────
// Firebase backend — Auth (Phone+Password / Email / Google) + Cloud Firestore
//
// الدخول برقم الجوال وكلمة المرور:
//   Firebase لا يوفّر "جوال + كلمة مرور" مباشرة، لذلك يُربط كل رقم بحساب
//   Email/Password داخلي بالشكل: 966501234567@phone.qatta.app
//   (البريد الحقيقي — إن وُجد — يُحفظ في الملف الشخصي فقط)
//
// هيكل البيانات:
//   users/{uid}                         الملف الشخصي
//   groups/{code}                       المجموعة (الرمز = معرّف المستند)
//   groups/{code}/expenses/{expenseId}  مصاريف المجموعة
// ─────────────────────────────────────────────
import { phoneToAuthEmail, isPhoneAuthEmail } from '../models.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export async function createFirebaseBackend(config) {
  const [appMod, authMod, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);

  const app = appMod.initializeApp(config);
  const auth = authMod.getAuth(app);
  auth.languageCode = 'ar';
  authMod.getRedirectResult(auth).catch(() => {});

  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }

  const toUser = (u) => u && ({
    uid: u.uid,
    email: isPhoneAuthEmail(u.email || '') ? '' : (u.email || '').toLowerCase(),
    displayName: u.displayName || '',
    method: isPhoneAuthEmail(u.email || '') ? 'phone'
      : u.providerData.some(p => p.providerId === 'google.com') ? 'google' : 'email',
  });

  const toDate = (v) => (v && typeof v.toDate === 'function') ? v.toDate() : (v ? new Date(v) : new Date());
  const fromDoc = (d) => {
    const x = d.data({ serverTimestamps: 'estimate' });
    return { ...x, id: d.id, createdAt: toDate(x.createdAt), updatedAt: toDate(x.updatedAt) };
  };

  const groupRef = (code) => fs.doc(db, 'groups', code);
  const expensesCol = (code) => fs.collection(db, 'groups', code, 'expenses');

  /** يحوّل أخطاء الحسابات الداخلية إلى رموز خاصة برقم الجوال */
  const phoneErr = (e) => {
    const map = {
      'auth/invalid-credential': 'phone/invalid-credential',
      'auth/wrong-password': 'phone/invalid-credential',
      'auth/user-not-found': 'phone/invalid-credential',
      'auth/email-already-in-use': 'phone/already-in-use',
      'auth/invalid-email': 'phone/invalid',
    };
    if (map[e?.code]) e.code = map[e.code];
    return e;
  };

  return {
    mode: 'firebase',

    // ───────────── Authentication ─────────────
    onAuth(cb) {
      return authMod.onAuthStateChanged(auth, (u) => cb(toUser(u)));
    },

    async signInPhone(e164, password) {
      try { await authMod.signInWithEmailAndPassword(auth, phoneToAuthEmail(e164), password); }
      catch (e) { throw phoneErr(e); }
    },

    async signUpPhone(e164, password, profile) {
      let cred;
      try { cred = await authMod.createUserWithEmailAndPassword(auth, phoneToAuthEmail(e164), password); }
      catch (e) { throw phoneErr(e); }
      await authMod.updateProfile(cred.user, { displayName: profile.name });
      await fs.setDoc(fs.doc(db, 'users', cred.user.uid), { ...profile, phone: e164, createdAt: fs.serverTimestamp() });
    },

    async signInEmail(email, password) {
      await authMod.signInWithEmailAndPassword(auth, email, password);
    },

    async signUpEmail(email, password, profile) {
      const { user } = await authMod.createUserWithEmailAndPassword(auth, email, password);
      await authMod.updateProfile(user, { displayName: profile.name });
      await fs.setDoc(fs.doc(db, 'users', user.uid), {
        ...profile, email: (user.email || '').toLowerCase(), createdAt: fs.serverTimestamp(),
      });
      authMod.sendEmailVerification(user).catch(() => {});
    },

    async signInGoogle() {
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await authMod.signInWithPopup(auth, provider);
      } catch (e) {
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

    async signOut() {
      await authMod.signOut(auth);
    },

    // ───────────── Profile ─────────────
    async getProfile(uid) {
      const snap = await fs.getDoc(fs.doc(db, 'users', uid));
      return snap.exists() ? snap.data() : null;
    },

    async saveProfile(uid, data, groupCodes = []) {
      await fs.setDoc(fs.doc(db, 'users', uid), { ...data, updatedAt: fs.serverTimestamp() }, { merge: true });
      // تحديث الاسم/الرقم/اللون في كل مجموعة ينتمي لها المستخدم
      const info = { name: data.name, phone: data.phone || '', avatarColor: data.avatarColor, initials: data.initials || '' };
      await Promise.all(groupCodes.map(code =>
        fs.updateDoc(groupRef(code), { [`memberInfo.${uid}`]: info, updatedAt: fs.serverTimestamp() }).catch(() => {})));
    },

    // ───────────── Groups ─────────────
    subscribeGroups(uid, onData, onError) {
      return fs.onSnapshot(
        fs.query(fs.collection(db, 'groups'), fs.where('members', 'array-contains', uid)),
        (snap) => onData(snap.docs.map(fromDoc)),
        onError,
      );
    },

    async createGroup(code, { name, emoji }, uid, memberInfo) {
      await fs.setDoc(groupRef(code), {
        name, emoji,
        createdBy: uid,
        members: [uid],
        memberInfo: { [uid]: memberInfo },
        createdAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp(),
      });
    },

    /** تعديل اسم/رمز المجموعة (للمنشئ) */
    async updateGroup(code, { name, emoji }) {
      await fs.updateDoc(groupRef(code), { name, emoji, updatedAt: fs.serverTimestamp() });
    },

    /** الانضمام بالرمز: يضيف المستخدم نفسه فقط (تسمح به القواعد لغير الأعضاء) */
    async joinGroup(code, uid, memberInfo) {
      await fs.updateDoc(groupRef(code), {
        members: fs.arrayUnion(uid),
        [`memberInfo.${uid}`]: memberInfo,
        updatedAt: fs.serverTimestamp(),
      });
    },

    /** حذف المجموعة (للمنشئ): تُحذف المصاريف أولاً ثم المجموعة */
    async deleteGroup(code) {
      const [ex, st] = await Promise.all([
        fs.getDocs(expensesCol(code)),
        fs.getDocs(fs.collection(db, 'groups', code, 'settlements')),
      ]);
      const docs = [...ex.docs, ...st.docs];
      for (let i = 0; i < docs.length; i += 400) {
        const batch = fs.writeBatch(db);
        docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      await fs.deleteDoc(groupRef(code));
    },

    // ───────────── Expenses ─────────────
    subscribeExpenses(code, onData, onError) {
      return fs.onSnapshot(expensesCol(code), (snap) => onData(snap.docs.map(fromDoc)), onError);
    },

    async addExpense(code, expense) {
      const { id, ...data } = expense;
      await fs.addDoc(expensesCol(code), {
        ...data,
        createdAt: fs.Timestamp.fromDate(expense.createdAt || new Date()),
        updatedAt: fs.serverTimestamp(),
      });
    },

    /** تعديل المصروف (لمنشئه) */
    async updateExpense(code, expenseId, expense) {
      const { id, createdAt, ...data } = expense;
      await fs.updateDoc(fs.doc(db, 'groups', code, 'expenses', expenseId), {
        ...data, updatedAt: fs.serverTimestamp(),
      });
    },

    async deleteExpense(code, expenseId) {
      await fs.deleteDoc(fs.doc(db, 'groups', code, 'expenses', expenseId));
    },

    // ───────────── Settlements (تصفية الحسابات) ─────────────
    subscribeSettlements(code, onData, onError) {
      return fs.onSnapshot(fs.collection(db, 'groups', code, 'settlements'), (snap) => onData(snap.docs.map(fromDoc)), onError);
    },

    async addSettlement(code, s) {
      await fs.addDoc(fs.collection(db, 'groups', code, 'settlements'), {
        ...s, createdAt: fs.serverTimestamp(),
      });
    },

    async deleteSettlement(code, id) {
      await fs.deleteDoc(fs.doc(db, 'groups', code, 'settlements', id));
    },

    // ───────────── Membership ─────────────
    /** مغادرة المجموعة — تبقى المصاريف والديون كما هي */
    async leaveGroup(code, uid) {
      await fs.updateDoc(groupRef(code), { members: fs.arrayRemove(uid), updatedAt: fs.serverTimestamp() });
    },

    /** إزالة عضو (لمنشئ المجموعة) — تبقى مصاريفه وديونه */
    async removeMember(code, uid) {
      await fs.updateDoc(groupRef(code), { members: fs.arrayRemove(uid), updatedAt: fs.serverTimestamp() });
    },
  };
}
