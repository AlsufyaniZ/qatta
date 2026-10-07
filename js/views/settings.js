// ─────────────────────────────────────────────
// Settings — الملف الشخصي · الوضع الغامق · تسجيل الخروج
// ─────────────────────────────────────────────
import { icon, esc, avatar, toggle, isDark, setDark, toast, brandBar } from '../ui.js';
import { formatIban } from '../models.js';

export function mountSettings(root, ctx) {
  const { state, backend } = ctx;
  const signal = ctx.signal;
  const p = state.profile || {};
  const u = state.user;
  const methodLabel = { phone: 'رقم الجوال', email: 'البريد الإلكتروني', google: 'Google' }[u.method] || '';

  root.innerHTML = `
    <div class="screen page">
      ${brandBar()}
      <header class="page-head">
        <button class="icon-btn" data-act="back" aria-label="رجوع">${icon('chevronRight', 22)}</button>
        <h1>الإعدادات</h1>
        <span class="icon-btn-spacer"></span>
      </header>

      <button class="profile-card anim-up" data-act="profile">
        ${avatar(p.name, p.avatarColor, 56, p.initials)}
        <span class="pc-meta">
          <strong>${esc(p.name || '')}</strong>
          <span dir="ltr">${esc(p.phone || u.email || '')}</span>
          <span class="muted sm">الدخول عبر ${methodLabel}</span>
        </span>
        <span class="chev-l">${icon('chevronLeft', 18)}</span>
      </button>

      <h2 class="set-title">المظهر</h2>
      <div class="set-group anim-up d1">
        <div class="set-row">
          <span class="set-ic" style="--c:#6C5CE7">${icon('moon', 18)}</span>
          <span class="set-label">الوضع الغامق</span>
          ${toggle('dark-toggle', isDark(), 'الوضع الغامق')}
        </div>
      </div>

      <h2 class="set-title">تفضيلات الحساب البنكي</h2>
      <div class="set-group anim-up d2">
        <button class="set-row" data-act="bank">
          <span class="set-ic" style="--c:var(--accent)">${icon('wallet', 18)}</span>
          <span class="set-label">${p.iban ? `${esc(p.bankName || 'الحساب البنكي')}<small class="set-sub" dir="ltr">${esc(formatIban(p.iban))}</small>` : 'أضف حسابك البنكي لاستقبال التحويلات'}</span>
          <span class="chev-l">${icon('chevronLeft', 18)}</span>
        </button>
      </div>

      <h2 class="set-title">الحساب</h2>
      <div class="set-group anim-up d2">
        <button class="set-row" data-act="profile">
          <span class="set-ic" style="--c:var(--primary)">${icon('user', 18)}</span>
          <span class="set-label">تعديل الملف الشخصي</span>
          <span class="chev-l">${icon('chevronLeft', 18)}</span>
        </button>
        ${backend.mode === 'demo' ? `
        <button class="set-row" data-act="reset">
          <span class="set-ic" style="--c:var(--warning)">${icon('refresh', 18)}</span>
          <span class="set-label">إعادة البيانات التجريبية</span>
        </button>` : ''}
        <button class="set-row danger" data-act="logout">
          <span class="set-ic" style="--c:var(--danger)">${icon('logout', 18)}</span>
          <span class="set-label">تسجيل الخروج</span>
        </button>
      </div>

      <div class="about"><img class="logo-mark sm" src="assets/icons/logo.png" alt="قطة" width="56" height="56"><p class="version">نسخة الويب 5.0</p></div>
    </div>`;

  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.id === 'dark-toggle') {
      const on = !isDark();
      setDark(on);
      t.classList.toggle('on', on);
      t.setAttribute('aria-checked', on);
      return;
    }
    const act = t.dataset.act;
    if (act === 'back') ctx.go('');
    if (act === 'profile') ctx.go('profile');
    if (act === 'bank') ctx.go('bank');
    if (act === 'logout') { await backend.signOut(); history.replaceState(null, '', location.pathname + location.search + '#/'); }
    if (act === 'reset') { await backend.resetDemo(); toast('تمت إعادة البيانات التجريبية', 'success'); }
  }, { signal });

  return {};
}
