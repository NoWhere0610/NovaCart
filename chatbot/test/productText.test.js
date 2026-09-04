/* ============================================================================
   Đoạn văn bản đưa vào kho tri thức phải phản ánh ĐÚNG những phân loại còn hàng.

   Đây là chỗ đã sinh ra lỗi nặng nhất của chatbot: bản cũ ghi size và màu thành 2 danh sách RỜI NHAU
   ("Size: M, L" + "Màu: Đen, Trắng"), nên sản phẩm chỉ còn M/Đen và L/Trắng bị hiểu thành 4 tổ hợp --
   bot khẳng định với khách là còn "size M màu Trắng", một phân loại không hề tồn tại. Đo trên dữ liệu
   thật: hỏi "M/Trắng" ra 65 sản phẩm trong khi chỉ 62 sản phẩm có cặp đó.

   Không cần Postgres, không cần Gemini -- productToText là hàm thuần.
   ============================================================================ */
const test = require('node:test');
const assert = require('node:assert');
const { productToText, sizeColorKeys } = require('../lib/productSync');
const { sha256 } = require('../lib/checksum');

/** Sản phẩm chỉ còn ĐÚNG 2 cặp: M/Đen và L/Trắng. Mọi tổ hợp khác đều không có hàng. */
function sanPhamHaiCap() {
  return {
    maSanPham: '123',
    tenSanPham: 'Áo sơ mi Oxford',
    danhMuc: 'Áo sơ mi',
    thuongHieu: 'Nova',
    gia: 350000,
    chatLieu: 'Cotton Oxford',
    moTa: 'Áo sơ mi công sở',
    sizes: ['L', 'M'],
    colors: ['Trắng', 'Đen'],
    bienThe: [
      { size: 'M', color: 'Đen' },
      { size: 'L', color: 'Trắng' },
    ],
  };
}

test('liệt kê theo CẶP size/màu, không tách thành 2 danh sách rời nhau', () => {
  const text = productToText(sanPhamHaiCap());

  assert.match(text, /M\/Đen/, 'phải nêu cặp M/Đen');
  assert.match(text, /L\/Trắng/, 'phải nêu cặp L/Trắng');
  assert.ok(!/M\/Trắng/.test(text), 'KHÔNG được xuất hiện tổ hợp M/Trắng (không tồn tại)');
  assert.ok(!/L\/Đen/.test(text), 'KHÔNG được xuất hiện tổ hợp L/Đen (không tồn tại)');
  assert.ok(
    !/^Size còn hàng:/m.test(text) && !/^Màu còn hàng:/m.test(text),
    'không được quay lại kiểu 2 dòng size/màu rời nhau',
  );
});

test('kèm mã sản phẩm và đường dẫn để bot dẫn khách về đúng trang', () => {
  const text = productToText(sanPhamHaiCap());
  assert.match(text, /\/products\/123/);
});

test('nói rõ giá chỉ là giá tham khảo (dữ liệu đồng bộ có thể đã cũ)', () => {
  const text = productToText(sanPhamHaiCap());
  assert.match(text, /tham khảo/i);
});

test('khoá lọc size|màu viết thường, khớp đúng số cặp có thật', () => {
  const keys = sizeColorKeys(sanPhamHaiCap());
  assert.deepStrictEqual(keys, ['m|đen', 'l|trắng']);
  assert.ok(!keys.includes('m|trắng'), 'khoá của tổ hợp không tồn tại không được sinh ra');
});

test('checksum ổn định: cùng dữ liệu -> cùng mã, đổi giá -> đổi mã', () => {
  const a = sanPhamHaiCap();
  const b = sanPhamHaiCap();
  assert.strictEqual(sha256(productToText(a)), sha256(productToText(b)),
    'checksum không ổn định thì mỗi giờ đồng bộ lại nhúng toàn bộ danh mục, đốt sạch hạn mức Gemini');

  const doiGia = sanPhamHaiCap();
  doiGia.gia = 420000;
  assert.notStrictEqual(sha256(productToText(a)), sha256(productToText(doiGia)),
    'đổi giá mà checksum không đổi thì bot đọc giá cũ mãi mãi');
});

test('checksum đổi khi một cặp size/màu bán hết', () => {
  const a = sanPhamHaiCap();
  const b = sanPhamHaiCap();
  b.bienThe = [{ size: 'M', color: 'Đen' }]; // L/Trắng đã bán hết
  assert.notStrictEqual(sha256(productToText(a)), sha256(productToText(b)));
});

test('sản phẩm không thương hiệu / không mô tả vẫn sinh được văn bản', () => {
  const p = sanPhamHaiCap();
  p.thuongHieu = null;
  p.moTa = null;
  p.chatLieu = null;
  const text = productToText(p);
  assert.match(text, /Áo sơ mi Oxford/);
  assert.ok(!/null/.test(text), 'không được để lọt chữ "null" vào kho tri thức');
});
