import { apiClient } from './apiClient'

export interface ChatAskResponse {
  sessionId: string
  answer: string
  sources: string[]
}

/** Gọi vào Java (ChatController) — KHÔNG bao giờ gọi thẳng chatbot kit hay Gemini từ frontend.
 * Java tự gắn userId thật (từ JWT) + giấu API key của kit, xem backend ChatService. */
export async function askChatbot(question: string, sessionId: string | null): Promise<ChatAskResponse> {
  const res = await apiClient.post<ChatAskResponse>('/chat/ask', {
    question,
    sessionId: sessionId ?? undefined,
  })
  return res.data
}
