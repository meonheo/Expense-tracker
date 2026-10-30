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
 * Nếu đã sang ngày mới mà chưa mở app → số đã chi hôm nay về 0.
 *
 * JSON từ JS: { date, day, weekStart, week, month, monthSpent, tgDay }
 */
final class WidgetData {

    private static final String PREFS = "widget";
    private static final String KEY = "summary";

    long spentDay;
    long tgDay;

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
            String today = LocalDate.now().toString();
            d.spentDay = today.equals(o.optString("date")) ? o.optLong("day") : 0;
            d.tgDay = o.optLong("tgDay");
        } catch (Exception ignored) {
        }
        return d;
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* ---------- Mức so với target: 0 = dưới 80%, 1 = 80–100%, 2 = vượt ---------- */

    static int level(long spent, long target) {
        if (target <= 0) return 0;
        double r = (double) spent / target;
        return r > 1 ? 2 : r >= 0.8 ? 1 : 0;
    }

    /* ---------- Định dạng số (giống util.js, không kèm ₫) ---------- */

    /** 120000 → "120.000" */
    static String number(long n) {
        DecimalFormatSymbols s = new DecimalFormatSymbols();
        s.setGroupingSeparator('.');
        return new DecimalFormat("#,##0", s).format(n);
    }
}
