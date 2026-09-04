/* ============================================================================
   Tái hiện lỗi: câu hỏi LAI (sản phẩm + chính sách) rơi hết vào nhóm sản phẩm.

   Nhánh lọc cứng khoá trong đúng folder 'products'. Câu "áo sơ mi này đổi trả mấy ngày?" khiến Gemini
   trích category = "áo sơ mi" -> hasFilter = true -> chỉ tìm trong nhóm sản phẩm, và tài liệu chính
   sách bị loại khỏi tầm nhìn hoàn toàn. Bot trả lời về áo sơ mi, hoặc nói không có thông tin.

   Có một lý do thứ hai khiến lỗi này dễ tái phát: đo được các đoạn sản phẩm cách câu hỏi 0,14-0,19 còn
   đoạn chính sách 0,35-0,39. Sắp xếp kết quả thuần theo khoảng cách thì sản phẩm luôn đứng trước và
   đẩy hết đoạn chính sách ra ngoài -- nên phần gộp phải GIỮ CHỖ RIÊNG cho chính sách.

       node scripts/test-fix-cau-hoi-lai.js
   ============================================================================ */
const { chay, NAMESPACE } = require('./tienKiem');
const ragQuery = require('../lib/ragQuery');

const CAU_HOI = [
  'Áo sơ mi này đổi trả được trong mấy ngày vậy shop?',
  'Mua quần jean thì phí ship về Hà Nội bao nhiêu ạ?',
];

chay('Câu hỏi lai -- phải lấy được cả đoạn chính sách, không chỉ sản phẩm', async () => {
  let dat = true;
  for (const hoi of CAU_HOI) {
    const kq = await ragQuery.retrieveChunks({ namespace: NAMESPACE, question: hoi });
    const nguon = [...new Set(kq.chunks.map((c) => c.folder_ten))];
    const coChinhSach = kq.chunks.some((c) => c.folder_ten !== 'Sản phẩm');

    console.log(`  ${coChinhSach ? '✔' : '✖'} "${hoi}"`);
    console.log(`         ${kq.chunks.length} đoạn, nguồn: ${nguon.join(', ') || '(rỗng)'}`);
    if (!coChinhSach) dat = false;
  }
  return dat;
});
