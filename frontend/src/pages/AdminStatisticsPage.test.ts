import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildChartData, computeQuickRange, toIsoDate } from './AdminStatisticsPage'
import type { RevenuePoint } from '../api/statisticsApi'

/**
 * Chỉ test các hàm THUẦN của trang Thống kê -- không render component, không jsdom.
 * Ba hàm dưới đây là nơi duy nhất ở frontend từng gây SAI SỐ LIỆU (lệch 1 ngày do UTC), phần còn lại
 * của trang chỉ hiển thị số do backend tính, và backend đã có test riêng.
 */

afterEach(() => {
  vi.useRealTimers()
})

describe('toIsoDate', () => {
  it('định dạng theo giờ địa phương, không lệch ngày như toISOString()', () => {
    const nuaDem1Thang9 = new Date(2026, 8, 1) // 0h ngày 01/09 giờ Việt Nam

    expect(toIsoDate(nuaDem1Thang9)).toBe('2026-09-01')
    // Đây chính là lỗi đã xảy ra: Việt Nam UTC+7 nên đổi sang UTC lùi về ngày hôm trước.
    expect(nuaDem1Thang9.toISOString().slice(0, 10)).toBe('2026-08-31')
  })

  it('đệm 0 cho tháng và ngày một chữ số', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('computeQuickRange', () => {
  /** Cố định đồng hồ: 15/09/2026 là thứ Ba, nằm giữa tháng và giữa quý 3. */
  function coDinhNgay() {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 15, 10, 30))
  }

  it('Hôm nay', () => {
    coDinhNgay()
    expect(computeQuickRange('today')).toEqual({ from: '2026-09-15', to: '2026-09-15' })
  })

  it('7 ngày gồm cả hôm nay (không phải 8 ngày)', () => {
    coDinhNgay()
    expect(computeQuickRange('7d')).toEqual({ from: '2026-09-09', to: '2026-09-15' })
  })

  it('30 ngày gồm cả hôm nay', () => {
    coDinhNgay()
    expect(computeQuickRange('30d')).toEqual({ from: '2026-08-17', to: '2026-09-15' })
  })

  it('Tháng này bắt đầu từ ngày 01, không lùi về cuối tháng trước', () => {
    coDinhNgay()
    expect(computeQuickRange('thisMonth')).toEqual({ from: '2026-09-01', to: '2026-09-15' })
  })

  it('Tháng trước lấy trọn tháng, đúng ngày cuối tháng', () => {
    coDinhNgay()
    expect(computeQuickRange('lastMonth')).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })

  it('Quý này bắt đầu từ đầu quý 3', () => {
    coDinhNgay()
    expect(computeQuickRange('thisQuarter')).toEqual({ from: '2026-07-01', to: '2026-09-15' })
  })

  it('Quý trước lấy trọn quý 2', () => {
    coDinhNgay()
    expect(computeQuickRange('lastQuarter')).toEqual({ from: '2026-04-01', to: '2026-06-30' })
  })

  it('Năm nay bắt đầu từ 01/01', () => {
    coDinhNgay()
    expect(computeQuickRange('thisYear')).toEqual({ from: '2026-01-01', to: '2026-09-15' })
  })

  it('Năm trước lấy trọn năm', () => {
    coDinhNgay()
    expect(computeQuickRange('lastYear')).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })

  it('Ngày 01 của tháng: "Tháng này" vẫn ra ngày 01, không lùi sang tháng trước', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 0, 30)) // đúng ca từng lộ lỗi UTC
    expect(computeQuickRange('thisMonth')).toEqual({ from: '2026-09-01', to: '2026-09-01' })
  })

  it('Tháng trước tính từ tháng 1 thì lùi sang tháng 12 năm ngoái', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 10))
    expect(computeQuickRange('lastMonth')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('Quý trước tính từ quý 1 thì lùi sang quý 4 năm ngoái', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 10)) // tháng 2 = quý 1
    expect(computeQuickRange('lastQuarter')).toEqual({ from: '2025-10-01', to: '2025-12-31' })
  })
})

describe('buildChartData', () => {
  function diem(soNgay: number, doanhThuMoiNgay = 1000): RevenuePoint[] {
    const ra: RevenuePoint[] = []
    const d = new Date(2026, 0, 1)
    for (let i = 0; i < soNgay; i++) {
      ra.push({
        date: toIsoDate(d),
        revenue: doanhThuMoiNgay,
        returnedRevenue: 100,
        orderCount: 2,
      })
      d.setDate(d.getDate() + 1)
    }
    return ra
  }

  it('62 ngày trở xuống thì vẽ theo ngày, giữ nguyên số cột', () => {
    const kq = buildChartData(diem(62))
    expect(kq.granularity).toBe('day')
    expect(kq.data).toHaveLength(62)
  })

  it('63 ngày thì chuyển sang gộp theo tuần', () => {
    expect(buildChartData(diem(63)).granularity).toBe('week')
  })

  it('186 ngày vẫn gộp theo tuần', () => {
    expect(buildChartData(diem(186)).granularity).toBe('week')
  })

  it('187 ngày thì gộp theo tháng', () => {
    expect(buildChartData(diem(187)).granularity).toBe('month')
  })

  it('gộp theo tuần KHÔNG làm mất hay nhân đôi tiền', () => {
    const points = diem(100)
    const kq = buildChartData(points)
    const tong = (xs: { revenue: number; returnedRevenue: number; orderCount: number }[]) => ({
      revenue: xs.reduce((s, x) => s + x.revenue, 0),
      returnedRevenue: xs.reduce((s, x) => s + x.returnedRevenue, 0),
      orderCount: xs.reduce((s, x) => s + x.orderCount, 0),
    })
    expect(tong(kq.data)).toEqual(tong(points))
  })

  it('gộp theo tháng cũng bảo toàn tổng', () => {
    const points = diem(365)
    const kq = buildChartData(points)
    expect(kq.granularity).toBe('month')
    expect(kq.data).toHaveLength(12)
    expect(kq.data.reduce((s, x) => s + x.revenue, 0)).toBe(365 * 1000)
  })

  it('danh sách rỗng không làm vỡ biểu đồ', () => {
    expect(buildChartData([])).toEqual({ granularity: 'day', data: [] })
  })
})
