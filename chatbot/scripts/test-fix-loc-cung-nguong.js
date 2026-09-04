/* ============================================================================
   Tái hiện lỗi: nhánh lọc cứng trả về sản phẩm SAI LOẠI khi Gemini trích thiếu điều kiện.

   Mọi tham số lọc đều dạng "$n IS NULL OR ..." nên điều kiện nào không trích ra được thì BIẾN MẤT khỏi
   mệnh đề WHERE. Hỏi "quần jean dưới 400k" mà trường category bị bỏ trống thì WHERE rút gọn còn mỗi
   "giá <= 400k", và câu truy vấn trả về những món rẻ nhất bất kể loại gì -- bot gợi ý áo thun, quần lót
   cho người đang hỏi quần jean.

   Kiểm 2 điều với mọi mã trả về: đúng khoảng giá, và đúng danh mục.

       node scripts/test-fix-loc-cung-nguong.js
   ============================================================================ */
const { chay, NAMESPACE } = require('./tienKiem');
const vectorStore = require('../lib/vectorStore');
const ragQuery = require('../lib/ragQuery');

const CAU_HOI = 'Mình tìm quần jean dưới 400k';
const GIA_TOI_DA = 400000;
const DANH_MUC = 'jean';

function maSanPham(noiDung) {
  const m = String(noiDung).match(/Mã sản phẩm: (\S+)/);
  return m ? m[1] : null;
}

chay('Lọc cứng -- không trả về sản phẩm sai loại/sai giá', async () => {
  const kq = await ragQuery.retrieveChunks({ namespace: NAMESPACE, question: CAU_HOI });
  // Chỉ xét đoạn thuộc nhóm sản phẩm -- đoạn chính sách được gộp thêm là chủ ý, không phải lỗi.
  const ma = [...new Set(kq.chunks.map((c) => maSanPham(c.noi_dung)).filter(Boolean))];
  console.log(`  "${CAU_HOI}" -> ${ma.length} sản phẩm`);

  if (!ma.length) {
    // Rỗng cũng là câu trả lời hợp lệ (thà nói chưa có còn hơn gợi ý sai loại), nhưng phải nói rõ để
    // người đọc kết quả không tưởng là test đã kiểm được gì.
    console.log('  (rỗng -- không có gì để kiểm sai loại; đây KHÔNG phải bằng chứng là đã đúng)');
    return true;
  }

  const r = await vectorStore.query(
    `SELECT SUBSTRING(kc.noi_dung FROM 'Mã sản phẩm: (\\S+)') AS ma, kc.danh_muc, kc.gia
       FROM kb_chunk kc
      WHERE kc.namespace = $1 AND kc.folder_id = 'products'
        AND SUBSTRING(kc.noi_dung FROM 'Mã sản phẩm: (\\S+)') = ANY($2)`,
    [NAMESPACE, ma],
  );

  const saiGia = r.rows.filter((x) => Number(x.gia) > GIA_TOI_DA);
  const saiLoai = r.rows.filter((x) => !String(x.danh_muc || '').toLowerCase().includes(DANH_MUC));

  if (saiGia.length) {
    console.log(`  ✖ ${saiGia.length} sản phẩm vượt giá ${GIA_TOI_DA}:`);
    saiGia.slice(0, 5).forEach((x) => console.log(`      ${x.ma} -- ${x.danh_muc} ${x.gia}`));
  }
  if (saiLoai.length) {
    console.log(`  ✖ ${saiLoai.length} sản phẩm sai danh mục (đang hỏi quần jean):`);
    saiLoai.slice(0, 5).forEach((x) => console.log(`      ${x.ma} -- ${x.danh_muc}`));
  }
  if (!saiGia.length && !saiLoai.length) {
    console.log(`  ✔ cả ${r.rows.length} sản phẩm đều đúng danh mục và trong khoảng giá`);
  }
  return !saiGia.length && !saiLoai.length;
});
