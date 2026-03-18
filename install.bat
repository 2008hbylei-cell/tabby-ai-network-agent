@echo off
chcp 65001 >nul
color 0b
title AI 网络助手 一键部署程序

echo ==========================================
echo        AI 网络助手 (Tabby 插件) 
echo             一键本地安装
echo ==========================================
echo.

set "TARGET_DIR=%APPDATA%\tabby\plugins\node_modules\tabby-ai-network-agent"

echo [*] 正在准备插件目录...
if not exist "%APPDATA%\tabby\plugins\node_modules" (
    mkdir "%APPDATA%\tabby\plugins\node_modules"
)
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

echo [*] 正在部署核心组件...
copy /Y "package.json" "%TARGET_DIR%\package.json" >nul
if exist "%TARGET_DIR%\dist" rmdir /s /q "%TARGET_DIR%\dist"
mkdir "%TARGET_DIR%\dist"
copy /Y "dist\*.*" "%TARGET_DIR%\dist\" >nul

echo.
echo ==========================================
echo             恭喜，部署成功！
echo ==========================================
echo.
echo 下一步：
echo 1. 请手动关闭正在运行的 Tabby 终端程序
echo 2. 重新打开 Tabby
echo 3. 点击右上角设置小齿轮 -^> 插件 (Plugins)，您将看到 "AI网络代理"
echo.
pause
