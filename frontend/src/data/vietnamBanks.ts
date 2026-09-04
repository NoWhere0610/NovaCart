/**
 * Ngân hàng Việt Nam, dùng cho ô chọn nơi nhận tiền hoàn.
 *
 * VÌ SAO LÀ DANH SÁCH CHỌN CHỨ KHÔNG PHẢI Ô GÕ TỰ DO: nhân viên shop đọc thông tin này rồi chuyển
 * khoản BẰNG TAY. Khách gõ "vietcom", "VCB", "ngân hàng ngoại thương" thì vẫn là một ngân hàng nhưng
 * mỗi người viết một kiểu, và người chuyển tiền phải đoán. Tên chuẩn hoá thì đọc phát là biết.
 *
 * Vẫn cho gõ tự do khi cần (SearchableSelect có mục "Khác"), vì danh sách này không thể đủ mọi ngân
 * hàng và quỹ tín dụng -- chặn cứng thì khách dùng ngân hàng nhỏ không gửi được yêu cầu.
 */
export interface Bank {
  /** Mã viết tắt, cũng là giá trị lưu xuống -- KHÔNG lưu mã này, xem tenDayDu. */
  ma: string
  /** Tên hiển thị và cũng là thứ được lưu vào đơn hàng: người chuyển khoản cần đọc hiểu ngay. */
  tenDayDu: string
}

/** Xếp theo mức phổ biến với khách hàng cá nhân, không phải theo bảng chữ cái -- ô tìm kiếm lo phần còn lại. */
export const NGAN_HANG_VN: Bank[] = [
  { ma: 'VCB', tenDayDu: 'Vietcombank (Ngoại thương)' },
  { ma: 'TCB', tenDayDu: 'Techcombank (Kỹ thương)' },
  { ma: 'MB', tenDayDu: 'MB Bank (Quân đội)' },
  { ma: 'VTB', tenDayDu: 'VietinBank (Công thương)' },
  { ma: 'BIDV', tenDayDu: 'BIDV (Đầu tư và Phát triển)' },
  { ma: 'ACB', tenDayDu: 'ACB (Á Châu)' },
  { ma: 'VPB', tenDayDu: 'VPBank (Việt Nam Thịnh vượng)' },
  { ma: 'TPB', tenDayDu: 'TPBank (Tiên Phong)' },
  { ma: 'SCB', tenDayDu: 'Sacombank (Sài Gòn Thương Tín)' },
  { ma: 'AGR', tenDayDu: 'Agribank (Nông nghiệp và PTNT)' },
  { ma: 'HDB', tenDayDu: 'HDBank (Phát triển TP.HCM)' },
  { ma: 'VIB', tenDayDu: 'VIB (Quốc tế)' },
  { ma: 'SHB', tenDayDu: 'SHB (Sài Gòn - Hà Nội)' },
  { ma: 'OCB', tenDayDu: 'OCB (Phương Đông)' },
  { ma: 'MSB', tenDayDu: 'MSB (Hàng hải)' },
  { ma: 'SEA', tenDayDu: 'SeABank (Đông Nam Á)' },
  { ma: 'EIB', tenDayDu: 'Eximbank (Xuất nhập khẩu)' },
  { ma: 'LPB', tenDayDu: 'LPBank (Lộc Phát)' },
  { ma: 'NAB', tenDayDu: 'Nam A Bank (Nam Á)' },
  { ma: 'ABB', tenDayDu: 'ABBANK (An Bình)' },
  { ma: 'BVB', tenDayDu: 'BVBank (Bản Việt)' },
  { ma: 'PVCB', tenDayDu: 'PVcomBank (Đại chúng)' },
  { ma: 'SGB', tenDayDu: 'Saigonbank (Sài Gòn Công thương)' },
  { ma: 'VAB', tenDayDu: 'VietABank (Việt Á)' },
  { ma: 'BAB', tenDayDu: 'Bac A Bank (Bắc Á)' },
  { ma: 'KLB', tenDayDu: 'KienlongBank (Kiên Long)' },
  { ma: 'VBB', tenDayDu: 'VietBank (Việt Nam Thương Tín)' },
  { ma: 'PGB', tenDayDu: 'PGBank (Thịnh vượng và Phát triển)' },
  { ma: 'NCB', tenDayDu: 'NCB (Quốc dân)' },
  { ma: 'CAKE', tenDayDu: 'CAKE by VPBank' },
  { ma: 'TIMO', tenDayDu: 'Timo' },
  { ma: 'UBANK', tenDayDu: 'Ubank by VPBank' },
  { ma: 'COOPB', tenDayDu: 'Co-opBank (Hợp tác xã)' },
  { ma: 'SCBVN', tenDayDu: 'Standard Chartered Việt Nam' },
  { ma: 'SHBVN', tenDayDu: 'Shinhan Bank Việt Nam' },
  { ma: 'WOORI', tenDayDu: 'Woori Bank Việt Nam' },
  { ma: 'HSBC', tenDayDu: 'HSBC Việt Nam' },
  { ma: 'UOB', tenDayDu: 'UOB Việt Nam' },
  { ma: 'PBVN', tenDayDu: 'Public Bank Việt Nam' },
  { ma: 'IVB', tenDayDu: 'Indovina Bank' },
]
