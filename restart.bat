@echo off
echo Dang dung backend/frontend dang chay (neu co)...

REM Dong theo tieu de cua so -- khop dung quy uoc start.bat dat qua lenh "title" trong tung cua so.
REM /T diet ca cay tien trinh con (vd java.exe do mvnw spring-boot:run sinh ra), khong chi rieng cmd.exe cha.
taskkill /FI "WINDOWTITLE eq Backend Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend Server*" /T /F >nul 2>&1

REM Du phong: neu cua so bi dong tay truoc do nhung tien trinh van con giu port -- tim theo port dang
REM chay that (8080/5173) roi diet dung PID do, khong dua theo ten cua so nua.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8080 " ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173 " ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>&1

timeout /t 2 /nobreak >nul

echo Dang khoi dong lai...

start "Backend - Spring Boot" cmd /k "cd backend && title Backend Server && mvnw spring-boot:run"

timeout /t 3 /nobreak >nul

start "Frontend - Vite React" cmd /k "cd frontend && title Frontend Server && npm run dev"

echo.
echo   - Backend chay o: http://localhost:8080
echo   - Frontend chay o: http://localhost:5173
echo   (Cam tat 2 cua so hien len)
pause
