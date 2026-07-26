/**
 * Nút liên hệ nổi (floating action buttons) góc dưới bên phải màn hình —
 * giống kiểu widget Messenger/Zalo phổ biến ở các website bán hàng VN.
 * Bấm vào là mở THẲNG trang Facebook/TikTok ở tab mới (target="_blank"),
 * không mở popup chat gì cả.
 *
 * Đặt component này ở App.tsx (ngoài cùng, cạnh <Routes>) để hiện xuyên suốt
 * mọi trang, không phải chỉ riêng trang chủ.
 */
export default function FloatingSocialButtons() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {/* TikTok */}
      <a
        href="https://www.tiktok.com/@cuong05100"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nhắn tin qua TikTok"
        className="w-14 h-14 rounded-full bg-black shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <path d="M16.6 5.82c-.99-.99-1.55-2.31-1.6-3.82h-3.14v13.7c0 1.5-1.22 2.72-2.72 2.72a2.72 2.72 0 0 1 0-5.44c.26 0 .5.03.74.1V9.9a6 6 0 0 0-.74-.05A5.9 5.9 0 0 0 3.24 15.8a5.9 5.9 0 0 0 5.9 5.9c3.26 0 5.9-2.64 5.9-5.9V8.6a9.06 9.06 0 0 0 5.28 1.7V7.16c-1.36 0-2.62-.44-3.72-1.34z" />
        </svg>
      </a>

      {/* Facebook / Messenger */}
      <a
        href="https://www.facebook.com/tran.cuong.04276"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nhắn tin qua Facebook"
        className="w-14 h-14 rounded-full bg-blue-600 shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.13 2 11.23c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.87.38 2.92.38 5.52 0 10-4.13 10-9.29C22 6.13 17.52 2 12 2zm1.02 12.51-2.55-2.72-4.98 2.72 5.48-5.82 2.6 2.72 4.93-2.72-5.48 5.82z" />
        </svg>
      </a>
    </div>
  )
}