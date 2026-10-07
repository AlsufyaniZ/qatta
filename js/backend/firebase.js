// ─────────────────────────────────────────────
// Firebase backend — Auth (Phone+Password / Email / Google) + Cloud Firestore
//
// الدخول برقم الجوال وكلمة المرور:
//   • بدون بريد: يُربط الرقم بحساب داخلي بالشكل 966501234567@phone.qatta.app
//   • مع بريد: يُنشأ الحساب ببريد المستخدم الحقيقي (فتعمل استعادة كلمة المرور)،
//     ويُحفظ في phoneIndex/{hash(رقم)} بريدٌ مشفّر بمفتاح مشتق من كلمة المرور،
//     فيستطيع الدخول برقمه دون كشف بريده لأي أحد.
//
// هيكل البيانات:
//   users/{uid}                              الملف الشخصي (+ الحساب البنكي)
//   phoneIndex/{sha256}                      { uid, salt, iv, ct } — بريد مشفّر لدخول الجوال
//   groups/{code}                            المجموعة: members, memberInfo, guests, guestPhoneEmails
//   groups/{code}/expenses/{id}              المصاريف
//   groups/{code}/settlements/{id}           تحويلات تصفية الحسابات
// ─────────────────────────────────────────────
import { phoneToAuthEmail, isPhoneAuthEmail, memberInfoFrom, mergeGuestInExpense } from '../models.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

// ── تشفير بريد الدخول بالجوال (WebCrypto) ──
const te = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sha256hex(s) {
  const h = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function sealEmail(email, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(email));
  return { salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function openEmail(blob, password) {
  const key = await deriveKey(password, unb64(blob.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return new TextDecoder().decode(pt);
}

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
    authEmail: (u.email || '').toLowerCase(),
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
  const settlementsCol = (code) => fs.collection(db, 'groups', code, 'settlements');
  const phoneIndexRef = async (e164) => fs.doc(db, 'phoneIndex', await sha256hex('qatta:' + e164));

  const fail = (code) => { const e = new Error(code); e.code = code; return e; };
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

  /** يحدّث سجل الدخول بالجوال بكلمة المرور الحالية (بعد أي دخول ناجح بالبريد) */
  async function refreshPhoneIndex(uid, password) {
    try {
      const snap = await fs.getDoc(fs.doc(db, 'users', uid));
      const p = snap.exists() ? snap.data() : null;
      if (!p?.loginPhone || !auth.currentUser?.email || isPhoneAuthEmail(auth.currentUser.email)) return;
      await fs.setDoc(await phoneIndexRef(p.loginPhone), { uid, ...(await sealEmail(auth.currentUser.email, password)) });
    } catch (e) { console.warn('[Qatta] phoneIndex refresh', e); }
  }

  return {
    mode: 'firebase',

    // ───────────── Authentication ─────────────
    onAuth(cb) {
      return authMod.onAuthStateChanged(auth, (u) => cb(toUser(u)));
    },

    /** الدخول بالجوال: الحساب الداخلي أولاً، ثم حساب البريد المرتبط بالرقم */
    async signInPhone(e164, password) {
      try {
        await authMod.signInWithEmailAndPassword(auth, phoneToAuthEmail(e164), password);
        return;
      } catch (e) {
        if (!['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(e?.code)) throw phoneErr(e);
      }
      const snap = await fs.getDoc(await phoneIndexRef(e164));
      if (!snap.exists()) throw fail('phone/invalid-credential');
      let email;
      try { email = await openEmail(snap.data(), password); }
      catch { throw fail('phone/invalid-credential-maybe-reset'); }
      try { await authMod.signInWithEmailAndPassword(auth, email, password); }
      catch (e) { throw phoneErr(e); }
    },

    /** التسجيل بالجوال — مع بريد (قابل للاستعادة) أو بدونه */
    async signUpPhone(e164, password, profile) {
      const idxRef = await phoneIndexRef(e164);
      if ((await fs.getDoc(idxRef)).exists()) throw fail('phone/already-in-use');
      let cred;
      if (profile.email) {
        try { cred = await authMod.createUserWithEmailAndPassword(auth, profile.email, password); }
        catch (e) { throw e; }
        await fs.setDoc(idxRef, { uid: cred.user.uid, ...(await sealEmail(profile.email, password)) });
        authMod.sendEmailVerification(cred.user).catch(() => {});
      } else {
        try { cred = await authMod.createUserWithEmailAndPassword(auth, phoneToAuthEmail(e164), password); }
        catch (e) { throw phoneErr(e); }
      }
      await authMod.updateProfile(cred.user, { displayName: profile.name });
      await fs.setDoc(fs.doc(db, 'users', cred.user.uid), {
        ...profile, phone: e164, loginPhone: e164, createdAt: fs.serverTimestamp(),
      });
    },

    async signInEmail(email, password) {
      const { user } = await authMod.signInWithEmailAndPassword(auth, email, password);
      refreshPhoneIndex(user.uid, password);
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

    /**
     * إضافة بريد لحساب جوال قائم لتفعيل الاستعادة:
     * يتطلب كلمة المرور الحالية، ويرسل رابط تأكيد؛ بعد التأكيد يصبح البريد هو بريد الحساب
     */
    async addRecoveryEmail(e164, email, password) {
      const u = auth.currentUser;
      const cred = authMod.EmailAuthProvider.credential(u.email, password);
      try { await authMod.reauthenticateWithCredential(u, cred); }
      catch (e) { throw fail('auth/wrong-password'); }
      await fs.setDoc(await phoneIndexRef(e164), { uid: u.uid, ...(await sealEmail(email, password)) });
      await authMod.verifyBeforeUpdateEmail(u, email);
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
      // تحديث البيانات الظاهرة (الاسم/الرقم/اللون/الرمز/الحساب البنكي) في كل مجموعة
      const info = memberInfoFrom(data);
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

    // ───────────── Guests (الضيوف) ─────────────
    /** إضافة ضيف كعضو في المجموعة (مع رقمه إن وُجد لربطه تلقائياً عند تسجيله) */
    async addGuest(code, gid, info) {
      const upd = { [`guests.${gid}`]: info, updatedAt: fs.serverTimestamp() };
      if (info.phone) upd.guestPhoneEmails = fs.arrayUnion(phoneToAuthEmail(info.phone));
      await fs.updateDoc(groupRef(code), upd);
    },

    async updateGuest(code, gid, info, oldPhone = '') {
      await fs.updateDoc(groupRef(code), { [`guests.${gid}`]: info, updatedAt: fs.serverTimestamp() });
      if (oldPhone && oldPhone !== info.phone) await fs.updateDoc(groupRef(code), { guestPhoneEmails: fs.arrayRemove(phoneToAuthEmail(oldPhone)) });
      if (info.phone) await fs.updateDoc(groupRef(code), { guestPhoneEmails: fs.arrayUnion(phoneToAuthEmail(info.phone)) });
    },

    async removeGuest(code, gid, phone = '') {
      const upd = { [`guests.${gid}`]: fs.deleteField(), updatedAt: fs.serverTimestamp() };
      if (phone) upd.guestPhoneEmails = fs.arrayRemove(phoneToAuthEmail(phone));
      await fs.updateDoc(groupRef(code), upd);
    },

    /**
     * دمج ضيف في حساب المستخدم: تنتقل مصاريفه ودفعاته وتسوياته للمستخدم ثم يُحذف الضيف.
     * إن لم يكن المستخدم عضواً (ربط تلقائي بالجوال) ينضم أولاً.
     */
    async claimGuest(code, gid, uid, info, guest = {}) {
      const gsnap = await fs.getDoc(groupRef(code));
      const g = gsnap.data();
      if (!g.members.includes(uid)) {
        await fs.updateDoc(groupRef(code), { members: fs.arrayUnion(uid), [`memberInfo.${uid}`]: info, updatedAt: fs.serverTimestamp() });
      }
      const [ex, st] = await Promise.all([fs.getDocs(expensesCol(code)), fs.getDocs(settlementsCol(code))]);
      const writes = [];
      ex.docs.forEach(d => {
        const m = mergeGuestInExpense({ ...d.data(), id: d.id }, gid, uid, info);
        if (m) writes.push([d.ref, { ...m, updatedAt: fs.serverTimestamp() }]);
      });
      st.docs.forEach(d => {
        const x = d.data();
        if (x.from !== gid && x.to !== gid) return;
        const from = x.from === gid ? uid : x.from, to = x.to === gid ? uid : x.to;
        if (from === to) writes.push([d.ref, null]);  // تسوية بين الضيف ونفسه بعد الدمج
        else writes.push([d.ref, { from, to, fromName: x.from === gid ? info.name : x.fromName, toName: x.to === gid ? info.name : x.toName }]);
      });
      for (let i = 0; i < writes.length; i += 400) {
        const batch = fs.writeBatch(db);
        writes.slice(i, i + 400).forEach(([ref, data]) => (data ? batch.update(ref, data) : batch.delete(ref)));
        await batch.commit();
      }
      const phone = guest.phone || g.guests?.[gid]?.phone || '';
      const upd = { [`guests.${gid}`]: fs.deleteField(), updatedAt: fs.serverTimestamp() };
      if (phone) upd.guestPhoneEmails = fs.arrayRemove(phoneToAuthEmail(phone));
      await fs.updateDoc(groupRef(code), upd);
    },

    /** الربط التلقائي: يبحث عن ضيوف برقم المستخدم (حسابات الجوال) ويدمجهم في حسابه */
    async autoClaimGuests(user, info) {
      if (!user.authEmail || !isPhoneAuthEmail(user.authEmail)) return [];
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'groups'), fs.where('guestPhoneEmails', 'array-contains', user.authEmail)));
      const claimed = [];
      for (const d of snap.docs) {
        const g = d.data();
        for (const [gid, guest] of Object.entries(g.guests || {})) {
          if (guest.phone && phoneToAuthEmail(guest.phone) === user.authEmail) {
            await this.claimGuest(d.id, gid, user.uid, info, guest);
            claimed.push(g.name);
          }
        }
      }
      return claimed;
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
