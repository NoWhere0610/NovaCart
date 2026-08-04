/* ============================================================================
   KHO TRI THỨC — CRUD nhóm folder/tài liệu + pipeline ingest (trích xuất ->
   chia đoạn -> embedding -> lưu Postgres/pgvector). Mount /api/kb.
   Port từ apsp-ioc-react/routes/knowledgeBase.js (2026-08-04) — bỏ hết
   `auth.canUser`/`auth.audit`/`lib/dataPermResolve` (hệ vai trò + 4 mức mật
   riêng của CoreX): router này được mount SAU middleware `requireApiKey`
   (xem server.js) — có API key hợp lệ là đủ quyền thao tác, không phân cấp
   "xem" vs "thao tác" nữa. `nguoiTai` (ai tải file) do CALLER tự truyền lên
   (không có đăng nhập để suy ra), tuỳ chọn.
   ============================================================================ */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const vectorStore = require('../lib/vectorStore');
const embeddings = require('../lib/embeddings');
const { extractChunks } = require('../lib/textExtract');
const { sha256 } = require('../lib/checksum');

const router = express.Router();

const KB_DIR = path.join(__dirname, '..', 'kb-files'); // volume mount ngoài Docker — bền qua deploy, xem docker-compose.yml
fs.mkdirSync(KB_DIR, { recursive: true });

// memoryStorage (không ghi thẳng ra đĩa trong lúc parse) — multer gọi destination() ngay khi gặp field
// "file" trong luồng multipart, nhưng field "namespace"/"folderId" (text) có thể đứng SAU field file
// tùy client gửi thứ tự nào — dùng buffer rồi tự ghi đĩa Ở HANDLER (lúc đó req.body đã đủ).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB/file

/* ---------------- Nhóm folder ---------------- */
// Trả kèm LUÔN danh sách tài liệu của từng nhóm (json_agg, 1 câu truy vấn duy nhất) — tránh N+1 request
// (1 request cha + N request con mỗi lần liệt kê nhóm).
router.get('/folders', async (req, res) => {
  try {
    const namespace = req.query.namespace;
    if (!namespace) return res.status(400).json({ ok: false, message: 'Thiếu "namespace".' });
    const r = await vectorStore.query(
      `SELECT f.id, f.namespace, f.ten, f.nguon, f.mo_ta, f.dong_bo_tu_dong, f.tan_suat,
              COUNT(d.id) AS so_tai_lieu,
              COUNT(d.id) FILTER (WHERE d.trang_thai = 'xong') AS so_da_xong,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', d.id, 'ten_file', d.ten_file, 'loai', d.loai,
                    'trang_thai', d.trang_thai, 'loi', d.loi, 'nguoi_tai', d.nguoi_tai,
                    'cap_nhat_luc', d.cap_nhat_luc, 'created_at', d.created_at, 'mo_ta', d.mo_ta
                  ) ORDER BY d.created_at DESC
                ) FILTER (WHERE d.id IS NOT NULL), '[]'
              ) AS documents
       FROM kb_folder f LEFT JOIN kb_document d ON d.folder_id = f.id
       WHERE f.namespace = $1 GROUP BY f.id ORDER BY f.created_at`,
      [namespace],
    );
    res.json({ ok: true, folders: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post('/folders', async (req, res) => {
  try {
    const { namespace, id, ten, moTa } = req.body || {};
    if (!namespace) return res.status(400).json({ ok: false, message: 'Thiếu "namespace".' });
    if (!id || !/^[a-z0-9_-]{2,40}$/.test(id)) return res.status(400).json({ ok: false, message: 'Mã nhóm (id) 2-40 ký tự: chữ thường, số, - _' });
    if (!ten || !String(ten).trim()) return res.status(400).json({ ok: false, message: 'Thiếu tên nhóm.' });
    await vectorStore.query(
      `INSERT INTO kb_folder (id, namespace, ten, nguon, mo_ta) VALUES ($1,$2,$3,'file',$4)
       ON CONFLICT (id) DO UPDATE SET ten = excluded.ten, mo_ta = excluded.mo_ta`,
      [id, namespace, String(ten).trim(), String(moTa || '')],
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.delete('/folders/:id', async (req, res) => {
  try {
    await vectorStore.query('DELETE FROM kb_folder WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/* ---------------- Tài liệu trong 1 nhóm ---------------- */
router.get('/documents', async (req, res) => {
  try {
    const { folderId } = req.query;
    if (!folderId) return res.status(400).json({ ok: false, message: 'Thiếu folderId.' });
    const r = await vectorStore.query(
      `SELECT id, ten_file, loai, trang_thai, loi, nguoi_tai, cap_nhat_luc, created_at, mo_ta,
              (SELECT COUNT(*) FROM kb_chunk c WHERE c.document_id = kb_document.id) AS so_doan
       FROM kb_document WHERE folder_id = $1 ORDER BY created_at DESC`,
      [folderId],
    );
    res.json({ ok: true, documents: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

async function loadDoc(id) {
  const d = await vectorStore.query('SELECT * FROM kb_document WHERE id = $1', [id]);
  return d.rows[0] || null;
}

router.get('/documents/:id/download', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: 'Không tìm thấy tài liệu.' });
    if (!doc.duong_dan || !fs.existsSync(doc.duong_dan)) return res.status(404).json({ ok: false, message: 'Không còn file gốc trên máy chủ.' });
    res.download(doc.duong_dan, doc.ten_file);
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.get('/documents/:id/content', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: 'Không tìm thấy tài liệu.' });
    const chunks = await vectorStore.query('SELECT noi_dung FROM kb_chunk WHERE document_id = $1 ORDER BY thu_tu', [req.params.id]);
    res.json({ ok: true, content: chunks.rows.map((r) => r.noi_dung).join('\n\n---\n\n') });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

/** Trích xuất -> chunk -> embedding -> lưu — dùng lại cho cả upload mới lẫn "Index lại". So checksum
 * (SHA-256 nguyên file) với lần lập chỉ mục trước — file KHÔNG đổi thì bỏ qua embedding lại, chỉ cập
 * nhật trạng thái (tiết kiệm lượt gọi Gemini). Trả `{ changed }` để caller biết có thật sự lập chỉ mục
 * lại hay không. */
async function ingestDocument(documentId, filePath, tenFile, namespace, folderId) {
  await vectorStore.query(`UPDATE kb_document SET trang_thai = 'dang_xu_ly', loi = NULL WHERE id = $1`, [documentId]);
  try {
    const buffer = fs.readFileSync(filePath);
    const checksum = sha256(buffer);
    const cur = await vectorStore.query('SELECT checksum FROM kb_document WHERE id = $1', [documentId]);
    if (cur.rows[0] && cur.rows[0].checksum && cur.rows[0].checksum === checksum) {
      await vectorStore.query(`UPDATE kb_document SET trang_thai = 'xong', cap_nhat_luc = now() WHERE id = $1`, [documentId]);
      return { changed: false };
    }
    const chunks = await extractChunks(buffer, tenFile);
    await vectorStore.query('DELETE FROM kb_chunk WHERE document_id = $1', [documentId]); // dọn đoạn cũ khi re-index
    let i = 0;
    for (const text of chunks) {
      const vec = embeddings.toVectorLiteral(await embeddings.embedDocument(text));
      await vectorStore.query(
        `INSERT INTO kb_chunk (document_id, folder_id, namespace, thu_tu, noi_dung, embedding) VALUES ($1,$2,$3,$4,$5,$6::vector)`,
        [documentId, folderId, namespace, i++, text, vec],
      );
    }
    await vectorStore.query(`UPDATE kb_document SET trang_thai = 'xong', checksum = $2, cap_nhat_luc = now() WHERE id = $1`, [documentId, checksum]);
    return { changed: true };
  } catch (e) {
    await vectorStore.query(`UPDATE kb_document SET trang_thai = 'loi', loi = $2 WHERE id = $1`, [documentId, e.message]);
    throw e;
  }
}

// upload.single('file') parse xong toàn bộ multipart trước khi handler chạy — req.body.namespace/folderId
// chắc chắn có giá trị dù client gửi field theo thứ tự nào.
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { namespace, folderId, nguoiTai } = req.body || {};
    if (!req.file) return res.status(400).json({ ok: false, message: 'Thiếu file.' });
    if (!namespace) return res.status(400).json({ ok: false, message: 'Thiếu "namespace".' });
    const folderCheck = await vectorStore.query('SELECT id FROM kb_folder WHERE id = $1 AND namespace = $2', [folderId, namespace]);
    if (!folderCheck.rows.length) return res.status(400).json({ ok: false, message: 'Nhóm folder không tồn tại.' });

    const dir = path.join(KB_DIR, namespace, folderId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${Date.now()}-${req.file.originalname.replace(/[/\\]/g, '_')}`);
    fs.writeFileSync(filePath, req.file.buffer);

    const ext = (req.file.originalname.split('.').pop() || '').toUpperCase();
    const loai = ext === 'PDF' ? 'PDF' : ['DOC', 'DOCX'].includes(ext) ? 'Word' : ['XLS', 'XLSX'].includes(ext) ? 'Excel' : ext;
    const ins = await vectorStore.query(
      `INSERT INTO kb_document (folder_id, ten_file, loai, duong_dan, nguoi_tai) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [folderId, req.file.originalname, loai, filePath, nguoiTai || 'api'],
    );
    const documentId = ins.rows[0].id;

    try {
      await ingestDocument(documentId, filePath, req.file.originalname, namespace, folderId);
      res.json({ ok: true, documentId, trangThai: 'xong' });
    } catch (e) {
      res.json({ ok: true, documentId, trangThai: 'loi', message: e.message }); // đã lưu file, chỉ lập chỉ mục lỗi — vẫn 200 để client hiển thị trạng thái
    }
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post('/documents/:id/reindex', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: 'Không tìm thấy tài liệu.' });
    if (!doc.duong_dan || !fs.existsSync(doc.duong_dan)) return res.status(400).json({ ok: false, message: 'Không còn file gốc trên máy chủ để lập lại chỉ mục.' });
    const folder = await vectorStore.query('SELECT namespace FROM kb_folder WHERE id = $1', [doc.folder_id]);
    try {
      const { changed } = await ingestDocument(doc.id, doc.duong_dan, doc.ten_file, folder.rows[0].namespace, doc.folder_id);
      res.json({ ok: true, trangThai: 'xong', changed, message: changed ? 'Đã lập lại chỉ mục.' : 'File không đổi — giữ nguyên chỉ mục cũ, không lập lại.' });
    } catch (e) {
      res.json({ ok: true, trangThai: 'loi', message: e.message });
    }
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    const doc = await loadDoc(req.params.id);
    if (!doc) return res.json({ ok: true });
    await vectorStore.query('DELETE FROM kb_document WHERE id = $1', [req.params.id]);
    if (doc.duong_dan) fs.unlink(doc.duong_dan, () => {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;
