package io.github.meonheo.expensetracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.widget.RemoteViews;

/**
 * Widget 2×1 trên màn hình chính: "Today" + số tiền đã chi hôm nay + nút +.
 *
 * Widget Android không dùng được font riêng một cách ổn định,
 * nên chữ được vẽ bằng font DIN thành ảnh rồi gắn vào widget.
 * Vẽ 2 bộ ảnh (máy sáng / máy tối); layout và layout-night tự hiện đúng bộ.
 *
 * - Chạm vào widget → mở app (Overview)
 * - Chạm nút +      → mở app ở màn nhập khoản mới
 */
public class SpendWidget extends AppWidgetProvider {

    /* =========================================================
       1. Màu (khớp css/style.css và values/colors.xml)
       ========================================================= */

    private static final class Palette {
        final int label, text, warn, over, plus;
        Palette(int label, int text, int warn, int over, int plus) {
            this.label = label; this.text = text; this.warn = warn; this.over = over; this.plus = plus;
        }
    }

    private static final Palette LIGHT = new Palette(0xFF6B6A66, 0xFF1A1A18, 0xFFB8730D, 0xFFC9392B, 0xFFF4F2EE);
    private static final Palette DARK = new Palette(0xFFA9A7A0, 0xFFF1EFE9, 0xFFE6A640, 0xFFF07A6C, 0xFF121211);

    /* =========================================================
       2. Cập nhật widget
       ========================================================= */

    @Override
    public void onUpdate(Context ctx, AppWidgetManager manager, int[] ids) {
        RemoteViews views = build(ctx);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    /** Vẽ lại mọi widget đang đặt trên màn hình (gọi khi dữ liệu trong app đổi) */
    static void refreshAll(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, SpendWidget.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews views = build(ctx);
        for (int id : ids) m.updateAppWidget(id, views);
    }

    static RemoteViews build(Context ctx) {
        WidgetData d = WidgetData.load(ctx);
        Fonts f = Fonts.get(ctx);
        float dp = ctx.getResources().getDisplayMetrics().density;
        int level = WidgetData.level(d.spentDay, d.tgDay);
        String amount = WidgetData.number(d.spentDay);

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_spend);

        v.setImageViewBitmap(R.id.w_label_l, textBitmap("Today", f.medium, 11, LIGHT.label, dp));
        v.setImageViewBitmap(R.id.w_label_d, textBitmap("Today", f.medium, 11, DARK.label, dp));
        v.setImageViewBitmap(R.id.w_amount_l, amountBitmap(amount, f.black, colorFor(LIGHT, level), dp));
        v.setImageViewBitmap(R.id.w_amount_d, amountBitmap(amount, f.black, colorFor(DARK, level), dp));
        v.setImageViewBitmap(R.id.w_plus_l, textBitmap("+", f.bold, 22, LIGHT.plus, dp));
        v.setImageViewBitmap(R.id.w_plus_d, textBitmap("+", f.bold, 22, DARK.plus, dp));

        v.setOnClickPendingIntent(R.id.w_root, openApp(ctx, null, 0));
        v.setOnClickPendingIntent(R.id.w_add, openApp(ctx, MainActivity.ACTION_ADD, 1));
        return v;
    }

    /** Dưới 80% target ngày → màu chữ thường, 80–100% → cam, vượt → đỏ */
    private static int colorFor(Palette p, int level) {
        return level == 2 ? p.over : level == 1 ? p.warn : p.text;
    }

    private static PendingIntent openApp(Context ctx, String action, int requestCode) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(action != null ? action : Intent.ACTION_MAIN);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, requestCode, i,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /* =========================================================
       3. Vẽ chữ thành ảnh
       ========================================================= */

    /** Font DIN lấy từ thư mục assets/www/fonts (dùng chung với giao diện app) */
    private static final class Fonts {
        private static Fonts cache;
        final Typeface medium, bold, black;

        private Fonts(Context ctx) {
            medium = load(ctx, "www/fonts/DIN-Medium.ttf", Typeface.DEFAULT);
            bold = load(ctx, "www/fonts/DIN-Bold.ttf", Typeface.DEFAULT_BOLD);
            black = load(ctx, "www/fonts/DIN-Black.ttf", Typeface.DEFAULT_BOLD);
        }

        static synchronized Fonts get(Context ctx) {
            if (cache == null) cache = new Fonts(ctx.getApplicationContext());
            return cache;
        }

        private static Typeface load(Context ctx, String path, Typeface fallback) {
            try {
                return Typeface.createFromAsset(ctx.getAssets(), path);
            } catch (RuntimeException e) {
                return fallback;
            }
        }
    }

    private static Paint paint(Typeface tf, float sizePx, int color) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        p.setTypeface(tf);
        p.setTextSize(sizePx);
        p.setColor(color);
        return p;
    }

    /** Một dòng chữ, ảnh vừa khít theo nét chữ */
    private static Bitmap textBitmap(String text, Typeface tf, float sizeDp, int color, float dp) {
        Paint p = paint(tf, sizeDp * dp, color);
        Rect b = new Rect();
        p.getTextBounds(text, 0, text.length(), b);
        int pad = Math.round(dp);
        Bitmap bmp = Bitmap.createBitmap(Math.max(1, b.width() + pad * 2), Math.max(1, b.height() + pad * 2),
                Bitmap.Config.ARGB_8888);
        new Canvas(bmp).drawText(text, pad - b.left, pad - b.top, p);
        return bmp;
    }

    /** Số tiền (DIN Black) + ký tự ₫ nhỏ hơn (font hệ thống, vì DIN không có ₫), chung đường chân chữ */
    private static Bitmap amountBitmap(String number, Typeface tf, int color, float dp) {
        float size = 22 * dp;
        Paint num = paint(tf, size, color);
        Paint cur = paint(Typeface.DEFAULT_BOLD, size * 0.72f, color);

        float gap = 3 * dp;
        float numW = num.measureText(number);
        float width = numW + gap + cur.measureText("₫");
        Rect numB = new Rect();
        Rect curB = new Rect();
        num.getTextBounds(number, 0, number.length(), numB);
        cur.getTextBounds("₫", 0, 1, curB);       // ₫ có gạch dưới, thấp hơn chân chữ số
        int top = Math.round(Math.max(-numB.top, -curB.top)) + Math.round(dp);
        int height = top + Math.max(Math.max(numB.bottom, curB.bottom), 0) + Math.round(dp);

        Bitmap bmp = Bitmap.createBitmap(Math.max(1, Math.round(width + dp)), Math.max(1, height),
                Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        c.drawText(number, 0, top, num);
        c.drawText("₫", numW + gap, top, cur);
        return bmp;
    }
}
