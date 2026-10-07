// ─────────────────────────────────────────────
// Home — كل المجموعات التي أنشأها المستخدم أو انضم إليها
// ─────────────────────────────────────────────
import { icon, esc, avatar, money, num, greeting, relTime } from '../ui.js';
import { T, balances, groupMembers, periodTotals } from '../models.js';
import { openCreateGroup, openJoinGroup } from './group-sheets.js';

export function mountHome(root, ctx) {
  const { state } = ctx;
  const signal = ctx.signal;
  const me = state.user;
  let animate = true;

  root.innerHTML = `
    <div class="screen home">
      <header class="home-header">
        <div>
          <p class="muted sm">${greeting()}</p>
          <h1 class="title">${esc(state.profile?.name || me.displayName)}</h1>
        </div>
        <div class="head-actions">
          <button class="icon-btn" data-act="settings" aria-label="الإعدادات">${icon('settings', 22)}</button>
          <button class="avatar-btn" data-act="settings" aria-label="الحساب">${avatar(state.profile?.name || '', state.profile?.avatarColor, 44)}</button>
        </div>
      </header>

      <section class="balance-card anim-up" id="balance"></section>

      <div class="sec-head-row mt">
        <h2 class="sec-head">مجموعاتي</h2>
        <button class="link-btn" data-act="join">${icon('link', 15)} انضمام برمز</button>
      </div>
      <section class="group-list" id="groups">
        ${[0, 1].map(() => '<div class="skeleton"></div>').join('')}
      </section>

      <button class="fab" data-act="create">${icon('plus', 18)}<span>مجموعة جديدة</span></button>
    </div>`;

  const $ = (s) => root.querySelector(s);

  function allExpenses() {
    return [...state.expenses.values()].flat();
  }

  function renderBalance() {
    const b = balances(allExpenses(), me);
    $('#balance').innerHTML = `
      <div class="deco deco-1"></div><div class="deco deco-2"></div>
      <p class="bal-label">الرصيد الصافي في كل المجموعات</p>
      <p class="bal-hero">${money(b.net)}</p>
      <div class="bal-row">
        <div class="bal-cell">
          <span class="bal-cap"><i class="up-ic">${icon('arrowDown', 14)}</i>${T.owedToMe}</span>
          <strong>${money(b.owedToMe)}</strong>
        </div>
        <span class="bal-div"></span>
        <div class="bal-cell">
          <span class="bal-cap"><i class="down-ic">${icon('arrowUp', 14)}</i>${T.iOwe}</span>
          <strong>${money(b.iOwe)}</strong>
        </div>
      </div>`;
  }

  function groupCard(g, i) {
    const list = state.expenses.get(g.id) || [];
    const loaded = state.expLoaded.has(g.id);
    const b = balances(list, me);
    const month = periodTotals(list, me, '1m');
    const members = groupMembers(g);
    let pill;
    if (!loaded) pill = '<span class="pill pill-muted">…</span>';
    else if (b.owedToMe > 0 && b.iOwe > 0) pill = `<span class="pill pill-accent">لك ${money(b.owedToMe)}</span><span class="pill pill-danger">عليك ${money(b.iOwe)}</span>`;
    else if (b.owedToMe > 0) pill = `<span class="pill pill-accent">لك ${money(b.owedToMe)}</span>`;
    else if (b.iOwe > 0) pill = `<span class="pill pill-danger">عليك ${money(b.iOwe)}</span>`;
    else pill = `<span class="pill pill-muted">${list.length ? 'لا ديون' : 'لا مصاريف بعد'}</span>`;

    return `
      <button class="group-card ${animate ? 'anim-up' : ''}" style="animation-delay:${i * 60}ms" data-group="${esc(g.id)}">
        <span class="g-emoji">${esc(g.emoji || '👥')}</span>
        <span class="g-meta">
          <span class="g-title">${esc(g.name)}${g.createdBy === me.uid ? ' <em class="tag">المنشئ</em>' : ''}</span>
          <span class="g-sub">${num(members.length)} أعضاء · صرف آخر شهر ${money(month.total)}</span>
          <span class="strip">${members.slice(0, 5).map(m => avatar(m.name, m.avatarColor, 22)).join('')}${members.length > 5 ? `<span class="avatar more" style="width:22px;height:22px">+${members.length - 5}</span>` : ''}</span>
        </span>
        <span class="g-side">${pill}<span class="chev-l">${icon('chevronLeft', 18)}</span></span>
      </button>`;
  }

  function renderGroups() {
    const el = $('#groups');
    if (!state.groupsLoaded) return;
    if (!state.groups.length) {
      el.innerHTML = `
        <div class="empty">
          <span class="pulse">${icon('users', 46)}</span>
          <strong>لا توجد مجموعات بعد</strong>
          <span>أنشئ مجموعة مثل «قطة المنزل» أو انضم لمجموعة برمز</span>
          <div class="empty-actions">
            <button class="btn-primary sm" data-act="create"><span>إنشاء مجموعة</span></button>
            <button class="btn-tint sm" data-act="join"><span>انضمام برمز</span></button>
          </div>
        </div>`;
    } else {
      const sorted = [...state.groups].sort((a, b) => b.updatedAt - a.updatedAt);
      el.innerHTML = sorted.map(groupCard).join('');
    }
    animate = false;
  }

  function update() { renderBalance(); renderGroups(); }

  root.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act], [data-group]');
    if (!t) return;
    if (t.dataset.group) return ctx.go('group/' + encodeURIComponent(t.dataset.group));
    const act = t.dataset.act;
    if (act === 'settings') ctx.go('settings');
    if (act === 'create') openCreateGroup(ctx);
    if (act === 'join') openJoinGroup(ctx);
  }, { signal });

  update();

  // رابط دعوة معلّق
  if (ctx.pendingJoin) setTimeout(() => openJoinGroup(ctx, ctx.pendingJoin), 400);

  return { update };
}
