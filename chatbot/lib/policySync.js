/* ============================================================================
   Nạp tài liệu CHÍNH SÁCH / HƯỚNG DẪN (kb-files/seed/*.md) vào kho tri thức.

   Vì sao cần: trước đây kho tri thức CHỈ có folder sản phẩm. Mọi quy tắc trong system prompt kiểu "chỉ
   nói mốc thời gian giao hàng nếu con số đó có đúng trong đoạn tri thức" đang tham chiếu tới dữ liệu
   chưa từng tồn tại -- hỏi "đổi trả trong bao nhiêu ngày?", "phí ship tính sao?" thì bot chỉ trả lời
   được "hiện chưa có thông tin", trong khi website có sẵn các trang chính sách đó.

   Nội dung các file .md lấy đúng từ trang chính sách của website (frontend/src/pages/*PolicyPage.tsx) --
   sửa chính sách trên web thì nhớ sửa file tương ứng rồi chạy lại lệnh này.

   Chạy tay:  node lib/policySync.js
   Chạy lại nhiều lần an toàn: so checksum, file không đổi thì bỏ qua, không tốn lượt gọi Gemini.
   ============================================================================ */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const embeddings = require('./embeddings');
const vectorStore = require('./vectorStore');
const { sha256 } = require('./checksum');
const { extractChunks } = require('./textExtract');

const NAMESPACE = process.env.CHATBOT_NAMESPACE || 'novacart';
const FOLDER_ID = 'chinh-sach';
const FOLDER_TEN = 'Chính sách & hướng dẫn';
const SEED_DIR = path.join(__dirname, '..', 'kb-files', 'seed');

async function ensureFolder() {
  await vectorStore.query(
    `INSERT INTO kb_folder (id, namespace, ten, nguon, dong_bo_tu_dong) VALUES ($1,$2,$3,'file',false)
     ON CONFLICT (id) DO UPDATE SET ten = excluded.ten, namespace = excluded.namespace`,
    [FOLDER_ID, NAMESPACE, FOLDER_TEN],
  );
}

async function syncPolicies() {
  if (!fs.existsSync(SEED_DIR)) {
    console.warn(`  [policy] không tìm thấy thư mục ${SEED_DIR} -- bỏ qua.`);
    return { total: 0 };
  }
  const files = fs.readdirSync(SEED_DIR).filter((f) => f.toLowerCase().endsWith('.md'));
  if (!files.length) {
    console.warn('  [policy] không có file .md nào trong kb-files/seed -- bỏ qua.');
    return { total: 0 };
  }
  await ensureFolder();

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const tenFile of files) {
    const filePath = path.join(SEED_DIR, tenFile);
    const buffer = fs.readFileSync(filePath);
    const checksum = sha256(buffer);

    const cur = await vectorStore.query(
      'SELECT id, checksum FROM kb_document WHERE folder_id = $1 AND ten_file = $2',
      [FOLDER_ID, tenFile],
    );
    const old = cur.rows[0];
    if (old && old.checksum === checksum) {
      unchanged++;
      continue;
    }

    let documentId;
    if (old) {
      documentId = old.id;
      await vectorStore.query('DELETE FROM kb_chunk WHERE document_id = $1', [documentId]);
      updated++;
    } else {
      const ins = await vectorStore.query(
        `INSERT INTO kb_document (folder_id, ten_file, loai, duong_dan, nguoi_tai) VALUES ($1,$2,'Markdown',$3,'seed') RETURNING id`,
        [FOLDER_ID, tenFile, filePath],
      );
      documentId = ins.rows[0].id;
      added++;
    }

    const chunks = await extractChunks(buffer, tenFile);
    let i = 0;
    for (const text of chunks) {
      const vec = embeddings.toVectorLiteral(await embeddings.embedDocument(text));
      // Không điền danh_muc/gia/sizes/colors -- các cột đó chỉ dành cho chunk sản phẩm (lọc cứng theo
      // giá/size/màu), tài liệu chính sách chỉ truy hồi bằng ngữ nghĩa.
      await vectorStore.query(
        `INSERT INTO kb_chunk (document_id, folder_id, namespace, thu_tu, noi_dung, embedding) VALUES ($1,$2,$3,$4,$5,$6::vector)`,
        [documentId, FOLDER_ID, NAMESPACE, i++, text, vec],
      );
    }
    await vectorStore.query(
      `UPDATE kb_document SET trang_thai = 'xong', checksum = $2, cap_nhat_luc = now() WHERE id = $1`,
      [documentId, checksum],
    );
  }

  console.log(`  [policy] xong — ${files.length} tài liệu: ${added} thêm mới, ${updated} cập nhật, ${unchanged} không đổi.`);
  return { total: files.length, added, updated, unchanged };
}

/** Số đoạn tri thức chính sách hiện có — scheduler dùng để nạp lần đầu khi kho còn rỗng. */
async function countPolicyChunks() {
  const r = await vectorStore.query(
    'SELECT COUNT(*)::int AS n FROM kb_chunk WHERE namespace = $1 AND folder_id = $2',
    [NAMESPACE, FOLDER_ID],
  );
  return r.rows[0].n;
}

if (require.main === module) {
  // Đóng pool rồi thoát -- xem chú thích cùng chỗ trong productSync.js.
  syncPolicies()
    .then(() => vectorStore.pool.end())
    .catch((e) => {
      console.error('  [policy] lỗi nạp tài liệu chính sách:', e.message);
      return vectorStore.pool.end().finally(() => process.exit(1));
    });
}

module.exports = { syncPolicies, countPolicyChunks };
