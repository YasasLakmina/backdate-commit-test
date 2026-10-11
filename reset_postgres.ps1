# Self-elevate to Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting Administrator privileges to reset PostgreSQL password..."
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$pgHba = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$serviceName = "postgresql-x64-18"

if (-not (Test-Path $pgHba)) {
    Write-Host "[ERROR] Could not find pg_hba.conf at: $pgHba" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

try {
    Write-Host "[1/6] Backing up pg_hba.conf..." -ForegroundColor Cyan
    Copy-Item $pgHba "$pgHba.bak" -Force

    Write-Host "[2/6] Enabling temporary local trust authentication..." -ForegroundColor Cyan
    $content = Get-Content $pgHba
    $newContent = $content -replace "127.0.0.1/32\s+scram-sha-256", "127.0.0.1/32            trust" `
                           -replace "::1/128\s+scram-sha-256", "::1/128                 trust"
    Set-Content $pgHba $newContent -Force

    Write-Host "[3/6] Restarting PostgreSQL service..." -ForegroundColor Cyan
    Restart-Service -Name $serviceName -Force

    Write-Host "[4/6] Setting password for user 'postgres' to 'postgres'..." -ForegroundColor Cyan
    & $psql -U postgres -h 127.0.0.1 -c "ALTER USER postgres WITH PASSWORD 'postgres';"

    Write-Host "[5/6] Restoring secure scram-sha-256 authentication..." -ForegroundColor Cyan
    Copy-Item "$pgHba.bak" $pgHba -Force
    Remove-Item "$pgHba.bak" -Force

    Write-Host "[6/6] Restarting PostgreSQL service..." -ForegroundColor Cyan
    Restart-Service -Name $serviceName -Force

    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host " SUCCESS: PostgreSQL password has been reset to: postgres" -ForegroundColor Green
    Write-Host "========================================================`n" -ForegroundColor Green
    Write-Host "You can now enter 'postgres' as your password or run RUN_PROJECT.bat.`n"
} catch {
    Write-Host "`n[ERROR] Failed to reset password: $_" -ForegroundColor Red
    if (Test-Path "$pgHba.bak") {
        Copy-Item "$pgHba.bak" $pgHba -Force
        Remove-Item "$pgHba.bak" -Force
    }
}

Read-Host "Press Enter to exit"
