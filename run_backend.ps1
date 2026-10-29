[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    $projectRoot = $PSScriptRoot
    $backendRoot = Join-Path $projectRoot 'backend'
    if (-not (Test-Path -LiteralPath (Join-Path $backendRoot 'app\main.py') -PathType Leaf)) {
        throw 'Cannot find backend\app\main.py. Keep this script in the project root.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env') -PathType Leaf)) {
        throw 'Cannot find .env. Create it from .env.example and configure SQL Server first.'
    }

    # Run the virtual environment's Python directly; Activate.ps1 is unnecessary.
    $pythonCandidates = @(
        (Join-Path $projectRoot '.venv\Scripts\python.exe'),
        (Join-Path $backendRoot 'venv\Scripts\python.exe'),
        (Join-Path $projectRoot 'venv\Scripts\python.exe')
    )
    $pythonExecutable = $null
    $dependencyCheck = "import importlib.util; import sys; modules = ('uvicorn', 'fastapi', 'sqlalchemy', 'pyodbc', 'pydantic_settings', 'dotenv', 'jose', 'bcrypt'); sys.exit(0 if all(importlib.util.find_spec(name) is not None for name in modules) else 1)"
    foreach ($candidate in $pythonCandidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            & $candidate -I -c $dependencyCheck *> $null
            if ($LASTEXITCODE -eq 0) {
                $pythonExecutable = $candidate
                break
            }
        }
    }
    if (-not $pythonExecutable) {
        throw 'No project Python environment has the backend dependencies. Follow the first-time setup in README.md and install backend\requirements.txt.'
    }

    Write-Host "Python:  $pythonExecutable"
    Write-Host "Backend: $backendRoot"
    Write-Host 'API:     http://127.0.0.1:8000'
    Write-Host 'Swagger: http://127.0.0.1:8000/docs'
    if ($CheckOnly) {
        Write-Host 'Check passed. Backend was not started.' -ForegroundColor Green
        return
    }

    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if (@($listeners | Where-Object { $_.Port -eq 8000 }).Count -gt 0) {
        $existingApi = $null
        try {
            $existingApi = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/' -TimeoutSec 5
        }
        catch { }
        if ($existingApi -and $existingApi.PSObject.Properties['message'] -and
            $existingApi.message -eq 'Sales Management API is running') {
            Write-Host 'Backend is already running. No second instance is needed.' -ForegroundColor Green
            Write-Host 'Keep its existing window open. Website: http://127.0.0.1:5500'
            if (-not $NoPause -and [Environment]::UserInteractive) {
                [void](Read-Host 'Press Enter to close this extra window')
            }
            return
        }
        throw 'Port 8000 is occupied, but the Sales Management API is not responding. Check the existing backend window for an error or stop the other program using this port, then run this file again.'
    }

    Write-Host 'Keep this window open. Press Ctrl+C to stop the backend.' -ForegroundColor Cyan
    Write-Host 'Wait for Application startup complete before signing in.' -ForegroundColor Cyan
    Push-Location -LiteralPath $backendRoot
    try {
        & $pythonExecutable -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
        $serverExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($serverExitCode -notin @(0, 130, -1073741510)) {
        throw "Backend stopped with exit code $serverExitCode. See the error above. Check that SQL Server is running and .env is configured correctly."
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $CheckOnly -and -not $NoPause -and [Environment]::UserInteractive) {
        [void](Read-Host 'Press Enter to close')
    }
    exit 1
}
