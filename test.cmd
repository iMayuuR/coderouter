@echo off  
setlocal  
set MYVAR=123  
node -e "console.log(process.env.MYVAR)"  
