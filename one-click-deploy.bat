@echo off
setlocal EnableExtensions
title Imperium One-Click Deploy

if /I not "%~1"=="__CONSOLE__" (
  cmd /k ""%~f0" __CONSOLE__"
  exit /b
)

set "SCRIPT_DIR=%~dp0"
set "LOG_FILE=%TEMP%\imperium-one-click-deploy.log"
set "EXITCODE=0"
set "REPO_DIR="
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
set "REMOTE=origin"
set "BRANCH=main"
set "VPS_HOST=192.168.1.79"
set "VPS_USER=root"
set "VPS_APP_DIR=/var/www/vps_files/imperium_website"
set "PM2_APP=imperium_website"

> "%LOG_FILE%" echo ==================================================
>> "%LOG_FILE%" echo Imperium One-Click Deploy - %DATE% %TIME%
>> "%LOG_FILE%" echo ==================================================

echo.
echo ==================================================
echo  Imperium One-Click Deploy   %DATE%  %TIME%
echo ==================================================
echo.

if exist "%SCRIPT_DIR%imperium_website\.git" set "REPO_DIR=%SCRIPT_DIR%imperium_website"
if exist "%SCRIPT_DIR%.git" set "REPO_DIR=%SCRIPT_DIR%"
if not defined REPO_DIR goto :ERR_REPO_NOT_FOUND

cd /d "%REPO_DIR%"
if errorlevel 1 goto :ERR_REPO_ENTER

powershell -NoProfile -Command "if (-not ((Get-Content 'index.html' -Raw) -match '(?i)<title>[^<]*Imperium')) { exit 1 }"
if errorlevel 1 goto :ERR_WRONG_SITE
call :LOG Safety check passed: "Imperium" confirmed in index.html title.

where git >nul 2>nul
if errorlevel 1 goto :ERR_GIT_MISSING

where ssh >nul 2>nul
if errorlevel 1 goto :ERR_SSH_MISSING

if not exist "%SSH_KEY%" goto :ERR_KEY_MISSING

call :LOG Repo:   %REPO_DIR%
call :LOG Remote: %REMOTE%/%BRANCH%
call :LOG VPS:    %VPS_USER%@%VPS_HOST%:%VPS_APP_DIR%
echo.
>> "%LOG_FILE%" echo.
call :LOG Staging changes...

git add -A
if errorlevel 1 goto :ERR_STAGE

echo Preserving live VPS data files during staging...
>> "%LOG_FILE%" echo Preserving live VPS data files during staging...
for %%F in (
  "server\data\users.json"
  "server\data\questions.json"
  "server\data\analytics_logs.json"
  "server\data\login_history.json"
  "server\data\sessions.json"
  "server\data\deploy_status.json"
) do if exist "%%~F" git add -f "%%~F" 2>nul

git diff --cached --quiet
set "DIFF_EXIT=%ERRORLEVEL%"
if "%DIFF_EXIT%"=="2" goto :ERR_STAGE
if defined IMPERIUM_DEPLOY_DRY_RUN (
  call :LOG Dry run enabled. Skipping commit, git push, and VPS update.
  goto :SUCCESS_DRY_RUN
)
if "%DIFF_EXIT%"=="1" goto :DO_COMMIT

call :LOG No changes to commit.
goto :AFTER_COMMIT

:DO_COMMIT
for /f "delims=" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%I"
set "COMMIT_MSG=Auto deploy %STAMP%"
call :LOG Creating commit: %COMMIT_MSG%
git commit -m "%COMMIT_MSG%"
if errorlevel 1 goto :ERR_COMMIT

:AFTER_COMMIT
echo.
>> "%LOG_FILE%" echo.
call :LOG Pushing to GitHub without force...
git push "%REMOTE%" "%BRANCH%"
if errorlevel 1 goto :ERR_PUSH

echo.
>> "%LOG_FILE%" echo.
call :LOG Running VPS update...
call :LOG This may take 1-3 minutes if dependencies changed.
set "REMOTE_CMD=cd %VPS_APP_DIR% && chmod +x update-vps.sh && APP_DIR=%VPS_APP_DIR% BRANCH=%BRANCH% REMOTE=%REMOTE% PM2_APP=%PM2_APP% ./update-vps.sh --restart"
ssh -i "%SSH_KEY%" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "%VPS_USER%@%VPS_HOST%" "%REMOTE_CMD%"
if errorlevel 1 goto :ERR_VPS

:SUCCESS
call :LOG VPS update completed successfully.
echo.
echo [DEPLOY SUCCESS]
echo Log saved to: %LOG_FILE%
goto :END

:SUCCESS_DRY_RUN
call :LOG Dry run completed successfully.
echo.
echo [DRY RUN SUCCESS]
echo Log saved to: %LOG_FILE%
goto :END

:ERR_REPO_NOT_FOUND
call :FAIL ERROR: Could not find git repo.
call :FAIL Put this file either inside imperium_website or in its parent folder.
goto :END

:ERR_REPO_ENTER
call :FAIL ERROR: Could not enter repo folder: %REPO_DIR%
goto :END

:ERR_WRONG_SITE
call :FAIL ERROR: Wrong website detected, aborting!
call :FAIL index.html does not contain "Imperium" in its title tag.
goto :END

:ERR_GIT_MISSING
call :FAIL ERROR: Git is not installed or not in PATH.
goto :END

:ERR_SSH_MISSING
call :FAIL ERROR: OpenSSH ssh was not found in PATH.
goto :END

:ERR_KEY_MISSING
call :FAIL ERROR: SSH key not found: %SSH_KEY%
goto :END

:ERR_STAGE
call :FAIL ERROR: Failed while staging changes.
goto :END

:ERR_COMMIT
call :FAIL ERROR: Commit failed.
goto :END

:ERR_PUSH
call :FAIL ERROR: Git push failed. Remote divergence must be resolved manually. No force push is used.
goto :END

:ERR_VPS
call :FAIL ERROR: VPS update failed. Check the SSH output above.
goto :END

:LOG
echo %*
>> "%LOG_FILE%" echo %*
exit /b 0

:FAIL
echo %*
>> "%LOG_FILE%" echo %*
set "EXITCODE=1"
exit /b 0

:END
echo.
echo =====================================================
echo  Closing automatically in 5 seconds...
echo =====================================================
timeout /t 5 /nobreak >nul
exit /b %EXITCODE%
