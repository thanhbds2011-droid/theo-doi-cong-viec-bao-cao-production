# Theo dõi công việc & Báo cáo — v1.2.1

Ứng dụng nội bộ trên Next.js 16 App Router, TypeScript, Google Sign-In, Cloud Firestore và Vercel. Tệp đính kèm được giữ trong Google Drive riêng tư và truy cập thông qua API của máy chủ cùng Apps Script Gateway. OneSignal **chưa tích hợp**.

## Quy tắc chính

- Gmail lần đầu đăng nhập chỉ gửi yêu cầu chờ phê duyệt. Quản trị viên phê duyệt/từ chối; không cho người chưa được duyệt sử dụng công việc, báo cáo hoặc tệp.
- Trang **Công việc của tôi**, **Trang chủ** và **Báo cáo** luôn chỉ xem công việc của chính tài khoản đang đăng nhập, ngay cả khi tài khoản đó là quản trị viên. Dữ liệu chung nằm riêng trong khu vực Quản trị.
- Sửa công việc cần lý do và ghi lịch sử. Chỉ quản trị viên được xóa công việc. Quyền kiểm tra ở máy chủ và Firestore Rules, không chỉ ẩn nút.
- Danh mục quản lý tập trung. 5 nhóm: Lương, BHXH, Thuế, Các nội dung khác, Học nghề.
- Giao diện sử dụng tiếng Việt tự nhiên; mã kỹ thuật chỉ xuất hiện trong source/log.

## Cấu trúc dễ quản lý

`src/app/` chứa các trang và đường dẫn API bắt buộc của Next.js; `src/components/` chứa giao diện; `src/lib/` chứa các hàm dùng chung; `appscript/DriveGateway.gs` là bản source tham khảo của cổng Drive (di chuyển đường dẫn trong GitHub **không** tự triển khai Apps Script); `docs/` là hướng dẫn và lịch sử bàn giao.

**Không cần vào từng thư mục sâu trên GitHub.** Khi nhận PATCH mới, giải nén ZIP ở ngoài thư mục repository và chạy `APPLY-PATCH-WINDOWS.cmd` theo `UPDATE-GUIDE.txt`.

## Kiểm tra bắt buộc trước khi đưa lên GitHub

Cài Node.js 22 hoặc mới hơn, chạy `npm install` lần đầu (hoặc `npm ci` nếu repository đã có `package-lock.json`). Sau đó:

```bash
npm run preflight
npm run typecheck
npm run build
```

Nếu lệnh nào lỗi: **không push**. Chỉ push khi tất cả hoàn tất; sau đó kiểm tra Vercel `Ready`, triển khai chỉ mục Firestore theo `docs/FIRESTORE-DEPLOY.txt` và kiểm thử thực tế theo `docs/FINAL-VERIFICATION.md`.

Không commit `.env.local`, private key, service account JSON, shared secret hoặc token. Vercel giữ cấu hình bí mật đã được nhập riêng. Không thêm OneSignal ở phiên bản này.
