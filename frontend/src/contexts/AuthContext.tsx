import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthUser, LoginPayload, RegisterPayload } from '../api/authApi'
import { loginApi, registerApi } from '../api/authApi'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  // true trong lúc đang đọc localStorage lần đầu -> tránh flash "chưa login" khi F5 trang
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const STORAGE_TOKEN_KEY = 'accessToken'
const STORAGE_USER_KEY = 'currentUser'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Khôi phục phiên đăng nhập từ localStorage khi app khởi động.
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_USER_KEY)
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY)
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser))
    }
    setIsLoading(false)
  }, [])

  function persistSession(result: AuthUser & { accessToken: string }) {
    const { accessToken, ...authUser } = result
    localStorage.setItem(STORAGE_TOKEN_KEY, accessToken)
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }

  async function login(payload: LoginPayload) {
    const result = await loginApi(payload)
    persistSession(result)
  }

  async function register(payload: RegisterPayload) {
    const result = await registerApi(payload)
    persistSession(result)
  }

  function logout() {
    localStorage.removeItem(STORAGE_TOKEN_KEY)
    localStorage.removeItem(STORAGE_USER_KEY)
    setUser(null)
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() phải được gọi bên trong <AuthProvider>')
  }
  return ctx
}