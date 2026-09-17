# Cài đặt và phát hành v1.2.0

1. Sao lưu repository đang chạy. Giữ nguyên các biến bí mật trên Vercel. Không gửi chúng trong chat.
2. Lần đầu trên máy: cài Node.js 22+, GitHub Desktop, tải source và chạy `npm install` trong root project. Nếu có lockfile dùng `npm ci`.
3. Chạy `npm run preflight`, `npm run typecheck`, `npm run build`. Bất kỳ bước nào lỗi thì dừng, đọc lỗi và sửa trước khi commit.
4. Trên Vercel kiểm tra `NEXT_PUBLIC_APP_VERSION=1.2.0`. Không thay Firebase client config đang hoạt động hoặc server secrets.
5. Cập nhật bằng GitHub Desktop: một commit, một Push lên `main`. Chờ Vercel `Ready`.
6. **Chỉ mục Firestore đã thay đổi**. Triển khai bằng lệnh trong `FIRESTORE-DEPLOY.txt`, đợi chỉ mục chuyển `Enabled` trước khi thử tính năng tài khoản mới.
7. Kiểm thử bằng Gmail khác tài khoản quản trị. Xác nhận chờ duyệt, phê duyệt, từ chối, báo cáo cá nhân, dữ liệu chung, tệp và thông báo.
8. Nếu lỗi: dừng thao tác reset/xóa dữ liệu; dùng GitHub Desktop hoàn nguyên commit hoặc triển khai lại commit cũ; triển khai lại chỉ mục/rules cũ nếu thực sự đã thay đổi. Không xóa dữ liệu Firestore để chữa lỗi build.

`appscript/DriveGateway.gs` chỉ được chuyển thư mục GitHub; **không cần triển khai lại Web App** khi script chưa có thay đổi nội dung.
