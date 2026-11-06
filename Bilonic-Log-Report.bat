@echo off
rem -------------------------------------------------------------
rem  Bionic Log Analyzer & Reporter – batch launcher
rem -------------------------------------------------------------

echo.
echo ============================================================
echo    Bionic Log Analyzer & Reporter
echo ============================================================
echo.

rem ---- Set the log root directory 
set "LOGROOT=%USERPROFILE%\.lmstudio\apps\bionic\server-logs"

echo Checking for LM Studio logs at: %LOGROOT%
if not exist "%LOGROOT%" (
    echo.
    echo WARNING: Log directory not found!
    echo Creating sample log directory instead...
    set "LOGROOT=%~dp0sample log"
    if not exist "%LOGROOT%" (
        echo ERROR: Neither LM Studio logs nor sample logs directory found.
        echo Please ensure your LM Studio installation is properly set up.
        pause
        exit /b 1
    )
)

echo.
echo Available log directories:
dir /ad "%LOGROOT%" 2>nul | findstr /R "^[0-9]" || echo   (no subdirectories found)
echo.

set /p "SELECTED_DATE=Choose a folder (or press ENTER to process all): "

if "%SELECTED_DATE%"=="" (
    set "TARGET_DIR=%LOGROOT%"
    echo Processing ALL logs from: %TARGET_DIR%
) else (
    set "TARGET_DIR=%LOGROOT%\%SELECTED_DATE%"
    echo Processing selected log directory: %TARGET_DIR%
)

rem ---- Sanity check
if not exist "%TARGET_DIR%" (
    echo.
    echo ERROR: Folder '%TARGET_DIR%' does not exist.
    pause
    exit /b 1
)

echo.
echo Starting analysis of logs in: %TARGET_DIR%
echo.

rem ---- Launch the PowerShell script (passing the target directory)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0GenerateReport.ps1" -LogRoot "%TARGET_DIR%" -OutputDir "%~dp0generated"

echo.
echo Analysis complete! 
echo HTML reports generated in: %~dp0generated
echo.

pause