package com.datn.dto.chatbot;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChatAskRequest {

    @NotBlank(message = "Câu hỏi không được để trống")
    private String question;

    // Null ở lượt hỏi đầu tiên -> kit tự tạo phiên chat mới và trả lại sessionId để FE dùng cho các
    // lượt hỏi tiếp theo trong CÙNG 1 cuộc trò chuyện (giữ ngữ cảnh, nhớ tối đa 8 LƯỢT hỏi-đáp gần nhất
    // = 16 dòng tin nhắn, xem MEMORY_TURNS trong chatbot/lib/ragQuery.js).
    // chat_session.id là UUID -- chặn chuỗi không đúng định dạng ngay tại đây để không phải nhờ Postgres
    // báo lỗi kiểu dữ liệu (thông điệp lỗi đó từng hiển thị thẳng trong khung chat của khách).
    @Pattern(regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
            message = "Mã phiên chat không hợp lệ")
    private String sessionId;
}
