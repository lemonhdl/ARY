@echo off
setlocal

cd /d "%~dp0"

set "NODE_BIN="
set "PID_FILE=%CD%\runtime-data\web-app.pid"

set "LISTEN_PID="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($conn) { $conn.OwningProcess }"`) do set "LISTEN_PID=%%I"

if defined LISTEN_PID (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllText('%PID_FILE%', '%LISTEN_PID%', [System.Text.Encoding]::ASCII)" >nul
  echo [INFO] ARY web app is already listening on port 3000. PID=%LISTEN_PID%
  exit /b 0
)

where node >nul 2>nul
if not errorlevel 1 set "NODE_BIN=node"

if not defined NODE_BIN if exist "C:\Program Files\nodejs\node.exe" set "NODE_BIN=C:\Program Files\nodejs\node.exe"
if not defined NODE_BIN if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_BIN=C:\Program Files (x86)\nodejs\node.exe"
if not defined NODE_BIN if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_BIN=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE_BIN (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'; if (Test-Path $root) { Get-ChildItem -Path $root -Recurse -Filter node.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }"`) do set "NODE_BIN=%%I"
)

if not defined NODE_BIN (
  echo [ERROR] node not found in PATH or common install locations. Install Node.js 18+ first.
  exit /b 1
)

if not exist "runtime-data" mkdir "runtime-data"

if exist "%PID_FILE%" (
  set "EXISTING_PID="
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content -Path '%PID_FILE%' -Raw).Trim()"`) do set "EXISTING_PID=%%I"
  if defined EXISTING_PID (
    tasklist /FI "PID eq %EXISTING_PID%" | find "%EXISTING_PID%" >nul 2>nul
    if not errorlevel 1 (
      echo [INFO] ARY web app is already running. PID=%EXISTING_PID%
      exit /b 0
    )
  )
  del "%PID_FILE%" >nul 2>nul
)

"%NODE_BIN%" "scripts\assemble.js"
if errorlevel 1 (
  echo [ERROR] Failed to assemble runtime data.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$workdir = (Resolve-Path '.').Path; " ^
  "$proc = Start-Process -FilePath '%NODE_BIN%' -ArgumentList 'app/server/index.js' -WorkingDirectory $workdir -PassThru -WindowStyle Hidden -RedirectStandardOutput 'runtime-data/web-app.log' -RedirectStandardError 'runtime-data/web-app.error.log'; " ^
  "[System.IO.File]::WriteAllText('runtime-data/web-app.pid', [string]$proc.Id, [System.Text.Encoding]::ASCII); " ^
  "Write-Host ('[INFO] Started ARY web app. PID=' + $proc.Id + ' URL=http://127.0.0.1:3000')"

if errorlevel 1 (
  echo [ERROR] Failed to start ARY web app.
  exit /b 1
)

exit /b 0