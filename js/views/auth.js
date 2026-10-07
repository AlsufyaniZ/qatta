// ─────────────────────────────────────────────
// Auth — الدخول/التسجيل برقم الجوال وكلمة المرور (افتراضي)
//         أو بالبريد (اختياري) أو بحساب Google
// ─────────────────────────────────────────────
import { icon, esc, field, phoneField, setLoading, shake, toast, errorMessage, GOOGLE_LOGO } from '../ui.js';
import { randomAvatarColor, COUNTRY_CODES, toE164 } from '../models.js';

export function mountAuth(root, ctx) {
  const signal = ctx.signal;
  let mode = 'login';      // login | register | reset
  let method = 'phone';    // phone | email
  let first = true;
  const kept = { cc: '+966', phone: '', email: '', name: '' };

  const copy = () => ({
    login:    { title: 'أهلاً بك 👋', sub: method === 'phone' ? 'سجّل دخولك برقم جوالك وكلمة المرور' : 'سجّل دخولك ببريدك وكلمة المرور', cta: 'تسجيل الدخول' },
    register: { title: 'حساب جديد ✨', sub: 'أنشئ حسابك وابدأ تقسيم المصاريف مع مجموعاتك', cta: 'إنشاء الحساب' },
    reset:    { title: 'استعادة كلمة المرور', sub: 'أدخل بريدك وسنرسل لك رابط إعادة التعيين', cta: 'إرسال الرابط' },
  })[mode];

  function render() {
    const c = copy();
    root.innerHTML = `
      <div class="screen auth-screen">
        <div class="blob blob-a"></div><div class="blob blob-b"></div>
        <header class="auth-hero ${first ? 'anim-pop' : ''}">
          <div class="logo-tile">ق</div>
          <h1 class="brand">قطة</h1>
          <p class="muted">أدِر مصاريفك المشتركة بسهولة</p>
        </header>

        <section class="auth-card ${first ? 'anim-up' : ''}">
          ${ctx.backend.mode === 'demo' ? `
            <div class="demo-note">${icon('info', 16)}<span>وضع تجريبي — أي رقم وكلمة مرور (6 أحرف) تعمل.</span></div>` : ''}

          ${ctx.pendingJoin ? `<div class="join-note">${icon('users', 16)}<span>سجّل دخولك لتنضم إلى المجموعة <b dir="ltr">${esc(ctx.pendingJoin)}</b></span></div>` : ''}

          ${mode !== 'reset' ? `
            <div class="seg" role="tablist">
              <button type="button" role="tab" class="${mode === 'login' ? 'on' : ''}" data-mode="login">تسجيل الدخول</button>
              <button type="button" role="tab" class="${mode === 'register' ? 'on' : ''}" data-mode="register">حساب جديد</button>
            </div>` : ''}

          <div class="card-title"><h2>${c.title}</h2><p>${c.sub}</p></div>

          <form id="auth-form" novalidate>
            ${mode === 'register' ? field({ id: 'name', label: 'الاسم', ic: 'user', placeholder: 'مثال: محمد العلي', value: kept.name, autocomplete: 'name' }) : ''}

            ${mode === 'reset' || method === 'email'
              ? field({ id: 'email', label: 'البريد الإلكتروني', ic: 'mail', type: 'email', placeholder: 'name@example.com', value: kept.email, autocomplete: 'email', dir: 'ltr', inputmode: 'email' })
              : phoneField({ id: 'phone', cc: kept.cc, value: kept.phone, countries: COUNTRY_CODES })}

            ${mode !== 'reset' ? field({ id: 'password', label: 'كلمة المرور', ic: 'lock', type: 'password', placeholder: '••••••••', autocomplete: mode === 'login' ? 'current-password' : 'new-password', dir: 'ltr' }) : ''}

            ${mode === 'register' && method === 'phone'
              ? field({ id: 'email', label: 'البريد الإلكتروني (اختياري)', ic: 'mail', type: 'email', placeholder: 'name@example.com', value: kept.email, autocomplete: 'email', dir: 'ltr', inputmode: 'email' })
              : ''}

            <div class="form-error" id="form-error" hidden></div>
            <button class="btn-primary" type="submit"><span>${c.cta}</span><i class="spinner"></i></button>
          </form>

          ${mode !== 'reset' ? `
            <button type="button" class="link-btn" data-method="${method === 'phone' ? 'email' : 'phone'}">
              ${icon(method === 'phone' ? 'mail' : 'phone', 15)}
              ${method === 'phone' ? (mode === 'login' ? 'الدخول بالبريد الإلكتروني بدلاً من ذلك' : 'التسجيل بالبريد الإلكتروني بدلاً من ذلك') : (mode === 'login' ? 'الدخول برقم الجوال' : 'التسجيل برقم الجوال')}
            </button>
            ${mode === 'login' ? `<button type="button" class="link-btn subtle" data-mode="reset">نسيت كلمة المرور؟</button>` : ''}
            <div class="or"><span>أو</span></div>
            <button type="button" class="btn-google" id="google-btn">${GOOGLE_LOGO}<span>المتابعة باستخدام Google</span><i class="spinner"></i></button>
          ` : `
            <p class="hint-box">${icon('info', 15)}<span>الاستعادة بالبريد متاحة للحسابات المسجّلة بالبريد. حسابات رقم الجوال لا يمكن استعادتها حالياً لأنها تتطلب رسائل SMS.</span></p>
            <button type="button" class="link-btn" data-mode="login">${icon('chevronRight', 16)} العودة لتسجيل الدخول</button>
          `}
          <p class="disclaimer">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية</p>
        </section>
      </div>`;
    first = false;
    bind();
  }

  function keep() {
    kept.name = root.querySelector('#name')?.value ?? kept.name;
    kept.email = root.querySelector('#email')?.value ?? kept.email;
    kept.phone = root.querySelector('#phone')?.value ?? kept.phone;
    kept.cc = root.querySelector('#phone-cc')?.value ?? kept.cc;
  }

  function showError(msg) {
    const el = root.querySelector('#form-error');
    el.innerHTML = `${icon('alert', 15)}<span>${esc(msg)}</span>`;
    el.hidden = false;
    shake(root.querySelector('#auth-form'));
  }

  async function submit() {
    const form = root.querySelector('#auth-form');
    const btn = form.querySelector('.btn-primary');
    if (btn.disabled) return;
    keep();
    root.querySelector('#form-error').hidden = true;
    const password = root.querySelector('#password')?.value || '';
    const name = kept.name.trim();
    const email = kept.email.trim().toLowerCase();
    const usePhone = mode !== 'reset' && method === 'phone';
    const e164 = usePhone ? toE164(kept.cc, kept.phone) : null;

    if (mode === 'register' && !name) return showError('يرجى إدخال الاسم');
    if (usePhone && !e164) return showError('يرجى إدخال رقم جوال صحيح');
    const emailRequired = mode === 'reset' || method === 'email';
    if ((emailRequired || email) && !/^\S+@\S+\.\S+$/.test(email)) return showError('يرجى إدخال بريد إلكتروني صحيح');
    if (mode !== 'reset' && password.length < 6) return showError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

    setLoading(btn, true);
    try {
      const profile = { name, avatarColor: randomAvatarColor() };
      if (mode === 'login') {
        await (ctx.authBusy = usePhone ? ctx.backend.signInPhone(e164, password) : ctx.backend.signInEmail(email, password));
      } else if (mode === 'register') {
        await (ctx.authBusy = usePhone
          ? ctx.backend.signUpPhone(e164, password, { ...profile, email })
          : ctx.backend.signUpEmail(email, password, { ...profile, phone: '' }));
        toast('تم إنشاء الحساب بنجاح', 'success');
      } else {
        await ctx.backend.resetPassword(email);
        toast('تم إرسال رابط إعادة التعيين إلى بريدك', 'success');
        mode = 'login'; method = 'email'; render();
      }
    } catch (e) {
      console.warn(e);
      if (btn.isConnected) showError(errorMessage(e));
    } finally {
      if (btn.isConnected) setLoading(btn, false);
    }
  }

  function bind() {
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      keep(); mode = b.dataset.mode; render();
      root.querySelector(mode === 'register' ? '#name' : method === 'phone' && mode !== 'reset' ? '#phone' : '#email')?.focus();
    }, { signal }));
    root.querySelectorAll('[data-method]').forEach(b => b.addEventListener('click', () => {
      keep(); method = b.dataset.method; render();
      root.querySelector(method === 'phone' ? '#phone' : '#email')?.focus();
    }, { signal }));

    const form = root.querySelector('#auth-form');
    form.addEventListener('submit', (ev) => { ev.preventDefault(); submit(); }, { signal });
    // Enter في أي حقل يرسل النموذج مباشرة
    form.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.isComposing && ev.target.tagName === 'INPUT') { ev.preventDefault(); submit(); }
    }, { signal });

    root.querySelector('#google-btn')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      setLoading(btn, true);
      try { await (ctx.authBusy = ctx.backend.signInGoogle()); }
      catch (e) {
        console.warn(e);
        if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e?.code)) showError(errorMessage(e));
      } finally { if (btn.isConnected) setLoading(btn, false); }
    }, { signal });
  }

  render();
  setTimeout(() => root.querySelector('#phone, #email')?.focus({ preventScroll: true }), 500);
  return {};
}
