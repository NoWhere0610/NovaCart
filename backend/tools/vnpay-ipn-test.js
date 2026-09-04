/* ============================================================================
   TỰ KIỂM ENDPOINT IPN — giả lập VNPay gọi vào, không cần cấu hình gì bên VNPay.

   VÌ SAO CẦN: muốn VNPay gọi IPN thật thì phải khai URL trong cổng quản trị VÀ máy chủ phải có địa chỉ
   công khai (localhost không được, cần ngrok). Trước khi làm hết mấy bước đó, script này ký HMAC-SHA512
   đúng như VNPay và bắn thẳng vào endpoint để biết phía mình đã đúng chưa. Nó cũng tạo được những ca mà
   cổng thanh toán thật KHÔNG tạo hộ được: chữ ký giả, số tiền lệch, gửi trùng.

   Cách chạy (backend đang chạy, và cần MỘT đơn VNPay còn PENDING/UNPAID):
       node vnpay-ipn-test.js --order 151 --amount 922000
       node vnpay-ipn-test.js --order 151 --amount 922000 --api http://localhost:8081/api

   CẢNH BÁO: kịch bản số 5 GHI THẬT vào cơ sở dữ liệu (đơn chuyển sang PAID). Script in sẵn câu SQL để
   trả đơn về trạng thái cũ sau khi đo.
   ============================================================================ */
const crypto = require('crypto');

function docThamSo() {
  const a = process.argv.slice(2);
  const lay = (ten, mac) => {
    const i = a.indexOf(`--${ten}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : mac;
  };
  return {
    orderId: lay('order', ''),
    amount: Number(lay('amount', 0)),
    api: lay('api', 'http://localhost:8080/api'),
    tmnCode: lay('tmn', process.env.VNPAY_TMN_CODE || 'BZ1O9225'),
    secret: lay('secret', process.env.VNPAY_HASH_SECRET || 'IMPTLMIXJRJEHUPFGPFJNIYEOUEXBNRD'),
  };
}

const { orderId, amount, api, tmnCode, secret } = docThamSo();

/**
 * Ký y hệt VNPayService.verifyReturn: bỏ vnp_SecureHash, sắp xếp tên trường, bỏ giá trị rỗng, mã hoá
 * URL từng giá trị rồi nối bằng '&'.
 *
 * BẪY ĐÃ VẤP: URLEncoder của Java mã hoá dấu cách thành '+', còn encodeURIComponent của JavaScript mã
 * hoá thành '%20'. Chỉ cần một tham số có dấu cách (vd vnp_OrderInfo) là chữ ký lệch hoàn toàn và
 * endpoint trả 97 -- rất dễ hiểu nhầm thành "mã phía server sai".
 */
function ky(params) {
  const enc = (v) => encodeURIComponent(v).replace(/%20/g, '+');
  const hashData = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] != null)
    .sort()
    .map((n) => `${n}=${enc(params[n])}`)
    .join('&');
  return crypto.createHmac('sha512', secret).update(hashData, 'utf8').digest('hex');
}

async function goi(params, { chuKyGia = false } = {}) {
  const p = { ...params };
  p.vnp_SecureHash = chuKyGia ? 'deadbeef'.repeat(16) : ky(p);
  const qs = Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const r = await fetch(`${api}/vnpay/ipn?${qs}`);
  return { http: r.status, body: await r.json() };
}

const goc = {
  vnp_Version: '2.1.0',
  vnp_TmnCode: tmnCode,
  vnp_TxnRef: orderId,
  vnp_Amount: String(amount * 100), // VNPay không nhận số thập phân -> nhân 100
  vnp_ResponseCode: '00',
  vnp_TransactionStatus: '00',
  vnp_BankCode: 'NCB',
  vnp_PayDate: '20260101120000',
  vnp_TransactionNo: '14567890',
  vnp_OrderInfo: 'Thanh toan don hang',
};

const KICH_BAN = [
  ['chữ ký giả', { chuKyGia: true }, {}, '97'],
  ['số tiền không khớp', {}, { vnp_Amount: '100' }, '04'],
  ['đơn không tồn tại', {}, { vnp_TxnRef: '99999999' }, '01'],
  ['khách huỷ ở cổng', {}, { vnp_ResponseCode: '24' }, '00'],
  ['thanh toán hợp lệ (GHI THẬT)', {}, {}, '00'],
  ['VNPay gửi lại lần nữa', {}, {}, '02'],
];

async function main() {
  if (!orderId || !amount) {
    console.error('Thiếu tham số. Ví dụ: node vnpay-ipn-test.js --order 151 --amount 922000');
    console.error('Tìm đơn để thử:');
    console.error("  SELECT TOP 5 order_id, total_amount FROM orders");
    console.error("  WHERE payment_method='VNPAY' AND payment_status='UNPAID' AND status='PENDING';");
    process.exit(2);
  }

  console.log(`\n  Bắn vào ${api}/vnpay/ipn — đơn ${orderId}, số tiền ${amount.toLocaleString('vi-VN')}đ\n`);
  let dat = true;

  for (const [ten, opts, ghiDe, mongDoi] of KICH_BAN) {
    let r;
    try {
      r = await goi({ ...goc, ...ghiDe }, opts);
    } catch (e) {
      console.error(`  ✖ ${ten}: không gọi được (${e.message}) — backend có đang chạy không?`);
      process.exit(1);
    }
    const ok = r.http === 200 && r.body.RspCode === mongDoi;
    if (!ok) dat = false;
    console.log(`  ${ok ? '✔' : '✖'} ${ten.padEnd(30)} -> HTTP ${r.http}  `
      + `RspCode ${r.body.RspCode} "${r.body.Message}"`
      + (ok ? '' : `   (mong đợi ${mongDoi})`));
  }

  console.log('');
  console.log(dat
    ? '  ✔ ĐẠT — endpoint IPN xử lý đúng cả 6 kịch bản.'
    : '  ✖ TRƯỢT — xem log backend, tìm dòng bắt đầu bằng [vnpay/IPN].');
  console.log('');
  console.log('  Trả dữ liệu thử về trạng thái cũ:');
  console.log(`    UPDATE orders SET payment_status='UNPAID' WHERE order_id=${orderId};`);
  console.log('');
  process.exit(dat ? 0 : 1);
}

main().catch((e) => {
  console.error('LỖI:', e.message);
  process.exit(1);
});
