// ─────────────────────────────────────────────
// Add Expense (داخل مجموعة) — المبلغ، الوصف، الفئة، من دفع، المشاركون، طريقة التقسيم
// المشاركون يُختارون من أعضاء المجموعة، مع إمكانية إضافة ضيف من خارجها
// ─────────────────────────────────────────────
import { icon, esc, avatar, money, num, toast, errorMessage, setLoading, shake, field, RIYAL } from '../ui.js';
import { CATEGORIES, category, parseAmount, equalShares, round2, normalizeDigits, randomAvatarColor, groupMembers, toE164 } from '../models.js';

export function openAddExpense(ctx, group, existing = null) {
  if (!group) return;
  const editing = !!existing;
  const { state, backend } = ctx;
  const me = state.user;
  const members = groupMembers(group);
  const hasContacts = 'contacts' in navigator && 'select' in (navigator.contacts || {});

  // ── Form state ──
  const form = {
    title: '',
    amountText: '',
    category: null,          // الفئة أو الوصف — أحدهما إلزامي
    split: 'equal',
    note: '',
    payer: me.uid,
    // كل الأعضاء مختارون افتراضياً
    people: members.map(m => ({ id: m.uid, name: m.name, phone: m.phone, avatarColor: m.avatarColor, selected: true, isGuest: false, shareAmount: 0 })),
  };

  // ── وضع التعديل: تعبئة القيم الحالية ──
  if (editing) {
    const catName = category(existing.category).name;
    form.title = existing.title === catName ? '' : existing.title;
    form.amountText = String(existing.totalAmount);
    form.category = existing.category || null;
    form.split = existing.splitMethod === 'custom' ? 'custom' : 'equal';
    form.note = existing.note || '';
    form.payer = existing.paidByUserId;
    const byId = new Map(existing.participants.map(p => [p.id, p]));
    form.people.forEach(p => { const x = byId.get(p.id); p.selected = !!x && x.shareAmount > 0; p.shareAmount = x?.shareAmount || 0; });
    // ضيوف أو أعضاء سابقون موجودون في المصروف
    for (const x of existing.participants) {
      if (form.people.some(p => p.id === x.id)) continue;
      form.people.push({ id: x.id, name: x.name, phone: x.phone || '', avatarColor: x.avatarColor, selected: x.shareAmount > 0,
        isGuest: !!x.isGuest, isFormer: !x.isGuest, shareAmount: x.shareAmount || 0 });
    }
  }

  const selected = () => form.people.filter(p => p.selected);
  const total = () => parseAmount(form.amountText);
  const customTotal = () => round2(selected().reduce((s, p) => s + (p.shareAmount || 0), 0));
  const remaining = () => round2(total() - customTotal());
  const balanced = () => Math.abs(remaining()) < 0.01;
  const payerIncluded = () => selected().some(p => p.id === form.payer);
  const isValid = () => (form.title.trim() || form.category) && total() > 0 && selected().length >= 2 && (form.split === 'equal' || balanced());

  function recalcEqual() {
    // الدافع أولاً حتى يتحمّل فرق التقريب
    const sel = [...selected()].sort((a, b) => (a.id === form.payer ? -1 : b.id === form.payer ? 1 : 0));
    const shares = equalShares(total(), sel.length);
    sel.forEach((p, i) => { p.shareAmount = shares[i] || 0; });
    form.people.filter(p => !p.selected).forEach(p => { p.shareAmount = 0; });
  }

  // ── Overlay ──
  const el = document.createElement('div');
  el.className = 'overlay';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', editing ? 'تعديل المصروف' : 'مصروف جديد');
  el.innerHTML = `
    <div class="overlay-panel">
      <header class="navbar">
        <button class="nav-text" data-act="cancel">إلغاء</button>
        <h2>${editing ? 'تعديل المصروف' : 'مصروف جديد'} <small>${esc(group.emoji || '')} ${esc(group.name)}</small></h2>
        <span class="nav-spacer"></span>
      </header>

      <div class="overlay-scroll">
        <section class="amount-hero anim-up">
          <span class="muted sm">المبلغ الكلي</span>
          <div class="amount-row" dir="ltr">
            <input id="amount" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="المبلغ الكلي">
            <span class="cur riyal">${RIYAL}</span>
          </div>
          <span class="amount-line"></span>
        </section>

        <div class="form-body">
          <section class="anim-up d1">
            <h3 class="sec-head">الفئة <small class="muted">— أو اكتب وصفاً</small></h3>
            <div class="cat-scroll" id="cats"></div>
          </section>

          <section class="card anim-up d2">
            <label class="mini-label" for="title">الوصف <span id="title-hint">(اختياري عند اختيار فئة)</span></label>
            <span class="field-box soft">${icon('tag', 16)}<input id="title" placeholder="مثال: عشاء الاستراحة" maxlength="120" enterkeyhint="done"></span>
          </section>

          <section class="anim-up d3">
            <h3 class="sec-head">من دفع؟</h3>
            <div class="payer-scroll" id="payers"></div>
          </section>

          <section class="anim-up d3">
            <div class="sec-head-row">
              <h3 class="sec-head" id="p-head"></h3>
              <button class="link-btn" data-act="add-guest">${icon('userPlus', 15)} ضيف من خارج المجموعة</button>
            </div>
            <div id="participants"></div>
            <div id="validation"></div>
          </section>

          <section class="anim-up d4">
            <h3 class="sec-head">طريقة التقسيم</h3>
            <div class="split-row">
              <button class="split-chip" data-split="equal">${icon('equal', 16)}<span>بالتساوي</span></button>
              <button class="split-chip" data-split="custom">${icon('sliders', 16)}<span>مخصص</span></button>
            </div>
          </section>

          <section class="card note-card anim-up d5">
            ${icon('note', 16)}
            <textarea id="note" rows="2" placeholder="ملاحظة اختيارية..." maxlength="300"></textarea>
          </section>

          <section class="save-wrap anim-up d6">
            <div class="form-error" id="save-error" hidden></div>
            <button class="btn-primary" id="save"><span>${editing ? 'حفظ التعديلات' : 'حفظ المصروف'}</span><i class="spinner"></i></button>
            <p class="summary" id="summary"></p>
          </section>
        </div>
      </div>

      <div class="sheet-backdrop" id="p-sheet" hidden>
        <div class="sheet">
          <span class="handle"></span>
          <div class="card-title"><h2>إضافة ضيف</h2><p>شخص ليس عضواً في المجموعة — يظهر في هذا المصروف فقط</p></div>
          <form id="p-form" novalidate>
            ${field({ id: 'p-name', label: 'الاسم', ic: 'user', placeholder: 'مثال: خالد العلي' })}
            ${field({ id: 'p-phone', label: 'رقم الجوال (اختياري)', ic: 'phone', type: 'tel', placeholder: '05XXXXXXXX', dir: 'ltr', inputmode: 'tel' })}
            <div class="form-error" id="p-error" hidden></div>
            <button class="btn-primary" type="submit"><span>إضافة</span></button>
            ${hasContacts ? `<button type="button" class="btn-tint" data-act="contacts">${icon('contacts', 18)}<span>اختيار من جهات الاتصال</span></button>` : ''}
          </form>
        </div>
      </div>
    </div>`;
  document.body.append(el);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => el.classList.add('open'));
  const $ = (s) => el.querySelector(s);

  // ── Renderers ──
  function renderCategories() {
    $('#cats').innerHTML = CATEGORIES.map(c => `
      <button class="cat-chip ${form.category === c.id ? 'on' : ''}" data-cat="${c.id}">
        <span class="cat-ic">${icon(c.icon, 19)}</span><span class="cat-name">${c.name}</span>
      </button>`).join('');
    const ti = $('#title');
    ti.placeholder = form.category ? category(form.category).name : 'مثال: عشاء الاستراحة';
  }

  function renderPayers() {
    $('#payers').innerHTML = form.people.filter(p => !p.isGuest).map(p => `
      <button class="payer-chip ${form.payer === p.id ? 'on' : ''}" data-payer="${esc(p.id)}">
        ${avatar(p.name, p.avatarColor, 26)}<span>${esc(p.id === me.uid ? 'أنا' : p.name.split(' ')[0])}</span>
      </button>`).join('');
  }

  function renderSplit() {
    el.querySelectorAll('[data-split]').forEach(b => b.classList.toggle('on', b.dataset.split === form.split));
  }

  function renderParticipants() {
    $('#p-head').textContent = `المشاركون (${num(selected().length)} من ${num(form.people.length)})`;
    const rows = form.people.map(p => {
      const on = p.selected;
      return `
      <div class="p-row form-row ${on ? '' : 'off'}" data-pid="${esc(p.id)}">
        <button class="check ${on ? 'on' : ''}" data-check="${esc(p.id)}" role="checkbox" aria-checked="${on}" aria-label="${esc(p.name)}">${icon('check', 14)}</button>
        ${avatar(p.name, p.avatarColor, 36)}
        <div class="p-info">
          <span class="p-name">${esc(p.name)}${p.id === me.uid ? ' <em class="tag">أنت</em>' : ''}${p.id === form.payer ? ' <em class="tag tag-accent">الدافع</em>' : ''}${p.isGuest ? ' <em class="tag tag-muted">ضيف</em>' : ''}${p.isFormer ? ' <em class="tag tag-muted">عضو سابق</em>' : ''}</span>
          ${p.phone ? `<span class="p-phone" dir="ltr">${esc(p.phone)}</span>` : ''}
        </div>
        ${!on ? '<span class="p-amt muted">—</span>'
          : form.split === 'equal'
            ? `<span class="p-amt" data-share="${esc(p.id)}">${money(p.shareAmount)}</span>`
            : `<input class="share-input" data-share-input="${esc(p.id)}" inputmode="decimal" dir="ltr" placeholder="0" value="${p.shareAmount ? p.shareAmount : ''}" aria-label="حصة ${esc(p.name)}">`}
        ${p.isGuest ? `<button class="rm-btn" data-remove="${esc(p.id)}" aria-label="إزالة ${esc(p.name)}">${icon('xCircle', 19)}</button>` : ''}
      </div>`;
    }).join('<span class="divider"></span>');
    $('#participants').innerHTML = `<div class="card p-card">${rows}</div>`;
  }

  function refreshEqualAmounts() {
    if (form.split !== 'equal') return;
    recalcEqual();
    form.people.forEach(p => { const s = el.querySelector(`[data-share="${CSS.escape(p.id)}"]`); if (s) s.innerHTML = money(p.shareAmount); });
  }

  function renderValidation() {
    const v = $('#validation');
    const msgs = [];
    if (selected().length < 2) msgs.push(`<div class="validate warn">${icon('alert', 16)}<span>اختر مشاركَين على الأقل</span></div>`);
    if (!payerIncluded()) msgs.push(`<div class="validate info">${icon('info', 16)}<span>الدافع ليس ضمن المشاركين — سيُستحق له المبلغ كاملاً</span></div>`);
    if (form.split === 'custom' && total() > 0) {
      msgs.push(balanced()
        ? `<div class="validate ok">${icon('checkCircle', 16)}<span>المبالغ متوازنة ✓</span></div>`
        : `<div class="validate warn">${icon('alert', 16)}<span>${remaining() > 0 ? 'متبقي للتوزيع' : 'تجاوزت المبلغ بـ'}: ${money(Math.abs(remaining()))}</span></div>`);
    }
    v.innerHTML = msgs.join('');
  }

  function renderSave() {
    const valid = isValid();
    const btn = $('#save');
    btn.dataset.disabled = String(!valid);
    if (!btn.classList.contains('loading')) btn.disabled = !valid;
    $('#summary').innerHTML = valid ? `سيتم تقسيم ${money(total())} على ${num(selected().length)} أشخاص` : (!form.title.trim() && !form.category ? 'اختر فئة أو اكتب وصفاً' : '');
  }

  function refreshAll() {
    if (form.split === 'equal') recalcEqual();
    renderPayers(); renderParticipants(); renderValidation(); renderSave();
  }

  // ── Inputs ──
  $('#amount').addEventListener('input', (e) => {
    const clean = normalizeDigits(e.target.value).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/^(\d*\.\d{0,2}).*$/, '$1');
    if (clean !== e.target.value) e.target.value = clean;
    form.amountText = clean;
    $('.amount-hero').classList.toggle('has-value', total() > 0);
    refreshEqualAmounts(); renderValidation(); renderSave();
  });
  $('#amount').addEventListener('focus', () => $('.amount-hero').classList.add('focus'));
  $('#amount').addEventListener('blur', () => $('.amount-hero').classList.remove('focus'));
  $('#title').addEventListener('input', (e) => { form.title = e.target.value; renderSave(); });
  $('#title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#amount').focus(); } });
  $('#note').addEventListener('input', (e) => { form.note = e.target.value; });

  el.addEventListener('input', (e) => {
    const id = e.target.dataset.shareInput;
    if (!id) return;
    const clean = normalizeDigits(e.target.value).replace(/[^\d.]/g, '');
    if (clean !== e.target.value) e.target.value = clean;
    const p = form.people.find(x => x.id === id);
    if (p) p.shareAmount = round2(parseFloat(clean) || 0);
    renderValidation(); renderSave();
  });

  el.addEventListener('click', (e) => {
    if (e.target === $('#p-sheet')) { closeSheet(); return; }
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'cancel') return close();
    if (t.dataset.act === 'add-guest') return openSheet();
    if (t.dataset.act === 'contacts') return pickContact();
    if (t.dataset.cat) { form.category = form.category === t.dataset.cat ? null : t.dataset.cat; renderCategories(); renderSave(); return; }
    if (t.dataset.payer) { form.payer = t.dataset.payer; refreshAll(); return; }
    if (t.dataset.split) { form.split = t.dataset.split; renderSplit(); refreshAll(); return; }
    if (t.dataset.check) {
      const p = form.people.find(x => x.id === t.dataset.check);
      if (p) { p.selected = !p.selected; if (!p.selected) p.shareAmount = 0; }
      refreshAll(); return;
    }
    if (t.dataset.remove) { form.people = form.people.filter(p => p.id !== t.dataset.remove); refreshAll(); return; }
    if (t.id === 'save') save(t);
  });

  // ── Guest sheet ──
  function openSheet() {
    const s = $('#p-sheet'); s.hidden = false;
    requestAnimationFrame(() => s.classList.add('open'));
    setTimeout(() => $('#p-name').focus(), 250);
  }
  function closeSheet() {
    const s = $('#p-sheet'); s.classList.remove('open');
    setTimeout(() => { s.hidden = true; $('#p-form').reset(); $('#p-error').hidden = true; }, 250);
  }
  $('#p-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#p-name').value.trim();
    const raw = $('#p-phone').value.trim();
    const err = (m) => { const x = $('#p-error'); x.innerHTML = `${icon('alert', 15)}<span>${m}</span>`; x.hidden = false; shake(e.target); };
    if (!name) return err('يرجى إدخال الاسم');
    const phone = raw ? toE164('+966', raw) : '';
    if (raw && !phone) return err('رقم الجوال غير صحيح');
    if (phone && form.people.some(p => p.phone === phone)) return err('هذا الرقم موجود بالفعل');
    form.people.push({ id: 'g_' + Math.random().toString(36).slice(2, 10), name, phone, avatarColor: randomAvatarColor(), selected: true, isGuest: true, shareAmount: 0 });
    refreshAll(); closeSheet();
  });
  async function pickContact() {
    try {
      const [c] = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (c) { $('#p-name').value = c.name?.[0] || ''; $('#p-phone').value = c.tel?.[0] || ''; }
    } catch (e) { console.warn(e); }
  }

  // ── Save ──
  async function save(btn) {
    if (!isValid()) return;
    if (form.split === 'equal') recalcEqual();
    const sel = selected();
    let participants = sel.map(p => ({
      id: p.id, name: p.name, phone: p.phone || '', avatarColor: p.avatarColor,
      shareAmount: round2(p.shareAmount), isGuest: !!p.isGuest,
    }));
    // إذا لم يكن الدافع مشاركاً نضيفه بحصة صفر حتى يظهر كدافع
    if (!participants.some(p => p.id === form.payer)) {
      const payer = form.people.find(p => p.id === form.payer);
      participants = [{ id: payer.id, name: payer.name, phone: payer.phone || '', avatarColor: payer.avatarColor, shareAmount: 0, isGuest: false }, ...participants];
    }
    const expense = {
      title: form.title.trim() || category(form.category).name,
      totalAmount: round2(total()),
      currency: 'SAR',
      category: form.category || 'other',
      paidByUserId: form.payer,
      createdBy: editing ? existing.createdBy : me.uid,
      participants,
      participantIds: participants.filter(p => !p.isGuest).map(p => p.id),
      splitMethod: form.split,
      note: form.note.trim() || null,
      createdAt: editing ? existing.createdAt : new Date(),
    };
    setLoading(btn, true);
    try {
      if (editing) await backend.updateExpense(group.id, existing.id, expense);
      else await backend.addExpense(group.id, expense);
      toast(editing ? 'تم حفظ التعديلات' : 'تم حفظ المصروف', 'success');
      close();
    } catch (e) {
      console.warn(e);
      const er = $('#save-error'); er.innerHTML = `${icon('alert', 15)}<span>${esc(errorMessage(e))}</span>`; er.hidden = false;
      setLoading(btn, false);
    }
  }

  function close() {
    el.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { el.remove(); if (!document.querySelector('.overlay')) document.body.classList.remove('no-scroll'); }, 300);
  }
  const onKey = (e) => { if (e.key === 'Escape') { if (!$('#p-sheet').hidden) closeSheet(); else close(); } };
  document.addEventListener('keydown', onKey);

  if (editing) {
    $('#amount').value = form.amountText;
    $('.amount-hero').classList.toggle('has-value', total() > 0);
    $('#title').value = form.title;
    $('#note').value = form.note;
  }
  renderCategories(); renderSplit();
  // في التعديل نحافظ على الحصص المخصصة كما هي
  if (form.split === 'equal') recalcEqual();
  renderPayers(); renderParticipants(); renderValidation(); renderSave();
  if (!editing) setTimeout(() => $('#amount').focus({ preventScroll: true }), 350);
}
