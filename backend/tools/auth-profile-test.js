/* ============================================================================
   TỰ KIỂM API hồ sơ tài khoản + quên mật khẩu — bắn thẳng vào backend đang chạy.

   VÌ SAO CẦN: mấy tính chất dưới đây nhìn màn hình không thấy được. "Email không tồn tại trả lời y hệt
   email có tài khoản" chẳng hạn — bấm tay hai lần rồi so hai câu bằng mắt thì rất dễ bỏ sót một dấu
   chấm khác nhau, mà chỉ cần khác một chữ là lộ ra email nào đã đăng ký.

   Cách chạy (backend đang chạy, sqlcmd có trong PATH):
       node auth-profile-test.js
       node auth-profile-test.js --api http://localhost:8080/api

   Chạy trên TÀI KHOẢN DÙNG MỘT LẦN do script tự đăng ký rồi tự xoá -- không đụng tới tài khoản thật nào.
   ============================================================================ */

function docThamSo() {
  const a = process.argv.slice(2);
  const lay = (ten, mac) => {
    const i = a.indexOf(`--${ten}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : mac;
  };
  return {
    api: lay('api', 'http://localhost:8080/api'),
    sql: {
      server: lay('sql-server', 'localhost,1433'), db: lay('sql-db', 'menswear_shop'),
      user: lay('sql-user', 'sa'), pass: lay('sql-pass', '123456'),
    },
  };
}

const { api, sql } = docThamSo();

/*
 * Tài khoản DÙNG MỘT LẦN, script tự đăng ký rồi tự xoá.
 *
 * Bản trước dùng thẳng tài khoản `admin` thật. Sai lầm: kịch bản "lưu hồ sơ hợp lệ" GHI ĐÈ họ tên và
 * số điện thoại của admin, mà bước khôi phục lại không chạy được khi số điện thoại ban đầu để trống
 * (số điện thoại nay là trường bắt buộc, không PUT lại giá trị rỗng được). Kết quả: mỗi lần chạy công
 * cụ là tên admin bị đổi thành "Người Kiểm Thử" và nằm lại đó -- một công cụ kiểm thử KHÔNG được để
 * lại dấu vết trên dữ liệu thật, dù chỉ là một cái tên.
 */
const dau = Date.now();
const TEN_DN = `kiemhoso${dau}`.slice(0, 40);
const MK = 'matkhau123';

const chaySql = (c) => require('child_process').execFileSync('sqlcmd',
  ['-S', sql.server, '-U', sql.user, '-P', sql.pass, '-d', sql.db, '-C', '-h', '-1', '-W', '-Q', c],
  { encoding: 'utf8' });

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

let userId = null;
const user = TEN_DN;
const pass = MK;

async function main() {
  console.log(`\n  Kiểm ${api}`);
  console.log(`  Tài khoản dùng một lần: ${TEN_DN}\n`);

  // ---------- Dựng tài khoản tạm ----------
  const dk = await goi('/auth/register', {
    method: 'POST',
    coToken: false,
    body: { username: TEN_DN, password: MK, email: `${TEN_DN}@example.invalid`, fullName: 'Khách kiểm thử' },
  });
  if (dk.http !== 200) {
    console.error(`  ⊘ BỎ QUA: không đăng ký được tài khoản tạm (HTTP ${dk.http}). `
      + 'Backend có đang chạy không?');
    process.exit(0); // 0 = chưa chạy được, KHÁC 1 = chạy ra kết quả sai
  }
  token = dk.body.accessToken;
  userId = dk.body.userId;

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

  // ---------- Dọn ----------
  //
  // Xoá hẳn tài khoản tạm. Không còn bước "khôi phục hồ sơ về như cũ" nữa vì không có gì để khôi phục
  // -- tài khoản này sinh ra chỉ để bị sửa. Bản trước dùng tài khoản admin thật nên phải khôi phục, và
  // bước khôi phục đó lại không chạy được khi số điện thoại ban đầu để trống.
  try {
    chaySql(`DELETE FROM password_reset_tokens WHERE user_id=${userId}; `
      + `DELETE FROM user_roles WHERE user_id=${userId}; `
      + `DELETE FROM carts WHERE user_id=${userId}; `
      + `DELETE FROM users WHERE user_id=${userId};`);
    console.log(`\n  ↺ Đã xoá tài khoản tạm ${TEN_DN}.`);
  } catch (e) {
    console.error(`\n  ! Không xoá được tài khoản tạm ${TEN_DN} (id ${userId}): ${e.message}`);
    console.error(`      Dọn tay: DELETE FROM users WHERE user_id=${userId};`);
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
