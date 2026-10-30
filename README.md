# Chi tiêu — Expense tracker

Web app (PWA) theo dõi chi tiêu hằng ngày trên điện thoại: nhập nhanh khoản chi/thu, đặt target ngày / tuần / tháng và theo danh mục, xem sổ, lịch tháng, biểu đồ.

Dữ liệu chỉ lưu trong trình duyệt của điện thoại, không gửi lên mạng.

## Cài lên điện thoại Android

1. Mở link GitHub Pages của repo bằng Chrome
2. Menu ba chấm → **Cài đặt ứng dụng** (hoặc **Thêm vào màn hình chính**)
3. Mở app từ icon trên màn hình chính — dùng được cả khi không có mạng

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
```

Đổi danh mục: sửa `OUT_CATS` / `IN_CATS` trong `js/store.js`.
