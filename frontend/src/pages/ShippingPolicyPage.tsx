import PolicyPage from './PolicyPage'

export default function ShippingPolicyPage() {
  return (
    <PolicyPage
      title="Chính sách vận chuyển"
      sections={[
        {
          heading: '1. Khu vực giao hàng',
          body: 'NovaCart giao hàng toàn quốc thông qua các đơn vị vận chuyển liên kết.',
        },
        {
          heading: '2. Thời gian giao hàng',
          body: 'Nội thành Hà Nội: 1-2 ngày làm việc.\nCác tỉnh thành khác: 3-5 ngày làm việc.\nThời gian có thể thay đổi tùy khu vực và điều kiện thời tiết.',
        },
        {
          heading: '3. Phí vận chuyển',
          body: 'Phí vận chuyển được tính tự động dựa trên địa chỉ nhận hàng và hiển thị cụ thể tại bước thanh toán trước khi đặt hàng.',
        },
        {
          heading: '4. Kiểm tra hàng khi nhận',
          body: 'Khách hàng vui lòng kiểm tra tình trạng đóng gói bên ngoài trước khi ký nhận. Nếu phát hiện hư hỏng, vui lòng từ chối nhận và liên hệ NovaCart ngay.',
        },
      ]}
    />
  )
}