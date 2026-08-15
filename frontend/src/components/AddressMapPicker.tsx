import { useEffect, useRef } from 'react'
import * as vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css'

// Key "Maptiles" (public, chỉ dùng để tải hình ảnh bản đồ -- khác key REST ở backend) -- an toàn khi
// nhúng thẳng vào frontend, VietMap thiết kế loại key này để lộ ra trình duyệt.
const TILE_API_KEY = import.meta.env.VITE_VIETMAP_TILE_KEY ?? '85d97dc3672d6eccebf4b75ed4a85b583b6ba780536e7c42'
const STYLE_URL = `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${TILE_API_KEY}`
// [lng, lat] -- trung tâm Hà Nội, dùng làm điểm bắt đầu khi chưa chọn địa chỉ nào.
const DEFAULT_CENTER: [number, number] = [105.8542, 21.0285]

interface Props {
  lat: number | null
  lng: number | null
  // Bấm/kéo ghim trên bản đồ CHỈ chỉnh toạ độ (dùng tính phí ship chính xác) -- không tự đổi các ô
  // tỉnh/quận/phường/địa chỉ chi tiết, những ô đó vẫn do ô "Tìm địa chỉ" (Autocomplete) điều khiển.
  onPick: (lat: number, lng: number) => void
}

/** Bản đồ trực quan cho khách chọn/tinh chỉnh chính xác vị trí giao hàng, dùng VietMap GL JS. */
export default function AddressMapPicker({ lat, lng, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  // Marker/map handler được đăng ký 1 lần lúc mount -- dùng ref để luôn gọi đúng onPick mới nhất mà
  // không phải huỷ-tạo lại map mỗi lần AccountPage re-render.
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current) return
    const initialCenter: [number, number] = lat != null && lng != null ? [lng, lat] : DEFAULT_CENTER

    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: initialCenter,
      zoom: 15,
    })
    mapRef.current = map

    const marker = new vietmapgl.Marker({ draggable: true, color: '#1c1917' })
      .setLngLat(initialCenter)
      .addTo(map)
    markerRef.current = marker

    marker.on('dragend', () => {
      const pos = marker.getLngLat()
      onPickRef.current(pos.lat, pos.lng)
    })

    map.on('click', (e: any) => {
      marker.setLngLat(e.lngLat)
      onPickRef.current(e.lngLat.lat, e.lngLat.lng)
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // lat/lng đổi TỪ NGOÀI (vd khách chọn 1 gợi ý ở ô Autocomplete) -- bay map + dời ghim tới đó, không
  // tạo lại map từ đầu.
  useEffect(() => {
    if (lat == null || lng == null || !mapRef.current || !markerRef.current) return
    markerRef.current.setLngLat([lng, lat])
    mapRef.current.flyTo({ center: [lng, lat], zoom: 16 })
  }, [lat, lng])

  return (
    <div>
      <div ref={containerRef} className="w-full h-64 border border-stone-300" />
      <p className="text-xs text-stone-400 mt-1">Kéo hoặc bấm vào bản đồ để chỉnh chính xác vị trí giao hàng.</p>
    </div>
  )
}
