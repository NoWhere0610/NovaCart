package com.datn.service;

import com.datn.dto.chatbot.ChatAskRequest;
import com.datn.dto.chatbot.ChatAskResponse;
import com.datn.dto.chatbot.KitAskRequest;
import com.datn.dto.chatbot.KitAskResponse;
import com.datn.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cầu nối duy nhất giữa NovaCart và chatbot kit. Gắn userId thật từ JWT (không tin userId
 * client tự truyền, tránh lộ lịch sử chat người khác) và giấu X-API-Key của kit khỏi frontend.
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    /**
     * Mỗi tin nhắn tốn 3 lượt gọi Gemini (nhúng câu hỏi + trích điều kiện lọc + sinh câu trả lời), trong
     * đó 2 lượt dùng model chat -- loại có hạn mức theo PHÚT chặt nhất ở gói miễn phí. Toàn hệ thống dùng
     * CHUNG 1 API key, nên 1 tài khoản gõ liên tục là đủ làm mọi khách khác nhận 429, kể cả người vừa gõ
     * câu đầu tiên. Trước đây không có giới hạn nào ở bất kỳ tầng nào: lớp chống lạm dụng duy nhất là
     * "phải đăng nhập", mà tài khoản thì tự đăng ký được.
     */
    private static final int MAX_QUESTIONS_PER_WINDOW = 10;
    private static final Duration RATE_WINDOW = Duration.ofMinutes(1);

    // Bộ đếm trong bộ nhớ: đủ cho 1 instance của đồ án. Chạy nhiều instance thì cần chuyển sang Redis.
    private final Map<Long, Deque<Long>> recentAsksByUser = new ConcurrentHashMap<>();

    private final RestClient restClient;
    private final String namespace;

    public ChatService(
            @Value("${novacart.chatbot.api-base}") String apiBase,
            @Value("${novacart.chatbot.api-key}") String apiKey,
            @Value("${novacart.chatbot.namespace}") String namespace) {
        this.namespace = namespace;
        // RestClient.builder() KHÔNG có timeout mặc định -- kit có thể mất tới hàng chục giây cho 1 câu
        // hỏi (3 lượt gọi Gemini nối tiếp, có retry 429), và nếu 1 lượt treo thì request này treo theo vô
        // thời hạn, người dùng chỉ thấy 3 chấm nhấp nháy không có cách nào huỷ.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(60));
        this.restClient = RestClient.builder()
                .baseUrl(apiBase)
                .requestFactory(factory)
                .defaultHeader("X-API-Key", apiKey)
                .build();
    }

    public ChatAskResponse ask(Long userId, ChatAskRequest request) {
        enforceRateLimit(userId);

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
            // Kit trả lỗi có cấu trúc (body JSON {ok:false, message}). Thông điệp đó có thể là lỗi thô của
            // Postgres/driver -- ghi log để debug, KHÔNG đẩy nguyên văn ra bong bóng chat của khách.
            log.error("Chatbot kit trả lỗi {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Dịch vụ tư vấn tạm thời không phản hồi. Vui lòng thử lại sau ít phút.");
        } catch (Exception e) {
            // Kit chưa chạy / mất kết nối mạng / quá thời gian chờ...
            log.error("Không gọi được chatbot kit", e);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Không kết nối được tới dịch vụ tư vấn. Vui lòng thử lại sau.");
        }

        if (kitResponse == null || !kitResponse.isOk()) {
            // Thông điệp ở nhánh này do chính kit soạn cho người dùng cuối (vd "Dịch vụ AI phản hồi quá
            // lâu") nên hiển thị được -- nhưng vẫn chặn chuỗi rỗng/null.
            throw new ApiException(HttpStatus.BAD_GATEWAY, messageOrDefault(kitResponse));
        }

        return ChatAskResponse.builder()
                .sessionId(kitResponse.getSessionId())
                .answer(kitResponse.getAnswer())
                .sources(kitResponse.getSources())
                .build();
    }

    /** Cửa sổ trượt đơn giản: giữ mốc thời gian các lượt hỏi trong 1 phút gần nhất của từng người dùng. */
    private void enforceRateLimit(Long userId) {
        long now = System.currentTimeMillis();
        long cutoff = now - RATE_WINDOW.toMillis();
        Deque<Long> asks = recentAsksByUser.computeIfAbsent(userId, k -> new ArrayDeque<>());
        synchronized (asks) {
            while (!asks.isEmpty() && asks.peekFirst() < cutoff) {
                asks.pollFirst();
            }
            if (asks.size() >= MAX_QUESTIONS_PER_WINDOW) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                        "Bạn đang hỏi hơi nhanh, vui lòng đợi khoảng 1 phút rồi hỏi tiếp giúp em nhé.");
            }
            asks.addLast(now);
        }
    }

    private String messageOrDefault(KitAskResponse body) {
        return body != null && body.getMessage() != null && !body.getMessage().isBlank()
                ? body.getMessage()
                : "Dịch vụ tư vấn tạm thời không phản hồi.";
    }
}
