import { Link } from 'react-router-dom'
import { IconChevronRight } from '@tabler/icons-react'

interface BreadcrumbItem {
  label: string
  to?: string
}

/** Điều hướng dạng "Trang chủ > Shop > ..." -- mục cuối không có "to", hiện đậm hơn thay vì là link. */
export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1.5 text-xs text-stone-500 mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <IconChevronRight size={12} stroke={2} className="text-stone-300 shrink-0" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-gold-dark transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-stone-700 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
