// ─────────────────────────────────────────────
// Home dashboard — مكافئ HomeView.swift
// ─────────────────────────────────────────────
import { icon, esc, avatar, money, num, relTime, greeting, toast, errorMessage } from '../ui.js';
import {
  FILTERS, category, balances, filterExpenses, isMe, myParticipant, iAmPayer, payerOf,
  remainingAmount, isFullySettled,
} from '../models.js';
import { openAddExpense } from './add-expense.js';

export function mountHome(root, ctx) {
  const { state, backend } = ctx;
  const me = state.user;
  let animateList = true;

  root.innerHTML = `
    <div class="screen home">
      <div id="verify-banner"></div>

      <header class="home-header">
        <div>
          <p class="muted sm">${greeting()}</p>
          <h1 class="title" id="user-name">${esc(state.profile?.name || me.displayName)}</h1>
        </div>
        <div class="menu-wrap">
          <button class="avatar-btn" id="menu-btn" aria-haspopup="true" aria-label="الحساب">
            ${avatar(state.profile?.name || me.displayName, state.profile?.avatarColor, 46)}
          </button>
          <div class="menu" id="menu" hidden>
            <div class="menu-head"><strong>${esc(state.profile?.name || '')}</strong><span dir="ltr">${esc(me.email)}</span></div>
            <button data-menu="profile">${icon('edit', 17)}<span>تعديل الملف الشخصي</span></button>
            ${backend.mode === 'demo' ? `<button data-menu="reset">${icon('refresh', 17)}<span>إعادة البيانات التجريبية</span></button>` : ''}
            <button data-menu="logout" class="danger">${icon('logout', 17)}<span>تسجيل الخروج</span></button>
          </div>
        </div>
      </header>

      <section class="balance-card anim-up" id="balance"></section>
      <section class="stats anim-up d1" id="stats"></section>

      <nav class="chips-bar" id="chips" aria-label="تصفية المصاريف"></nav>
      <section class="expense-list" id="list">
        ${[0, 1, 2].map(() => '<div class="skeleton"></div>').join('')}
      </section>

      <button class="fab" id="fab">${icon('plus', 18)}<span>إضافة مصروف</span></button>
    </div>`;

  const $ = (s) => root.querySelector(s);

  // ── Verify banner (لمستخدمي البريد غير الموثّق) ──
  function renderBanner() {
    const el = $('#verify-banner');
    if (state.user.emailVerified || backend.mode === 'demo') { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="banner">
        ${icon('mail', 18)}
        <div class="grow"><strong>وثّق بريدك الإلكتروني</strong><span>لتظهر لك المصاريف التي يضيفك إليها الآخرون</span></div>
        <button data-verify="resend">إعادة الإرسال</button>
        <button data-verify="check" class="solid">تم التوثيق</button>
      </div>`;
  }

  // ── Balance card ──
  function renderBalance() {
    const b = balances(state.expenses, me);
    $('#balance').innerHTML = `
      <div class="deco deco-1"></div><div class="deco deco-2"></div>
      <p class="bal-label">الرصيد الصافي</p>
      <p class="bal-hero">${money(b.net)}</p>
      <div class="bal-row">
        <div class="bal-cell">
          <span class="bal-cap"><i style="color:#7EE8C1">${icon('arrowDown', 14)}</i>لي دين</span>
          <strong>${money(b.owedToMe)}</strong>
        </div>
        <span class="bal-div"></span>
        <div class="bal-cell">
          <span class="bal-cap"><i style="color:#FFB4B4">${icon('arrowUp', 14)}</i>أنا مدين</span>
          <strong>${money(b.iOwe)}</strong>
        </div>
      </div>`;
  }

  // ── Quick stats ──
  function renderStats() {
    const total = state.expenses.length;
    const settled = state.expenses.filter(isFullySettled).length;
    const card = (title, value, sub, color, ic) => `
      <div class="stat-card" style="--c:${color}">
        <span class="stat-ic">${icon(ic, 16)}</span>
        <strong>${num(value)}</strong>
        <span class="stat-t">${title}</span>
        <span class="stat-s">${sub}</span>
      </div>`;
    $('#stats').innerHTML =
      card('المصاريف', total, 'إجمالي', 'var(--primary)', 'list') +
      card('مسوّاة', settled, 'مكتملة', 'var(--accent)', 'badgeCheck') +
      card('قيد التسوية', total - settled, 'معلّقة', 'var(--warning)', 'clock');
  }

  function renderChips() {
    $('#chips').innerHTML = FILTERS.map(f =>
      `<button class="chip ${state.filter === f.id ? 'on' : ''}" data-filter="${f.id}">${f.label}</button>`).join('');
  }

  // ── Expense card ──
  function statusPill(exp) {
    if (isFullySettled(exp)) return pill('مسوّى', 'accent');
    if (iAmPayer(exp, me)) return pill(`لك ${money(remainingAmount(exp), exp.currency)}`, 'accent');
    const mine = myParticipant(exp, me);
    if (mine && !mine.isPaid) return pill(`عليك ${money(mine.shareAmount, exp.currency)}`, 'danger');
    return pill('دفعت', 'muted');
  }
  const pill = (t, tone) => `<span class="pill pill-${tone}">${esc(t)}</span>`;

  function avatarStrip(parts) {
    const max = 4;
    return `<span class="strip">${parts.slice(0, max).map(p => avatar(p.name, p.avatarColor, 22)).join('')}${
      parts.length > max ? `<span class="avatar more" style="width:22px;height:22px">+${parts.length - max}</span>` : ''}</span>`;
  }

  function participantRow(exp, p) {
    const payer = iAmPayer(exp, me);
    const canSettle = !p.isPaid && (payer || isMe(p, me));
    const isPayerRow = p.id === exp.paidByUserId;
    let trail;
    if (p.isPaid) trail = `<span class="ok">${icon('checkCircle', 20)}</span>`;
    else if (canSettle) trail = `<button class="settle-btn" data-settle="${esc(exp.id)}" data-pid="${esc(p.id)}">تسوية</button>`;
    else trail = `<span class="wait">${icon('clock', 17)}</span>`;
    return `
      <div class="p-row">
        ${avatar(p.name, p.avatarColor, 34)}
        <div class="p-info">
          <span class="p-name">${esc(p.name)}${isMe(p, me) ? ' <em class="tag">أنت</em>' : ''}${isPayerRow ? ' <em class="tag tag-accent">الدافع</em>' : ''}</span>
          ${p.phone ? `<span class="p-phone" dir="ltr">${esc(p.phone)}</span>` : ''}
        </div>
        <span class="p-amt">${money(p.shareAmount, exp.currency)}</span>
        ${trail}
      </div>`;
  }

  function expenseCard(exp, i) {
    const cat = category(exp.category);
    const open = state.expanded.has(exp.id);
    const payer = payerOf(exp);
    const owner = exp.ownerId === me.uid;
    return `
      <article class="expense-card ${open ? 'expanded' : ''} ${animateList ? 'anim-up' : ''}" style="animation-delay:${i * 70}ms" data-id="${esc(exp.id)}">
        <button class="ex-main" data-toggle="${esc(exp.id)}" aria-expanded="${open}">
          <span class="ex-icon">${icon(cat.icon, 21)}</span>
          <span class="ex-meta">
            <span class="ex-title">${esc(exp.title)}</span>
            <span class="ex-sub">
              <span>${relTime(exp.createdAt)}</span><i class="dot"></i>
              <span class="badge-cat">${icon(cat.icon, 11)}</span>
              ${!iAmPayer(exp, me) && payer ? `<i class="dot"></i><span>دفعها ${esc(payer.name.split(' ')[0])}</span>` : ''}
            </span>
            ${avatarStrip(exp.participants)}
          </span>
          <span class="ex-side">
            <span class="ex-amt">${money(exp.totalAmount, exp.currency)}</span>
            ${statusPill(exp)}
            <span class="chev">${icon('chevronDown', 14)}</span>
          </span>
        </button>
        <div class="ex-details"><div>
          <div class="ex-details-in">
            ${exp.participants.map(p => participantRow(exp, p)).join('')}
          </div>
          ${exp.note ? `<div class="ex-note">${icon('note', 14)}<span>${esc(exp.note)}</span></div>` : ''}
          ${owner ? `<div class="ex-actions"><button class="del-btn" data-delete="${esc(exp.id)}">${icon('trash', 15)}<span>حذف المصروف</span></button></div>` : ''}
        </div></div>
      </article>`;
  }

  function renderList() {
    const list = filterExpenses(state.expenses, state.filter, me);
    if (!list.length) {
      const msgs = {
        all: ['لا توجد مصاريف بعد', 'اضغط على "إضافة مصروف" لتبدأ'],
        iOwe: ['لا توجد ديون عليك', 'أنت مسوٍّ لكل حصصك 🎉'],
        owedToMe: ['لا أحد مدين لك', 'كل المشاركين سدّدوا حصصهم'],
        settled: ['لا توجد مصاريف مسوّاة', 'ستظهر هنا المصاريف بعد تسويتها بالكامل'],
      }[state.filter];
      $('#list').innerHTML = `
        <div class="empty">
          <span class="pulse">${icon('inbox', 46)}</span>
          <strong>${msgs[0]}</strong><span>${msgs[1]}</span>
        </div>`;
    } else {
      $('#list').innerHTML = list.map(expenseCard).join('');
    }
    animateList = false;
  }

  function update() {
    renderBalance(); renderStats(); renderChips();
    if (state.loaded) renderList();
  }

  // ── Events ──
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;

    if (t.id === 'menu-btn') { $('#menu').hidden = !$('#menu').hidden; return; }
    if (t.id === 'fab') { openAddExpense(ctx); return; }

    if (t.dataset.menu) {
      $('#menu').hidden = true;
      if (t.dataset.menu === 'logout') backend.signOut();
      if (t.dataset.menu === 'profile') ctx.goProfile();
      if (t.dataset.menu === 'reset') { await backend.resetDemo(); toast('تمت إعادة البيانات التجريبية', 'success'); }
      return;
    }

    if (t.dataset.filter) {
      state.filter = t.dataset.filter; animateList = true;
      renderChips(); renderList();
      return;
    }

    if (t.dataset.toggle) {
      const id = t.dataset.toggle;
      const card = t.closest('.expense-card');
      const open = !state.expanded.has(id);
      open ? state.expanded.add(id) : state.expanded.delete(id);
      card.classList.toggle('expanded', open);
      t.setAttribute('aria-expanded', open);
      return;
    }

    if (t.dataset.settle) {
      const exp = state.expenses.find(e => e.id === t.dataset.settle);
      if (!exp) return;
      const participants = exp.participants.map(p => p.id === t.dataset.pid ? { ...p, isPaid: true } : p);
      t.disabled = true;
      try {
        await backend.updateParticipants(exp.id, participants);
        toast('تمت التسوية', 'success');
      } catch (e) { console.warn(e); toast(errorMessage(e), 'error'); t.disabled = false; }
      return;
    }

    if (t.dataset.delete) {
      const exp = state.expenses.find(e => e.id === t.dataset.delete);
      if (!exp || !confirm(`حذف "${exp.title}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
      try {
        await backend.deleteExpense(exp.id);
        state.expanded.delete(exp.id);
        toast('تم حذف المصروف', 'success');
      } catch (e) { console.warn(e); toast(errorMessage(e), 'error'); }
      return;
    }

    if (t.dataset.verify === 'resend') {
      try { await backend.resendVerification(); toast('تم إرسال رابط التوثيق إلى بريدك', 'success'); }
      catch (e) { toast(errorMessage(e), 'error'); }
      return;
    }
    if (t.dataset.verify === 'check') {
      const u = await backend.reloadUser().catch(() => null);
      if (u?.emailVerified) { toast('تم توثيق بريدك ✓', 'success'); ctx.refreshUser(u); }
      else toast('لم يتم التوثيق بعد — افتح الرابط في بريدك أولاً', 'error');
    }
  });

  const closeMenu = (ev) => { if (!ev.target.closest('.menu-wrap')) { const m = $('#menu'); if (m) m.hidden = true; } };
  document.addEventListener('click', closeMenu);

  renderBanner();
  renderChips();
  update();

  return {
    update,
    destroy() { document.removeEventListener('click', closeMenu); },
  };
}
