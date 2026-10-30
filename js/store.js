/* =========================================================
   store.js — dữ liệu của app
   - Lưu trong localStorage của điện thoại (không gửi đi đâu)
   - Thêm / xoá khoản, đặt target, tính tổng
   - Xuất / nhập file sao lưu
   ========================================================= */

/* ---------- Danh mục ---------- */
export const OUT_CATS = ['Ăn uống', 'Đi lại', 'Nhà cửa', 'Mua sắm', 'Giải trí', 'Sức khoẻ', 'Khác'];
export const IN_CATS = ['Lương', 'Freelance', 'Khác'];

/* ---------- Mặc định khi mới cài ---------- */
const KEY = 'expense-tracker:v1';

const defaults = () => ({
  version: 1,
  nextId: 1,
  lastBackup: null,
  tg: { day: 300000, week: 2000000, month: 8500000 },
  ct: {
    'Ăn uống': 3500000, 'Đi lại': 1000000, 'Nhà cửa': 2200000, 'Mua sắm': 800000,
    'Giải trí': 500000, 'Sức khoẻ': 300000, 'Khác': 200000
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
  if (!raw || typeof raw !== 'object') throw new Error('Dữ liệu không hợp lệ');
  const d = defaults();

  if (raw.tg) for (const k of ['day', 'week', 'month']) if (raw.tg[k] != null) d.tg[k] = money(raw.tg[k]);
  if (raw.ct) for (const c of OUT_CATS) if (raw.ct[c] != null) d.ct[c] = money(raw.ct[c]);

  const list = Array.isArray(raw.tx) ? raw.tx : [];
  d.tx = list
    .filter((t) => t && (t.type === 'in' || t.type === 'out') && money(t.amt) > 0 && isDate(t.date))
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))
    .map((t, i) => {
      const cats = t.type === 'in' ? IN_CATS : OUT_CATS;
      return {
        id: i + 1,
        type: t.type,
        cat: cats.includes(t.cat) ? t.cat : 'Khác',
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

/* ---------- API dùng trong app ---------- */
export const store = {
  get targets() { return data.tg; },
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

  setTargets(tg, ct) {
    data.tg = { ...tg };
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
    if (!raw || !Array.isArray(raw.tx) || !raw.tg) throw new Error('Không phải file sao lưu');
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
