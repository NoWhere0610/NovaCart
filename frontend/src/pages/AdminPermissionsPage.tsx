import { useEffect, useMemo, useState } from 'react'
import {
  getStaffPermissionsApi,
  updateStaffPermissionsApi,
  type AdminPermissionItemDto,
} from '../api/adminApi'
import { useAlertDialog } from '../hooks/useAlertDialog'

export default function AdminPermissionsPage() {
  const [items, setItems] = useState<AdminPermissionItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Chỉ những quyền người dùng vừa đổi so với lúc tải trang -- gửi lên ít, và biết được có gì "chưa lưu".
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({})
  const { alertDialog, dialog } = useAlertDialog()

  useEffect(() => {
    loadMatrix()
  }, [])

  async function loadMatrix() {
    setLoading(true)
    try {
      setItems(await getStaffPermissionsApi())
      setPendingChanges({})
    } finally {
      setLoading(false)
    }
  }

  const groups = useMemo(() => {
    const byGroup = new Map<string, AdminPermissionItemDto[]>()
    for (const item of items) {
      const list = byGroup.get(item.group) ?? []
      list.push(item)
      byGroup.set(item.group, list)
    }
    return Array.from(byGroup.entries())
  }, [items])

  function isGranted(item: AdminPermissionItemDto) {
    return pendingChanges[item.code] ?? item.granted
  }

  function toggle(item: AdminPermissionItemDto) {
    const next = !isGranted(item)
    setPendingChanges((prev) => {
      const copy = { ...prev }
      if (next === item.granted) {
        delete copy[item.code]
      } else {
        copy[item.code] = next
      }
      return copy
    })
  }

  const hasChanges = Object.keys(pendingChanges).length > 0

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateStaffPermissionsApi(pendingChanges)
      setItems(updated)
      setPendingChanges({})
    } catch (err: any) {
      await alertDialog(err.response?.data?.message ?? 'Không thể lưu ma trận quyền')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {dialog}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-stone-900">Phân quyền nhân viên</h1>
        <button
          disabled={!hasChanges || saving}
          onClick={handleSave}
          className="bg-orange-700 hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-700 text-white text-sm px-4 py-2"
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
      <p className="text-sm text-stone-500 mb-6">
        Bật/tắt những việc role <span className="font-medium">Nhân viên</span> được làm ở khu vực quản trị.
        Quyền của Admin luôn đầy đủ và không nằm trong bảng này. Kho tồn hàng và Người dùng luôn chỉ Admin
        thao tác được, không thể bật cho Nhân viên.
      </p>

      {loading ? (
        <p className="text-stone-500">Đang tải...</p>
      ) : (
        <div className="space-y-5">
          {groups.map(([groupName, groupItems]) => (
            <div key={groupName} className="bg-white border border-stone-200">
              <div className="px-4 py-2.5 border-b border-stone-200 bg-stone-50">
                <p className="text-sm font-medium text-stone-700">{groupName}</p>
              </div>
              <div className="divide-y divide-stone-100">
                {groupItems.map((item) => {
                  const granted = isGranted(item)
                  const dirty = item.code in pendingChanges
                  return (
                    <label
                      key={item.code}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        checked={granted}
                        onChange={() => toggle(item)}
                        className="w-4 h-4 accent-orange-700"
                      />
                      <span className={`text-sm ${dirty ? 'text-orange-700 font-medium' : 'text-stone-700'}`}>
                        {item.label}
                      </span>
                      {dirty && <span className="text-xs text-orange-600">(chưa lưu)</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
