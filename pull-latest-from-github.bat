@echo off
setlocal

REM Pull latest changes from the current tracked branch.
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist .git (
  echo This folder is not a git repository yet.
  echo Run setup-github-first-time.bat first.
  pause
  exit /b 1
)

git pull
if errorlevel 1 (
  echo.
  echo Pull failed. Check remote/branch/authentication.
  pause
  exit /b 1
)

echo.
echo Pull complete.
pause
exit /b 0
