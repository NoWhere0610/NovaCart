import PolicyPage from './PolicyPage'

export default function ReturnPolicyPage() {
  return (
    <PolicyPage
      title="Chính sách đổi trả"
      sections={[
        {
          heading: '1. Điều kiện đổi trả',
          body: 'Sản phẩm được đổi trả trong vòng 7 ngày kể từ ngày nhận hàng, còn nguyên tem mác, chưa qua sử dụng hoặc giặt ủi, không có dấu hiệu hư hỏng do người dùng gây ra.',
        },
        {
          heading: '2. Trường hợp được đổi trả miễn phí',
          body: 'Sản phẩm giao sai mẫu, sai size, lỗi từ nhà sản xuất (đường may, chất liệu) hoặc hư hỏng trong quá trình vận chuyển.',
        },
        {
          heading: '3. Quy trình đổi trả',
          body: 'Liên hệ NovaCart qua hotline 0327 990 059 hoặc email nemcsb@gmail.com kèm hình ảnh sản phẩm và mã đơn hàng. NovaCart sẽ xác nhận và hướng dẫn gửi trả trong vòng 24h làm việc.',
        },
        {
          heading: '4. Hoàn tiền',
          body: 'Sau khi nhận và kiểm tra hàng trả về, NovaCart hoàn tiền hoặc đổi sản phẩm mới trong vòng 3-5 ngày làm việc.',
        },
      ]}
    />
  )
}