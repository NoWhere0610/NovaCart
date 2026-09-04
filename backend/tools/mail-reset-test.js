/* ============================================================================
   TỰ KIỂM TRỌN VẸN luồng quên mật khẩu, kể cả bước ĐẶT LẠI bằng mã thật.

   VÌ SAO CẦN RIÊNG MỘT SCRIPT: auth-profile-test.js không kiểm được nửa sau của luồng, vì mã đặt lại
   chỉ tồn tại trong email gửi đi -- trong cơ sở dữ liệu chỉ có bản băm, không đọc ngược ra được. Script
   này đi đường vòng đúng đắn: TỰ sinh mã, tự tính băm, ghi thẳng bản băm vào bảng, rồi gọi API bằng mã
   gốc. Nhờ vậy kiểm được cả những ca mà bấm tay gần như không dựng nổi: mã hết hạn, mã dùng lại lần hai.

   Toàn bộ chạy trên một TÀI KHOẢN DÙNG MỘT LẦN do script tự đăng ký rồi tự xoá -- không đụng tới bất kỳ
   tài khoản thật nào.

   Cách chạy (backend đang chạy, sqlcmd có trong PATH):
       node mail-reset-test.js
       node mail-reset-test.js --mail-that email-that-cua-ban@gmail.com   (gửi thêm 1 mail THẬT)

   Tuỳ chọn --mail-that: gửi một yêu cầu đặt lại tới hộp thư thật để tận mắt thấy mail về. Email đó
   PHẢI là email của một tài khoản có thật trong hệ thống, nếu không backend sẽ lặng lẽ không gửi gì
   (đúng thiết kế -- xem PasswordResetService).
   ============================================================================ */
const crypto = require('crypto');
const { execFileSync } = require('child_process');

function docThamSo() {
  const a = process.argv.slice(2);
  const lay = (ten, mac) => {
    const i = a.indexOf(`--${ten}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : mac;
  };
  return {
    api: lay('api', 'http://localhost:8080/api'),
    sql: {
      server: lay('sql-server', 'localhost,1433'),
      db: lay('sql-db', 'menswear_shop'),
      user: lay('sql-user', 'sa'),
      pass: lay('sql-pass', '123456'),
    },
    mailThat: lay('mail-that', ''),
  };
}

const { api, sql, mailThat } = docThamSo();

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

/** Chạy một câu SQL, trả về stdout dạng chuỗi. Dùng execFileSync (mảng tham số) để khỏi lo trích dẫn. */
function chaySql(cau) {
  return execFileSync('sqlcmd', [
    '-S', sql.server, '-U', sql.user, '-P', sql.pass, '-d', sql.db, '-C', '-h', '-1', '-W', '-Q', cau,
  ], { encoding: 'utf8' });
}

/** Băm y hệt PasswordResetService.bam() -- SHA-256 dạng hex. */
const bam = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

async function goi(duongDan, { method = 'GET', body } = {}) {
  const r = await fetch(`${api}${duongDan}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let du = null;
  try {
    du = await r.json();
  } catch {
    /* body rỗng */
  }
  return { http: r.status, body: du };
}

/** Ghi thẳng một vé vào bảng. soPhut âm = vé đã hết hạn. */
function themVe(userId, maGoc, soPhut, daDung = false) {
  chaySql(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at, created_at) VALUES (`
    + `${userId}, '${bam(maGoc)}', DATEADD(MINUTE, ${soPhut}, SYSDATETIME()), `
    + `${daDung ? 'SYSDATETIME()' : 'NULL'}, SYSDATETIME());`,
  );
}

const dauThoiGian = Date.now();
const TEN_DN = `kiemthu${dauThoiGian}`.slice(0, 40);
const EMAIL = `${TEN_DN}@example.invalid`;
const MK_CU = 'matkhaucu123';
const MK_MOI = 'matkhaumoi456';

async function dangNhapDuoc(matKhau) {
  const r = await goi('/auth/login', {
    method: 'POST',
    body: { usernameOrEmail: TEN_DN, password: matKhau },
  });
  return r.http === 200;
}

async function main() {
  console.log(`\n  Kiểm trọn luồng quên mật khẩu tại ${api}`);
  console.log(`  Tài khoản dùng một lần: ${TEN_DN}\n`);

  // ---------- Dựng tài khoản tạm ----------
  const dk = await goi('/auth/register', {
    method: 'POST',
    body: { username: TEN_DN, password: MK_CU, email: EMAIL, fullName: 'Tài khoản kiểm thử' },
  });
  if (dk.http !== 200) {
    console.error(`  ⊘ BỎ QUA: không đăng ký được tài khoản tạm (HTTP ${dk.http}). `
      + 'Backend có đang chạy không?');
    console.error(`      ${JSON.stringify(dk.body)}`);
    process.exit(0); // 0 = chưa chạy được, KHÁC 1 = chạy ra kết quả sai
  }
  const userId = dk.body.userId;

  let doiMatKhauThanhCong = false;
  try {
    // ---------- Mã hợp lệ ----------
    console.log('  --- Mã hợp lệ ---');
    const maTot = `ma-hop-le-${dauThoiGian}`;
    themVe(userId, maTot, 30);

    const dat = await goi('/auth/reset-password', {
      method: 'POST', body: { token: maTot, newPassword: MK_MOI },
    });
    kiem('Mã còn hạn -> đặt lại được', dat.http === 200, `HTTP ${dat.http}: ${JSON.stringify(dat.body)}`);
    doiMatKhauThanhCong = dat.http === 200;

    kiem('Đăng nhập được bằng mật khẩu MỚI', await dangNhapDuoc(MK_MOI));
    // Ca này mới là ca quan trọng: "đổi thành công" mà mật khẩu cũ vẫn dùng được thì tức là chưa đổi gì.
    kiem('Mật khẩu CŨ hết tác dụng', !(await dangNhapDuoc(MK_CU)));

    // ---------- Dùng lại mã ----------
    console.log('\n  --- Dùng lại mã ---');
    const lai = await goi('/auth/reset-password', {
      method: 'POST', body: { token: maTot, newPassword: 'khac-hoan-toan-789' },
    });
    kiem('Mã đã dùng -> từ chối lần hai',
      lai.http === 400 && /đã được sử dụng/i.test(lai.body?.message ?? ''),
      `HTTP ${lai.http}: ${JSON.stringify(lai.body)}`);
    kiem('Mật khẩu KHÔNG bị đổi bởi lần dùng lại', await dangNhapDuoc(MK_MOI));

    // ---------- Mã hết hạn ----------
    console.log('\n  --- Mã hết hạn ---');
    const maHetHan = `ma-het-han-${dauThoiGian}`;
    themVe(userId, maHetHan, -1); // hết hạn từ 1 phút trước
    const hh = await goi('/auth/reset-password', {
      method: 'POST', body: { token: maHetHan, newPassword: 'khac-hoan-toan-789' },
    });
    kiem('Mã quá hạn -> từ chối',
      hh.http === 400 && /hết hạn/i.test(hh.body?.message ?? ''),
      `HTTP ${hh.http}: ${JSON.stringify(hh.body)}`);
    kiem('Mật khẩu KHÔNG bị đổi bởi mã hết hạn', await dangNhapDuoc(MK_MOI));

    // ---------- Đặt lại tiêu hết vé còn treo ----------
    console.log('\n  --- Vé còn treo bị tiêu sau khi đặt lại ---');
    const veTreo = `ma-treo-${dauThoiGian}`;
    const veDung = `ma-dung-${dauThoiGian}`;
    themVe(userId, veTreo, 30);
    themVe(userId, veDung, 30);
    await goi('/auth/reset-password', { method: 'POST', body: { token: veDung, newPassword: MK_CU } });
    const treo = await goi('/auth/reset-password', {
      method: 'POST', body: { token: veTreo, newPassword: 'khac-hoan-toan-789' },
    });
    // Không tiêu thì một link người khác xin trước đó vẫn đặt lại được mật khẩu ngay sau lưng chủ tài khoản.
    kiem('Vé khác còn treo bị tiêu theo, không dùng được nữa',
      treo.http === 400,
      `HTTP ${treo.http}: ${JSON.stringify(treo.body)}`);

    // ---------- Gửi mail thật ----------
    console.log('\n  --- Gửi mail ---');
    const guiChoTamThoi = await goi('/auth/forgot-password', {
      method: 'POST', body: { email: EMAIL },
    });
    if (guiChoTamThoi.http === 503) {
      console.log('  ⊘ Chưa cấu hình SMTP (MAIL_USERNAME/MAIL_PASSWORD) -- bỏ qua phần gửi mail.');
    } else {
      kiem('SMTP nhận thư (máy chủ Gmail chấp nhận, không lỗi xác thực)',
        guiChoTamThoi.http === 200,
        `HTTP ${guiChoTamThoi.http}: ${JSON.stringify(guiChoTamThoi.body)}\n`
        + '      HTTP 500 ở đây thường là sai mật khẩu ứng dụng hoặc bị chặn cổng 587.');

      const soVe = chaySql(
        `SELECT COUNT(*) FROM password_reset_tokens WHERE user_id=${userId} AND used_at IS NULL;`,
      ).trim().split('\n')[0].trim();
      kiem('Vé mới được ghi vào bảng sau khi gửi mail', Number(soVe) >= 1, `đếm được: ${soVe}`);

      const lienTiep = await goi('/auth/forgot-password', { method: 'POST', body: { email: EMAIL } });
      kiem('Xin lại ngay lập tức -> vẫn trả lời y hệt (chặn dội bom mà không lộ gì)',
        lienTiep.http === 200
          && JSON.stringify(lienTiep.body) === JSON.stringify(guiChoTamThoi.body),
        `lần 1: ${JSON.stringify(guiChoTamThoi.body)}\n      lần 2: ${JSON.stringify(lienTiep.body)}`);

      if (mailThat) {
        const that = await goi('/auth/forgot-password', { method: 'POST', body: { email: mailThat } });
        console.log(`\n  ✉  Đã gửi yêu cầu tới ${mailThat} -- HTTP ${that.http}. `
          + 'Mở hộp thư (kể cả Spam) để xem mail có về không.');
      }
    }
  } finally {
    // ---------- Dọn ----------
    // finally: dọn kể cả khi có kịch bản ném lỗi giữa chừng, không để lại tài khoản rác.
    try {
      chaySql(`DELETE FROM password_reset_tokens WHERE user_id=${userId}; `
        + `DELETE FROM user_roles WHERE user_id=${userId}; `
        + `DELETE FROM carts WHERE user_id=${userId}; `
        + `DELETE FROM users WHERE user_id=${userId};`);
      console.log(`\n  ↺ Đã xoá tài khoản tạm ${TEN_DN} (id ${userId}).`);
    } catch (e) {
      console.error(`\n  ! Không xoá được tài khoản tạm ${TEN_DN} (id ${userId}): ${e.message}`);
      console.error(`      Dọn tay: DELETE FROM users WHERE user_id=${userId};`);
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
