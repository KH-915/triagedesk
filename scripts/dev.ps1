<#
  TriageDesk — one-command local dev (Windows PowerShell 5.1+).

  First run: creates .env, starts Postgres (Docker), installs Node + Python deps,
  applies migrations, seeds demo users and trains the ML model.
  Later runs: skips whatever is already set up and just starts everything.

  Usage (from anywhere):
    powershell -ExecutionPolicy Bypass -File scripts\dev.ps1           # setup if needed, then run
    powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 -Setup    # force all setup steps
    powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 -NoRun    # setup only

  Ctrl+C stops the ML service, API and web app. Postgres keeps running
  (stop it with: docker compose -f infra/docker-compose.yml stop db).
#>
param(
  [switch]$Setup,
  [switch]$NoRun
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$MlDir = Join-Path $Root 'services\ml-api'
$VenvPython = Join-Path $MlDir '.venv\Scripts\python.exe'
$Compose = Join-Path $Root 'infra\docker-compose.yml'
Set-Location $Root

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Skip($msg) { Write-Host "    $msg (already done)" -ForegroundColor DarkGray }

# Runs a native command and stops the script if it fails.
function Invoke-Checked {
  param([string]$Exe, [string[]]$Arguments)
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "'$Exe $($Arguments -join ' ')' failed with exit code $LASTEXITCODE" }
}

# Returns $true if a native command exits 0. Its output is discarded inside cmd.exe, because
# PowerShell 5.1 turns redirected stderr into a terminating error under 'Stop'.
function Test-Native([string]$CommandLine) {
  & cmd.exe /d /c "$CommandLine >nul 2>&1"
  return $LASTEXITCODE -eq 0
}

function Require($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd not found. $hint" }
}

Require 'node'   'Install Node 20.6+.'
Require 'npm'    'Install Node 20.6+.'
Require 'docker' 'Install Docker Desktop (used for Postgres).'

# ── 1. .env ──────────────────────────────────────────────────
if (-not (Test-Path '.env')) {
  Step 'Creating .env from .env.example with a random JWT_SECRET'
  $bytes = New-Object byte[] 64
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  $content = (Get-Content '.env.example') -replace '^JWT_SECRET=.*', "JWT_SECRET=$secret"
  [System.IO.File]::WriteAllLines((Join-Path $Root '.env'), $content)  # UTF-8 without BOM
} else { Skip '.env exists' }

# ── 2. Postgres ──────────────────────────────────────────────
# `docker info` fails when the engine isn't running (Docker Desktop closed). Start it
# and wait, rather than letting `docker compose` fail with a pipe error.
if (-not (Test-Native 'docker info')) {
  $dockerBin = Split-Path (Get-Command docker).Source
  $desktop = @(
    (Join-Path $dockerBin '..\..\Docker Desktop.exe'),               # per-user install
    (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe')  # machine-wide install
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $desktop) { throw 'The Docker engine is not running. Start Docker Desktop and re-run this script.' }

  Step 'Starting Docker Desktop (this can take a minute)'
  Start-Process $desktop
  $up = $false
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Native 'docker info') { $up = $true; break }
  }
  if (-not $up) { throw 'Docker Desktop did not start within 4 minutes. Check its window for errors, then re-run.' }
}

Step 'Starting Postgres (docker compose)'
Invoke-Checked 'docker' @('compose', '-f', $Compose, 'up', '-d', 'db')
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  if (Test-Native "docker compose -f `"$Compose`" exec -T db pg_isready -U triagedesk") { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'Postgres did not become ready within 30s.' }

# ── 3. Node deps + database ──────────────────────────────────
if ($Setup -or -not (Test-Path 'node_modules')) {
  Step 'Installing Node dependencies'
  Invoke-Checked 'npm' @('install')
} else { Skip 'node_modules exists' }

if (-not (Test-Path 'node_modules\.prisma\client')) {
  Step 'Generating Prisma client'
  Invoke-Checked 'npm' @('run', 'db:generate')
}

# Migrations and seed are cheap and idempotent, so always run them: this picks up new
# migrations and keeps the demo agent an AGENT even if the account was registered by hand.
Step 'Applying database migrations'
Invoke-Checked 'npm' @('run', 'db:migrate:deploy')

Step 'Seeding demo users (idempotent)'
Invoke-Checked 'npm' @('--workspace=services/api', 'run', 'seed')

# ── 4. ML service ────────────────────────────────────────────
if ($Setup -or -not (Test-Path $VenvPython)) {
  Step 'Creating Python venv and installing ML deps'
  if (Get-Command 'py' -ErrorAction SilentlyContinue) {
    Invoke-Checked 'py' @('-3.12', '-m', 'venv', (Join-Path $MlDir '.venv'))
  } else {
    Require 'python' 'Install Python 3.12.'
    Invoke-Checked 'python' @('-m', 'venv', (Join-Path $MlDir '.venv'))
  }
  Invoke-Checked $VenvPython @('-m', 'pip', 'install', '--upgrade', 'pip')
  Invoke-Checked $VenvPython @('-m', 'pip', 'install', '-r', (Join-Path $MlDir 'requirements.txt'))
} else { Skip 'Python venv exists' }

if ($Setup -or -not (Test-Path (Join-Path $MlDir 'models\model.pkl'))) {
  Step 'Generating data and training the model'
  Push-Location $MlDir
  try {
    Invoke-Checked $VenvPython @('training/generate_data.py')
    Invoke-Checked $VenvPython @('training/train.py')
  } finally { Pop-Location }
} else { Skip 'models/model.pkl exists' }

if ($NoRun) { Step 'Setup complete.'; exit 0 }

# ── 5. Run ───────────────────────────────────────────────────
Step 'Starting ML service (:8000), API (:4000) and web (:5173) — Ctrl+C to stop'
$env:MODEL_VERSION = 'v1.0.0'
$procs = @(
  Start-Process -FilePath $VenvPython -ArgumentList '-m uvicorn app.main:app --port 8000' `
    -WorkingDirectory $MlDir -NoNewWindow -PassThru
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run dev:api' -WorkingDirectory $Root -NoNewWindow -PassThru
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run dev:web' -WorkingDirectory $Root -NoNewWindow -PassThru
)

try {
  Write-Host ''
  Write-Host '  Web:   http://localhost:5173' -ForegroundColor Green
  Write-Host '  API:   http://localhost:4000' -ForegroundColor Green
  Write-Host '  ML:    http://localhost:8000' -ForegroundColor Green
  Write-Host '  Login: agent@triagedesk.dev / agent-password' -ForegroundColor Green
  Write-Host ''
  # Exit when any service dies, so a crash isn't hidden behind the others' output.
  while (-not ($procs | Where-Object { $_.HasExited })) { Start-Sleep -Milliseconds 500 }
  Write-Host 'A service exited; shutting down the rest.' -ForegroundColor Yellow
} finally {
  foreach ($p in $procs) {
    if (-not $p.HasExited) { & taskkill /T /F /PID $p.Id *> $null }  # /T kills npm's child node processes
  }
}
