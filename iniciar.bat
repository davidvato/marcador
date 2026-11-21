@echo off
title Marcador Live Studio - OBS
cd /d "%~dp0"
echo ========================================================
echo  Iniciando Servidor del Marcador Deportivo...
echo ========================================================
if not exist node_modules (
  echo [Info] Instalando dependencias necesarias (npm install)...
  call npm.cmd install
)
echo  Panel de Control: http://localhost:3000/admin
echo  Overlay para OBS: http://localhost:3000/overlay
echo ========================================================
node server.js
pause
