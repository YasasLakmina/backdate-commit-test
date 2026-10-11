@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo   Resetting PostgreSQL "postgres" Password
echo ===================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset_postgres.ps1"
