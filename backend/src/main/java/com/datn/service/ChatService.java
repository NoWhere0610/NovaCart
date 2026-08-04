package com.datn.service;

import com.datn.dto.chatbot.ChatAskRequest;
import com.datn.dto.chatbot.ChatAskResponse;
import com.datn.dto.chatbot.KitAskRequest;
import com.datn.dto.chatbot.KitAskResponse;
import com.datn.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Cầu nối duy nhất giữa NovaCart và chatbot kit. Gắn userId thật từ JWT (không tin userId
 * client tự truyền, tránh lộ lịch sử chat người khác) và giấu X-API-Key của kit khỏi frontend.
 */
@Service
public class ChatService {

    private final RestClient restClient;
    private final String namespace;

    public ChatService(
            @Value("${novacart.chatbot.api-base}") String apiBase,
            @Value("${novacart.chatbot.api-key}") String apiKey,
            @Value("${novacart.chatbot.namespace}") String namespace) {
        this.namespace = namespace;
        this.restClient = RestClient.builder()
                .baseUrl(apiBase)
                .defaultHeader("X-API-Key", apiKey)
                .build();
    }

    public ChatAskResponse ask(Long userId, ChatAskRequest request) {
        KitAskRequest body = KitAskRequest.builder()
                .namespace(namespace)
                .userId(String.valueOf(userId))
                .sessionId(request.getSessionId())
                .question(request.getQuestion())
                .build();

        KitAskResponse kitResponse;
        try {
            kitResponse = restClient.post()
                    .uri("/api/chat/ask")
                    .body(body)
                    .retrieve()
                    .body(KitAskResponse.class);
        } catch (RestClientResponseException e) {
            // Kit trả lỗi có cấu trúc (body JSON {ok:false, message}) -- đọc lại để trả thông điệp rõ ràng.
            KitAskResponse errorBody = e.getResponseBodyAs(KitAskResponse.class);
            throw new ApiException(HttpStatus.BAD_GATEWAY, messageOrDefault(errorBody));
        } catch (Exception e) {
            // Kit chưa chạy / mất kết nối mạng / timeout...
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Không kết nối được tới dịch vụ tư vấn. Vui lòng thử lại sau.");
        }

        if (kitResponse == null || !kitResponse.isOk()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, messageOrDefault(kitResponse));
        }

        return ChatAskResponse.builder()
                .sessionId(kitResponse.getSessionId())
                .answer(kitResponse.getAnswer())
                .sources(kitResponse.getSources())
                .build();
    }

    private String messageOrDefault(KitAskResponse body) {
        return body != null && body.getMessage() != null ? body.getMessage() : "Dịch vụ tư vấn tạm thời không phản hồi.";
    }
}
