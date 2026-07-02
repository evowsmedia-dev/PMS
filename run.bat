@echo off
setlocal

REM Run PMS locally on Windows.
REM First-time setup only (run once, or after pulling schema changes):
REM   1. npx prisma dev -d          (starts a local Postgres, prints DATABASE_URL)
REM   2. Put DATABASE_URL/DIRECT_URL/NEXTAUTH_URL/NEXTAUTH_SECRET into .env (see README.md)
REM   3. npx prisma db push         (applies the schema to that database)
REM   4. npx prisma db seed         (creates the admin user)
REM This script just installs deps if needed, regenerates the Prisma client,
REM and starts the dev server.

cd /d "%~dp0"

if not exist ".env" (
  echo [ERROR] .env not found. Copy the variables listed in README.md ^(Environment variables^)
  echo         into a .env file in this folder before running this script.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] Installing dependencies...
  call npm install
  if errorlevel 1 goto :error
) else (
  echo [1/3] Dependencies already installed, skipping npm install.
)

echo [2/3] Generating Prisma client...
call npx prisma generate
if errorlevel 1 goto :error

echo [3/3] Starting dev server at http://localhost:3000 ...
call npm run dev
goto :eof

:error
echo.
echo [FAILED] Something went wrong. See the error above.
pause
exit /b 1
