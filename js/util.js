/* =========================================================
   util.js — hàm tiện ích dùng chung: ngày tháng, định dạng tiền
   Không phụ thuộc file nào khác.
   ========================================================= */

/* ---------- Ngày tháng ---------- */
export const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const WEEK_HEAD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const pad = (n) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' (theo giờ máy, không theo UTC) */
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DD' → Date lúc 00:00 */
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/** 'YYYY-MM-DD' → 'T5, 29/10' */
export const dayLabel = (s) => {
  const d = parseISO(s);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** Khoảng ngày [bắt đầu, kết thúc] dạng ISO. Tuần bắt đầu thứ Hai. */
export function periodRange(period, T) {
  let start = new Date(T);
  let end = new Date(T);
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  } else if (period === 'month') {
    start = new Date(T.getFullYear(), T.getMonth(), 1);
    end = new Date(T.getFullYear(), T.getMonth() + 1, 0);
  }
  return [iso(start), iso(end)];
}

export const monthRange = (y, m) => [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];

/* ---------- Khoảng tháng được xem ở Sổ / Lịch / Biểu đồ ---------- */
/* Đổi 2 dòng này nếu muốn mở rộng (tháng tính từ 0: 9 = tháng 10, 11 = tháng 12) */
const VIEW_FIRST = new Date(2026, 9, 1);   // 10/2026
const VIEW_LAST = new Date(2027, 11, 1);   // 12/2027

/** [tháng đầu, tháng cuối] — luôn bao gồm tháng hiện tại nếu lỡ nằm ngoài khoảng */
export function viewBounds(T) {
  const cur = new Date(T.getFullYear(), T.getMonth(), 1);
  return [cur < VIEW_FIRST ? cur : VIEW_FIRST, cur > VIEW_LAST ? cur : VIEW_LAST];
}

/* ---------- Định dạng ---------- */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 30000 → '30.000 ₫' */
export const vnd = (n) => `${Math.round(n).toLocaleString('vi-VN')} ₫`;

/** Số gọn cho ô nhỏ: 1250000 → '1,3tr', 45000 → '45k' */
export const short = (n) => {
  if (n >= 1e6) return `${String(Math.round(n / 1e5) / 10).replace('.', ',')}tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n > 0 ? String(Math.round(n)) : '';
};

/** Chỉ giữ chữ số: '1.200.000 ₫' → 1200000 */
export const digits = (s) => Number(String(s).replace(/\D/g, '')) || 0;
