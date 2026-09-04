import { useEffect, useState } from 'react'
import {
  getAdminUsersApi,
  lockAdminUserApi,
  unlockAdminUserApi,
  updateAdminUserRoleApi,
  type AdminUserDto,
  type VaiTro,
} from '../api/adminApi'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { useConfirmDialog } from '../hooks/useConfirmDialog'

const VAI_TRO: { value: VaiTro; label: string }[] = [
  { value: 'CUSTOMER', label: 'CUSTOMER — khách mua hàng' },
  { value: 'STAFF', label: 'STAFF — nhân viên (quyền theo ma trận)' },
  { value: 'ADMIN', label: 'ADMIN — toàn quyền' },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [tuKhoa, setTuKhoa] = useState('')
  // Đơn đang mở ô chọn vai trò (null = không mở ô nào). Không dùng <select> hiện sẵn trên mọi dòng --
  // đổi vai trò là thao tác hiếm và nguy hiểm, để sẵn một ô chọn ở mỗi dòng rất dễ bấm nhầm.
  const [doiVaiTroChoId, setDoiVaiTroChoId] = useState<number | null>(null)
  const { alertDialog, dialog } = useAlertDialog()
  const { confirm: confirmDialog, dialog: confirmDialogEl } = useConfirmDialog()

  // Tự tìm sau khi ngừng gõ 400ms, không bắt bấm nút -- khớp cách ô tìm ở Header và trang Sản phẩm.
  useEffect(() => {
    const timer = setTimeout(() => loadUsers(tuKhoa), 400)
    return () => clearTimeout(timer)
  }, [tuKhoa])

  async function loadUsers(keyword = tuKhoa) {
    setLoading(true)
    try {
      const res = await getAdminUsersApi(0, 50, keyword)
      setUsers(res.content)
    } finally {
      setLoading(false)
    }
  }

  async function handleDoiVaiTro(u: AdminUserDto, vaiTroMoi: VaiTro) {
    if (u.roles.includes(vaiTroMoi)) {
      setDoiVaiTroChoId(null)
      return
    }
    // Hỏi lại vì đổi vai trò thay đổi ngay lập tức những gì người đó làm được với hệ thống.
    const dongY = await confirmDialog(
      `Đổi vai trò của "${u.username}" thành ${vaiTroMoi}?

`
        + (vaiTroMoi === 'ADMIN'
          ? 'ADMIN có toàn quyền, kể cả sửa vai trò của người khác.'
          : vaiTroMoi === 'STAFF'
            ? 'STAFF vào được khu quản trị, quyền cụ thể theo ma trận ở trang Phân quyền nhân viên.'
            : 'CUSTOMER không vào được khu quản trị.'),
    )
    if (!dongY) return

    setBusyId(u.userId)
    try {
      await updateAdminUserRoleApi(u.userId, vaiTroMoi)
      setDoiVaiTroChoId(null)
      await loadUsers()
    } catch (err: any) {
      await alertDialog(err.response?.data?.message ?? 'Không thể đổi vai trò')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggle(user: AdminUserDto) {
    setBusyId(user.userId)
    try {
      if (user.isActive) {
        await lockAdminUserApi(user.userId)
      } else {
        await unlockAdminUserApi(user.userId)
      }
      await loadUsers()
    } catch (err: any) {
      await alertDialog(err.response?.data?.message ?? 'Không thể cập nhật trạng thái tài khoản')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {dialog}
      {confirmDialogEl}
      <h1 className="text-2xl font-semibold text-stone-900 mb-4">Quản lý người dùng</h1>

      <input
        value={tuKhoa}
        onChange={(e) => setTuKhoa(e.target.value)}
        placeholder="Tìm theo email hoặc tên đăng nhập..."
        className="w-full sm:w-96 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 mb-4"
      />

      {loading ? (
        <p className="text-stone-500">Đang tải...</p>
      ) : (
        <div className="bg-white border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-left text-stone-500">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u) => (
                <tr key={u.userId}>
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.fullName || '—'}</td>
                  <td className="px-4 py-3">
                    {doiVaiTroChoId === u.userId ? (
                      <div className="flex flex-col gap-1">
                        {VAI_TRO.map((vt) => (
                          <button
                            key={vt.value}
                            disabled={busyId === u.userId}
                            onClick={() => handleDoiVaiTro(u, vt.value)}
                            className={`text-xs border px-2 py-1 text-left disabled:opacity-50 ${
                              u.roles.includes(vt.value)
                                ? 'border-stone-900 bg-stone-900 text-white'
                                : 'border-stone-300 hover:border-stone-900'
                            }`}
                          >
                            {vt.label}
                          </button>
                        ))}
                        <button
                          onClick={() => setDoiVaiTroChoId(null)}
                          className="text-xs text-stone-500 underline text-left mt-0.5"
                        >
                          Huỷ
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{u.roles.join(', ') || '—'}</span>
                        <button
                          onClick={() => setDoiVaiTroChoId(u.userId)}
                          className="text-xs border border-stone-300 px-2 py-0.5 hover:border-stone-900"
                        >
                          Sửa
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="text-green-700">Đang hoạt động</span>
                    ) : (
                      <span className="text-red-600">Đã khoá</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={busyId === u.userId}
                      onClick={() => handleToggle(u)}
                      className={`text-xs border px-2 py-1 disabled:opacity-50 ${
                        u.isActive ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {u.isActive ? 'Khoá tài khoản' : 'Mở khoá'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                    {tuKhoa ? `Không tìm thấy người dùng nào khớp "${tuKhoa}"` : 'Không có người dùng nào'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}