/* ============================================================================
   Guard CỨNG chặn bot giả vờ nhận đơn hàng.

   Vì sao phải là guard cứng chứ không tin prompt: đã đo thực tế, dù system prompt cấm rất rõ, Gemini
   vẫn có xu hướng "hoàn tất kịch bản" ngay khi khách gửi tên + số điện thoại + địa chỉ (quán tính từ dữ
   liệu hội thoại chăm sóc khách hàng lúc huấn luyện). Bot nói "em đã ghi nhận đơn của anh" là LỪA một
   khách hàng thật -- người đó sẽ ngồi đợi hàng không bao giờ tới.

   Bản đầu của guard chỉ khớp 10 chữ số viết LIỀN, trong khi người Việt gõ "0912 345 678" hoặc
   "0912.345.678" nhiều hơn hẳn -- nghĩa là chính ca lỗi mà nó sinh ra để chặn vẫn tái hiện được.
   ============================================================================ */
const test = require('node:test');
const assert = require('node:assert');
const { containsVnPhone } = require('../lib/ragQuery');

const PHAI_CHAN = [
  ['viết liền', '0912345678'],
  ['có dấu cách', '0912 345 678'],
  ['có dấu chấm', '0912.345.678'],
  ['có dấu gạch', '0912-345-678'],
  ['mã quốc gia viết liền', '+84912345678'],
  ['mã quốc gia viết rời', '+84 912 345 678'],
  ['có ngoặc', '(0912) 345 678'],
  ['đầu số 03', '0387654321'],
  ['đầu số 05', '0587654321'],
  ['đầu số 07', '0787654321'],
  ['đầu số 08', '0887654321'],
  ['nằm giữa câu đặt hàng', 'Em ơi lấy cho anh áo sơ mi size L, tên Nguyễn Văn A, sđt 0912 345 678, giao về 12 Lê Lợi Q1'],
];

for (const [ten, cau] of PHAI_CHAN) {
  test(`chặn số điện thoại (${ten})`, () => {
    assert.strictEqual(containsVnPhone(cau), true, `phải nhận ra số điện thoại trong: ${cau}`);
  });
}

const KHONG_DUOC_CHAN = [
  ['hỏi tư vấn thường', 'Mình tìm áo sơ mi trắng size L dưới 300k'],
  ['hỏi về hotline', 'Shop có hotline không ạ?'],
  ['nói về giá', 'Áo này giá 350000đ đúng không em?'],
  ['nói về số đo cơ thể', 'Em cao 1m75 nặng 68kg thì mặc size gì'],
  ['chào hỏi', 'Chào shop'],
];

for (const [ten, cau] of KHONG_DUOC_CHAN) {
  test(`không chặn nhầm (${ten})`, () => {
    assert.strictEqual(containsVnPhone(cau), false, `không được nhận nhầm là số điện thoại: ${cau}`);
  });
}

test('không vỡ với đầu vào rỗng hoặc null', () => {
  assert.strictEqual(containsVnPhone(''), false);
  assert.strictEqual(containsVnPhone(null), false);
  assert.strictEqual(containsVnPhone(undefined), false);
});
