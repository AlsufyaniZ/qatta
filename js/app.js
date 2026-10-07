// ─────────────────────────────────────────────
// Qatta (قطة) — App entry + router
// المسارات: #/ (المجموعات) · #/group/CODE · #/stats/CODE · #/settings · #/profile
// ─────────────────────────────────────────────
import { firebaseConfig } from './config.js';
import { createDemoBackend } from './backend/demo.js';
import { toast, errorMessage, ensureRiyalFont } from './ui.js';
import { memberInfoFrom } from './models.js';
import { mountAuth } from './views/auth.js';
import { mountProfile } from './views/profile.js';
import { mountHome } from './views/home.js';
import { mountGroup } from './views/group.js';
import { mountSettings } from './views/settings.js';
import { mountStats } from './views/stats.js';
import { mountBank } from './views/bank.js';

const root = document.getElementById('app');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const JOIN_KEY = 'qatta-pending-join';

const state = {
  user: null,              // { uid, email, displayName, method }
  profile: null,           // users/{uid}
  groups: [],              // المجموعات التي أنا عضو فيها
  groupsLoaded: false,
  expenses: new Map(),     // code → [expense]
  expLoaded: new Set(),    // codes loaded
  settlements: new Map(),  // code → [settlement]
  expanded: new Set(),
  filter: 'all',
  period: '1m',
  statsPeriod: '1m',
  groupTab: 'expenses',
};

let current = null;              // { update?, destroy? }
let controller = null;           // AbortController للشاشة الحالية
let unsubGroups = null;
const unsubExp = new Map();      // code → unsubscribe (expenses + settlements)

const ctx = {
  state,
  backend: null,
  authBusy: null,
  get signal() { return controller?.signal; },
  go(path) {
    const target = '#/' + (path || '');
    if (location.hash === target) route(); else location.hash = target;
  },
  back() {
    if (history.length > 1 && location.hash && location.hash !== '#/') history.back(); else ctx.go('');
  },
  setProfile(p) { state.profile = p; },
  get pendingJoin() { try { return sessionStorage.getItem(JOIN_KEY); } catch { return null; } },
  clearPendingJoin() { try { sessionStorage.removeItem(JOIN_KEY); } catch {} },
  myInfo: () => memberInfoFrom(state.profile || {}),
};

function show(mount, ...args) {
  current?.destroy?.();
  controller?.abort();
  controller = new AbortController();
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  document.body.classList.remove('no-scroll');
  root.innerHTML = '';
  window.scrollTo(0, 0);
  current = mount(root, ctx, ...args) || {};
}

// ── Data subscriptions ──
function stopData() {
  unsubGroups?.(); unsubGroups = null;
  unsubExp.forEach(u => u()); unsubExp.clear();
  state.groups = []; state.groupsLoaded = false;
  state.expenses.clear(); state.expLoaded.clear(); state.expanded.clear(); state.settlements.clear();
}

function startData() {
  if (unsubGroups) return;
  unsubGroups = ctx.backend.subscribeGroups(state.user.uid, (groups) => {
    state.groups = groups;
    state.groupsLoaded = true;
    const codes = new Set(groups.map(g => g.id));
    // أوقف الاشتراكات في المجموعات المحذوفة/المغادَرة
    for (const [code, u] of unsubExp) if (!codes.has(code)) { u(); unsubExp.delete(code); state.expenses.delete(code); state.expLoaded.delete(code); state.settlements.delete(code); }
    // اشترك في مصاريف المجموعات الجديدة
    for (const code of codes) {
      if (unsubExp.has(code)) continue;
      const u1 = ctx.backend.subscribeExpenses(code,
        (list) => { state.expenses.set(code, list); state.expLoaded.add(code); current?.update?.(); },
        (e) => console.warn('[Qatta] expenses', code, e));
      const u2 = ctx.backend.subscribeSettlements(code,
        (list) => { state.settlements.set(code, list); current?.update?.(); },
        (e) => console.warn('[Qatta] settlements', code, e));
      unsubExp.set(code, () => { u1(); u2(); });
    }
    current?.update?.();
  }, (e) => {
    console.error(e);
    state.groupsLoaded = true;
    current?.update?.();
    toast('تعذّر تحميل المجموعات — تحقّق من قواعد Firestore', 'error');
  });
}

// ── Router ──
function route() {
  if (!state.user) return;
  if (!state.profile?.name) { show(mountProfile, { edit: false }); return; }
  startData();
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (page === 'group' && arg) show(mountGroup, decodeURIComponent(arg));
  else if (page === 'stats' && arg) show(mountStats, decodeURIComponent(arg));
  else if (page === 'settings') show(mountSettings);
  else if (page === 'bank') show(mountBank);
  else if (page === 'profile') show(mountProfile, { edit: true });
  else show(mountHome);
}
window.addEventListener('hashchange', route);

async function boot() {
  // رابط دعوة: ?join=CODE → يُحفظ حتى بعد تسجيل الدخول
  const params = new URLSearchParams(location.search);
  const join = params.get('join');
  if (join) {
    try { sessionStorage.setItem(JOIN_KEY, join.toUpperCase().replace(/[^A-Z0-9]/g, '')); } catch {}
    params.delete('join');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + '#/');
  }

  const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
  const splash = Promise.all([sleep(1200), ensureRiyalFont()]);
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
        <img class="logo-mark" src="assets/icons/logo.png" alt="قطة" width="96" height="96">
        <h2>تعذّر الاتصال بـ Firebase</h2>
        <p>تحقّق من اتصال الإنترنت ثم أعد المحاولة.</p>
        <button class="btn-primary" onclick="location.reload()"><span>إعادة المحاولة</span></button>
      </div>`;
    return;
  }
  document.documentElement.dataset.mode = ctx.backend.mode;

  ctx.backend.onAuth(async (user) => {
    await splash;
    if (ctx.authBusy) { await ctx.authBusy.catch(() => {}); ctx.authBusy = null; }
    stopData();
    state.user = user;
    if (!user) { state.profile = null; show(mountAuth); return; }
    try { state.profile = await ctx.backend.getProfile(user.uid); }
    catch (e) { console.warn('[Qatta] profile', e); state.profile = null; toast(errorMessage(e), 'error'); }
    route();
    // ربط تلقائي: إن أُضيف المستخدم سابقاً كضيف برقم جواله تنتقل مصاريفه لحسابه
    if (state.profile?.name) {
      ctx.backend.autoClaimGuests?.(user, ctx.myInfo())
        .then(names => { if (names?.length) toast(`تمت إضافة مصاريفك السابقة من: ${names.join('، ')}`, 'success'); })
        .catch(e => console.warn('[Qatta] auto-claim', e));
    }
  });
}

boot();
