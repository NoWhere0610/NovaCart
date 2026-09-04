import { describe, expect, it } from 'vitest'
import { kiemTaiKhoanHoanTien, type RefundAccount } from './RefundAccountFields'

/**
 * Vì sao đáng test: đây là bản sao của quy tắc trong OrderService.requireThongTinHoanTien. Hai bản lệch
 * nhau thì hoặc khách bị chặn oan ở trình duyệt với số tài khoản mà máy chủ chấp nhận, hoặc gõ xong
 * bấm gửi mới nhận lỗi -- đúng cái mà việc kiểm ở trình duyệt sinh ra để tránh.
 *
 * Và hậu quả ở đây nặng hơn kiểm số điện thoại: shop chuyển khoản BẰNG TAY theo đúng những gì lưu
 * được. Lọt một số tài khoản rác thì đến lúc chuyển tiền mới phát hiện, khách đã chờ mấy ngày.
 */

const tk = (p: Partial<RefundAccount>): RefundAccount => ({
  bankName: 'Vietcombank (Ngoại thương)',
  accountNumber: '1234567890',
  accountHolder: 'NGUYEN VAN A',
  ...p,
})

describe('kiemTaiKhoanHoanTien', () => {
  it('đủ và đúng -> không có lỗi', () => {
    expect(kiemTaiKhoanHoanTien(tk({}))).toBeNull()
  })

  it('báo lỗi CỤ THỂ từng ô thiếu, không gộp thành một câu chung', () => {
    // Gộp thành "vui lòng nhập đủ thông tin" thì khách phải tự dò xem thiếu ô nào.
    expect(kiemTaiKhoanHoanTien(tk({ bankName: '' }))).toContain('ngân hàng')
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '' }))).toContain('số tài khoản')
    expect(kiemTaiKhoanHoanTien(tk({ accountHolder: '' }))).toContain('chủ tài khoản')
  })

  it('chuỗi toàn khoảng trắng cũng là bỏ trống', () => {
    expect(kiemTaiKhoanHoanTien(tk({ bankName: '   ' }))).toContain('ngân hàng')
    expect(kiemTaiKhoanHoanTien(tk({ accountHolder: '  ' }))).toContain('chủ tài khoản')
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '   ' }))).toContain('số tài khoản')
  })

  it('số tài khoản dán kèm dấu cách theo nhóm vẫn hợp lệ', () => {
    // Ngân hàng hay hiển thị số tài khoản tách nhóm ("1234 5678 9012"); khách dán nguyên vào mà bị báo
    // sai định dạng thì rất khó hiểu -- họ nhìn vào ô thấy đúng y số của mình.
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '1234 5678 9012' }))).toBeNull()
  })

  it('từ chối số tài khoản có chữ hoặc ký tự lạ', () => {
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '12AB567890' }))).toContain('chữ số')
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '1234-5678' }))).toContain('chữ số')
  })

  it('từ chối độ dài ngoài khoảng 6-20', () => {
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '12345' }))).toContain('6-20')
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '1'.repeat(21) }))).toContain('6-20')
    // Hai đầu mút phải HỢP LỆ -- lỗi lệch một đơn vị ở đây chặn oan số tài khoản thật.
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '123456' }))).toBeNull()
    expect(kiemTaiKhoanHoanTien(tk({ accountNumber: '1'.repeat(20) }))).toBeNull()
  })
})
