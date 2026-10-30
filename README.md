# Expense tracker

Web app (PWA) theo dõi chi tiêu hằng ngày trên điện thoại: nhập nhanh khoản chi/thu, đặt target ngày / tuần / tháng và theo danh mục, xem sổ, lịch tháng, biểu đồ.

Dữ liệu chỉ lưu trong trình duyệt của điện thoại, không gửi lên mạng.

## Cài app Android (APK, có widget)

1. Vào trang **Releases** của repo → bản mới nhất → tải file `ExpenseTracker-v1.0.x.apk`
2. Mở file → cho phép cài từ nguồn này → Cài đặt
3. Widget: nhấn giữ màn hình chính → Tiện ích (Widgets) → **Expense tracker**
4. Cập nhật: tải APK mới hơn và cài đè, dữ liệu giữ nguyên

Mỗi lần có code mới trên nhánh `main`, GitHub Actions tự build APK (xem `.github/workflows/android.yml`).

## Bản web (không có widget)

1. Mở link GitHub Pages của repo bằng Chrome
2. Menu ba chấm → **Cài đặt ứng dụng** (hoặc **Thêm vào màn hình chính**)
3. Mở app từ icon trên màn hình chính — dùng được cả khi không có mạng

Bản web và bản APK lưu dữ liệu riêng. Chuyển dữ liệu bằng Sao lưu → Xuất file / Chọn file sao lưu.

## Sao lưu

- Nút **Sao lưu** góc trên → **Xuất file sao lưu** → file `.json` nằm trong mục Tải xuống
- Đổi máy hoặc lỡ xoá dữ liệu Chrome → **Chọn file sao lưu** để khôi phục

## Cấu trúc code

```
index.html            khung trang
manifest.webmanifest  thông tin để cài như app
sw.js                 chạy offline (tăng số phiên bản CACHE khi đổi danh sách file)
css/style.css         giao diện, màu sáng/tối
js/util.js            ngày tháng, định dạng tiền
js/store.js           dữ liệu: lưu, tính tổng, sao lưu, danh mục
js/views.js           giao diện từng màn hình
js/app.js             trạng thái + xử lý thao tác
icons/                icon app
fonts/                font DIN (Medium / Bold / Black) dùng cho app và widget
android/              app Android: WebView chứa giao diện web + widget
  app/src/main/java/…/MainActivity.java  màn hình chính, cầu nối JS ↔ Android
  app/src/main/java/…/SpendWidget.java   widget màn hình chính
  app/src/main/java/…/WidgetData.java    số liệu cho widget
  app/src/main/res/layout/widget_spend.xml  giao diện widget
  app/release.jks                         khoá ký APK (để cài đè bản mới)
```

Đổi danh mục: sửa `OUT_CATS` / `IN_CATS` trong `js/store.js`.
