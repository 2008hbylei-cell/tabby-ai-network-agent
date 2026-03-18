@echo off
color 0b
title AI Network Agent Installer

echo ==========================================
echo        AI Network Agent (Tabby Plugin) 
echo             Local Installer
echo ==========================================
echo.

set "TARGET_DIR=%APPDATA%\tabby\plugins\node_modules\tabby-ai-network-agent"

echo [*] Preparing Tabby plugins directory...
if not exist "%APPDATA%\tabby\plugins\node_modules" (
    mkdir "%APPDATA%\tabby\plugins\node_modules"
)
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

echo [*] Deploying plugin files...
copy /Y "package.json" "%TARGET_DIR%\package.json" >nul
if exist "%TARGET_DIR%\dist" rmdir /s /q "%TARGET_DIR%\dist"
mkdir "%TARGET_DIR%\dist"
copy /Y "dist\*.*" "%TARGET_DIR%\dist\" >nul

echo.
echo ==========================================
echo       Installation Successful!
echo ==========================================
echo.
echo Next Steps:
echo 1. Please close Tabby terminal if it is currently running.
echo 2. Open Tabby again.
echo 3. Go to Settings (gear icon) -^> Plugins, you should see "AI Network Agent".
echo.
pause
