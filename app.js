// ─────────────────────────────────────────────
// Qatta (قطة) — App entry + root router
// مكافئ QattaApp.swift / ContentView
// ─────────────────────────────────────────────
import { firebaseConfig } from './config.js';
import { createDemoBackend } from './backend/demo.js';
import { toast } from './ui.js';
import { mountAuth } from './views/auth.js';
import { mountProfile } from './views/profile.js';
import { mountHome } from './views/home.js';

const root = document.getElementById('app');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const state = {
  user: null,       // { uid, email, displayName, emailVerified, isGoogle }
  profile: null,    // users/{uid}
  expenses: [],
  loaded: false,
  filter: 'all',
  expanded: new Set(),
};

let current = null;          // الشاشة المعروضة حالياً
let unsubExpenses = null;

const ctx = {
  state,
  backend: null,
  authBusy: null,            // وعد عملية دخول/تسجيل جارية
  goHome,
  goProfile: () => show(mountProfile, { edit: true }),
  refreshUser(u) {
    state.user = u;
    stopExpenses();
    goHome();
  },
};

function show(mount, opts) {
  current?.destroy?.();
  root.innerHTML = '';
  root.scrollTop = 0;
  window.scrollTo(0, 0);
  current = mount(root, ctx, opts) || {};
}

function stopExpenses() {
  unsubExpenses?.();
  unsubExpenses = null;
}

function goHome() {
  show(mountHome);
  if (!unsubExpenses) {
    state.loaded = false;
    unsubExpenses = ctx.backend.subscribeExpenses(
      state.user,
      (list) => { state.expenses = list; state.loaded = true; current?.update?.(); },
      (err) => { console.error(err); state.loaded = true; current?.update?.(); toast('تعذّر تحميل المصاريف — تحقّق من قواعد Firestore', 'error'); },
    );
  } else {
    current.update?.();
  }
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
  const splash = sleep(1400);

  try {
    if (configured && !params.has('demo')) {
      const { createFirebaseBackend } = await import('./backend/firebase.js');
      ctx.backend = await createFirebaseBackend(firebaseConfig);
    } else {
      ctx.backend = createDemoBackend();
    }
  } catch (e) {
    console.error('[Qatta] Firebase init failed', e);
    await splash;
    root.innerHTML = `
      <div class="screen center-msg">
        <div class="logo-tile">ق</div>
        <h2>تعذّر الاتصال بـ Firebase</h2>
        <p>تحقّق من اتصال الإنترنت ومن صحة الإعدادات في <code>js/config.js</code>.</p>
        <button class="btn-primary" onclick="location.reload()"><span>إعادة المحاولة</span></button>
      </div>`;
    return;
  }

  document.documentElement.dataset.mode = ctx.backend.mode;

  ctx.backend.onAuth(async (user) => {
    await splash;
    // انتظر اكتمال عملية التسجيل (إنشاء ملف المستخدم) قبل التوجيه
    if (ctx.authBusy) { await ctx.authBusy.catch(() => {}); ctx.authBusy = null; }

    stopExpenses();
    state.user = user;
    state.expenses = [];
    state.expanded.clear();
    state.filter = 'all';

    if (!user) {
      state.profile = null;
      show(mountAuth);
      return;
    }

    try {
      state.profile = await ctx.backend.getProfile(user.uid);
    } catch (e) {
      console.warn('[Qatta] profile read failed', e);
      state.profile = null;
    }

    if (!state.profile?.name) show(mountProfile);
    else goHome();
  });
}

boot();
