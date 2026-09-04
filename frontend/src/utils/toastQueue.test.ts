import { describe, expect, it } from 'vitest'
import { themVaoHangDoi } from './toastQueue'

/**
 * Vì sao đáng test: dự án chưa có môi trường DOM cho test, nên phần hiển thị toast phải kiểm bằng mắt.
 * Riêng đoạn logic này thì kiểm được, và nó chính là chỗ dễ sai nhất -- cắt lệch một vị trí thì hoặc
 * hiện quá số lượng cho phép, hoặc nuốt mất đúng cái toast vừa bắn ra (lỗi tệ nhất: người dùng thao
 * tác xong mà không thấy phản hồi gì, đúng cái mà toast sinh ra để tránh).
 */
describe('themVaoHangDoi', () => {
  it('chưa đầy thì chỉ nối thêm vào cuối', () => {
    expect(themVaoHangDoi(['a'], 'b', 3)).toEqual(['a', 'b'])
    expect(themVaoHangDoi([], 'a', 3)).toEqual(['a'])
  })

  it('vừa đủ số lượng tối đa thì đẩy cái CŨ NHẤT ra', () => {
    expect(themVaoHangDoi(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd'])
  })

  it('không bao giờ vượt quá số lượng tối đa', () => {
    let hangDoi: string[] = []
    for (const x of ['a', 'b', 'c', 'd', 'e', 'f']) {
      hangDoi = themVaoHangDoi(hangDoi, x, 3)
      expect(hangDoi.length).toBeLessThanOrEqual(3)
    }
    expect(hangDoi).toEqual(['d', 'e', 'f'])
  })

  it('toast vừa bắn LUÔN có mặt -- kể cả khi hàng đợi đã đầy', () => {
    expect(themVaoHangDoi(['a', 'b', 'c'], 'moi', 3)).toContain('moi')
    expect(themVaoHangDoi(['a'], 'moi', 1)).toEqual(['moi'])
  })

  it('không sửa mảng gốc (state React phải bất biến)', () => {
    const goc = ['a', 'b', 'c']
    themVaoHangDoi(goc, 'd', 3)
    // Sửa tại chỗ thì React so sánh tham chiếu thấy "không đổi" và bỏ qua lần vẽ lại -- toast không hiện.
    expect(goc).toEqual(['a', 'b', 'c'])
  })

  it('toiDa = 1: chỉ giữ đúng cái mới nhất', () => {
    expect(themVaoHangDoi(['a', 'b'], 'c', 1)).toEqual(['c'])
  })

  it('toiDa = 0 hoặc âm: không giữ gì, không ném lỗi', () => {
    expect(themVaoHangDoi(['a'], 'b', 0)).toEqual([])
    expect(themVaoHangDoi(['a'], 'b', -1)).toEqual([])
  })
})
