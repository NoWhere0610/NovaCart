import { describe, expect, it } from 'vitest'
import { laSoDienThoaiVN, thieuSoDienThoai } from './phone'

/**
 * Vì sao đáng test: biểu thức này là BẢN SAO của @Pattern bên backend. Hai bản lệch nhau thì hoặc người
 * dùng bị chặn oan ở trình duyệt với số mà máy chủ chấp nhận, hoặc gõ xong bấm Lưu mới nhận lỗi -- đúng
 * cái mà việc kiểm ở trình duyệt sinh ra để tránh. Các ca dưới đây bám sát đúng những nhóm số mà biểu
 * thức bên backend cho qua.
 */
describe('laSoDienThoaiVN', () => {
  it('nhận các đầu số di động Việt Nam hiện hành', () => {
    for (const so of ['0912345678', '0387654321', '0567890123', '0777777777', '0888888888']) {
      expect(laSoDienThoaiVN(so), so).toBe(true)
    }
  })

  it('nhận dạng +84', () => {
    expect(laSoDienThoaiVN('+84912345678')).toBe(true)
  })

  it('từ chối đầu số không tồn tại (01/02/04/06)', () => {
    for (const so of ['0112345678', '0212345678', '0412345678', '0612345678']) {
      expect(laSoDienThoaiVN(so), so).toBe(false)
    }
  })

  it('từ chối sai độ dài', () => {
    expect(laSoDienThoaiVN('091234567')).toBe(false)
    expect(laSoDienThoaiVN('09123456789')).toBe(false)
  })

  it('từ chối chữ và ký tự lạ', () => {
    expect(laSoDienThoaiVN('091234567a')).toBe(false)
    expect(laSoDienThoaiVN('0912-345-678')).toBe(false)
  })

  it('bỏ qua khoảng trắng THỪA HAI ĐẦU (hay dính khi dán từ tin nhắn)', () => {
    expect(laSoDienThoaiVN('  0912345678  ')).toBe(true)
  })

  it('nhưng khoảng trắng Ở GIỮA vẫn là sai -- tránh lưu hai định dạng cho cùng một số', () => {
    expect(laSoDienThoaiVN('0912 345 678')).toBe(false)
  })

  it('rỗng/null/undefined -> không hợp lệ, không ném lỗi', () => {
    expect(laSoDienThoaiVN('')).toBe(false)
    expect(laSoDienThoaiVN(null)).toBe(false)
    expect(laSoDienThoaiVN(undefined)).toBe(false)
  })
})

describe('thieuSoDienThoai', () => {
  it('null, undefined và chuỗi toàn khoảng trắng đều tính là chưa điền', () => {
    expect(thieuSoDienThoai(null)).toBe(true)
    expect(thieuSoDienThoai(undefined)).toBe(true)
    expect(thieuSoDienThoai('')).toBe(true)
    // Nếu chuỗi trắng bị tính là "đã có" thì lời nhắc bổ sung số sẽ không bao giờ hiện.
    expect(thieuSoDienThoai('   ')).toBe(true)
  })

  it('có số thật -> không thiếu', () => {
    expect(thieuSoDienThoai('0912345678')).toBe(false)
  })
})
