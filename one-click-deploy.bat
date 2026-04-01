@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Imperium One-Click Deploy

set "SCRIPT_DIR=%~dp0"
set "LOG_FILE=%SCRIPT_DIR%one-click-deploy.log"
set "EXITCODE=0"

echo ================================================== > "%LOG_FILE%"
echo Imperium One-Click Deploy - %DATE% %TIME% >> "%LOG_FILE%"
echo ================================================== >> "%LOG_FILE%"

call :MAIN >> "%LOG_FILE%" 2>&1
set "EXITCODE=%ERRORLEVEL%"

echo.
echo ===== DEPLOY LOG =====
type "%LOG_FILE%"
echo ======================

if not "%EXITCODE%"=="0" (
  echo.
  echo DEPLOY FAILED with exit code %EXITCODE%.
  echo Read: %LOG_FILE%
) else (
  echo.
  echo DEPLOY SUCCESS.
)

echo.
pause
exit /b %EXITCODE%

:MAIN
set "REPO_DIR="

if exist "%SCRIPT_DIR%imperium_website\.git" set "REPO_DIR=%SCRIPT_DIR%imperium_website"
if exist "%SCRIPT_DIR%.git" set "REPO_DIR=%SCRIPT_DIR%"

if not defined REPO_DIR (
  echo ERROR: Could not find git repo.
  echo Put this file either inside imperium_website or in its parent folder.
  exit /b 1
)

cd /d "%REPO_DIR%" || (
  echo ERROR: Could not enter repo folder: %REPO_DIR%
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git is not installed or not in PATH.
  exit /b 1
)

where plink >nul 2>nul
if errorlevel 1 (
  echo ERROR: plink not found.
  echo Install PuTTY and ensure plink.exe is in PATH.
  echo Download: https://www.putty.org/
  exit /b 1
)

set "REMOTE=origin"
set "BRANCH=main"

set "VPS_HOST=172.86.116.90"
set "VPS_USER=root"
set "VPS_PASS=M5rhND71jMJh7j"
set "VPS_HOST_KEY=ssh-ed25519 255 SHA256:wFIoRvMb8W3VQNK0C9v4A7NFo8QbAaDHBFqcd5wQPrk"
set "VPS_APP_DIR=~/imperium_website"
set "PM2_APP=imperium_website"

echo Repo: %REPO_DIR%
echo Remote: %REMOTE%/%BRANCH%
echo VPS: %VPS_USER%@%VPS_HOST%

echo.
echo Staging changes...
git add -A
git add -f server/data/*.json 2>nul

git diff --cached --quiet
if errorlevel 2 (
  echo ERROR: Could not determine staged changes.
  exit /b 1
)

if errorlevel 1 (
  for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')"') do set "STAMP=%%I"
  set "COMMIT_MSG=Auto deploy !STAMP!"
  echo Creating commit: !COMMIT_MSG!
  git commit -m "!COMMIT_MSG!"
  if errorlevel 1 (
    echo ERROR: Commit failed.
    exit /b 1
  )
) else (
  echo No changes to commit.
)

echo.
echo Pushing to GitHub...
git push "%REMOTE%" "%BRANCH%"
if errorlevel 1 (
  echo ERROR: Git push failed.
  exit /b 1
)

echo.
echo Running VPS deploy...
echo This step can take 1-3 minutes when dependencies are updated.
set "REMOTE_CMD=cd %VPS_APP_DIR% && chmod +x update-vps.sh && APP_DIR=%VPS_APP_DIR% BRANCH=%BRANCH% REMOTE=%REMOTE% PM2_APP=%PM2_APP% ./update-vps.sh --restart"
plink -ssh -batch -hostkey "%VPS_HOST_KEY%" -l %VPS_USER% -pw %VPS_PASS% %VPS_HOST% "%REMOTE_CMD%"
if errorlevel 1 (
  echo ERROR: VPS deploy failed.
  exit /b 1
)

echo VPS deploy completed.
exit /b 0
