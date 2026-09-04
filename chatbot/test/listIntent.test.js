/* ============================================================================
   Nhận diện câu hỏi LIỆT KÊ / ĐẾM.

   Vì sao đáng test riêng: đây là cổng quyết định có nới trần và có đếm tổng số hay không. Nếu regex
   không khớp thì công cụ ĐƠN GIẢN LÀ KHÔNG CHẠY -- không có lỗi, không có cảnh báo, bot vẫn trả lời
   trôi chảy, chỉ là thiếu sản phẩm. Đúng kiểu lỗi im lặng mà dự án anh em (APSP) từng mất nửa ngày mới
   tìm ra khi dùng \b với tiếng Việt.

   Test dưới đây khoá lại cả 2 chiều: phải khớp câu liệt kê, và KHÔNG được khớp câu hỏi thường (khớp
   nhầm thì mọi câu tư vấn đều nhét 60 sản phẩm vào prompt, vừa tốn token vừa loãng câu trả lời).
   ============================================================================ */
const test = require('node:test');
const assert = require('node:assert');
const { LIST_INTENT } = require('../lib/ragQuery');

const PHAI_KHOP = [
  'liệt kê tất cả áo sơ mi bên shop',
  'shop có những mẫu quần jean nào?',
  'cho mình xem toàn bộ áo thun đang bán',
  'shop mình có bao nhiêu mẫu áo sơ mi?',
  'cho xin danh sách áo khoác',
  'các sản phẩm nào đang giảm giá',
  'bộ suit gồm những màu gì',
  'shop có mấy mẫu quần tây',
];

const KHONG_DUOC_KHOP = [
  'áo này giá bao nhiêu tiền',        // hỏi giá, không phải hỏi số lượng
  'giao hàng mất bao nhiêu lâu',      // hỏi thời gian
  'đổi trả trong bao nhiêu ngày',     // hỏi chính sách
  'tư vấn cho mình áo sơ mi đi làm',  // câu tư vấn thường
  'mình cao 1m75 nặng 68kg mặc size gì',
  'áo này chất liệu gì vậy shop',
];

for (const cau of PHAI_KHOP) {
  test(`nhận ra ý định liệt kê: "${cau}"`, () => {
    assert.strictEqual(LIST_INTENT.test(cau), true);
  });
}

for (const cau of KHONG_DUOC_KHOP) {
  test(`không nhận nhầm: "${cau}"`, () => {
    assert.strictEqual(LIST_INTENT.test(cau), false);
  });
}

test('KHÔNG dùng \\b -- ranh giới từ ASCII không hoạt động với tiếng Việt', () => {
  // Ghi lại bằng chứng ngay trong test để người sau không "dọn dẹp" regex thành \b cho gọn.
  assert.strictEqual(/\bliệt\s*kê\b/.test('liệt kê tất cả sản phẩm'), false,
    '\\b không khớp được vì "kê" kết thúc bằng ký tự không thuộc ASCII');
  assert.strictEqual(LIST_INTENT.test('liệt kê tất cả sản phẩm'), true);
});
