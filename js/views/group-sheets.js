// ─────────────────────────────────────────────
// Sheets: إنشاء مجموعة · الانضمام برمز · دعوة الأعضاء
// ─────────────────────────────────────────────
import { icon, esc, openSheet, setLoading, shake, toast, errorMessage, shareText } from '../ui.js';
import { GROUP_EMOJIS, GROUP_TEMPLATES, newGroupCode } from '../models.js';

export function inviteLink(code) {
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  return `${base}?join=${encodeURIComponent(code)}`;
}

// ── إنشاء مجموعة ──
export function openCreateGroup(ctx) {
  let emoji = GROUP_EMOJIS[0];
  const { el, close } = openSheet(`
    <div class="card-title"><h2>مجموعة جديدة</h2><p>أنشئ قطة وادعُ أعضاءها برابط أو رمز</p></div>
    <div class="templates">
      ${GROUP_TEMPLATES.map(t => `<button type="button" class="tpl" data-tpl-name="${esc(t.name)}" data-tpl-emoji="${t.emoji}">${t.emoji} ${esc(t.name)}</button>`).join('')}
    </div>
    <form id="g-form" novalidate>
      <label class="field" for="g-name">
        <span class="field-label">اسم المجموعة</span>
        <span class="field-box"><span class="emoji-preview" id="g-emoji">${emoji}</span><input id="g-name" maxlength="60" placeholder="مثال: قطة الاستراحة" autocomplete="off"></span>
      </label>
      <div>
        <span class="field-label">الرمز</span>
        <div class="emoji-grid">${GROUP_EMOJIS.map(e => `<button type="button" class="emoji-btn ${e === emoji ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
      </div>
      <div class="form-error" id="g-error" hidden></div>
      <button class="btn-primary" type="submit"><span>إنشاء المجموعة</span><i class="spinner"></i></button>
    </form>`, { label: 'مجموعة جديدة' });

  const $ = (s) => el.querySelector(s);
  const setEmoji = (e) => {
    emoji = e; $('#g-emoji').textContent = e;
    el.querySelectorAll('[data-emoji]').forEach(b => b.classList.toggle('on', b.dataset.emoji === e));
  };
  el.querySelectorAll('[data-emoji]').forEach(b => b.addEventListener('click', () => setEmoji(b.dataset.emoji)));
  el.querySelectorAll('[data-tpl-name]').forEach(b => b.addEventListener('click', () => {
    $('#g-name').value = b.dataset.tplName; setEmoji(b.dataset.tplEmoji); $('#g-name').focus();
  }));
  setTimeout(() => $('#g-name').focus(), 280);

  $('#g-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('.btn-primary');
    const name = $('#g-name').value.trim();
    const err = $('#g-error');
    if (!name) { err.innerHTML = `${icon('alert', 15)}<span>يرجى إدخال اسم المجموعة</span>`; err.hidden = false; shake(ev.target); return; }
    setLoading(btn, true);
    const code = newGroupCode();
    try {
      await ctx.backend.createGroup(code, { name, emoji }, ctx.state.user.uid, ctx.myInfo());
      close();
      toast('تم إنشاء المجموعة', 'success');
      ctx.go('group/' + code);
      setTimeout(() => openInvite(ctx, { id: code, name, emoji }, true), 500);
    } catch (e) {
      console.warn(e);
      err.innerHTML = `${icon('alert', 15)}<span>${esc(errorMessage(e))}</span>`; err.hidden = false;
      setLoading(btn, false);
    }
  });
}

// ── الانضمام برمز ──
export function openJoinGroup(ctx, prefill = '') {
  const { el, close } = openSheet(`
    <div class="card-title"><h2>الانضمام لمجموعة</h2><p>أدخل الرمز الذي أرسله لك منشئ المجموعة</p></div>
    <form id="j-form" novalidate>
      <label class="field" for="j-code">
        <span class="field-label">رمز المجموعة</span>
        <span class="field-box">${icon('link', 18)}<input id="j-code" dir="ltr" class="code-input" maxlength="12" placeholder="ABCD2345" value="${esc(prefill)}" autocomplete="off" autocapitalize="characters"></span>
      </label>
      <div class="form-error" id="j-error" hidden></div>
      <button class="btn-primary" type="submit"><span>انضمام</span><i class="spinner"></i></button>
    </form>`, { label: 'الانضمام لمجموعة', onClose: () => ctx.clearPendingJoin() });

  const $ = (s) => el.querySelector(s);
  const input = $('#j-code');
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  setTimeout(() => input.focus(), 280);

  $('#j-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('.btn-primary');
    const code = input.value.trim();
    const err = $('#j-error');
    const fail = (m) => { err.innerHTML = `${icon('alert', 15)}<span>${esc(m)}</span>`; err.hidden = false; shake(ev.target); };
    if (code.length < 6) return fail('الرمز غير صحيح');
    if (ctx.state.groups.some(g => g.id === code)) { close(); ctx.go('group/' + code); return; }
    setLoading(btn, true);
    try {
      await ctx.backend.joinGroup(code, ctx.state.user.uid, ctx.myInfo());
      ctx.clearPendingJoin();
      close();
      toast('تم الانضمام إلى المجموعة 🎉', 'success');
      ctx.go('group/' + code);
    } catch (e) {
      console.warn(e);
      // المجموعة غير الموجودة تُرجع not-found، وأحياناً permission-denied
      fail(e?.code === 'permission-denied' || e?.code === 'not-found' ? 'لم نجد مجموعة بهذا الرمز' : errorMessage(e));
      setLoading(btn, false);
    }
  });
}

// ── دعوة الأعضاء ──
export function openInvite(ctx, group, justCreated = false) {
  const link = inviteLink(group.id);
  const text = `انضم إلى مجموعة "${group.name}" ${group.emoji || ''} على تطبيق قطة لتقسيم المصاريف.\nالرمز: ${group.id}`;
  const { el } = openSheet(`
    <div class="card-title">
      <h2>${justCreated ? 'تم إنشاء المجموعة 🎉' : 'دعوة أعضاء'}</h2>
      <p>شارك الرابط أو الرمز مع الأعضاء لينضموا إلى «${esc(group.name)}»</p>
    </div>
    <div class="invite-code" dir="ltr">${esc(group.id)}</div>
    <div class="invite-link" dir="ltr">${esc(link)}</div>
    <div class="btn-col">
      <a class="btn-whatsapp" href="https://wa.me/?text=${encodeURIComponent(text + '\n' + link)}" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.4 9.4 0 0 1 9.43 9.44c0 5.2-4.24 9.43-9.45 9.43M20.08 3.9A11.27 11.27 0 0 0 12.05.57C5.8.57.7 5.66.7 11.92c0 2 .52 3.95 1.52 5.67L.6 23.43l5.98-1.57a11.3 11.3 0 0 0 5.46 1.39h.01c6.25 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02"/></svg>
        <span>مشاركة عبر واتساب</span>
      </a>
      <button type="button" class="btn-tint" id="share-btn">${icon('share', 18)}<span>مشاركة أو نسخ الرابط</span></button>
    </div>`, { label: 'دعوة أعضاء' });

  el.querySelector('#share-btn').addEventListener('click', async () => {
    const r = await shareText({ title: 'قطة', text, url: link });
    if (r === 'copied') toast('تم نسخ الرابط', 'success');
    else if (r === 'failed') toast('تعذّر النسخ — انسخ الرابط يدوياً', 'error');
  });
}
