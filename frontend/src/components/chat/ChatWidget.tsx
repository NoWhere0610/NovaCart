import { useEffect, useRef, useState, type FormEvent } from 'react'
import { IconMessageChatbot, IconX, IconSend } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { askChatbot } from '../../api/chatApi'

type ChatMessage = {
  id: number
  text: string
  sender: 'user' | 'bot'
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 0,
  sender: 'bot',
  text: 'Chào bạn! Mình là trợ lý tư vấn của NovaCart. Bạn đang tìm món đồ như thế nào — dịp mặc, ngân sách, size ra sao để mình gợi ý cho đúng nhé?',
}

/**
 * Widget chat nổi, tách riêng khỏi FloatingSocialButtons (chỉ còn link mạng xã hội).
 * Chỉ hiện khi đã đăng nhập vì backend yêu cầu JWT (chatbot tư vấn không phục vụ khách vãng lai).
 * KHÔNG gọi Gemini/kit trực tiếp — luôn qua askChatbot() -> Java ChatController.
 */
export default function ChatWidget() {
  const { isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  // Ref (không phải state) vì chỉ cần lưu để gửi kèm lượt hỏi sau, không cần re-render khi đổi.
  const sessionIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Chatbot chỉ phục vụ khách đã đăng nhập (đúng scope hiện tại) -- không hiện bong bóng chat cho
  // khách vãng lai thay vì hiện ra rồi báo lỗi 401 khi bấm gửi.
  if (!isAuthenticated) return null

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const question = inputText.trim()
    if (!question || isLoading) return

    setInputText('')
    setMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text: question }])
    setIsLoading(true)
    try {
      const res = await askChatbot(question, sessionIdRef.current)
      sessionIdRef.current = res.sessionId
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'bot', text: res.answer }])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: err.response?.data?.message ?? 'Xin lỗi, trợ lý đang bận. Bạn thử lại sau ít phút nhé.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[350px] h-[550px] max-h-[80vh] bg-stone-50 border border-stone-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-stone-900 text-white px-4 py-3 flex justify-between items-center border-b-2 border-gold-metallic">
            <div className="flex items-center gap-2">
              <IconMessageChatbot size={18} stroke={1.8} className="text-gold" />
              <h3 className="font-display font-semibold text-sm m-0">Tư vấn NovaCart</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Đóng chat"
              className="p-1.5 -m-1.5 rounded-full text-white hover:text-gold hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <IconX size={18} stroke={2} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-4 py-2 text-sm whitespace-pre-wrap ${
                    msg.sender === 'user' ? 'bg-stone-900 text-white' : 'bg-white text-stone-800 border border-stone-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-stone-200 text-stone-500 px-4 py-3 text-sm flex gap-1">
                  <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-200 flex gap-2 items-center">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập câu hỏi..."
              disabled={isLoading}
              className="flex-1 bg-stone-100 text-sm px-4 py-2 outline-none focus:ring-1 focus:ring-gold border-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              aria-label="Gửi"
              className="w-9 h-9 bg-stone-900 border-gold-metallic gold-glow disabled:opacity-50 text-white flex items-center justify-center"
            >
              <IconSend size={16} stroke={2} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Trợ lý tư vấn"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full border-gold-metallic-round gold-glow shadow-lg flex items-center justify-center hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50"
      >
        {isOpen ? <IconX size={22} stroke={2} color="white" /> : <IconMessageChatbot size={24} stroke={1.8} color="white" />}
      </button>
    </>
  )
}
