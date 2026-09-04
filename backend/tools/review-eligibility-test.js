/* ============================================================================
   TỰ KIỂM quyền viết đánh giá — giao diện hỏi trước, backend chặn sau.

   VÌ SAO CẦN: quy tắc gồm HAI điều kiện ("đã mua và nhận hàng" + "chưa đánh giá lần nào"), và chúng
   được dùng ở HAI nơi -- API hỏi trước để giao diện quyết định có vẽ form không, và lúc thật sự tạo
   đánh giá. Hai nơi lệch nhau là hoặc giao diện cho gõ rồi máy chủ từ chối (đúng lỗi vừa sửa), hoặc
   tệ hơn: giấu form của người thật sự đã mua. Test này bắn cả hai và đối chiếu.

   Cách chạy (backend đang chạy, sqlcmd có trong PATH):
       node review-eligibility-test.js
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
const mot = (c) => chaySql(c).trim().split('\n')[0].trim();

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
const TEN_DN = `kiemdg${t}`.slice(0, 40);

async function main() {
  console.log(`\n  Kiểm quyền viết đánh giá tại ${api}`);
  console.log(`  Tài khoản dùng một lần: ${TEN_DN}\n`);

  const dk = await goi('/auth/register', {
    method: 'POST',
    body: { username: TEN_DN, password: 'matkhau123', email: `${TEN_DN}@example.invalid`, fullName: 'Khách kiểm thử' },
  });
  if (dk.http !== 200) {
    console.error(`  ⊘ BỎ QUA: không đăng ký được (HTTP ${dk.http}). Backend có đang chạy không?`);
    process.exit(0);
  }
  const token = dk.body.accessToken;
  const uid = dk.body.userId;

  const productId = Number(mot(
    `SELECT TOP 1 p.product_id FROM products p JOIN product_variants v ON v.product_id = p.product_id `
    + `WHERE p.status='ACTIVE' ORDER BY p.product_id;`));
  const variantId = Number(mot(`SELECT TOP 1 variant_id FROM product_variants WHERE product_id=${productId};`));

  try {
    // ---------- Chưa mua gì ----------
    console.log('  --- Khách CHƯA mua sản phẩm ---');

    const chuaMua = await goi(`/reviews/products/${productId}/eligibility`, { token });
    kiem('Hỏi quyền -> trả lời KHÔNG được đánh giá',
      chuaMua.http === 200 && chuaMua.body?.coTheDanhGia === false,
      `HTTP ${chuaMua.http}: ${JSON.stringify(chuaMua.body)}`);
    kiem('...kèm lý do đọc được cho khách',
      /mua và nhận hàng/.test(chuaMua.body?.lyDo ?? ''),
      `lyDo = ${JSON.stringify(chuaMua.body?.lyDo)}`);

    const guiLen = await goi(`/reviews/products/${productId}`, {
      method: 'POST', token, body: { rating: 5, comment: 'Thử gõ thẳng API, bỏ qua giao diện' },
    });
    kiem('Gọi THẲNG API tạo đánh giá vẫn bị chặn (không chỉ giấu form)',
      guiLen.http === 400, `HTTP ${guiLen.http}: ${JSON.stringify(guiLen.body)}`);

    // ĐÂY là ca quan trọng nhất: hai đường phải nói CÙNG một câu. Lệch nhau thì giao diện giấu form
    // vì lý do A trong khi máy chủ từ chối vì lý do B, không ai lần ra được.
    kiem('Câu giải thích của hai đường KHỚP TỪNG CHỮ',
      chuaMua.body?.lyDo === guiLen.body?.message,
      `hỏi trước : ${JSON.stringify(chuaMua.body?.lyDo)}\n      lúc gửi  : ${JSON.stringify(guiLen.body?.message)}`);

    // ---------- Đã mua và nhận hàng ----------
    console.log('\n  --- Khách ĐÃ mua và nhận hàng ---');

    const maDon = `KTDG${t}`;
    chaySql(
      `INSERT INTO orders (user_id, order_code, total_amount, subtotal_amount, discount_amount, status, `
      + `payment_method, payment_status, order_type, shipping_fee, version, refund_status, delivered_at, `
      + `created_at, phone, receiver_name, shipping_address) VALUES (${uid}, '${maDon}', 500000, 500000, 0, `
      + `'DELIVERED', 'COD', 'PAID', 'ONLINE', 0, 0, 'NONE', SYSDATETIME(), SYSDATETIME(), '0912345678', `
      + `N'Khách kiểm thử', N'Hà Nội');`);
    const orderId = Number(mot(`SELECT order_id FROM orders WHERE order_code='${maDon}';`));
    chaySql(
      `INSERT INTO order_items (order_id, variant_id, product_name, size, color, unit_price, quantity, subtotal) `
      + `SELECT ${orderId}, ${variantId}, p.product_name, v.size, v.color, 500000, 1, 500000 `
      + `FROM product_variants v JOIN products p ON p.product_id = v.product_id WHERE v.variant_id = ${variantId};`);

    const daMua = await goi(`/reviews/products/${productId}/eligibility`, { token });
    kiem('Hỏi quyền -> ĐƯỢC đánh giá',
      daMua.body?.coTheDanhGia === true, JSON.stringify(daMua.body));
    kiem('...và không kèm lý do nào', daMua.body?.lyDo === null, `lyDo = ${JSON.stringify(daMua.body?.lyDo)}`);

    const tao = await goi(`/reviews/products/${productId}`, {
      method: 'POST', token, body: { rating: 5, comment: 'Áo đẹp, vải mát, đúng size.' },
    });
    kiem('Gửi đánh giá thành công', tao.http === 200, `HTTP ${tao.http}: ${JSON.stringify(tao.body)}`);

    // ---------- Đã đánh giá rồi ----------
    console.log('\n  --- Sau khi đã đánh giá ---');

    const lanHai = await goi(`/reviews/products/${productId}/eligibility`, { token });
    kiem('Hỏi lại -> KHÔNG được đánh giá nữa',
      lanHai.body?.coTheDanhGia === false, JSON.stringify(lanHai.body));
    kiem('...với lý do đã đánh giá rồi',
      /đã đánh giá sản phẩm này rồi/.test(lanHai.body?.lyDo ?? ''),
      `lyDo = ${JSON.stringify(lanHai.body?.lyDo)}`);

    const guiLai = await goi(`/reviews/products/${productId}`, {
      method: 'POST', token, body: { rating: 1, comment: 'Đánh giá lần hai' },
    });
    kiem('Gửi lần hai bị chặn', guiLai.http === 400, `HTTP ${guiLai.http}`);
    kiem('Câu giải thích của hai đường vẫn KHỚP TỪNG CHỮ',
      lanHai.body?.lyDo === guiLai.body?.message,
      `hỏi trước : ${JSON.stringify(lanHai.body?.lyDo)}\n      lúc gửi  : ${JSON.stringify(guiLai.body?.message)}`);

    // ---------- Chưa đăng nhập ----------
    console.log('\n  --- Chưa đăng nhập ---');
    const khongToken = await goi(`/reviews/products/${productId}/eligibility`);
    kiem('Không có token -> 401, không lộ gì', khongToken.http === 401, `HTTP ${khongToken.http}`);
  } finally {
    try {
      chaySql(`DELETE FROM reviews WHERE user_id=${uid}; `
        + `DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE user_id=${uid}); `
        + `DELETE FROM orders WHERE user_id=${uid}; `
        + `DELETE FROM user_roles WHERE user_id=${uid}; `
        + `DELETE FROM carts WHERE user_id=${uid}; `
        + `DELETE FROM users WHERE user_id=${uid};`);
      console.log(`\n  ↺ Đã xoá tài khoản ${TEN_DN}, đơn thử và đánh giá thử.`);
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
