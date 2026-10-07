// ─────────────────────────────────────────────
// Demo backend — نفس واجهة firebase.js لكن ببيانات محلية (localStorage)
// يُستخدم تلقائياً عندما تكون إعدادات Firebase فارغة، أو عند فتح الرابط بـ ?demo
// البيانات مأخوذة من MockData في تطبيق الجوال
// ─────────────────────────────────────────────

const KEY = 'qatta-demo-v1';
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const DEMO_USER = {
  uid: 'user_001',
  email: 'demo@qatta.app',
  displayName: 'محمد العلي',
  emailVerified: true,
  isGoogle: false,
};

const P = {
  mohammed: { id: 'user_001', name: 'محمد العلي',   phone: '+966501112233', email: 'demo@qatta.app', avatarColor: '#4F6AF0' },
  sara:     { id: 'user_002', name: 'سارة الأحمد',  phone: '+966509998877', email: '', avatarColor: '#E25C5C' },
  khalid:   { id: 'user_003', name: 'خالد المطيري', phone: '+966507776655', email: '', avatarColor: '#4CAF82' },
  noura:    { id: 'user_004', name: 'نورة السعد',   phone: '+966505554433', email: '', avatarColor: '#F0A84F' },
};
const part = (p, shareAmount, isPaid) => ({ ...p, shareAmount, isPaid });

function seed() {
  return {
    session: false,
    profile: { name: P.mohammed.name, phone: P.mohammed.phone, email: DEMO_USER.email, avatarColor: P.mohammed.avatarColor },
    expenses: [
      {
        id: 'exp_001', title: 'عشاء في مطعم البيك', totalAmount: 320, currency: 'SAR', category: 'food',
        paidByUserId: 'user_001', ownerId: 'user_001', splitMethod: 'equal', note: 'احتفال عيد ميلاد خالد',
        participants: [part(P.mohammed, 80, true), part(P.sara, 80, true), part(P.khalid, 80, false), part(P.noura, 80, false)],
        memberEmails: [], createdAt: daysAgo(2), updatedAt: daysAgo(2),
      },
      {
        id: 'exp_002', title: 'كارفور - تسوق شهري', totalAmount: 850, currency: 'SAR', category: 'shopping',
        paidByUserId: 'user_002', ownerId: 'user_002', splitMethod: 'equal', note: null,
        participants: [part(P.mohammed, 425, false), part(P.sara, 425, true)],
        memberEmails: [DEMO_USER.email], createdAt: daysAgo(5), updatedAt: daysAgo(5),
      },
      {
        id: 'exp_003', title: 'رحلة الدمام', totalAmount: 1200, currency: 'SAR', category: 'travel',
        paidByUserId: 'user_001', ownerId: 'user_001', splitMethod: 'equal', note: null,
        participants: [part(P.mohammed, 400, true), part(P.khalid, 400, true), part(P.noura, 400, false)],
        memberEmails: [], createdAt: daysAgo(10), updatedAt: daysAgo(10),
      },
    ],
  };
}

export function createDemoBackend() {
  let memoryFallback = null;
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return memoryFallback; }
  };
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { memoryFallback = db; }
  };

  let db = load() || seed();
  persist();

  const authListeners = new Set();
  const expenseListeners = new Set();
  const revive = (e) => ({ ...e, participants: e.participants.map(p => ({ ...p })), createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt) });
  const emitExpenses = () => { const list = db.expenses.map(revive); expenseListeners.forEach(cb => cb(list)); };
  const emitAuth = () => { const u = db.session ? { ...DEMO_USER } : null; authListeners.forEach(cb => cb(u)); };
  const fail = (code) => { const e = new Error(code); e.code = code; throw e; };

  return {
    mode: 'demo',

    onAuth(cb) {
      authListeners.add(cb);
      setTimeout(() => cb(db.session ? { ...DEMO_USER } : null), 0);
      return () => authListeners.delete(cb);
    },
    async signInEmail(email, password) {
      await delay(700);
      if (!password || password.length < 6) fail('auth/invalid-credential');
      db.session = true; persist(); emitAuth();
    },
    async signUpEmail(name, email, password) {
      await delay(700);
      if (password.length < 6) fail('auth/weak-password');
      db.session = true; db.profile.name = name || db.profile.name; persist(); emitAuth();
    },
    async signInGoogle() {
      await delay(700);
      db.session = true; persist(); emitAuth();
    },
    async resetPassword() { await delay(500); },
    async resendVerification() { await delay(300); },
    async reloadUser() { return db.session ? { ...DEMO_USER } : null; },
    async signOut() { db.session = false; persist(); emitAuth(); },

    async getProfile() { return db.profile ? { ...db.profile } : null; },
    async saveProfile(uid, data) { db.profile = { ...db.profile, ...data }; persist(); },

    subscribeExpenses(user, onData) {
      expenseListeners.add(onData);
      setTimeout(() => onData(db.expenses.map(revive)), 250);
      return () => expenseListeners.delete(onData);
    },
    async addExpense(expense) {
      const id = 'exp_' + Math.random().toString(36).slice(2, 10);
      const now = new Date().toISOString();
      db.expenses.push({ ...expense, id, createdAt: (expense.createdAt || new Date()).toISOString(), updatedAt: now });
      persist(); emitExpenses();
      return id;
    },
    async updateParticipants(expenseId, participants) {
      const e = db.expenses.find(x => x.id === expenseId);
      if (!e) return;
      e.participants = participants; e.updatedAt = new Date().toISOString();
      persist(); emitExpenses();
    },
    async deleteExpense(expenseId) {
      db.expenses = db.expenses.filter(x => x.id !== expenseId);
      persist(); emitExpenses();
    },

    /** خاص بالوضع التجريبي: يعيد البيانات الافتراضية */
    async resetDemo() {
      const session = db.session;
      db = seed(); db.session = session; persist(); emitExpenses();
    },
  };
}
