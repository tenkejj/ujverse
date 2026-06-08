<#
.SYNOPSIS
  Wywołuje endpoint serverless `api/scrape-uj-events` na produkcji.

.DESCRIPTION
  Ładuje `CRON_SECRET` z lokalnego `.env.production.local` (jeśli plik nie
  istnieje, automatycznie pobiera env z Vercela przez `vercel env pull`).
  Następnie uderza w endpoint i ładnie drukuje JSON.

  Endpoint upsertuje do `public.official_events` w Supabase i zwraca
  diagnostykę per-źródło.

.PARAMETER Detailed
  Dorzuca `?debug=1`, co rozszerza odpowiedź o 30 sample'owych tytułów / dat /
  obrazków — przydatne do podglądu "co dokładnie weszło do bazy".

.PARAMETER Url
  Override URL endpointu (domyślnie produkcyjny). Przydatne dla preview deploymentów.

.EXAMPLE
  ./scripts/scrape-uj-events.ps1

.EXAMPLE
  ./scripts/scrape-uj-events.ps1 -Detailed

.EXAMPLE
  ./scripts/scrape-uj-events.ps1 -Url 'https://ujverse-xyz.vercel.app/api/scrape-uj-events'
#>
[CmdletBinding()]
param(
  [switch]$Detailed,
  [string]$Url = 'https://ujverse.vercel.app/api/scrape-uj-events'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot '.env.production.local'

if (-not (Test-Path $envFile)) {
  Write-Host "Brak $envFile — pobieram env z Vercela..."
  Push-Location $repoRoot
  try {
    npx vercel env pull .env.production.local --environment=production --yes
  } finally {
    Pop-Location
  }
}

$secretLine = Select-String -Path $envFile -Pattern '^CRON_SECRET=' | Select-Object -First 1
if (-not $secretLine) {
  Write-Error "Nie znalazłem CRON_SECRET w $envFile. Sprawdź 'npx vercel env ls production'."
  exit 1
}
$secret = $secretLine.Line.Substring('CRON_SECRET='.Length).Trim('"')
if ([string]::IsNullOrEmpty($secret)) {
  Write-Error "CRON_SECRET pusty w $envFile."
  exit 1
}

$escapedSecret = [System.Uri]::EscapeDataString($secret)
$query = '?token=' + $escapedSecret
if ($Detailed) {
  $query = $query + '&debug=1'
}
$fullUrl = $Url + $query

$displayUrl = $fullUrl.Replace($escapedSecret, '***').Replace($secret, '***')
Write-Host ('-> ' + $displayUrl) -ForegroundColor DarkGray

$response = curl.exe -s $fullUrl
if ([string]::IsNullOrEmpty($response)) {
  Write-Error 'Brak odpowiedzi z endpointu.'
  exit 1
}

try {
  $json = $response | ConvertFrom-Json
  $json | ConvertTo-Json -Depth 6
} catch {
  Write-Host $response
}
