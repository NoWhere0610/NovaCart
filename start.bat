@echo off
setlocal

REM ============================================================================
REM  start.bat  -- bat nhung gi CHUA chay, bo qua nhung gi DANG chay.
REM
REM  Truoc day file nay bat vo dieu kien ca 3 dich vu. Neu mot cai da chay san
REM  (vd cua so cu chua tat, hoac dang chay tu IDE) thi cua so moi chet ngay voi
REM  "EADDRINUSE: address already in use" -- mot bai loi Node/Java dai ngoang ma
REM  nguoi moi doc khong hieu la KHONG PHAI loi cua du an.
REM
REM  Khac restart.bat: file do DIET het roi bat lai tu dau. File nay chi bo sung
REM  phan con thieu, chay bao nhieu lan cung khong hai.
REM ============================================================================

set DA_BO_QUA=0

REM ---- Chatbot (3200) ----
REM Bat TRUOC backend: backend goi sang kit qua http://localhost:3200
REM (novacart.chatbot.api-base). Bat sau thi vai luot hoi dau tien bi loi ket noi.
netstat -ano | findstr ":3200 " | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo   [bo qua] Chatbot  -- cong 3200 da co tien trinh dang chay
    set DA_BO_QUA=1
) else (
    echo   [bat]    Chatbot  -- http://localhost:3200
    start "Chatbot - RAG Kit" cmd /k "cd chatbot && title Chatbot Server && npm start"
    timeout /t 3 /nobreak >nul
)

REM ---- Backend (8080) ----
netstat -ano | findstr ":8080 " | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo   [bo qua] Backend  -- cong 8080 da co tien trinh dang chay
    set DA_BO_QUA=1
) else (
    echo   [bat]    Backend  -- http://localhost:8080
    start "Backend - Spring Boot" cmd /k "cd backend && title Backend Server && mvnw spring-boot:run"
    timeout /t 3 /nobreak >nul
)

REM ---- Frontend (5173) ----
netstat -ano | findstr ":5173 " | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo   [bo qua] Frontend -- cong 5173 da co tien trinh dang chay
    set DA_BO_QUA=1
) else (
    echo   [bat]    Frontend -- http://localhost:5173
    start "Frontend - Vite React" cmd /k "cd frontend && title Frontend Server && npm run dev"
)

echo.
echo   Chatbot  http://localhost:3200
echo   Backend  http://localhost:8080
echo   Frontend http://localhost:5173
echo.

if "%DA_BO_QUA%"=="1" (
    echo   Co dich vu bi bo qua vi cong dang ban. Neu do la tien trinh cu bi ket,
    echo   chay restart.bat -- no diet theo PID dang giu cong roi bat lai tu dau.
    echo.
)

echo   Chatbot can chatbot\.env (khoa Gemini + PostgreSQL). Chua co thi cua so
echo   Chatbot Server bao loi ngay luc khoi dong -- backend/frontend van chay
echo   binh thuong, chi rieng khung chat la khong tra loi duoc.
echo.
pause
endlocal
