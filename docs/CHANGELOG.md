# 1.2.1 — 16/09/2026
- Chuẩn hóa bộ source GitHub để loại page/route collision và file placeholder.
- Mỗi người chỉ đọc/đánh dấu thông báo của mình, kể cả Quản trị viên.
- Metadata tệp đi qua Server API; Firestore Rules không mở read trực tiếp.
- Đổi endpoint Apps Script thực trong `.env.example` thành placeholder.
- Chưa xác nhận build và chưa triển khai Rules/Vercel.

# v1.2.0 — 16/09/2026

- Tài khoản mới đăng nhập chỉ chờ quản trị viên duyệt, thông báo yêu cầu duy nhất cho mỗi quản trị viên; tài khoản đã từ chối/tạm khóa không tự mở lại khi đăng nhập.
- Quản lý tài khoản bằng 6 hành động riêng: phê duyệt, từ chối, tạm khóa, mở khóa, đổi tên, đổi quyền; yêu cầu lý do với thao tác nhạy cảm; ghi lịch sử cập nhật cùng giao dịch.
- Trang cá nhân của quản trị viên chỉ truy vấn bản ghi cá nhân; dữ liệu toàn đơn vị tách riêng trong khu vực quản trị.
- Chống ghi đè chỉnh sửa đồng thời bằng kiểm tra phiên bản trong Firestore transaction; tạo/sửa công việc và lịch sử cùng transaction.
- Thông báo tài khoản mới dẫn đến đúng danh sách yêu cầu phê duyệt; khắc phục lỗi đăng nhập trả dữ liệu của phiên cũ khi chuyển tài khoản nhanh.
- Thống nhất nhãn, nút, trạng thái, lỗi tiếng Việt tự nhiên. Bổ sung index truy vấn quản trị viên đang hoạt động.
- Dọn root GitHub; di chuyển source Apps Script vào `appscript/`, hướng dẫn vào `docs/`, bổ sung kiểm tra hợp đồng route/permissions.
- Giữ firebase-admin 13.10.0; OneSignal chưa tích hợp; giữ quy tắc tệp riêng tư 3 MB.
