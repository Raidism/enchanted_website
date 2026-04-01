@echo off
setlocal

REM Use this after first-time setup to quickly push updates.
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

set /p commit_msg=Enter commit message: 
if "%commit_msg%"=="" (
  echo Commit message cannot be empty.
  pause
  exit /b 1
)

git add -A
git add -f server/data/*.json 2>nul
git commit -m "%commit_msg%"
if errorlevel 1 (
  echo.
  echo No commit created. You may have no changes.
)

git push
if errorlevel 1 (
  echo.
  echo Push failed. Check remote/branch/authentication.
  pause
  exit /b 1
)

echo.
echo Push complete.
pause
exit /b 0
