import { describe, expect, it } from 'vitest'
import { getTokenExpiry, isTokenExpired } from './jwt'

/**
 * Đọc hạn token ở phía trình duyệt.
 *
 * Vì sao đáng test: đây là thứ quyết định ứng dụng có nhận ra phiên đăng nhập đã hết hạn hay không.
 * Sai ở đây thì hoặc người dùng bị đăng xuất oan, hoặc (như lỗi đã gặp) ứng dụng cứ tin là còn đăng
 * nhập cho tới khi tình cờ có một lời gọi API bị từ chối. Kiểm bằng tay thì phải ngồi đợi token hết
 * hạn thật; với test thì chỉ là đổi một con số.
 */

/** Dựng JWT giả -- chỉ phần payload là thật, chữ ký không cần vì phía trình duyệt không xác minh.
 *  Mã hoá UTF-8 trước khi base64 y như thư viện JWT thật, nếu không thì ký tự tiếng Việt làm btoa() ném lỗi. */
function taoToken(payload: Record<string, unknown>): string {
  const b64url = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o))
    let bin = ''
    bytes.forEach((b) => { bin += String.fromCharCode(b) })
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return `${b64url({ alg: 'HS512' })}.${b64url(payload)}.chu-ky-gia`
}

const GIAY = 1000

describe('getTokenExpiry', () => {
  it('đọc đúng trường exp và đổi từ giây sang mili giây', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    expect(getTokenExpiry(taoToken({ sub: 'admin', exp }))).toBe(exp * 1000)
  })

  it('token không có exp -> null', () => {
    expect(getTokenExpiry(taoToken({ sub: 'admin' }))).toBeNull()
  })

  it('chuỗi không phải JWT -> null, không ném lỗi', () => {
    expect(getTokenExpiry('khong-phai-jwt')).toBeNull()
    expect(getTokenExpiry('a.b')).toBeNull()
    expect(getTokenExpiry(null)).toBeNull()
  })

  it('đọc được payload có dấu tiếng Việt (base64url không đệm)', () => {
    const exp = Math.floor(Date.now() / 1000) + 60
    expect(getTokenExpiry(taoToken({ sub: 'Nguyễn Văn A', exp }))).toBe(exp * 1000)
  })
})

describe('isTokenExpired', () => {
  it('token còn hạn -> false', () => {
    expect(isTokenExpired(taoToken({ exp: Math.floor((Date.now() + 3600 * GIAY) / 1000) }))).toBe(false)
  })

  it('token đã hết hạn -> true (đây là ca ứng dụng từng bỏ sót)', () => {
    expect(isTokenExpired(taoToken({ exp: Math.floor((Date.now() - GIAY) / 1000) }))).toBe(true)
  })

  it('không có token -> true', () => {
    expect(isTokenExpired(null)).toBe(true)
    expect(isTokenExpired('')).toBe(true)
  })

  it('token hỏng -> true (hỏng thì hỏng theo hướng đóng, bắt đăng nhập lại)', () => {
    expect(isTokenExpired('khong-phai-jwt')).toBe(true)
    expect(isTokenExpired('a.b')).toBe(true)
    expect(isTokenExpired('a.###.c')).toBe(true)
  })

  it('token đúng định dạng nhưng KHÔNG có exp -> coi là còn hạn, không tự ý đăng xuất', () => {
    expect(isTokenExpired(taoToken({ sub: 'admin' }))).toBe(false)
  })

  it('đúng thời điểm hết hạn được coi là đã hết hạn', () => {
    expect(isTokenExpired(taoToken({ exp: Math.floor(Date.now() / 1000) - 1 }))).toBe(true)
  })
})
