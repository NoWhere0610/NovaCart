import PolicyPage from './PolicyPage'

export default function TermsPage() {
  return (
    <PolicyPage
      title="Điều khoản sử dụng"
      sections={[
        {
          heading: '1. Chấp nhận điều khoản',
          body: 'Khi truy cập và sử dụng website NovaCart, khách hàng đồng ý tuân thủ các điều khoản sử dụng được nêu tại đây.',
        },
        {
          heading: '2. Tài khoản người dùng',
          body: 'Khách hàng chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động phát sinh từ tài khoản của mình.',
        },
        {
          heading: '3. Đặt hàng và thanh toán',
          body: 'Đơn hàng được xác nhận khi khách hàng hoàn tất bước đặt hàng. NovaCart có quyền từ chối đơn hàng trong trường hợp phát hiện gian lận hoặc sai sót về giá.',
        },
        {
          heading: '4. Thay đổi điều khoản',
          body: 'NovaCart có thể cập nhật điều khoản sử dụng theo thời gian. Phiên bản mới nhất sẽ được đăng tải trên website.',
        },
      ]}
    />
  )
}