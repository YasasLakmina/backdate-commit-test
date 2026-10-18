# =============================================================================
#  Tea Export Decision Support (M1-lite + M3): Windows setup and launcher
#  Normally started by double-clicking RUN_PROJECT.bat.
#
#  Commands:  (none) = set up if needed, then start
#             setup  = install everything again
#             start  = start only
#             stop   = stop the running project (STOP_PROJECT.bat)
#             test   = run all tests
#             retrain = retrain the M1-lite model
#
#  Needs: Python 3.11+ and Node.js 22+. PostgreSQL is optional.
#  (Plain ASCII on purpose: Windows PowerShell 5.1 misreads other characters.)
# =============================================================================
param([string]$Command = 'all')

$ErrorActionPreference = 'Stop'
$Root         = $PSScriptRoot
$FrontendDir  = Join-Path $Root 'frontend'
$BackendDir   = Join-Path $Root 'backend'
$MlDir        = if (Test-Path (Join-Path $Root 'ml_service')) { Join-Path $Root 'ml_service' } elseif (Test-Path (Join-Path $Root 'mlservice')) { Join-Path $Root 'mlservice' } else { Join-Path $Root 'ml-service' }
$M1Dir        = Join-Path $Root 'ml_light_model'
$Venv         = Join-Path $Root '.venv'
$VenvPy       = Join-Path $Venv 'Scripts\python.exe'
$LogDir       = Join-Path $Root '.logs'
$ModelFile    = if (Test-Path (Join-Path $M1Dir 'models\m1lite_v0.2.0.pkl')) { Join-Path $M1Dir 'models\m1lite_v0.2.0.pkl' } else { Join-Path $M1Dir 'models\m1lite_v0.2.0.joblib' }
$SetupMark    = Join-Path $Root '.setup_done'
$NoDbMark     = Join-Path $Root '.no_database'
$PidFile      = Join-Path $LogDir 'running.pids'
$Ports        = @{ ml = 8001; api = 4000; web = 5174 }
$Url          = "http://localhost:$($Ports.web)"

function Step($m) { Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  [X]  $m" -ForegroundColor Red; exit 1 }

# Run a program and stop with a message if it fails.
function Run($exe, [string[]]$argList, $what) {
    & $exe @argList
    if ($LASTEXITCODE -ne 0) { Fail "$what failed (exit code $LASTEXITCODE)." }
}

# ---- prerequisites ----------------------------------------------------------
function Find-Python {
    $candidates = @(@('py', '-3'), @('python'), @('python3'))
    foreach ($c in $candidates) {
        $exe = $c[0]; $pre = @($c | Select-Object -Skip 1)
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
        try {
            $ok = & $exe @pre -c 'import sys; print(sys.version_info >= (3, 11))' 2>$null
            if ($ok -eq 'True') { $found = @($exe) + $pre; return ,$found }
        } catch { }
    }
    return $null
}

function Check-Prerequisites {
    Step 'Checking prerequisites'
    if (-not (Test-Path (Join-Path $M1Dir 'tea_m3'))) { Fail "Folder ml_light_model not found." }
    if (-not (Test-Path (Join-Path $MlDir 'app'))) { Fail "Folder ml_service not found." }
    if (-not (Test-Path (Join-Path $BackendDir 'src'))) { Fail "Folder backend not found." }
    if (-not (Test-Path (Join-Path $FrontendDir 'src'))) { Fail "Folder frontend not found." }
    $data = Join-Path $M1Dir 'data\raw\M1_combined_monthly_raw.csv'
    if (-not (Test-Path $data)) { Fail "Dataset not found: $data" }

    $script:SysPy = Find-Python
    if (-not $script:SysPy) { Fail 'Python 3.11 or newer is required. Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH").' }
    $pyArgs = @($script:SysPy | Select-Object -Skip 1)
    Ok ("Python: " + (& $script:SysPy[0] @pyArgs --version 2>&1))

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js 22 or newer is required. Install the LTS version from https://nodejs.org/' }
    $nodeMajor = [int]((& node --version) -replace '^v', '').Split('.')[0]
    if ($nodeMajor -lt 22) { Fail "Node.js 22+ is required (found $(& node --version))." }
    Ok ("Node.js: " + (& node --version) + ", npm " + (& npm.cmd --version))

    # Windows "Controlled folder access" can silently block writes (e.g. under Documents).
    $probe = Join-Path $BackendDir '.write_test'
    try { & node -e "require('fs').writeFileSync(process.argv[1], 'x')" $probe 2>$null } catch { }
    if (-not (Test-Path $probe)) {
        Fail ("Windows is blocking Node.js from writing in this folder (Controlled folder access). " +
              "Open Windows Security > Virus & threat protection > Ransomware protection > " +
              "Allow an app through Controlled folder access, add node.exe and python.exe, " +
              "or move the project outside Documents/Desktop.")
    }
    Remove-Item $probe -Force
}

function Test-VenvValid {
    if (-not (Test-Path $VenvPy)) { return $false }
    $cfgPath = Join-Path $Venv 'pyvenv.cfg'
    if (Test-Path $cfgPath) {
        $homeLine = Get-Content $cfgPath | Where-Object { $_ -match '^\s*home\s*=' } | Select-Object -First 1
        if ($homeLine) {
            $homeDir = ($homeLine -split '=', 2)[1].Trim()
            if (-not (Test-Path $homeDir)) {
                Warn "Virtual environment's base Python home does not exist ($homeDir)."
                return $false
            }
        }
    }
    try {
        $res = & $VenvPy -c "import sys; print('ok')" 2>$null
        if ($LASTEXITCODE -ne 0 -or $res -ne 'ok') { return $false }
    } catch {
        return $false
    }
    return $true
}

# ---- setup ------------------------------------------------------------------
function Setup-Python {
    Step 'Python environment'
    if (Test-Path $Venv) {
        if (-not (Test-VenvValid)) {
            Warn 'Existing .venv is broken or was copied from another computer. Rebuilding...'
            Remove-Item $Venv -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item $SetupMark -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not (Test-Path $VenvPy)) {
        $pyArgs = @($script:SysPy | Select-Object -Skip 1) + @('-m', 'venv', $Venv)
        Run $script:SysPy[0] $pyArgs 'Creating the Python environment'
        Ok 'Created virtual environment'
    } else { Ok 'Virtual environment exists and is valid' }
    Run $VenvPy @('-m', 'pip', 'install', '--upgrade', 'pip', '--quiet') 'Updating pip'
    Run $VenvPy @('-m', 'pip', 'install', '--quiet',
                  '-r', (Join-Path $M1Dir 'requirements.txt'),
                  '-r', (Join-Path $MlDir 'requirements.txt')) 'Installing Python packages'
    Ok 'Python packages installed (pandas, xgboost, shap, fastapi, ...)'
}

function Train-Model([switch]$Force) {
    Step 'M1-lite model'
    if ((Test-Path $ModelFile) -and -not $Force) { Ok 'Model already trained'; return }
    Remove-Item Env:M3_OUT_DIR -ErrorAction SilentlyContinue
    Push-Location $M1Dir
    try { Run $VenvPy @('scripts\train_m1lite.py') 'Model training' } finally { Pop-Location }
    if (-not (Test-Path $ModelFile)) { Fail "Training finished but $ModelFile was not created." }
    Ok 'Model trained'
}

function Setup-Node {
    Step 'Node.js packages'
    foreach ($app in $BackendDir, $FrontendDir) {
        Push-Location $app
        try {
            $needInstall = $false
            if (-not (Test-Path 'node_modules')) {
                $needInstall = $true
            } else {
                & npm.cmd ls --depth=0 2>$null | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    Warn "$app node_modules are incomplete or mismatched. Reinstalling..."
                    $needInstall = $true
                }
            }
            if ($needInstall) {
                if (Test-Path 'package-lock.json') {
                    Run 'npm.cmd' @('ci', '--no-audit', '--no-fund') "npm install ($app)"
                } else {
                    Run 'npm.cmd' @('install', '--no-audit', '--no-fund') "npm install ($app)"
                }
            }
            Ok "$app packages installed and verified"
        } finally { Pop-Location }
    }
}

function Setup-EnvFile {
    Step 'Backend configuration'
    $envFile = Join-Path $BackendDir '.env'
    if (Test-Path $envFile) { Ok 'backend\.env exists (left unchanged)' }
    else { Copy-Item (Join-Path $BackendDir '.env.example') $envFile; Ok 'Created backend\.env' }
}

function Try-InitDb($adminUrl) {
    Push-Location $BackendDir
    try {
        $env:ADMIN_DATABASE_URL = $adminUrl
        & node --env-file-if-exists=.env scripts/initDb.js
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
    finally { Remove-Item Env:ADMIN_DATABASE_URL -ErrorAction SilentlyContinue; Pop-Location }
}

function Setup-Database {
    Step 'PostgreSQL database'
    $admin = $env:ADMIN_DATABASE_URL
    if (-not $admin) { $admin = 'postgres://postgres:postgres@localhost:5432/postgres' }
    $ok = Try-InitDb $admin
    if (-not $ok) {
        Warn 'Could not set up the database with the default PostgreSQL password.'
        $pw = Read-Host '  Enter your PostgreSQL "postgres" password (or just press Enter to run without a database)'
        if ($pw) {
            $enc = [uri]::EscapeDataString($pw)
            $ok = Try-InitDb "postgres://postgres:$enc@localhost:5432/postgres"
        }
    }
    if ($ok) {
        Remove-Item $NoDbMark -ErrorAction SilentlyContinue
        Ok 'Database m3_xai ready'
    } else {
        New-Item $NoDbMark -ItemType File -Force | Out-Null
        Warn 'Running WITHOUT a database (no run log, rule reviews or study storage).'
        Warn 'Install PostgreSQL later and run "RUN_PROJECT.bat setup" to add it.'
    }
}

function Do-Setup {
    Check-Prerequisites
    Setup-Python
    Train-Model
    Setup-Node
    Setup-EnvFile
    Setup-Database
    Set-Content -Path $SetupMark -Value (Get-Date)
    Step 'Setup complete'
}

# ---- tests ------------------------------------------------------------------
function Do-Test {
    Check-Prerequisites
    if (-not (Test-Path $VenvPy)) { Fail 'Run setup first.' }
    if (Test-Path (Join-Path $M1Dir 'tests')) { Step 'Tests: M1-lite';            Push-Location $M1Dir; try { Run $VenvPy @('-m', 'pytest', '-q') 'M1-lite tests' } finally { Pop-Location } }
    if (Test-Path (Join-Path $MlDir 'tests')) { Step 'Tests: M3 ML service';      Push-Location $MlDir; try { Run $VenvPy @('-m', 'pytest', '-q') 'ML service tests' } finally { Pop-Location } }
    if (Test-Path (Join-Path $BackendDir 'tests')) { Step 'Tests: M3 Node.js backend'; Push-Location $BackendDir; try { Run 'npm.cmd' @('test', '--silent') 'Backend tests' } finally { Pop-Location } }
    Step 'Build check: React frontend'; Push-Location $FrontendDir; try { Run 'npm.cmd' @('run', 'build', '--silent') 'Frontend build' } finally { Pop-Location }
    Ok 'All checks passed'
}

# ---- start ------------------------------------------------------------------
$script:Procs = @()

function Get-PortOwner($port) {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" }
    return $null
}

# True only for this project's own service processes, so a reused process ID never
# leads to stopping an unrelated Python or Node program.
$ServicePattern = 'uvicorn.*app\.main:app|src[\\/]server\.js|vite[\\/]bin[\\/]vite\.js'
function Get-OurService([int]$id) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
    if ($p -and $p.CommandLine -and ($p.CommandLine -match $ServicePattern)) { return $p }
    return $null
}

function Free-Ports {
    # Services left over from an earlier run (e.g. the window was closed instead of pressing Enter).
    # Only process IDs this launcher recorded are stopped; other programs are never touched.
    if (Test-Path $PidFile) {
        foreach ($id in Get-Content $PidFile) {
            $old = Get-OurService $id
            if ($old) {
                Stop-Process -Id $old.ProcessId -Force -ErrorAction SilentlyContinue
                Warn "Stopped an earlier copy of the app (process $id)"
            }
        }
        Remove-Item $PidFile -Force
        Start-Sleep -Seconds 1
    }
    foreach ($port in $Ports.Values) {
        $p = Get-PortOwner $port
        if ($p) { Fail "Port $port is used by another program ($($p.Name), process $($p.ProcessId)). Close it and try again." }
    }
}

function Start-Service2($name, $exe, [string[]]$argList, $dir) {
    $out = Join-Path $LogDir "$name.log"
    $err = Join-Path $LogDir "$name.err.log"
    $p = Start-Process -FilePath $exe -ArgumentList $argList -WorkingDirectory $dir -WindowStyle Hidden `
                       -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    $script:Procs += $p
    Add-Content -Path $PidFile -Value $p.Id
    return $p
}

function Wait-Url($url, $name, $seconds) {
    for ($i = 0; $i -lt $seconds; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -lt 500) { Ok "$name is up"; return $true }
        } catch {
            if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -lt 500) { Ok "$name is up"; return $true }
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Stop-All {
    foreach ($p in $script:Procs) {
        if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    Ok 'All services stopped.'
}

function Do-Stop {
    Step 'Stopping Tea Export Decision Support'
    $stopped = 0
    # 1) Services recorded by this launcher.
    if (Test-Path $PidFile) {
        foreach ($id in Get-Content $PidFile) {
            $p = Get-OurService $id
            if ($p) {
                Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
                Ok "Stopped $($p.Name) (process $id)"; $stopped++
            }
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    # 2) Copies started another way (start-dev.ps1, terminals): only this project's own
    #    services on this project's ports are stopped; any other program is left alone.
    $patterns = @{ $Ports.ml = 'uvicorn.*app\.main:app'; $Ports.api = 'src[\\/]server\.js'; $Ports.web = 'vite' }
    foreach ($port in $Ports.Values) {
        $p = Get-PortOwner $port
        if (-not $p) { continue }
        if ($p.CommandLine -match $patterns[$port]) {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            Ok "Stopped $($p.Name) on port $port"; $stopped++
        } else {
            Warn "Port $port is used by another program ($($p.Name)); left running."
        }
    }
    Start-Sleep -Seconds 1
    $still = @($Ports.Values | Where-Object { Get-PortOwner $_ })
    if ($stopped -eq 0) { Ok 'The project was not running.' }
    elseif ($still.Count -eq 0) { Ok 'All project services are stopped.' }
    else { Warn "Something is still using port(s): $($still -join ', ')" }
}

function Do-Start {
    Check-Prerequisites
    if (-not ((Test-Path $VenvPy) -and (Test-Path $ModelFile) -and
              (Test-Path (Join-Path $BackendDir 'node_modules')) -and (Test-Path (Join-Path $FrontendDir 'node_modules')))) {
        Fail 'The project is not set up yet. Run "RUN_PROJECT.bat setup".'
    }
    New-Item $LogDir -ItemType Directory -Force | Out-Null
    Free-Ports
    Remove-Item Env:M3_OUT_DIR -ErrorAction SilentlyContinue
    if (Test-Path $NoDbMark) { $env:M3_DISABLE_DATABASE = 'true'; Warn 'Running without a database' }
    else { Remove-Item Env:M3_DISABLE_DATABASE -ErrorAction SilentlyContinue }

    Step 'Starting services'
    try {
        Start-Service2 'ml_service' $VenvPy @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$($Ports.ml)") $MlDir | Out-Null
        if (-not (Wait-Url "http://127.0.0.1:$($Ports.ml)/health" "ML service (Python, port $($Ports.ml))" 90)) {
            $errLog = Join-Path $LogDir 'ml_service.err.log'
            if (Test-Path $errLog) {
                Write-Host "`n--- Last 20 lines of $errLog ---" -ForegroundColor Red
                Get-Content $errLog -Tail 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
            }
            Fail 'ML service did not start. See logs\ml_service.err.log'
        }

        $env:PORT = "$($Ports.api)"
        Start-Service2 'backend' 'node' @('--env-file-if-exists=.env', 'src/server.js') $BackendDir | Out-Null
        if (-not (Wait-Url "http://127.0.0.1:$($Ports.api)/api/health" "Backend (Node.js, port $($Ports.api))" 30)) { Fail 'Backend did not start. See logs\backend.log' }

        Start-Service2 'frontend' 'node' @('node_modules/vite/bin/vite.js', '--port', "$($Ports.web)", '--strictPort') $FrontendDir | Out-Null
        if (-not (Wait-Url $Url "Frontend (React, port $($Ports.web))" 30)) { Fail 'Frontend did not start. See logs\frontend.log' }

        Write-Host ''
        Write-Host "  Tea Export Decision Support is running:  $Url" -ForegroundColor Green
        Write-Host "  Demo scenario: $Url/?origin=2024-03&interactive=1&rain_mm=395&usd_lkr=316"
        if (-not $env:M3_NO_BROWSER) { Start-Process $Url }
        Write-Host ''
        Read-Host '  Press Enter to STOP the app' | Out-Null
    } finally {
        Stop-All
    }
}

# ---- main -------------------------------------------------------------------
switch ($Command.ToLower()) {
    'setup'   { Do-Setup }
    'start'   { Do-Start }
    'test'    { Do-Test }
    'stop'    { Do-Stop }
    'retrain' { Check-Prerequisites; if (-not (Test-Path $VenvPy)) { Fail 'Run setup first.' }; Train-Model -Force }
    'all'     { if (-not (Test-Path $SetupMark)) { Do-Setup }; Do-Start }
    default   { Fail "Unknown command '$Command'. Use: setup, start, stop, test or retrain." }
}
