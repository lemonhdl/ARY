@echo off
setlocal

cd /d "%~dp0"

set "PID_FILE=%CD%\runtime-data\web-app.pid"

set "PID="

if exist "%PID_FILE%" (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content -Path '%PID_FILE%' -Raw).Trim()"`) do set "PID=%%I"
)

if "%PID%"=="" (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($conn) { $conn.OwningProcess }"`) do set "PID=%%I"
)

if "%PID%"=="" (
  echo [INFO] No running web app found. Nothing to stop.
  del "%PID_FILE%" >nul 2>nul
  exit /b 0
)

tasklist /FI "PID eq %PID%" | find "%PID%" >nul 2>nul
if errorlevel 1 (
  echo [INFO] Process %PID% is not running. Removing stale pid file.
  del "%PID_FILE%" >nul 2>nul
  exit /b 0
)

taskkill /PID %PID% /T /F >nul
if errorlevel 1 (
  echo [ERROR] Failed to stop ARY web app. PID=%PID%
  exit /b 1
)

del "%PID_FILE%" >nul 2>nul
echo [INFO] Stopped ARY web app. PID=%PID%
exit /b 0