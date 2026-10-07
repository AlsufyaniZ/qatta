// ─────────────────────────────────────────────
// Profile — إكمال الملف الشخصي (أول دخول بـ Google) أو تعديله من الإعدادات
// ─────────────────────────────────────────────
import { icon, esc, field, phoneField, setLoading, shake, toast, errorMessage, avatar } from '../ui.js';
import { COUNTRY_CODES, randomAvatarColor, toE164, AVATAR_PALETTE } from '../models.js';

export function mountProfile(root, ctx, { edit = false } = {}) {
  const signal = ctx.signal;
  const user = ctx.state.user;
  const existing = ctx.state.profile || {};
  let color = existing.avatarColor || randomAvatarColor();
  const isPhoneAccount = user.method === 'phone';

  let cc = '+966', local = '';
  if (existing.phone) {
    const m = COUNTRY_CODES.find(c => existing.phone.startsWith(c.code));
    if (m) { cc = m.code; local = existing.phone.slice(m.code.length); } else local = existing.phone;
  }

  root.innerHTML = `
    <div class="screen page">
      <header class="page-head">
        ${edit ? `<button class="icon-btn" id="back" aria-label="رجوع">${icon('chevronRight', 22)}</button>` : '<span></span>'}
        <h1>${edit ? 'الملف الشخصي' : 'خطوة أخيرة'}</h1>
        <span class="icon-btn-spacer"></span>
      </header>

      <div class="profile-hero anim-pop">
        <div id="avatar-preview">${avatar(existing.name || user.displayName || '؟', color, 88)}</div>
        <div class="color-row" role="radiogroup" aria-label="لون الصورة الرمزية">
          ${AVATAR_PALETTE.map(c => `<button type="button" class="color-dot ${c === color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="لون"></button>`).join('')}
        </div>
      </div>

      <section class="card form-card anim-up">
        ${!edit ? `<div class="card-title"><h2>أكمل ملفك الشخصي</h2><p>يظهر اسمك ورقمك لأعضاء مجموعاتك</p></div>` : ''}
        <form id="profile-form" novalidate>
          ${field({ id: 'name', label: 'الاسم', ic: 'user', placeholder: 'مثال: محمد العلي', value: existing.name || user.displayName || '', autocomplete: 'name' })}

          ${isPhoneAccount
            ? `<div class="readonly-row">${icon('phone', 17)}<div><span class="field-label">رقم الجوال (للدخول)</span><b dir="ltr">${esc(existing.phone)}</b></div></div>`
            : phoneField({ id: 'phone', cc, value: local, hint: '(اختياري)', countries: COUNTRY_CODES })}

          ${isPhoneAccount
            ? field({ id: 'email', label: 'البريد الإلكتروني (اختياري)', ic: 'mail', type: 'email', placeholder: 'name@example.com', value: existing.email || '', dir: 'ltr', inputmode: 'email' })
            : `<div class="readonly-row">${icon('mail', 17)}<div><span class="field-label">البريد الإلكتروني</span><b dir="ltr">${esc(user.email)}</b></div></div>`}

          <div class="form-error" id="form-error" hidden></div>
          <button class="btn-primary" type="submit"><span>${edit ? 'حفظ التغييرات' : 'ابدأ الآن'}</span><i class="spinner"></i></button>
        </form>
      </section>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const nameInput = $('#name');
  const refreshAvatar = () => { $('#avatar-preview').innerHTML = avatar(nameInput.value || '؟', color, 88); };
  nameInput.addEventListener('input', refreshAvatar, { signal });
  root.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
    color = b.dataset.color;
    root.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === b));
    refreshAvatar();
  }, { signal }));
  $('#back')?.addEventListener('click', () => ctx.back(), { signal });

  $('#profile-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('.btn-primary');
    const err = $('#form-error');
    const showError = (m) => { err.innerHTML = `${icon('alert', 15)}<span>${m}</span>`; err.hidden = false; shake(ev.target); };
    const name = nameInput.value.trim();
    if (!name) return showError('يرجى إدخال الاسم');

    let phone = existing.phone || '';
    let email = existing.email || user.email || '';
    if (!isPhoneAccount) {
      const raw = $('#phone').value.trim();
      phone = raw ? toE164($('#phone-cc').value, raw) : '';
      if (raw && !phone) return showError('يرجى إدخال رقم جوال صحيح');
    } else {
      email = $('#email').value.trim().toLowerCase();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return showError('البريد الإلكتروني غير صحيح');
    }

    const profile = { name, phone, email, avatarColor: color };
    setLoading(btn, true);
    try {
      await ctx.backend.saveProfile(user.uid, profile, ctx.state.groups.map(g => g.id));
      ctx.setProfile({ ...existing, ...profile });
      if (edit) { toast('تم حفظ التغييرات', 'success'); ctx.back(); } else ctx.go('');
    } catch (e) {
      console.warn(e);
      showError(errorMessage(e));
      setLoading(btn, false);
    }
  }, { signal });

  return {};
}
