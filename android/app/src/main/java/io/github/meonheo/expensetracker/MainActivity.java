package io.github.meonheo.expensetracker;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Màn hình chính: hiển thị giao diện web (thư mục assets/www) trong WebView.
 *
 * 1. Khởi tạo khung + tràn viền (edge-to-edge)
 * 2. Nạp giao diện web
 * 3. Cầu nối JS ↔ Android (window.AndroidBridge)
 * 4. Chọn file / lưu file sao lưu
 * 5. Nút Back, mở từ widget
 */
public class MainActivity extends Activity {

    static final String ACTION_ADD = "io.github.meonheo.expensetracker.ADD";
    private static final String APP_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int REQ_PICK_FILE = 1;
    private static final int REQ_SAVE_FILE = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingBackup;
    private volatile String pendingAction;
    private boolean pageReady;

    /* =========================================================
       1. Khởi tạo
       ========================================================= */

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        pendingAction = actionOf(getIntent());

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.app_bg));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        setupEdgeToEdge(root);
        setupWebView();
        setupBack();
        web.loadUrl(APP_URL);
    }

    private boolean isNight() {
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    /** Vẽ tràn viền, tự chừa chỗ cho thanh trạng thái, thanh điều hướng và bàn phím */
    @SuppressWarnings("deprecation")
    private void setupEdgeToEdge(View root) {
        boolean light = !isNight();
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int flags = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(light ? flags : 0, flags);
            }
        } else {
            int ui = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (light) ui |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            getWindow().getDecorView().setSystemUiVisibility(ui);
        }

        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout()
                        | WindowInsets.Type.ime());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
    }

    /* =========================================================
       2. Nạp giao diện web
       ========================================================= */

    private void setupWebView() {
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);      // localStorage = nơi lưu dữ liệu chi tiêu
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                dispatchPendingAction();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                return openFilePicker(callback);
            }
        });
    }

    /* =========================================================
       3. Cầu nối JS ↔ Android
       ========================================================= */

    public final class Bridge {
        /** JS gửi số liệu tóm tắt → lưu lại và vẽ lại widget */
        @JavascriptInterface
        public void updateWidget(String json) {
            WidgetData.save(getApplicationContext(), json);
            SpendWidget.refreshAll(getApplicationContext());
        }

        /** JS gửi nội dung file sao lưu → mở hộp thoại chọn nơi lưu */
        @JavascriptInterface
        public void saveBackup(String text, String fileName) {
            runOnUiThread(() -> openSaveDialog(text, fileName));
        }

        /** JS hỏi lúc khởi động: app có được mở từ nút + của widget không */
        @JavascriptInterface
        public String consumeAction() {
            String a = pendingAction;
            pendingAction = null;
            return a == null ? "" : a;
        }
    }

    private void callJs(String script) {
        if (web != null) web.evaluateJavascript(script, null);
    }

    private void toastJs(String msg, boolean isError) {
        callJs("window.__nativeToast && window.__nativeToast(" + JSONObject.quote(msg) + "," + isError + ")");
    }

    /* =========================================================
       4. Chọn file / lưu file sao lưu
       ========================================================= */

    private boolean openFilePicker(ValueCallback<Uri[]> callback) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = callback;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        try {
            startActivityForResult(Intent.createChooser(i, "Chọn file sao lưu"), REQ_PICK_FILE);
            return true;
        } catch (ActivityNotFoundException e) {
            fileCallback = null;
            return false;
        }
    }

    private void openSaveDialog(String text, String fileName) {
        pendingBackup = text;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("application/json");
        i.putExtra(Intent.EXTRA_TITLE, fileName);
        try {
            startActivityForResult(i, REQ_SAVE_FILE);
        } catch (ActivityNotFoundException e) {
            pendingBackup = null;
            toastJs("Máy không hỗ trợ lưu file", true);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Uri uri = (resultCode == RESULT_OK && data != null) ? data.getData() : null;

        if (requestCode == REQ_PICK_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri});
                fileCallback = null;
            }
        } else if (requestCode == REQ_SAVE_FILE) {
            if (uri != null && pendingBackup != null) {
                try (OutputStream os = getContentResolver().openOutputStream(uri, "w")) {
                    if (os == null) throw new IllegalStateException("no stream");
                    os.write(pendingBackup.getBytes(StandardCharsets.UTF_8));
                    toastJs("Đã lưu file sao lưu", false);
                } catch (Exception e) {
                    toastJs("Không lưu được file sao lưu", true);
                }
            }
            pendingBackup = null;
        }
    }

    /* =========================================================
       5. Nút Back, mở từ widget
       ========================================================= */

    /** Back: nếu đang ở màn khác thì về Tổng quan, đang ở Tổng quan thì thoát */
    private void handleBack() {
        if (!pageReady) {
            finish();
            return;
        }
        web.evaluateJavascript("(window.__nativeBack && window.__nativeBack()) ? 'y' : 'n'", result -> {
            if (!"\"y\"".equals(result)) finish();
        });
    }

    private void setupBack() {
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack();   // Android 12 trở xuống
    }

    private static String actionOf(Intent intent) {
        return intent != null && ACTION_ADD.equals(intent.getAction()) ? "add" : null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String a = actionOf(intent);
        if (a != null) {
            pendingAction = a;
            if (pageReady) dispatchPendingAction();
        }
    }

    private void dispatchPendingAction() {
        String a = pendingAction;
        if (a == null) return;
        pendingAction = null;
        callJs("window.__nativeAction && window.__nativeAction(" + JSONObject.quote(a) + ")");
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Quay lại app (có thể đã sang ngày mới) → giao diện vẽ lại, widget đồng bộ
        if (pageReady) callJs("window.__nativeResume && window.__nativeResume()");
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
