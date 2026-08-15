import { useEffect, useState } from 'react'
import { getAdminUsersApi, lockAdminUserApi, unlockAdminUserApi, type AdminUserDto } from '../api/adminApi'
import { useAlertDialog } from '../hooks/useAlertDialog'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const { alertDialog, dialog } = useAlertDialog()

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await getAdminUsersApi(0, 50)
      setUsers(res.content)
    } finally {
      setLoading(false)
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
      <h1 className="text-2xl font-semibold text-stone-900 mb-6">Quản lý người dùng</h1>

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
                  <td className="px-4 py-3">{u.roles.join(', ')}</td>
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
                    Không có người dùng nào
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