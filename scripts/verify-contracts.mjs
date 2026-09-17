import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const exists = (name) => fs.existsSync(path.join(root, name));
const pages = ["dashboard", "work", "work/new", "reports", "notifications", "profile", "admin", "admin/users", "admin/data", "admin/categories", "admin/audit", "admin/reports"];
for (const page of pages) if (!exists(`src/app/${page}/page.tsx`)) problems.push(`Thiếu trang: /${page}`);
const routes = {
  "auth/bootstrap": ["POST"], "work-records": ["POST"], "work-records/[id]": ["GET", "PATCH", "DELETE"],
  "files/upload": ["POST"], "files/[id]": ["GET"],
  "notifications/[id]/read": ["POST"], "notifications/read-all": ["POST"],
  "admin/users": ["GET"], "admin/users/[uid]": ["PATCH"],
  "admin/categories": ["POST"], "admin/categories/[id]": ["PATCH"],
  "admin/categories/seed": ["POST"], "admin/reset": ["POST"]
};
for (const [route, methods] of Object.entries(routes)) {
  const name = `src/app/api/${route}/route.ts`;
  if (!exists(name)) { problems.push(`Thiếu API ${name}`); continue; }
  const content = read(name);
  for (const method of methods) if (!new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`).test(content)) problems.push(`Thiếu ${method} tại ${name}`);
  if (route !== "auth/bootstrap" && !/requireActiveUser\(|requireAdmin\(/.test(content)) problems.push(`API chưa thấy kiểm tra tài khoản: ${name}`);
}
for (const page of ["work/page.tsx", "reports/page.tsx", "dashboard/page.tsx"]) {
  if (!/role:\s*["']employee["']/.test(read(`src/app/${page}`))) problems.push(`Trang cá nhân chưa khóa truy vấn chỉ theo chủ sở hữu: ${page}`);
}
const userApi = read("src/app/api/admin/users/[uid]/route.ts");
for (const action of ["approve", "reject", "disable", "enable", "rename", "change_role"]) {
  if (!userApi.includes(`"${action}"`)) problems.push(`Thiếu hành động tài khoản ${action}`);
}
if (!/transaction\.create\(logRef/.test(userApi)) problems.push("Cập nhật tài khoản chưa có nhật ký trong giao dịch");
if (!read("src/app/api/auth/bootstrap/route.ts").includes('status: isInitialAdmin ? "active" : "pending"')) problems.push("Gmail mới chưa mặc định chờ duyệt");
if (!read("src/app/api/auth/bootstrap/route.ts").includes('current.status === "pending"')) problems.push("Cơ chế khôi phục quản trị viên chưa giới hạn vào tài khoản chờ");
if (read("src/app/admin/users/page.tsx").includes('<select value={status}')) problems.push("Trang quản trị còn chọn trạng thái bằng menu kỹ thuật");
const ruleText = read("firestore.rules");
if (!ruleText.includes("allow write: if false;") || !ruleText.includes("resource.data.ownerUid == request.auth.uid")) problems.push("Không thấy giới hạn ghi và quyền đọc bản ghi trong Rules");
if (!/allow read:\s*if active\(\) && resource\.data\.recipientUid == request\.auth\.uid;/.test(ruleText)) problems.push("Rules thông báo phải giới hạn người nhận, kể cả admin");
if (!/match \/files\/\{fileId\}[\s\S]*?allow read, write: if false;/.test(ruleText)) problems.push("Rules metadata files phải chặn client trực tiếp");
const readNotificationRoute = read("src/app/api/notifications/[id]/read/route.ts");
if (!readNotificationRoute.includes('data.recipientUid !== profile.uid)') || readNotificationRoute.includes('profile.role !== "admin"')) problems.push("API mark-read còn cho admin sửa thông báo người khác");
const indexes = JSON.parse(read("firestore.indexes.json"));
if (!indexes.indexes.some((x) => x.collectionGroup === "users" && x.fields.map((f) => f.fieldPath).join(",") === "role,status")) problems.push("Thiếu chỉ mục danh sách quản trị viên hoạt động");
for (const f of ["package.json", "firebase.json", "public/manifest.webmanifest"]) JSON.parse(read(f));
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    if (item.name === "node_modules" || item.name === ".next") continue;
    const full = path.join(dir,item.name);
    if (item.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(item.name)) files.push(full);
  }
}
walk(path.join(root,"src"));
for (const file of files) {
  const text = fs.readFileSync(file,"utf8");
  for (const match of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    const spec = match[1];
    if (!spec.startsWith("@/") && !spec.startsWith(".")) continue;
    const absolute = spec.startsWith("@/") ? path.join(root,"src",spec.slice(2)) : path.resolve(path.dirname(file),spec);
    const possible = [absolute,`${absolute}.ts`,`${absolute}.tsx`,`${absolute}.js`,path.join(absolute,"index.ts"),path.join(absolute,"index.tsx")];
    if (!possible.some(fs.existsSync)) problems.push(`Import nội bộ không tồn tại: ${path.relative(root,file)} → ${spec}`);
  }
}
if (problems.length) {console.error(`VERIFY CONTRACTS FAIL: ${problems.length} vấn đề`); for(const x of problems) console.error(` - ${x}`);process.exit(1);}
console.log(`VERIFY CONTRACTS PASS: ${pages.length} trang, ${Object.keys(routes).length} nhóm API, ${files.length} mã TS/TSX; giới hạn truy cập cá nhân, hành động tài khoản và Rules/Indexes đã có cấu trúc cần thiết.`);
