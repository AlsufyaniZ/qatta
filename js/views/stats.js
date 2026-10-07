// ─────────────────────────────────────────────
// Stats — توزيع المصاريف حسب الفئة (Pie/Donut) بالمبلغ والنسبة
// المدى: شهر · ٣ · ٦ · ٩ أشهر · سنة
// ─────────────────────────────────────────────
import { icon, esc, money, num, isDark } from '../ui.js';
import { STATS_PERIODS, CATEGORY_COLORS, categoryBreakdown } from '../models.js';

const pctFmt = new Intl.NumberFormat('ar-SA', { style: 'percent', maximumFractionDigits: 1 });

/** مسار قطعة دائرية (donut) بين زاويتين */
function arcPath(cx, cy, rOut, rIn, a0, a1) {
  const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(rOut, a0), [x1, y1] = p(rOut, a1);
  const [x2, y2] = p(rIn, a1), [x3, y3] = p(rIn, a0);
  return `M${x0},${y0} A${rOut},${rOut} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${rIn},${rIn} 0 ${large} 0 ${x3},${y3} Z`;
}

export function mountStats(root, ctx, code) {
  const { state } = ctx;
  const signal = ctx.signal;
  let rendered = false;
  const group = () => state.groups.find(g => g.id === code);

  function shell(g) {
    root.innerHTML = `
      <div class="screen page stats-page">
        <header class="page-head wide">
          <button class="icon-btn" data-act="back" aria-label="رجوع">${icon('chevronRight', 22)}</button>
          <div class="g-head"><span class="g-emoji sm">${esc(g.emoji || '👥')}</span><h1>الإحصائيات</h1></div>
          <div class="head-actions"><button class="icon-btn" data-act="settings" aria-label="الإعدادات">${icon('settings', 21)}</button></div>
        </header>
        <p class="muted sm center">${esc(g.name)} · توزيع المصاريف حسب الفئة</p>
        <div class="period-bar" id="periods" role="tablist" aria-label="المدى الزمني"></div>
        <section class="card chart-card" id="chart"></section>
        <section class="card legend-card" id="legend"></section>
      </div>`;
    rendered = true;
  }

  function renderPeriods() {
    root.querySelector('#periods').innerHTML = STATS_PERIODS.map(p =>
      `<button role="tab" aria-selected="${state.statsPeriod === p.id}" class="period ${state.statsPeriod === p.id ? 'on' : ''}" data-period="${p.id}">${p.label}</button>`).join('');
  }

  function renderChart() {
    const { total, rows, count } = categoryBreakdown(state.expenses.get(code) || [], state.statsPeriod);
    const colors = CATEGORY_COLORS[isDark() ? 'dark' : 'light'];
    const chart = root.querySelector('#chart');
    const legend = root.querySelector('#legend');
    const pLabel = STATS_PERIODS.find(p => p.id === state.statsPeriod).label;

    if (!rows.length) {
      chart.innerHTML = `<div class="empty"><span class="pulse">${icon('pie', 44)}</span><strong>لا توجد مصاريف في آخر ${pLabel}</strong><span>جرّب مدى زمنياً أطول</span></div>`;
      legend.hidden = true;
      return;
    }
    legend.hidden = false;

    // Donut: فجوة 2px بلون السطح بين القطع
    const S = 240, c = S / 2, rO = 112, rI = 74;
    let a = 0;
    const segs = rows.map((r, i) => {
      const a0 = a, a1 = a + r.pct * Math.PI * 2;
      a = a1;
      const d = rows.length === 1
        ? `M${c},${c - rO} A${rO},${rO} 0 1 1 ${c - 0.01},${c - rO} L${c - 0.01},${c - rI} A${rI},${rI} 0 1 0 ${c},${c - rI} Z`
        : arcPath(c, c, rO, rI, a0, a1);
      return `<path class="seg" data-i="${i}" d="${d}" fill="${colors[r.id]}"><title>${esc(r.name)}: ${pctFmt.format(r.pct)}</title></path>`;
    }).join('');

    chart.innerHTML = `
      <div class="donut-wrap">
        <svg viewBox="0 0 ${S} ${S}" class="donut" role="img" aria-label="توزيع المصاريف حسب الفئة">${segs}</svg>
        <div class="donut-center" id="center">
          <span class="dc-label">الإجمالي</span>
          <strong class="dc-value">${money(total)}</strong>
          <span class="dc-sub">${num(count)} مصروف · آخر ${pLabel}</span>
        </div>
      </div>`;

    legend.innerHTML = `
      <table class="cat-table">
        <thead><tr><th>الفئة</th><th>المبلغ</th><th>النسبة</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr data-i="${i}">
              <td><span class="sw" style="background:${colors[r.id]}"></span>${icon(r.icon, 15)}<span>${esc(r.name)}</span></td>
              <td class="num">${money(r.amount)}</td>
              <td class="num"><span class="pct">${pctFmt.format(r.pct)}</span>
                <span class="bar"><i style="width:${(r.pct * 100).toFixed(1)}%;background:${colors[r.id]}"></i></span></td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    // Hover / tap: إبراز القطعة والصف معاً وعرض قيمتها في المركز
    const center = root.querySelector('#center');
    const centerDefault = center.innerHTML;
    const focus = (i) => {
      root.querySelectorAll('.seg').forEach(s => s.classList.toggle('dim', i !== null && +s.dataset.i !== i));
      root.querySelectorAll('.cat-table tr[data-i]').forEach(tr => tr.classList.toggle('hl', i !== null && +tr.dataset.i === i));
      if (i === null) { center.innerHTML = centerDefault; return; }
      const r = rows[i];
      center.innerHTML = `<span class="dc-label">${esc(r.name)}</span><strong class="dc-value">${money(r.amount)}</strong><span class="dc-sub">${pctFmt.format(r.pct)} من الإجمالي</span>`;
    };
    root.querySelectorAll('.seg, .cat-table tr[data-i]').forEach(el => {
      el.addEventListener('mouseenter', () => focus(+el.dataset.i), { signal });
      el.addEventListener('mouseleave', () => focus(null), { signal });
      el.addEventListener('click', () => focus(+el.dataset.i), { signal });
    });
  }

  function update() {
    const g = group();
    if (!g) {
      if (state.groupsLoaded) ctx.go('');
      else root.innerHTML = '<div class="screen center-msg"><i class="spinner dark"></i></div>';
      return;
    }
    if (!rendered) shell(g);
    renderPeriods(); renderChart();
  }

  root.addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'back') return ctx.go('group/' + code);
    if (t.dataset.act === 'settings') return ctx.go('settings');
    if (t.dataset.period) { state.statsPeriod = t.dataset.period; renderPeriods(); renderChart(); }
  }, { signal });

  update();
  return { update };
}
