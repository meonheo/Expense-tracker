package io.github.meonheo.expensetracker;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;

/**
 * Số liệu cho widget.
 * App (JS) gửi bản tóm tắt mỗi lần dữ liệu đổi; widget đọc lại ở đây.
 * Nếu đã sang ngày / tuần / tháng mới mà chưa mở app → số đã chi tương ứng về 0.
 *
 * JSON từ JS: { date, day, weekStart, week, month, monthSpent, tgDay }
 */
final class WidgetData {

    private static final String PREFS = "widget";
    private static final String KEY = "summary";

    boolean hasData;
    long spentDay, spentWeek, spentMonth;
    long tgDay, tgWeek, tgMonth;

    /* ---------- Lưu / đọc ---------- */

    static void save(Context ctx, String json) {
        prefs(ctx).edit().putString(KEY, json).apply();
    }

    static WidgetData load(Context ctx) {
        WidgetData d = new WidgetData();
        String raw = prefs(ctx).getString(KEY, null);
        if (raw == null) return d;
        try {
            JSONObject o = new JSONObject(raw);
            LocalDate today = LocalDate.now();
            String todayIso = today.toString();
            String weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1).toString();
            String month = todayIso.substring(0, 7);

            d.spentDay = todayIso.equals(o.optString("date")) ? o.optLong("day") : 0;
            d.spentWeek = weekStart.equals(o.optString("weekStart")) ? o.optLong("week") : 0;
            d.spentMonth = month.equals(o.optString("month")) ? o.optLong("monthSpent") : 0;

            // Tuần = ngày × 7; tháng = ngày × số ngày của tháng (giống trong app)
            d.tgDay = o.optLong("tgDay");
            d.tgWeek = d.tgDay * 7;
            d.tgMonth = d.tgDay * today.lengthOfMonth();
            d.hasData = true;
        } catch (Exception ignored) {
        }
        return d;
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* ---------- Mức so với target: 0 = dưới 80%, 1 = 80–100%, 2 = vượt ---------- */

    static int level(long spent, long target) {
        if (target <= 0) return spent > 0 ? 2 : 0;
        double r = (double) spent / target;
        return r > 1 ? 2 : r >= 0.8 ? 1 : 0;
    }

    static int percent(long spent, long target) {
        if (target <= 0) return spent > 0 ? 100 : 0;
        return (int) Math.min(100, Math.round(spent * 100.0 / target));
    }

    /* ---------- Định dạng tiền (giống util.js) ---------- */

    /** 30000 → "30.000 ₫" */
    static String vnd(long n) {
        DecimalFormatSymbols s = new DecimalFormatSymbols();
        s.setGroupingSeparator('.');
        DecimalFormat f = new DecimalFormat("#,##0", s);
        return f.format(n) + " ₫";
    }

    /** 9300000 → "9,3tr", 45000 → "45k" */
    static String shortVnd(long n) {
        if (n >= 1_000_000) {
            double v = Math.round(n / 100_000.0) / 10.0;
            String t = v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(v).replace('.', ',');
            return t + "tr";
        }
        if (n >= 1000) return Math.round(n / 1000.0) + "k";
        return String.valueOf(n);
    }
}
