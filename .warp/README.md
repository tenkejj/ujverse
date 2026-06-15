# .warp/

Warp configuration shipped with the repo. Commit-friendly, no secrets.

## Workflows (`.warp/workflows/*.yaml`)

Każdy `.yaml` to jedna komenda którą Warp pokaże w palecie
(`Ctrl+Shift+R` → "Workflows", lub `#` w prompcie).

Po pierwszym otwarciu projektu Warp automatycznie podchwyci pliki z
`.warp/workflows/` — nic nie trzeba importować.

Co jest w środku:

| Workflow | Co robi |
| --- | --- |
| `dev-stack` | `npx vercel dev` — Vite + API razem (UŻYWAJ TEGO do testów `/api/*`) |
| `dev-frontend` | `npm run dev` — sam Vite, `/api/*` nie działa |
| `build-check` | `npm run lint && npm run build` przed deployem |
| `deploy-prod` | `npm run deploy:prod` (prebuilt artifact, patrz `deploy.ps1`) |
| `vercel-pull-env` | `npx vercel pull --environment=production` |
| `vercel-logs` | `npx vercel logs --follow <url>` |
| `search-resync` | resync Meilisearch z Supabase |
| `chat-prewarm` | ręczne prewarm KV cache czatu |
| `debug-scraper` | test parserów komunikatów bez zapisu do DB |
| `supabase-start` | lokalny stack Supabase w Dockerze |
| `supabase-db-push` | push migracji na zlinkowany remote |
| `supabase-migration-new` | nowa pusta migracja w `supabase/migrations/` |
| `test-cron-endpoint` | curl z `Authorization: Bearer $env:CRON_SECRET` |
| `diag-health` | smoke test `/api/diag/health` |

## Launch Configuration (`.warp/launch_configurations/ujverse-dev.yaml`)

Warp **nie czyta launch configs z folderu projektu** — trzeba je trzymać
globalnie. Skopiuj jednorazowo:

```powershell
Copy-Item .warp\launch_configurations\ujverse-dev.yaml `
  "$env:APPDATA\warp\Warp\data\launch_configurations\ujverse-dev.yaml"
```

(Jeśli folder docelowy nie istnieje, `New-Item -ItemType Directory` najpierw.)

Potem `Ctrl+Shift+L` → "UJverse Dev" otworzy 3 zakładki:
1. `vercel dev` (api+web)
2. `supabase status`
3. scratch shell (np. do Bruno CLI, git, tsx scripts)

## Pierwsze uruchomienie

```powershell
winget install Warp.Warp
# w Warpie: File → Open Folder → c:\Users\frani\ujverse
# workflows załadują się same z .warp/workflows
```

Jednorazowy setup CRON_SECRET dla `test-cron-endpoint` (sesja PowerShella):

```powershell
$env:CRON_SECRET = "<wartość z Vercel env>"
```

Żeby było stałe — wrzuć do `$PROFILE` (`notepad $PROFILE`), ale wtedy
masz sekret w pliku — lepiej trzymać w session managerze.
