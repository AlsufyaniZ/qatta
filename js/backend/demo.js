import { mergeGuestInExpense, memberInfoFrom } from '../models.js';
// ─────────────────────────────────────────────
// Demo backend — نفس واجهة firebase.js ببيانات محلية (localStorage)
// يعمل عند ترك إعدادات Firebase فارغة أو عند فتح الرابط بـ ?demo
// ─────────────────────────────────────────────

const KEY = 'qatta-demo-v4';
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const ME = 'user_001';
const DEMO_USER = { uid: ME, email: '', displayName: 'محمد العلي', method: 'phone' };

const M = {
  user_001: { name: 'محمد العلي',   phone: '+966501112233', avatarColor: '#4F6AF0' },
  user_002: { name: 'سارة الأحمد',  phone: '+966509998877', avatarColor: '#E25C5C', bankName: 'مصرف الراجحي', iban: 'SA0380000000608010167519' },
  user_003: { name: 'خالد المطيري', phone: '+966507776655', avatarColor: '#4CAF82' },
  user_004: { name: 'نورة السعد',   phone: '+966505554433', avatarColor: '#F0A84F' },
};
const P = (uid, shareAmount, isPaid) => ({ id: uid, ...M[uid], shareAmount, isPaid });
const exp = (id, title, totalAmount, category, paidBy, participants, days, note = null) => ({
  id, title, totalAmount, currency: 'SAR', category, paidByUserId: paidBy, createdBy: paidBy,
  participants, participantIds: participants.map(p => p.id), splitMethod: 'equal', note,
  createdAt: daysAgo(days), updatedAt: daysAgo(days),
});

function seed() {
  return {
    session: false,
    profile: { name: M.user_001.name, phone: M.user_001.phone, email: '', avatarColor: M.user_001.avatarColor },
    groups: {
      HOME2026: {
        name: 'قطة المنزل', emoji: '🏠', createdBy: ME, members: [ME, 'user_002'],
        memberInfo: { [ME]: M.user_001, user_002: M.user_002 }, createdAt: daysAgo(120), updatedAt: daysAgo(1),
        settlements: [
          { id: 's2', from: 'user_002', to: ME, amount: 1500, fromName: M.user_002.name, toName: M.user_001.name, createdBy: 'user_002', createdAt: daysAgo(38) },
          { id: 's3', from: ME, to: 'user_002', amount: 172.5, fromName: M.user_001.name, toName: M.user_002.name, createdBy: ME, createdAt: daysAgo(90) },
        ],
        expenses: [
          exp('e1', 'كارفور - تسوق شهري', 850, 'shopping', 'user_002', [P(ME, 425, false), P('user_002', 425, true)], 5),
          exp('e2', 'فاتورة الكهرباء', 460, 'housing', ME, [P(ME, 230, true), P('user_002', 230, false)], 12),
          exp('e3', 'إيجار الشهر الماضي', 3000, 'housing', ME, [P(ME, 1500, true), P('user_002', 1500, true)], 40),
          exp('e4', 'إنترنت', 345, 'housing', 'user_002', [P(ME, 172.5, true), P('user_002', 172.5, true)], 95),
        ],
      },
      ISTRAHA7: {
        name: 'قطة الاستراحة', emoji: '🏕️', createdBy: 'user_003', members: ['user_003', ME, 'user_004'],
        guests: { g_fahad: { name: 'فهد الشمري', phone: '', avatarColor: '#9B59B6', initials: '', addedBy: ME } },
        memberInfo: { user_003: M.user_003, [ME]: M.user_001, user_004: M.user_004 }, createdAt: daysAgo(60), updatedAt: daysAgo(2),
        settlements: [
          { id: 's4', from: 'user_004', to: 'user_003', amount: 50, fromName: M.user_004.name, toName: M.user_003.name, createdBy: 'user_004', createdAt: daysAgo(8) },
        ],
        expenses: [
          exp('e5', 'عشاء في مطعم البيك', 240, 'food', ME, [P(ME, 80, true), P('user_003', 80, false), P('user_004', 80, false)], 2, 'احتفال عيد ميلاد خالد'),
          exp('e8', 'قهوة وحلا', 90, 'food', 'g_fahad', [P(ME, 30, false), { id: 'g_fahad', name: 'فهد الشمري', phone: '', avatarColor: '#9B59B6', shareAmount: 30, isGuest: true }, P('user_004', 30, false)], 3),
          exp('e6', 'حطب وفحم', 150, 'other', 'user_003', [P('user_003', 50, true), P(ME, 50, false), P('user_004', 50, true)], 9),
        ],
      },
      TRIP9DMM: {
        name: 'قطة السفر', emoji: '✈️', createdBy: ME, members: [ME, 'user_003', 'user_004'],
        memberInfo: { [ME]: M.user_001, user_003: M.user_003, user_004: M.user_004 }, createdAt: daysAgo(200), updatedAt: daysAgo(150),
        settlements: [{ id: 's1', from: 'user_003', to: ME, amount: 400, fromName: M.user_003.name, toName: M.user_001.name, createdBy: 'user_003', createdAt: daysAgo(140) }],
        expenses: [
          exp('e7', 'رحلة الدمام - الفندق', 1200, 'travel', ME, [P(ME, 400, true), P('user_003', 400, true), P('user_004', 400, false)], 150),
        ],
      },
    },
  };
}

export function createDemoBackend() {
  let memoryFallback = null;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return memoryFallback; } };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { memoryFallback = db; } };

  let db = load() || seed();
  persist();

  const authL = new Set();
  const groupL = new Set();
  const expL = new Map(); // code → Set(cb)
  const setL = new Map(); // code → Set(cb)

  const reviveG = (code, g) => ({ id: code, name: g.name, emoji: g.emoji, createdBy: g.createdBy, members: [...g.members], guests: JSON.parse(JSON.stringify(g.guests || {})),
    memberInfo: JSON.parse(JSON.stringify(g.memberInfo)), createdAt: new Date(g.createdAt), updatedAt: new Date(g.updatedAt) });
  const reviveE = (e) => ({ ...e, participants: e.participants.map(p => ({ ...p })), createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt) });
  const myGroups = () => Object.entries(db.groups).filter(([, g]) => g.members.includes(ME)).map(([c, g]) => reviveG(c, g));

  const emitAuth = () => { const u = db.session ? { ...DEMO_USER } : null; authL.forEach(cb => cb(u)); };
  const emitGroups = () => { const l = myGroups(); groupL.forEach(cb => cb(l)); };
  const reviveS = (x) => ({ ...x, createdAt: new Date(x.createdAt) });
  const emitSet = (code) => { const l = (db.groups[code]?.settlements || []).map(reviveS); setL.get(code)?.forEach(cb => cb(l)); };
  const emitExp = (code) => { const l = (db.groups[code]?.expenses || []).map(reviveE); expL.get(code)?.forEach(cb => cb(l)); };
  const fail = (code) => { const e = new Error(code); e.code = code; throw e; };
  const login = () => { db.session = true; persist(); emitAuth(); };

  return {
    mode: 'demo',

    onAuth(cb) { authL.add(cb); setTimeout(() => cb(db.session ? { ...DEMO_USER } : null), 0); return () => authL.delete(cb); },
    async signInPhone(e164, pw) { await delay(600); if (!pw || pw.length < 6) fail('phone/invalid-credential'); login(); },
    async signUpPhone(e164, pw, profile) { await delay(600); db.profile = { ...db.profile, ...profile, phone: e164 }; login(); },
    async signInEmail(email, pw) { await delay(600); if (!pw || pw.length < 6) fail('auth/invalid-credential'); login(); },
    async signUpEmail(email, pw, profile) { await delay(600); db.profile = { ...db.profile, ...profile, email }; login(); },
    async signInGoogle() { await delay(600); login(); },
    async resetPassword() { await delay(400); },
    async signOut() { db.session = false; persist(); emitAuth(); },

    async getProfile() { return db.profile ? { ...db.profile } : null; },
    async saveProfile(uid, data, codes = []) {
      db.profile = { ...db.profile, ...data };
      for (const c of codes) if (db.groups[c]) db.groups[c].memberInfo[uid] = memberInfoFrom(data);
      persist(); emitGroups();
    },

    subscribeGroups(uid, onData) { groupL.add(onData); setTimeout(() => onData(myGroups()), 200); return () => groupL.delete(onData); },
    async createGroup(code, { name, emoji }, uid, info) {
      await delay(300);
      const now = new Date().toISOString();
      db.groups[code] = { name, emoji, createdBy: uid, members: [uid], memberInfo: { [uid]: info }, createdAt: now, updatedAt: now, expenses: [], settlements: [] };
      persist(); emitGroups();
    },
    async joinGroup(code, uid, info) {
      await delay(300);
      const g = db.groups[code];
      if (!g) fail('not-found');
      if (!g.members.includes(uid)) g.members.push(uid);
      g.memberInfo[uid] = info;
      persist(); emitGroups();
    },
    async updateGroup(code, { name, emoji }) {
      const g = db.groups[code]; if (!g) return;
      g.name = name; g.emoji = emoji; g.updatedAt = new Date().toISOString();
      persist(); emitGroups();
    },
    async addGuest(code, gid, info) {
      const g = db.groups[code]; if (!g) return;
      (g.guests ||= {})[gid] = info; persist(); emitGroups();
    },
    async updateGuest(code, gid, info) {
      const g = db.groups[code]; if (!g) return;
      (g.guests ||= {})[gid] = info; persist(); emitGroups();
    },
    async removeGuest(code, gid) {
      const g = db.groups[code]; if (!g?.guests) return;
      delete g.guests[gid]; persist(); emitGroups();
    },
    async claimGuest(code, gid, uid, info) {
      const g = db.groups[code]; if (!g) return;
      if (!g.members.includes(uid)) { g.members.push(uid); g.memberInfo[uid] = info; }
      for (const e of g.expenses) {
        const m = mergeGuestInExpense(e, gid, uid, info);
        if (m) Object.assign(e, m, { updatedAt: new Date().toISOString() });
      }
      g.settlements = (g.settlements || []).map(x => ({
        ...x, from: x.from === gid ? uid : x.from, to: x.to === gid ? uid : x.to,
        fromName: x.from === gid ? info.name : x.fromName, toName: x.to === gid ? info.name : x.toName,
      })).filter(x => x.from !== x.to);
      if (g.guests) delete g.guests[gid];
      persist(); emitGroups(); emitExp(code); emitSet(code);
    },
    async autoClaimGuests() { return []; },
    async addRecoveryEmail() { await delay(400); },
    async deleteGroup(code) { delete db.groups[code]; persist(); emitGroups(); },

    subscribeExpenses(code, onData) {
      if (!expL.has(code)) expL.set(code, new Set());
      expL.get(code).add(onData);
      setTimeout(() => onData((db.groups[code]?.expenses || []).map(reviveE)), 150);
      return () => expL.get(code)?.delete(onData);
    },
    async addExpense(code, e) {
      const now = new Date().toISOString();
      db.groups[code].expenses.push({ ...e, id: 'e_' + Math.random().toString(36).slice(2, 9), createdAt: (e.createdAt || new Date()).toISOString(), updatedAt: now });
      db.groups[code].updatedAt = now;
      persist(); emitExp(code); emitGroups();
    },
    async updateExpense(code, id, data) {
      const e = db.groups[code]?.expenses.find(x => x.id === id);
      if (!e) return;
      const { createdAt, id: _i, ...rest } = data;
      Object.assign(e, rest, { updatedAt: new Date().toISOString() });
      persist(); emitExp(code);
    },
    subscribeSettlements(code, onData) {
      if (!setL.has(code)) setL.set(code, new Set());
      setL.get(code).add(onData);
      setTimeout(() => onData((db.groups[code]?.settlements || []).map(reviveS)), 150);
      return () => setL.get(code)?.delete(onData);
    },
    async addSettlement(code, x) {
      const g = db.groups[code]; if (!g) return;
      (g.settlements ||= []).push({ ...x, id: 's_' + Math.random().toString(36).slice(2, 9), createdAt: new Date().toISOString() });
      persist(); emitSet(code);
    },
    async deleteSettlement(code, id) {
      const g = db.groups[code]; if (!g) return;
      g.settlements = (g.settlements || []).filter(x => x.id !== id);
      persist(); emitSet(code);
    },
    async leaveGroup(code, uid) {
      const g = db.groups[code]; if (!g) return;
      g.members = g.members.filter(m => m !== uid);
      persist(); emitGroups();
    },
    async removeMember(code, uid) {
      const g = db.groups[code]; if (!g) return;
      g.members = g.members.filter(m => m !== uid);
      persist(); emitGroups();
    },
    async deleteExpense(code, id) {
      db.groups[code].expenses = db.groups[code].expenses.filter(x => x.id !== id);
      persist(); emitExp(code);
    },

    async resetDemo() {
      const s = db.session; db = seed(); db.session = s; persist();
      emitGroups(); for (const c of expL.keys()) emitExp(c); for (const c of setL.keys()) emitSet(c);
    },
  };
}
