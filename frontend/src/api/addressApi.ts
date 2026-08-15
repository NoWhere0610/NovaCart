import { apiClient } from './apiClient'

export interface AddressDto {
  addressId: number
  receiverName: string
  phone: string
  province: string | null
  district: string | null
  ward: string | null
  detailAddress: string | null
  latitude: number | null
  longitude: number | null
  isDefault: boolean
}

export type AddressPayload = Omit<AddressDto, 'addressId'>

export async function getMyAddressesApi(): Promise<AddressDto[]> {
  const { data } = await apiClient.get<AddressDto[]>('/addresses')
  return data
}

export async function createAddressApi(payload: AddressPayload): Promise<AddressDto> {
  const { data } = await apiClient.post<AddressDto>('/addresses', payload)
  return data
}

export async function updateAddressApi(addressId: number, payload: AddressPayload): Promise<AddressDto> {
  const { data } = await apiClient.put<AddressDto>(`/addresses/${addressId}`, payload)
  return data
}

export async function deleteAddressApi(addressId: number): Promise<void> {
  await apiClient.delete(`/addresses/${addressId}`)
}