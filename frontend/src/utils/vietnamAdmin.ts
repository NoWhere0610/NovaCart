// Dữ liệu hành chính Việt Nam SAU cải cách 01/07/2025 (bỏ cấp huyện, còn 2 cấp Tỉnh/Thành phố ->
// Phường/Xã trực tiếp) -- lấy từ vietmap-company/vietnam_administrative_address (admin_new/), lưu
// tĩnh trong public/data/ để không phụ thuộc mạng ngoài lúc chạy demo.
export interface ProvinceEntry {
  code: string
  name: string
  name_with_type: string
}

export interface WardEntry {
  code: string
  name: string
  name_with_type: string
  // 'phuong' | 'xa' | 'dac-khu' -- dùng để gom nhóm khi xếp danh sách (xem WARD_TYPE_ORDER).
  type: string
  // "Xã Minh Châu, Thành phố Hà Nội" -- ward + tỉnh gộp sẵn, dùng làm nhãn cho ô tìm kiếm phường/xã
  // toàn quốc (nhiều phường/xã trùng tên nhau ở các tỉnh khác nhau, cần hiển thị rõ tỉnh nào).
  path_with_type: string
  parent_code: string
}

let provincesCache: ProvinceEntry[] | null = null
let allWardsCache: WardEntry[] | null = null

export async function loadProvinces(): Promise<ProvinceEntry[]> {
  if (provincesCache) return provincesCache
  const res = await fetch('/data/vn-provinces.json')
  const raw: Record<string, ProvinceEntry> = await res.json()
  provincesCache = Object.values(raw).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  return provincesCache
}

// Gom nhóm theo loại (Phường đô thị trước, rồi Xã, rồi Đặc khu -- 3 loại duy nhất trong dữ liệu),
// KHÔNG xếp thẳng theo tên -- nếu không list sẽ lẫn lộn Phường/Xã/Đặc khu xen kẽ nhau vô quy luật,
// khó dò khi khách gõ tìm.
const WARD_TYPE_ORDER: Record<string, number> = { phuong: 0, xa: 1, 'dac-khu': 2 }

export async function loadAllWards(): Promise<WardEntry[]> {
  if (allWardsCache) return allWardsCache
  const res = await fetch('/data/vn-wards.json')
  const raw: Record<string, WardEntry> = await res.json()
  allWardsCache = Object.values(raw).sort((a, b) => {
    const typeDiff = (WARD_TYPE_ORDER[a.type] ?? 99) - (WARD_TYPE_ORDER[b.type] ?? 99)
    return typeDiff !== 0 ? typeDiff : a.name.localeCompare(b.name, 'vi')
  })
  return allWardsCache
}

// VietMap Autocomplete/Reverse Geocode vẫn trả tên theo cấu trúc CŨ (trước 01/07/2025, còn cấp
// huyện) -- không thể so khớp tuyệt đối với danh sách tỉnh/phường MỚI, phải chuẩn hoá (bỏ dấu, bỏ
// tiền tố "Thành phố/Tỉnh/Phường/Xã...") rồi so khớp gần đúng.
export function normalizeVnName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/^(thanh pho|tinh|quan|huyen|phuong|xa|thi tran|thi xa)\s+/, '')
    .trim()
}

export function findProvinceByName(provinces: ProvinceEntry[], rawName: string | null | undefined): ProvinceEntry | null {
  if (!rawName) return null
  const target = normalizeVnName(rawName)
  return (
    provinces.find((p) => normalizeVnName(p.name) === target || normalizeVnName(p.name_with_type) === target) ?? null
  )
}

export function findWardByName(wards: WardEntry[], rawName: string | null | undefined): WardEntry | null {
  if (!rawName) return null
  const target = normalizeVnName(rawName)
  return wards.find((w) => normalizeVnName(w.name) === target || normalizeVnName(w.name_with_type) === target) ?? null
}
