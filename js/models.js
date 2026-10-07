// ─────────────────────────────────────────────
// Models & domain logic — Qatta (قطة)
// ─────────────────────────────────────────────

/** فئات المصاريف */
export const CATEGORIES = [
  { id: 'food',          name: 'طعام وشراب', icon: 'food' },
  { id: 'transport',     name: 'مواصلات',    icon: 'car' },
  { id: 'housing',       name: 'سكن وإيجار', icon: 'house' },
  { id: 'entertainment', name: 'ترفيه',      icon: 'game' },
  { id: 'shopping',      name: 'تسوق',       icon: 'bag' },
  { id: 'travel',        name: 'سفر',        icon: 'plane' },
  { id: 'health',        name: 'صحة',        icon: 'health' },
  { id: 'other',         name: 'أخرى',       icon: 'more' },
];
export const category = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

/** المصطلحات الموحّدة في الواجهة */
export const T = {
  owedToMe: 'لي',
  iOwe: 'علي',
  closing: 'تصفية الحسابات',
};

/** ألوان الفئات (ثابتة لكل فئة — اللون يتبع الفئة لا ترتيبها) */
export const CATEGORY_COLORS = {
  light: { food: '#2a78d6', transport: '#eb6834', housing: '#1baf7a', entertainment: '#eda100', shopping: '#e87ba4', travel: '#008300', health: '#4a3aa7', other: '#e34948' },
  dark:  { food: '#3987e5', transport: '#d95926', housing: '#199e70', entertainment: '#c98500', shopping: '#d55181', travel: '#008300', health: '#9085e9', other: '#e66767' },
};

/** المدى الزمني للمصاريف الإجمالية */
export const PERIODS = [
  { id: '1m',  label: 'شهر',      months: 1 },
  { id: '3m',  label: '٣ أشهر',   months: 3 },
  { id: '6m',  label: '٦ أشهر',   months: 6 },
  { id: '9m',  label: '٩ أشهر',   months: 9 },
  { id: '12m', label: 'سنة',      months: 12 },
  { id: 'all', label: 'الكل',     months: null },
];
export const STATS_PERIODS = PERIODS.filter(p => p.months);
export function periodStart(periodId) {
  const p = PERIODS.find(x => x.id === periodId);
  if (!p || !p.months) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - p.months);
  return d;
}

/** رموز المجموعات وقوالب جاهزة */
export const GROUP_EMOJIS = ['🏠', '🏕️', '✈️', '🍽️', '🎉', '☕', '⚽', '🛒', '💼', '👨‍👩‍👧', '🎮', '🚗'];
export const GROUP_TEMPLATES = [
  { name: 'قطة المنزل', emoji: '🏠' },
  { name: 'قطة الاستراحة', emoji: '🏕️' },
  { name: 'قطة السفر', emoji: '✈️' },
];

/** لوحة ألوان الصور الرمزية */
export const AVATAR_PALETTE = ['#4F6AF0', '#E25C5C', '#4CAF82', '#F0A84F', '#9B59B6', '#2E86AB', '#E67E22', '#1ABC9C'];
export const randomAvatarColor = () => AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];

/** رموز الدول */
export const COUNTRY_CODES = [
  { flag: '🇸🇦', code: '+966', name: 'السعودية' },
  { flag: '🇦🇪', code: '+971', name: 'الإمارات' },
  { flag: '🇰🇼', code: '+965', name: 'الكويت' },
  { flag: '🇶🇦', code: '+974', name: 'قطر' },
  { flag: '🇧🇭', code: '+973', name: 'البحرين' },
  { flag: '🇴🇲', code: '+968', name: 'عُمان' },
  { flag: '🇯🇴', code: '+962', name: 'الأردن' },
  { flag: '🇪🇬', code: '+20',  name: 'مصر' },
];

/** الأحرف الأولى من الاسم: "محمد العلي" → "مع" */
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const first = (w) => (w.startsWith('ال') && w.length > 3 ? w[2] : w[0]);
  if (parts.length >= 2) return parts[0][0] + first(parts[1]);
  return (parts[0] || '؟').slice(0, 2);
}

/** يحوّل الأرقام العربية-الهندية والفواصل إلى أرقام لاتينية */
export function normalizeDigits(s = '') {
  return String(s)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٫,]/g, '.');
}
export function parseAmount(s) {
  const n = parseFloat(normalizeDigits(s));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * يبني رقماً دولياً (E.164) من رمز الدولة والرقم المحلي.
 * "0501234567" + "+966" → "+966501234567". يرجع null إذا كان غير صالح.
 */
export function toE164(countryCode, local) {
  let d = normalizeDigits(local).replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('+')) {
    const digits = d.slice(1).replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15 ? '+' + digits : null;
  }
  d = d.replace(/\D/g, '').replace(/^0+/, '');
  const cc = countryCode.replace('+', '');
  if (d.startsWith(cc) && d.length > 10) d = d.slice(cc.length);
  if (d.length < 7 || d.length > 11) return null;
  return '+' + cc + d;
}

/** البريد الداخلي المستخدم لحسابات الجوال في Firebase Auth */
export const PHONE_EMAIL_DOMAIN = 'phone.qatta.app';
export const phoneToAuthEmail = (e164) => `${e164.replace('+', '')}@${PHONE_EMAIL_DOMAIN}`;
export const isPhoneAuthEmail = (email = '') => email.endsWith('@' + PHONE_EMAIL_DOMAIN);

/** رمز المجموعة: 8 أحرف بدون أحرف ملتبسة (0/O، 1/I) */
export function newGroupCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map(b => A[b % A.length]).join('');
}

/** تقسيم متساوٍ بدقة الهللة — فرق التقريب على أول مشارك */
export function equalShares(total, count) {
  if (!count) return [];
  const base = Math.floor((total / count) * 100) / 100;
  const shares = Array(count).fill(base);
  shares[0] = round2(total - base * (count - 1));
  return shares;
}

// ── Helpers تعتمد على المستخدم الحالي ──
export const isMe = (p, me) => !!p && !!me && p.id === me.uid;
export const myParticipant = (exp, me) => exp.participants.find(p => isMe(p, me));
export const iAmPayer = (exp, me) => exp.paidByUserId === me.uid;
export const payerOf = (exp) => exp.participants.find(p => p.id === exp.paidByUserId);

/** فروقات التقريب أقل من 10 هللات تُهمل في التسوية */
export const SETTLE_EPS = 0.1;
export const isZero = (n) => Math.abs(n) < SETTLE_EPS;

/**
 * صافي كل شخص في المجموعة = ما دفعه − حصته من المصاريف + ما حوّله − ما استلمه
 * موجب: له فلوس عند الآخرين · سالب: عليه فلوس
 * التسوية {from, to, amount}: from حوّل إلى to
 */
export function groupNets(expenses = [], settlements = [], group = null) {
  const nets = new Map();
  const info = (group && group.memberInfo) || {};
  const touch = (id, p) => {
    if (!nets.has(id)) {
      const i = info[id] || group?.guests?.[id] || p || {};
      nets.set(id, {
        id, net: 0, name: i.name || 'عضو', avatarColor: i.avatarColor || '#A9AECB', phone: i.phone || '', initials: i.initials || '',
        isGuest: !!(p && p.isGuest), isMember: !!group?.members?.includes(id),
      });
    }
    return nets.get(id);
  };
  for (const m of (group?.members || [])) touch(m);
  for (const [gid, g] of Object.entries(group?.guests || {})) { touch(gid, { ...g, isGuest: true }).isMember = true; nets.get(gid).isGuest = true; }
  for (const e of expenses) {
    const payer = e.participants.find(p => p.id === e.paidByUserId);
    touch(e.paidByUserId, payer).net += e.totalAmount || 0;
    for (const p of e.participants) touch(p.id, p).net -= p.shareAmount || 0;
  }
  for (const s of settlements) {
    touch(s.from, { name: s.fromName }).net += s.amount;
    touch(s.to, { name: s.toName }).net -= s.amount;
  }
  for (const v of nets.values()) v.net = round2(v.net);
  return nets;
}

/** أقل عدد من التحويلات: مطابقة أكبر مدين مع أكبر دائن */
export function simplifyDebts(nets) {
  const cred = [], debt = [];
  for (const v of nets.values()) {
    if (v.net >= SETTLE_EPS) cred.push({ ...v, left: v.net });
    else if (v.net <= -SETTLE_EPS) debt.push({ ...v, left: -v.net });
  }
  cred.sort((a, b) => b.left - a.left);
  debt.sort((a, b) => b.left - a.left);
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = round2(Math.min(debt[i].left, cred[j].left));
    if (amt >= SETTLE_EPS) out.push({ from: debt[i], to: cred[j], amount: amt });
    debt[i].left = round2(debt[i].left - amt);
    cred[j].left = round2(cred[j].left - amt);
    if (debt[i].left < SETTLE_EPS) i++;
    if (cred[j].left < SETTLE_EPS) j++;
  }
  return out;
}

/** رصيدي في مجموعة بعد التسوية الصافية */
export function myBalance(expenses, settlements, group, me) {
  const net = groupNets(expenses, settlements, group).get(me.uid)?.net || 0;
  return { net: isZero(net) ? 0 : net, owedToMe: net >= SETTLE_EPS ? net : 0, iOwe: net <= -SETTLE_EPS ? -net : 0 };
}

/** إجمالي المصاريف وحصتي ضمن فترة */
export function periodTotals(expenses, me, periodId) {
  const start = periodStart(periodId);
  const inRange = start ? expenses.filter(e => e.createdAt >= start) : expenses;
  const total = round2(inRange.reduce((s, e) => s + (e.totalAmount || 0), 0));
  const myShare = round2(inRange.reduce((s, e) => s + (myParticipant(e, me)?.shareAmount || 0), 0));
  return { total, myShare, count: inRange.length };
}

/** المصاريف حسب الفئة لفترة (للإحصائيات) */
export function categoryBreakdown(expenses, periodId) {
  const start = periodStart(periodId);
  const list = start ? expenses.filter(e => e.createdAt >= start) : expenses;
  const sums = new Map();
  for (const e of list) {
    const c = e.category || 'other';
    sums.set(c, (sums.get(c) || 0) + (e.totalAmount || 0));
  }
  const total = round2([...sums.values()].reduce((a, b) => a + b, 0));
  const rows = [...sums.entries()]
    .map(([id, amount]) => ({ ...category(id), amount: round2(amount), pct: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return { total, rows, count: list.length };
}

/** المصاريف ضمن الفترة مرتبة بالأحدث */
export function expensesInPeriod(expenses, periodId) {
  const start = periodStart(periodId);
  return expenses.filter(e => !start || e.createdAt >= start).sort((a, b) => b.createdAt - a.createdAt);
}

/** معلومات العضو المعروضة داخل المجموعة */
export const memberInfoFrom = (profile) => ({
  name: profile.name || '',
  phone: profile.phone || '',
  avatarColor: profile.avatarColor || AVATAR_PALETTE[0],
  initials: profile.initials || '',
  bankName: profile.bankName || '',
  iban: profile.iban || '',
  accountHolder: profile.accountHolder || '',
});

// ── الحساب البنكي (IBAN) ──
export function normalizeIban(s = '') {
  return normalizeDigits(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export function isValidIban(s) {
  const v = normalizeIban(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  if (v.startsWith('SA') && v.length !== 24) return false;
  // تحقق MOD-97 القياسي
  const r = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let m = 0;
  for (const ch of r) m = (m * 10 + +ch) % 97;
  return m === 1;
}
export const formatIban = (s = '') => normalizeIban(s).replace(/(.{4})/g, '$1 ').trim();
export const SAUDI_BANKS = ['مصرف الراجحي', 'البنك الأهلي السعودي', 'بنك الرياض', 'البنك السعودي الأول (ساب)', 'البنك السعودي الفرنسي',
  'البنك العربي الوطني', 'بنك البلاد', 'مصرف الإنماء', 'بنك الجزيرة', 'البنك السعودي للاستثمار', 'بنك الخليج الدولي', 'STC Bank', 'D360 Bank'];

/** قائمة أعضاء المجموعة كمصفوفة مرتبة (المنشئ أولاً) */
export function groupMembers(group, { withGuests = true } = {}) {
  const info = group.memberInfo || {};
  const users = (group.members || []).map(uid => ({ uid, isGuest: false, ...(info[uid] || { name: 'عضو', phone: '', avatarColor: '#A9AECB' }) }))
    .sort((a, b) => (a.uid === group.createdBy ? -1 : b.uid === group.createdBy ? 1 : 0));
  if (!withGuests) return users;
  const guests = Object.entries(group.guests || {}).map(([gid, g]) => ({ uid: gid, ...g, isGuest: true }));
  return [...users, ...guests];
}

/** دمج ضيف في حساب مستخدم داخل مصروف: يُنقل الدفع والحصة (وتُجمع الحصص إن وُجد الاثنان) */
export function mergeGuestInExpense(e, gid, uid, info) {
  const has = e.participants.some(p => p.id === gid) || e.paidByUserId === gid;
  if (!has) return null;
  const parts = [];
  for (const p of e.participants) {
    const id = p.id === gid ? uid : p.id;
    const ex = parts.find(x => x.id === id);
    if (ex) ex.shareAmount = round2((ex.shareAmount || 0) + (p.shareAmount || 0));
    else parts.push(p.id === gid ? { ...p, id: uid, isGuest: false, name: info.name, phone: info.phone || '', avatarColor: info.avatarColor, initials: info.initials || '' } : { ...p });
  }
  return {
    participants: parts,
    participantIds: parts.filter(p => !p.isGuest).map(p => p.id),
    paidByUserId: e.paidByUserId === gid ? uid : e.paidByUserId,
  };
}
