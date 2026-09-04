/* ============================================================================
   Tái hiện lỗi: bot GIẢ VỜ CHỐT ĐƠN khi khách gửi tên + số điện thoại + địa chỉ.

   Đã đo thực tế: dù system prompt cấm rất rõ, Gemini vẫn có xu hướng "hoàn tất kịch bản" trong đúng
   tình huống này (quán tính từ dữ liệu hội thoại chăm sóc khách hàng lúc huấn luyện). Bot nói "em đã
   ghi nhận đơn của anh" là LỪA một khách hàng thật -- người đó sẽ ngồi đợi hàng không bao giờ tới.
   Vì vậy phải chặn CỨNG bằng regex, không tin prompt.

   Guard chạy TRƯỚC mọi lượt gọi model nên script này tốn 0 lượt Gemini.

       node scripts/test-fix-so-dien-thoai.js
   ============================================================================ */
const { chay, NAMESPACE } = require('./tienKiem');
const ragQuery = require('../lib/ragQuery');

const CACH_VIET_SO = [
  '0912345678',
  '0912 345 678',
  '0912.345.678',
  '+84 912 345 678',
];

chay('Guard chốt đơn -- mọi cách viết số điện thoại đều bị chặn', async () => {
  let dat = true;
  for (const so of CACH_VIET_SO) {
    const cau = `Em ơi lấy cho anh áo sơ mi trắng size L, tên Nguyễn Văn A, sđt ${so}, giao về 12 Lê Lợi Q1 nhé`;
    const kq = await ragQuery.askQuestion({ namespace: NAMESPACE, userId: 'test', question: cau });

    const chuyenHuong = /không.*(nhận|xử lý).*đơn|Thêm vào giỏ hàng/i.test(kq.answer || '');
    const khongNhanDon = !/(chốt đơn|ghi nhận đơn|lên đơn cho|sẽ liên hệ|đơn sẽ được gửi)/i.test(kq.answer || '');
    const khongNguon = !kq.sources || kq.sources.length === 0;

    const ok = chuyenHuong && khongNhanDon && khongNguon;
    console.log(`  ${ok ? '✔' : '✖'} "${so}"`);
    if (!ok) {
      console.log(`      trả lời: ${String(kq.answer).slice(0, 160)}`);
      dat = false;
    }
  }

  // Không được chặn nhầm câu tư vấn bình thường -- guard quá rộng thì khách hỏi gì cũng bị đuổi đi.
  const thuong = await ragQuery.askQuestion({
    namespace: NAMESPACE, userId: 'test',
    question: 'Mình cao 1m75 nặng 68kg thì mặc áo sơ mi size gì ạ?',
  });
  const khongBiChanNham = !/không.*(nhận|xử lý).*đơn/i.test(thuong.answer || '');
  console.log(`  ${khongBiChanNham ? '✔' : '✖'} câu tư vấn thường không bị chặn nhầm`);
  if (!khongBiChanNham) dat = false;

  return dat;
});
