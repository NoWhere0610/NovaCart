/* ============================================================================
   TỰ KIỂM API hồ sơ tài khoản + quên mật khẩu — bắn thẳng vào backend đang chạy.

   VÌ SAO CẦN: mấy tính chất dưới đây nhìn màn hình không thấy được. "Email không tồn tại trả lời y hệt
   email có tài khoản" chẳng hạn — bấm tay hai lần rồi so hai câu bằng mắt thì rất dễ bỏ sót một dấu
   chấm khác nhau, mà chỉ cần khác một chữ là lộ ra email nào đã đăng ký.

   Cách chạy (backend đang chạy):
       node auth-profile-test.js
       node auth-profile-test.js --user admin --pass admin@123 --api http://localhost:8080/api

   GHI THẬT vào cơ sở dữ liệu: kịch bản "lưu số điện thoại hợp lệ" đổi hồ sơ của tài khoản đăng nhập.
   Script tự khôi phục lại giá trị cũ ở cuối, kể cả khi có kịch bản trượt.
   ============================================================================ */

function docThamSo() {
  const a = process.argv.slice(2);
  const lay = (ten, mac) => {
    const i = a.indexOf(`--${ten}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : mac;
  };
  return {
    api: lay('api', 'http://localhost:8080/api'),
    user: lay('user', 'admin'),
    pass: lay('pass', 'admin@123'),
  };
}

const { api, user, pass } = docThamSo();

let token = null;
let soKiemDat = 0;
let soKiemTruot = 0;

async function goi(duongDan, { method = 'GET', body, coToken = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (coToken && token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${api}${duongDan}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let du = null;
  try {
    du = await r.json();
  } catch {
    /* 204 hoặc body rỗng */
  }
  return { http: r.status, body: du };
}

function kiem(ten, dieuKien, chiTiet = '') {
  if (dieuKien) {
    soKiemDat++;
    console.log(`  ✔ ${ten}`);
  } else {
    soKiemTruot++;
    console.log(`  ✖ ${ten}${chiTiet ? `\n      ${chiTiet}` : ''}`);
  }
}

async function main() {
  console.log(`\n  Kiểm ${api} — đăng nhập bằng "${user}"\n`);

  // ---------- Đăng nhập ----------
  const dn = await goi('/auth/login', {
    method: 'POST',
    coToken: false,
    body: { usernameOrEmail: user, password: pass },
  });
  if (dn.http !== 200) {
    console.error(`  ⊘ BỎ QUA: không đăng nhập được (HTTP ${dn.http}). Backend có đang chạy không, `
      + `tài khoản "${user}" có đúng mật khẩu không?`);
    process.exit(0); // 0 = chưa chạy được, KHÁC 1 = chạy ra kết quả sai
  }
  token = dn.body.accessToken;

  // ---------- Hồ sơ ----------
  console.log('  --- Hồ sơ tài khoản ---');

  const khongToken = await goi('/users/me', { coToken: false });
  kiem('Không có token -> 401 (không phải 403)',
    khongToken.http === 401,
    `nhận HTTP ${khongToken.http}. 403 nghĩa là frontend không phân biệt được "hết hạn" với "thiếu quyền".`);

  const hoSo = await goi('/users/me');
  kiem('GET /users/me trả về hồ sơ', hoSo.http === 200 && hoSo.body?.username === user,
    JSON.stringify(hoSo.body));
  const soCu = hoSo.body?.phone ?? null;
  const tenCu = hoSo.body?.fullName ?? null;

  kiem('Cờ thieuSoDienThoai khớp với dữ liệu thật',
    hoSo.body?.thieuSoDienThoai === (!soCu || soCu.trim() === ''),
    `phone=${JSON.stringify(soCu)} nhưng thieuSoDienThoai=${hoSo.body?.thieuSoDienThoai}`);

  kiem('Hồ sơ KHÔNG trả về mật khẩu (kể cả bản băm)',
    !('password' in (hoSo.body ?? {})),
    'ProfileResponse đang lộ trường password ra ngoài');

  const soXau = await goi('/users/me', {
    method: 'PUT',
    body: { fullName: 'Người Kiểm Thử', phone: '0112345678' }, // đầu số 01 không tồn tại
  });
  kiem('Số điện thoại sai định dạng -> 400',
    soXau.http === 400,
    `nhận HTTP ${soXau.http}: ${JSON.stringify(soXau.body)}`);

  const thieuSo = await goi('/users/me', {
    method: 'PUT',
    body: { fullName: 'Người Kiểm Thử', phone: '' },
  });
  kiem('Bỏ trống số điện thoại -> 400 (đây chính là ràng buộc vừa thêm)',
    thieuSo.http === 400,
    `nhận HTTP ${thieuSo.http}: ${JSON.stringify(thieuSo.body)}`);

  const luuTot = await goi('/users/me', {
    method: 'PUT',
    body: { fullName: '  Người Kiểm Thử  ', phone: '  0912345678  ' },
  });
  kiem('Số hợp lệ -> lưu được và khoảng trắng thừa bị cắt',
    luuTot.http === 200 && luuTot.body?.phone === '0912345678'
      && luuTot.body?.fullName === 'Người Kiểm Thử',
    JSON.stringify(luuTot.body));

  kiem('Lưu xong thì cờ thieuSoDienThoai tắt',
    luuTot.body?.thieuSoDienThoai === false);

  // ---------- Đổi mật khẩu ----------
  console.log('\n  --- Đổi mật khẩu ---');

  const saiMk = await goi('/users/me/password', {
    method: 'PUT',
    body: { currentPassword: 'chac-chan-sai-' + Date.now(), newPassword: 'matkhaumoi123' },
  });
  kiem('Sai mật khẩu hiện tại -> 400, không đổi gì',
    saiMk.http === 400,
    `nhận HTTP ${saiMk.http}: ${JSON.stringify(saiMk.body)}`);

  const vanDangNhapDuoc = await goi('/auth/login', {
    method: 'POST',
    coToken: false,
    body: { usernameOrEmail: user, password: pass },
  });
  kiem('Mật khẩu cũ vẫn dùng được sau lần đổi thất bại',
    vanDangNhapDuoc.http === 200,
    'mật khẩu đã bị đổi dù yêu cầu bị từ chối — lỗi nghiêm trọng');

  const mkNgan = await goi('/users/me/password', {
    method: 'PUT',
    body: { currentPassword: pass, newPassword: 'abc' },
  });
  kiem('Mật khẩu mới quá ngắn -> 400',
    mkNgan.http === 400,
    `nhận HTTP ${mkNgan.http}`);

  const mkTrung = await goi('/users/me/password', {
    method: 'PUT',
    body: { currentPassword: pass, newPassword: pass },
  });
  kiem('Mật khẩu mới trùng mật khẩu cũ -> 400',
    mkTrung.http === 400,
    `nhận HTTP ${mkTrung.http}: ${JSON.stringify(mkTrung.body)}`);

  // ---------- Quên mật khẩu ----------
  console.log('\n  --- Quên mật khẩu ---');

  const emailThat = hoSo.body?.email;
  const coThat = await goi('/auth/forgot-password', {
    method: 'POST', coToken: false, body: { email: emailThat },
  });
  const khongCo = await goi('/auth/forgot-password', {
    method: 'POST', coToken: false, body: { email: `khong-ton-tai-${Date.now()}@example.com` },
  });

  if (coThat.http === 503 && khongCo.http === 503) {
    console.log('  ⊘ Chưa cấu hình SMTP — bỏ qua các kiểm về nội dung trả lời.');
    kiem('Chưa cấu hình SMTP thì báo lỗi RÕ RÀNG, không im lặng giả vờ đã gửi',
      /chưa cấu hình gửi email/i.test(coThat.body?.message ?? ''),
      `nhận: ${JSON.stringify(coThat.body)}`);
  } else {
    kiem('Email CÓ tài khoản và email KHÔNG có tài khoản trả lời y hệt nhau',
      coThat.http === khongCo.http
        && JSON.stringify(coThat.body) === JSON.stringify(khongCo.body),
      `có thật: ${coThat.http} ${JSON.stringify(coThat.body)}\n`
      + `      không có: ${khongCo.http} ${JSON.stringify(khongCo.body)}\n`
      + '      Khác nhau = ai cũng dò được email nào đã đăng ký.');
  }

  const emailXau = await goi('/auth/forgot-password', {
    method: 'POST', coToken: false, body: { email: 'khong-phai-email' },
  });
  kiem('Email sai định dạng -> 400', emailXau.http === 400, `nhận HTTP ${emailXau.http}`);

  const maBia = await goi('/auth/reset-password', {
    method: 'POST', coToken: false,
    body: { token: 'ma-bia-hoan-toan-' + Date.now(), newPassword: 'matkhaumoi123' },
  });
  kiem('Mã đặt lại bịa ra -> 400', maBia.http === 400,
    `nhận HTTP ${maBia.http}: ${JSON.stringify(maBia.body)}`);

  // ---------- Khôi phục ----------
  //
  // Kịch bản "lưu số hợp lệ" đổi CẢ HAI trường (fullName lẫn phone) vì PUT /users/me yêu cầu gửi đủ.
  // Bản đầu của script này chỉ nhắc trả lại số điện thoại và ÂM THẦM để nguyên họ tên đã bị ghi đè --
  // đúng kiểu tác dụng phụ lặng lẽ mà một công cụ kiểm thử tuyệt đối không được để lại.
  if (luuTot.http === 200) {
    const khoiPhucDuocQuaApi = soCu && soCu.trim() !== '';
    if (khoiPhucDuocQuaApi) {
      await goi('/users/me', { method: 'PUT', body: { fullName: tenCu ?? user, phone: soCu } });
      console.log(`\n  ↺ Đã trả hồ sơ về như cũ (fullName=${JSON.stringify(tenCu)}, phone=${soCu}).`);
    } else {
      // Số cũ rỗng thì KHÔNG PUT lại được: số điện thoại giờ là trường bắt buộc, gửi rỗng sẽ bị 400.
      // Bắt buộc phải dọn thẳng bằng SQL, và phải dọn cả hai trường.
      console.log(`\n  ↺ Hồ sơ "${user}" trước khi chạy chưa có số điện thoại nên KHÔNG khôi phục qua API được.`);
      console.log('      Chạy câu này để trả về đúng trạng thái cũ:');
      console.log(`          UPDATE users SET phone=${soCu === null ? 'NULL' : `'${soCu}'`}, `
        + `full_name=${tenCu === null ? 'NULL' : `N'${String(tenCu).replace(/'/g, "''")}'`} `
        + `WHERE username='${user}';`);
    }
  }

  console.log('');
  console.log(soKiemTruot === 0
    ? `  ✔ ĐẠT — ${soKiemDat}/${soKiemDat} kiểm tra đúng.`
    : `  ✖ TRƯỢT — ${soKiemTruot}/${soKiemDat + soKiemTruot} kiểm tra sai. Xem log backend.`);
  console.log('');
  process.exit(soKiemTruot === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('LỖI:', e.message, '— backend có đang chạy không?');
  process.exit(1);
});
