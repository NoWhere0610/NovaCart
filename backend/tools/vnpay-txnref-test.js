/* ============================================================================
   HỎI THẲNG VNPAY: cùng một vnp_TxnRef gửi hai lần thì có bị từ chối không?

   VÌ SAO CẦN CHẠY THẬT: VNPayService dùng thẳng orderId làm vnp_TxnRef, nên khách bỏ dở lần thanh toán
   đầu rồi bấm trả lại sẽ gửi ĐÚNG mã cũ sang VNPay. Đặc tả VNPay ghi vnp_TxnRef phải duy nhất trong
   ngày, và mã lỗi 01 của họ là "Giao dịch đã tồn tại". Nhưng đặc tả không nói rõ "đã tồn tại" tính từ
   lúc nào -- từ lúc SINH giao dịch, hay chỉ khi giao dịch đã THÀNH CÔNG.
   Đọc mã không trả lời được câu này. Chỉ có cách bắn thử vào sandbox.

   CÁCH LÀM: ký và gọi thẳng vpcpay.html y như VNPayService, KHÔNG qua backend.
     - Lần 1 với một mã mới tinh  -> đối chứng, chứng minh công cụ ký đúng
     - Lần 2 với ĐÚNG mã đó       -> đây là câu hỏi chính
     - Lần 3 với mã mới khác      -> đối chứng lần hai, loại trừ khả năng VNPay đang chặn vì lý do khác

   VNPay báo lỗi bằng cách redirect về vnp_ReturnUrl kèm vnp_ResponseCode, nên công cụ KHÔNG đi theo
   redirect mà đọc thẳng header Location.

   KHÔNG có giao dịch nào bị trừ tiền: chỉ dừng ở bước khởi tạo, không nhập thẻ.

   Cách chạy:  node vnpay-txnref-test.js
   ============================================================================ */
const crypto = require('crypto');

function docThamSo() {
  const a = process.argv.slice(2);
  const lay = (t, m) => { const i = a.indexOf(`--${t}`); return i >= 0 && a[i + 1] ? a[i + 1] : m; };
  return {
    tmnCode: lay('tmn', process.env.VNPAY_TMN_CODE || 'BZ1O9225'),
    secret: lay('secret', process.env.VNPAY_HASH_SECRET || 'IMPTLMIXJRJEHUPFGPFJNIYEOUEXBNRD'),
    payUrl: lay('pay-url', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
    returnUrl: lay('return-url', 'http://localhost:8080/api/vnpay/return'),
    amount: Number(lay('amount', 350000)),
  };
}
const { tmnCode, secret, payUrl, returnUrl, amount } = docThamSo();

/** Mã hoá y hệt URLEncoder.encode(value, US_ASCII) của Java.
 *  BẪY: Java mã hoá dấu cách thành '+', encodeURIComponent thành '%20'. Lệch một ký tự là chữ ký hỏng
 *  và VNPay trả 70/97 -- rất dễ hiểu nhầm thành "VNPay từ chối vì trùng mã". */
const enc = (v) => encodeURIComponent(v).replace(/%20/g, '+');

function taoUrl(txnRef) {
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const dau = (d) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`
    + `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;

  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: String(txnRef),
    vnp_OrderInfo: 'Kiem thu trung ma giao dich',
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: '127.0.0.1',
    vnp_CreateDate: dau(now),
    vnp_ExpireDate: dau(new Date(now.getTime() + 15 * 60 * 1000)),
  };

  const ten = Object.keys(params).filter((k) => params[k] !== '' && params[k] != null).sort();
  const hashData = ten.map((n) => `${n}=${enc(params[n])}`).join('&');
  const query = ten.map((n) => `${enc(n)}=${enc(params[n])}`).join('&');
  const hash = crypto.createHmac('sha512', secret).update(hashData, 'utf8').digest('hex');
  return `${payUrl}?${query}&vnp_SecureHash=${hash}`;
}

/** Bảng mã lỗi khởi tạo giao dịch của VNPay -- chỉ liệt kê những mã có thể gặp ở bước này. */
const Y_NGHIA = {
  '00': 'khởi tạo thành công (hiện trang chọn phương thức thanh toán)',
  '01': 'GIAO DỊCH ĐÃ TỒN TẠI  <-- đây là mã cho biết vnp_TxnRef bị trùng',
  '02': 'merchant không hợp lệ',
  '03': 'dữ liệu gửi sang không đúng định dạng',
  '04': 'website đang bị tạm khoá',
  '70': 'sai chữ ký (lỗi của công cụ này, không phải của VNPay)',
  '97': 'chữ ký không hợp lệ',
  '99': 'lỗi không xác định',
};

async function goi(txnRef, nhan) {
  const url = taoUrl(txnRef);
  // redirect: 'manual' -- VNPay báo lỗi bằng cách redirect về vnp_ReturnUrl kèm vnp_ResponseCode.
  // Đi theo redirect thì lời báo lỗi biến mất (backend localhost sẽ xử lý và trả về thứ khác).
  const r = await fetch(url, { redirect: 'manual' });
  const loc = r.headers.get('location');

  // VNPay trả 302 cho CẢ HAI kết quả, phân biệt bằng nơi nó dẫn tới:
  //   - /Transaction/PaymentMethod.html?token=...  -> đã khởi tạo giao dịch, đây là trang thanh toán
  //   - quay về chính vnp_ReturnUrl kèm vnp_ResponseCode -> bị từ chối, mã cho biết lý do
  // (Bản đầu của công cụ này chỉ coi HTTP 200 là thành công nên đọc nhầm cả ba lần thành "bị từ chối".)
  let ma = null;
  if (loc) {
    const m = loc.match(/vnp_ResponseCode=([0-9]+)/);
    if (m) ma = m[1];
  }
  const token = loc && loc.includes('PaymentMethod.html')
    ? (loc.match(/token=([0-9a-f]+)/) || [])[1] : null;

  console.log(`\n  ${nhan}`);
  console.log(`    vnp_TxnRef : ${txnRef}`);
  console.log(`    HTTP       : ${r.status}`);
  if (loc) {
    console.log(`    Redirect   : ${loc.length > 110 ? loc.slice(0, 110) + '…' : loc}`);
  }
  if (ma) {
    console.log(`    Mã trả về  : ${ma} -- ${Y_NGHIA[ma] ?? 'không có trong bảng đã biết'}`);
  } else if (token) {
    console.log(`    Kết quả    : VNPay ĐÃ KHỞI TẠO giao dịch, token ${token}`);
  } else {
    console.log('    Kết quả    : không nhận ra, cần xem thủ công');
  }
  return { http: r.status, ma, token, coTrangThanhToan: Boolean(token) };
}

async function main() {
  console.log('\n  Bắn thẳng vào VNPay sandbox, KHÔNG qua backend.');
  console.log(`  TmnCode ${tmnCode} — số tiền ${amount.toLocaleString('vi-VN')}đ`);
  console.log('  Không nhập thẻ nên không có đồng nào bị trừ.');

  const maDungLai = `TR${Date.now()}`.slice(0, 20);

  const l1 = await goi(maDungLai, '[1] Lần đầu với mã mới tinh (đối chứng)');
  const l2 = await goi(maDungLai, '[2] Gửi LẠI ĐÚNG mã đó  <-- câu hỏi chính');
  const l3 = await goi(`TR${Date.now() + 1}`.slice(0, 20), '[3] Mã mới khác (đối chứng lần hai)');

  console.log('\n  ---------------- KẾT LUẬN ----------------');

  if (!l1.coTrangThanhToan && l1.ma !== '00') {
    console.log(`  ⊘ KHÔNG KẾT LUẬN ĐƯỢC: ngay lần đầu đã bị từ chối (mã ${l1.ma ?? 'không rõ'}).`);
    console.log('    Nghĩa là công cụ ký sai hoặc tài khoản sandbox có vấn đề, chưa phải chuyện trùng mã.');
    process.exit(2);
  }

  const lanHaiBiTuChoi = l2.ma === '01';
  const lanHaiQua = l2.coTrangThanhToan || l2.ma === '00';

  if (lanHaiBiTuChoi) {
    console.log('  ✖ CÓ VẤN ĐỀ THẬT: VNPay TỪ CHỐI mã trùng (mã 01 - Giao dịch đã tồn tại).');
    console.log('    => Khách bỏ dở lần thanh toán đầu rồi bấm trả lại sẽ KHÔNG thanh toán được,');
    console.log('       vì VNPayService dùng thẳng orderId làm vnp_TxnRef.');
    console.log('    => Phải đổi vnp_TxnRef thành mã DUY NHẤT theo từng LẦN THỬ, không phải theo đơn.');
  } else if (lanHaiQua && l3.coTrangThanhToan) {
    console.log('  ✔ KHÔNG PHẢI VẤN ĐỀ: VNPay vẫn nhận yêu cầu với mã đã dùng.');
    if (l1.token && l2.token && l1.token !== l2.token) {
      console.log(`    VNPay còn cấp HAI token khác nhau cho cùng một vnp_TxnRef`);
      console.log(`      lần 1: ${l1.token}`);
      console.log(`      lần 2: ${l2.token}`);
      console.log('    -> mỗi lần bấm thanh toán là một lần thử riêng, mã đơn hàng trùng không cản trở.');
    }
    console.log('    Lần 3 với mã mới cũng qua, nên đây không phải do VNPay đang dễ dãi với mọi thứ.');
    console.log('    => Khách bỏ dở rồi thanh toán lại vẫn dùng được. Không cần sửa.');
    console.log('    LƯU Ý PHẠM VI: phép thử này dừng ở bước KHỞI TẠO giao dịch. Nó KHÔNG trả lời được');
    console.log('    trường hợp lần đầu đã thanh toán THÀNH CÔNG rồi mới gửi lại mã đó -- nhưng ca đó');
    console.log('    không xảy ra được vì getVnpayPaymentUrl chặn đơn đã PAID.');
  } else {
    console.log(`  ? CHƯA RÕ: lần 2 trả mã ${l2.ma ?? '(trang thanh toán)'}, lần 3 trả mã ${l3.ma ?? '(trang thanh toán)'}.`);
    console.log('    Cần xem lại thủ công, đừng kết luận vội.');
  }
  console.log('');
}

main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
