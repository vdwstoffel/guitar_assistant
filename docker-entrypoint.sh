#!/bin/sh
set -e

# Generate Prisma client for this platform
npx prisma generate

# Push database schema (creates tables if they don't exist)
npx prisma db push --skip-generate

# Start the application
exec npm run dev
