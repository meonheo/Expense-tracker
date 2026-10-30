/* =========================================================
   store.js — dữ liệu của app
   - Lưu trong localStorage của điện thoại (không gửi đi đâu)
   - Thêm / xoá khoản, đặt target, tính tổng
   - Xuất / nhập file sao lưu
   ========================================================= */

import { today, daysInMonth } from './util.js';

/* ---------- Danh mục ---------- */
export const OUT_CATS = ['Food', 'Transport', 'Home', 'Shopping', 'Entertainment', 'Health', 'Other'];
export const IN_CATS = ['Salary', 'Freelance', 'Other'];

/* Tên danh mục tiếng Việt ở bản cũ / file sao lưu cũ → tên mới */
const LEGACY = {
  'Ăn uống': 'Food', 'Đi lại': 'Transport', 'Nhà cửa': 'Home', 'Mua sắm': 'Shopping',
  'Giải trí': 'Entertainment', 'Sức khoẻ': 'Health', 'Khác': 'Other', 'Lương': 'Salary'
};
const catName = (c) => LEGACY[c] || c;

/* ---------- Mặc định khi mới cài ---------- */
const KEY = 'expense-tracker:v1';

const defaults = () => ({
  version: 1,
  nextId: 1,
  lastBackup: null,
  tg: { day: 300000 },   // chỉ lưu target ngày; tuần / tháng tự tính
  ct: {
    Food: 3500000, Transport: 1000000, Home: 2200000, Shopping: 800000,
    Entertainment: 500000, Health: 300000, Other: 200000
  },
  tx: []
});

/* ---------- Kiểm tra & làm sạch dữ liệu ---------- */
const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid data');
  const d = defaults();

  if (raw.tg && raw.tg.day != null) d.tg.day = money(raw.tg.day);
  if (raw.ct) for (const [k, v] of Object.entries(raw.ct)) if (OUT_CATS.includes(catName(k)) && v != null) d.ct[catName(k)] = money(v);

  const list = Array.isArray(raw.tx) ? raw.tx : [];
  d.tx = list
    .filter((t) => t && (t.type === 'in' || t.type === 'out') && money(t.amt) > 0 && isDate(t.date))
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))
    .map((t, i) => {
      const cats = t.type === 'in' ? IN_CATS : OUT_CATS;
      return {
        id: i + 1,
        type: t.type,
        cat: cats.includes(catName(t.cat)) ? catName(t.cat) : 'Other',
        amt: money(t.amt),
        note: String(t.note || '').slice(0, 200),
        date: t.date
      };
    });
  d.nextId = d.tx.length + 1;
  d.lastBackup = typeof raw.lastBackup === 'string' ? raw.lastBackup : null;
  return d;
}

/* ---------- Đọc / ghi bộ nhớ máy ---------- */
function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : defaults();
  } catch (err) {
    // Dữ liệu hỏng: giữ lại bản gốc ở khoá riêng để không mất hẳn
    try { if (raw) localStorage.setItem(`${KEY}:corrupt`, raw); } catch (e) { /* bỏ qua */ }
    return defaults();
  }
}

let data = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

/* ---------- Target tuần / tháng tính từ target ngày ---------- */
/** Tuần = ngày × 7; tháng = ngày × số ngày của tháng hiện tại (28–31) */
export function deriveTargets(day, T = today()) {
  return { day, week: day * 7, month: day * daysInMonth(T.getFullYear(), T.getMonth()) };
}

/* ---------- API dùng trong app ---------- */
export const store = {
  get targets() { return deriveTargets(data.tg.day); },
  get catTargets() { return data.ct; },
  get count() { return data.tx.length; },
  get lastBackup() { return data.lastBackup; },

  /** Ngày sớm nhất và muộn nhất có dữ liệu */
  get span() {
    if (!data.tx.length) return null;
    const ds = data.tx.map((t) => t.date).sort();
    return [ds[0], ds[ds.length - 1]];
  },

  add({ type, cat, amt, note, date }) {
    data.tx.push({ id: data.nextId++, type, cat, amt: money(amt), note: String(note || '').slice(0, 200), date });
    return save();
  },

  remove(id) {
    data.tx = data.tx.filter((t) => t.id !== id);
    return save();
  },

  setTargets(day, ct) {
    data.tg = { day: money(day) };
    data.ct = { ...ct };
    return save();
  },

  /** Các khoản trong khoảng ngày, mới nhất lên trước */
  between(a, b) {
    return data.tx
      .filter((t) => t.date >= a && t.date <= b)
      .sort((x, y) => (x.date === y.date ? y.id - x.id : x.date < y.date ? 1 : -1));
  },

  /** Tổng tiền theo loại (out/in), có thể lọc theo danh mục */
  sum(a, b, type = 'out', cat = null) {
    let s = 0;
    for (const t of data.tx) {
      if (t.type === type && t.date >= a && t.date <= b && (!cat || t.cat === cat)) s += t.amt;
    }
    return s;
  },

  /* ----- Sao lưu ----- */
  exportText() {
    data.lastBackup = new Date().toISOString();
    save();
    return JSON.stringify({ app: 'expense-tracker', exportedAt: data.lastBackup, ...data }, null, 2);
  },

  /** Đọc file sao lưu, trả về dữ liệu đã làm sạch (chưa ghi đè) */
  parseBackup(text) {
    const raw = JSON.parse(text);
    if (!raw || !Array.isArray(raw.tx) || !raw.tg) throw new Error('Not a backup file');
    return normalize(raw);
  },

  replaceAll(next) {
    const prev = data;
    data = next;
    if (save()) return true;
    data = prev;
    return false;
  }
};

/* Xin trình duyệt giữ dữ liệu lâu dài, hạn chế bị tự xoá khi máy đầy bộ nhớ */
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
