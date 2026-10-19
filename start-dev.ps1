# Start the three M3 services, each in its own window:
#   ML service (Python, port 8001) -> backend (Node.js, port 4000) -> frontend (React, port 5174)
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\start-dev.ps1

$root = $PSScriptRoot

$py = Join-Path $root '.venv\Scripts\python.exe'
$mlDir = if (Test-Path "$root\ml_service") { "$root\ml_service" } elseif (Test-Path "$root\mlservice") { "$root\mlservice" } else { "$root\ml-service" }
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$mlDir'; & '$py' -m uvicorn app.main:app --port 8001"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\backend'; npm start"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\frontend'; npm run dev"

Write-Host "Starting... open http://localhost:5174 in your browser once the three windows are ready."
