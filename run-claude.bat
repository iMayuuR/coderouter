@echo off
REM ============================================================
REM  Claude Code Launcher (CMD)
REM  Reads config from .env file in the same directory
REM ============================================================

REM Load .env file
for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
    set "line=%%A"
    if not "!line:~0,1!"=="#" (
        set "%%A=%%B"
    )
)

REM Enable delayed expansion for variable parsing
setlocal enabledelayedexpansion

REM Re-load .env with delayed expansion enabled
for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
    set "line=%%A"
    if not "%%A"=="" if not "!line:~0,1!"=="#" (
        set "%%A=%%B"
    )
)

REM Configure OpenRouter
set ANTHROPIC_BASE_URL=https://openrouter.ai/api
set ANTHROPIC_AUTH_TOKEN=%OPENROUTER_API_KEY%
set ANTHROPIC_API_KEY=
set ANTHROPIC_DEFAULT_OPUS_MODEL=%CLAUDE_MODEL%
set ANTHROPIC_DEFAULT_SONNET_MODEL=%CLAUDE_MODEL%
set ANTHROPIC_DEFAULT_HAIKU_MODEL=%CLAUDE_MODEL%
set CLAUDE_CODE_SUBAGENT_MODEL=%CLAUDE_MODEL%

echo.
echo  Claude Code + OpenRouter
echo  Model: %CLAUDE_MODEL%
echo  ========================
echo.

REM Launch Claude Code
npx claude %*
