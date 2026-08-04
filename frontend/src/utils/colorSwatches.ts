// Map tên màu tiếng Việt (lưu trong DB, khớp FULL_COLORS ở ProductDetailPage/ShopPage) sang mã hex thật
// -- dùng để vẽ ô màu (swatch) trực quan thay vì chỉ hiện chữ, đúng chuẩn UX ngành thời trang.
export const COLOR_SWATCHES: Record<string, string> = {
  'Đen': '#1c1917',
  'Trắng': '#ffffff',
  'Xám': '#78716c',
  'Xanh Navy': '#1e3a5f',
  'Xanh Dương': '#2563eb',
  'Xanh Lá': '#16a34a',
  'Xanh Rêu': '#5c6b3f',
  'Be': '#e8dcc4',
  'Nâu': '#78502c',
  'Kem': '#f5f0e1',
  'Đỏ': '#dc2626',
  'Cam': '#ea580c',
  'Vàng': '#eab308',
  'Hồng': '#ec4899',
  'Tím': '#9333ea',
  'Bạc': '#c0c0c0',
}

// Fallback trung tính cho màu lạ chưa có trong bảng (không nên xảy ra với dữ liệu hiện tại, nhưng
// tránh vẽ swatch trống/undefined nếu sau này có màu mới chưa kịp thêm vào bảng).
export function colorToHex(colorName: string): string {
  return COLOR_SWATCHES[colorName] ?? '#a8a29e'
}
