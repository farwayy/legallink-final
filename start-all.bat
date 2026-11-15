@echo off
echo ==================================================
echo   Starting LegalLink Project Services
echo ==================================================

echo [1/3] Starting MongoDB...
start "MongoDB Service" cmd /k "start-mongo.bat"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Backend API Server...
start "Backend Server (Port 5000)" cmd /k "cd backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [3/3] Starting Frontend React App...
start "Frontend App (Port 3000)" cmd /k "cd frontend && npm start"

echo ==================================================
echo   All services launched!
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:5000
echo ==================================================
