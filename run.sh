#!/usr/bin/env bash
set -e

# Run PMS locally on macOS/Linux.
# First-time setup only (run once, or after pulling schema changes):
#   1. npx prisma dev -d          (starts a local Postgres, prints DATABASE_URL)
#   2. Put DATABASE_URL/DIRECT_URL/NEXTAUTH_URL/NEXTAUTH_SECRET into .env (see README.md)
#   3. npx prisma db push         (applies the schema to that database)
#   4. npx prisma db seed         (creates the admin user)
# This script just installs deps if needed, regenerates the Prisma client,
# and starts the dev server.

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
  echo "[ERROR] .env not found. Copy the variables listed in README.md (Environment variables)"
  echo "        into a .env file in this folder before running this script."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[1/3] Installing dependencies..."
  npm install
else
  echo "[1/3] Dependencies already installed, skipping npm install."
fi

echo "[2/3] Generating Prisma client..."
npx prisma generate

echo "[3/3] Starting dev server at http://localhost:3000 ..."
npm run dev
