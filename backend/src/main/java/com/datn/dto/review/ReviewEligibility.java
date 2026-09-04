package com.datn.dto.review;

import lombok.Builder;
import lombok.Getter;

/**
 * Người đang đăng nhập có được viết đánh giá cho sản phẩm này không.
 *
 * VÌ SAO CẦN: trước đây frontend cứ hiện form cho mọi người đã đăng nhập, backend mới từ chối lúc bấm
 * Gửi. Khách chưa từng mua vẫn chọn sao, gõ hết cảm nhận, bấm gửi rồi mới biết là không được -- công
 * gõ vứt đi, và cảm giác như hệ thống lừa mình.
 *
 * Câu giải thích đặt Ở BACKEND chứ không phải frontend tự chế: nó phải khớp từng chữ với thông báo lỗi
 * khi thật sự gửi, nếu không cùng một tình huống lại có hai cách nói khác nhau.
 */
@Getter
@Builder
public class ReviewEligibility {

    private boolean coTheDanhGia;

    /** Lý do không được đánh giá, viết sẵn cho khách đọc. null khi được phép. */
    private String lyDo;
}
