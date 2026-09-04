@echo off

REM Chatbot khoi dong TRUOC backend: backend goi sang kit qua http://localhost:3200 (xem
REM novacart.chatbot.api-base). Bat sau thi vai lam dau tien cua khach se loi ket noi.
start "Chatbot - RAG Kit" cmd /k "cd chatbot && title Chatbot Server && npm start"

timeout /t 3 /nobreak >nul

start "Backend - Spring Boot" cmd /k "cd backend && title Backend Server && mvnw spring-boot:run"

timeout /t 3 /nobreak >nul

start "Frontend - Vite React" cmd /k "cd frontend && title Frontend Server && npm run dev"

echo.
echo   - Chatbot  chay o: http://localhost:3200
echo   - Backend  chay o: http://localhost:8080
echo   - Frontend chay o: http://localhost:5173
echo.
echo   Chatbot can chatbot\.env (khoa Gemini + PostgreSQL). Chua co thi cua so
echo   Chatbot Server se bao loi ngay luc khoi dong -- backend/frontend van chay
echo   binh thuong, chi rieng khung chat la khong tra loi duoc.
echo.
echo   (Cam tat 3 cua so hien len)
pause
