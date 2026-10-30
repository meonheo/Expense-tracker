/* =========================================================
   app.js — điều khiển app
   1. Trạng thái màn hình
   2. Vẽ giao diện
   3. Xử lý bấm nút / gõ phím / chọn file
   4. Bản APK: widget, sao lưu qua Android, nút Back
   5. Khởi động (service worker, cập nhật khi mở lại app)
   ========================================================= */

import { iso, today, digits, vnd, viewBounds, periodRange } from './util.js';
import { store, OUT_CATS, IN_CATS } from './store.js';
import * as V from './views.js';

const root = document.getElementById('app');

/** Có giá trị khi chạy trong app APK (do MainActivity.java gắn vào), null khi chạy trên web */
const NATIVE = window.AndroidBridge || null;

/* =========================================================
   1. Trạng thái màn hình (không phải dữ liệu — dữ liệu ở store.js)
   ========================================================= */

const T0 = today();
const S = {
  tab: 'home',           // home | add | book | cal | chart | target | backup
  period: 'month',       // Tổng quan: day | week | month
  // màn nhập
  type: 'out', amt: '', cat: OUT_CATS[0], note: '', date: iso(T0), err: '',
  // Sổ / Lịch / Biểu đồ: tháng đang xem
  vy: T0.getFullYear(), vm: T0.getMonth(), sel: iso(T0), lim: 5,
  open: null,            // id khoản đang mở nút Xoá
  dr: null,              // bản nháp target đang sửa
  pending: null,         // dữ liệu từ file sao lưu chờ xác nhận
  msg: '', msgType: 'ok' // thông báo ngắn
};

const say = (msg, type = 'ok') => { S.msg = msg; S.msgType = type; };
const SAVE_FAIL = 'Không lưu được. Bộ nhớ trình duyệt có thể đã đầy.';

/* =========================================================
   2. Vẽ giao diện
   ========================================================= */

const VIEWS = {
  home: V.home, add: V.add, book: V.book, cal: V.cal,
  chart: V.chart, target: V.target, backup: V.backup
};

function render() {
  const T = today();
  root.innerHTML =
    V.header(T) +
    V.toast(S) +
    `<main class="main">${VIEWS[S.tab](S, T)}</main>` +
    V.tabbar(S);
  S.msg = '';
  if (S.tab === 'target') V.targetSummary(S);
  syncWidget();
}

function go(tab) {
  if (tab === 'add' && !S.amt) S.date = iso(today());
  if (tab !== 'backup') S.pending = null;
  S.tab = tab;
  S.open = null;
  S.err = '';
  S.dr = null;
  S.lim = 5;
  render();
  window.scrollTo(0, 0);
}

/* ---------- Chuyển tháng, trong khoảng 10/2026 – 12/2027 (xem util.js) ---------- */
function shiftMonth(step) {
  const T = today();
  const d = new Date(S.vy, S.vm + step, 1);
  const [first, last] = viewBounds(T);
  if (d < first || d > last) return;
  S.vy = d.getFullYear();
  S.vm = d.getMonth();
  const isCurrent = S.vy === T.getFullYear() && S.vm === T.getMonth();
  S.sel = isCurrent ? iso(T) : iso(d);
  S.lim = 5;
  S.open = null;
  render();
}

/* =========================================================
   3. Xử lý thao tác
   ========================================================= */

/* ---------- Bàn phím số: chỉ cập nhật ô số tiền, không vẽ lại cả màn ---------- */
function pressKey(k) {
  if (k === 'del') S.amt = S.amt.slice(0, -1);
  else if ((S.amt + k).length <= 12) S.amt = (S.amt + k).replace(/^0+/, '');
  S.err = '';
  document.getElementById('amt').innerHTML = V.amountText(S);
  document.getElementById('err').textContent = '';
}

function saveTx() {
  const n = Number(S.amt);
  if (!n) {
    S.err = 'Nhập số tiền trước';
    document.getElementById('err').textContent = S.err;
    return;
  }
  const T = today();
  const date = S.date && S.date <= iso(T) ? S.date : iso(T);
  if (!store.add({ type: S.type, cat: S.cat, amt: n, note: S.note.trim(), date })) {
    say(SAVE_FAIL, 'err');
    render();
    return;
  }
  say(`Đã lưu ${vnd(n)} · ${S.cat}`);
  S.amt = '';
  S.note = '';
  // Lần nhập sau mặc định quay về Khoản chi (loại hay dùng nhất)
  if (S.type === 'in') { S.type = 'out'; S.cat = OUT_CATS[0]; }
  go('home');
}

function saveTargets() {
  const D = S.dr;
  const errBox = document.getElementById('err');
  if (!D.day) {
    errBox.textContent = 'Target mỗi ngày phải lớn hơn 0';
    return;
  }
  if (!store.setTargets(D.day, D.ct)) {
    errBox.textContent = SAVE_FAIL;
    return;
  }
  say('Đã cập nhật target');
  go('home');
}

/* ---------- Sao lưu ---------- */
function exportBackup() {
  const text = store.exportText();
  const fileName = `chi-tieu-sao-luu-${iso(today())}.json`;

  // APK: Android mở hộp thoại chọn nơi lưu (Drive, Tải xuống…), lưu xong tự báo
  if (NATIVE && NATIVE.saveBackup) {
    NATIVE.saveBackup(text, fileName);
    return;
  }

  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  say('Đã xuất file sao lưu. Kiểm tra trong mục Tải xuống.');
  render();
}

async function readBackupFile(file) {
  try {
    S.pending = store.parseBackup(await file.text());
  } catch (err) {
    S.pending = null;
    say('File không đúng định dạng sao lưu của app', 'err');
  }
  render();
}

function confirmImport() {
  if (!S.pending) return;
  if (store.replaceAll(S.pending)) say(`Đã khôi phục ${S.pending.tx.length} khoản`);
  else say(SAVE_FAIL, 'err');
  S.pending = null;
  render();
}

/* ---------- Bấm nút ---------- */
const ACTIONS = {
  tab: (v) => go(v),
  per: (v) => { S.period = v; render(); },
  type: (v) => { S.type = v; S.cat = (v === 'out' ? OUT_CATS : IN_CATS)[0]; render(); },
  cat: (v) => { S.cat = v; render(); },
  key: (v) => pressKey(v),
  save: () => saveTx(),
  open: (v) => { S.open = S.open === Number(v) ? null : Number(v); render(); },
  del: (v) => {
    if (!store.remove(Number(v))) say(SAVE_FAIL, 'err');
    S.open = null;
    render();
  },
  mon: (v) => shiftMonth(Number(v)),
  day: (v) => { S.sel = v; S.open = null; render(); },
  more: () => { S.lim += 7; render(); },
  savet: () => saveTargets(),
  export: () => exportBackup(),
  impok: () => confirmImport(),
  impcancel: () => { S.pending = null; render(); }
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || !root.contains(el) || el.disabled) return;
  e.stopPropagation();
  const fn = ACTIONS[el.dataset.a];
  if (fn) fn(el.dataset.v);
});

/* ---------- Bản nháp target: khoá 'day' hoặc 'ct|<danh mục>' ---------- */
function setDraft(k, n) {
  if (k === 'day') S.dr.day = n;
  else S.dr.ct[k.split('|')[1]] = n;
}
const getDraft = (k) => (k === 'day' ? S.dr.day : S.dr.ct[k.split('|')[1]]);

/* ---------- Gõ chữ / số ---------- */
root.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'note') S.note = t.value;
  else if (t.id === 'date') S.date = t.value;
  else if (t.dataset.k && S.dr) {
    setDraft(t.dataset.k, digits(t.value));
    const errBox = document.getElementById('err');
    if (errBox) errBox.textContent = '';
    V.targetSummary(S);
  }
});

root.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'importFile' && t.files && t.files[0]) {
    readBackupFile(t.files[0]);
  } else if (t.dataset.k && S.dr) {
    t.value = getDraft(t.dataset.k).toLocaleString('vi-VN');
  }
});

/* =========================================================
   4. Bản APK: widget, sao lưu qua Android, nút Back
   (Trên web các hàm này không được gọi tới)
   ========================================================= */

/** Gửi số liệu tóm tắt cho widget màn hình chính */
function syncWidget() {
  if (!NATIVE || !NATIVE.updateWidget) return;
  const T = today();
  const td = iso(T);
  const [ws, we] = periodRange('week', T);
  const [ms, me] = periodRange('month', T);
  try {
    NATIVE.updateWidget(JSON.stringify({
      date: td, day: store.sum(td, td),
      weekStart: ws, week: store.sum(ws, we),
      month: td.slice(0, 7), monthSpent: store.sum(ms, me),
      tgDay: store.targets.day
    }));
  } catch (err) { /* widget lỗi không được làm hỏng app */ }
}

/** Android báo kết quả (vd. đã lưu file sao lưu) */
window.__nativeToast = (msg, isError) => { say(msg, isError ? 'err' : 'ok'); render(); };

/** Mở từ nút + của widget */
window.__nativeAction = (action) => { if (action === 'add') go('add'); };

/** Nút Back: đang ở màn khác → về Tổng quan (true); đang ở Tổng quan → để Android thoát (false) */
window.__nativeBack = () => {
  if (S.tab === 'home') return false;
  go('home');
  return true;
};

/** Quay lại app từ nền */
window.__nativeResume = () => {
  if (S.tab !== 'add' && S.tab !== 'target') render();
  else syncWidget();
};

/* =========================================================
   5. Khởi động
   ========================================================= */

// Mở lại app sau khi để nền (có thể đã sang ngày mới) → vẽ lại
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.tab !== 'add' && S.tab !== 'target') render();
});

// Service worker chỉ dùng cho bản web (APK đã có sẵn file trong máy)
if (!NATIVE && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Mở từ nút + của widget khi app chưa chạy
if (NATIVE && NATIVE.consumeAction && NATIVE.consumeAction() === 'add') S.tab = 'add';

render();
