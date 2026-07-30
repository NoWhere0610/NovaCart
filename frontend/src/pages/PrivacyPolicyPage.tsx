import PolicyPage from './PolicyPage'

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Chính sách bảo mật"
      sections={[
        {
          heading: '1. Thông tin thu thập',
          body: 'NovaCart thu thập họ tên, số điện thoại, email và địa chỉ giao hàng khi khách hàng đăng ký tài khoản hoặc đặt hàng.',
        },
        {
          heading: '2. Mục đích sử dụng',
          body: 'Thông tin được sử dụng để xử lý đơn hàng, giao hàng, chăm sóc khách hàng và gửi thông báo liên quan đến đơn hàng.',
        },
        {
          heading: '3. Bảo mật thông tin',
          body: 'NovaCart cam kết không chia sẻ, mua bán thông tin khách hàng cho bên thứ ba, trừ trường hợp cần thiết để giao hàng (đơn vị vận chuyển) hoặc theo yêu cầu của cơ quan pháp luật.',
        },
        {
          heading: '4. Quyền của khách hàng',
          body: 'Khách hàng có quyền yêu cầu chỉnh sửa, cập nhật hoặc xóa thông tin cá nhân bằng cách liên hệ nemcsb@gmail.com.',
        },
      ]}
    />
  )
}