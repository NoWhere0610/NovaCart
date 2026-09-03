/* ============================================================================
   Đồng bộ danh mục sản phẩm NovaCart (Java backend) vào kho tri thức — để bot
   tư vấn được cả dữ liệu luôn thay đổi (giá/tồn kho), không chỉ tài liệu FAQ
   tĩnh tải tay. Copy + điền TODO từ examples/internal-sync.example.js (xem file
   đó để hiểu vì sao kit này KHÔNG cần khung connector đa hệ thống như CoreX gốc
   — chỉ có ĐÚNG 1 nguồn, API nội bộ của chính NovaCart, hard-code thẳng ở đây).

   Chạy tay:  node lib/productSync.js
   Chạy định kỳ mỗi ngày: tự thêm vào Task Scheduler (Windows) / cron (Linux)
   gọi lệnh trên, hoặc dùng node-cron nếu muốn tự chạy trong tiến trình server.
   ============================================================================ */
require('dotenv').config();
const embeddings = require('./embeddings');
const vectorStore = require('./vectorStore');
const { sha256 } = require('./checksum');

const NAMESPACE = process.env.CHATBOT_NAMESPACE || 'novacart';
const FOLDER_ID = 'products';
const FOLDER_TEN = 'Sản phẩm';

const NOVACART_API_BASE = process.env.NOVACART_API_BASE || 'http://localhost:8080';
const NOVACART_INTERNAL_SECRET = process.env.NOVACART_INTERNAL_SECRET || '';

/** Gọi API nội bộ Java (GET /internal/kb/products) — trả mảng sản phẩm ĐANG BÁN, còn tồn kho, đã kèm
 * sẵn category/brand/giá cuối/size-màu còn hàng (Java lọc sẵn status=ACTIVE, stockQuantity>0). */
async function fetchProductsFromInternalApi() {
  const r = await fetch(`${NOVACART_API_BASE}/internal/kb/products`, {
    headers: { 'X-Internal-Secret': NOVACART_INTERNAL_SECRET },
  });
  if (!r.ok) throw new Error(`Gọi API nội bộ NovaCart thất bại (mã ${r.status})`);
  return r.json();
}

/** Các cặp size/màu THẬT SỰ còn hàng, dạng "m|đen" (chữ thường) để lọc SQL không phân biệt hoa/thường. */
function sizeColorKeys(p) {
  return (p.bienThe || []).map((v) => `${String(v.size).toLowerCase()}|${String(v.color).toLowerCase()}`);
}

/**
 * 1 sản phẩm -> 1 đoạn văn bản mô tả đầy đủ để nhúng.
 *
 * QUAN TRỌNG — liệt kê theo CẶP size/màu, không tách thành 2 dòng "Size còn hàng"/"Màu còn hàng" như
 * bản trước. Sản phẩm chỉ còn 2 biến thể M/Đen và L/Trắng mà ghi "Size: M, L" + "Màu: Đen, Trắng" thì
 * đoạn tri thức tự nó KHẲNG ĐỊNH 4 tổ hợp, trong đó 2 tổ hợp không hề tồn tại. Model không có cách nào
 * biết dữ liệu đưa cho nó đã mất quan hệ cặp, nên sẽ trả lời khách là "còn size M màu Trắng" -- nói sai
 * với khách thật, và quy tắc "không khẳng định tồn kho" trong system prompt cũng không cứu được vì
 * thông tin tồn kho CÓ trong đoạn tri thức, chỉ là sai cấu trúc.
 *
 * Kèm mã sản phẩm để bot dẫn khách về đúng trang (/products/<mã>) thay vì chỉ đọc tên -- 2 sản phẩm
 * trùng tên thì đọc tên không đủ để khách tìm ra.
 */
function productToText(p) {
  const combos = (p.bienThe || []).map((v) => `${v.size}/${v.color}`).join(', ');
  return [
    `Sản phẩm: ${p.tenSanPham}`,
    `Mã sản phẩm: ${p.maSanPham} (đường dẫn: /products/${p.maSanPham})`,
    `Danh mục: ${p.danhMuc || ''}`,
    p.thuongHieu ? `Thương hiệu: ${p.thuongHieu}` : null,
    `Giá tham khảo: ${p.gia.toLocaleString('vi-VN')}đ (giá và tồn kho có thể đã thay đổi, xem trang sản phẩm để biết chính xác)`,
    p.chatLieu ? `Chất liệu: ${p.chatLieu}` : null,
    // Chỉ những CẶP dưới đây là có thật -- mọi tổ hợp size/màu khác của sản phẩm này đều không còn hàng.
    `Các phân loại còn hàng (size/màu): ${combos}`,
    p.moTa ? `Mô tả: ${p.moTa}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function ensureFolder() {
  await vectorStore.query(
    `INSERT INTO kb_folder (id, namespace, ten, nguon, dong_bo_tu_dong) VALUES ($1,$2,$3,'api',true)
     ON CONFLICT (id) DO UPDATE SET ten = excluded.ten`,
    [FOLDER_ID, NAMESPACE, FOLDER_TEN],
  );
}

/**
 * Đồng bộ TĂNG DẦN theo checksum — chỉ nhúng lại sản phẩm có nội dung thật sự thay đổi.
 *
 * Bản trước xoá sạch rồi tạo lại toàn bộ: 135 sản phẩm x giãn cách 4s = ~10 phút và 135 lượt gọi Gemini
 * cho MỖI lần chạy, kể cả khi không có gì đổi. Cái giá đó buộc lịch phải thưa (1 lần/ngày lúc 3h sáng),
 * mà lịch thưa lại chính là nguyên nhân bot đọc giá cũ tới 24 tiếng và vẫn tư vấn sản phẩm admin đã ẩn.
 * So checksum (giống routes/knowledgeBase.js#ingestDocument) khiến lần chạy "không có gì đổi" tốn 0 lượt
 * gọi Gemini và vài giây -- nhờ đó chạy được mỗi giờ, dữ liệu bot đọc bám sát web hơn hẳn.
 *
 * BỌC TRONG 1 TRANSACTION (BEGIN/COMMIT/ROLLBACK) — lỗi giữa chừng (hết quota Gemini, mất mạng...) sẽ
 * ROLLBACK về đúng trạng thái trước khi sync bắt đầu, thay vì để catalog ở trạng thái nửa vời.
 */
async function syncProducts() {
  await ensureFolder();
  const products = await fetchProductsFromInternalApi();

  // Bản đồ tài liệu đang có: ten_file "product:<mã>" -> { id, checksum }
  const existing = new Map();
  const cur = await vectorStore.query(
    `SELECT id, ten_file, checksum FROM kb_document WHERE folder_id = $1 AND ten_file LIKE 'product:%'`,
    [FOLDER_ID],
  );
  for (const row of cur.rows) existing.set(row.ten_file, row);

  // GIAI ĐOẠN 1 (NGOÀI transaction) -- gọi Gemini để nhúng những sản phẩm thật sự thay đổi.
  //
  // Bản trước gọi Gemini ngay trong transaction: lần chạy đầu trên máy mới là ~133 sản phẩm x giãn cách
  // 4s = gần 10 phút giữ transaction mở, và transaction đó khoá bảng kb_chunk. Hệ quả đã gặp thật: khởi
  // động lại kit trong lúc sync chạy thì ensureSchema() (có ALTER TABLE ... ADD COLUMN IF NOT EXISTS,
  // cần khoá ACCESS EXCLUSIVE) bị chặn tới hết statement_timeout rồi lỗi. Tách 2 giai đoạn: phần chậm
  // (mạng ngoài) không giữ khoá nào, transaction chỉ còn vài chục mili giây.
  //
  // Lợi thêm: lỗi giữa chừng ở giai đoạn này thì CHƯA ghi gì cả -- không cần rollback, dữ liệu cũ nguyên vẹn.
  const seen = new Set();
  const touch = [];    // sản phẩm không đổi -> chỉ cập nhật mốc thời gian
  const writes = [];   // sản phẩm mới/đã đổi -> ghi lại chunk
  for (const p of products) {
    const tenFile = `product:${p.maSanPham}`;
    seen.add(tenFile);
    const text = productToText(p);
    const checksum = sha256(text);
    const old = existing.get(tenFile);

    if (old && old.checksum === checksum) {
      touch.push(old.id);
      continue;
    }
    const vec = embeddings.toVectorLiteral(await embeddings.embedDocument(text));
    writes.push({ tenFile, documentId: old ? old.id : null, text, checksum, vec, p });
  }

  // Sản phẩm không còn trong danh sách trả về (admin đã ẩn, hết sạch tồn kho, hoặc đã xoá) phải BIẾN
  // MẤT khỏi kho tri thức -- để lại thì bot vẫn tư vấn nhiệt tình cho hàng không mua được nữa.
  const stale = [...existing.keys()].filter((k) => !seen.has(k));

  // GIAI ĐOẠN 2 (TRONG transaction) -- chỉ còn thao tác DB, chạy rất nhanh. Hoặc áp dụng trọn vẹn, hoặc
  // không gì cả: không bao giờ để catalog ở trạng thái nửa vời.
  const client = await vectorStore.pool.connect();
  let added = 0;
  let updated = 0;
  try {
    await client.query('BEGIN');

    if (touch.length) {
      await client.query(`UPDATE kb_document SET cap_nhat_luc = now() WHERE id = ANY($1)`, [touch]);
    }

    for (const w of writes) {
      let documentId = w.documentId;
      if (documentId) {
        await client.query('DELETE FROM kb_chunk WHERE document_id = $1', [documentId]);
        updated++;
      } else {
        const ins = await client.query(
          `INSERT INTO kb_document (folder_id, ten_file, loai, nguoi_tai) VALUES ($1,$2,'API','sync') RETURNING id`,
          [FOLDER_ID, w.tenFile],
        );
        documentId = ins.rows[0].id;
        added++;
      }
      await client.query(
        `INSERT INTO kb_chunk (document_id, folder_id, namespace, thu_tu, noi_dung, embedding, danh_muc, thuong_hieu, gia, sizes, colors, size_colors)
         VALUES ($1,$2,$3,0,$4,$5::vector,$6,$7,$8,$9,$10,$11)`,
        [documentId, FOLDER_ID, NAMESPACE, w.text, w.vec, w.p.danhMuc || null, w.p.thuongHieu || null, w.p.gia,
         w.p.sizes || [], w.p.colors || [], sizeColorKeys(w.p)],
      );
      await client.query(
        `UPDATE kb_document SET trang_thai = 'xong', checksum = $2, cap_nhat_luc = now() WHERE id = $1`,
        [documentId, w.checksum],
      );
    }

    if (stale.length) {
      await client.query(`DELETE FROM kb_document WHERE folder_id = $1 AND ten_file = ANY($2)`, [FOLDER_ID, stale]);
    }

    await client.query('COMMIT');
    console.log(`  [sync] xong — ${products.length} sản phẩm đang bán: ${added} thêm mới, ${updated} cập nhật, ${touch.length} không đổi, ${stale.length} gỡ bỏ.`);
    return { total: products.length, added, updated, unchanged: touch.length, removed: stale.length };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('  [sync] lỗi khi ghi vào kho tri thức, ĐÃ ROLLBACK -> dữ liệu cũ vẫn nguyên vẹn:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

/** Số đoạn tri thức sản phẩm hiện có của namespace này — scheduler dùng để quyết định có cần sync ngay
 * lúc khởi động hay không (kho rỗng = chưa chạy sync lần nào, đợi tới 3h sáng là quá muộn). */
async function countProductChunks() {
  const r = await vectorStore.query(
    'SELECT COUNT(*)::int AS n FROM kb_chunk WHERE namespace = $1 AND folder_id = $2',
    [NAMESPACE, FOLDER_ID],
  );
  return r.rows[0].n;
}

if (require.main === module) {
  // Đóng connection pool rồi mới thoát. process.exit(0) thẳng trong khi pool còn kết nối mở khiến libuv
  // trên Windows in ra "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" -- công việc đã xong xuôi
  // nhưng dòng cuối cùng người chạy nhìn thấy lại giống một lỗi nghiêm trọng.
  syncProducts()
    .then(() => vectorStore.pool.end())
    .catch((e) => {
      console.error('  [sync] lỗi đồng bộ sản phẩm:', e.message);
      return vectorStore.pool.end().finally(() => process.exit(1));
    });
}

module.exports = { syncProducts, countProductChunks };
