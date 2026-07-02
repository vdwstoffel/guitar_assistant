#!/bin/sh
set -e

# Generate Prisma client for this platform
npx prisma generate

# Push database schema (creates tables if they don't exist)
npx prisma db push --skip-generate

# Build the application (incremental — fast when nothing changed)
npm run build

# Start the application in production mode
exec npm start
