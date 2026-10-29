[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    $projectRoot = $PSScriptRoot
    $frontendRoot = Join-Path $projectRoot 'frontend'
    if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot 'index.html') -PathType Leaf)) {
        throw 'Cannot find frontend\index.html. Keep this script in the project root.'
    }

    $pythonCandidates = @(
        (Join-Path $projectRoot '.venv\Scripts\python.exe'),
        (Join-Path $projectRoot 'backend\venv\Scripts\python.exe'),
        (Join-Path $projectRoot 'venv\Scripts\python.exe')
    )
    $systemPython = Get-Command python.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($systemPython) {
        $pythonCandidates += $systemPython.Source
    }
    $pythonExecutable = $null
    foreach ($candidate in $pythonCandidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            & $candidate -I -c 'import http.server' *> $null
            if ($LASTEXITCODE -eq 0) {
                $pythonExecutable = $candidate
                break
            }
        }
    }
    if (-not $pythonExecutable) {
        throw 'Cannot find a working Python installation. Follow the first-time Python setup in README.md.'
    }

    Write-Host "Python:   $pythonExecutable"
    Write-Host "Frontend: $frontendRoot"
    Write-Host 'Website:  http://127.0.0.1:5500'
    if ($CheckOnly) {
        Write-Host 'Check passed. Frontend was not started.' -ForegroundColor Green
        return
    }

    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if (@($listeners | Where-Object { $_.Port -eq 5500 }).Count -gt 0) {
        $existingPage = $null
        try {
            $existingPage = Invoke-WebRequest -Uri 'http://127.0.0.1:5500/' -UseBasicParsing -TimeoutSec 5
        }
        catch { }
        if ($existingPage -and $existingPage.Content.Contains('id="login-page"') -and
            $existingPage.Content.Contains('js/auth.js')) {
            Write-Host 'Frontend is already running. No second instance is needed.' -ForegroundColor Green
            Write-Host 'Open http://127.0.0.1:5500 in your browser.'
            if (-not $NoPause -and [Environment]::UserInteractive) {
                [void](Read-Host 'Press Enter to close this extra window')
            }
            return
        }
        throw 'Port 5500 is occupied by another website or a server that is not responding. Stop that program or configure Live Server to serve this project, then run this file again.'
    }

    Write-Host 'Open http://127.0.0.1:5500 in your browser.' -ForegroundColor Green
    Write-Host 'Keep this window and the backend window open. Press Ctrl+C to stop the frontend.' -ForegroundColor Cyan
    & $pythonExecutable -m http.server 5500 --bind 127.0.0.1 --directory $frontendRoot
    $serverExitCode = $LASTEXITCODE
    if ($serverExitCode -notin @(0, 130, -1073741510)) {
        throw "Frontend stopped with exit code $serverExitCode. See the error above."
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $CheckOnly -and -not $NoPause -and [Environment]::UserInteractive) {
        [void](Read-Host 'Press Enter to close')
    }
    exit 1
}
