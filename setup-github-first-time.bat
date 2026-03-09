@echo off
setlocal

set GITHUB_USER=Raidism

REM Run this once to connect this folder to GitHub.
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or not in PATH.
  pause
  exit /b 1
)

if exist .git (
  echo This folder is already a git repository.
  echo Use deploy-to-github.bat for normal pushes.
  pause
  exit /b 0
)

set /p repo_name=Enter your GitHub repository name (example: imperium-mun-website): 
if "%repo_name%"=="" (
  echo Repository name is required.
  pause
  exit /b 1
)

set repo_url=https://github.com/%GITHUB_USER%/%repo_name%.git

set /p branch_name=Enter branch name to use [main]: 
if "%branch_name%"=="" set branch_name=main

git init
if errorlevel 1 goto :fail

git checkout -b %branch_name%
if errorlevel 1 goto :fail

git add .
git commit -m "Initial commit"

git remote add origin %repo_url%
if errorlevel 1 goto :fail

git push -u origin %branch_name%
if errorlevel 1 goto :fail

echo.
echo GitHub setup complete.
echo Remote: %repo_url%
echo Branch: %branch_name%
pause
exit /b 0

:fail
echo.
echo Setup failed. Check the error above.
pause
exit /b 1
