import { useEffect, useRef, useState } from 'react'

export interface SearchableOption {
  value: string
  label: string
  // Chuỗi dùng để LỌC khi gõ tìm -- mặc định dùng label nếu không truyền. Tách riêng vì label có thể
  // gộp thêm ngữ cảnh (vd "Phường X, Tỉnh Y") trong khi chỉ nên so khớp đúng phần tên chính (X), tránh
  // khớp nhầm qua tên tỉnh (vd gõ "tu" ra lộn xộn các phường ở "Tuyên Quang" dù tên phường không liên quan).
  searchText?: string
  // Option còn hiện trong list nhưng không cho chọn (vd size hết hàng) -- mờ đi, click không có tác dụng.
  disabled?: boolean
}

interface Props {
  options: SearchableOption[]
  value: string
  onChange: (value: string, option: SearchableOption | null) => void
  placeholder: string
  disabled?: boolean
  maxResults?: number
  // Số ký tự tối thiểu phải gõ mới hiện list -- 0 (mặc định) = bấm vào là hiện cả list luôn, hợp với
  // list ngắn (vd 34 tỉnh/thành). Đặt > 0 cho list dài (vd 3.321 phường/xã cả nước) để không đổ hết
  // cả nghìn dòng ra ngay khi vừa bấm vào ô, chưa gõ gì.
  minChars?: number
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Dropdown có ô gõ tìm bên trong -- dùng cho danh sách dài (vd 3.321 phường/xã cả nước). */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  maxResults = 50,
  minChars = 0,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value) ?? null
  const trimmedQuery = query.trim()
  const normalizedQuery = normalize(trimmedQuery)
  const showList = open && trimmedQuery.length >= minChars
  const filtered = normalizedQuery
    ? options
        .map((o) => ({ o, key: normalize(o.searchText ?? o.label) }))
        .filter(({ key }) => key.includes(normalizedQuery))
        // Ưu tiên khớp NGAY ĐẦU chuỗi (vd gõ "an tuong" ra "Phường An Tường" trước) hơn khớp ở giữa/cuối.
        .sort((a, b) => Number(b.key.startsWith(normalizedQuery)) - Number(a.key.startsWith(normalizedQuery)))
        .map(({ o }) => o)
        .slice(0, maxResults)
    : options.slice(0, maxResults)

  return (
    <div className="relative" ref={containerRef}>
      <input
        disabled={disabled}
        value={open ? query : (selected?.label ?? '')}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 disabled:bg-stone-100"
      />
      {open && !showList && (
        <p className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-300 px-3 py-2 text-xs text-stone-400 shadow-sm">
          Gõ ít nhất {minChars} ký tự để tìm...
        </p>
      )}
      {showList && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-300 max-h-56 overflow-y-auto shadow-sm">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-stone-400">Không tìm thấy</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    if (o.disabled) return
                    onChange(o.value, o)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-stone-100 last:border-b-0 ${
                    o.disabled ? 'text-stone-300 cursor-not-allowed' : 'hover:bg-stone-50'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
