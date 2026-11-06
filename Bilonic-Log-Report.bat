@echo off
rem -------------------------------------------------------------
rem  Bionic Log Analyzer & Reporter – batch launcher
rem -------------------------------------------------------------

setlocal EnableDelayedExpansion

echo.
echo ============================================================
echo    Bionic Log Analyzer & Performance Reporter
echo ============================================================
echo.

rem ---- Determine default log root
echo Detecting LM Studio logs directory...
if exist "%~dp0sample log" (
    set "LOGROOT=%~dp0sample log"
    echo Using sample logs from: %LOGROOT%
) else (
    set "LOGROOT=%USERPROFILE%\.lmstudio\apps\bionic\server-logs"
    echo Using LM Studio logs from: %LOGROOT%
)

echo.
echo Available log directories:
for /d %%D in ("%LOGROOT%\*") do echo   %%~nxD

echo.
echo If you want to use a custom path, enter it now (or press Enter to process all):
set /p "CUSTOM_PATH=Custom directory (optional): "

if "!CUSTOM_PATH!"=="" (
    set "TARGET_DIR=%LOGROOT%"
    echo.
    echo Processing ALL log directories from: %TARGET_DIR%
) else (
    set "TARGET_DIR=!CUSTOM_PATH!"
    echo.
    echo Processing custom directory: %TARGET_DIR%
)

rem ---- Sanity check
if not exist "%TARGET_DIR%" (
    echo.
    echo ERROR: Folder '%TARGET_DIR%' does not exist.
    echo Please verify the path and try again.
    pause
    exit /b 1
)

echo.
echo Starting analysis...
echo.

rem ---- Launch the PowerShell script (passing the target directory)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0GenerateReport.ps1" -LogRoot "%TARGET_DIR%" -OutputDir "%~dp0generated"

echo.
echo Analysis complete! 
echo HTML report(s) generated in: %~dp0generated
echo.

pause