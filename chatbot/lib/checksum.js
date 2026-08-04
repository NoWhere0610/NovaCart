/* ============================================================================
   "Dấu vân tay" nội dung (SHA-256) dùng chung cho pipeline ingest kho tri thức —
   so khớp trước khi quyết định có cần xoá + tạo lại embedding hay không. Nội
   dung giống hệt lần trước thì bỏ qua, tiết kiệm lượt gọi Gemini + thời gian.
   ============================================================================ */
const crypto = require('crypto');

/** `input`: string hoặc Buffer. Trả về chuỗi hex 64 ký tự — đủ ngắn để lưu cột TEXT, đủ khó để 2 nội
 * dung khác nhau tình cờ trùng nhau (va chạm SHA-256 coi như không xảy ra trong thực tế). */
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = { sha256 };
