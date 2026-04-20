@echo off
setlocal
cd /d "%~dp0.."
set DOCKER_USER=cfanton
set IMAGE_NAME=abogados-legal
set TAG=latest

echo [STITCH-DEPLOY] Iniciando construccion de imagen AMD64...
docker build --platform linux/amd64 -t %DOCKER_USER%/%IMAGE_NAME%:%TAG% .

if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    exit /b %errorlevel%
)

echo [STITCH-DEPLOY] Subiendo imagen a Docker Hub...
docker push %DOCKER_USER%/%IMAGE_NAME%:%TAG%

if %errorlevel% neq 0 (
    echo [ERROR] Push failed.
    exit /b %errorlevel%
)

echo [SUCCESS] Despliegue completado. Avisando a Coolify.
