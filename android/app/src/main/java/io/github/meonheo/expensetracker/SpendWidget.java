package io.github.meonheo.expensetracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Widget màn hình chính.
 * - Chạm vào widget → mở app (Tổng quan)
 * - Chạm nút + → mở thẳng màn nhập khoản mới
 */
public class SpendWidget extends AppWidgetProvider {

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

    /* ---------- Dựng giao diện widget ---------- */

    static RemoteViews build(Context ctx) {
        WidgetData d = WidgetData.load(ctx);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_spend);

        /* ----- Số tiền + màu theo mức ----- */
        int level = WidgetData.level(d.spentDay, d.tgDay);
        v.setTextViewText(R.id.w_spent, WidgetData.vnd(d.spentDay));
        int levelColor = ctx.getColor(level == 2 ? R.color.w_over : R.color.w_warn);
        if (level > 0) v.setTextColor(R.id.w_spent, levelColor);

        /* ----- Thanh tiến độ: chỉ hiện thanh đúng màu ----- */
        int pct = WidgetData.percent(d.spentDay, d.tgDay);
        int[] bars = {R.id.w_bar_ok, R.id.w_bar_warn, R.id.w_bar_over};
        for (int i = 0; i < bars.length; i++) {
            v.setViewVisibility(bars[i], i == level ? View.VISIBLE : View.GONE);
            v.setProgressBar(bars[i], 100, pct, false);
        }

        /* ----- Còn lại / target / tháng ----- */
        if (d.hasData) {
            long left = d.tgDay - d.spentDay;
            v.setTextViewText(R.id.w_left, left >= 0
                    ? "Còn " + WidgetData.vnd(left)
                    : "Vượt " + WidgetData.vnd(-left));
            if (level > 0) v.setTextColor(R.id.w_left, levelColor);
            v.setTextViewText(R.id.w_target, "Target " + WidgetData.vnd(d.tgDay));
            v.setTextViewText(R.id.w_month, "Tháng này " + WidgetData.shortVnd(d.spentMonth)
                    + " / " + WidgetData.shortVnd(d.tgMonth));
        } else {
            v.setTextViewText(R.id.w_left, "Mở app để đồng bộ");
            v.setTextViewText(R.id.w_target, "");
            v.setTextViewText(R.id.w_month, "");
        }

        /* ----- Chạm ----- */
        v.setOnClickPendingIntent(R.id.w_root, openApp(ctx, null, 0));
        v.setOnClickPendingIntent(R.id.w_add, openApp(ctx, MainActivity.ACTION_ADD, 1));
        return v;
    }

    private static PendingIntent openApp(Context ctx, String action, int requestCode) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(action != null ? action : Intent.ACTION_MAIN);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, requestCode, i,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
