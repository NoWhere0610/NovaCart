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