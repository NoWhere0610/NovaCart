/* ============================================================================
   TỰ KIỂM "mỗi khách chỉ dùng mỗi mã giảm giá MỘT lần" — đi trọn đường thật: thêm giỏ, đặt hàng, huỷ.

   VÌ SAO CẦN CHẠY THẬT chứ không chỉ test đơn vị: điều thực sự chặn không phải câu lệnh kiểm tra trong
   Java mà là ràng buộc UNIQUE(voucher_id, user_id) trong cơ sở dữ liệu — thứ chỉ tồn tại khi bảng đã
   được tạo đúng. Test đơn vị mock repository sẽ xanh kể cả khi ràng buộc đó không hề tồn tại.

   Cách chạy (backend đang chạy, sqlcmd có trong PATH):
       node voucher-per-user-test.js

   Script tự tạo mã giảm giá + tài khoản dùng một lần rồi tự xoá.
   ============================================================================ */
const { execFileSync } = require('child_process');

function docThamSo() {
  const a = process.argv.slice(2);
  const lay = (t, m) => { const i = a.indexOf(`--${t}`); return i >= 0 && a[i + 1] ? a[i + 1] : m; };
  return {
    api: lay('api', 'http://localhost:8080/api'),
    sql: {
      server: lay('sql-server', 'localhost,1433'), db: lay('sql-db', 'menswear_shop'),
      user: lay('sql-user', 'sa'), pass: lay('sql-pass', '123456'),
    },
  };
}
const { api, sql } = docThamSo();

let dat = 0, truot = 0;
const kiem = (ten, dk, ct = '') => {
  if (dk) { dat++; console.log(`  ✔ ${ten}`); }
  else { truot++; console.log(`  ✖ ${ten}${ct ? `\n      ${ct}` : ''}`); }
};

const chaySql = (c) => execFileSync('sqlcmd',
  ['-S', sql.server, '-U', sql.user, '-P', sql.pass, '-d', sql.db, '-C', '-h', '-1', '-W', '-Q', c],
  { encoding: 'utf8' });

async function goi(p, { method = 'GET', body, token } = {}) {
  const h = {};
  if (body) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(api + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let d = null;
  try { d = await r.json(); } catch { /* body rỗng */ }
  return { http: r.status, body: d };
}

const t = Date.now();
const TEN_DN = `kiemvc${t}`.slice(0, 40);
const MA = `KIEMTHU${String(t).slice(-6)}`;

async function main() {
  console.log(`\n  Kiểm giới hạn mã giảm giá theo người tại ${api}`);
  console.log(`  Mã dùng một lần: ${MA} — tài khoản: ${TEN_DN}\n`);

  // Mã giảm 10.000đ, usage_limit rộng rãi (100) -- cố tình để chứng minh giới hạn THEO NGƯỜI mới là
  // thứ chặn, chứ không phải hết lượt toàn cục.
  chaySql(`INSERT INTO vouchers (code, discount_type, discount_value, min_order_value, usage_limit, used_count, is_active, start_date, end_date) `
    + `VALUES ('${MA}', 'AMOUNT', 10000, 0, 100, 0, 1, DATEADD(DAY,-1,CAST(SYSDATETIME() AS DATE)), DATEADD(DAY,30,CAST(SYSDATETIME() AS DATE)));`);
  const voucherId = Number(chaySql(`SELECT voucher_id FROM vouchers WHERE code='${MA}';`).trim().split('\n')[0].trim());

  const dk = await goi('/auth/register', {
    method: 'POST',
    body: { username: TEN_DN, password: 'matkhau123', email: `${TEN_DN}@example.invalid`, fullName: 'Khach kiem thu' },
  });
  if (dk.http !== 200) {
    console.error(`  ⊘ BỎ QUA: không đăng ký được (HTTP ${dk.http}). Backend có đang chạy không?`);
    chaySql(`DELETE FROM vouchers WHERE voucher_id=${voucherId};`);
    process.exit(0);
  }
  const token = dk.body.accessToken;
  const uid = dk.body.userId;

  let orderId = null;
  try {
    // ---------- Dựng giỏ + địa chỉ ----------
    const variantId = Number(chaySql(
      `SELECT TOP 1 v.variant_id FROM product_variants v JOIN products p ON p.product_id=v.product_id `
      + `WHERE v.stock_quantity >= 5 AND p.status='ACTIVE' ORDER BY v.variant_id;`).trim().split('\n')[0].trim());

    // Điền hồ sơ TRƯỚC khi thêm địa chỉ: tên người nhận và số điện thoại của địa chỉ nay lấy từ hồ sơ
    // tài khoản, nên hồ sơ trống thì backend từ chối tạo địa chỉ (xem AddressService.applyRequest).
    const hoSo = await goi('/users/me', {
      method: 'PUT', token, body: { fullName: 'Khach kiem thu', phone: '0912345678' },
    });
    if (hoSo.http !== 200) {
      console.error(`  ⊘ BỎ QUA: không điền được hồ sơ (HTTP ${hoSo.http}): ${JSON.stringify(hoSo.body)}`);
      process.exit(0);
    }

    const dc = await goi('/addresses', {
      method: 'POST', token,
      body: {
        province: 'Thành phố Hà Nội',
        district: null, ward: 'Phường Hoàn Kiếm', detailAddress: '1 Tràng Tiền', isDefault: true,
      },
    });
    if (dc.http !== 200) {
      console.error(`  ⊘ BỎ QUA: không tạo được địa chỉ (HTTP ${dc.http}): ${JSON.stringify(dc.body)}`);
      process.exit(0);
    }
    const addressId = dc.body.addressId;

    const themGio = async () => goi('/cart/items', {
      method: 'POST', token, body: { variantId, quantity: 1 },
    });

    // ---------- Lần đầu ----------
    console.log('  --- Lần đầu dùng mã ---');
    const xemTruoc1 = await goi(`/vouchers/preview?code=${MA}&subtotal=350000`, { token });
    kiem('Xem trước: mã áp được', xemTruoc1.http === 200, `HTTP ${xemTruoc1.http}: ${JSON.stringify(xemTruoc1.body)}`);

    await themGio();
    const don1 = await goi('/orders/checkout', {
      method: 'POST', token,
      body: { addressId, paymentMethod: 'COD', voucherCode: MA },
    });
    kiem('Đặt hàng có mã -> thành công', don1.http === 200, `HTTP ${don1.http}: ${JSON.stringify(don1.body)}`);
    orderId = don1.body?.orderId;

    const soDau = chaySql(`SELECT COUNT(*) FROM voucher_usages WHERE voucher_id=${voucherId} AND user_id=${uid};`)
      .trim().split('\n')[0].trim();
    kiem('Có ghi dấu "người này đã dùng mã này"', soDau === '1', `đếm được ${soDau} dòng`);

    // ---------- Lần hai ----------
    console.log('\n  --- Lần hai, CÙNG khách ---');
    const xemTruoc2 = await goi(`/vouchers/preview?code=${MA}&subtotal=350000`, { token });
    kiem('Xem trước đã chặn ngay, không đợi tới lúc đặt hàng',
      xemTruoc2.http === 400 && /đã sử dụng mã giảm giá này rồi/.test(xemTruoc2.body?.message ?? ''),
      `HTTP ${xemTruoc2.http}: ${JSON.stringify(xemTruoc2.body)}`);

    await themGio();
    const don2 = await goi('/orders/checkout', {
      method: 'POST', token, body: { addressId, paymentMethod: 'COD', voucherCode: MA },
    });
    kiem('Đặt hàng lần hai với cùng mã -> bị từ chối', don2.http === 400,
      `HTTP ${don2.http}: ${JSON.stringify(don2.body)}`);

    const conLuot = chaySql(`SELECT used_count FROM vouchers WHERE voucher_id=${voucherId};`).trim().split('\n')[0].trim();
    kiem('Lần bị từ chối KHÔNG cộng thêm lượt dùng toàn cục', conLuot === '1', `used_count = ${conLuot}`);

    // ---------- Khách khác ----------
    console.log('\n  --- Khách KHÁC ---');
    const dk2 = await goi('/auth/register', {
      method: 'POST',
      body: { username: `${TEN_DN}b`, password: 'matkhau123', email: `${TEN_DN}b@example.invalid`, fullName: 'Khach 2' },
    });
    const xemTruoc3 = await goi(`/vouchers/preview?code=${MA}&subtotal=350000`, { token: dk2.body.accessToken });
    kiem('Khách khác vẫn dùng được (giới hạn theo NGƯỜI, không phải theo mã)',
      xemTruoc3.http === 200, `HTTP ${xemTruoc3.http}: ${JSON.stringify(xemTruoc3.body)}`);
    chaySql(`DELETE FROM user_roles WHERE user_id=${dk2.body.userId}; DELETE FROM carts WHERE user_id=${dk2.body.userId}; DELETE FROM users WHERE user_id=${dk2.body.userId};`);

    // ---------- Huỷ đơn thì trả lại quyền ----------
    console.log('\n  --- Huỷ đơn ---');
    const huy = await goi(`/orders/${orderId}/cancel`, { method: 'POST', token, body: {} });
    kiem('Huỷ đơn thành công', huy.http === 200, `HTTP ${huy.http}: ${JSON.stringify(huy.body)}`);

    const soDauSauHuy = chaySql(`SELECT COUNT(*) FROM voucher_usages WHERE voucher_id=${voucherId} AND user_id=${uid};`)
      .trim().split('\n')[0].trim();
    // Không xoá dấu thì khách mất mã vĩnh viễn vì một đơn họ không hề mua được gì.
    kiem('Dấu đã dùng bị xoá -> khách lấy lại quyền dùng mã', soDauSauHuy === '0', `còn ${soDauSauHuy} dòng`);

    const xemTruoc4 = await goi(`/vouchers/preview?code=${MA}&subtotal=350000`, { token });
    kiem('Xem trước lại được sau khi huỷ', xemTruoc4.http === 200,
      `HTTP ${xemTruoc4.http}: ${JSON.stringify(xemTruoc4.body)}`);
  } finally {
    try {
      chaySql(`DELETE FROM voucher_usages WHERE voucher_id=${voucherId}; `
        + `DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE user_id=${uid}); `
        + `DELETE FROM orders WHERE user_id=${uid}; `
        + `DELETE FROM cart_items WHERE cart_id IN (SELECT cart_id FROM carts WHERE user_id=${uid}); `
        + `DELETE FROM carts WHERE user_id=${uid}; `
        + `DELETE FROM addresses WHERE user_id=${uid}; `
        + `DELETE FROM user_roles WHERE user_id=${uid}; `
        + `DELETE FROM users WHERE user_id=${uid}; `
        + `DELETE FROM vouchers WHERE voucher_id=${voucherId};`);
      console.log(`\n  ↺ Đã xoá mã ${MA}, tài khoản ${TEN_DN} và đơn thử.`);
    } catch (e) {
      console.error(`\n  ! Không dọn được: ${e.message}`);
    }
  }

  console.log('');
  console.log(truot === 0 ? `  ✔ ĐẠT — ${dat}/${dat} kiểm tra đúng.`
    : `  ✖ TRƯỢT — ${truot}/${dat + truot} kiểm tra sai.`);
  console.log('');
  process.exit(truot === 0 ? 0 : 1);
}

main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
