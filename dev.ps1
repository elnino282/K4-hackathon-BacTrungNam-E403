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
    throw "Không tìm thấy Python. Hãy kích hoạt môi trường .day01 trước."
}
if (-not (Test-Path -LiteralPath $npmCommand)) {
    throw "Không tìm thấy Node.js cục bộ tại: $nodeDir"
}
if (-not (Test-Path -LiteralPath $nodeModulesDir)) {
    throw "Chưa có client/node_modules. Hãy chạy npm ci trong thư mục client trước."
}

# npm và các script con cần tìm thấy node.exe trong PATH.
$env:Path = "$nodeDir;$env:Path"

Write-Host "Đang khởi động backend..." -ForegroundColor Cyan
$backendJob = Start-Job -Name "vlearn-backend" -ScriptBlock {
    param($pythonExe, $workingDirectory)
    Set-Location -LiteralPath $workingDirectory
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
} -ArgumentList $pythonCommand.Source, $serverDir

try {
    $backendReady = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
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
        Receive-Job -Job $backendJob
        throw "Backend không sẵn sàng tại http://localhost:8000"
    }

    Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
    Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
    Write-Host "Nhấn Ctrl+C để dừng cả hai." -ForegroundColor Yellow

    Push-Location -LiteralPath $clientDir
    try {
        & $npmCommand run dev
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend dừng với mã $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
} finally {
    if ($backendJob) {
        Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Đã dừng backend và frontend." -ForegroundColor Cyan
}
