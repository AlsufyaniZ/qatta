// ─────────────────────────────────────────────
// Group dashboard — المصاريف الإجمالية (بمدى زمني) + الفلوس اللي لي/علي + المصاريف
// ─────────────────────────────────────────────
import { icon, esc, avatar, money, num, relTime, toast, errorMessage, openSheet } from '../ui.js';
import {
  T, FILTERS, PERIODS, category, balances, periodTotals, filterExpenses, groupMembers,
  isMe, myParticipant, iAmPayer, payerOf, remainingAmount, isFullySettled,
} from '../models.js';
import { openAddExpense } from './add-expense.js';
import { openInvite } from './group-sheets.js';

export function mountGroup(root, ctx, code) {
  const { state, backend } = ctx;
  const signal = ctx.signal;
  const me = state.user;
  let animateList = true;
  let rendered = false;
  let deleting = false;

  const group = () => state.groups.find(g => g.id === code);
  const expenses = () => state.expenses.get(code) || [];

  function shell(g) {
    root.innerHTML = `
      <div class="screen home group-page">
        <header class="page-head">
          <button class="icon-btn" data-act="back" aria-label="رجوع">${icon('chevronRight', 22)}</button>
          <div class="g-head">
            <span class="g-emoji sm">${esc(g.emoji || '👥')}</span>
            <h1>${esc(g.name)}</h1>
          </div>
          <button class="icon-btn" data-act="options" aria-label="خيارات المجموعة">${icon('more', 22)}</button>
        </header>

        <div class="period-bar" id="periods" role="tablist" aria-label="المدى الزمني"></div>

        <section class="dash" id="dash"></section>

        <section class="members-row anim-up d2" id="members"></section>

        <nav class="chips-bar" id="chips" aria-label="تصفية المصاريف"></nav>
        <p class="list-hint" id="list-hint"></p>
        <section class="expense-list" id="list">${[0, 1].map(() => '<div class="skeleton"></div>').join('')}</section>

        <button class="fab" data-act="add">${icon('plus', 18)}<span>إضافة مصروف</span></button>
      </div>`;
    rendered = true;
  }

  const $ = (s) => root.querySelector(s);

  function renderPeriods() {
    $('#periods').innerHTML = PERIODS.map(p =>
      `<button role="tab" aria-selected="${state.period === p.id}" class="period ${state.period === p.id ? 'on' : ''}" data-period="${p.id}">${p.label}</button>`).join('');
  }

  function renderDash() {
    const list = expenses();
    const pt = periodTotals(list, me, state.period);
    const b = balances(list, me);
    const pLabel = PERIODS.find(p => p.id === state.period);
    $('#dash').innerHTML = `
      <div class="dash-total anim-up">
        <div class="deco deco-1"></div>
        <span class="bal-label">${icon('wallet', 15)} المصاريف الإجمالية · ${pLabel.months ? 'آخر ' + pLabel.label : 'كل الفترات'}</span>
        <strong class="bal-hero sm">${money(pt.total)}</strong>
        <span class="dash-sub">${num(pt.count)} مصروف · حصتي ${money(pt.myShare)}</span>
      </div>
      <div class="dash-row anim-up d1">
        <div class="dash-card" style="--c:var(--accent)">
          <span class="dash-ic">${icon('arrowDown', 16)}</span>
          <span class="dash-t">${T.owedToMe}</span>
          <strong>${money(b.owedToMe)}</strong>
        </div>
        <div class="dash-card" style="--c:var(--danger)">
          <span class="dash-ic">${icon('arrowUp', 16)}</span>
          <span class="dash-t">${T.iOwe}</span>
          <strong>${money(b.iOwe)}</strong>
        </div>
      </div>`;
  }

  function renderMembers(g) {
    const members = groupMembers(g);
    $('#members').innerHTML = `
      <div class="members-strip">
        ${members.map(m => `<span class="member" title="${esc(m.name)}">${avatar(m.name, m.avatarColor, 38)}<span>${esc(m.uid === me.uid ? 'أنت' : m.name.split(' ')[0])}</span></span>`).join('')}
        <button class="member add" data-act="invite"><span class="add-ic">${icon('userPlus', 18)}</span><span>دعوة</span></button>
      </div>`;
  }

  function renderChips() {
    $('#chips').innerHTML = FILTERS.map(f =>
      `<button class="chip ${state.filter === f.id ? 'on' : ''}" data-filter="${f.id}">${f.label}</button>`).join('');
    const hint = $('#list-hint');
    hint.textContent = (state.filter === 'iOwe' || state.filter === 'owedToMe') ? 'تظهر كل المبالغ غير المدفوعة بغض النظر عن المدى الزمني' : '';
  }

  // ── Expense card ──
  const pill = (t, tone) => `<span class="pill pill-${tone}">${esc(t)}</span>`;
  function statusPill(exp) {
    if (isFullySettled(exp)) return pill(T.paid, 'accent');
    if (iAmPayer(exp, me)) return pill(`لك ${money(remainingAmount(exp), exp.currency)}`, 'accent');
    const mine = myParticipant(exp, me);
    if (mine && !mine.isPaid) return pill(`عليك ${money(mine.shareAmount, exp.currency)}`, 'danger');
    if (mine?.isPaid) return pill('دفعت', 'muted');
    return pill('لست مشاركاً', 'muted');
  }

  function participantRow(exp, p) {
    const canSettle = !p.isPaid && (iAmPayer(exp, me) || isMe(p, me));
    let trail;
    if (p.isPaid) trail = `<span class="ok" title="${T.paid}">${icon('checkCircle', 20)}</span>`;
    else if (canSettle) trail = `<button class="settle-btn" data-settle="${esc(exp.id)}" data-pid="${esc(p.id)}">تم الدفع</button>`;
    else trail = `<span class="wait" title="لم يُدفع">${icon('clock', 17)}</span>`;
    return `
      <div class="p-row">
        ${avatar(p.name, p.avatarColor, 34)}
        <div class="p-info">
          <span class="p-name">${esc(p.name)}${isMe(p, me) ? ' <em class="tag">أنت</em>' : ''}${p.id === exp.paidByUserId ? ' <em class="tag tag-accent">الدافع</em>' : ''}${p.isGuest ? ' <em class="tag tag-muted">ضيف</em>' : ''}</span>
          ${p.phone ? `<span class="p-phone" dir="ltr">${esc(p.phone)}</span>` : ''}
        </div>
        <span class="p-amt">${money(p.shareAmount, exp.currency)}</span>
        ${trail}
      </div>`;
  }

  function expenseCard(exp, i, g) {
    const cat = category(exp.category);
    const open = state.expanded.has(exp.id);
    const payer = payerOf(exp);
    const canDelete = exp.createdBy === me.uid || g.createdBy === me.uid;
    return `
      <article class="expense-card ${open ? 'expanded' : ''} ${animateList ? 'anim-up' : ''}" style="animation-delay:${i * 60}ms">
        <button class="ex-main" data-toggle="${esc(exp.id)}" aria-expanded="${open}">
          <span class="ex-icon">${icon(cat.icon, 21)}</span>
          <span class="ex-meta">
            <span class="ex-title">${esc(exp.title)}</span>
            <span class="ex-sub">
              <span>${relTime(exp.createdAt)}</span><i class="dot"></i>
              <span>${payer ? (iAmPayer(exp, me) ? 'دفعته أنت' : 'دفعها ' + esc(payer.name.split(' ')[0])) : ''}</span>
            </span>
            <span class="strip">${exp.participants.slice(0, 4).map(p => avatar(p.name, p.avatarColor, 22)).join('')}${exp.participants.length > 4 ? `<span class="avatar more" style="width:22px;height:22px">+${exp.participants.length - 4}</span>` : ''}</span>
          </span>
          <span class="ex-side">
            <span class="ex-amt">${money(exp.totalAmount, exp.currency)}</span>
            ${statusPill(exp)}
            <span class="chev">${icon('chevronDown', 14)}</span>
          </span>
        </button>
        <div class="ex-details"><div>
          <div class="ex-details-in">${exp.participants.map(p => participantRow(exp, p)).join('')}</div>
          ${exp.note ? `<div class="ex-note">${icon('note', 14)}<span>${esc(exp.note)}</span></div>` : ''}
          ${canDelete ? `<div class="ex-actions"><button class="del-btn" data-delete="${esc(exp.id)}">${icon('trash', 15)}<span>حذف المصروف</span></button></div>` : ''}
        </div></div>
      </article>`;
  }

  function renderList(g) {
    if (!state.expLoaded.has(code)) return;
    const list = filterExpenses(expenses(), state.filter, me, state.period);
    if (!list.length) {
      const msgs = {
        all: ['لا توجد مصاريف في هذه الفترة', 'اضغط «إضافة مصروف» لتسجيل أول مصروف'],
        iOwe: ['لا يوجد عليك شيء 🎉', 'كل حصصك مدفوعة'],
        owedToMe: ['لا أحد عليه لك', 'كل المشاركين دفعوا حصصهم'],
        settled: ['لا توجد مصاريف مدفوعة بالكامل', 'تظهر هنا بعد دفع كل الحصص'],
      }[state.filter];
      $('#list').innerHTML = `<div class="empty"><span class="pulse">${icon('inbox', 44)}</span><strong>${msgs[0]}</strong><span>${msgs[1]}</span></div>`;
    } else {
      $('#list').innerHTML = list.map((e, i) => expenseCard(e, i, g)).join('');
    }
    animateList = false;
  }

  function update() {
    if (deleting) return;
    const g = group();
    if (!g) {
      if (state.groupsLoaded && !rendered) {
        root.innerHTML = `
          <div class="screen center-msg">
            <span class="muted">${icon('users', 46)}</span>
            <h2>المجموعة غير متاحة</h2>
            <p>ربما حُذفت أو لست عضواً فيها.</p>
            <button class="btn-primary" data-act="home"><span>العودة للمجموعات</span></button>
          </div>`;
      } else if (rendered && state.groupsLoaded) {
        toast('لم تعد هذه المجموعة متاحة', 'error');
        ctx.go('');
      } else if (!rendered) {
        root.innerHTML = '<div class="screen center-msg"><i class="spinner dark"></i></div>';
      }
      return;
    }
    if (!rendered) shell(g);
    renderPeriods(); renderDash(); renderMembers(g); renderChips(); renderList(g);
  }

  // ── Options sheet ──
  function openOptions() {
    const g = group();
    if (!g) return;
    const isOwner = g.createdBy === me.uid;
    const { el, close } = openSheet(`
      <div class="card-title"><h2>${esc(g.emoji || '')} ${esc(g.name)}</h2><p>رمز المجموعة: <b dir="ltr">${esc(g.id)}</b></p></div>
      <div class="action-list">
        <button data-opt="invite">${icon('userPlus', 19)}<span>دعوة أعضاء</span></button>
        ${isOwner
          ? `<button data-opt="delete" class="danger">${icon('trash', 19)}<span>حذف المجموعة</span></button>`
          : `<p class="hint-box">${icon('info', 15)}<span>حذف المجموعة متاح لمنشئها فقط</span></p>`}
      </div>`, { label: 'خيارات المجموعة' });
    el.querySelector('[data-opt="invite"]').addEventListener('click', () => { close(); setTimeout(() => openInvite(ctx, g), 280); });
    el.querySelector('[data-opt="delete"]')?.addEventListener('click', () => { close(); setTimeout(confirmDelete, 280); });
  }

  function confirmDelete() {
    const g = group();
    const count = expenses().length;
    const { el, close } = openSheet(`
      <div class="card-title"><h2>حذف «${esc(g.name)}»؟</h2>
        <p>سيتم حذف المجموعة${count ? ` ومصاريفها (${num(count)})` : ''} نهائياً لجميع الأعضاء. لا يمكن التراجع عن هذا الإجراء.</p></div>
      <div class="btn-col">
        <button class="btn-danger" id="do-del"><span>نعم، احذف المجموعة</span><i class="spinner"></i></button>
        <button class="btn-tint" id="cancel-del"><span>إلغاء</span></button>
      </div>`, { label: 'تأكيد الحذف' });
    el.querySelector('#cancel-del').addEventListener('click', close);
    el.querySelector('#do-del').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.classList.add('loading'); btn.disabled = true;
      try {
        deleting = true; // يمنع رسالة "لم تعد متاحة"
        await backend.deleteGroup(code);
        close();
        toast('تم حذف المجموعة', 'success');
        ctx.go('');
      } catch (e) {
        console.warn(e); deleting = false;
        toast(errorMessage(e), 'error');
        btn.classList.remove('loading'); btn.disabled = false;
      }
    });
  }

  function confirmDeleteExpense(exp) {
    const { el, close } = openSheet(`
      <div class="card-title"><h2>حذف «${esc(exp.title)}»؟</h2><p>لا يمكن التراجع عن هذا الإجراء.</p></div>
      <div class="btn-col">
        <button class="btn-danger" id="do-del"><span>حذف المصروف</span></button>
        <button class="btn-tint" id="cancel-del"><span>إلغاء</span></button>
      </div>`, { label: 'تأكيد الحذف' });
    el.querySelector('#cancel-del').addEventListener('click', close);
    el.querySelector('#do-del').addEventListener('click', async () => {
      try { await backend.deleteExpense(code, exp.id); state.expanded.delete(exp.id); close(); toast('تم حذف المصروف', 'success'); }
      catch (e) { console.warn(e); toast(errorMessage(e), 'error'); }
    });
  }

  // ── Events ──
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'back' || act === 'home') return ctx.go('');
    if (act === 'options') return openOptions();
    if (act === 'invite') return openInvite(ctx, group());
    if (act === 'add') return openAddExpense(ctx, group());

    if (t.dataset.period) { state.period = t.dataset.period; animateList = true; renderPeriods(); renderDash(); renderList(group()); return; }
    if (t.dataset.filter) { state.filter = t.dataset.filter; animateList = true; renderChips(); renderList(group()); return; }

    if (t.dataset.toggle) {
      const id = t.dataset.toggle;
      const open = !state.expanded.has(id);
      open ? state.expanded.add(id) : state.expanded.delete(id);
      t.closest('.expense-card').classList.toggle('expanded', open);
      t.setAttribute('aria-expanded', open);
      return;
    }

    if (t.dataset.settle) {
      const exp = expenses().find(e => e.id === t.dataset.settle);
      if (!exp) return;
      t.disabled = true;
      const participants = exp.participants.map(p => p.id === t.dataset.pid ? { ...p, isPaid: true } : p);
      try { await backend.updateParticipants(code, exp.id, participants); toast('تم تسجيل الدفع', 'success'); }
      catch (e) { console.warn(e); toast(errorMessage(e), 'error'); t.disabled = false; }
      return;
    }

    if (t.dataset.delete) {
      const exp = expenses().find(e => e.id === t.dataset.delete);
      if (exp) confirmDeleteExpense(exp);
    }
  }, { signal });

  state.filter = 'all';
  state.period = '1m'; // الافتراضي: آخر شهر
  update();
  return { update };
}
