@echo off
setlocal

echo ==============================================
echo   GENERADOR DE IMAGEN DOCKER (ABOGADOS LEGAL)
echo ==============================================
echo.

cd ..

echo 1. Construyendo imagen para arquitectura Linux (AMD64)...
echo    Esto puede tardar unos minutos (Compilando React + TypeScript)...
docker build --platform linux/amd64 -t abogados-legal:latest .

if %errorlevel% neq 0 (
    echo [ERROR] Fallo la construccion de la imagen.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Guardando imagen en archivo 'abogados_image.tar'...
docker save -o abogados_image.tar abogados-legal:latest

if %errorlevel% neq 0 (
    echo [ERROR] Fallo al guardar el archivo .tar.
    pause
    exit /b %errorlevel%
)

echo.
echo ==============================================
echo   PROCESO COMPLETADO EXITOSAMENTE
echo ==============================================
echo.
echo Archivos generados en la carpeta raiz del proyecto:
echo  - abogados_image.tar  (Imagen Docker)
echo.
pause
