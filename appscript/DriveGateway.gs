/**
 * THEO DÕI CÔNG VIỆC & BÁO CÁO - DRIVE GATEWAY
 * Version 1.0.0
 *
 * Script Properties bắt buộc:
 * - DRIVE_FOLDER_ID
 * - APP_SHARED_SECRET
 * - WEB_APP_URL (chỉ dùng test nội bộ)
 * - TEST_FILE_ID (chỉ dùng test đọc file)
 */

const APP_CONFIG = Object.freeze({
  VERSION: '1.0.0',
  ROOT_FOLDER_PROPERTY: 'DRIVE_FOLDER_ID',
  SECRET_PROPERTY: 'APP_SHARED_SECRET',
  MAX_FILE_BYTES: 3 * 1024 * 1024,
  REQUEST_CACHE_SECONDS: 6 * 60 * 60,
  MAX_FILE_NAME_LENGTH: 180,
  MAX_FOLDER_DEPTH_CHECK: 40
});

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'theo-doi-cong-viec-drive-gateway',
    version: APP_CONFIG.VERSION,
    status: 'ready',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    const request = parseJsonRequest_(e);
    authenticateRequest_(request);
    const action = String(request.action || '').trim().toLowerCase();
    if (action === 'ping') return jsonResponse_({ ok: true, status: 'ready', version: APP_CONFIG.VERSION });
    if (action === 'upload') return jsonResponse_(handleUpload_(request));
    if (action === 'getfile') return jsonResponse_(handleGetFile_(request));
    throw appError_('INVALID_ACTION', 'Action không hợp lệ.');
  } catch (error) {
    return jsonResponse_({ ok: false, error: normalizeError_(error), timestamp: new Date().toISOString() });
  }
}

function handleUpload_(request) {
  const requestId = requireString_(request.requestId, 'requestId');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'upload:' + requestId;
  const cached = cache.get(cacheKey);
  if (cached) {
    const previous = JSON.parse(cached);
    previous.deduplicated = true;
    return previous;
  }

  if (!request.file || typeof request.file !== 'object') throw appError_('FILE_REQUIRED', 'Không tìm thấy dữ liệu file.');
  const fileName = sanitizeFileName_(requireString_(request.file.name, 'file.name'));
  validateFileExtension_(fileName);
  const mimeType = String(request.file.mimeType || 'application/octet-stream').trim();
  const bytes = decodeBase64_(stripDataUrlPrefix_(requireString_(request.file.base64, 'file.base64')));
  if (!bytes.length) throw appError_('EMPTY_FILE', 'File không có dữ liệu.');
  if (bytes.length > APP_CONFIG.MAX_FILE_BYTES) throw appError_('FILE_TOO_LARGE', 'File vượt quá dung lượng tối đa 3 MB.');

  const meta = request.meta && typeof request.meta === 'object' ? request.meta : {};
  const targetFolder = resolveTargetFolder_(getRootFolder_(), meta);
  const file = targetFolder.createFile(Utilities.newBlob(bytes, mimeType, fileName));
  const sha256 = sha256Hex_(bytes);

  try {
    file.setDescription(JSON.stringify({
      application: 'Theo doi cong viec & Bao cao',
      requestId,
      ownerId: safeMetaString_(meta.ownerId),
      workRecordId: safeMetaString_(meta.workRecordId),
      workType: safeMetaString_(meta.workType),
      workDate: safeMetaString_(meta.workDate),
      sha256,
      uploadedAt: new Date().toISOString()
    }));
  } catch (_) {}

  const result = {
    ok: true,
    action: 'upload',
    file: {
      fileId: file.getId(),
      fileName: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      sha256
    },
    storage: { folderId: targetFolder.getId() },
    requestId,
    deduplicated: false,
    uploadedAt: new Date().toISOString()
  };
  try { cache.put(cacheKey, JSON.stringify(result), APP_CONFIG.REQUEST_CACHE_SECONDS); } catch (_) {}
  return result;
}

function handleGetFile_(request) {
  const fileId = requireString_(request.fileId, 'fileId');
  const rootFolder = getRootFolder_();
  let file;
  try { file = DriveApp.getFileById(fileId); }
  catch (_) { throw appError_('FILE_NOT_FOUND', 'Không tìm thấy file.'); }
  if (!isFileInsideRoot_(file, rootFolder.getId())) throw appError_('FILE_OUTSIDE_APPLICATION_FOLDER', 'File không thuộc vùng lưu trữ của ứng dụng.');
  const bytes = file.getBlob().getBytes();
  if (bytes.length > APP_CONFIG.MAX_FILE_BYTES) throw appError_('FILE_TOO_LARGE_TO_PROXY', 'File quá lớn để xem qua cổng ứng dụng hiện tại.');
  return {
    ok: true,
    action: 'getFile',
    file: {
      fileId: file.getId(),
      fileName: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      sha256: sha256Hex_(bytes),
      base64: Utilities.base64Encode(bytes)
    },
    timestamp: new Date().toISOString()
  };
}

function resolveTargetFolder_(rootFolder, meta) {
  const category = normalizeWorkTypeFolder_(meta.workType);
  const year = getWorkYear_(meta.workDate);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return getOrCreateFolder_(getOrCreateFolder_(rootFolder, category), year);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function normalizeWorkTypeFolder_(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const map = {
    salary: 'LUONG', luong: 'LUONG', 'lương': 'LUONG',
    bhxh: 'BHXH',
    tax: 'THUE', thue: 'THUE', 'thuế': 'THUE',
    other: 'KHAC', khac: 'KHAC', 'khác': 'KHAC',
    vocational: 'HOC_NGHE', hoc_nghe: 'HOC_NGHE', 'học_nghề': 'HOC_NGHE'
  };
  return map[raw] || 'TAI_LIEU';
}

function getWorkYear_(workDate) {
  const match = String(workDate || '').trim().match(/^(\d{4})-\d{2}-\d{2}$/);
  return match ? match[1] : String(new Date().getFullYear());
}

function getOrCreateFolder_(parent, name) {
  const safe = sanitizeFolderName_(name);
  const list = parent.getFoldersByName(safe);
  return list.hasNext() ? list.next() : parent.createFolder(safe);
}

function getRootFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty(APP_CONFIG.ROOT_FOLDER_PROPERTY);
  if (!id) throw appError_('DRIVE_FOLDER_NOT_CONFIGURED', 'Chưa cấu hình DRIVE_FOLDER_ID.');
  try { return DriveApp.getFolderById(id); }
  catch (_) { throw appError_('INVALID_DRIVE_FOLDER', 'Không truy cập được thư mục Google Drive đã cấu hình.'); }
}

function isFileInsideRoot_(file, rootFolderId) {
  const queue = [];
  const seen = {};
  const parents = file.getParents();
  while (parents.hasNext()) queue.push(parents.next());
  let checked = 0;
  while (queue.length && checked++ < APP_CONFIG.MAX_FOLDER_DEPTH_CHECK) {
    const folder = queue.shift();
    const id = folder.getId();
    if (id === rootFolderId) return true;
    if (seen[id]) continue;
    seen[id] = true;
    const p = folder.getParents();
    while (p.hasNext()) queue.push(p.next());
  }
  return false;
}

function authenticateRequest_(request) {
  const expected = PropertiesService.getScriptProperties().getProperty(APP_CONFIG.SECRET_PROPERTY);
  if (!expected) throw appError_('SECRET_NOT_CONFIGURED', 'Chưa cấu hình APP_SHARED_SECRET.');
  const supplied = String(request.secret || '');
  if (!supplied || !constantTimeEqual_(supplied, expected)) throw appError_('UNAUTHORIZED', 'Request không được phép.');
}

function constantTimeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) diff |= (i < a.length ? a.charCodeAt(i) : 0) ^ (i < b.length ? b.charCodeAt(i) : 0);
  return diff === 0;
}

function validateFileExtension_(name) {
  const allowed = ['pdf','xls','xlsx','doc','docx','csv','txt','jpg','jpeg','png','webp','heic'];
  if (allowed.indexOf(getExtension_(name)) === -1) throw appError_('FILE_TYPE_NOT_ALLOWED', 'Định dạng file không được hỗ trợ.');
}
function getExtension_(name) { const i = name.lastIndexOf('.'); return i < 0 ? '' : name.substring(i + 1).toLowerCase(); }
function sanitizeFileName_(name) {
  let v = String(name || '').trim().replace(/[\\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ');
  if (!v) throw appError_('INVALID_FILE_NAME', 'Tên file không hợp lệ.');
  if (v.length > APP_CONFIG.MAX_FILE_NAME_LENGTH) {
    const ext = getExtension_(v); const suffix = ext ? '.' + ext : '';
    v = v.substring(0, APP_CONFIG.MAX_FILE_NAME_LENGTH - suffix.length) + suffix;
  }
  return v;
}
function sanitizeFolderName_(value) { return (String(value || '').trim().replace(/[\\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, '_') || 'TAI_LIEU').substring(0,80); }
function stripDataUrlPrefix_(value) { return String(value || '').replace(/^data:[^;]+;base64,/i, ''); }
function decodeBase64_(value) {
  try { return Utilities.base64Decode(value); }
  catch (_) { try { return Utilities.base64DecodeWebSafe(value); } catch (_) { throw appError_('INVALID_BASE64', 'Dữ liệu file không hợp lệ.'); } }
}
function sha256Hex_(bytes) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(b => ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2)).join(''); }
function parseJsonRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) throw appError_('EMPTY_REQUEST', 'Request không có dữ liệu.');
  try { const data = JSON.parse(e.postData.contents); if (!data || typeof data !== 'object') throw new Error(); return data; }
  catch (_) { throw appError_('INVALID_JSON', 'Request JSON không hợp lệ.'); }
}
function jsonResponse_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function requireString_(value, name) { const v = String(value || '').trim(); if (!v) throw appError_('FIELD_REQUIRED', 'Thiếu trường bắt buộc: ' + name); return v; }
function safeMetaString_(value) { return String(value || '').trim().substring(0,500); }
function appError_(code, message) { const error = new Error(message); error.appCode = code; return error; }
function normalizeError_(error) { return { code: error && error.appCode ? error.appCode : 'INTERNAL_ERROR', message: error && error.message ? error.message : 'Đã xảy ra lỗi không xác định.' }; }

function testConfiguration() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DRIVE_FOLDER_ID');
  const secret = props.getProperty('APP_SHARED_SECRET');
  if (!folderId) throw new Error('Thiếu DRIVE_FOLDER_ID');
  if (!secret || secret.length < 32) throw new Error('APP_SHARED_SECRET nên có tối thiểu 32 ký tự.');
  const folder = DriveApp.getFolderById(folderId);
  Logger.log('===== DRIVE GATEWAY TEST =====');
  Logger.log('Version: ' + APP_CONFIG.VERSION);
  Logger.log('Folder ID: ' + folder.getId());
  Logger.log('Folder name: ' + folder.getName());
  Logger.log('Shared secret: CONFIGURED');
  Logger.log('Status: OK');
}

function testWebAppUpload() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEB_APP_URL');
  const secret = props.getProperty('APP_SHARED_SECRET');
  if (!url || !secret) throw new Error('Thiếu WEB_APP_URL hoặc APP_SHARED_SECRET.');
  const bytes = Utilities.newBlob('File kiểm thử ứng dụng Theo dõi công việc & Báo cáo\nThời gian: ' + new Date().toISOString(), 'text/plain', 'kiem-tra-drive.txt').getBytes();
  const payload = { secret, action:'upload', requestId:'TEST-'+Date.now()+'-'+Utilities.getUuid(), file:{name:'kiem-tra-drive.txt',mimeType:'text/plain',base64:Utilities.base64Encode(bytes)}, meta:{ownerId:'TEST_ADMIN',workRecordId:'TEST_RECORD',workType:'bhxh',workDate:Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd')} };
  const response = UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true,followRedirects:true});
  Logger.log('HTTP status: ' + response.getResponseCode());
  Logger.log('Response: ' + response.getContentText());
}

function testWebAppGetFile() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEB_APP_URL');
  const secret = props.getProperty('APP_SHARED_SECRET');
  const fileId = props.getProperty('TEST_FILE_ID');
  if (!url || !secret || !fileId) throw new Error('Thiếu WEB_APP_URL, APP_SHARED_SECRET hoặc TEST_FILE_ID.');
  const response = UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify({secret,action:'getFile',fileId}),muteHttpExceptions:true,followRedirects:true});
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error(JSON.stringify(result));
  const bytes = Utilities.base64Decode(result.file.base64);
  if (sha256Hex_(bytes) !== result.file.sha256) throw new Error('SHA-256 không khớp.');
  Logger.log('===== GET FILE TEST OK =====');
  Logger.log('File name: ' + result.file.fileName);
  Logger.log('Size: ' + result.file.size);
  Logger.log('SHA-256 verified: YES');
}
