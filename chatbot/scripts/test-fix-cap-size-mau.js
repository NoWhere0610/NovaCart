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

const SO_LAN_THU = 3;

chay(`Cặp size/màu -- hỏi "${SIZE}/${MAU}" không được trả về sản phẩm thiếu cặp đó`, async () => {
  const cauHoi = `Shop còn áo nào size ${SIZE} màu ${MAU} không?`;

  // Chạy nhiều lần vì bước trích điều kiện do LLM làm nên KHÔNG tất định: đã quan sát được lần bỏ sót
  // trường màu trong khi 3 lần liền sau đó đều trích đủ. Bộ lọc theo CẶP chỉ bật khi trích được CẢ size
  // lẫn màu -- trích thiếu thì câu truy vấn tự động lùi về lọc lẻ (vẫn đúng đắn: sản phẩm trả về thật sự
  // có size đó, chỉ là không đủ chặt). Nên test phải tách bạch 2 việc:
  //   (a) ĐỘ TIN CẬY của bước trích -- báo cáo bằng số, không phán đạt/trượt
  //   (b) BẤT BIẾN của bộ lọc theo cặp -- khi đã trích đủ thì tuyệt đối không được lọt cặp ma
  let kq = null;
  let soLanTrichDu = 0;
  for (let i = 0; i < SO_LAN_THU; i++) {
    const r = await ragQuery.retrieveChunks({ namespace: NAMESPACE, question: cauHoi });
    const f = r.filters || {};
    if (f.size && f.color) {
      soLanTrichDu++;
      kq = kq || r;
    }
    await new Promise((x) => setTimeout(x, 3000));
  }

  console.log(`  trích đủ cả size lẫn màu: ${soLanTrichDu}/${SO_LAN_THU} lần`);
  if (!kq) {
    console.log('  ✖ không lần nào trích đủ cả 2 điều kiện -> bộ lọc theo cặp không bao giờ được bật.');
    console.log('    Đây là lỗi ở bước trích điều kiện (prompt), không phải ở câu truy vấn.');
    return false;
  }

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
