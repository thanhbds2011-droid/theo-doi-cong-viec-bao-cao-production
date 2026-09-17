import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];
const forbiddenNames = [
  /^\.env$/i,
  /^\.env\.local$/i,
  /service[-_]?account.*\.json$/i,
  /firebase[-_]?admin.*\.json$/i,
  /private[-_]?key/i,
  /^credentials.*\.json$/i
];
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".txt", ".yml", ".yaml", ".env", ".example", ".rules", ".gs"]);
const secretPatterns = [
  { name: "Private key", re: /-----BEGIN PRIVATE KEY-----[\s\S]{80,}-----END PRIVATE KEY-----/ },
  { name: "Google service account private_key field", re: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/ },
  { name: "Hard-coded APP_SHARED_SECRET", re: /APP_SHARED_SECRET\s*[=:]\s*["'](?!YOUR_|\[|<)[^"']{24,}["']/ }
];

const requiredFiles = [
  ".firebaserc",
  ".gitignore",
  ".env.example",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "src/app/admin/categories/page.tsx",
  "src/app/api/auth/bootstrap/route.ts",
  "src/app/api/work-records/route.ts",
  "src/app/api/work-records/[id]/route.ts",
  "src/app/api/files/upload/route.ts",
  "src/app/api/files/[id]/route.ts",
  "src/app/api/notifications/[id]/read/route.ts",
  "src/app/api/notifications/read-all/route.ts"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) problems.push(`Thiếu file bắt buộc: ${file}`);
}

for (const bad of ["download", "download (1)", "env.example", "src/app/admin/categories/route.ts"]) {
  if (fs.existsSync(path.join(root, bad))) problems.push(`File sai/không cần thiết còn tồn tại: ${bad}`);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (["secret", "secrets", "private"].includes(entry.name.toLowerCase())) problems.push(`Thư mục có nguy cơ chứa secret: ${rel}/`);
      const names = new Set(fs.readdirSync(full));
      if (names.has("page.tsx") && names.has("route.ts")) problems.push(`Next.js page/route collision: ${rel}`);
      walk(full);
      continue;
    }

    if (entry.name === "route" && rel.startsWith("src/app/")) problems.push(`Placeholder route không có đuôi: ${rel}`);
    if (forbiddenNames.some((pattern) => pattern.test(entry.name))) problems.push(`File secret-like: ${rel}`);

    const ext = path.extname(entry.name).toLowerCase();
    if (!textExtensions.has(ext) && !entry.name.startsWith(".env")) continue;
    let text = "";
    try { text = fs.readFileSync(full, "utf8"); } catch { continue; }
    for (const item of secretPatterns) {
      if (item.re.test(text)) problems.push(`${rel}: phát hiện ${item.name}`);
    }
  }
}

walk(root);

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.dependencies?.["firebase-admin"] !== "13.10.0") {
    problems.push(`firebase-admin phải giữ 13.10.0; hiện tại: ${pkg.dependencies?.["firebase-admin"] || "thiếu"}`);
  }
} catch (error) {
  problems.push(`Không đọc được package.json: ${error.message}`);
}

if (problems.length) {
  console.error("Preflight FAILED:");
  problems.forEach((item) => console.error(` - ${item}`));
  process.exit(1);
}

console.log("Preflight OK: cấu trúc route/dotfiles/secret/package đã đạt kiểm tra cơ bản.");
