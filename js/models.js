// ─────────────────────────────────────────────
// Models & domain logic — Qatta (قطة)
// مكافئ Models.swift + منطق الحساب في ViewModels.swift
// ─────────────────────────────────────────────

/** فئات المصاريف (ExpenseCategory) */
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

/** طرق التقسيم (SplitMethod) */
export const SPLIT = { equal: 'equal', custom: 'custom', percentage: 'percentage' };

/** فلاتر الشاشة الرئيسية (ExpenseFilter) */
export const FILTERS = [
  { id: 'all',      label: 'الكل' },
  { id: 'iOwe',     label: 'أنا مدين' },
  { id: 'owedToMe', label: 'لي دين' },
  { id: 'settled',  label: 'مسوّى' },
];

/** لوحة ألوان الصور الرمزية (AvatarColor.palette) */
export const AVATAR_PALETTE = ['#4F6AF0', '#E25C5C', '#4CAF82', '#F0A84F', '#9B59B6', '#2E86AB', '#E67E22', '#1ABC9C'];
export const randomAvatarColor = () => AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];

/** رموز الدول (نفس قائمة تطبيق الجوال) */
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

/** الأحرف الأولى من الاسم (تدعم الأسماء العربية) */
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  // تجاوز أداة التعريف "ال" في اسم العائلة: "محمد العلي" → "مع"
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
 * تقسيم متساوٍ بدقة الهللة: يُضاف فرق التقريب على أول مشارك (الدافع)
 * حتى يساوي مجموع الحصص المبلغ الكلي تماماً.
 */
export function equalShares(total, count) {
  if (!count) return [];
  const base = Math.floor((total / count) * 100) / 100;
  const shares = Array(count).fill(base);
  shares[0] = round2(total - base * (count - 1));
  return shares;
}

// ── Helpers تعتمد على المستخدم الحالي ──

/** هل هذا المشارك هو المستخدم الحالي؟ (بالمعرّف أو بالبريد) */
export function isMe(p, me) {
  if (!p || !me) return false;
  if (p.id === me.uid) return true;
  return !!(p.email && me.email && p.email.toLowerCase() === me.email.toLowerCase());
}
export const myParticipant = (exp, me) => exp.participants.find(p => isMe(p, me));
export const iAmPayer = (exp, me) => exp.paidByUserId === me.uid;
export const payerOf = (exp) => exp.participants.find(p => p.id === exp.paidByUserId);

export const settledAmount = (exp) => exp.participants.filter(p => p.isPaid).reduce((s, p) => s + (p.shareAmount || 0), 0);
export const remainingAmount = (exp) => round2(exp.totalAmount - settledAmount(exp));
export const isFullySettled = (exp) => exp.participants.every(p => p.isPaid);

/** الأرصدة (HomeViewModel) */
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

/** فلترة وترتيب المصاريف (filteredExpenses) */
export function filterExpenses(expenses, filter, me) {
  const byDate = (a, b) => b.createdAt - a.createdAt;
  let list = expenses;
  if (filter === 'iOwe') {
    list = expenses.filter(e => !iAmPayer(e, me) && e.participants.some(p => isMe(p, me) && !p.isPaid));
  } else if (filter === 'owedToMe') {
    list = expenses.filter(e => iAmPayer(e, me) && e.participants.some(p => !isMe(p, me) && !p.isPaid));
  } else if (filter === 'settled') {
    list = expenses.filter(isFullySettled);
  }
  return [...list].sort(byDate);
}
