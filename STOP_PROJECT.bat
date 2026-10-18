@echo off
rem ===========================================================================
rem  Tea Export Decision Support: double-click to STOP the running project.
rem  Stops only this project's services (ports 8001, 4000, 5174).
rem ===========================================================================
title Stop Tea Export Decision Support
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_project.ps1" stop
echo.
pause
