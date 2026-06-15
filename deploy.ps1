#!/usr/bin/env pwsh
# UJverse production deploy via Vercel prebuilt artifact.
#
# Why prebuilt instead of git auto-deploy: Vercel's remote auto-detect
# deterministically skips some api/*.ts files (historically api/scrape-wziks.ts,
# now api/scrape-faculty-announcements.ts — file passes nodenext TS check,
# esbuild bundles cleanly, no .gitignore/.vercelignore match), while the local
# `vercel build` detects and builds all api/*.ts lambdas correctly. The
# generated .vercel/output/config.json also produces correct routing that
# isolates /api/* from the SPA fallback. Shipping the prebuilt artifact bypasses
# the remote auto-detect glitch entirely.
#
# Prerequisites:
#   - npx vercel link (run once to link this checkout to tenkejjs-projects/ujverse)
#   - npx vercel pull --environment=production (refresh env + project settings)
#
# Usage: ./deploy.ps1     OR     npm run deploy:prod

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param([string]$Label, [scriptblock]$Action)
    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $Label (exit $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Invoke-Step "Building locally to .vercel/output (npx vercel build --prod)" {
    npx vercel build --prod
}

Invoke-Step "Deploying prebuilt artifact to production (npx vercel deploy --prebuilt --prod --force --yes)" {
    npx vercel deploy --prebuilt --prod --force --yes
}

Write-Host ""
Write-Host "==> Deploy succeeded. Check production at https://ujverse.vercel.app" -ForegroundColor Green
