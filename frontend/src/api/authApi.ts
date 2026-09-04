import { apiClient } from './apiClient'

// Kiểu dữ liệu khớp với AuthResponse.java bên backend
export interface AuthUser {
  userId: number
  username: string
  email: string
  fullName: string | null
  roles: string[]
}

export interface AuthResult extends AuthUser {
  accessToken: string
}

export interface RegisterPayload {
  username: string
  password: string
  email: string
  fullName?: string
  phone?: string
}

export interface LoginPayload {
  usernameOrEmail: string
  password: string
}

export async function registerApi(payload: RegisterPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/register', payload)
  return data
}

export async function loginApi(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/login', payload)
  return data
}

/**
 * Xin link đặt lại mật khẩu.
 *
 * Backend CỐ Ý trả về đúng một câu như nhau dù email có tài khoản hay không -- đừng "cải tiến" giao
 * diện thành báo "email không tồn tại", vì như vậy là biến trang này thành công cụ dò xem email nào đã
 * đăng ký. Cứ hiển thị nguyên câu backend trả về.
 */
export async function forgotPasswordApi(email: string): Promise<string> {
  const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password', { email })
  return data.message
}

/** Đặt mật khẩu mới bằng mã lấy từ link trong email. */
export async function resetPasswordApi(token: string, newPassword: string): Promise<string> {
  const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', { token, newPassword })
  return data.message
}