/* ============================================================================
   PHƠI BÀY: câu hỏi LIỆT KÊ / ĐẾM bị trần TOP_K cắt cụt mà không có tín hiệu nào.

   Bản chất vấn đề: truy hồi lấy top-K theo độ giống nghĩa -- nó KHÔNG CÓ khái niệm "hết". Với câu hỏi
   có điều kiện lọc, câu SQL của NovaCart chính xác tuyệt đối, chỉ có mệnh đề LIMIT là sai: bot nhận
   được N sản phẩm hoàn toàn đúng điều kiện rồi liệt kê ra với giọng chắc nịch, không có gì cho thấy
   nó đang thiếu.

   Đây là lỗi nguy hiểm hơn việc bot từ chối trả lời: từ chối thì khách biết là chưa có, còn liệt kê
   thiếu thì khách tưởng đã đủ.

   Script này ĐO chứ không phán xét: in ra "trả về N / thật sự có M" cho từng câu hỏi. So sánh với
   chính kb_chunk (cùng bộ dữ liệu bot đang đọc) để cô lập đúng vấn đề TRẦN -- so với MSSQL sẽ lẫn
   thêm chuyện đồng bộ, thành hai vấn đề trong một con số.

       node scripts/test-liet-ke-thieu.js
   ============================================================================ */
const { chay, NAMESPACE } = require('./tienKiem');
const vectorStore = require('../lib/vectorStore');
const ragQuery = require('../lib/ragQuery');

/** Rút mã sản phẩm từ đoạn tri thức -- productToText luôn in dòng "Mã sản phẩm: <mã>". */
function maSanPham(noiDung) {
  const m = String(noiDung).match(/Mã sản phẩm: (\S+)/);
  return m ? m[1] : null;
}

/** Số sản phẩm THẬT SỰ khớp danh mục trong kho tri thức (không trần, không ngưỡng). */
async function demThat(danhMuc) {
  const r = await vectorStore.query(
    `SELECT COUNT(*)::int AS n FROM kb_chunk
      WHERE namespace = $1 AND folder_id = 'products' AND danh_muc ILIKE '%' || $2 || '%'`,
    [NAMESPACE, danhMuc],
  );
  return r.rows[0].n;
}

const CAU_HOI = [
  { hoi: 'Liệt kê tất cả áo sơ mi bên shop cho mình xem', danhMuc: 'Áo sơ mi' },
  { hoi: 'Shop có những mẫu quần jean nào?', danhMuc: 'Quần jean' },
  { hoi: 'Cho mình xem toàn bộ áo thun đang bán', danhMuc: 'Áo thun' },
];

chay('Liệt kê đầy đủ (phơi bày trần TOP_K)', async () => {
  let dat = true;
  console.log('');
  for (const { hoi, danhMuc } of CAU_HOI) {
    const that = await demThat(danhMuc);
    const kq = await ragQuery.retrieveChunks({ namespace: NAMESPACE, question: hoi });
    const ma = new Set(kq.chunks.map((c) => maSanPham(c.noi_dung)).filter(Boolean));

    const thieu = that - ma.size;
    const trangThai = thieu > 0 ? '✖ THIẾU' : '✔ đủ';
    console.log(`  ${trangThai}  "${hoi}"`);
    console.log(`         trả về ${ma.size} / thật sự có ${that}`
      + (thieu > 0 ? `  -> thiếu ${thieu} (${Math.round(thieu / that * 100)}%)` : ''));
    if (thieu > 0) dat = false;
  }
  console.log('');
  if (!dat) {
    console.log('  Bot sẽ liệt kê đúng những mục nhận được -- nhưng nói như thể đó là TẤT CẢ.');
    console.log('  Hướng sửa: đếm bằng SQL (COUNT(*) OVER()) rồi đưa TỔNG SỐ vào ngữ cảnh,');
    console.log('  thay vì cố nới trần cho đủ.');
  }
  return dat;
});
