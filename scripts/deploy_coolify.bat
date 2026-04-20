@echo off
setlocal

:: Asegurar que estamos en la raiz del proyecto
cd /d "%~dp0.."

:: --- CONFIGURACION ---
set DOCKER_USER=cfanton
set IMAGE_NAME=abogados-legal
set TAG=latest
:: ---------------------

color 1F
cls
echo.
echo ==============================================================================
echo.
echo      DEPLOYING ABOGADOS LEGAL TO DOCKER HUB (AMD64)
echo.
echo ==============================================================================
echo.

echo 🔢 Bumping version...
for /f "tokens=*" %%i in ('node "%~dp0bump-version.js"') do set NEW_VERSION=%%i
if "%NEW_VERSION%"=="" (
    echo [WARN] No se pudo bumpar version, continuando...
) else (
    echo    Version actualizada a v%NEW_VERSION%
)
echo.

echo 🐳 Logging into Docker Hub...
docker login

echo.
echo 🏗️  Building Production Image (Frontend + Backend TS)...
docker build --platform linux/amd64 -t %DOCKER_USER%/%IMAGE_NAME%:%TAG% .

if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b %errorlevel%
)

echo.
echo ⬆️  Pushing Image to Docker Hub...
docker push %DOCKER_USER%/%IMAGE_NAME%:%TAG%

if %errorlevel% neq 0 (
    echo [ERROR] Push failed.
    pause
    exit /b %errorlevel%
)

echo.
echo ======================================================
echo  ✅ DEPLOY COMPLETED TO DOCKER HUB
echo ======================================================
echo.
echo  Proximos pasos en Coolify:
echo   1. Imagen: %DOCKER_USER%/%IMAGE_NAME%:%TAG%
echo   2. Configurar Service Type como 'Base de Datos o Docker Compose'
echo   3. Pegar contenido de: docker-compose.coolify.yml
echo.
pause
