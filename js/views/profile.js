// ─────────────────────────────────────────────
// Profile — إكمال الملف الشخصي (أول دخول بـ Google) أو تعديله من الإعدادات
// ─────────────────────────────────────────────
import { icon, esc, field, phoneField, setLoading, shake, toast, errorMessage, avatar, brandBar } from '../ui.js';
import { COUNTRY_CODES, randomAvatarColor, toE164, AVATAR_PALETTE, initials as autoInitials } from '../models.js';

export function mountProfile(root, ctx, { edit = false } = {}) {
  const signal = ctx.signal;
  const user = ctx.state.user;
  const existing = ctx.state.profile || {};
  let color = existing.avatarColor || randomAvatarColor();
  // حساب جوال بدون بريد (بريد داخلي) · أو رقم دخول مرتبط بحساب بريد
  const isPhoneAccount = user.method === 'phone';
  const loginPhone = existing.loginPhone || (isPhoneAccount ? existing.phone : '');

  let cc = '+966', local = '';
  if (existing.phone) {
    const m = COUNTRY_CODES.find(c => existing.phone.startsWith(c.code));
    if (m) { cc = m.code; local = existing.phone.slice(m.code.length); } else local = existing.phone;
  }

  root.innerHTML = `
    <div class="screen page">
      ${brandBar()}
      <header class="page-head">
        ${edit ? `<button class="icon-btn" id="back" aria-label="رجوع">${icon('chevronRight', 22)}</button>` : '<span></span>'}
        <h1>${edit ? 'الملف الشخصي' : 'خطوة أخيرة'}</h1>
        <span class="icon-btn-spacer"></span>
      </header>

      <div class="profile-hero anim-pop">
        <div id="avatar-preview">${avatar(existing.name || user.displayName || '؟', color, 88, existing.initials)}</div>
        <div class="color-row" role="radiogroup" aria-label="لون الصورة الرمزية">
          ${AVATAR_PALETTE.map(c => `<button type="button" class="color-dot ${c === color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="لون"></button>`).join('')}
        </div>
      </div>

      <section class="card form-card anim-up">
        ${!edit ? `<div class="card-title"><h2>أكمل ملفك الشخصي</h2><p>يظهر اسمك ورقمك لأعضاء مجموعاتك</p></div>` : ''}
        <form id="profile-form" novalidate>
          ${field({ id: 'name', label: 'الاسم', ic: 'user', placeholder: 'مثال: محمد العلي', value: existing.name || user.displayName || '', autocomplete: 'name' })}
          ${field({ id: 'initials', label: 'رمز الصورة الرمزية (حرفان — اختياري)', ic: 'edit', placeholder: autoInitials(existing.name || user.displayName || ''), value: existing.initials || '' })}

          ${loginPhone
            ? `<div class="readonly-row">${icon('phone', 17)}<div><span class="field-label">رقم الجوال (للدخول)</span><b dir="ltr">${esc(loginPhone)}</b></div></div>`
            : phoneField({ id: 'phone', cc, value: local, hint: '(اختياري)', countries: COUNTRY_CODES })}

          ${isPhoneAccount
            ? `${field({ id: 'email', label: 'البريد الإلكتروني (لاستعادة كلمة المرور)', ic: 'mail', type: 'email', placeholder: 'name@example.com', value: existing.pendingEmail || '', dir: 'ltr', inputmode: 'email' })}
               <p class="hint-box warn" id="no-email-hint">${icon('alert', 15)}<span>${existing.pendingEmail ? 'أرسلنا رابط تأكيد إلى بريدك — بعد الضغط عليه تتفعّل الاستعادة بالبريد.' : 'حسابك بدون بريد إلكتروني، لذلك لا يمكن استعادة كلمة المرور إذا نسيتها. أضف بريدك لتفعيل الاستعادة.'}</span></p>
               <div id="pw-wrap" hidden>${field({ id: 'cur-pw', label: 'كلمة المرور الحالية (للتأكيد)', ic: 'lock', type: 'password', placeholder: '••••••••', dir: 'ltr', autocomplete: 'current-password' })}</div>`
            : `<div class="readonly-row">${icon('mail', 17)}<div><span class="field-label">البريد الإلكتروني</span><b dir="ltr">${esc(user.email)}</b></div></div>`}

          <div class="form-error" id="form-error" hidden></div>
          <button class="btn-primary" type="submit"><span>${edit ? 'حفظ التغييرات' : 'ابدأ الآن'}</span><i class="spinner"></i></button>
        </form>
      </section>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const nameInput = $('#name');
  const iniInput = $('#initials');
  // حد أقصى حرفان (يدعم الحروف العربية والإيموجي)
  const twoChars = (s) => {
    const seg = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(s)].map(x => x.segment) : [...s];
    return seg.filter(c => c.trim()).slice(0, 2).join('');
  };
  const refreshAvatar = () => {
    iniInput.placeholder = autoInitials(nameInput.value || '');
    $('#avatar-preview').innerHTML = avatar(nameInput.value || '؟', color, 88, iniInput.value);
  };
  nameInput.addEventListener('input', refreshAvatar, { signal });
  iniInput.addEventListener('input', () => { const v = twoChars(iniInput.value); if (v !== iniInput.value) iniInput.value = v; refreshAvatar(); }, { signal });
  root.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
    color = b.dataset.color;
    root.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === b));
    refreshAvatar();
  }, { signal }));
  $('#back')?.addEventListener('click', () => ctx.back(), { signal });
  // إظهار حقل كلمة المرور عند إدخال بريد جديد لحساب الجوال
  $('#email')?.addEventListener('input', () => {
    const v = $('#email').value.trim().toLowerCase();
    $('#pw-wrap').hidden = !v || v === (existing.pendingEmail || '');
  }, { signal });

  $('#profile-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('.btn-primary');
    const err = $('#form-error');
    const showError = (m) => { err.innerHTML = `${icon('alert', 15)}<span>${m}</span>`; err.hidden = false; shake(ev.target); };
    const name = nameInput.value.trim();
    if (!name) return showError('يرجى إدخال الاسم');

    let phone = existing.phone || '';
    let email = existing.email || user.email || '';
    let newRecovery = null;
    if (!loginPhone) {
      const raw = $('#phone').value.trim();
      phone = raw ? toE164($('#phone-cc').value, raw) : '';
      if (raw && !phone) return showError('يرجى إدخال رقم جوال صحيح');
    }
    if (isPhoneAccount) {
      const v = $('#email').value.trim().toLowerCase();
      if (v && !/^\S+@\S+\.\S+$/.test(v)) return showError('البريد الإلكتروني غير صحيح');
      if (v && v !== (existing.pendingEmail || '')) {
        const pw = $('#cur-pw').value;
        if (pw.length < 6) return showError('أدخل كلمة المرور الحالية لتأكيد إضافة البريد');
        newRecovery = { email: v, pw };
      }
    }

    const profile = { name, phone, email, avatarColor: color, initials: twoChars(iniInput.value.trim()) };
    setLoading(btn, true);
    try {
      if (newRecovery) {
        await ctx.backend.addRecoveryEmail(loginPhone, newRecovery.email, newRecovery.pw);
        profile.pendingEmail = newRecovery.email;
        profile.loginPhone = loginPhone;
        toast('أرسلنا رابط تأكيد إلى بريدك — افتحه لتفعيل الاستعادة', 'success');
      }
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
