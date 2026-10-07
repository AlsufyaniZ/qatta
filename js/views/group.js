// ─────────────────────────────────────────────
// Group dashboard
//   المصاريف الإجمالية (بمدى زمني) · الفلوس اللي لي/علي (تسوية صافية)
//   تبويب المصاريف · تبويب تصفية الحسابات · مشاركة واتساب · إدارة الأعضاء
// ─────────────────────────────────────────────
import { icon, esc, avatar, money, moneyText, num, relTime, toast, errorMessage, openSheet, shareText, WA_LOGO, brandBar, field, phoneField } from '../ui.js';
import {
  T, PERIODS, category, periodTotals, expensesInPeriod, groupMembers, groupNets, simplifyDebts, myBalance,
  isMe, myParticipant, iAmPayer, payerOf, isZero, formatIban, toE164, COUNTRY_CODES,
} from '../models.js';
import { openAddExpense } from './add-expense.js';
import { openInvite, inviteLink, openEditGroup } from './group-sheets.js';

export function mountGroup(root, ctx, code) {
  const { state, backend } = ctx;
  const signal = ctx.signal;
  const me = state.user;
  let animateList = true;
  let rendered = false;
  let leaving = false;

  const group = () => state.groups.find(g => g.id === code);
  // يحدّث اسم/لون/رمز المشاركين الأعضاء من بيانات المجموعة الحالية
  const expenses = () => {
    const info = group()?.memberInfo || {};
    return (state.expenses.get(code) || []).map(e => ({
      ...e,
      participants: e.participants.map(p => info[p.id] ? { ...p, name: info[p.id].name || p.name, avatarColor: info[p.id].avatarColor || p.avatarColor, initials: info[p.id].initials || '' } : p),
    }));
  };
  const settlements = () => state.settlements.get(code) || [];
  const isOwner = () => group()?.createdBy === me.uid;
  const first = (name = '') => name.split(' ')[0];
  const who = (p) => (p.id === me.uid ? 'أنت' : p.name);

  function shell(g) {
    root.innerHTML = `
      <div class="screen home group-page">
        ${brandBar()}
        <header class="page-head wide">
          <button class="icon-btn" data-act="back" aria-label="رجوع">${icon('chevronRight', 22)}</button>
          <div class="g-head">
            <span class="g-emoji sm">${esc(g.emoji || '👥')}</span>
            <h1>${esc(g.name)}</h1>
          </div>
          <div class="head-actions">
            <button class="icon-btn" data-act="share" aria-label="مشاركة وضع المجموعة" title="مشاركة">${icon('share', 20)}</button>
            <button class="icon-btn" data-act="options" aria-label="إعدادات المجموعة" title="إعدادات المجموعة">${icon('settings', 21)}</button>
          </div>
        </header>

        <div class="period-bar" id="periods" role="tablist" aria-label="المدى الزمني"></div>
        <section class="dash" id="dash"></section>
        <section class="members-row" id="members"></section>

        <nav class="tabs" id="tabs" role="tablist"></nav>
        <section id="tab-body"></section>

        <button class="fab" data-act="add">${icon('plus', 18)}<span>قطة جديدة</span></button>
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
        <span class="dash-sub">حصتي ${money(pt.myShare)}</span>
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
          <button class="member ${m.isGuest ? 'guest' : ''}" data-member="${esc(m.uid)}" title="${esc(m.name)}">
            <span class="av-wrap">${avatar(m.name, m.avatarColor, 38, m.initials)}${m.iban ? `<i class="bank-dot" title="لديه حساب بنكي">${icon('wallet', 10)}</i>` : ''}</span>
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
            <span class="strip">${exp.participants.filter(p => p.shareAmount > 0).slice(0, 4).map(p => avatar(p.name, p.avatarColor, 22, p.initials)).join('')}</span>
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
                ${avatar(p.name, p.avatarColor, 32, p.initials)}
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

  // ── Closing tab (تصفية الحسابات) ──
  function canMarkPaid(t) {
    return t.from.id === me.uid || t.to.id === me.uid || isOwner();
  }

  function renderClosingTab(g) {
    const nets = groupNets(expenses(), settlements(), g);
    const transfers = simplifyDebts(nets);
    const hist = [...settlements()].sort((a, b) => b.createdAt - a.createdAt);
    const people = [...nets.values()].filter(v => v.isMember || !isZero(v.net)).sort((a, b) => b.net - a.net);

    $('#tab-body').innerHTML = `
      ${transfers.length ? `
        <h3 class="sec-head sm">لتصفية الحسابات، نفّذوا التحويلات التالية</h3>
        <div class="transfer-list">
          ${transfers.map((t, i) => `
            <div class="transfer ${t.from.id === me.uid || t.to.id === me.uid ? 'mine' : ''}">
              <div class="tr-people">
                <span class="tr-person">${avatar(t.from.name, t.from.avatarColor, 34, t.from.initials)}<b>${esc(t.from.id === me.uid ? 'أنت' : first(t.from.name))}</b></span>
                <span class="tr-arrow">${icon('chevronLeft', 16)}<i>${t.from.id === me.uid ? 'تحوّل' : 'يحوّل'}</i></span>
                <span class="tr-person">${avatar(t.to.name, t.to.avatarColor, 34, t.to.initials)}<b>${esc(t.to.id === me.uid ? 'لك' : first(t.to.name))}</b></span>
              </div>
              <div class="tr-side">
                <strong class="tr-amt">${money(t.amount)}</strong>
                ${canMarkPaid(t) ? `<button class="settle-btn" data-transfer="${i}">تم الدفع</button>` : ''}
              </div>
            </div>`).join('')}
        </div>` : `
        <div class="closed-ok">
          <span class="closed-ic">${icon('checkCircle', 34)}</span>
          <strong>الحسابات مصفّاة ✓</strong>
          <span>${expenses().length ? 'لا توجد مبالغ مستحقة بين الأعضاء' : 'لا توجد مصاريف بعد'}</span>
        </div>`}

      <h3 class="sec-head sm mt-s">صافي كل عضو</h3>
      <div class="card net-list">
        ${people.map(v => `
          <div class="net-row">
            ${avatar(v.name, v.avatarColor, 30, v.initials)}
            <span class="grow"><span>${esc(v.id === me.uid ? 'أنت' : v.name)}${!v.isMember ? ` <em class="tag tag-muted">${v.isGuest ? 'ضيف' : 'غادر'}</em>` : ''}</span></span>
            <span class="net-amt ${isZero(v.net) ? '' : v.net > 0 ? 'pos' : 'neg'}">${isZero(v.net) ? 'مصفّى' : (v.net > 0 ? 'له ' : 'عليه ') + money(Math.abs(v.net))}</span>
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
    $('.g-head h1').textContent = g.name;
    $('.g-head .g-emoji').textContent = g.emoji || '👥';
    renderPeriods(); renderDash(); renderMembers(g); renderTab(g);
  }

  // ── تقرير المشاركة (واتساب / نسخ / مشاركة) ──
  const shareOpts = { emoji: true, bold: true, link: true, members: true, period: true };
  function buildReport(o) {
    const g = group();
    const pt = periodTotals(expenses(), me, state.period);
    const pLabel = PERIODS.find(p => p.id === state.period);
    const nets = groupNets(expenses(), settlements(), g);
    const transfers = simplifyDebts(nets);
    const e = (x) => (o.emoji ? x + ' ' : '');
    const b = (x) => (o.bold ? `*${x}*` : x);
    const lines = [b(`${o.emoji && g.emoji ? g.emoji + ' ' : ''}${g.name}`)];
    if (o.period) lines.push(`${e('🧾')}إجمالي المصاريف (${pLabel.months ? 'آخر ' + pLabel.label : 'كل الفترات'}): ${b(moneyText(pt.total))}`);
    lines.push('');
    if (transfers.length) {
      lines.push(b(`${e('💸')}تصفية الحسابات:`));
      transfers.forEach(t => lines.push(`• ${t.from.name} يحوّل إلى ${t.to.name}: ${b(moneyText(t.amount))}`));
    } else {
      lines.push(`${e('✅')}${b('الحسابات مصفّاة')} — لا توجد مبالغ مستحقة`);
    }
    if (o.members) {
      lines.push('', b(`${e('👥')}صافي كل عضو:`));
      [...nets.values()].filter(v => v.isMember || !isZero(v.net)).sort((x, y) => y.net - x.net)
        .forEach(v => lines.push(`• ${v.name}: ${isZero(v.net) ? 'مصفّى' : (v.net > 0 ? 'له ' : 'عليه ') + moneyText(Math.abs(v.net))}`));
    }
    if (o.link) lines.push('', `${e('🔗')}الانضمام للمجموعة: ${inviteLink(g.id)}`);
    return lines.join('\n');
  }

  /** نافذة المشاركة: معاينة الرسالة + خيارات + واتساب / نسخ / مشاركة */
  function openShare() {
    const opt = (k, label) => `<label class="opt-row"><span>${label}</span><input type="checkbox" data-opt-k="${k}" ${shareOpts[k] ? 'checked' : ''}><i class="sw-ui"></i></label>`;
    const { el } = openSheet(`
      <div class="card-title"><h2>مشاركة وضع المجموعة</h2><p>راجع الرسالة واختر طريقة المشاركة</p></div>
      <div class="msg-preview" id="msg" dir="rtl"></div>
      <div class="card opt-list">
        ${opt('emoji', 'الإيموجي')}
        ${opt('bold', 'خط عريض (تنسيق واتساب)')}
        ${opt('period', 'إجمالي المصاريف للفترة المحددة')}
        ${opt('members', 'صافي كل عضو')}
        ${opt('link', 'رابط الانضمام للمجموعة')}
      </div>
      <div class="share-actions">
        <button class="btn-whatsapp" data-share="wa">${WA_LOGO}<span>واتساب</span></button>
        <button class="btn-tint" data-share="copy">${icon('copy', 18)}<span>نسخ النص</span></button>
        ${navigator.share ? `<button class="btn-tint" data-share="native">${icon('share', 18)}<span>مشاركة</span></button>` : ''}
      </div>`, { label: 'مشاركة' });
    const render = () => { el.querySelector('#msg').textContent = buildReport(shareOpts); };
    el.querySelectorAll('[data-opt-k]').forEach(c => c.addEventListener('change', () => { shareOpts[c.dataset.optK] = c.checked; render(); }));
    el.querySelectorAll('[data-share]').forEach(btn => btn.addEventListener('click', async () => {
      const text = buildReport(shareOpts);
      if (btn.dataset.share === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      else if (btn.dataset.share === 'copy') {
        try { await navigator.clipboard.writeText(text); toast('تم نسخ النص', 'success'); }
        catch { toast('تعذّر النسخ — حدّد النص وانسخه يدوياً', 'error'); }
      } else await shareText({ title: group().name, text });
    }));
    render();
  }

  // ── Sheets ──
  function openOptions() {
    const g = group();
    if (!g) return;
    const { el, close } = openSheet(`
      <div class="card-title"><h2>إعدادات المجموعة</h2><p>${esc(g.emoji || '')} ${esc(g.name)} · الرمز <b dir="ltr">${esc(g.id)}</b></p></div>
      <div class="action-list">
        ${isOwner() ? `<button data-opt="edit">${icon('edit', 19)}<span>تعديل اسم المجموعة ورمزها</span></button>` : ''}
        <button data-opt="invite">${icon('userPlus', 19)}<span>دعوة أعضاء</span></button>
        <button data-opt="members">${icon('users', 19)}<span>الأعضاء (${num(g.members.length)})</span></button>
        <button data-opt="stats">${icon('pie', 19)}<span>الإحصائيات</span></button>
        <button data-opt="share">${icon('share', 19)}<span>مشاركة وضع المجموعة</span></button>
        ${isOwner()
          ? `<button data-opt="delete" class="danger">${icon('trash', 19)}<span>حذف المجموعة</span></button>`
          : `<button data-opt="leave" class="danger">${icon('logout', 19)}<span>الخروج من المجموعة</span></button>`}
      </div>`, { label: 'خيارات المجموعة' });
    const go = (fn) => () => { close(); setTimeout(fn, 280); };
    el.querySelector('[data-opt="invite"]').addEventListener('click', go(() => openInvite(ctx, g)));
    el.querySelector('[data-opt="members"]').addEventListener('click', go(openMembers));
    el.querySelector('[data-opt="stats"]').addEventListener('click', () => { close(); ctx.go('stats/' + code); });
    el.querySelector('[data-opt="share"]').addEventListener('click', go(openShare));
    el.querySelector('[data-opt="edit"]')?.addEventListener('click', go(() => openEditGroup(ctx, group())));
    el.querySelector('[data-opt="delete"]')?.addEventListener('click', go(confirmDeleteGroup));
    el.querySelector('[data-opt="leave"]')?.addEventListener('click', go(confirmLeave));
  }

  // ── قائمة الأعضاء ──
  function openMembers() {
    const g = group();
    const members = groupMembers(g);
    const nets = groupNets(expenses(), settlements(), g);
    const { el, close } = openSheet(`
      <div class="card-title"><h2>الأعضاء</h2><p>اضغط على أي عضو لعرض تفاصيله ومعلومات الدفع</p></div>
      <div class="card net-list">
        ${members.map(m => {
          const n = nets.get(m.uid)?.net || 0;
          return `
          <button class="net-row as-btn" data-card="${esc(m.uid)}">
            ${avatar(m.name, m.avatarColor, 34, m.initials)}
            <span class="grow"><span>${esc(m.name)}${m.uid === me.uid ? ' <em class="tag">أنت</em>' : ''}${m.uid === g.createdBy ? ' <em class="tag tag-accent">المنشئ</em>' : ''}${m.isGuest ? ' <em class="tag tag-muted">ضيف</em>' : ''}</span>
              <small class="net-amt ${isZero(n) ? '' : n > 0 ? 'pos' : 'neg'}">${isZero(n) ? 'مصفّى' : (n > 0 ? 'له ' : 'عليه ') + money(Math.abs(n))}</small></span>
            ${m.iban ? `<span class="bank-badge" title="لديه حساب بنكي">${icon('wallet', 14)}<span>آيبان</span></span>` : ''}
            <span class="chev-l">${icon('chevronLeft', 16)}</span>
          </button>`;
        }).join('')}
      </div>
      <button class="btn-tint" data-invite>${icon('userPlus', 18)}<span>دعوة أعضاء</span></button>`, { label: 'الأعضاء' });
    el.querySelector('[data-invite]').addEventListener('click', () => { close(); setTimeout(() => openInvite(ctx, g), 280); });
    el.querySelectorAll('[data-card]').forEach(b => b.addEventListener('click', () => { close(); setTimeout(() => openMemberCard(b.dataset.card), 280); }));
  }

  // ── بطاقة العضو: التفاصيل + الحساب البنكي + التذكير + إدارة الضيف ──
  function openMemberCard(uid) {
    const g = group();
    const m = groupMembers(g).find(x => x.uid === uid);
    if (!m) return;
    const nets = groupNets(expenses(), settlements(), g);
    const n = nets.get(uid)?.net || 0;
    const mine = uid === me.uid;
    const involved = simplifyDebts(nets).filter(t => t.from.id === uid || t.to.id === uid);
    const { el, close } = openSheet(`
      <div class="member-card">
        ${avatar(m.name, m.avatarColor, 72, m.initials)}
        <h2>${esc(m.name)}</h2>
        <div class="mc-tags">${mine ? '<em class="tag">أنت</em>' : ''}${uid === g.createdBy ? '<em class="tag tag-accent">المنشئ</em>' : ''}${m.isGuest ? '<em class="tag tag-muted">ضيف — لم يسجّل بعد</em>' : ''}</div>
        ${m.phone ? `<span class="mc-phone" dir="ltr">${esc(m.phone)}</span>` : ''}
        <span class="net-amt big ${isZero(n) ? '' : n > 0 ? 'pos' : 'neg'}">${isZero(n) ? 'حساباته مصفّاة ✓' : (n > 0 ? 'له ' : 'عليه ') + money(Math.abs(n))}</span>
      </div>

      ${m.iban ? `
        <div class="bank-box">
          <div class="bank-head">${icon('wallet', 16)}<b>${esc(m.bankName || 'الحساب البنكي')}</b>${m.accountHolder ? `<small>${esc(m.accountHolder)}</small>` : ''}</div>
          <div class="iban-row"><span dir="ltr">${esc(formatIban(m.iban))}</span><button class="copy-btn" data-copy="${esc(m.iban)}">${icon('copy', 15)}<span>نسخ</span></button></div>
        </div>` : (mine ? `<button class="btn-tint" data-go-bank>${icon('wallet', 18)}<span>أضف حسابك البنكي لاستقبال التحويلات</span></button>` : '')}

      <div class="action-list">
        ${!mine && involved.length ? `<button data-mc="remind">${icon('share', 19)}<span>تذكير ${esc(first(m.name))} بتصفية الحسابات</span></button>` : ''}
        ${m.isGuest ? `<button data-mc="phone">${icon('phone', 19)}<span>${m.phone ? 'تعديل رقم الجوال' : 'إضافة رقم جوال'}</span></button>` : ''}
        ${m.isGuest ? `<button data-mc="merge">${icon('users', 19)}<span>هذا أنا — ادمج الضيف مع حسابي</span></button>` : ''}
        ${isOwner() && !mine ? `<button data-mc="remove" class="danger">${icon('trash', 19)}<span>${m.isGuest ? 'حذف الضيف من المجموعة' : 'إزالة من المجموعة'}</span></button>` : ''}
      </div>`, { label: m.name });
    el.querySelector('[data-copy]')?.addEventListener('click', async (ev) => {
      try { await navigator.clipboard.writeText(ev.currentTarget.dataset.copy); toast('تم نسخ رقم الآيبان', 'success'); }
      catch { toast('تعذّر النسخ', 'error'); }
    });
    el.querySelector('[data-go-bank]')?.addEventListener('click', () => { close(); ctx.go('bank'); });
    const after = (fn) => () => { close(); setTimeout(fn, 280); };
    el.querySelector('[data-mc="remind"]')?.addEventListener('click', after(() => openReminder(uid)));
    el.querySelector('[data-mc="phone"]')?.addEventListener('click', after(() => openGuestPhone(m)));
    el.querySelector('[data-mc="merge"]')?.addEventListener('click', after(() => confirmMerge(m)));
    el.querySelector('[data-mc="remove"]')?.addEventListener('click', after(() => (m.isGuest ? confirmRemoveGuest(m) : confirmRemove(m))));
  }

  // ── رسالة تذكير مخصصة لشخص واحد ──
  const remindOpts = { emoji: true, bold: true, iban: true, link: true };
  function buildReminder(uid, o) {
    const g = group();
    const nets = groupNets(expenses(), settlements(), g);
    const person = nets.get(uid);
    const ts = simplifyDebts(nets).filter(t => t.from.id === uid || t.to.id === uid);
    const info = (id) => g.memberInfo?.[id] || {};
    const e = (x) => (o.emoji ? x + ' ' : '');
    const b = (x) => (o.bold ? `*${x}*` : x);
    const L = [`${e('👋')}مرحباً ${first(person.name)}`, `تذكير بتصفية حسابات ${b(`${o.emoji && g.emoji ? g.emoji + ' ' : ''}${g.name}`)}:`, ''];
    for (const t of ts) {
      if (t.from.id === uid) {
        L.push(`• عليك تحويل ${b(moneyText(t.amount))} إلى ${t.to.name}`);
        const bi = info(t.to.id);
        if (o.iban && bi.iban) L.push(`  ${e('🏦')}${bi.bankName ? bi.bankName + ' — ' : ''}${formatIban(bi.iban)}${bi.accountHolder ? ` (${bi.accountHolder})` : ''}`);
      } else {
        L.push(`• ${t.from.name} سيحوّل لك ${b(moneyText(t.amount))}`);
      }
    }
    if (o.link) L.push('', `${e('🔗')}تفاصيل المجموعة: ${inviteLink(g.id)}`);
    L.push('', `شكراً${o.emoji ? ' 🙏' : ''}`);
    return L.join('\n');
  }

  function openReminder(uid) {
    const g = group();
    const m = groupMembers(g).find(x => x.uid === uid) || {};
    const opt = (k, label) => `<label class="opt-row"><span>${label}</span><input type="checkbox" data-opt-k="${k}" ${remindOpts[k] ? 'checked' : ''}><i class="sw-ui"></i></label>`;
    const waNum = (m.phone || '').replace(/\D/g, '');
    const { el } = openSheet(`
      <div class="card-title"><h2>تذكير ${esc(first(m.name || ''))}</h2><p>رسالة مخصصة له بالمبالغ المطلوبة${waNum ? ' — تُفتح محادثته في واتساب مباشرة' : ''}</p></div>
      <div class="msg-preview" id="msg" dir="rtl"></div>
      <div class="card opt-list">
        ${opt('emoji', 'الإيموجي')}
        ${opt('bold', 'خط عريض (تنسيق واتساب)')}
        ${opt('iban', 'رقم الآيبان للدائن')}
        ${opt('link', 'رابط المجموعة')}
      </div>
      <div class="share-actions">
        <button class="btn-whatsapp" data-share="wa">${WA_LOGO}<span>واتساب</span></button>
        <button class="btn-tint" data-share="copy">${icon('copy', 18)}<span>نسخ النص</span></button>
        ${navigator.share ? `<button class="btn-tint" data-share="native">${icon('share', 18)}<span>مشاركة</span></button>` : ''}
      </div>`, { label: 'تذكير' });
    const render = () => { el.querySelector('#msg').textContent = buildReminder(uid, remindOpts); };
    el.querySelectorAll('[data-opt-k]').forEach(c => c.addEventListener('change', () => { remindOpts[c.dataset.optK] = c.checked; render(); }));
    el.querySelectorAll('[data-share]').forEach(btn => btn.addEventListener('click', async () => {
      const text = buildReminder(uid, remindOpts);
      if (btn.dataset.share === 'wa') window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      else if (btn.dataset.share === 'copy') {
        try { await navigator.clipboard.writeText(text); toast('تم نسخ النص', 'success'); }
        catch { toast('تعذّر النسخ', 'error'); }
      } else await shareText({ title: 'تذكير', text });
    }));
    render();
  }

  // ── الضيوف: رقم الجوال، الدمج، الحذف ──
  function openGuestPhone(m) {
    let cc = '+966', local = '';
    if (m.phone) { const c = COUNTRY_CODES.find(x => m.phone.startsWith(x.code)); if (c) { cc = c.code; local = m.phone.slice(c.code.length); } }
    const { el, close } = openSheet(`
      <div class="card-title"><h2>رقم جوال ${esc(first(m.name))}</h2><p>عندما يسجّل بهذا الرقم تنتقل مصاريفه ومدفوعاته إلى حسابه تلقائياً</p></div>
      <form id="gp-form" novalidate>
        ${phoneField({ id: 'gp', cc, value: local, countries: COUNTRY_CODES })}
        <div class="form-error" id="gp-err" hidden></div>
        <button class="btn-primary" type="submit"><span>حفظ</span><i class="spinner"></i></button>
      </form>`, { label: 'رقم الجوال' });
    el.querySelector('#gp-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const phone = toE164(el.querySelector('#gp-cc').value, el.querySelector('#gp').value);
      const err = el.querySelector('#gp-err');
      if (!phone) { err.innerHTML = `${icon('alert', 15)}<span>رقم الجوال غير صحيح</span>`; err.hidden = false; return; }
      const btn = ev.target.querySelector('.btn-primary'); btn.classList.add('loading'); btn.disabled = true;
      try {
        const { uid, isGuest, ...rest } = m;
        await backend.updateGuest(code, m.uid, { ...rest, phone }, m.phone || '');
        close(); toast('تم حفظ رقم الجوال', 'success');
      } catch (e) { console.warn(e); toast(errorMessage(e), 'error'); btn.classList.remove('loading'); btn.disabled = false; }
    });
  }

  function confirmMerge(m) {
    confirmSheet({
      title: `دمج «${esc(m.name)}» مع حسابك؟`,
      body: `ستنتقل كل مصاريف ومدفوعات وتسويات هذا الضيف إلى حسابك، ثم يُحذف الضيف من المجموعة. استخدم هذا الخيار فقط إذا كان هذا الضيف هو أنت.`,
      cta: 'نعم، ادمج مع حسابي',
      danger: false,
      onConfirm: async () => {
        await backend.claimGuest(code, m.uid, me.uid, ctx.myInfo(), m);
        toast('تم الدمج — انتقلت المصاريف إلى حسابك', 'success');
      },
    });
  }

  function confirmRemoveGuest(m) {
    confirmSheet({
      title: `حذف الضيف ${esc(m.name)}؟`,
      body: 'يُحذف من قائمة الأعضاء فقط، وتبقى مصاريفه وديونه في المجموعة كما هي.',
      cta: 'حذف الضيف',
      onConfirm: async () => { await backend.removeGuest(code, m.uid, m.phone || ''); toast('تم حذف الضيف', 'success'); },
    });
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
      body: `${isZero(b.net) ? 'حساباتك مصفّاة في هذه المجموعة.' : `لديك رصيد غير مسوّى: ${b.net > 0 ? 'لك' : 'عليك'} ${money(Math.abs(b.net))}.`} تبقى مصاريفك وديونك في المجموعة ولا تُحذف، ويمكنك العودة لاحقاً بالرمز.`,
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
      body: 'سيُعاد حساب الأرصدة وتصفية الحسابات تلقائياً. لا يمكن التراجع عن هذا الإجراء.',
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
        <p>${left ? `متبقي ${num(left)} ${left === 1 ? 'تحويل' : 'تحويلات'} لتصفية الحسابات بالكامل` : 'تمت تصفية الحسابات بالكامل 🎉 لا توجد مبالغ مستحقة في المجموعة'}</p>
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
    if (act === 'options') return openOptions();
    if (act === 'invite') return openInvite(ctx, group());
    if (act === 'add') return openAddExpense(ctx, group());
    if (act === 'stats') return ctx.go('stats/' + code);
    if (act === 'share') return openShare();

    if (t.dataset.member) return openMemberCard(t.dataset.member);
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
