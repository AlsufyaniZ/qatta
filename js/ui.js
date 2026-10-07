// ─────────────────────────────────────────────
// UI helpers — مكافئ DesignSystem.swift
// ─────────────────────────────────────────────
import { initials } from './models.js';

/** Escape HTML */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ── Icons (stroke icons, 24×24) ──
const ICONS = {
  food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  house: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  game: '<line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  health: '<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>',
  more: '<circle cx="12" cy="12" r="10"/><path d="M17 12h.01"/><path d="M12 12h.01"/><path d="M7 12h.01"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  note: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  contacts: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  arrowDown: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="m8 12 4 4 4-4"/>',
  arrowUp: '<circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>',
  list: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h6"/>',
  badgeCheck: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  equal: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 10h8"/><path d="M8 14h8"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
};

export function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export const GOOGLE_LOGO = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>`;

// ── AvatarView ──
export function avatar(name, color = '#4F6AF0', size = 44) {
  return `<span class="avatar" style="--c:${esc(color)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.33)}px">${esc(initials(name))}</span>`;
}

// ── Formatting ──
// رمز الريال السعودي الجديد (U+20C1) — يُعرض بخط saudi_riyal (انظر styles.css)
export let RIYAL = '\u20C1';
/** يتأكد من تحميل خط رمز الريال؛ إن تعذّر يُستخدم «ر.س» بدلاً منه */
export async function ensureRiyalFont(timeout = 2500) {
  try {
    const faces = await Promise.race([
      document.fonts.load('16px "SaudiRiyal"', '\u20C1'),
      new Promise(r => setTimeout(() => r(null), timeout)),
    ]);
    if (!faces || !faces.length) RIYAL = 'ر.س';
  } catch { RIYAL = 'ر.س'; }
  document.documentElement.classList.toggle('riyal-fallback', RIYAL !== '\u20C1');
}
const amountFmt = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
/** مبلغ للعرض في الواجهة (HTML) مع رمز الريال */
export function money(n) {
  return `<span class="money"><bdi>${amountFmt.format(n || 0)}</bdi><span class="riyal" role="img" aria-label="ريال">${RIYAL}</span></span>`;
}
/** مبلغ كنص عادي (للمشاركة في واتساب) */
const plainFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const moneyText = (n) => `${plainFmt.format(n || 0)} ريال`;
const numFmt = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 });
export const num = (n) => numFmt.format(n || 0);

const rtf = new Intl.RelativeTimeFormat('ar-SA', { numeric: 'auto', style: 'short' });
export function relTime(date) {
  const diff = (date - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

export function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'صباح الخير 🌅';
  if (h >= 12 && h < 17) return 'مساء النور ☀️';
  if (h >= 17 && h < 21) return 'مساء الخير 🌇';
  return 'مرحباً 🌙';
}

// ── Form field (label + icon + input) ──
export function field({ id, label, ic, type = 'text', placeholder = '', value = '', autocomplete = 'off', dir = '', inputmode = '' }) {
  return `
    <label class="field" for="${id}">
      <span class="field-label">${esc(label)}</span>
      <span class="field-box">
        ${icon(ic, 18)}
        <input id="${id}" name="${id}" type="${type}" placeholder="${esc(placeholder)}" value="${esc(value)}"
          autocomplete="${autocomplete}" ${dir ? `dir="${dir}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}>
      </span>
    </label>`;
}

// ── Buttons ──
export function setLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading || btn.dataset.disabled === 'true';
}

export function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// ── Toast ──
export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : 'checkCircle', 18)}<span>${esc(message)}</span>`;
  root.append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

// ── Firebase error → رسالة عربية ──
const ERRORS = {
  'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
  'auth/missing-email': 'يرجى إدخال البريد الإلكتروني',
  'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
  'auth/wrong-password': 'البريد أو كلمة المرور غير صحيحة',
  'auth/user-not-found': 'لا يوجد حساب بهذا البريد',
  'auth/email-already-in-use': 'هذا البريد مسجّل بالفعل. جرّب تسجيل الدخول',
  'auth/weak-password': 'كلمة المرور ضعيفة — 6 أحرف على الأقل',
  'auth/too-many-requests': 'محاولات كثيرة. يرجى المحاولة لاحقاً',
  'auth/network-request-failed': 'تعذّر الاتصال بالشبكة',
  'auth/popup-closed-by-user': 'تم إغلاق نافذة Google قبل إكمال الدخول',
  'auth/cancelled-popup-request': 'تم إلغاء طلب الدخول',
  'auth/unauthorized-domain': 'هذا النطاق غير مصرّح به في Firebase. أضفه في Authentication → Settings → Authorized domains',
  'auth/operation-not-allowed': 'طريقة الدخول هذه غير مفعّلة في Firebase Console',
  'auth/account-exists-with-different-credential': 'يوجد حساب بهذا البريد بطريقة دخول مختلفة',
  'phone/invalid-credential': 'رقم الجوال أو كلمة المرور غير صحيحة',
  'phone/already-in-use': 'رقم الجوال مسجّل بالفعل. جرّب تسجيل الدخول',
  'phone/invalid': 'رقم الجوال غير صحيح',
  'not-found': 'لم نجد مجموعة بهذا الرمز',
  'permission-denied': 'ليس لديك صلاحية لتنفيذ هذا الإجراء',
  'unavailable': 'الخدمة غير متاحة حالياً. تحقّق من الاتصال',
};
export function errorMessage(e) {
  const code = e?.code || e?.message;
  return ERRORS[code] || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى';
}

// ── Theme (الوضع الغامق) ──
const THEME_KEY = 'qatta-theme';
export function isDark() { return document.documentElement.dataset.theme === 'dark'; }
export function setDark(on) {
  document.documentElement.dataset.theme = on ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, on ? 'dark' : 'light'); } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', on ? '#0F1117' : '#3D5AF1');
}

/** حقل رقم الجوال مع اختيار رمز الدولة */
export function phoneField({ id = 'phone', label = 'رقم الجوال', cc = '+966', value = '', hint = '' , countries }) {
  return `
    <label class="field" for="${id}">
      <span class="field-label">${label}${hint ? ` <em>${hint}</em>` : ''}</span>
      <span class="phone-row">
        <select id="${id}-cc" aria-label="رمز الدولة">
          ${countries.map(c => `<option value="${c.code}" ${c.code === cc ? 'selected' : ''}>${c.flag} ${c.code}</option>`).join('')}
        </select>
        <span class="field-box grow">
          ${icon('phone', 18)}
          <input id="${id}" type="tel" inputmode="tel" dir="ltr" placeholder="5XX XXX XXXX" value="${esc(value)}" autocomplete="tel-national">
        </span>
      </span>
    </label>`;
}

/** مفتاح تبديل */
export function toggle(id, on, label) {
  return `<button type="button" role="switch" aria-checked="${on}" aria-label="${esc(label)}" class="switch ${on ? 'on' : ''}" id="${id}"><span></span></button>`;
}

/** ورقة سفلية (Bottom sheet) عامة */
export function openSheet(innerHtml, { onClose, label = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'overlay sheet-overlay';
  el.innerHTML = `<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><span class="handle"></span>${innerHtml}</div></div>`;
  document.body.append(el);
  document.body.classList.add('no-scroll');
  const bd = el.querySelector('.sheet-backdrop');
  requestAnimationFrame(() => bd.classList.add('open'));
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    document.removeEventListener('keydown', onKey);
    bd.classList.remove('open');
    setTimeout(() => {
      el.remove();
      if (!document.querySelector('.overlay')) document.body.classList.remove('no-scroll');
      onClose?.();
    }, 260);
  }
  bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
  document.addEventListener('keydown', onKey);
  return { el, close };
}

/** مشاركة رابط/نص (Web Share API أو نسخ) */
export async function shareText({ title, text, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  }
  try { await navigator.clipboard.writeText(url ? `${text}\n${url}` : text); return 'copied'; } catch { return 'failed'; }
}
