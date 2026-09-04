/* ============================================================================
   TỰ KIỂM TRỌN LUỒNG HOÀN TIỀN — khách khai tài khoản -> admin thấy -> admin xác nhận đã chuyển.

   VÌ SAO CẦN: luồng này đi qua HAI vai (khách và admin) và BA bước cách nhau về thời gian. Bấm tay thì
   phải đăng nhập/đăng xuất qua lại, mà ca đáng lo nhất lại gần như không dựng tay nổi: "duyệt trả hàng
   KHÔNG được tự động biến thành đã hoàn tiền". Nhìn màn hình thì hai trạng thái đó trông giống nhau.

   Toàn bộ chạy trên MỘT tài khoản + MỘT đơn hàng dùng một lần, do script tự tạo rồi tự xoá.

   Cách chạy (backend đang chạy, sqlcmd có trong PATH):
       node refund-flow-test.js
       node refund-flow-test.js --admin admin --admin-pass admin@123
   ============================================================================ */
const { execFileSync } = require('child_process');

function docThamSo() {
  const a = process.argv.slice(2);
  const lay = (ten, mac) => {
    const i = a.indexOf(`--${ten}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : mac;
  };
  return {
    api: lay('api', 'http://localhost:8080/api'),
    admin: lay('admin', 'admin'),
    adminPass: lay('admin-pass', 'admin@123'),
    sql: {
      server: lay('sql-server', 'localhost,1433'),
      db: lay('sql-db', 'menswear_shop'),
      user: lay('sql-user', 'sa'),
      pass: lay('sql-pass', '123456'),
    },
  };
}

const { api, admin, adminPass, sql } = docThamSo();

let soDat = 0;
let soTruot = 0;

function kiem(ten, dieuKien, chiTiet = '') {
  if (dieuKien) {
    soDat++;
    console.log(`  ✔ ${ten}`);
  } else {
    soTruot++;
    console.log(`  ✖ ${ten}${chiTiet ? `\n      ${chiTiet}` : ''}`);
  }
}

function chaySql(cau) {
  return execFileSync('sqlcmd', [
    '-S', sql.server, '-U', sql.user, '-P', sql.pass, '-d', sql.db, '-C', '-h', '-1', '-W', '-Q', cau,
  ], { encoding: 'utf8' });
}

async function goi(duongDan, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${api}${duongDan}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let du = null;
  try { du = await r.json(); } catch { /* body rỗng */ }
  return { http: r.status, body: du };
}

const dau = Date.now();
const TEN_DN = `kiemhoan${dau}`.slice(0, 40);
const MK = 'matkhau123';

async function main() {
  console.log(`\n  Kiểm luồng hoàn tiền tại ${api}`);
  console.log(`  Tài khoản khách dùng một lần: ${TEN_DN}\n`);

  // ---------- Dựng khách + đơn đã giao ----------
  const dk = await goi('/auth/register', {
    method: 'POST',
    body: { username: TEN_DN, password: MK, email: `${TEN_DN}@example.invalid`, fullName: 'Khách kiểm thử' },
  });
  if (dk.http !== 200) {
    console.error(`  ⊘ BỎ QUA: không đăng ký được khách (HTTP ${dk.http}). Backend có đang chạy không?`);
    process.exit(0);
  }
  const tokenKhach = dk.body.accessToken;
  const userId = dk.body.userId;

  const dnAdmin = await goi('/auth/login', {
    method: 'POST', body: { usernameOrEmail: admin, password: adminPass },
  });
  if (dnAdmin.http !== 200) {
    console.error(`  ⊘ BỎ QUA: không đăng nhập được admin "${admin}" (HTTP ${dnAdmin.http}).`);
    chaySql(`DELETE FROM user_roles WHERE user_id=${userId}; DELETE FROM users WHERE user_id=${userId};`);
    process.exit(0);
  }
  const tokenAdmin = dnAdmin.body.accessToken;

  // Đơn COD ĐÃ GIAO và ĐÃ XÁC NHẬN THU TIỀN (admin bấm "Xác nhận đã thu tiền COD" -- payment_status
  // chuyển sang PAID). Trước đây đơn COD giữ 'UNPAID' vĩnh viễn vì không có bước xác nhận nào, và điều
  // đó buộc luồng hoàn tiền phải suy đoán "đã giao thì coi như đã thu tiền" -- suy đoán gãy ngay khi
  // đơn giao HỎNG bị đóng nhầm thành "đã giao". Nay không còn chỗ nào phải đoán.
  const maDon = `KT${dau}`;
  chaySql(
    `INSERT INTO orders (user_id, order_code, total_amount, subtotal_amount, discount_amount, `
    + `status, payment_method, payment_status, order_type, shipping_fee, version, refund_status, `
    + `delivered_at, created_at, phone, receiver_name, shipping_address) VALUES (`
    + `${userId}, '${maDon}', 500000, 500000, 0, 'DELIVERED', 'COD', 'PAID', 'ONLINE', 0, 0, 'NONE', `
    + `DATEADD(DAY,-2,SYSDATETIME()), SYSDATETIME(), '0912345678', N'Khách kiểm thử', N'Hà Nội');`,
  );
  const orderId = Number(chaySql(`SELECT order_id FROM orders WHERE order_code='${maDon}';`).trim().split('\n')[0].trim());

  let da = { orderId };
  try {
    // ---------- Khách gửi yêu cầu ----------
    console.log('  --- Khách yêu cầu trả hàng ---');

    const thieuTk = await goi(`/orders/${orderId}/request-return`, {
      method: 'POST', token: tokenKhach, body: { reason: 'Sản phẩm bị lỗi đường may' },
    });
    kiem('Đơn COD đã thu tiền, KHÔNG khai tài khoản -> bị từ chối',
      thieuTk.http === 400,
      `HTTP ${thieuTk.http}: ${JSON.stringify(thieuTk.body)}\n`
      + '      Ca này lọt nghĩa là hệ thống quên đòi tài khoản cho đơn đã thu được tiền thật.');

    const trangThaiSauKhiTruot = chaySql(
      `SELECT status FROM orders WHERE order_id=${orderId};`).trim().split('\n')[0].trim();
    kiem('Yêu cầu bị từ chối thì đơn KHÔNG bị sửa dở dang',
      trangThaiSauKhiTruot === 'DELIVERED',
      `đơn đang ở trạng thái ${trangThaiSauKhiTruot}, đáng lẽ vẫn phải là DELIVERED`);

    // Ca NGƯỢC LẠI, quan trọng ngang ca trên: đơn COD đã giao nhưng CHƯA ai xác nhận thu được tiền
    // (vd giao hỏng, hàng quay về). Không được đòi tài khoản, và tuyệt đối không được sinh khoản phải
    // hoàn -- nếu không admin sẽ chuyển tiền cho người chưa trả đồng nào.
    const maDonChuaThu = `KT2${dau}`;
    chaySql(
      `INSERT INTO orders (user_id, order_code, total_amount, subtotal_amount, discount_amount, `
      + `status, payment_method, payment_status, order_type, shipping_fee, version, refund_status, `
      + `delivered_at, created_at, phone, receiver_name, shipping_address) VALUES (`
      + `${userId}, '${maDonChuaThu}', 500000, 500000, 0, 'DELIVERED', 'COD', 'UNPAID', 'ONLINE', 0, 0, 'NONE', `
      + `DATEADD(DAY,-2,SYSDATETIME()), SYSDATETIME(), '0912345678', N'Khách kiểm thử', N'Hà Nội');`,
    );
    const idChuaThu = Number(
      chaySql(`SELECT order_id FROM orders WHERE order_code='${maDonChuaThu}';`).trim().split('\n')[0].trim());
    const chuaThu = await goi(`/orders/${idChuaThu}/request-return`, {
      method: 'POST', token: tokenKhach, body: { reason: 'Giao hỏng, hàng quay về' },
    });
    kiem('Đơn COD CHƯA xác nhận thu tiền: trả hàng được mà KHÔNG đòi tài khoản',
      chuaThu.http === 200, `HTTP ${chuaThu.http}: ${JSON.stringify(chuaThu.body)}`);
    kiem('...và KHÔNG sinh khoản phải hoàn (chưa ai trả đồng nào)',
      chuaThu.body?.refundStatus === 'NONE', `refundStatus = ${chuaThu.body?.refundStatus}`);

    const stkXau = await goi(`/orders/${orderId}/request-return`, {
      method: 'POST', token: tokenKhach,
      body: { reason: 'Lỗi', refundBankName: 'Vietcombank', refundAccountNumber: '12AB', refundAccountHolder: 'A' },
    });
    kiem('Số tài khoản sai định dạng -> bị từ chối', stkXau.http === 400, `HTTP ${stkXau.http}`);

    const guiDu = await goi(`/orders/${orderId}/request-return`, {
      method: 'POST', token: tokenKhach,
      body: {
        reason: 'Sản phẩm bị lỗi đường may',
        refundBankName: 'Vietcombank (Ngoại thương)',
        refundAccountNumber: '1234 5678 9012', // cố tình dán kèm dấu cách
        refundAccountHolder: '  NGUYEN VAN A  ',
      },
    });
    kiem('Khai đủ -> gửi được yêu cầu',
      guiDu.http === 200 && guiDu.body?.status === 'RETURN_REQUESTED',
      `HTTP ${guiDu.http}: ${JSON.stringify(guiDu.body?.status)}`);
    kiem('Đơn chuyển sang "chờ hoàn tiền"', guiDu.body?.refundStatus === 'PENDING',
      `refundStatus = ${guiDu.body?.refundStatus}`);
    kiem('Dấu cách trong số tài khoản được dọn sạch',
      guiDu.body?.refundAccountNumber === '123456789012',
      `lưu thành: ${JSON.stringify(guiDu.body?.refundAccountNumber)}`);
    kiem('Tên chủ tài khoản được cắt khoảng trắng',
      guiDu.body?.refundAccountHolder === 'NGUYEN VAN A',
      `lưu thành: ${JSON.stringify(guiDu.body?.refundAccountHolder)}`);

    // ---------- Admin nhìn thấy ----------
    console.log('\n  --- Admin xem thông tin hoàn tiền ---');

    const adminXem = await goi(`/admin/orders/${orderId}`, { token: tokenAdmin });
    kiem('Admin đọc được đủ 3 thông tin để đi chuyển khoản',
      adminXem.body?.refundBankName === 'Vietcombank (Ngoại thương)'
        && adminXem.body?.refundAccountNumber === '123456789012'
        && adminXem.body?.refundAccountHolder === 'NGUYEN VAN A',
      JSON.stringify({
        bank: adminXem.body?.refundBankName,
        stk: adminXem.body?.refundAccountNumber,
        chu: adminXem.body?.refundAccountHolder,
      }));

    // ---------- Thứ tự bắt buộc ----------
    console.log('\n  --- Thứ tự các bước ---');

    const somQua = await goi(`/admin/orders/${orderId}/confirm-refund`, { method: 'PATCH', token: tokenAdmin });
    kiem('Chưa duyệt trả hàng mà xác nhận hoàn tiền -> bị chặn',
      somQua.http === 400,
      `HTTP ${somQua.http}: ${JSON.stringify(somQua.body)}`);

    const duyet = await goi(`/admin/orders/${orderId}/status`, {
      method: 'PUT', token: tokenAdmin, body: { status: 'RETURNED' },
    });
    kiem('Admin duyệt trả hàng', duyet.http === 200 && duyet.body?.status === 'RETURNED',
      `HTTP ${duyet.http}: ${JSON.stringify(duyet.body?.status)}`);

    // ĐÂY LÀ CA QUAN TRỌNG NHẤT: đúng cái lỗi mà toàn bộ việc này sinh ra để sửa.
    kiem('Duyệt trả hàng KHÔNG tự biến thành "đã hoàn tiền"',
      duyet.body?.refundStatus === 'PENDING',
      `refundStatus = ${duyet.body?.refundStatus}. Nhảy thẳng sang COMPLETED nghĩa là hệ thống lại `
      + 'đang báo đã hoàn tiền trong khi chưa ai chuyển đồng nào.');

    // ---------- Xác nhận đã chuyển ----------
    console.log('\n  --- Admin xác nhận đã chuyển tiền ---');

    const xacNhan = await goi(`/admin/orders/${orderId}/confirm-refund`, { method: 'PATCH', token: tokenAdmin });
    kiem('Xác nhận được sau khi đã duyệt trả hàng',
      xacNhan.http === 200 && xacNhan.body?.refundStatus === 'COMPLETED',
      `HTTP ${xacNhan.http}: ${JSON.stringify(xacNhan.body?.refundStatus)}`);
    kiem('Có ghi mốc thời gian hoàn tiền', Boolean(xacNhan.body?.refundCompletedAt),
      `refundCompletedAt = ${xacNhan.body?.refundCompletedAt}`);

    const lanHai = await goi(`/admin/orders/${orderId}/confirm-refund`, { method: 'PATCH', token: tokenAdmin });
    kiem('Bấm xác nhận lần hai -> bị chặn', lanHai.http === 400,
      `HTTP ${lanHai.http}: ${JSON.stringify(lanHai.body)}`);

    // ---------- Khách thấy kết quả ----------
    const khachXem = await goi(`/orders/${orderId}`, { token: tokenKhach });
    kiem('Khách thấy đơn đã hoàn tiền xong',
      khachXem.body?.refundStatus === 'COMPLETED' && Boolean(khachXem.body?.refundCompletedAt),
      JSON.stringify({ refundStatus: khachXem.body?.refundStatus }));
  } finally {
    try {
      chaySql(`DELETE FROM orders WHERE order_id=${da.orderId}; `
        + `DELETE FROM user_roles WHERE user_id=${userId}; `
        + `DELETE FROM carts WHERE user_id=${userId}; `
        + `DELETE FROM users WHERE user_id=${userId};`);
      console.log(`\n  ↺ Đã xoá đơn ${da.orderId} và tài khoản ${TEN_DN}.`);
    } catch (e) {
      console.error(`\n  ! Không dọn được dữ liệu thử: ${e.message}`);
      console.error(`      Dọn tay: DELETE FROM orders WHERE order_id=${da.orderId}; `
        + `DELETE FROM users WHERE user_id=${userId};`);
    }
  }

  console.log('');
  console.log(soTruot === 0
    ? `  ✔ ĐẠT — ${soDat}/${soDat} kiểm tra đúng.`
    : `  ✖ TRƯỢT — ${soTruot}/${soDat + soTruot} kiểm tra sai. Xem log backend.`);
  console.log('');
  process.exit(soTruot === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('LỖI:', e.message);
  process.exit(1);
});
