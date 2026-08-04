@echo off

start "Backend - Spring Boot" cmd /k "cd backend && title Backend Server && mvnw spring-boot:run"

timeout /t 3 /nobreak >nul

start "Frontend - Vite React" cmd /k "cd frontend && title Frontend Server && npm run dev"

echo.
echo   - Backend chay o: http://localhost:8080
echo   - Frontend chay o: http://localhost:5173
echo   (Cam tat 2 cua so hien len)
pause