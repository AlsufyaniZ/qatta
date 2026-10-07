// ─────────────────────────────────────────────
// Profile view — إكمال/تعديل الملف الشخصي (الاسم + رقم الجوال)
// يظهر تلقائياً عند أول دخول بـ Google، ومن قائمة الحساب للتعديل
// ─────────────────────────────────────────────
import { icon, esc, field, setLoading, shake, toast, errorMessage, avatar } from '../ui.js';
import { COUNTRY_CODES, randomAvatarColor, normalizeDigits } from '../models.js';

export function mountProfile(root, ctx, { edit = false } = {}) {
  const user = ctx.state.user;
  const existing = ctx.state.profile || {};
  const color = existing.avatarColor || randomAvatarColor();

  // تفكيك الرقم المخزّن إلى رمز دولة + رقم محلي
  let cc = '+966', local = '';
  if (existing.phone) {
    const match = COUNTRY_CODES.find(c => existing.phone.startsWith(c.code));
    if (match) { cc = match.code; local = existing.phone.slice(match.code.length); } else local = existing.phone;
  }

  root.innerHTML = `
    <div class="screen auth-screen">
      <div class="blob blob-a"></div><div class="blob blob-b"></div>
      ${edit ? `<button class="nav-back" id="back">${icon('chevronRight', 18)}<span>رجوع</span></button>` : ''}
      <header class="auth-hero anim-pop">
        <div id="avatar-preview">${avatar(existing.name || user.displayName || '؟', color, 84)}</div>
        <h1 class="brand sm">${edit ? 'الملف الشخصي' : 'خطوة أخيرة'}</h1>
        <p class="muted" dir="ltr">${esc(user.email)}</p>
      </header>

      <section class="auth-card anim-up">
        <div class="card-title">
          <h2>${edit ? 'تعديل بياناتك' : 'أكمل ملفك الشخصي'}</h2>
          <p>يظهر اسمك ورقمك للمشاركين في المصاريف</p>
        </div>
        <form id="profile-form" novalidate>
          ${field({ id: 'name', label: 'الاسم', ic: 'user', placeholder: 'مثال: محمد العلي', value: existing.name || user.displayName || '', autocomplete: 'name' })}

          <label class="field" for="phone">
            <span class="field-label">رقم الجوال <em>(اختياري)</em></span>
            <span class="phone-row">
              <select id="cc" aria-label="رمز الدولة">
                ${COUNTRY_CODES.map(c => `<option value="${c.code}" ${c.code === cc ? 'selected' : ''}>${c.flag} ${c.code}</option>`).join('')}
              </select>
              <span class="field-box grow">
                ${icon('phone', 18)}
                <input id="phone" type="tel" inputmode="tel" dir="ltr" placeholder="5XX XXX XXXX" value="${esc(local)}" autocomplete="tel-national">
              </span>
            </span>
          </label>

          <div class="form-error" id="form-error" hidden></div>
          <button class="btn-primary" type="submit"><span>${edit ? 'حفظ التغييرات' : 'ابدأ الآن'}</span><i class="spinner"></i></button>
        </form>
      </section>
    </div>`;

  const nameInput = root.querySelector('#name');
  nameInput.addEventListener('input', () => {
    root.querySelector('#avatar-preview').innerHTML = avatar(nameInput.value || '؟', color, 84);
  });

  root.querySelector('#back')?.addEventListener('click', () => ctx.goHome());

  root.querySelector('#profile-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('.btn-primary');
    const err = root.querySelector('#form-error');
    const name = nameInput.value.trim();
    const digits = normalizeDigits(root.querySelector('#phone').value).replace(/\D/g, '').replace(/^0+/, '');
    const showError = (m) => { err.innerHTML = `${icon('alert', 15)}<span>${m}</span>`; err.hidden = false; shake(ev.target); };

    if (!name) return showError('يرجى إدخال الاسم');
    if (digits && (digits.length < 8 || digits.length > 10)) return showError('يرجى إدخال رقم جوال صحيح');

    const profile = {
      name,
      phone: digits ? root.querySelector('#cc').value + digits : '',
      email: user.email,
      avatarColor: color,
    };
    setLoading(btn, true);
    try {
      await ctx.backend.saveProfile(user.uid, profile);
      ctx.state.profile = { ...existing, ...profile };
      if (edit) toast('تم حفظ التغييرات', 'success');
      ctx.goHome();
    } catch (e) {
      console.warn(e);
      showError(errorMessage(e));
      setLoading(btn, false);
    }
  });

  return {};
}
