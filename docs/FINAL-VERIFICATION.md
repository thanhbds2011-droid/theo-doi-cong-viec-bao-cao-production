# Kiểm tra bản ứng viên 1.2.1 (16/09/2026)

Nguồn: file ZIP GitHub người dùng vừa upload `theo-doi-cong-viec-bao-cao-main (1).zip`.
Đối chiếu: 64 file trùng đường dẫn của ZIP upload và FULL SOURCE CLEAN 1.2.0 có nội dung giống hệt nhau. Sử dụng CLEAN 1.2.0 làm nền để loại bỏ file rác/route conflict.

Đã sửa: xung đột `/admin/categories` do route.ts sai vị trí (loại khỏi source), giới hạn quyền đọc thông báo chỉ người nhận ở cả Rules và API, khóa metadata files ở Rules; thay URL Apps Script trong mẫu env bằng placeholder, không sửa secret production.

Kiểm thử tĩnh: `npm run preflight`: PASS (12 trang, 13 nhóm API, 52 file TS/TSX); TS/TSX syntax transpile: 52 file, 0 lỗi; page/route collision: 0; JSON: 4 file hợp lệ; quét mẫu secret: không phát hiện thông tin bí mật thực. Đây là kiểm tra tĩnh, không phải build hoặc UAT.

CHƯA KIỂM THỬ/CHƯA ĐƯỢC CAM KẾT: npm install/typecheck/next build thực tế (npm cache thiếu package, không có node_modules); test truy cập Firebase với Gmail A/B; deployed Firestore Rules/Indexes; thực thi Drive Gateway; giao diện mobile.

QUY TẮC PHÁT HÀNH: Không upload bản này vào repository Public hoặc chuyển Vercel production cho đến khi chạy `npm install && npm run check && npm run build` đạt và được người dùng phê duyệt Firestore Rules/Indexes; quét lại toàn bộ secrets trước commit.
