import { IconBrandTiktok, IconBrandFacebook } from '@tabler/icons-react'

/**
 * 2 link mạng xã hội nổi góc màn hình. Đặt bottom-24 để không đè lên nút chat
 * của ChatWidget (đang ở bottom-6).
 */
export default function FloatingSocialButtons() {
  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-3">
      <a
        href="https://www.tiktok.com/@cuong05100"
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 rounded-full bg-black shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <IconBrandTiktok size={26} color="white" />
      </a>

      <a
        href="https://www.facebook.com/tran.cuong.04276"
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 rounded-full bg-blue-600 shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <IconBrandFacebook size={28} color="white" />
      </a>
    </div>
  )
}
