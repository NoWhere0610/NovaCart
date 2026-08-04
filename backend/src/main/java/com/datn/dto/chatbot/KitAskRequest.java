package com.datn.dto.chatbot;

import lombok.Builder;
import lombok.Getter;

/** Body gửi SANG chatbot kit (Node.js) tại POST {api-base}/api/chat/ask -- xem
 * routes/chatSession.js bên kit. `userId` lấy từ JWT đã xác thực (KHÔNG bao
 * giờ nhận trực tiếp từ client) để tránh 1 user đọc được lịch sử chat của
 * người khác bằng cách tự truyền userId giả. */
@Getter
@Builder
public class KitAskRequest {
    private String namespace;
    private String userId;
    private String sessionId;
    private String question;
}
