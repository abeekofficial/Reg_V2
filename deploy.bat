@echo off
echo.
echo ===================================
echo   REGBOT DOCKER DEPLOY
echo ===================================
echo.

REM Docker ishlayaptimi tekshirish
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [XATO] Docker Desktop ishlamayapti!
    echo Docker Desktop ni ishga tushiring va qayta urining.
    pause
    exit /b 1
)

echo [1/4] Eski containerlarni to'xtatish...
docker compose down

echo.
echo [2/4] Image ni build qilish...
docker compose build --no-cache

echo.
echo [3/4] Containerlarni ishga tushirish...
docker compose up -d

echo.
echo [4/4] Holat tekshirish...
timeout /t 3 /nobreak >nul
docker compose ps

echo.
echo ===================================
echo Loglarni ko'rish uchun:
echo   docker compose logs -f bot
echo.
echo To'xtatish uchun:
echo   docker compose down
echo ===================================
echo.
pause
