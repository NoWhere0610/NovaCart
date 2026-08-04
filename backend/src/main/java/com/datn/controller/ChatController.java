package com.datn.controller;

import com.datn.dto.chatbot.ChatAskRequest;
import com.datn.dto.chatbot.ChatAskResponse;
import com.datn.security.UserPrincipal;
import com.datn.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Toàn bộ endpoint yêu cầu đăng nhập (không nằm trong PUBLIC_ENDPOINTS) --
 * chatbot tư vấn chỉ phục vụ khách đã đăng nhập. React KHÔNG gọi thẳng
 * chatbot kit (Node.js) -- luôn qua đây để Java gắn đúng userId thật + giấu
 * API key của kit, xem ChatService.
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping("/ask")
    public ResponseEntity<ChatAskResponse> ask(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChatAskRequest request) {
        return ResponseEntity.ok(chatService.ask(principal.getUserId(), request));
    }
}
