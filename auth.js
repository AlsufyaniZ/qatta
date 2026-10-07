// ─────────────────────────────────────────────
// Auth view — مكافئ PhoneLoginView (بالبريد + Google بدل OTP)
// ─────────────────────────────────────────────
import { icon, esc, field, setLoading, shake, toast, errorMessage, GOOGLE_LOGO } from '../ui.js';
import { randomAvatarColor } from '../models.js';

const COPY = {
  login:    { title: 'أهلاً بك 👋',       sub: 'سجّل دخولك لمتابعة مصاريفك المشتركة', cta: 'تسجيل الدخول' },
  register: { title: 'حساب جديد ✨',       sub: 'أنشئ حسابك وابدأ تقسيم المصاريف بلا تعقيد', cta: 'إنشاء الحساب' },
  reset:    { title: 'استعادة كلمة المرور', sub: 'أدخل بريدك وسنرسل لك رابط إعادة التعيين', cta: 'إرسال الرابط' },
};

export function mountAuth(root, ctx) {
  let mode = 'login';
  let email = '';
  let first = true;

  function render() {
    const c = COPY[mode];
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
            <div class="demo-note">${icon('alert', 16)}<span>وضع تجريبي — أي بريد وكلمة مرور (6 أحرف) تعمل. أضف إعدادات Firebase في <code>js/config.js</code> للتشغيل الفعلي.</span></div>` : ''}

          ${mode !== 'reset' ? `
            <div class="seg" role="tablist">
              <button type="button" role="tab" class="${mode === 'login' ? 'on' : ''}" data-mode="login">تسجيل الدخول</button>
              <button type="button" role="tab" class="${mode === 'register' ? 'on' : ''}" data-mode="register">حساب جديد</button>
            </div>` : ''}

          <div class="card-title">
            <h2>${c.title}</h2>
            <p>${c.sub}</p>
          </div>

          <form id="auth-form" novalidate>
            ${mode === 'register' ? field({ id: 'name', label: 'الاسم', ic: 'user', placeholder: 'مثال: محمد العلي', autocomplete: 'name' }) : ''}
            ${field({ id: 'email', label: 'البريد الإلكتروني', ic: 'mail', type: 'email', placeholder: 'name@example.com', value: email, autocomplete: 'email', dir: 'ltr', inputmode: 'email' })}
            ${mode !== 'reset' ? field({ id: 'password', label: 'كلمة المرور', ic: 'lock', type: 'password', placeholder: '••••••••', autocomplete: mode === 'login' ? 'current-password' : 'new-password', dir: 'ltr' }) : ''}
            <div class="form-error" id="form-error" hidden></div>
            <button class="btn-primary" type="submit"><span>${c.cta}</span><i class="spinner"></i></button>
          </form>

          ${mode === 'login' ? `<button type="button" class="link-btn" data-mode="reset">نسيت كلمة المرور؟</button>` : ''}

          ${mode !== 'reset' ? `
            <div class="or"><span>أو</span></div>
            <button type="button" class="btn-google" id="google-btn">${GOOGLE_LOGO}<span>المتابعة باستخدام Google</span><i class="spinner"></i></button>
          ` : `
            <button type="button" class="link-btn back" data-mode="login">${icon('chevronRight', 16)} العودة لتسجيل الدخول</button>
          `}

          <p class="disclaimer">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية</p>
        </section>
      </div>`;
    first = false;
    bind();
  }

  function showError(msg) {
    const el = root.querySelector('#form-error');
    el.innerHTML = `${icon('alert', 15)}<span>${esc(msg)}</span>`;
    el.hidden = false;
    shake(root.querySelector('#auth-form'));
  }

  function bind() {
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      email = root.querySelector('#email')?.value || email;
      mode = b.dataset.mode;
      render();
      root.querySelector(mode === 'register' ? '#name' : '#email')?.focus();
    }));

    root.querySelector('#auth-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = ev.target.querySelector('.btn-primary');
      const name = root.querySelector('#name')?.value.trim() || '';
      email = root.querySelector('#email').value.trim();
      const password = root.querySelector('#password')?.value || '';
      root.querySelector('#form-error').hidden = true;

      if (mode === 'register' && !name) return showError('يرجى إدخال الاسم');
      if (!/^\S+@\S+\.\S+$/.test(email)) return showError('يرجى إدخال بريد إلكتروني صحيح');
      if (mode !== 'reset' && password.length < 6) return showError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

      setLoading(btn, true);
      try {
        if (mode === 'login') {
          await (ctx.authBusy = ctx.backend.signInEmail(email, password));
        } else if (mode === 'register') {
          await (ctx.authBusy = ctx.backend.signUpEmail(name, email, password, {
            name, phone: '', avatarColor: randomAvatarColor(),
          }));
          toast('تم إنشاء الحساب — أرسلنا رابط توثيق إلى بريدك', 'success');
        } else {
          await ctx.backend.resetPassword(email);
          toast('تم إرسال رابط إعادة التعيين إلى بريدك', 'success');
          mode = 'login'; render();
        }
      } catch (e) {
        console.warn(e);
        showError(errorMessage(e));
      } finally {
        if (btn.isConnected) setLoading(btn, false);
      }
    });

    root.querySelector('#google-btn')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      setLoading(btn, true);
      try {
        await (ctx.authBusy = ctx.backend.signInGoogle());
      } catch (e) {
        console.warn(e);
        if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') showError(errorMessage(e));
      } finally {
        if (btn.isConnected) setLoading(btn, false);
      }
    });
  }

  render();
  setTimeout(() => root.querySelector('#email')?.focus({ preventScroll: true }), 500);
  return {};
}
