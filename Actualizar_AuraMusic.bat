@echo off
chcp 65001 >nul
title AuraMusic - Actualizador Automático de GitHub
color 0B

echo ================================================================
echo           AuraMusic - Actualizador Automático desde GitHub
echo ================================================================
echo.
echo [1/3] Comprobando conexión con GitHub...
echo Repositorio: https://github.com/enam49378-debug/auraMusic
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

where git >nul 2>nul
if %errorlevel% equ 0 (
    if exist ".git" (
        echo [2/3] Sincronizando repositorio Git con la rama main...
        git fetch origin main
        git reset --hard origin/main
        if %errorlevel% equ 0 (
            goto SUCCESS
        )
    )
)

echo [2/3] Descargando el último paquete oficial de GitHub (main.zip)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'Stop'; " ^
    "$zip = Join-Path $env:TEMP 'auramusic_update.zip'; " ^
    "$dest = Join-Path $env:TEMP 'auramusic_extracted'; " ^
    "Write-Host 'Descargando desde GitHub...'; " ^
    "Invoke-WebRequest -Uri 'https://github.com/enam49378-debug/auraMusic/archive/refs/heads/main.zip' -OutFile $zip; " ^
    "Write-Host 'Extrayendo archivos...'; " ^
    "Expand-Archive -Path $zip -DestinationPath $dest -Force; " ^
    "Copy-Item -Path (Join-Path $dest 'auraMusic-main\*') -Destination '%SCRIPT_DIR%' -Recurse -Force; " ^
    "Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue; " ^
    "Remove-Item -Force $zip -ErrorAction SilentlyContinue; " ^
    "Write-Host 'Archivos actualizados correctamente.'"

if %errorlevel% neq 0 (
    echo.
    color 0C
    echo [ERROR] No se pudo descargar la actualización. Verifica tu conexión a Internet.
    pause
    exit /b 1
)

:SUCCESS
echo.
echo [3/3] ¡Actualización completada con éxito!
echo ================================================================
echo  ✨ AuraMusic ha sido actualizado con los últimos cambios de GitHub.
echo  🚀 No necesitas entrar a chrome://extensions.
echo  🎵 Si tienes YouTube Music abierto, pulsa F5 o recarga la página.
echo ================================================================
echo.
pause
