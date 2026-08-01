[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $repoRoot "server"
$clientDir = Join-Path $repoRoot "client"
$nodeDir = Join-Path $repoRoot ".tools\node-v22.12.0-win-x64"
$npmCommand = Join-Path $nodeDir "npm.cmd"
$nodeModulesDir = Join-Path $clientDir "node_modules"

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
    throw "Python not found. Please activate the .day01 environment first."
}
if (-not (Test-Path -LiteralPath $npmCommand)) {
    throw "Local Node.js not found at: $nodeDir"
}
if (-not (Test-Path -LiteralPath $nodeModulesDir)) {
    throw "client/node_modules does not exist yet. Please run npm ci in the client directory first."
}

# npm and child scripts need to find node.exe in PATH.
$env:Path = "$nodeDir;$env:Path"

Write-Host "Starting backend..." -ForegroundColor Cyan
$backendJob = Start-Job -Name "vlearn-backend" -ScriptBlock {
    param($pythonExe, $workingDirectory)
    Set-Location -LiteralPath $workingDirectory
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
} -ArgumentList $pythonCommand.Source, $serverDir

try {
    $backendReady = $false
    # Lần đầu có thể cần parse PDF; cho backend tối đa 30 giây để sẵn sàng.
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        if ($backendJob.State -in @("Failed", "Stopped", "Completed")) {
            break
        }
        try {
            Invoke-WebRequest `
                -Uri "http://127.0.0.1:8000/" `
                -UseBasicParsing `
                -TimeoutSec 1 | Out-Null
            $backendReady = $true
            break
        } catch {
            Start-Sleep -Milliseconds 250
        }
    }

    if (-not $backendReady) {
        Receive-Job -Job $backendJob -ErrorAction Continue
        throw "Backend is not ready at http://localhost:8000"
    }

    Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
    Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop both." -ForegroundColor Yellow

    Push-Location -LiteralPath $clientDir
    try {
        & $npmCommand run dev
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend exited with code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
} finally {
    if ($backendJob) {
        Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Backend and frontend stopped." -ForegroundColor Cyan
}
