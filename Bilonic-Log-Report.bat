@echo off
rem -------------------------------------------------------------
rem  Bionic Log Analyzer & Reporter – batch launcher
rem -------------------------------------------------------------

setlocal EnableDelayedExpansion

rem ---- Determine default log root
if exist "%~dp0sample log" (
    set "LOGROOT=%~dp0sample log"
) else (
    set "LOGROOT=%USERPROFILE%\.lmstudio\apps\bionic\server-logs"
)

echo.
echo Checking directory: %LOGROOT%
echo.

rem ---- List available folders / ask for one, or press ENTER to scan everything
echo Available log directories:
for /d %%D in ("%LOGROOT%\*") do echo   %%~nxD

echo.
echo If you want to use a custom path, enter it now (or press Enter to process all from above):
set /p "CUSTOM_PATH=Custom directory (optional): "

if "!CUSTOM_PATH!"=="" (
    set "TARGET_DIR=%LOGROOT%"
) else (
    set "TARGET_DIR=!CUSTOM_PATH!"
)

rem ---- Sanity check
if not exist "%TARGET_DIR%" (
    echo.
    echo ERROR: Folder '%TARGET_DIR%' does not exist.
    exit /b 1
)

echo.
echo Processing logs in: %TARGET_DIR%
echo.

rem ---- Launch the PowerShell script (passing the target directory)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0GenerateReport.ps1" -LogRoot "%TARGET_DIR%" -OutputDir "%~dp0generated"

pause