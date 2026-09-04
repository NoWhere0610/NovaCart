import { useState } from 'react'
import SearchableSelect from './SearchableSelect'
import { NGAN_HANG_VN } from '../data/vietnamBanks'

export interface RefundAccount {
  bankName: string
  accountNumber: string
  accountHolder: string
}

export const REFUND_ACCOUNT_RONG: RefundAccount = {
  bankName: '',
  accountNumber: '',
  accountHolder: '',
}

/**
 * Kiểm thông tin tài khoản nhận tiền hoàn, trả về câu lỗi đầu tiên hoặc null nếu hợp lệ.
 *
 * Bản sao của quy tắc trong OrderService.requireThongTinHoanTien. Backend vẫn là nơi quyết định -- ở
 * đây chỉ để khách biết thiếu gì NGAY, thay vì bấm gửi rồi mới nhận lỗi từ máy chủ.
 */
export function kiemTaiKhoanHoanTien(tk: RefundAccount): string | null {
  if (!tk.bankName.trim()) return 'Vui lòng chọn ngân hàng nhận tiền hoàn'
  const stk = tk.accountNumber.replace(/\s+/g, '')
  if (!stk) return 'Vui lòng nhập số tài khoản nhận tiền hoàn'
  if (!/^\d{6,20}$/.test(stk)) return 'Số tài khoản chỉ gồm chữ số, độ dài 6-20 ký tự'
  if (!tk.accountHolder.trim()) return 'Vui lòng nhập tên chủ tài khoản'
  return null
}

/**
 * Ba ô khai tài khoản nhận tiền hoàn.
 *
 * Shop chuyển khoản BẰNG TAY (chưa tích hợp API hoàn tiền của cổng thanh toán), nên đây là thông tin
 * duy nhất người thao tác dựa vào. Sai một chữ số là tiền đi nhầm tài khoản người khác -- vì thế ngân
 * hàng cho chọn từ danh sách chuẩn hoá thay vì gõ tự do, và số tài khoản được kiểm định dạng tại chỗ.
 */
export default function RefundAccountFields({
  giaTri,
  onChange,
}: {
  giaTri: RefundAccount
  onChange: (tk: RefundAccount) => void
}) {
  // Danh sách không thể phủ hết mọi ngân hàng/quỹ tín dụng. Chặn cứng thì khách dùng ngân hàng nhỏ
  // không gửi được yêu cầu -- tệ hơn hẳn so với việc chấp nhận một dòng chữ tự gõ.
  const [goTuDo, setGoTuDo] = useState(false)

  const o = 'w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900'

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">
          Ngân hàng <span className="text-red-500">*</span>
        </label>
        {goTuDo ? (
          <input
            value={giaTri.bankName}
            onChange={(e) => onChange({ ...giaTri, bankName: e.target.value })}
            placeholder="Tên ngân hàng"
            className={o}
          />
        ) : (
          <SearchableSelect
            placeholder="-- Gõ tìm ngân hàng --"
            value={giaTri.bankName}
            // Dùng thẳng tên đầy đủ làm giá trị, KHÔNG dùng mã viết tắt: giá trị này được lưu vào đơn
            // và hiện nguyên văn cho nhân viên chuyển khoản đọc. Lưu "VCB" thì người đọc phải tự dịch.
            options={NGAN_HANG_VN.map((b) => ({
              value: b.tenDayDu,
              label: b.tenDayDu,
              searchText: `${b.tenDayDu} ${b.ma}`,
            }))}
            onChange={(v) => onChange({ ...giaTri, bankName: v })}
          />
        )}
        <button
          type="button"
          onClick={() => {
            setGoTuDo((v) => !v)
            onChange({ ...giaTri, bankName: '' })
          }}
          className="text-[11px] text-stone-500 hover:text-gold-dark underline mt-1"
        >
          {goTuDo ? 'Chọn từ danh sách' : 'Ngân hàng của tôi không có trong danh sách'}
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">
          Số tài khoản <span className="text-red-500">*</span>
        </label>
        <input
          value={giaTri.accountNumber}
          onChange={(e) => onChange({ ...giaTri, accountNumber: e.target.value })}
          placeholder="1234567890"
          inputMode="numeric"
          className={o}
        />
        <p className="text-[11px] text-stone-400 mt-1">
          Dán cả dấu cách cũng được, hệ thống tự bỏ.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">
          Chủ tài khoản <span className="text-red-500">*</span>
        </label>
        <input
          value={giaTri.accountHolder}
          onChange={(e) => onChange({ ...giaTri, accountHolder: e.target.value })}
          placeholder="NGUYEN VAN A"
          className={o}
        />
        <p className="text-[11px] text-stone-400 mt-1">
          Ghi đúng như tên đăng ký ở ngân hàng, không dấu.
        </p>
      </div>
    </div>
  )
}
