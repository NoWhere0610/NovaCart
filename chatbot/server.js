/* ============================================================================
   RAG Chatbot Kit — máy chủ Express. Dịch vụ tái dùng: kho tri thức (upload
   tài liệu -> chia đoạn -> nhúng vector) + hỏi-đáp có nhớ ngữ cảnh phiên chat.
   Xác thực bằng API key tĩnh (server-to-server) — xem README.md.
   ============================================================================ */
require('dotenv').config();
const path = require('path');
const express = require('express');
const { requireApiKey } = require('./middleware/apiKeyAuth');
const scheduler = require('./lib/scheduler');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Trang demo tĩnh (public/demo.html) — KHÔNG cần API key để tải trang (chính trang mới cần nhập key
// vào ô để gọi API), phục vụ file tĩnh bình thường.
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Toàn bộ API nghiệp vụ đều yêu cầu X-API-Key — mount middleware NGAY TRƯỚC 2 router, không rải rác
// từng route riêng lẻ (khác CoreX gốc vốn có auth.canUser() chi tiết theo từng hành động/vai trò).
app.use('/api/kb', requireApiKey, require('./routes/knowledgeBase'));
app.use('/api/chat', requireApiKey, require('./routes/chatSession'));

app.use((err, _req, res, _next) => {
  console.error('  [server] lỗi ngoài ý muốn:', err);
  res.status(500).json({ ok: false, message: 'Lỗi máy chủ.' });
});

const PORT = Number(process.env.PORT) || 3200;
app.listen(PORT, () => {
  console.log(`  [server] RAG Chatbot Kit đang chạy tại http://127.0.0.1:${PORT} (demo: /demo.html)`);
  scheduler.start();
});
