import { apiClient } from './apiClient'

/**
 * Hồ sơ của CHÍNH người đang đăng nhập (/api/users/me).
 *
 * Khác hẳn adminApi (quản lý người dùng khác, chỉ ADMIN gọi được): ở đây backend luôn lấy userId từ
 * token, không nhận từ tham số, nên không có cách nào xem/sửa hồ sơ người khác.
 */

// Khớp với ProfileResponse.java
export interface Profile {
  userId: number
  username: string
  email: string
  fullName: string | null
  phone: string | null
  /** true khi tài khoản chưa có số điện thoại -- dùng để hiện lời nhắc bổ sung. */
  thieuSoDienThoai: boolean
}

export interface UpdateProfilePayload {
  fullName: string
  phone: string
}

export async function getMyProfileApi(): Promise<Profile> {
  const { data } = await apiClient.get<Profile>('/users/me')
  return data
}

export async function updateMyProfileApi(payload: UpdateProfilePayload): Promise<Profile> {
  const { data } = await apiClient.put<Profile>('/users/me', payload)
  return data
}

export async function changePasswordApi(currentPassword: string, newPassword: string): Promise<string> {
  const { data } = await apiClient.put<{ message: string }>('/users/me/password', {
    currentPassword,
    newPassword,
  })
  return data.message
}
