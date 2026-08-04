import { useState } from 'react'
import { IconMenu2, IconChevronDown, IconChevronRight } from '@tabler/icons-react'

// Kiểu dữ liệu danh mục dùng chung cho mega-menu — khớp với CategoryResponse
// bên backend (children là mảng danh mục con, có thể rỗng với danh mục lá).
export interface MegaMenuCategory {
  categoryId: number
  categoryName: string
  slug: string
  imageUrl?: string | null
  children?: MegaMenuCategory[]
}

interface CategoryMegaMenuProps {
  categories: MegaMenuCategory[]
  onSelect: (category: MegaMenuCategory) => void
  // Nhãn hiển thị trên nút kích hoạt menu
  label?: string
  className?: string
}

/**
 * Menu 2 cấp kiểu "mega menu":
 *  - BẤM vào nút "Danh mục sản phẩm" -> xổ xuống danh sách các nhóm danh mục
 *    cha (Áo, Quần, Đồ mặc trong, Suit & Blazer...). KHÔNG mở khi chỉ hover
 *    ngang qua (trước đây mở ngay khi hover, dễ bung nhầm khi rê chuột lướt
 *    qua header).
 *  - Di chuột vào 1 nhóm trong danh sách đó (SAU KHI đã bấm mở) -> hiện bảng
 *    bên cạnh liệt kê các loại con thuộc nhóm đó (áo thun, áo sơ mi...), bấm
 *    vào để đi tới trang shop lọc theo danh mục đó.
 *  - Rê chuột ra khỏi toàn bộ menu (sau khi đã mở) thì tự đóng lại.
 */
export default function CategoryMegaMenu({ categories, onSelect, label = 'Danh mục sản phẩm', className = '' }: CategoryMegaMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null)

  const activeGroup = categories.find((c) => c.categoryId === activeGroupId) ?? null

  const close = () => {
    setOpen(false)
    setActiveGroupId(null)
  }

  return (
    <div className={`relative ${className}`} onMouseLeave={close}>
      <button
        type="button"
        onClick={() =>
          setOpen((v) => {
            const next = !v
            if (next) setActiveGroupId((prev) => prev ?? categories[0]?.categoryId ?? null)
            else setActiveGroupId(null)
            return next
          })
        }
        className="flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-gold-dark transition-colors"
        aria-expanded={open}
      >
        <IconMenu2 size={16} stroke={2} />
        {label}
        <IconChevronDown size={12} stroke={2.5} />
      </button>

      {open && categories.length > 0 && (
        <div className="absolute left-0 top-full pt-3 flex items-start z-50">
          {/* Cấp 1: các nhóm danh mục cha */}
          <div className="w-60 bg-white border border-stone-200 shadow-xl py-2">
            {categories.map((group) => {
              const hasChildren = Boolean(group.children && group.children.length > 0)
              const active = activeGroupId === group.categoryId
              // Nhóm CÓ con chỉ dùng để gom nhóm hiển thị (tiêu đề), không phải 1 danh mục thật để lọc
              // sản phẩm -> không cho bấm nữa, chỉ hover để xổ danh mục con bên cạnh. Nhóm KHÔNG có con
              // (trường hợp hiếm, danh mục gốc không phân cấp) vẫn bấm được như trước.
              return hasChildren ? (
                // KHÔNG chỉ onMouseEnter -- thiết bị cảm ứng (mobile/tablet) không có hover, nên phải có
                // thêm onClick để chuyển nhóm đang active, nếu không người dùng chạm màn hình sẽ bị kẹt
                // mãi ở nhóm mặc định (categories[0]) và không bao giờ mở được nhóm khác.
                <button
                  key={group.categoryId}
                  type="button"
                  onMouseEnter={() => setActiveGroupId(group.categoryId)}
                  onClick={() => setActiveGroupId(group.categoryId)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left select-none ${
                    active ? 'bg-stone-100 text-gold-dark' : 'text-stone-700'
                  }`}
                >
                  {group.categoryName}
                  <IconChevronRight size={14} stroke={2} />
                </button>
              ) : (
                <button
                  key={group.categoryId}
                  type="button"
                  onMouseEnter={() => setActiveGroupId(group.categoryId)}
                  onClick={() => {
                    close()
                    onSelect(group)
                  }}
                  className={`w-full flex items-center justify-between text-left px-4 py-2.5 text-sm transition-colors ${
                    active ? 'bg-stone-100 text-gold-dark' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {group.categoryName}
                </button>
              )
            })}
          </div>

          {/* Cấp 2: các loại con của nhóm đang hover, hiện bên cạnh */}
          {activeGroup && activeGroup.children && activeGroup.children.length > 0 && (
            <div className="w-64 max-h-[28rem] overflow-y-auto bg-white border border-stone-200 shadow-xl py-2 -ml-px">
              <p className="px-4 pt-1 pb-2 text-[11px] uppercase tracking-widest text-stone-400">
                {activeGroup.categoryName}
              </p>
              {activeGroup.children.map((child) => (
                <button
                  key={child.categoryId}
                  type="button"
                  onClick={() => {
                    close()
                    onSelect(child)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-gold-dark transition-colors"
                >
                  {child.categoryName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
