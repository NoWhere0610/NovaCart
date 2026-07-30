import { useState, useRef, useEffect } from 'react';

// DÁN MÃ AQ... CỦA BẠN VÀO ĐÂY (Giữ nguyên ngoặc kép)
const GEMINI_API_KEY = ""; 

type Message = {
  id: number;
  text: string;
  sender: 'user' | 'bot';
};

export default function FloatingSocialButtons() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: 'Chào bạn! Mình là trợ lý AI (Gemini). Mình có thể tư vấn sản phẩm gì cho bạn hôm nay?', sender: 'bot' }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    setInputText('');
    
    setMessages(prev => [...prev, { id: Date.now(), text: userMsg, sender: 'user' }]);
    setIsLoading(true);

    try {
      // Đã đổi sang gemini-2.0-flash và chuẩn hóa lại toàn bộ dấu ngoặc
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: userMsg }]
            }]
          })
        }
      );

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const botReply = data.candidates[0].content.parts[0].text;
      setMessages(prev => [...prev, { id: Date.now(), text: botReply, sender: 'bot' }]);
      
    } catch (error: any) {
      console.error("Lỗi khi gọi API Gemini:", error);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        text: "Xin lỗi, hệ thống AI đang bận hoặc có lỗi kết nối. Bạn kiểm tra lại console nhé!", 
        sender: 'bot' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[350px] h-[550px] max-h-[80vh] bg-gray-50 border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          <div className="bg-emerald-600 text-white px-4 py-3 flex justify-between items-center shadow-md z-10">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM5 16v3h14v-3H5zm7-7a5 5 0 0 0-4.9 4h9.8A5 5 0 0 0 12 9zm-2 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
              </svg>
              <h3 className="font-semibold m-0 flex items-center gap-2">
                Gemini Assistant
                <span className="flex h-2 w-2 rounded-full bg-green-300 animate-pulse"></span>
              </h3>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-gray-200 text-2xl font-bold leading-none cursor-pointer outline-none">
              &times;
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm whitespace-pre-wrap ${
                    msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                  }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 text-gray-500 rounded-2xl rounded-tl-none px-4 py-3 text-sm shadow-sm flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 flex gap-2 items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập tin nhắn..."
              className="flex-1 bg-gray-100 text-sm rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all border-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <a href="https://www.tiktok.com/@cuong05100" target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-full bg-black shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M16.6 5.82c-.99-.99-1.55-2.31-1.6-3.82h-3.14v13.7c0 1.5-1.22 2.72-2.72 2.72a2.72 2.72 0 0 1 0-5.44c.26 0 .5.03.74.1V9.9a6 6 0 0 0-.74-.05A5.9 5.9 0 0 0 3.24 15.8a5.9 5.9 0 0 0 5.9 5.9c3.26 0 5.9-2.64 5.9-5.9V8.6a9.06 9.06 0 0 0 5.28 1.7V7.16c-1.36 0-2.62-.44-3.72-1.34z" /></svg>
        </a>

        <button onClick={() => setIsChatOpen(!isChatOpen)} className="w-14 h-14 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:scale-110 transition-transform cursor-pointer border-none outline-none">
          {isChatOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM5 16v3h14v-3H5zm7-7a5 5 0 0 0-4.9 4h9.8A5 5 0 0 0 12 9zm-2 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" /></svg>
          )}
        </button>

        <a href="https://www.facebook.com/tran.cuong.04276" target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-full bg-blue-600 shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.13 2 11.23c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.87.38 2.92.38 5.52 0 10-4.13 10-9.29C22 6.13 17.52 2 12 2zm1.02 12.51-2.55-2.72-4.98 2.72 5.48-5.82 2.6 2.72 4.93-2.72-5.48 5.82z" /></svg>
        </a>
      </div>
    </>
  );
}