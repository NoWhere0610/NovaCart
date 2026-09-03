/* ============================================================================
   PHIÊN CHAT + HỎI-ĐÁP RAG. Mount /api/chat.
   Port từ apsp-ioc-react/routes/chatSession.js (2026-08-04) — file GẦN NHƯ SẠCH
   nhất trong CoreX gốc, ít phụ thuộc đặc thù nhất. Khác biệt duy nhất: CoreX suy
   "chủ sở hữu phiên chat" từ JWT (req.user.username sau requireAuth đăng nhập
   thật) — kit này xác thực bằng API key tĩnh (server-to-server), nên `userId`
   PHẢI do dự án chủ quản tự truyền lên (body/query) để nhóm đúng lịch sử chat
   theo từng người dùng cuối của HỌ. Không xác thực thêm gì userId đó — dự án
   chủ quản tự chịu trách nhiệm định danh đúng (đã xác thực bằng API key ở tầng
   ngoài, xem middleware/apiKeyAuth.js + server.js).
   ============================================================================ */
const express = require('express');
const vectorStore = require('../lib/vectorStore');
const ragQuery = require('../lib/ragQuery');

const router = express.Router();

/**
 * Trả lỗi cho client mà KHÔNG kèm e.message.
 *
 * Trước đây mọi catch đều trả thẳng `message: e.message` — tức thông điệp thô của driver Postgres — và
 * chuỗi đó đi nguyên vẹn qua Java (ChatService.messageOrDefault) rồi hiển thị trong bong bóng chat của
 * khách. Tắt container Postgres rồi hỏi bot bất kỳ câu gì là khách đọc được "connect ECONNREFUSED
 * 127.0.0.1:5434"; gửi sessionId không phải UUID là đọc được 'invalid input syntax for type uuid'.
 * Chi tiết kỹ thuật giữ lại ở console cho người phát triển, client chỉ nhận thông điệp trung tính.
 */
function fail(res, e, viTri) {
  console.error(`  [chat] lỗi tại ${viTri}:`, e);
  return res.status(500).json({ ok: false, message: 'Dịch vụ tư vấn đang gặp sự cố. Vui lòng thử lại sau ít phút.' });
}

// chat_session.id là UUID -- truyền chuỗi bất kỳ vào WHERE id = $1 sẽ khiến Postgres ném lỗi kiểu dữ
// liệu. Chặn từ đầu để coi như "không có phiên" (tạo phiên mới) thay vì để rơi xuống catch.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUserId(req, res, next) {
  const userId = req.body?.userId || req.query?.userId;
  if (!userId) return res.status(400).json({ ok: false, message: 'Thiếu "userId" (định danh người dùng cuối do dự án gọi tự truyền lên).' });
  req.userId = String(userId);
  next();
}

async function ownedSession(sessionId, userId) {
  if (!UUID_PATTERN.test(String(sessionId || ''))) return null;
  const r = await vectorStore.query('SELECT * FROM chat_session WHERE id = $1', [sessionId]);
  const s = r.rows[0];
  if (!s || s.user_id !== userId) return null;
  return s;
}

router.get('/sessions', requireUserId, async (req, res) => {
  try {
    const { namespace } = req.query;
    if (!namespace) return res.status(400).json({ ok: false, message: 'Thiếu "namespace".' });
    const r = await vectorStore.query(
      `SELECT id, tieu_de, created_at FROM chat_session WHERE namespace = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [namespace, req.userId],
    );
    res.json({ ok: true, sessions: r.rows });
  } catch (e) {
    return fail(res, e, req.method + ' ' + req.originalUrl);
  }
});

router.post('/sessions', requireUserId, async (req, res) => {
  try {
    const { namespace } = req.body || {};
    if (!namespace) return res.status(400).json({ ok: false, message: 'Thiếu "namespace".' });
    const r = await vectorStore.query(
      `INSERT INTO chat_session (namespace, user_id) VALUES ($1,$2) RETURNING id, tieu_de, created_at`,
      [namespace, req.userId],
    );
    res.json({ ok: true, session: r.rows[0] });
  } catch (e) {
    return fail(res, e, req.method + ' ' + req.originalUrl);
  }
});

router.get('/sessions/:id/messages', requireUserId, async (req, res) => {
  try {
    const s = await ownedSession(req.params.id, req.userId);
    if (!s) return res.status(404).json({ ok: false, message: 'Không tìm thấy phiên chat.' });
    const r = await vectorStore.query(
      `SELECT id, vai_tro, noi_dung, nguon_trich_dan, danh_gia, created_at FROM chat_message WHERE session_id = $1 ORDER BY created_at, id`,
      [req.params.id],
    );
    res.json({ ok: true, session: s, messages: r.rows });
  } catch (e) {
    return fail(res, e, req.method + ' ' + req.originalUrl);
  }
});

// Xoá 1 đoạn chat (kéo theo tin nhắn qua CASCADE) — chỉ chủ sở hữu mới xoá được.
router.delete('/sessions/:id', requireUserId, async (req, res) => {
  try {
    const s = await ownedSession(req.params.id, req.userId);
    if (!s) return res.json({ ok: true }); // đã không còn (hoặc không phải của mình) — coi như xoá xong
    await vectorStore.query('DELETE FROM chat_session WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    return fail(res, e, req.method + ' ' + req.originalUrl);
  }
});

// Chấm like/dislike cho 1 câu trả lời — chỉ chủ sở hữu phiên chat chứa tin nhắn đó mới chấm được.
router.patch('/messages/:id/feedback', requireUserId, async (req, res) => {
  try {
    const danhGia = req.body && req.body.danhGia;
    if (danhGia !== 1 && danhGia !== -1 && danhGia !== null) return res.status(400).json({ ok: false, message: 'danhGia phải là 1, -1 hoặc null.' });
    const r = await vectorStore.query(
      `SELECT m.id FROM chat_message m JOIN chat_session s ON s.id = m.session_id
       WHERE m.id = $1 AND m.vai_tro = 'bot' AND s.user_id = $2`,
      [req.params.id, req.userId],
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, message: 'Không tìm thấy tin nhắn (hoặc không phải của bạn).' });
    await vectorStore.query('UPDATE chat_message SET danh_gia = $2 WHERE id = $1', [req.params.id, danhGia]);
    res.json({ ok: true });
  } catch (e) {
    return fail(res, e, req.method + ' ' + req.originalUrl);
  }
});

router.post('/ask', requireUserId, async (req, res) => {
  const { namespace, sessionId, question, allowedFolders } = req.body || {};
  if (!namespace) return res.status(400).json({ ok: false, message: 'Thiếu "namespace".' });
  const q = String(question || '').trim();
  if (!q) return res.status(400).json({ ok: false, message: 'Thiếu câu hỏi.' });

  try {
    let session = sessionId ? await ownedSession(sessionId, req.userId) : null;
    if (!session) {
      const r = await vectorStore.query(`INSERT INTO chat_session (namespace, user_id) VALUES ($1,$2) RETURNING *`, [namespace, req.userId]);
      session = r.rows[0];
    }

    // Hỏi TRƯỚC rồi mới lưu câu hỏi vào chat_message — ragQuery.askQuestion tự đọc lịch sử hội thoại
    // theo session.id để ghép ngữ cảnh câu hỏi nối tiếp; nếu lưu câu hỏi trước, "tin nhắn user gần nhất"
    // mà nó đọc lại sẽ chính LÀ câu hỏi hiện tại (không phải câu hỏi trước đó), hỏng logic ghép ngữ cảnh.
    const result = await ragQuery.askQuestion({ namespace, userId: req.userId, question: q, sessionId: session.id, allowedFolders: allowedFolders || null });

    // Lượt hỏi THẤT BẠI (Gemini quá hạn chờ/429/chưa cấu hình key) thì KHÔNG lưu gì cả.
    //
    // Bản trước lưu tin của khách trước khi kiểm result.ok, nên mỗi lần lỗi để lại 1 tin user mồ côi
    // không có câu trả lời đi kèm. Sau vài lần lỗi liên tiếp, lịch sử là "Người dùng: A / Người dùng: B /
    // Người dùng: C" -- một đoạn hội thoại một chiều bất thường được nối thẳng vào prompt, đồng thời câu
    // chưa từng được trả lời đó bị ghép vào searchText làm loãng vector truy vấn của lượt sau, và chiếm
    // chỗ trong số tin nhắn ghi nhớ. Giữ bất biến: chat_message chỉ chứa các CẶP hỏi-đáp hoàn chỉnh.
    if (!result.ok) return res.json({ ok: false, sessionId: session.id, reason: result.reason, message: result.message });

    if (!session.tieu_de) {
      await vectorStore.query(`UPDATE chat_session SET tieu_de = $2 WHERE id = $1`, [session.id, q.slice(0, 60)]);
    }
    // Ghi cả cặp trong 1 câu lệnh -> hoặc có đủ, hoặc không có gì; thứ tự trong phiên do cột id quyết
    // định (2 dòng có thể trùng created_at tới từng micro giây).
    const ins = await vectorStore.query(
      `INSERT INTO chat_message (session_id, vai_tro, noi_dung, nguon_trich_dan, tra_loi_duoc)
       VALUES ($1,'user',$2,NULL,NULL), ($1,'bot',$3,$4,$5) RETURNING id, vai_tro`,
      [session.id, q, result.answer, result.sources, result.answered],
    );
    const botRow = ins.rows.find((row) => row.vai_tro === 'bot') || ins.rows[ins.rows.length - 1];
    res.json({ ok: true, sessionId: session.id, messageId: botRow.id, answer: result.answer, sources: result.sources });
  } catch (e) {
    return fail(res, e, req.method + ' ' + req.originalUrl);
  }
});

module.exports = router;
