/**
 * Kiểm định dạng số điện thoại Việt Nam ngay ở trình duyệt.
 *
 * ĐÂY KHÔNG PHẢI nơi quyết định. Backend vẫn kiểm lại bằng @Pattern trong UpdateProfileRequest và
 * AddressRequest -- ai gọi thẳng API bỏ qua giao diện vẫn bị chặn. Bản ở đây chỉ để người dùng biết
 * mình gõ sai NGAY lúc gõ, thay vì bấm Lưu rồi mới nhận lỗi từ máy chủ.
 *
 * Biểu thức phải KHỚP CHÍNH XÁC với biểu thức bên backend. Lỏng hơn thì người dùng bấm Lưu mới biết
 * sai (đúng cái mà file này sinh ra để tránh); chặt hơn thì chặn oan số hợp lệ mà backend chấp nhận.
 */

/** Bản sao của @Pattern trong UpdateProfileRequest.java / AddressRequest.java. */
const MAU_SO_VN = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/

/** Dùng chung một câu báo lỗi với backend để người dùng không thấy hai cách nói khác nhau. */
export const LOI_SO_DIEN_THOAI =
  'Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 03/05/07/08/09, vd 0912345678)'

/**
 * Số có hợp lệ không.
 *
 * Cắt khoảng trắng hai đầu trước khi so, vì dán số từ tin nhắn/email rất hay dính dấu cách -- bắt lỗi
 * vì lý do đó thì người dùng nhìn vào ô thấy số đúng y nguyên mà vẫn báo sai, không hiểu nổi.
 * Nhưng khoảng trắng Ở GIỮA thì vẫn là sai (vd "0912 345 678"), để không lưu xuống hai định dạng khác
 * nhau cho cùng một số.
 */
export function laSoDienThoaiVN(giaTri: string | null | undefined): boolean {
  if (!giaTri) return false
  return MAU_SO_VN.test(giaTri.trim())
}

/** Số điện thoại rỗng/chưa điền. Khoảng trắng cũng tính là chưa điền. */
export function thieuSoDienThoai(giaTri: string | null | undefined): boolean {
  return !giaTri || giaTri.trim() === ''
}
