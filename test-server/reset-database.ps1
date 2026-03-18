#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Resets the db-mcp test database by deleting and re-creating from seed data.

.DESCRIPTION
    This script performs a full reset of the db-mcp test database:
    1. Deletes the existing test database file (if exists)
    2. Creates a fresh database from test-database.sql
    3. Verifies table counts and data integrity
    4. Displays a summary of seeded data

.PARAMETER DatabasePath
    Path to the database file. Default: test.db in the script directory.

.PARAMETER SkipVerify
    Skip the verification step after reset.

.PARAMETER Verbose
    Show detailed output for each step.

.EXAMPLE
    .\reset-database.ps1

.EXAMPLE
    .\reset-database.ps1 -DatabasePath "mytest.db" -Verbose

.EXAMPLE
    .\reset-database.ps1 -SkipVerify
#>

param(
    [string]$DatabasePath = "",
    [switch]$SkipVerify,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SqlFile = Join-Path $ScriptDir "test-database.sql"

# Default database path
if (-not $DatabasePath) {
    $DatabasePath = Join-Path $ScriptDir "test.db"
}

# Colors for output
function Write-Step { param($Step, $Total, $Message) Write-Host "`n[$Step/$Total] " -ForegroundColor Cyan -NoNewline; Write-Host $Message -ForegroundColor White }
function Write-Success { param($Message) Write-Host "  [OK] " -ForegroundColor Green -NoNewline; Write-Host $Message }
function Write-Info { param($Message) Write-Host "  --> " -ForegroundColor DarkGray -NoNewline; Write-Host $Message -ForegroundColor DarkGray }
function Write-Warn { param($Message) Write-Host "  [!] " -ForegroundColor Yellow -NoNewline; Write-Host $Message -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "  [X] " -ForegroundColor Red -NoNewline; Write-Host $Message -ForegroundColor Red }

Write-Host "`n========================================================" -ForegroundColor Magenta
Write-Host "            DB-MCP Test Database Reset                   " -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta

# Verify prerequisites
if (-not (Test-Path $SqlFile)) {
    Write-Err "test-database.sql not found at: $SqlFile"
    exit 1
}
Write-Host "`nScript directory: " -NoNewline; Write-Host $ScriptDir -ForegroundColor Gray
Write-Host "Database path: " -NoNewline; Write-Host $DatabasePath -ForegroundColor Gray
Write-Host "SQL seed file: " -NoNewline; Write-Host $SqlFile -ForegroundColor Green

# Check if sqlite3 is available
$sqlite3Path = $null
try {
    $sqlite3Path = Get-Command sqlite3 -ErrorAction Stop | Select-Object -ExpandProperty Source
} catch {
    # Try common locations on Windows
    $commonPaths = @(
        "C:\sqlite\sqlite3.exe",
        "C:\Program Files\sqlite\sqlite3.exe",
        "$env:LOCALAPPDATA\Programs\sqlite\sqlite3.exe"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $sqlite3Path = $path
            break
        }
    }
}

if (-not $sqlite3Path) {
    Write-Warn "sqlite3 not found in PATH. Will use Node.js better-sqlite3 via db-mcp CLI."
    $useCli = $true
} else {
    Write-Host "SQLite3 path: " -NoNewline; Write-Host $sqlite3Path -ForegroundColor Green
    $useCli = $false
}

$totalSteps = if ($SkipVerify) { 2 } else { 3 }

# ============================================================================
# Step 1: Clean up test artifacts and delete existing database
# ============================================================================
Write-Step "1" $totalSteps "Cleaning up test artifacts and deleting database..."

# Remove backup .db files left by sqlite_backup tests
$backupFiles = Get-ChildItem -Path $ScriptDir -Filter "*.db" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "test.db" }
if ($backupFiles) {
    foreach ($bf in $backupFiles) {
        Remove-Item $bf.FullName -Force -ErrorAction SilentlyContinue
        if ($Verbose) { Write-Info "Deleted backup: $($bf.Name)" }
    }
    Write-Success "Cleaned up $($backupFiles.Count) backup file(s)"
}

# Warn about any node processes that hold the database file open (e.g. MCP servers)
$dbFullPath = (Resolve-Path $DatabasePath -ErrorAction SilentlyContinue)?.Path
if (-not $dbFullPath) { $dbFullPath = $DatabasePath }
$dbNameEscaped = [regex]::Escape(($dbFullPath -replace '\\', '/'))
$dbNameEscapedBackslash = [regex]::Escape($dbFullPath)

$nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $dbNameEscaped -or $_.CommandLine -match $dbNameEscapedBackslash }

if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        Write-Warn "Node process PID $($proc.ProcessId) is using this database (likely an MCP server)"
    }
    Write-Info "The database file will be replaced in-place — existing connections will pick up the new data."
}

$filesToDelete = @(
    $DatabasePath,
    "$DatabasePath-shm",
    "$DatabasePath-wal",
    "$DatabasePath-journal"
)

$deletedCount = 0
$lockFailed = $false
foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force -ErrorAction Stop
            $deletedCount++
            if ($Verbose) {
                Write-Info "Deleted: $file"
            }
        } catch {
            if ($file -eq $DatabasePath) {
                # Main DB file is locked — overwrite will happen at seed step
                Write-Warn "Database file is locked; will overwrite in-place at seed step"
                $lockFailed = $true
            } else {
                Write-Info "Could not delete $file (may be in use): $_"
            }
        }
    }
}

if ($deletedCount -gt 0) {
    Write-Success "Deleted $deletedCount file(s)"
} elseif (-not $lockFailed) {
    Write-Info "No existing database files found"
}

# ============================================================================
# Step 2: Create fresh database from seed file
# ============================================================================
Write-Step "2" $totalSteps "Creating database from seed file..."

if (-not $useCli) {
    # Use sqlite3 command line with input redirection
    # The .read command with -cmd doesn't work reliably, so we use Get-Content | sqlite3
    try {
        Get-Content $SqlFile -Raw | & $sqlite3Path $DatabasePath
        if ($LASTEXITCODE -ne 0) {
            throw "sqlite3 exited with code $LASTEXITCODE"
        }
        Write-Success "Database created using sqlite3"
    } catch {
        Write-Err "Failed to create database: $_"
        exit 1
    }
} else {
    # Use Node.js with better-sqlite3 via inline script
    $dbMcpRoot = Split-Path -Parent $ScriptDir
    $nodeScript = @"
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const dbPath = process.argv[2];
const sqlPath = process.argv[3];

try {
    const db = new Database(dbPath);
    const sql = readFileSync(sqlPath, 'utf-8');
    db.exec(sql);
    db.close();
    console.log('SUCCESS');
} catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
}
"@

    # Write temp script to project directory so node can resolve dependencies
    $tempScript = Join-Path $dbMcpRoot ".create-test-db.js"
    $nodeScript | Out-File -FilePath $tempScript -Encoding utf8 -NoNewline

    Push-Location $dbMcpRoot
    try {
        $result = node $tempScript $DatabasePath $SqlFile 2>&1
        if ($LASTEXITCODE -ne 0 -or $result -notmatch "SUCCESS") {
            Write-Err "Failed to create database: $result"
            exit 1
        }
        Write-Success "Database created using Node.js (better-sqlite3)"
    } finally {
        Pop-Location
        Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
    }
}

if ($Verbose -and (Test-Path $DatabasePath)) {
    $dbSize = (Get-Item $DatabasePath).Length / 1KB
    Write-Info "Database size: $([math]::Round($dbSize, 2)) KB"
}

# ============================================================================
# Step 3: Verification
# ============================================================================
if (-not $SkipVerify) {
    Write-Step "3" $totalSteps "Verifying database..."

    # Expected table counts
    $expectedTables = @{
        "test_products" = 16
        "test_orders" = 20
        "test_jsonb_docs" = 6
        "test_articles" = 8
        "test_users" = 9
        "test_measurements" = 200
        "test_embeddings" = 20
        "test_locations" = 15
        "test_categories" = 17
        "test_events" = 100
    }

    # Known non-seed tables that are expected to exist (SQLite internals,
    # SpatiaLite system tables/views, FTS virtual tables created by seed SQL, etc.)
    $knownSystemTables = @(
        # SQLite internals
        "sqlite_sequence", "sqlite_stat1", "sqlite_stat4",
        # SpatiaLite tables
        "ElementaryGeometries", "KNN2", "SpatialIndex",
        "data_licenses", "geometry_columns", "geometry_columns_auth",
        "geometry_columns_field_infos", "geometry_columns_statistics",
        "geometry_columns_time", "spatial_ref_sys", "spatial_ref_sys_aux",
        "spatialite_history", "sql_statements_log",
        "views_geometry_columns", "views_geometry_columns_auth",
        "views_geometry_columns_field_infos", "views_geometry_columns_statistics",
        "virts_geometry_columns", "virts_geometry_columns_auth",
        "virts_geometry_columns_field_infos", "virts_geometry_columns_statistics",
        # SpatiaLite views
        "geom_cols_ref_sys", "spatial_ref_sys_all",
        "vector_layers", "vector_layers_auth",
        "vector_layers_field_infos", "vector_layers_statistics",
        # FTS5 shadow tables (from seed SQL)
        "test_articles_fts", "test_articles_fts_config", "test_articles_fts_content",
        "test_articles_fts_data", "test_articles_fts_docsize", "test_articles_fts_idx",
        # Migration tracking (created by seed SQL)
        "_mcp_migrations"
    )

    $verifyScript = @"
import Database from 'better-sqlite3';
const db = new Database(process.argv[2], { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test_%'").all();
console.log('TABLES:' + tables.map(t => t.name).join(','));

for (const table of tables) {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM ' + table.name).get();
    console.log('COUNT:' + table.name + ':' + count.cnt);
}

db.close();
"@

    $dbMcpRoot = Split-Path -Parent $ScriptDir
    # Write temp script to project directory so node can resolve dependencies
    $tempVerify = Join-Path $dbMcpRoot ".verify-test-db.js"
    $verifyScript | Out-File -FilePath $tempVerify -Encoding utf8 -NoNewline

    Push-Location $dbMcpRoot
    try {
        $output = node $tempVerify $DatabasePath 2>&1

        $tableList = ($output | Where-Object { $_ -match "^TABLES:" }) -replace "^TABLES:", ""
        $tables = $tableList -split ","

        Write-Host "`n  Table verification:" -ForegroundColor Yellow

        $allPassed = $true
        foreach ($line in $output | Where-Object { $_ -match "^COUNT:" }) {
            $parts = ($line -replace "^COUNT:", "") -split ":"
            $tableName = $parts[0]
            $actualCount = [int]$parts[1]

            if ($expectedTables.ContainsKey($tableName)) {
                $expectedCount = $expectedTables[$tableName]
                if ($actualCount -eq $expectedCount) {
                    Write-Host "    [pass] " -ForegroundColor Green -NoNewline
                    Write-Host "$tableName" -NoNewline
                    Write-Host " ($($actualCount) rows)" -ForegroundColor Gray
                } else {
                    Write-Host "    [fail] " -ForegroundColor Red -NoNewline
                    Write-Host "$tableName" -NoNewline
                    Write-Host " (expected $($expectedCount), got $($actualCount))" -ForegroundColor Red
                    $allPassed = $false
                }
            }
        }

        if ($allPassed) {
            Write-Success "All tables verified successfully"
        } else {
            Write-Warn "Some tables have unexpected row counts"
        }

        # Check for unexpected non-seed tables (test artifacts left behind)
        Write-Host "`n  Artifact check:" -ForegroundColor Yellow
        $allTableNames = ($output | Where-Object { $_ -match "^TABLES:" }) -replace "^TABLES:", ""
        # Get ALL tables from sqlite_master, not just test_* ones
        $allTablesScript = @"
import Database from 'better-sqlite3';
const db = new Database(process.argv[2], { readonly: true });
const all = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all();
for (const t of all) console.log('ALL:' + t.name);
db.close();
"@
        $tempAllTables = Join-Path $dbMcpRoot ".check-artifacts.js"
        $allTablesScript | Out-File -FilePath $tempAllTables -Encoding utf8 -NoNewline
        $allOutput = node $tempAllTables $DatabasePath 2>&1
        Remove-Item $tempAllTables -Force -ErrorAction SilentlyContinue

        $unexpectedTables = @()
        foreach ($line in $allOutput | Where-Object { $_ -match "^ALL:" }) {
            $name = ($line -replace "^ALL:", "").Trim()
            $isExpected = $expectedTables.ContainsKey($name) -or $knownSystemTables -contains $name
            if (-not $isExpected) {
                $unexpectedTables += $name
            }
        }

        if ($unexpectedTables.Count -gt 0) {
            Write-Warn "Found $($unexpectedTables.Count) unexpected table(s) — possible stale test artifacts:"
            foreach ($ut in $unexpectedTables) {
                Write-Host "    [stale] " -ForegroundColor Yellow -NoNewline
                Write-Host $ut -ForegroundColor Gray
            }
            Write-Info "These may be R-Tree shadow tables, _mcp_migrations, temp_* leftovers, or FTS tables from testing."
            Write-Info "Consider running a full reset to remove them."
        } else {
            Write-Success "No stale test artifacts found"
        }

    } finally {
        Pop-Location
        Remove-Item $tempVerify -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "                    Reset Complete!                      " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
