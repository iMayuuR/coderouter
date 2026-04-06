@echo off
REM ============================================================
REM  Claude Code Launcher (CMD Wrapper)
REM  Delegates to run-claude.ps1 for robust background process tracking
REM ============================================================

powershell.exe -ExecutionPolicy Bypass -File "%~dp0run-claude.ps1" %*
