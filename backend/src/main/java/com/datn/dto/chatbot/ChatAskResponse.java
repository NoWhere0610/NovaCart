package com.datn.dto.chatbot;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ChatAskResponse {
    private String sessionId;
    private String answer;
    private List<String> sources;
}
