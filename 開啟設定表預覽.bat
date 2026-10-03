@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js 20 or later.
  pause
  exit /b 1
)

start "OC Workshop Preview Server" /D "%~dp0" cmd.exe /k "node preview-server.js"
for /l %%i in (1,1,20) do (
  curl.exe --silent --output NUL "http://127.0.0.1:8123/"
  if not errorlevel 1 goto server_ready
  timeout /t 1 /nobreak >nul
)
echo Preview server did not start within 20 seconds. Check the server window for errors.
pause
exit /b 1

:server_ready
start "" "http://127.0.0.1:8123/"

endlocal
