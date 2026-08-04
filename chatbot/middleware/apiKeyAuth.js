/* ============================================================================
   XÁC THỰC — 1 API key tĩnh qua .env, dùng cho service GỌI NỘI BỘ (server-to-
   server) từ ĐÚNG 1 dự án chủ quản. KHÔNG có khái niệm user/vai trò/đăng nhập —
   khác hẳn apsp-ioc-react/auth.js (hệ JWT + role catalog phức tạp), vì kit này
   chỉ phục vụ 1 hệ thống gọi vào, không cần phân biệt NHIỀU người dùng cuối ở
   tầng xác thực (userId của người dùng cuối do dự án chủ quản tự truyền lên
   trong body/query, xem routes/chatSession.js — không xác thực gì thêm, dự án
   chủ quản tự chịu trách nhiệm định danh đúng).
   ============================================================================ */

function requireApiKey(req, res, next) {
  const expected = String(process.env.API_KEY || '').trim();
  if (!expected) {
    // Chưa cấu hình API_KEY -> chặn hẳn thay vì âm thầm cho qua (an toàn hơn "quên set key = mở toang").
    return res.status(500).json({ ok: false, message: 'Server chưa cấu hình API_KEY.' });
  }
  const got = String(req.headers['x-api-key'] || '').trim();
  if (got !== expected) {
    return res.status(401).json({ ok: false, message: 'Thiếu hoặc sai X-API-Key.' });
  }
  next();
}

module.exports = { requireApiKey };
