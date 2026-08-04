package com.datn.dto.chatbot;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Response THÔ từ chatbot kit (Node.js) tại POST {api-base}/api/chat/ask --
 * xem router.post('/ask', ...) trong routes/chatSession.js bên kit. */
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class KitAskResponse {
    private boolean ok;
    private String sessionId;
    private String answer;
    private List<String> sources;
    private String reason;
    private String message;
}
