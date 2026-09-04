import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthUser, LoginPayload, RegisterPayload } from '../api/authApi'
import { loginApi, registerApi } from '../api/authApi'
import { getTokenExpiry, isTokenExpired } from '../utils/jwt'
import { useToast } from './ToastContext'

/** Câu báo khi phiên tự kết thúc. Để một chỗ vì cả đồng hồ hẹn giờ lẫn lúc khôi phục phiên đều dùng. */
const BAO_HET_HAN = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  // true trong lúc đang đọc localStorage lần đầu -> tránh flash "chưa login" khi F5 trang
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  /**
   * Cập nhật vài trường của người dùng đang đăng nhập (vd sửa họ tên ở màn Tài khoản).
   *
   * Cần thiết vì thông tin hiển thị được đọc từ bản sao trong localStorage, KHÔNG gọi lại API mỗi lần
   * vẽ. Sửa họ tên mà không đồng bộ vào đây thì Header vẫn hiện tên cũ cho tới lần đăng nhập sau --
   * người dùng tưởng là chưa lưu được.
   */
  updateUser: (thayDoi: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const STORAGE_TOKEN_KEY = 'accessToken'
const STORAGE_USER_KEY = 'currentUser'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { hienToast } = useToast()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Hẹn giờ tự đăng xuất đúng lúc token hết hạn -- xem scheduleAutoLogout.
  const autoLogoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN_KEY)
    localStorage.removeItem(STORAGE_USER_KEY)
    if (autoLogoutTimer.current) {
      clearTimeout(autoLogoutTimer.current)
      autoLogoutTimer.current = null
    }
    setUser(null)
  }, [])

  /**
   * Hẹn giờ đăng xuất đúng thời điểm token hết hạn.
   *
   * Không có nó thì ứng dụng chỉ phát hiện token hết hạn khi TÌNH CỜ có một lời gọi API bị 401. Người
   * dùng đang đứng ở trang công khai (trang chủ, danh mục, chi tiết sản phẩm -- những trang không cần
   * đăng nhập) sẽ không thấy gì thay đổi: giao diện vẫn như đang đăng nhập, cho tới khi bấm vào một
   * chức năng cần đăng nhập mới bị đá ra. Hẹn giờ khiến phiên kết thúc đúng lúc nó thật sự kết thúc.
   */
  /**
   * Kết thúc phiên VÌ HẾT HẠN -- khác với người dùng chủ động bấm Đăng xuất.
   *
   * Phải tách riêng khỏi clearSession: cả hai đều dọn phiên, nhưng chỉ trường hợp này mới cần báo
   * "hết hạn". Gộp làm một thì bấm Đăng xuất cũng bị mắng là phiên hết hạn.
   */
  const hetHanPhien = useCallback(() => {
    clearSession()
    hienToast(BAO_HET_HAN, 'thongTin')
  }, [clearSession, hienToast])

  const scheduleAutoLogout = useCallback((token: string) => {
    if (autoLogoutTimer.current) clearTimeout(autoLogoutTimer.current)
    const expiry = getTokenExpiry(token)
    if (expiry == null) return
    const conLai = expiry - Date.now()
    if (conLai <= 0) {
      // Nhánh phòng thân: mọi lối gọi vào đây đều đã lọc token hết hạn từ trước. Cố ý KHÔNG báo, để
      // không có nguy cơ hiện hai lần cùng một thông báo với nhánh khôi phục phiên bên dưới.
      clearSession()
      return
    }
    autoLogoutTimer.current = setTimeout(hetHanPhien, conLai)
  }, [clearSession, hetHanPhien])

  // Khôi phục phiên đăng nhập từ localStorage khi app khởi động.
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_USER_KEY)
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY)

    // KIỂM HẠN TOKEN trước khi tin: bản trước chỉ cần có đủ 2 khoá trong localStorage là coi như đã
    // đăng nhập, nên token hết hạn từ hôm qua vẫn cho vào bình thường và mọi lời gọi API đều lỗi.
    if (savedUser && savedToken && !isTokenExpired(savedToken)) {
      try {
        setUser(JSON.parse(savedUser))
        scheduleAutoLogout(savedToken)
      } catch {
        clearSession() // dữ liệu trong localStorage hỏng
      }
    } else if (savedUser || savedToken) {
      // Có dấu vết phiên cũ nhưng không dùng được nữa. Chỉ báo khi ĐÚNG LÀ token hết hạn/hỏng --
      // trường hợp chỉ sót một khoá lẻ (chưa từng đăng nhập trọn vẹn) mà cũng báo "hết hạn" thì
      // người mới vào lần đầu sẽ hoang mang không hiểu phiên nào vừa hết.
      const doHetHan = Boolean(savedToken) && isTokenExpired(savedToken)
      clearSession()
      if (doHetHan) hienToast(BAO_HET_HAN, 'thongTin')
    }
    setIsLoading(false)
  }, [clearSession, scheduleAutoLogout, hienToast])

  // Dọn hẹn giờ khi component bị gỡ, tránh gọi setState trên component đã unmount.
  useEffect(() => () => {
    if (autoLogoutTimer.current) clearTimeout(autoLogoutTimer.current)
  }, [])

  function persistSession(result: AuthUser & { accessToken: string }) {
    const { accessToken, ...authUser } = result
    localStorage.setItem(STORAGE_TOKEN_KEY, accessToken)
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authUser))
    setUser(authUser)
    scheduleAutoLogout(accessToken)
  }

  async function login(payload: LoginPayload) {
    const result = await loginApi(payload)
    persistSession(result)
  }

  async function register(payload: RegisterPayload) {
    const result = await registerApi(payload)
    persistSession(result)
  }

  const updateUser = useCallback((thayDoi: Partial<AuthUser>) => {
    setUser((truoc) => {
      if (!truoc) return truoc // đã đăng xuất giữa chừng -> không dựng lại phiên từ một bản vá lẻ
      const sau = { ...truoc, ...thayDoi }
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(sau))
      return sau
    })
  }, [])

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    register,
    logout: clearSession,
    updateUser,
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
