/* =========================================================
   views.js — giao diện từng màn hình
   Mỗi hàm nhận trạng thái (S) và ngày hôm nay (T), trả về HTML.
   Nút bấm khai báo hành động bằng data-a / data-v,
   phần xử lý nằm trong app.js.
   ========================================================= */

import {
  WEEK_HEAD, pad, iso, dayLabel, dayMonth, monthName, daysInMonth, periodRange, monthRange, viewBounds,
  esc, vnd, short
} from './util.js';
import { store, deriveTargets, OUT_CATS, IN_CATS } from './store.js';

/* =========================================================
   1. Thành phần dùng chung
   ========================================================= */

/* ---------- Icon (SVG nội tuyến, chạy được khi không có mạng) ---------- */
const svg = (d, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  plus: svg('<path d="M12 5v14M5 12h14"/>', 24),
  back: svg('<path d="M20 6H9l-6 6 6 6h11a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z"/><path d="M12 10l4 4M16 10l-4 4"/>'),
  check: svg('<path d="M5 12l5 5L20 7"/>', 15),
  left: svg('<path d="M15 6l-6 6 6 6"/>'),
  right: svg('<path d="M9 6l6 6-6 6"/>')
};

/* ---------- Mức so với target: dưới 80% / 80–100% / vượt ---------- */
const level = (r) => (r > 1 ? 'over' : r >= 0.8 ? 'warn' : 'ok');
const COLOR = { ok: 'var(--text)', warn: 'var(--warn)', over: 'var(--danger)' };
const soft = (s) => (s === 'ok' ? 'var(--text-2)' : COLOR[s]);

const bar = (r, s, color) =>
  `<div class="bar"><i style="width:${Math.min(100, Math.round(r * 100))}%;background:${color || COLOR[s]}"></i></div>`;

const remain = (left, s) =>
  `<span style="color:${soft(s)}">${left >= 0 ? `${vnd(left)} left` : `${vnd(-left)} over`}</span>`;

const segmented = (items, current, action) =>
  `<div class="seg">${items.map(([v, l]) =>
    `<button data-a="${action}" data-v="${v}" class="${current === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;

const secHead = (title, right = '') =>
  `<div class="row sec-head"><span class="h2">${title}</span>${right}</div>`;

const empty = (text) => `<div class="empty">${text}</div>`;

/* ---------- Một dòng giao dịch (chạm để hiện nút Xoá) ---------- */
function txRow(t, S) {
  const isIn = t.type === 'in';
  return `<div class="tx" data-a="open" data-v="${t.id}">
    <div class="tx-main"><div>${esc(t.cat)}</div>${t.note ? `<div class="lbl">${esc(t.note)}</div>` : ''}</div>
    <div class="tx-side">
      <div style="color:${isIn ? 'var(--success)' : 'var(--text)'}">${isIn ? '+' : '−'}${vnd(t.amt)}</div>
      ${S.open === t.id ? `<button class="btn-sm danger" data-a="del" data-v="${t.id}">Delete</button>` : ''}
    </div>
  </div>`;
}

/* ---------- Chuyển tháng (dùng ở Sổ, Lịch, Biểu đồ) ---------- */
function monthNav(S, T, right = '') {
  const [first, last] = viewBounds(T);
  const viewing = new Date(S.vy, S.vm, 1).getTime();
  const atFirst = viewing <= first.getTime();
  const atLast = viewing >= last.getTime();
  return `<div class="row sec-head">
    <div class="mnav">
      <button class="icon-btn" data-a="mon" data-v="-1" aria-label="Previous month" ${atFirst ? 'disabled' : ''}>${ICON.left}</button>
      <span class="h2">${monthName(S.vy, S.vm)}</span>
      <button class="icon-btn" data-a="mon" data-v="1" aria-label="Next month" ${atLast ? 'disabled' : ''}>${ICON.right}</button>
    </div>${right}
  </div>`;
}

/* =========================================================
   2. Khung app: đầu trang, thông báo, thanh tab
   ========================================================= */

export function header(T) {
  return `<header class="top">
    <div><div class="lbl">${pad(T.getDate())}/${pad(T.getMonth() + 1)}/${T.getFullYear()}</div><h1>Expense tracker</h1></div>
    <div class="top-actions">
      <button class="btn-sm" data-a="tab" data-v="backup">Backup</button>
      <button class="btn-sm" data-a="tab" data-v="target">Target</button>
    </div>
  </header>`;
}

export function toast(S) {
  if (!S.msg) return '';
  return `<div class="toast ${S.msgType === 'err' ? 'err' : ''}" role="status">${esc(S.msg)}</div>`;
}

export function tabbar(S) {
  const tabs = [['home', 'Overview'], ['book', 'Log'], ['add', ''], ['cal', 'Calendar'], ['chart', 'Chart']];
  return `<nav class="tabbar"><div class="tabbar-in">${tabs.map(([v, l]) => v === 'add'
    ? `<button class="tab-add" data-a="tab" data-v="add" aria-label="Add entry">${ICON.plus}</button>`
    : `<button class="tab ${S.tab === v ? 'on' : ''}" data-a="tab" data-v="${v}">${l}</button>`).join('')}</div></nav>`;
}

/* =========================================================
   3. Tổng quan
   ========================================================= */

export function home(S, T) {
  const tg = store.targets;
  const [a, b] = periodRange(S.period, T);
  const spent = store.sum(a, b);
  const target = tg[S.period];
  const r = target ? spent / target : 0;
  const s = level(r);
  const label = {
    day: 'Today',
    week: `Week ${dayMonth(a)} – ${dayMonth(b)}`,
    month: monthName(T.getFullYear(), T.getMonth())
  }[S.period];

  let h = segmented([['day', 'Day'], ['week', 'Week'], ['month', 'Month']], S.period, 'per');

  /* ----- Số tổng so với target ----- */
  h += `<div class="card">
    <div class="lbl">${label} · spent</div>
    <div class="big" style="color:${COLOR[s]}">${vnd(spent)}</div>
    <div class="row lbl">${remain(target - spent, s)}<span>Target ${vnd(target)}</span></div>
    ${bar(r, s)}
  </div>`;

  /* ----- Thu và chi trong tháng ----- */
  const [ma, mb] = periodRange('month', T);
  const mIn = store.sum(ma, mb, 'in');
  const mOut = store.sum(ma, mb, 'out');
  h += `<div class="card">
    <div class="lbl" style="margin-bottom:6px">${monthName(T.getFullYear(), T.getMonth())} · income and spending</div>
    <div class="row"><span>Income</span><span style="color:var(--success)">+${vnd(mIn)}</span></div>
    <div class="row"><span>Spending</span><span>−${vnd(mOut)}</span></div>
    <div class="row total"><span>Balance</span><span>${vnd(mIn - mOut)}</span></div>
  </div>`;

  /* ----- Theo danh mục (target tháng, chia ra cho ngày/tuần) ----- */
  const dim = daysInMonth(T.getFullYear(), T.getMonth());
  const f = S.period === 'month' ? 1 : (S.period === 'week' ? 7 : 1) / dim;
  h += `<div class="card"><div class="row lbl"><span>By category</span><span>${S.period === 'month' ? 'monthly target' : 'share of monthly target'}</span></div>`;
  for (const c of OUT_CATS) {
    const v = store.sum(a, b, 'out', c);
    const t = Math.round(store.catTargets[c] * f);
    const rr = t ? v / t : (v ? 2 : 0);
    const ss = level(rr);
    h += `<div class="cat-line"><div class="row small"><span>${c}</span><span style="color:${soft(ss)}">${vnd(v)} / ${t ? short(t) : '0'}</span></div>${bar(rr, ss)}</div>`;
  }
  h += '</div>';

  /* ----- Các khoản hôm nay ----- */
  const td = iso(T);
  const list = store.between(td, td);
  h += `<div class="card"><div class="lbl">Today</div>${list.length ? list.map((t) => txRow(t, S)).join('') : empty('No entries today')}</div>`;
  return h;
}

/* =========================================================
   4. Nhập khoản mới
   ========================================================= */

export const amountText = (S) =>
  (S.amt ? `${Number(S.amt).toLocaleString('vi-VN')} ₫` : '<span class="muted">0 ₫</span>');

export function add(S, T) {
  const cats = S.type === 'out' ? OUT_CATS : IN_CATS;
  if (!cats.includes(S.cat)) S.cat = cats[0];

  let h = segmented([['out', 'Expense'], ['in', 'Income']], S.type, 'type');

  /* ----- Số tiền + danh mục đang chọn ----- */
  h += `<div class="amount">
    <div class="lbl">Amount</div>
    <div class="big xl" id="amt">${amountText(S)}</div>
    <span class="pick">${esc(S.cat)}</span>
    <div class="err" id="err">${esc(S.err)}</div>
  </div>`;

  /* ----- Chọn danh mục ----- */
  h += `<div class="lbl" style="margin-bottom:6px">Category</div><div class="chips">${cats.map((c) => {
    const on = S.cat === c;
    return `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-a="cat" data-v="${esc(c)}">${on ? ICON.check : ''}${c}</button>`;
  }).join('')}</div>`;

  /* ----- Ghi chú + ngày ----- */
  h += `<div class="inputs">
    <input id="note" placeholder="Note" value="${esc(S.note)}" maxlength="200" autocomplete="off">
    <input id="date" type="date" value="${S.date}" max="${iso(T)}">
  </div>`;

  /* ----- Bàn phím số ----- */
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];
  h += `<div class="keypad">${keys.map((k) =>
    `<button data-a="key" data-v="${k}" ${k === 'del' ? 'aria-label="Delete digit"' : ''}>${k === 'del' ? ICON.back : k}</button>`).join('')}</div>`;

  return `${h}<button class="btn-primary" data-a="save">Save</button>`;
}

/* =========================================================
   5. Sổ — danh sách theo ngày
   ========================================================= */

export function book(S, T) {
  const [a, b] = monthRange(S.vy, S.vm);
  const list = store.between(a, b);
  const days = [...new Set(list.map((t) => t.date))];
  const dayTg = store.targets.day;

  let h = monthNav(S, T, `<span class="lbl">${list.length} ${list.length === 1 ? 'entry' : 'entries'}</span>`);
  if (!days.length) return h + empty('No entries this month');

  for (const d of days.slice(0, S.lim)) {
    const items = list.filter((t) => t.date === d);
    const out = items.filter((t) => t.type === 'out').reduce((x, t) => x + t.amt, 0);
    const s = level(dayTg ? out / dayTg : 0);
    h += `<div class="card">
      <div class="row"><span class="strong">${d === iso(T) ? 'Today' : dayLabel(d)}</span><span class="lbl" style="color:${soft(s)}">spent ${vnd(out)}</span></div>
      ${items.map((t) => txRow(t, S)).join('')}
    </div>`;
  }
  if (days.length > S.lim) h += '<button class="btn-wide" data-a="more">Show earlier days</button>';
  return h;
}

/* =========================================================
   6. Lịch tháng
   ========================================================= */

export function cal(S, T) {
  const td = iso(T);
  const dayTg = store.targets.day;
  const dim = daysInMonth(S.vy, S.vm);
  const offset = (new Date(S.vy, S.vm, 1).getDay() + 6) % 7;

  let h = monthNav(S, T, `<span class="lbl">daily target ${short(dayTg) || '0'}</span>`);
  h += `<div class="cal">${WEEK_HEAD.map((w) => `<div class="lbl center">${w}</div>`).join('')}`;
  for (let i = 0; i < offset; i++) h += '<div></div>';
  for (let d = 1; d <= dim; d++) {
    const ds = iso(new Date(S.vy, S.vm, d));
    const future = ds > td;
    const out = future ? 0 : store.sum(ds, ds);
    const s = out ? level(dayTg ? out / dayTg : 2) : 'ok';
    const cls = ['cell', s !== 'ok' ? s : '', S.sel === ds ? 'sel' : '', ds === td ? 'today' : '', future ? 'future' : ''].join(' ');
    h += `<button class="${cls}" data-a="day" data-v="${ds}"><span class="d">${d}</span><span class="v" style="color:${soft(s)}">${short(out)}</span></button>`;
  }
  h += '</div>';

  h += `<div class="legend lbl">
    <span><i style="background:var(--card)"></i>Under 80%</span>
    <span><i style="background:var(--warn-bg)"></i>80–100%</span>
    <span><i style="background:var(--danger-bg)"></i>Over target</span>
  </div>`;

  const items = store.between(S.sel, S.sel);
  h += `<div class="card">
    <div class="row"><span class="strong">${S.sel === td ? 'Today' : dayLabel(S.sel)}</span><span class="lbl">spent ${vnd(store.sum(S.sel, S.sel))}</span></div>
    ${items.length ? items.map((t) => txRow(t, S)).join('') : empty('No entries')}
  </div>`;
  return h;
}

/* =========================================================
   7. Biểu đồ
   ========================================================= */

export function chart(S, T) {
  const td = iso(T);
  const dayTg = store.targets.day;
  const dim = daysInMonth(S.vy, S.vm);

  /* ----- Số liệu từng ngày (ngày tương lai = null) ----- */
  const vals = [];
  for (let d = 1; d <= dim; d++) {
    const ds = iso(new Date(S.vy, S.vm, d));
    vals.push(ds > td ? null : store.sum(ds, ds));
  }
  const past = vals.filter((v) => v !== null);
  const max = Math.max(dayTg * 1.3, ...past, 1);

  /* ----- Vẽ cột ----- */
  const W = 340, H = 160, bw = W / dim, ty = H - (dayTg / max) * H;
  let g = `<svg viewBox="0 0 ${W} ${H + 18}" width="100%" role="img" aria-label="Daily spending this month">`;
  vals.forEach((v, i) => {
    if (v === null) return;
    const hh = Math.max(v ? 2 : 0, (v / max) * H);
    const s = level(dayTg ? v / dayTg : 0);
    g += `<rect x="${(i * bw + 1.5).toFixed(1)}" y="${(H - hh).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${hh.toFixed(1)}" rx="2" style="fill:${soft(s)}"/>`;
  });
  if (dayTg) {
    g += `<line x1="0" x2="${W}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" style="stroke:var(--text)" stroke-dasharray="4 4" stroke-width="1"/>`;
    g += `<text x="${W}" y="${(ty - 5).toFixed(1)}" text-anchor="end" style="fill:var(--text-2);font-size:11px">target ${short(dayTg)}</text>`;
  }
  [1, 8, 15, 22, dim].forEach((d) => {
    g += `<text x="${((d - 0.5) * bw).toFixed(1)}" y="${H + 14}" text-anchor="middle" style="fill:var(--muted);font-size:11px">${d}</text>`;
  });
  g += '</svg>';

  /* ----- Chỉ số ----- */
  const [a, b] = monthRange(S.vy, S.vm);
  const total = store.sum(a, b);
  const avg = past.length ? total / past.length : 0;
  const top = Math.max(0, ...past);
  const topDay = vals.indexOf(top) + 1;

  let h = monthNav(S, T) + `<div class="card">${g}</div>`;
  h += `<div class="grid2">
    <div class="card stat"><div class="lbl">Daily average</div><div class="strong">${vnd(avg)}</div></div>
    <div class="card stat"><div class="lbl">${top ? `Highest · day ${topDay}` : 'Highest'}</div><div class="strong">${vnd(top)}</div></div>
  </div>`;

  /* ----- Tỉ lệ theo danh mục ----- */
  const cs = OUT_CATS.map((c) => [c, store.sum(a, b, 'out', c)]).filter((x) => x[1]).sort((x, y) => y[1] - x[1]);
  h += `<div class="card"><div class="lbl">Share by category</div>${cs.length ? cs.map(([c, v]) =>
    `<div class="cat-line"><div class="row small"><span>${c}</span><span class="lbl">${vnd(v)} · ${Math.round((v / total) * 100)}%</span></div>${bar(v / cs[0][1], 'ok', 'var(--text)')}</div>`).join('')
    : empty('No data yet')}</div>`;
  return h;
}

/* =========================================================
   8. Đặt target
   ========================================================= */

const MONTHS_SHORT = (T) => monthName(T.getFullYear(), T.getMonth()).split(' ')[0];

const moneyInput = (key, v) =>
  `<input class="money" data-k="${esc(key)}" inputmode="numeric" value="${Number(v).toLocaleString('vi-VN')}">`;

export function target(S, T) {
  if (!S.dr) S.dr = { day: store.targets.day, ct: { ...store.catTargets } };
  const D = S.dr;
  const dim = daysInMonth(T.getFullYear(), T.getMonth());
  const auto = (id, label, hint) =>
    `<div class="row field"><span>${label}<br><span class="lbl">${hint}</span></span><span class="money ro" id="${id}"></span></div>`;

  let h = secHead('Set targets', '<button class="btn-sm" data-a="tab" data-v="home">Close</button>');

  /* ----- Target tổng: chỉ nhập ngày, tuần / tháng tự nhân ----- */
  h += `<div class="card"><div class="lbl" style="margin-bottom:4px">Total target (₫)</div>
    <div class="row field"><span>Per day</span>${moneyInput('day', D.day)}</div>
    ${auto('autoWeek', 'Per week', 'auto · × 7 days')}
    ${auto('autoMonth', 'Per month', `auto · × ${dim} days in ${MONTHS_SHORT(T)}`)}
  </div>`;

  /* ----- Theo danh mục ----- */
  h += `<div class="card"><div class="lbl" style="margin-bottom:4px">By category, per month (₫)</div>${OUT_CATS
    .map((c) => `<div class="row field"><span>${c}</span>${moneyInput(`ct|${c}`, D.ct[c])}</div>`).join('')}
    <div id="catsum" class="lbl" style="margin-top:8px"></div></div>`;
  return `${h}<div class="err" id="err"></div><button class="btn-primary" data-a="savet">Save targets</button>`;
}

/** Cập nhật số tự tính (tuần, tháng, tổng danh mục) khi đang gõ, không vẽ lại cả màn */
export function targetSummary(S) {
  if (!S.dr) return;
  const t = deriveTargets(S.dr.day);
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  set('autoWeek', vnd(t.week));
  set('autoMonth', vnd(t.month));

  const total = OUT_CATS.reduce((x, c) => x + (S.dr.ct[c] || 0), 0);
  const over = total > t.month;
  set('catsum', `<span style="color:${over ? 'var(--warn)' : 'var(--text-2)'}">Categories total ${vnd(total)} / monthly target ${vnd(t.month)}${over ? ' · over' : ''}</span>`);
}

/* =========================================================
   9. Sao lưu
   ========================================================= */

const fmtDate = (s) => {
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export function backup(S) {
  const span = store.span;
  const last = store.lastBackup;

  let h = secHead('Backup', '<button class="btn-sm" data-a="tab" data-v="home">Close</button>');

  /* ----- Tình trạng dữ liệu ----- */
  h += `<div class="card">
    <div class="lbl">Data on this phone</div>
    <div class="strong" style="margin-top:2px">${store.count} ${store.count === 1 ? 'entry' : 'entries'}</div>
    <div class="lbl">${span ? `From ${fmtDate(span[0])} to ${fmtDate(span[1])}` : 'No entries yet'}</div>
    <div class="lbl" style="margin-top:6px">Last backup: ${last && !isNaN(new Date(last)) ? fmtDate(iso(new Date(last))) : 'never'}</div>
    <button class="btn-primary" data-a="export">Export backup file</button>
  </div>`;

  /* ----- Khôi phục ----- */
  h += `<div class="card">
    <div class="strong">Restore from file</div>
    <div class="lbl" style="margin:2px 0 10px">Use this when you change phones, move from the web version to the app, or lose your data</div>
    <label class="btn-wide file-btn">Choose backup file<input type="file" id="importFile" accept=".json,application/json"></label>
  </div>`;

  /* ----- Xác nhận thay thế ----- */
  if (S.pending) {
    h += `<div class="card warn-card">
      <div class="strong">File has ${S.pending.tx.length} ${S.pending.tx.length === 1 ? 'entry' : 'entries'}</div>
      <div class="lbl" style="margin:2px 0 10px">All current data (${store.count}) will be replaced by the data in this file.</div>
      <div class="row gap">
        <button class="btn-wide" data-a="impcancel">Cancel</button>
        <button class="btn-wide danger-fill" data-a="impok">Replace</button>
      </div>
    </div>`;
  }

  h += `<div class="note lbl">
    Your data stays on this phone and is never uploaded.<br>
    Uninstalling the app or clearing its data deletes everything → export a backup regularly and keep it in Google Drive.
  </div>`;
  return h;
}
