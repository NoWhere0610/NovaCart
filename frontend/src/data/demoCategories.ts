import type { MegaMenuCategory } from '../components/CategoryMegaMenu'

// Cây danh mục dự phòng khi API /api/home/categories lỗi. Khớp dữ liệu seed trong menswear_db_mssql.sql.
export const DEMO_CATEGORIES: MegaMenuCategory[] = [
  {
    categoryId: 1,
    categoryName: 'Áo',
    slug: 'ao',
    imageUrl: 'https://picsum.photos/seed/cat-ao/700/900',
    children: [
      { categoryId: 11, categoryName: 'Áo thun', slug: 'ao-thun', imageUrl: 'https://picsum.photos/seed/cat-ao-thun/700/900' },
      { categoryId: 12, categoryName: 'Áo sơ mi', slug: 'ao-so-mi', imageUrl: 'https://picsum.photos/seed/cat-ao-so-mi/700/900' },
      { categoryId: 13, categoryName: 'Áo khoác', slug: 'ao-khoac', imageUrl: 'https://picsum.photos/seed/cat-ao-khoac/700/900' },
      { categoryId: 14, categoryName: 'Áo dài', slug: 'ao-dai', imageUrl: 'https://picsum.photos/seed/cat-ao-dai/700/900' },
      { categoryId: 15, categoryName: 'Áo tanktop', slug: 'ao-tanktop', imageUrl: 'https://picsum.photos/seed/cat-ao-tanktop/700/900' },
      { categoryId: 16, categoryName: 'Áo polo', slug: 'ao-polo', imageUrl: 'https://picsum.photos/seed/cat-ao-polo/700/900' },
    ],
  },
  {
    categoryId: 2,
    categoryName: 'Quần',
    slug: 'quan',
    imageUrl: 'https://picsum.photos/seed/cat-quan/700/900',
    children: [
      { categoryId: 21, categoryName: 'Quần tây', slug: 'quan-tay', imageUrl: 'https://picsum.photos/seed/cat-quan-tay/700/900' },
      { categoryId: 22, categoryName: 'Quần jeans', slug: 'quan-jeans', imageUrl: 'https://picsum.photos/seed/cat-quan-jeans/700/900' },
      { categoryId: 23, categoryName: 'Quần short', slug: 'quan-short', imageUrl: 'https://picsum.photos/seed/cat-quan-short/700/900' },
      { categoryId: 24, categoryName: 'Quần thể thao', slug: 'quan-the-thao', imageUrl: 'https://picsum.photos/seed/cat-quan-the-thao/700/900' },
      { categoryId: 25, categoryName: 'Quần slim fit', slug: 'quan-slim-fit', imageUrl: 'https://picsum.photos/seed/cat-quan-slim-fit/700/900' },
      { categoryId: 26, categoryName: 'Quần kaki', slug: 'quan-kaki', imageUrl: 'https://picsum.photos/seed/cat-quan-kaki/700/900' },
      { categoryId: 27, categoryName: 'Quần âu', slug: 'quan-au', imageUrl: 'https://picsum.photos/seed/cat-quan-au/700/900' },
      { categoryId: 28, categoryName: 'Quần regular fit', slug: 'quan-regular-fit', imageUrl: 'https://picsum.photos/seed/cat-quan-regular-fit/700/900' },
      { categoryId: 29, categoryName: 'Quần fiero', slug: 'quan-fiero', imageUrl: 'https://picsum.photos/seed/cat-quan-fiero/700/900' },
      { categoryId: 30, categoryName: 'Quần cropped', slug: 'quan-cropped', imageUrl: 'https://picsum.photos/seed/cat-quan-cropped/700/900' },
    ],
  },
  {
    categoryId: 3,
    categoryName: 'Đồ mặc trong',
    slug: 'do-mac-trong',
    imageUrl: 'https://picsum.photos/seed/cat-do-mac-trong/700/900',
    children: [
      { categoryId: 31, categoryName: 'Quần boxer', slug: 'quan-boxer', imageUrl: 'https://picsum.photos/seed/cat-quan-boxer/700/900' },
      { categoryId: 32, categoryName: 'Áo lót', slug: 'ao-lot', imageUrl: 'https://picsum.photos/seed/cat-ao-lot/700/900' },
      { categoryId: 33, categoryName: 'Đồ giữ nhiệt', slug: 'do-giu-nhiet', imageUrl: 'https://picsum.photos/seed/cat-do-giu-nhiet/700/900' },
      { categoryId: 34, categoryName: 'Quần brief', slug: 'quan-brief', imageUrl: 'https://picsum.photos/seed/cat-quan-brief/700/900' },
    ],
  },
  {
    categoryId: 4,
    categoryName: 'Suit & Blazer',
    slug: 'suit-blazer',
    imageUrl: 'https://picsum.photos/seed/cat-suit-blazer/700/900',
    children: [
      { categoryId: 41, categoryName: 'Bộ suit', slug: 'bo-suit', imageUrl: 'https://picsum.photos/seed/cat-bo-suit/700/900' },
      { categoryId: 42, categoryName: 'Blazer', slug: 'blazer', imageUrl: 'https://picsum.photos/seed/cat-blazer/700/900' },
    ],
  },
  {
    categoryId: 5,
    categoryName: 'Bộ đồ',
    slug: 'bo-do',
    imageUrl: 'https://picsum.photos/seed/cat-bo-do/700/900',
    children: [],
  },
]

// Danh mục cha + con làm phẳng thành 1 mảng, dùng cho ShopPage lọc theo slug và sidebar.
export const DEMO_CATEGORIES_FLAT: MegaMenuCategory[] = DEMO_CATEGORIES.flatMap((group) => [
  group,
  ...(group.children ?? []),
])
