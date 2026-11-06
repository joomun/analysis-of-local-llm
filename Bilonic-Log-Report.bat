@echo off
rem -------------------------------------------------------------
rem  Bionic Log Analyzer & Reporter – batch launcher
rem -------------------------------------------------------------

setlocal EnableDelayedExpansion

rem ---- where the logs live (change if your installation is elsewhere)
:: Determine default log root
if exist "%~dp0sample log" ( set "LOGROOT=%~dp0sample log" ) else ( set "LOGROOT=%USERPROFILE%\.lmstudio\apps\bionic\server-logs" )

rem ---- list available folders / ask for one, or press ENTER to scan everything
echo.
echo Available log directories:
for /d %%D in ("%LOGROOT%\*") do echo   %%~nxD

set /p "SELECTED_DATE=Choose a folder (or press ENTER to process all): "

if "!SELECTED_DATE!"=="" (
    set "TARGET_DIR=%LOGROOT%"
) else (
    set "TARGET_DIR=%LOGROOT%\!SELECTED_DATE!"
)

rem ---- sanity check
if not exist "%TARGET_DIR%" (
    echo.
    echo ERROR: Folder '%TARGET_DIR%' does not exist.
    exit /b 1
)

rem ---- launch the PowerShell script (passing the target directory)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0GenerateReport.ps1" -LogRoot "%TARGET_DIR%" -OutputDir "%~dp0generated"

pause