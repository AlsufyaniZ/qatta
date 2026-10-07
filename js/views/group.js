// ─────────────────────────────────────────────
// Group dashboard
//   المصاريف الإجمالية (بمدى زمني) · الفلوس اللي لي/علي (تسوية صافية)
//   تبويب المصاريف · تبويب تقفيل الحساب · مشاركة واتساب · إدارة الأعضاء
// ─────────────────────────────────────────────
import { icon, esc, avatar, money, moneyText, num, relTime, toast, errorMessage, openSheet } from '../ui.js';
import {
  T, PERIODS, category, periodTotals, expensesInPeriod, groupMembers, groupNets, simplifyDebts, myBalance,
  isMe, myParticipant, iAmPayer, payerOf, isZero,
} from '../models.js';
import { openAddExpense } from './add-expense.js';
import { openInvite, inviteLink } from './group-sheets.js';

export function mountGroup(root, ctx, code) {
  const { state, backend } = ctx;
  const signal = ctx.signal;
  const me = state.user;
  let animateList = true;
  let rendered = false;
  let leaving = false;

  const group = () => state.groups.find(g => g.id === code);
  const expenses = () => state.expenses.get(code) || [];
  const settlements = () => state.settlements.get(code) || [];
  const isOwner = () => group()?.createdBy === me.uid;
  const first = (name = '') => name.split(' ')[0];
  const who = (p) => (p.id === me.uid ? 'أنت' : p.name);

  function shell(g) {
    root.innerHTML = `
      <div class="screen home group-page">
        <header class="page-head wide">
          <button class="icon-btn" data-act="back" aria-label="رجوع">${icon('chevronRight', 22)}</button>
          <div class="g-head">
            <span class="g-emoji sm">${esc(g.emoji || '👥')}</span>
            <h1>${esc(g.name)}</h1>
          </div>
          <div class="head-actions">
            <button class="icon-btn" data-act="settings" aria-label="الإعدادات">${icon('settings', 21)}</button>
            <button class="icon-btn" data-act="options" aria-label="خيارات المجموعة">${icon('more', 21)}</button>
          </div>
        </header>

        <div class="period-bar" id="periods" role="tablist" aria-label="المدى الزمني"></div>
        <section class="dash" id="dash"></section>
        <section class="members-row" id="members"></section>

        <nav class="tabs" id="tabs" role="tablist"></nav>
        <section id="tab-body"></section>

        <button class="fab" data-act="add">${icon('plus', 18)}<span>إضافة مصروف</span></button>
      </div>`;
    rendered = true;
  }

  const $ = (s) => root.querySelector(s);

  // ── Dashboard ──
  function renderPeriods() {
    $('#periods').innerHTML = PERIODS.map(p =>
      `<button role="tab" aria-selected="${state.period === p.id}" class="period ${state.period === p.id ? 'on' : ''}" data-period="${p.id}">${p.label}</button>`).join('');
  }

  function renderDash() {
    const g = group();
    const pt = periodTotals(expenses(), me, state.period);
    const b = myBalance(expenses(), settlements(), g, me);
    const pLabel = PERIODS.find(p => p.id === state.period);
    $('#dash').innerHTML = `
      <div class="dash-total">
        <div class="deco deco-1"></div>
        <span class="bal-label">${icon('wallet', 15)} المصاريف الإجمالية · ${pLabel.months ? 'آخر ' + pLabel.label : 'كل الفترات'}</span>
        <strong class="bal-hero sm">${money(pt.total)}</strong>
        <span class="dash-sub">${num(pt.count)} مصروف · حصتي ${money(pt.myShare)}</span>
        <button class="stats-btn" data-act="stats">${icon('pie', 15)}<span>الإحصائيات</span></button>
      </div>
      <div class="dash-row">
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
        ${members.map(m => `
          <button class="member" data-member="${esc(m.uid)}" title="${esc(m.name)}">
            ${avatar(m.name, m.avatarColor, 38)}
            <span>${esc(m.uid === me.uid ? 'أنت' : first(m.name))}</span>
          </button>`).join('')}
        <button class="member add" data-act="invite"><span class="add-ic">${icon('userPlus', 18)}</span><span>دعوة</span></button>
      </div>`;
  }

  function renderTabs() {
    const transfers = simplifyDebts(groupNets(expenses(), settlements(), group()));
    $('#tabs').innerHTML = `
      <button role="tab" class="tab ${state.groupTab === 'expenses' ? 'on' : ''}" data-tab="expenses">المصاريف</button>
      <button role="tab" class="tab ${state.groupTab === 'closing' ? 'on' : ''}" data-tab="closing">
        ${T.closing}${transfers.length ? `<span class="badge">${num(transfers.length)}</span>` : `<span class="badge ok">✓</span>`}
      </button>`;
  }

  // ── Expenses tab ──
  function expenseCard(exp, i, g) {
    const cat = category(exp.category);
    const open = state.expanded.has(exp.id);
    const payer = payerOf(exp);
    const mine = myParticipant(exp, me);
    const canEdit = exp.createdBy === me.uid;
    const canDelete = canEdit || g.createdBy === me.uid;
    const pill = iAmPayer(exp, me)
      ? `<span class="pill pill-accent">دفعته أنت</span>`
      : mine ? `<span class="pill pill-muted">حصتك ${money(mine.shareAmount)}</span>`
        : `<span class="pill pill-muted">لست مشاركاً</span>`;
    return `
      <article class="expense-card ${open ? 'expanded' : ''} ${animateList ? 'anim-up' : ''}" style="animation-delay:${i * 50}ms">
        <button class="ex-main" data-toggle="${esc(exp.id)}" aria-expanded="${open}">
          <span class="ex-icon" style="--cc:var(--cat-${cat.id})">${icon(cat.icon, 21)}</span>
          <span class="ex-meta">
            <span class="ex-title">${esc(exp.title)}</span>
            <span class="ex-sub">
              <span>${relTime(exp.createdAt)}</span><i class="dot"></i>
              <span>${payer ? (iAmPayer(exp, me) ? 'دفعته أنت' : 'دفعها ' + esc(first(payer.name))) : ''}</span>
            </span>
            <span class="strip">${exp.participants.filter(p => p.shareAmount > 0).slice(0, 4).map(p => avatar(p.name, p.avatarColor, 22)).join('')}</span>
          </span>
          <span class="ex-side">
            <span class="ex-amt">${money(exp.totalAmount)}</span>
            ${pill}
            <span class="chev">${icon('chevronDown', 14)}</span>
          </span>
        </button>
        <div class="ex-details"><div>
          <div class="ex-details-in">
            ${exp.participants.filter(p => p.shareAmount > 0 || p.id === exp.paidByUserId).map(p => `
              <div class="p-row">
                ${avatar(p.name, p.avatarColor, 32)}
                <div class="p-info">
                  <span class="p-name">${esc(p.name)}${isMe(p, me) ? ' <em class="tag">أنت</em>' : ''}${p.id === exp.paidByUserId ? ' <em class="tag tag-accent">الدافع</em>' : ''}${p.isGuest ? ' <em class="tag tag-muted">ضيف</em>' : ''}</span>
                </div>
                <span class="p-amt">${money(p.shareAmount)}</span>
              </div>`).join('')}
          </div>
          ${exp.note ? `<div class="ex-note">${icon('note', 14)}<span>${esc(exp.note)}</span></div>` : ''}
          ${canEdit || canDelete ? `<div class="ex-actions">
            ${canEdit ? `<button class="edit-btn" data-edit="${esc(exp.id)}">${icon('edit', 15)}<span>تعديل</span></button>` : ''}
            ${canDelete ? `<button class="del-btn" data-delete="${esc(exp.id)}">${icon('trash', 15)}<span>حذف</span></button>` : ''}
          </div>` : ''}
        </div></div>
      </article>`;
  }

  function renderExpensesTab(g) {
    if (!state.expLoaded.has(code)) { $('#tab-body').innerHTML = '<div class="skeleton"></div>'; return; }
    const list = expensesInPeriod(expenses(), state.period);
    $('#tab-body').innerHTML = list.length
      ? `<div class="expense-list">${list.map((e, i) => expenseCard(e, i, g)).join('')}</div>`
      : `<div class="empty"><span class="pulse">${icon('inbox', 44)}</span><strong>لا توجد مصاريف في هذه الفترة</strong><span>اضغط «إضافة مصروف» لتسجيل أول مصروف</span></div>`;
    animateList = false;
  }

  // ── Closing tab (تقفيل الحساب) ──
  function canMarkPaid(t) {
    return t.from.id === me.uid || t.to.id === me.uid || isOwner();
  }

  function renderClosingTab(g) {
    const nets = groupNets(expenses(), settlements(), g);
    const transfers = simplifyDebts(nets);
    const hist = [...settlements()].sort((a, b) => b.createdAt - a.createdAt);
    const people = [...nets.values()].filter(v => v.isMember || !isZero(v.net)).sort((a, b) => b.net - a.net);

    $('#tab-body').innerHTML = `
      <button class="btn-whatsapp sm-mb" data-act="whatsapp">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.4 9.4 0 0 1 9.43 9.44c0 5.2-4.24 9.43-9.45 9.43M20.08 3.9A11.27 11.27 0 0 0 12.05.57C5.8.57.7 5.66.7 11.92c0 2 .52 3.95 1.52 5.67L.6 23.43l5.98-1.57a11.3 11.3 0 0 0 5.46 1.39h.01c6.25 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02"/></svg>
        <span>مشاركة الوضع في واتساب</span>
      </button>

      ${transfers.length ? `
        <h3 class="sec-head sm">لتقفيل الحساب، نفّذوا التحويلات التالية</h3>
        <div class="transfer-list">
          ${transfers.map((t, i) => `
            <div class="transfer ${t.from.id === me.uid || t.to.id === me.uid ? 'mine' : ''}">
              <div class="tr-people">
                <span class="tr-person">${avatar(t.from.name, t.from.avatarColor, 34)}<b>${esc(t.from.id === me.uid ? 'أنت' : first(t.from.name))}</b></span>
                <span class="tr-arrow">${icon('chevronLeft', 16)}<i>${t.from.id === me.uid ? 'تحوّل' : 'يحوّل'}</i></span>
                <span class="tr-person">${avatar(t.to.name, t.to.avatarColor, 34)}<b>${esc(t.to.id === me.uid ? 'لك' : first(t.to.name))}</b></span>
              </div>
              <div class="tr-side">
                <strong class="tr-amt">${money(t.amount)}</strong>
                ${canMarkPaid(t) ? `<button class="settle-btn" data-transfer="${i}">تم الدفع</button>` : ''}
              </div>
            </div>`).join('')}
        </div>` : `
        <div class="closed-ok">
          <span class="closed-ic">${icon('checkCircle', 34)}</span>
          <strong>الحساب مقفل ✓</strong>
          <span>${expenses().length ? 'لا توجد مبالغ مستحقة بين الأعضاء' : 'لا توجد مصاريف بعد'}</span>
        </div>`}

      <h3 class="sec-head sm mt-s">صافي كل عضو</h3>
      <div class="card net-list">
        ${people.map(v => `
          <div class="net-row">
            ${avatar(v.name, v.avatarColor, 30)}
            <span class="grow"><span>${esc(v.id === me.uid ? 'أنت' : v.name)}${!v.isMember ? ` <em class="tag tag-muted">${v.isGuest ? 'ضيف' : 'غادر'}</em>` : ''}</span></span>
            <span class="net-amt ${isZero(v.net) ? '' : v.net > 0 ? 'pos' : 'neg'}">${isZero(v.net) ? 'مقفل' : (v.net > 0 ? 'له ' : 'عليه ') + money(Math.abs(v.net))}</span>
          </div>`).join('')}
      </div>

      ${hist.length ? `
        <h3 class="sec-head sm mt-s">سجل التسويات</h3>
        <div class="card hist-list">
          ${hist.map(h => `
            <div class="hist-row">
              <span class="hist-ic">${icon('checkCircle', 17)}</span>
              <span class="grow">${h.from === me.uid ? 'حوّلت' : esc(first(h.fromName)) + ' حوّل'} ${h.to === me.uid ? 'لك' : 'لـ ' + esc(first(h.toName))} ${money(h.amount)}<small>${relTime(h.createdAt)}</small></span>
              ${h.createdBy === me.uid || isOwner() ? `<button class="undo-btn" data-undo="${esc(h.id)}">تراجع</button>` : ''}
            </div>`).join('')}
        </div>` : ''}
    `;
    state._transfers = transfers;
  }

  function renderTab(g) {
    renderTabs();
    if (state.groupTab === 'closing') renderClosingTab(g); else renderExpensesTab(g);
  }

  function update() {
    if (leaving) return;
    const g = group();
    if (!g) {
      if (state.groupsLoaded && !rendered) {
        root.innerHTML = `
          <div class="screen center-msg">
            <span class="muted">${icon('users', 46)}</span>
            <h2>المجموعة غير متاحة</h2>
            <p>ربما حُذفت أو لم تعد عضواً فيها.</p>
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
    renderPeriods(); renderDash(); renderMembers(g); renderTab(g);
  }

  // ── WhatsApp report ──
  function whatsappReport() {
    const g = group();
    const pt = periodTotals(expenses(), me, state.period);
    const pLabel = PERIODS.find(p => p.id === state.period);
    const transfers = simplifyDebts(groupNets(expenses(), settlements(), g));
    const lines = [
      `*${g.emoji || ''} ${g.name}*`,
      `🧾 إجمالي المصاريف (${pLabel.months ? 'آخر ' + pLabel.label : 'كل الفترات'}): *${moneyText(pt.total)}* · ${pt.count} مصروف`,
      '',
    ];
    if (transfers.length) {
      lines.push('*💸 تقفيل الحساب:*');
      transfers.forEach(t => lines.push(`• ${t.from.name} يحوّل إلى ${t.to.name}: *${moneyText(t.amount)}*`));
    } else {
      lines.push('✅ *الحساب مقفل* — لا توجد مبالغ مستحقة');
    }
    lines.push('', `_عبر تطبيق قطة_ ${location.origin + location.pathname.replace(/index\.html$/, '')}`);
    return lines.join('\n');
  }

  // ── Sheets ──
  function openOptions() {
    const g = group();
    if (!g) return;
    const { el, close } = openSheet(`
      <div class="card-title"><h2>${esc(g.emoji || '')} ${esc(g.name)}</h2><p>رمز المجموعة: <b dir="ltr">${esc(g.id)}</b></p></div>
      <div class="action-list">
        <button data-opt="invite">${icon('userPlus', 19)}<span>دعوة أعضاء</span></button>
        <button data-opt="members">${icon('users', 19)}<span>الأعضاء (${num(g.members.length)})</span></button>
        <button data-opt="stats">${icon('pie', 19)}<span>الإحصائيات</span></button>
        <button data-opt="whatsapp">${icon('share', 19)}<span>مشاركة الوضع في واتساب</span></button>
        ${isOwner()
          ? `<button data-opt="delete" class="danger">${icon('trash', 19)}<span>حذف المجموعة</span></button>`
          : `<button data-opt="leave" class="danger">${icon('logout', 19)}<span>الخروج من المجموعة</span></button>`}
      </div>`, { label: 'خيارات المجموعة' });
    const go = (fn) => () => { close(); setTimeout(fn, 280); };
    el.querySelector('[data-opt="invite"]').addEventListener('click', go(() => openInvite(ctx, g)));
    el.querySelector('[data-opt="members"]').addEventListener('click', go(openMembers));
    el.querySelector('[data-opt="stats"]').addEventListener('click', () => { close(); ctx.go('stats/' + code); });
    el.querySelector('[data-opt="whatsapp"]').addEventListener('click', () => { close(); shareWhatsApp(); });
    el.querySelector('[data-opt="delete"]')?.addEventListener('click', go(confirmDeleteGroup));
    el.querySelector('[data-opt="leave"]')?.addEventListener('click', go(confirmLeave));
  }

  function shareWhatsApp() {
    window.open('https://wa.me/?text=' + encodeURIComponent(whatsappReport()), '_blank', 'noopener');
  }

  function openMembers(focusUid = null) {
    const g = group();
    const members = groupMembers(g);
    const nets = groupNets(expenses(), settlements(), g);
    const { el, close } = openSheet(`
      <div class="card-title"><h2>الأعضاء</h2><p>${isOwner() ? 'يمكنك إزالة أي عضو — تبقى مصاريفه وديونه في المجموعة' : 'أعضاء المجموعة وأرصدتهم'}</p></div>
      <div class="card net-list">
        ${members.map(m => {
          const n = nets.get(m.uid)?.net || 0;
          return `
          <div class="net-row ${focusUid === m.uid ? 'focus' : ''}">
            ${avatar(m.name, m.avatarColor, 34)}
            <span class="grow"><span>${esc(m.name)}${m.uid === me.uid ? ' <em class="tag">أنت</em>' : ''}${m.uid === g.createdBy ? ' <em class="tag tag-accent">المنشئ</em>' : ''}</span>
              <small class="net-amt ${isZero(n) ? '' : n > 0 ? 'pos' : 'neg'}">${isZero(n) ? 'مقفل' : (n > 0 ? 'له ' : 'عليه ') + money(Math.abs(n))}</small></span>
            ${isOwner() && m.uid !== me.uid ? `<button class="undo-btn danger" data-remove="${esc(m.uid)}">إزالة</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <button class="btn-tint" data-invite>${icon('userPlus', 18)}<span>دعوة أعضاء</span></button>`, { label: 'الأعضاء' });
    el.querySelector('[data-invite]').addEventListener('click', () => { close(); setTimeout(() => openInvite(ctx, g), 280); });
    el.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      const m = members.find(x => x.uid === b.dataset.remove);
      close(); setTimeout(() => confirmRemove(m), 280);
    }));
  }

  function confirmSheet({ title, body, cta, danger = true, onConfirm }) {
    const { el, close } = openSheet(`
      <div class="card-title"><h2>${title}</h2><p>${body}</p></div>
      <div class="btn-col">
        <button class="${danger ? 'btn-danger' : 'btn-primary'}" id="ok"><span>${cta}</span><i class="spinner"></i></button>
        <button class="btn-tint" id="no"><span>إلغاء</span></button>
      </div>`, { label: title });
    el.querySelector('#no').addEventListener('click', close);
    el.querySelector('#ok').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.classList.add('loading'); btn.disabled = true;
      try { await onConfirm(); close(); }
      catch (e) { console.warn(e); toast(errorMessage(e), 'error'); btn.classList.remove('loading'); btn.disabled = false; }
    });
  }

  function confirmRemove(m) {
    const n = groupNets(expenses(), settlements(), group()).get(m.uid)?.net || 0;
    confirmSheet({
      title: `إزالة ${esc(m.name)}؟`,
      body: `لن يرى المجموعة بعد الآن، لكن تبقى مصاريفه وديونه كما هي${isZero(n) ? '' : ` (${n > 0 ? 'له' : 'عليه'} ${money(Math.abs(n))})`} ويمكن تسويتها لاحقاً.`,
      cta: 'إزالة العضو',
      onConfirm: async () => { await backend.removeMember(code, m.uid); toast(`تمت إزالة ${m.name}`, 'success'); },
    });
  }

  function confirmLeave() {
    const b = myBalance(expenses(), settlements(), group(), me);
    confirmSheet({
      title: `الخروج من «${esc(group().name)}»؟`,
      body: `${isZero(b.net) ? 'حسابك مقفل في هذه المجموعة.' : `لديك رصيد غير مسوّى: ${b.net > 0 ? 'لك' : 'عليك'} ${money(Math.abs(b.net))}.`} تبقى مصاريفك وديونك في المجموعة ولا تُحذف، ويمكنك العودة لاحقاً بالرمز.`,
      cta: 'الخروج من المجموعة',
      onConfirm: async () => {
        leaving = true;
        try { await backend.leaveGroup(code, me.uid); }
        catch (e) { leaving = false; throw e; }
        toast('خرجت من المجموعة', 'success');
        ctx.go('');
      },
    });
  }

  function confirmDeleteGroup() {
    const g = group();
    const count = expenses().length;
    confirmSheet({
      title: `حذف «${esc(g.name)}»؟`,
      body: `سيتم حذف المجموعة${count ? ` ومصاريفها (${num(count)})` : ''} وسجل التسويات نهائياً لجميع الأعضاء. لا يمكن التراجع عن هذا الإجراء.`,
      cta: 'نعم، احذف المجموعة',
      onConfirm: async () => {
        leaving = true;
        try { await backend.deleteGroup(code); }
        catch (e) { leaving = false; throw e; }
        toast('تم حذف المجموعة', 'success');
        ctx.go('');
      },
    });
  }

  function confirmDeleteExpense(exp) {
    confirmSheet({
      title: `حذف «${esc(exp.title)}»؟`,
      body: 'سيُعاد حساب الأرصدة وتقفيل الحساب تلقائياً. لا يمكن التراجع عن هذا الإجراء.',
      cta: 'حذف المصروف',
      onConfirm: async () => { await backend.deleteExpense(code, exp.id); state.expanded.delete(exp.id); toast('تم حذف المصروف', 'success'); },
    });
  }

  function confirmTransfer(t) {
    const fromLbl = t.from.id === me.uid ? 'أنك حوّلت' : `أن ${esc(t.from.name)} حوّل`;
    const toLbl = t.to.id === me.uid ? 'لك' : `إلى ${esc(t.to.name)}`;
    confirmSheet({
      title: 'تأكيد الدفع',
      body: `تأكيد ${fromLbl} ${money(t.amount)} ${toLbl}؟`,
      cta: 'نعم، تم الدفع',
      danger: false,
      onConfirm: async () => {
        await backend.addSettlement(code, {
          from: t.from.id, to: t.to.id, amount: t.amount,
          fromName: t.from.name, toName: t.to.name, createdBy: me.uid,
        });
        setTimeout(showSettled, 320);
      },
    });
  }

  function showSettled() {
    const left = simplifyDebts(groupNets(expenses(), settlements(), group())).length;
    const { el, close } = openSheet(`
      <div class="settled-msg">
        <span class="settled-ic">${icon('checkCircle', 46)}</span>
        <h2>تمت التسوية ✓</h2>
        <p>${left ? `متبقي ${num(left)} ${left === 1 ? 'تحويل' : 'تحويلات'} لتقفيل الحساب بالكامل` : 'تم تقفيل الحساب بالكامل 🎉 لا توجد مبالغ مستحقة في المجموعة'}</p>
      </div>
      <button class="btn-primary" id="done"><span>تم</span></button>`, { label: 'تمت التسوية' });
    el.querySelector('#done').addEventListener('click', close);
  }

  // ── Events ──
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'back' || act === 'home') return ctx.go('');
    if (act === 'settings') return ctx.go('settings');
    if (act === 'options') return openOptions();
    if (act === 'invite') return openInvite(ctx, group());
    if (act === 'add') return openAddExpense(ctx, group());
    if (act === 'stats') return ctx.go('stats/' + code);
    if (act === 'whatsapp') return shareWhatsApp();

    if (t.dataset.member) return openMembers(t.dataset.member);
    if (t.dataset.period) { state.period = t.dataset.period; animateList = true; renderPeriods(); renderDash(); renderTab(group()); return; }
    if (t.dataset.tab) { state.groupTab = t.dataset.tab; animateList = true; renderTab(group()); return; }

    if (t.dataset.toggle) {
      const id = t.dataset.toggle;
      const open = !state.expanded.has(id);
      open ? state.expanded.add(id) : state.expanded.delete(id);
      t.closest('.expense-card').classList.toggle('expanded', open);
      t.setAttribute('aria-expanded', open);
      return;
    }
    if (t.dataset.edit) {
      const exp = expenses().find(e => e.id === t.dataset.edit);
      if (exp) openAddExpense(ctx, group(), exp);
      return;
    }
    if (t.dataset.delete) {
      const exp = expenses().find(e => e.id === t.dataset.delete);
      if (exp) confirmDeleteExpense(exp);
      return;
    }
    if (t.dataset.transfer) {
      const tr = state._transfers?.[+t.dataset.transfer];
      if (tr) confirmTransfer(tr);
      return;
    }
    if (t.dataset.undo) {
      const h = settlements().find(x => x.id === t.dataset.undo);
      if (!h) return;
      confirmSheet({
        title: 'التراجع عن التسوية؟',
        body: `سيُلغى تسجيل تحويل ${money(h.amount)} من ${esc(h.fromName)} إلى ${esc(h.toName)}.`,
        cta: 'تراجع',
        onConfirm: async () => { await backend.deleteSettlement(code, h.id); toast('تم التراجع', 'success'); },
      });
    }
  }, { signal });

  state.period = '1m';
  state.groupTab = 'expenses';
  update();
  return { update };
}
