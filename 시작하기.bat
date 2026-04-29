@echo off
chcp 949 > nul
title 허니문 가이드 - 로컬 서버

echo.
echo ========================================
echo   허니문 지중해 크루즈 가이드
echo   로컬 서버를 시작합니다...
echo ========================================
echo.

REM Move into the travel-guide folder
cd /d "%~dp0travel-guide"

if not exist "index.html" (
    echo [ERROR] travel-guide 폴더를 찾을 수 없습니다.
    echo 이 파일은 "신행 계획공유 표" 폴더 안에 있어야 합니다.
    pause
    exit /b 1
)

REM Find a free Python
where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Python이 설치되어 있지 않습니다.
        echo https://www.python.org/downloads/ 에서 설치 후 다시 실행하세요.
        pause
        exit /b 1
    )
    set PY=py
) else (
    set PY=python
)

echo [OK] Python 발견. 서버 시작 중...
echo.
echo ----------------------------------------
echo  접속 주소:
echo    내 PC:    http://localhost:8765
echo    핸드폰:   http://(이 PC IP):8765
echo ----------------------------------------
echo.
echo 같은 와이파이의 핸드폰에서도 접속하려면
echo 위 IP 주소가 필요합니다 (cmd > ipconfig).
echo.
echo 서버 종료: 이 창에서 Ctrl+C
echo.

REM Open browser after a short delay
start "" cmd /c "timeout /t 2 /nobreak > nul && start http://localhost:8765"

REM Start server (binds to all interfaces so phones can connect)
%PY% -m http.server 8765 --bind 0.0.0.0

pause
