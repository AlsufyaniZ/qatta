// ─────────────────────────────────────────────
// Add Expense — مكافئ AddExpenseView.swift + AddParticipantSheet
// ─────────────────────────────────────────────
import { icon, esc, avatar, money, num, toast, errorMessage, setLoading, shake, field } from '../ui.js';
import { CATEGORIES, parseAmount, equalShares, round2, normalizeDigits, randomAvatarColor, COUNTRY_CODES } from '../models.js';

export function openAddExpense(ctx) {
  const { state, backend } = ctx;
  const me = state.user;
  const profile = state.profile || {};

  // ── Form state (AddExpenseViewModel) ──
  const form = {
    title: '',
    amountText: '',
    category: 'other',
    split: 'equal',
    note: '',
    participants: [{
      id: me.uid,
      name: profile.name || me.displayName || 'أنا',
      phone: profile.phone || '',
      email: me.email || '',
      avatarColor: profile.avatarColor || '#4F6AF0',
      shareAmount: 0,
      isPaid: true,
    }],
  };

  const total = () => parseAmount(form.amountText);
  const customTotal = () => round2(form.participants.reduce((s, p) => s + (p.shareAmount || 0), 0));
  const remaining = () => round2(total() - customTotal());
  const balanced = () => Math.abs(remaining()) < 0.01;
  const isValid = () => form.title.trim() && total() > 0 && form.participants.length >= 2 && (form.split === 'equal' || balanced());

  function recalcEqual() {
    const shares = equalShares(total(), form.participants.length);
    form.participants.forEach((p, i) => { p.shareAmount = shares[i] || 0; });
  }

  // ── Overlay ──
  const el = document.createElement('div');
  el.className = 'overlay';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'مصروف جديد');
  el.innerHTML = `
    <div class="overlay-panel">
      <header class="navbar">
        <button class="nav-text" data-act="cancel">إلغاء</button>
        <h2>مصروف جديد</h2>
        <span class="nav-spacer"></span>
      </header>

      <div class="overlay-scroll">
        <!-- Amount hero -->
        <section class="amount-hero anim-up">
          <span class="muted sm">المبلغ الكلي</span>
          <div class="amount-row" dir="ltr">
            <input id="amount" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="المبلغ الكلي">
            <span class="cur">ر.س</span>
          </div>
          <span class="amount-line"></span>
        </section>

        <div class="form-body">
          <!-- Title -->
          <section class="card anim-up d1">
            <label class="mini-label" for="title">وصف المصروف</label>
            <span class="field-box soft">${icon('tag', 16)}<input id="title" placeholder="مثال: عشاء مع الأصدقاء" maxlength="120" enterkeyhint="next"></span>
          </section>

          <!-- Category -->
          <section class="anim-up d2">
            <h3 class="sec-head">الفئة</h3>
            <div class="cat-scroll" id="cats"></div>
          </section>

          <!-- Participants -->
          <section class="anim-up d3">
            <div class="sec-head-row">
              <h3 class="sec-head" id="p-head"></h3>
              <button class="link-btn" data-act="add-p">${icon('plus', 15)} إضافة</button>
            </div>
            <div id="participants"></div>
            <div id="validation"></div>
          </section>

          <!-- Split method -->
          <section class="anim-up d4">
            <h3 class="sec-head">طريقة التقسيم</h3>
            <div class="split-row">
              <button class="split-chip" data-split="equal">${icon('equal', 16)}<span>بالتساوي</span></button>
              <button class="split-chip" data-split="custom">${icon('sliders', 16)}<span>مخصص</span></button>
            </div>
          </section>

          <!-- Note -->
          <section class="card note-card anim-up d5">
            ${icon('note', 16)}
            <textarea id="note" rows="2" placeholder="ملاحظة اختيارية..." maxlength="300"></textarea>
          </section>

          <!-- Save -->
          <section class="save-wrap anim-up d6">
            <div class="form-error" id="save-error" hidden></div>
            <button class="btn-primary" id="save"><span>حفظ المصروف</span><i class="spinner"></i></button>
            <p class="summary" id="summary"></p>
          </section>
        </div>
      </div>

      <!-- Add participant sheet -->
      <div class="sheet-backdrop" id="p-sheet" hidden>
        <div class="sheet">
          <span class="handle"></span>
          <div class="card-title">
            <h2>إضافة مشارك</h2>
            <p>أدخل بيانات المشارك يدوياً${'contacts' in navigator && 'select' in (navigator.contacts || {}) ? ' أو اختر من جهات الاتصال' : ''}</p>
          </div>
          <form id="p-form" novalidate>
            ${field({ id: 'p-name', label: 'الاسم', ic: 'user', placeholder: 'مثال: خالد العلي' })}
            ${field({ id: 'p-phone', label: 'رقم الجوال', ic: 'phone', type: 'tel', placeholder: '05XXXXXXXX', dir: 'ltr', inputmode: 'tel' })}
            ${field({ id: 'p-email', label: 'البريد الإلكتروني (اختياري — ليرى المصروف في حسابه)', ic: 'mail', type: 'email', placeholder: 'name@example.com', dir: 'ltr', inputmode: 'email' })}
            <div class="form-error" id="p-error" hidden></div>
            <button class="btn-primary" type="submit"><span>إضافة المشارك</span></button>
            ${'contacts' in navigator && 'select' in (navigator.contacts || {}) ? `
              <button type="button" class="btn-tint" data-act="contacts">${icon('contacts', 18)}<span>اختيار من جهات الاتصال</span></button>` : ''}
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
        <span class="cat-ic">${icon(c.icon, 19)}</span>
        <span class="cat-name">${c.name}</span>
      </button>`).join('');
  }

  function renderSplit() {
    el.querySelectorAll('[data-split]').forEach(b => b.classList.toggle('on', b.dataset.split === form.split));
  }

  function renderParticipants() {
    $('#p-head').textContent = `المشاركون (${num(form.participants.length)})`;
    if (form.participants.length < 2) {
      // المستخدم الحالي دائماً موجود؛ نعرض صفه + دعوة لإضافة آخرين
    }
    const rows = form.participants.map((p, i) => `
      <div class="p-row form-row" data-pid="${esc(p.id)}">
        ${avatar(p.name, p.avatarColor, 38)}
        <div class="p-info">
          <span class="p-name">${esc(p.name)}${i === 0 ? ' <em class="tag">أنت</em>' : ''}</span>
          ${p.phone || p.email ? `<span class="p-phone" dir="ltr">${esc(p.phone || p.email)}</span>` : ''}
        </div>
        ${form.split === 'equal'
          ? `<span class="p-amt" data-share>${money(p.shareAmount)}</span>`
          : `<input class="share-input" data-share-input="${esc(p.id)}" inputmode="decimal" dir="ltr" placeholder="0" value="${p.shareAmount ? p.shareAmount : ''}" aria-label="حصة ${esc(p.name)}">`}
        ${i > 0 ? `<button class="rm-btn" data-remove="${esc(p.id)}" aria-label="إزالة ${esc(p.name)}">${icon('xCircle', 19)}</button>` : '<span class="rm-spacer"></span>'}
      </div>`).join('<span class="divider"></span>');

    $('#participants').innerHTML = `
      <div class="card p-card">${rows}</div>
      ${form.participants.length < 2 ? `
        <button class="empty-dash" data-act="add-p">
          ${icon('userPlus', 26)}
          <span>أضف مشاركين لتقسيم المصروف</span>
        </button>` : ''}`;
  }

  function refreshEqualAmounts() {
    if (form.split !== 'equal') return;
    recalcEqual();
    el.querySelectorAll('.form-row').forEach((row, i) => {
      const s = row.querySelector('[data-share]');
      if (s) s.textContent = money(form.participants[i].shareAmount);
    });
  }

  function renderValidation() {
    const v = $('#validation');
    if (form.split !== 'custom' || total() <= 0) { v.innerHTML = ''; return; }
    v.innerHTML = balanced()
      ? `<div class="validate ok">${icon('checkCircle', 16)}<span>المبالغ متوازنة ✓</span></div>`
      : `<div class="validate warn">${icon('alert', 16)}<span>${remaining() > 0 ? 'متبقي للتوزيع' : 'تجاوزت المبلغ بـ'}: ${money(Math.abs(remaining()))}</span></div>`;
  }

  function renderSave() {
    const valid = isValid();
    const btn = $('#save');
    btn.dataset.disabled = String(!valid);
    if (!btn.classList.contains('loading')) btn.disabled = !valid;
    $('#summary').textContent = valid
      ? `سيتم تقسيم ${money(total())} على ${num(form.participants.length)} أشخاص`
      : '';
  }

  function refreshAll() {
    renderParticipants(); renderValidation(); renderSave();
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
    const p = form.participants.find(x => x.id === id);
    if (p) p.shareAmount = round2(parseFloat(clean) || 0);
    renderValidation(); renderSave();
  });

  // ── Clicks ──
  el.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (e.target === $('#p-sheet')) { closeSheet(); return; }
    if (!t) return;

    if (t.dataset.act === 'cancel') return close();
    if (t.dataset.act === 'add-p') return openSheet();
    if (t.dataset.act === 'contacts') return pickContact();

    if (t.dataset.cat) { form.category = t.dataset.cat; renderCategories(); return; }

    if (t.dataset.split) {
      form.split = t.dataset.split;
      if (form.split === 'equal') recalcEqual();
      renderSplit(); refreshAll();
      return;
    }

    if (t.dataset.remove) {
      form.participants = form.participants.filter(p => p.id !== t.dataset.remove);
      if (form.split === 'equal') recalcEqual();
      refreshAll();
      return;
    }

    if (t.id === 'save') return save(t);
  });

  // ── Add participant sheet ──
  function openSheet() {
    const s = $('#p-sheet');
    s.hidden = false;
    requestAnimationFrame(() => s.classList.add('open'));
    setTimeout(() => $('#p-name').focus(), 250);
  }
  function closeSheet() {
    const s = $('#p-sheet');
    s.classList.remove('open');
    setTimeout(() => { s.hidden = true; $('#p-form').reset(); $('#p-error').hidden = true; }, 250);
  }

  function normalizePhone(raw) {
    let d = normalizeDigits(raw).replace(/[^\d+]/g, '');
    if (d.startsWith('00')) d = '+' + d.slice(2);
    if (d.startsWith('+')) return d;
    const digits = d.replace(/\D/g, '');
    if (digits.startsWith('05') && digits.length === 10) return '+966' + digits.slice(1);
    if (digits.startsWith('5') && digits.length === 9) return '+966' + digits;
    const known = COUNTRY_CODES.find(c => digits.startsWith(c.code.slice(1)) && digits.length > 10);
    return known ? '+' + digits : digits;
  }

  $('#p-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#p-name').value.trim();
    const rawPhone = $('#p-phone').value.trim();
    const email = $('#p-email').value.trim().toLowerCase();
    const errEl = $('#p-error');
    const err = (m) => { errEl.innerHTML = `${icon('alert', 15)}<span>${m}</span>`; errEl.hidden = false; shake(e.target); };

    if (!name) return err('يرجى إدخال الاسم');
    if (normalizeDigits(rawPhone).replace(/\D/g, '').length < 9) return err('يرجى إدخال رقم جوال صحيح');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return err('البريد الإلكتروني غير صحيح');
    const phone = normalizePhone(rawPhone);
    if (form.participants.some(p => p.phone && p.phone === phone)) return err('هذا الرقم مضاف بالفعل');
    if (email && form.participants.some(p => p.email && p.email === email)) return err('هذا البريد مضاف بالفعل');

    form.participants.push({
      id: 'p_' + Math.random().toString(36).slice(2, 10),
      name, phone, email,
      avatarColor: randomAvatarColor(),
      shareAmount: 0,
      isPaid: false,
    });
    if (form.split === 'equal') recalcEqual();
    refreshAll();
    closeSheet();
  });

  async function pickContact() {
    try {
      const [c] = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: false });
      if (!c) return;
      $('#p-name').value = c.name?.[0] || '';
      $('#p-phone').value = c.tel?.[0] || '';
      $('#p-email').value = c.email?.[0] || '';
    } catch (e) { console.warn(e); }
  }

  // ── Save (buildExpense) ──
  async function save(btn) {
    if (!isValid()) return;
    if (form.split === 'equal') recalcEqual();
    const participants = form.participants.map((p, i) => ({
      id: p.id, name: p.name, phone: p.phone || '', email: (p.email || '').toLowerCase(),
      avatarColor: p.avatarColor, shareAmount: round2(p.shareAmount), isPaid: i === 0, // الدافع مسوّى تلقائياً
    }));
    const expense = {
      title: form.title.trim(),
      totalAmount: round2(total()),
      currency: 'SAR',
      category: form.category,
      paidByUserId: me.uid,
      ownerId: me.uid,
      participants,
      memberEmails: [...new Set(participants.slice(1).map(p => p.email).filter(Boolean))],
      splitMethod: form.split,
      note: form.note.trim() || null,
      createdAt: new Date(),
    };
    setLoading(btn, true);
    try {
      await backend.addExpense(expense);
      toast('تم حفظ المصروف', 'success');
      close();
    } catch (e) {
      console.warn(e);
      const er = $('#save-error');
      er.innerHTML = `${icon('alert', 15)}<span>${esc(errorMessage(e))}</span>`;
      er.hidden = false;
      setLoading(btn, false);
    }
  }

  function close() {
    el.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { el.remove(); document.body.classList.remove('no-scroll'); }, 300);
  }
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#p-sheet').hidden) closeSheet(); else close();
  };
  document.addEventListener('keydown', onKey);

  renderCategories(); renderSplit(); refreshAll();
  setTimeout(() => $('#amount').focus({ preventScroll: true }), 350);
}
