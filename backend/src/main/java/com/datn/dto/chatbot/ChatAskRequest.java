package com.datn.dto.chatbot;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChatAskRequest {

    @NotBlank(message = "Câu hỏi không được để trống")
    private String question;

    // Null ở lượt hỏi đầu tiên -> kit tự tạo phiên chat mới và trả lại sessionId để FE dùng cho các
    // lượt hỏi tiếp theo trong CÙNG 1 cuộc trò chuyện (giữ ngữ cảnh, nhớ tối đa 8 lượt gần nhất).
    private String sessionId;
}
