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

/** 1 sản phẩm -> 1 đoạn văn bản mô tả đầy đủ để nhúng — càng rõ ràng (giá, size/màu còn hàng, chất
 * liệu, danh mục) thì bot tư vấn càng chính xác. */
function productToText(p) {
  const sizeColorText = p.sizes && p.sizes.length ? p.sizes.join(', ') : 'hiện tạm hết size';
  const colorText = p.colors && p.colors.length ? p.colors.join(', ') : '';
  return [
    `Sản phẩm: ${p.tenSanPham}`,
    `Danh mục: ${p.danhMuc || ''}`,
    p.thuongHieu ? `Thương hiệu: ${p.thuongHieu}` : null,
    `Giá: ${p.gia.toLocaleString('vi-VN')}đ`,
    p.chatLieu ? `Chất liệu: ${p.chatLieu}` : null,
    `Size còn hàng: ${sizeColorText}`,
    colorText ? `Màu còn hàng: ${colorText}` : null,
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

/** Đồng bộ đơn giản: xoá hết tài liệu cũ trong nhóm rồi tạo lại — dễ hiểu nhất, đủ dùng cho quy mô
 * danh mục sản phẩm 1 shop (vài trăm-nghìn sản phẩm). Danh mục lớn hơn nên tự thêm so-sánh checksum
 * như routes/knowledgeBase.js#ingestDocument để tránh nhúng lại toàn bộ mỗi lần chạy (tốn lượt gọi Gemini).
 *
 * BỌC TRONG 1 TRANSACTION (BEGIN/COMMIT/ROLLBACK) — trước đây DELETE và từng INSERT chạy như các câu
 * lệnh auto-commit riêng lẻ: nếu lỗi giữa chừng (hết quota Gemini, mất mạng...) ở sản phẩm thứ N, N-1
 * sản phẩm ĐÃ insert vẫn còn nhưng DELETE ban đầu ĐÃ xoá hết dữ liệu cũ -> catalog bot tư vấn bị THIẾU
 * (chỉ còn 1 phần) cho tới lần sync kế tiếp chạy thành công. Dùng transaction: lỗi bất kỳ đâu giữa
 * chừng -> ROLLBACK về ĐÚNG trạng thái trước khi sync bắt đầu (dữ liệu cũ vẫn nguyên vẹn, coi như lần
 * sync này chưa từng chạy) thay vì để lại trạng thái nửa vời. */
async function syncProducts() {
  await ensureFolder();
  const products = await fetchProductsFromInternalApi();
  console.log(`  [sync] lấy được ${products.length} sản phẩm, bắt đầu đồng bộ vào kho tri thức...`);

  const client = await vectorStore.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM kb_document WHERE folder_id = $1 AND ten_file LIKE 'product:%'`, [FOLDER_ID]);

    for (const p of products) {
      const text = productToText(p);
      const ins = await client.query(
        `INSERT INTO kb_document (folder_id, ten_file, loai, nguoi_tai) VALUES ($1,$2,'API','sync') RETURNING id`,
        [FOLDER_ID, `product:${p.maSanPham}`],
      );
      const documentId = ins.rows[0].id;
      // Gọi Gemini (mạng ngoài) NGAY TRONG transaction -- chấp nhận giữ transaction mở lâu hơn 1 chút
      // (đổi lại code đơn giản, đúng thứ tự) vì quy mô đồng bộ (vài trăm sản phẩm/lần, 1 lần/ngày) không
      // đủ lớn để lo nghẽn connection pool trong lúc chạy.
      const vec = embeddings.toVectorLiteral(await embeddings.embedDocument(text));
      await client.query(
        `INSERT INTO kb_chunk (document_id, folder_id, namespace, thu_tu, noi_dung, embedding, danh_muc, thuong_hieu, gia, sizes, colors)
         VALUES ($1,$2,$3,0,$4,$5::vector,$6,$7,$8,$9,$10)`,
        [documentId, FOLDER_ID, NAMESPACE, text, vec, p.danhMuc || null, p.thuongHieu || null, p.gia, p.sizes || [], p.colors || []],
      );
      await client.query(`UPDATE kb_document SET trang_thai = 'xong', cap_nhat_luc = now() WHERE id = $1`, [documentId]);
    }

    await client.query('COMMIT');
    console.log(`  [sync] xong — ${products.length} sản phẩm đã có trong kho tri thức.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('  [sync] lỗi giữa chừng, ĐÃ ROLLBACK -> dữ liệu cũ vẫn nguyên vẹn, không bị mất sản phẩm:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  syncProducts()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('  [sync] lỗi đồng bộ sản phẩm:', e.message);
      process.exit(1);
    });
}

module.exports = { syncProducts };
