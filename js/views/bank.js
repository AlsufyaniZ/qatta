// ─────────────────────────────────────────────
// Bank preferences — تفضيلات الحساب البنكي (اختياري)
// يظهر لأعضاء مجموعاتك فقط لتسهيل التحويل لك
// ─────────────────────────────────────────────
import { icon, esc, field, setLoading, shake, toast, errorMessage, brandBar } from '../ui.js';
import { SAUDI_BANKS, normalizeIban, isValidIban, formatIban } from '../models.js';

export function mountBank(root, ctx) {
  const signal = ctx.signal;
  const { state, backend } = ctx;
  const p = state.profile || {};

  root.innerHTML = `
    <div class="screen page">
      ${brandBar()}
      <header class="page-head">
        <button class="icon-btn" id="back" aria-label="رجوع">${icon('chevronRight', 22)}</button>
        <h1>تفضيلات الحساب البنكي</h1>
        <span class="icon-btn-spacer"></span>
      </header>

      <p class="hint-box mt-s">${icon('info', 15)}<span>اختياري. تظهر هذه المعلومات لأعضاء مجموعاتك فقط، ليتمكنوا من التحويل لك مباشرة عند تصفية الحسابات.</span></p>

      <section class="card form-card mt-s">
        <form id="bank-form" novalidate>
          <label class="field" for="bank">
            <span class="field-label">اسم البنك</span>
            <span class="field-box">${icon('wallet', 18)}<input id="bank" list="banks" placeholder="اختر أو اكتب اسم البنك" value="${esc(p.bankName || '')}" autocomplete="off"></span>
            <datalist id="banks">${SAUDI_BANKS.map(b => `<option value="${esc(b)}">`).join('')}</datalist>
          </label>
          ${field({ id: 'iban', label: 'رقم الآيبان (IBAN)', ic: 'tag', placeholder: 'SA00 0000 0000 0000 0000 0000', value: p.iban ? formatIban(p.iban) : '', dir: 'ltr', inputmode: 'text' })}
          ${field({ id: 'holder', label: 'اسم صاحب الحساب (اختياري)', ic: 'user', placeholder: p.name || '', value: p.accountHolder || '' })}
          <div class="form-error" id="err" hidden></div>
          <button class="btn-primary" type="submit"><span>حفظ</span><i class="spinner"></i></button>
          ${p.iban ? `<button type="button" class="btn-tint danger-tint" id="clear"><span>حذف معلومات الحساب البنكي</span></button>` : ''}
        </form>
      </section>
    </div>`;

  const $ = (s) => root.querySelector(s);
  $('#back').addEventListener('click', () => ctx.go('settings'), { signal });

  const ibanIn = $('#iban');
  ibanIn.addEventListener('input', () => {
    $('#err').hidden = true;
    const pos = ibanIn.selectionStart, before = ibanIn.value.length;
    ibanIn.value = formatIban(ibanIn.value);
    const d = ibanIn.value.length - before;
    ibanIn.setSelectionRange(pos + d, pos + d);
  }, { signal });

  async function save(data, btn, msg) {
    setLoading(btn, true);
    try {
      const profile = { ...p, ...data };
      await backend.saveProfile(state.user.uid, profile, state.groups.map(g => g.id));
      ctx.setProfile(profile);
      toast(msg, 'success');
      ctx.go('settings');
    } catch (e) {
      console.warn(e);
      const err = $('#err'); err.innerHTML = `${icon('alert', 15)}<span>${esc(errorMessage(e))}</span>`; err.hidden = false;
      setLoading(btn, false);
    }
  }

  $('#bank-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const err = $('#err');
    const bankName = $('#bank').value.trim();
    const iban = normalizeIban(ibanIn.value);
    const fail = (m) => { err.innerHTML = `${icon('alert', 15)}<span>${m}</span>`; err.hidden = false; shake(ev.target); };
    if (iban && !isValidIban(iban)) return fail('رقم الآيبان غير صحيح — تأكد من الأرقام (الآيبان السعودي 24 خانة ويبدأ بـ SA)');
    if (iban && !bankName) return fail('يرجى إدخال اسم البنك');
    save({ bankName, iban, accountHolder: $('#holder').value.trim() }, ev.target.querySelector('.btn-primary'), 'تم حفظ الحساب البنكي');
  }, { signal });

  $('#clear')?.addEventListener('click', (ev) => save({ bankName: '', iban: '', accountHolder: '' }, ev.currentTarget, 'تم حذف معلومات الحساب البنكي'), { signal });
  return {};
}
