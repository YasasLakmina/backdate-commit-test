@echo off
rem ===========================================================================
rem  Tea Export Decision Support (M1-lite + M3)
rem  Double-click this file to set up (first time) and start the project.
rem  Optional from a command prompt:  RUN_PROJECT.bat setup ^| start ^| test ^| retrain
rem ===========================================================================
title Tea Export Decision Support
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_project.ps1" %*
echo.
pause
