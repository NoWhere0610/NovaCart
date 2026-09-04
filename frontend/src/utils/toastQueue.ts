/**
 * Xếp toast mới vào hàng đợi, giữ tối đa `toiDa` cái.
 *
 * Tách khỏi ToastContext để test được: đây là phần duy nhất trong cơ chế toast có logic thật sự (còn
 * lại là render và hẹn giờ), mà nó lại là chỗ rất dễ lệch một đơn vị -- cắt nhầm một vị trí thì hoặc
 * hiện 4 cái, hoặc nuốt mất chính cái vừa bắn.
 *
 * Bỏ đi cái CŨ NHẤT chứ không chặn cái mới: người dùng quan tâm tới việc vừa xảy ra, không phải việc
 * xảy ra ba thao tác trước.
 */
export function themVaoHangDoi<T>(danhSach: readonly T[], toastMoi: T, toiDa: number): T[] {
  if (toiDa <= 0) return []
  // Cắt sao cho sau khi thêm cái mới thì tổng đúng bằng toiDa.
  const giuLai = danhSach.length >= toiDa ? danhSach.slice(danhSach.length - toiDa + 1) : danhSach
  return [...giuLai, toastMoi]
}
