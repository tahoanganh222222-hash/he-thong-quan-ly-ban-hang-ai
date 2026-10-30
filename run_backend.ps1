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
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if (-not $CheckOnly -and @($listeners | Where-Object { $_.Port -eq 8000 }).Count -gt 0) {
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

    # Check the same database configuration as the app, without creating tables
    # or seeding data. SQL Server may still be starting after Windows boots.
    $databaseCheck = @'
import sys
import time
from contextlib import closing

import pyodbc
from app.core.config import settings
from app.core.database import connection_string

print(f'SQL Server: {settings.DB_SERVER},{settings.DB_PORT} / {settings.DB_NAME}', flush=True)
for attempt in range(1, 6):
    try:
        with closing(pyodbc.connect(connection_string, timeout=3)) as connection:
            with closing(connection.cursor()) as cursor:
                cursor.execute('SELECT 1').fetchone()
        print('Database connection passed.', flush=True)
        sys.exit(0)
    except pyodbc.Error as exc:
        state = str(exc.args[0]) if exc.args else 'unknown'
        if state not in {'08001', '08S01', 'HYT00', 'HYT01'} or attempt == 5:
            print(f'Database connection failed (SQLSTATE {state}).', flush=True)
            sys.exit(1)
        print(f'SQL Server is not ready (attempt {attempt}/5). Retrying in 2 seconds...', flush=True)
        time.sleep(2)
'@
    Push-Location -LiteralPath $backendRoot
    try {
        & $pythonExecutable -c $databaseCheck
        $databaseCheckExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($databaseCheckExitCode -ne 0) {
        throw 'Cannot connect to SQL Server. Check that SQL Server (MSSQLSERVER) is running, TCP/IP is enabled, and DB_SERVER / DB_PORT / DB_NAME in .env are correct. Check Windows account database access if SQL Server reports a login error. Backend was not started; run this file again after fixing the connection.'
    }
    if ($CheckOnly) {
        Write-Host 'Python dependencies and database connection passed. Backend was not started.' -ForegroundColor Green
        return
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
