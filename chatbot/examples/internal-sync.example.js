/* ============================================================================
   MẪU đồng bộ dữ liệu từ API/DB NỘI BỘ của CHÍNH dự án đang dùng kit này (vd
   danh sách sản phẩm) vào kho tri thức — để RAG trả lời được cả câu hỏi về dữ
   liệu luôn thay đổi, không chỉ tài liệu tĩnh người dùng tự tải lên.

   KHÁC hẳn `lib/apiConnector.js` của CoreX gốc (KHÔNG mang theo trong kit này):
   - CoreX cần kết nối NHIỀU hệ thống ngoài khác nhau (Gitiho/BSC/Mobiwork), mỗi
     cái 1 kiểu xác thực, cấu hình qua giao diện cho người không biết code.
   - Ở đây chỉ có ĐÚNG 1 nguồn — API/DB nội bộ CỦA CHÍNH dự án bạn, luôn đáng tin
     cậy — nên KHÔNG cần khung linh hoạt đa xác thực/đa hệ thống/giao diện cấu
     hình. Gọi thẳng, hard-code endpoint/kết nối ngay trong file này — đúng cách
     CoreX tự nối SAP B1/FOX-DRM qua biến môi trường + 1 file riêng, không qua
     giao diện "Thiết lập API tích hợp".

   CÁCH DÙNG: copy file này ra khỏi examples/ (vd lib/productSync.js), sửa 2 chỗ
   TODO bên dưới, rồi tự gọi định kỳ (node-cron, tác vụ hệ điều hành, hoặc chạy
   tay). File này CHƯA chạy được ngay — chỉ là khung mẫu.
   ============================================================================ */
require('dotenv').config();
const embeddings = require('../lib/embeddings');
const vectorStore = require('../lib/vectorStore');

const NAMESPACE = 'default'; // TODO: đổi theo namespace dự án bạn dùng cho chatbot
const FOLDER_ID = 'products'; // TODO: đặt mã nhóm phù hợp (2-40 ký tự: chữ thường/số/-/_)
const FOLDER_TEN = 'Sản phẩm';

/** TODO 1: thay bằng lệnh gọi API/DB nội bộ THẬT của dự án bạn — trả về mảng bản ghi. */
async function fetchProductsFromInternalApi() {
  // Ví dụ: return (await fetch('http://localhost:4000/api/products')).then(r => r.json());
  return [];
}

/** TODO 2: map 1 bản ghi thành 1 đoạn văn bản có nghĩa — càng rõ ràng, RAG càng trả lời chính xác. */
function productToText(p) {
  return `Sản phẩm: ${p.ten}\nMã: ${p.ma}\nGiá: ${p.gia} đ\nMô tả: ${p.moTa || ''}`;
}

async function ensureFolder() {
  await vectorStore.query(
    `INSERT INTO kb_folder (id, namespace, ten, nguon, dong_bo_tu_dong) VALUES ($1,$2,$3,'api',true)
     ON CONFLICT (id) DO UPDATE SET ten = excluded.ten`,
    [FOLDER_ID, NAMESPACE, FOLDER_TEN],
  );
}

/** Đồng bộ đơn giản: xoá hết tài liệu cũ trong nhóm rồi tạo lại — dễ hiểu nhất cho khung mẫu. Với dữ
 * liệu lớn/thay đổi thường xuyên, nên tự thêm so-sánh checksum như `routes/knowledgeBase.js#ingestDocument`
 * để tránh nhúng lại toàn bộ mỗi lần chạy (tốn lượt gọi Gemini). */
async function syncProducts() {
  await ensureFolder();
  const products = await fetchProductsFromInternalApi();
  console.log(`  [sync] lấy được ${products.length} sản phẩm, bắt đầu đồng bộ vào kho tri thức...`);

  await vectorStore.query(
    `DELETE FROM kb_document WHERE folder_id = $1 AND ten_file LIKE 'product:%'`,
    [FOLDER_ID],
  );

  for (const p of products) {
    const text = productToText(p);
    const ins = await vectorStore.query(
      `INSERT INTO kb_document (folder_id, ten_file, loai, nguoi_tai) VALUES ($1,$2,'API','sync') RETURNING id`,
      [FOLDER_ID, `product:${p.ma}`],
    );
    const documentId = ins.rows[0].id;
    const vec = embeddings.toVectorLiteral(await embeddings.embedDocument(text));
    await vectorStore.query(
      `INSERT INTO kb_chunk (document_id, folder_id, namespace, thu_tu, noi_dung, embedding) VALUES ($1,$2,$3,0,$4,$5::vector)`,
      [documentId, FOLDER_ID, NAMESPACE, text, vec],
    );
    await vectorStore.query(`UPDATE kb_document SET trang_thai = 'xong', cap_nhat_luc = now() WHERE id = $1`, [documentId]);
  }
  console.log(`  [sync] xong — ${products.length} sản phẩm đã có trong kho tri thức.`);
}

if (require.main === module) {
  syncProducts().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { syncProducts };
