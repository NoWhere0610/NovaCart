/* ============================================================================
   THÍ NGHIỆM ĐỒNG THỜI — chứng minh khoá bi quan thật sự bảo vệ được tồn kho.

   VÌ SAO KHÔNG PHẢI UNIT TEST: khoá bi quan (findByIdForUpdate) là hành vi của SQL Server, không phải
   của mã Java. Một unit test chỉ chứng minh được là mã CÓ GỌI hàm khoá -- đúng, nhưng vô nghĩa. Muốn
   biết khoá có tác dụng hay không thì phải có 2 transaction thật chạy song song trên cơ sở dữ liệu thật.

   Kịch bản: đặt tồn kho một phân loại về đúng N, rồi bắn N+K request "thêm 1 sản phẩm vào hoá đơn POS"
   CÙNG LÚC từ N+K hoá đơn khác nhau.
     - Có khoá đúng : đúng N request thành công, K request bị từ chối, tồn kho về 0 (không bao giờ âm).
     - Không có khoá: nhiều hơn N request thành công, tồn kho âm -> đã bán vượt kho.

   Script TỰ DỌN: mọi hoá đơn nó tạo đều bị huỷ ở cuối, và việc huỷ hoàn lại kho. Chạy xong, tồn kho
   trở về đúng số ban đầu -- an toàn để chạy trên dữ liệu sắp dùng để trình bày.

   Cách chạy (backend phải đang chạy):
       node race-stock.js --variant 1700
       node race-stock.js --variant 1700 --requests 12 --user admin --pass admin@123
   ============================================================================ */
const BASE = process.env.NOVACART_API || 'http://localhost:8080/api';

function docThamSo() {
  const a = process.argv.slice(2);
  const lay = (ten, mac) => {
    const i = a.indexOf(`--${ten}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : mac;
  };
  return {
    variantId: Number(lay('variant', 0)),
    soRequest: Number(lay('requests', 10)),
    username: lay('user', 'admin'),
    password: lay('pass', 'admin@123'),
  };
}

async function goi(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await r.json(); } catch { /* 204 No Content */ }
  return { status: r.status, body: json };
}

/** Đưa tồn kho của phân loại về đúng `dich` bằng API điều chỉnh theo mức thay đổi. */
async function datTonKho(token, variantId, hienTai, dich) {
  const delta = dich - hienTai;
  if (delta === 0) return dich;
  const r = await goi('PATCH', `/admin/inventory/${variantId}/stock`, { delta }, token);
  if (r.status !== 200) throw new Error(`Không đặt được tồn kho: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.stockQuantity;
}

/** Tìm phân loại trong danh sách sản phẩm quản trị (API không có endpoint lấy 1 variant lẻ). */
async function timBienThe(token, variantId) {
  for (let page = 0; page < 20; page++) {
    const r = await goi('GET', `/admin/products?page=${page}&size=50`, undefined, token);
    if (r.status !== 200) throw new Error(`Không đọc được danh sách sản phẩm: ${r.status}`);
    for (const p of r.body.content) {
      const v = p.variants.find((x) => x.variantId === variantId);
      if (v) return { product: p, variant: v };
    }
    if (r.body.last) break;
  }
  return null;
}

async function main() {
  const { variantId, soRequest, username, password } = docThamSo();
  if (!variantId) {
    console.error('Thiếu --variant <variantId>. Ví dụ: node race-stock.js --variant 1700');
    process.exit(2);
  }

  const dn = await goi('POST', '/auth/login', { usernameOrEmail: username, password });
  if (dn.status !== 200) {
    console.error(`Đăng nhập thất bại (${dn.status}). Dùng --user/--pass để truyền tài khoản khác.`);
    process.exit(2);
  }
  const token = dn.body.accessToken;

  const tim = await timBienThe(token, variantId);
  if (!tim) {
    console.error(`Không tìm thấy phân loại có variantId = ${variantId}.`);
    process.exit(2);
  }
  const tenDayDu = `${tim.product.productName} (${tim.variant.size}/${tim.variant.color})`;
  const khoBanDau = tim.variant.stockQuantity;

  // Tồn kho thí nghiệm: nhỏ hơn hẳn số request để chắc chắn có tranh chấp.
  const khoThiNghiem = Math.max(1, Math.floor(soRequest / 2));

  console.log('');
  console.log(`  Phân loại   : ${tenDayDu}  [variantId=${variantId}]`);
  console.log(`  Tồn kho ban đầu: ${khoBanDau}`);
  console.log(`  Đặt tồn kho về : ${khoThiNghiem}`);
  console.log(`  Số request bắn song song: ${soRequest} (mỗi request mua 1)`);
  console.log('');

  const hoaDon = [];
  let khoSau = khoBanDau;
  try {
    khoSau = await datTonKho(token, variantId, khoBanDau, khoThiNghiem);

    // Tạo trước các hoá đơn POS rỗng -- phần này CỐ Ý chạy tuần tự, tranh chấp phải nằm ở bước sau.
    for (let i = 0; i < soRequest; i++) {
      const r = await goi('POST', '/admin/pos/invoices', {}, token);
      if (r.status !== 200) throw new Error(`Không tạo được hoá đơn POS: ${r.status}`);
      hoaDon.push(r.body.orderId);
    }

    // ===== Phần thí nghiệm: bắn TẤT CẢ cùng lúc =====
    const batDau = Date.now();
    const ketQua = await Promise.all(hoaDon.map((orderId) =>
      goi('POST', `/admin/pos/invoices/${orderId}/items`, { variantId, quantity: 1 }, token)));
    const mili = Date.now() - batDau;

    const thanhCong = ketQua.filter((x) => x.status === 200).length;
    const tuChoi = ketQua.length - thanhCong;

    const sau = await timBienThe(token, variantId);
    const khoConLai = sau.variant.stockQuantity;

    console.log(`  Bắn xong trong ${mili}ms`);
    console.log(`  Thành công : ${thanhCong}`);
    console.log(`  Bị từ chối : ${tuChoi}`);
    console.log(`  Tồn kho còn lại: ${khoConLai}`);
    console.log('');

    const dungSoBan = thanhCong === khoThiNghiem;
    const khongAm = khoConLai >= 0;
    const canDoi = thanhCong + khoConLai === khoThiNghiem;

    console.log(`  ${dungSoBan ? '✔' : '✖'} bán ra đúng ${khoThiNghiem} (đúng bằng tồn kho), không hơn`);
    console.log(`  ${khongAm ? '✔' : '✖'} tồn kho không âm`);
    console.log(`  ${canDoi ? '✔' : '✖'} cân đối sổ sách: đã bán ${thanhCong} + còn lại ${khoConLai} = ${khoThiNghiem}`);

    const mauTuChoi = ketQua.find((x) => x.status !== 200);
    if (mauTuChoi) {
      console.log(`\n  Thông báo cho request bị từ chối: "${mauTuChoi.body && mauTuChoi.body.message}"`);
    }

    console.log('');
    if (dungSoBan && khongAm && canDoi) {
      console.log('  ✔ ĐẠT — khoá bi quan tuần tự hoá được các giao dịch trừ kho chạy song song.');
    } else {
      console.log('  ✖ TRƯỢT — đã bán vượt kho. Kiểm lại findByIdForUpdate trong PosOrderService.addItem.');
    }
    process.exitCode = (dungSoBan && khongAm && canDoi) ? 0 : 1;
  } finally {
    // Dọn: huỷ mọi hoá đơn đã tạo (thao tác này hoàn kho), rồi trả tồn kho về đúng số ban đầu.
    for (const orderId of hoaDon) {
      await goi('DELETE', `/admin/pos/invoices/${orderId}`, undefined, token).catch(() => {});
    }
    const cuoi = await timBienThe(token, variantId).catch(() => null);
    if (cuoi) {
      await datTonKho(token, variantId, cuoi.variant.stockQuantity, khoBanDau).catch(() => {});
      const kiem = await timBienThe(token, variantId).catch(() => null);
      console.log(`\n  Đã dọn: huỷ ${hoaDon.length} hoá đơn, tồn kho trả về ${kiem ? kiem.variant.stockQuantity : '?'}`
        + ` (ban đầu ${khoBanDau}).`);
    }
  }
}

main().catch((e) => {
  console.error('LỖI:', e.message);
  process.exit(1);
});
