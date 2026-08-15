import { apiClient } from './apiClient'

// Proxy sang VietMap Maps API qua backend (xem MapsController) -- key không lộ ra frontend.

export interface MapSuggestion {
  refId: string
  display: string
  address: string
  name: string
}

export interface MapPlaceDetail {
  display: string
  hsNum: string | null
  street: string | null
  city: string | null
  district: string | null
  ward: string | null
  lat: number | null
  lng: number | null
}

export async function autocompleteAddressApi(text: string): Promise<MapSuggestion[]> {
  const { data } = await apiClient.get<MapSuggestion[]>('/maps/autocomplete', { params: { text } })
  return data
}

export async function getPlaceDetailApi(refId: string): Promise<MapPlaceDetail> {
  const { data } = await apiClient.get<MapPlaceDetail>('/maps/place', { params: { refId } })
  return data
}

// Bấm/kéo ghim trên bản đồ -> đổi ngược lại thành địa chỉ (tỉnh/quận/phường/đường).
export async function reverseGeocodeApi(lat: number, lng: number): Promise<MapPlaceDetail> {
  const { data } = await apiClient.get<MapPlaceDetail>('/maps/reverse', { params: { lat, lng } })
  return data
}
