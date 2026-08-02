import { useState } from 'react'

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
 *  - Di chuột vào nút "Danh mục sản phẩm" -> xổ xuống danh sách các nhóm danh
 *    mục cha (Áo, Quần, Đồ mặc trong, Suit & Blazer, Bộ đồ...).
 *  - Di chuột vào 1 nhóm trong danh sách đó -> hiện bảng bên cạnh liệt kê các
 *    loại con thuộc nhóm đó (áo thun, áo sơ mi, áo khoác...), bấm vào để đi
 *    tới trang shop lọc theo danh mục đó.
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
    <div
      className={`relative ${className}`}
      onMouseEnter={() => {
        setOpen(true)
        setActiveGroupId((prev) => prev ?? categories[0]?.categoryId ?? null)
      }}
      onMouseLeave={close}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-orange-700 transition-colors"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && categories.length > 0 && (
        <div className="absolute left-0 top-full pt-3 flex items-start z-50">
          {/* Cấp 1: các nhóm danh mục cha */}
          <div className="w-60 bg-white border border-stone-200 shadow-xl py-2">
            {categories.map((group) => (
              <button
                key={group.categoryId}
                type="button"
                onMouseEnter={() => setActiveGroupId(group.categoryId)}
                onClick={() => {
                  close()
                  onSelect(group)
                }}
                className={`w-full flex items-center justify-between text-left px-4 py-2.5 text-sm transition-colors ${
                  activeGroupId === group.categoryId
                    ? 'bg-stone-100 text-orange-700'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                {group.categoryName}
                {group.children && group.children.length > 0 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                )}
              </button>
            ))}
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
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-orange-700 transition-colors"
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
