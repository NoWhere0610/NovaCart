package com.datn.dto.chatbot;

import lombok.Builder;
import lombok.Getter;

/** Body gửi sang chatbot kit (Node.js) tại POST {api-base}/api/chat/ask. `userId` lấy từ JWT đã xác
 * thực, không nhận trực tiếp từ client, tránh user giả mạo userId để đọc lịch sử chat người khác. */
@Getter
@Builder
public class KitAskRequest {
    private String namespace;
    private String userId;
    private String sessionId;
    private String question;
}
