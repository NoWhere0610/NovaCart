/* ============================================================================
   Tái hiện lỗi #7: bot khẳng định còn hàng cho TỔ HỢP size/màu KHÔNG TỒN TẠI.

   Bản cũ đưa vào kho tri thức 2 danh sách RỜI NHAU ("Size: M, L" + "Màu: Đen, Trắng"), và câu SQL cũng
   kiểm 2 điều kiện độc lập. Sản phẩm chỉ còn M/Đen và L/Trắng vì thế khớp cả "M màu Trắng" -- một phân
   loại khách vào trang sản phẩm không chọn được. Đo trên dữ liệu thật lúc phát hiện: hỏi "M/Trắng" ra
   65 sản phẩm trong khi chỉ 62 sản phẩm có cặp đó.

   Kiểm bằng chính kho tri thức: mọi mã trả về đều phải có cặp được hỏi trong size_colors.

       node scripts/test-fix-cap-size-mau.js
   ============================================================================ */
const { chay, NAMESPACE } = require('./tienKiem');
const vectorStore = require('../lib/vectorStore');
const ragQuery = require('../lib/ragQuery');

const SIZE = 'M';
const MAU = 'Trắng';
const CAP = `${SIZE.toLowerCase()}|${MAU.toLowerCase()}`;

function maSanPham(noiDung) {
  const m = String(noiDung).match(/Mã sản phẩm: (\S+)/);
  return m ? m[1] : null;
}

chay(`Cặp size/màu -- hỏi "${SIZE}/${MAU}" không được trả về sản phẩm thiếu cặp đó`, async () => {
  const kq = await ragQuery.retrieveChunks({
    namespace: NAMESPACE,
    question: `Shop còn áo nào size ${SIZE} màu ${MAU} không?`,
  });

  const ma = [...new Set(kq.chunks.map((c) => maSanPham(c.noi_dung)).filter(Boolean))];
  console.log(`  trả về ${ma.length} sản phẩm`);
  if (!ma.length) {
    console.log('  (không có sản phẩm nào trả về -- không kết luận được, kiểm lại dữ liệu)');
    return false;
  }

  // Đối chiếu với cột size_colors: đây là nguồn sự thật về cặp nào thật sự còn hàng.
  const r = await vectorStore.query(
    `SELECT SUBSTRING(kc.noi_dung FROM 'Mã sản phẩm: (\\S+)') AS ma, kc.size_colors
       FROM kb_chunk kc
      WHERE kc.namespace = $1 AND kc.folder_id = 'products'
        AND SUBSTRING(kc.noi_dung FROM 'Mã sản phẩm: (\\S+)') = ANY($2)`,
    [NAMESPACE, ma],
  );

  const sai = r.rows.filter((row) => !(row.size_colors || []).includes(CAP));
  if (sai.length) {
    console.log(`  ✖ ${sai.length} sản phẩm KHÔNG có cặp "${CAP}" nhưng vẫn được trả về:`);
    for (const s of sai.slice(0, 5)) {
      console.log(`      mã ${s.ma} -- cặp còn hàng: ${(s.size_colors || []).join(', ')}`);
    }
    return false;
  }
  console.log(`  ✔ cả ${r.rows.length} sản phẩm đều thật sự còn cặp "${CAP}"`);
  return true;
});
