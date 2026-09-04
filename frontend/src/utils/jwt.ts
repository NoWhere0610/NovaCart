/**
 * Đọc hạn dùng của JWT ngay ở phía trình duyệt.
 *
 * VÌ SAO CẦN: phiên đăng nhập được khôi phục từ localStorage mà KHÔNG kiểm token còn hạn hay không, nên
 * ứng dụng vẫn tin là đã đăng nhập kể cả khi token đã hết hạn từ lâu. Người dùng chỉ phát hiện khi tình
 * cờ bấm vào một chức năng có gọi API và nhận lỗi -- còn đứng ở trang công khai (trang chủ, danh mục,
 * chi tiết sản phẩm) thì không có gì xảy ra cả, vì các trang đó không cần đăng nhập.
 *
 * KHÔNG phải cơ chế bảo mật: mọi thứ ở đây chỉ để giao diện phản ánh đúng sự thật. Việc chặn truy cập
 * THẬT SỰ vẫn do backend làm khi kiểm chữ ký token.
 */

/**
 * Giải mã phần payload của JWT. Trả về null khi KHÔNG đọc được (sai định dạng, base64 hỏng, không phải
 * JSON) -- phân biệt rõ với trường hợp đọc được nhưng payload không có trường exp, vì hai ca đó phải
 * xử lý ngược nhau: token hỏng thì bắt đăng nhập lại, token không có exp thì để yên.
 */
function decodePayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // JWT dùng base64url: '-' thay '+', '_' thay '/', và không có ký tự đệm '='.
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    // atob() trả chuỗi từng BYTE một (Latin-1). Payload thật là UTF-8, nên phải giải mã lại cho đúng --
    // JSON.parse thẳng kết quả của atob() sẽ hỏng nếu trong token có ký tự tiếng Việt (vd họ tên).
    const bytes = Uint8Array.from(padded ? atob(padded) : '', (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Thời điểm hết hạn (mili giây, chuẩn Unix), hoặc null nếu token hỏng/không có trường exp. */
export function getTokenExpiry(token: string | null): number | null {
  const payload = decodePayload(token);
  if (!payload) return null;
  return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
}

/**
 * Token đã hết hạn chưa.
 *
 * - Không có token, hoặc token KHÔNG đọc được -> coi là hết hạn. Hỏng thì phải hỏng theo hướng đóng:
 *   bắt đăng nhập lại còn hơn hiện giao diện của người đã đăng nhập rồi mọi thao tác đều lỗi.
 * - Đọc được nhưng không có trường exp -> coi là CÒN hạn, để không tự ý đăng xuất nếu sau này backend
 *   đổi cách sinh token.
 */
export function isTokenExpired(token: string | null): boolean {
  const payload = decodePayload(token);
  if (!payload) return true;
  if (typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now();
}
