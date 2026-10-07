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
  owedToMe: 'الفلوس اللي لي',
  iOwe: 'الفلوس اللي علي',
  paid: 'مدفوع',
};

/** فلاتر قائمة المصاريف داخل المجموعة */
export const FILTERS = [
  { id: 'all',      label: 'الكل' },
  { id: 'iOwe',     label: T.iOwe },
  { id: 'owedToMe', label: T.owedToMe },
  { id: 'settled',  label: T.paid },
];

/** المدى الزمني للمصاريف الإجمالية */
export const PERIODS = [
  { id: '1m',  label: 'شهر',      months: 1 },
  { id: '3m',  label: '٣ أشهر',   months: 3 },
  { id: '6m',  label: '٦ أشهر',   months: 6 },
  { id: '9m',  label: '٩ أشهر',   months: 9 },
  { id: '12m', label: 'سنة',      months: 12 },
  { id: 'all', label: 'الكل',     months: null },
];
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

export const settledAmount = (exp) => exp.participants.filter(p => p.isPaid).reduce((s, p) => s + (p.shareAmount || 0), 0);
export const remainingAmount = (exp) => round2(exp.totalAmount - settledAmount(exp));
export const isFullySettled = (exp) => exp.participants.every(p => p.isPaid);

/** الأرصدة المستحقة (كل الفترات) */
export function balances(expenses, me) {
  let owedToMe = 0, iOwe = 0;
  for (const exp of expenses) {
    if (iAmPayer(exp, me)) {
      for (const p of exp.participants) if (!isMe(p, me) && !p.isPaid) owedToMe += p.shareAmount || 0;
    } else {
      const mine = myParticipant(exp, me);
      if (mine && !mine.isPaid) iOwe += mine.shareAmount || 0;
    }
  }
  owedToMe = round2(owedToMe); iOwe = round2(iOwe);
  return { owedToMe, iOwe, net: round2(owedToMe - iOwe) };
}

/** إجمالي المصاريف وحصتي ضمن فترة */
export function periodTotals(expenses, me, periodId) {
  const start = periodStart(periodId);
  const inRange = start ? expenses.filter(e => e.createdAt >= start) : expenses;
  const total = round2(inRange.reduce((s, e) => s + (e.totalAmount || 0), 0));
  const myShare = round2(inRange.reduce((s, e) => s + (myParticipant(e, me)?.shareAmount || 0), 0));
  return { total, myShare, count: inRange.length };
}

/** فلترة قائمة المصاريف — الديون غير المدفوعة تُعرض لكل الفترات */
export function filterExpenses(expenses, filter, me, periodId) {
  const byDate = (a, b) => b.createdAt - a.createdAt;
  const start = periodStart(periodId);
  const inPeriod = (e) => !start || e.createdAt >= start;
  let list;
  if (filter === 'iOwe') {
    list = expenses.filter(e => !iAmPayer(e, me) && e.participants.some(p => isMe(p, me) && !p.isPaid));
  } else if (filter === 'owedToMe') {
    list = expenses.filter(e => iAmPayer(e, me) && e.participants.some(p => !isMe(p, me) && !p.isPaid));
  } else if (filter === 'settled') {
    list = expenses.filter(e => isFullySettled(e) && inPeriod(e));
  } else {
    list = expenses.filter(inPeriod);
  }
  return [...list].sort(byDate);
}

/** معلومات العضو المعروضة داخل المجموعة */
export const memberInfoFrom = (profile) => ({
  name: profile.name || '',
  phone: profile.phone || '',
  avatarColor: profile.avatarColor || AVATAR_PALETTE[0],
});

/** قائمة أعضاء المجموعة كمصفوفة مرتبة (المنشئ أولاً) */
export function groupMembers(group) {
  const info = group.memberInfo || {};
  return (group.members || []).map(uid => ({ uid, ...(info[uid] || { name: 'عضو', phone: '', avatarColor: '#A9AECB' }) }))
    .sort((a, b) => (a.uid === group.createdBy ? -1 : b.uid === group.createdBy ? 1 : 0));
}
