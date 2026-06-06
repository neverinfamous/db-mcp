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
$esc = [char]27
function Write-Step { param($Step, $Total, $Message) Write-Output "`n$esc[36m[$Step/$Total] $esc[37m$Message$esc[0m" }
function Write-Success { param($Message) Write-Output "  $esc[32m[OK]$esc[0m $Message" }
function Write-Info { param($Message) Write-Output "  $esc[90m--> $Message$esc[0m" }
function Write-Warn { param($Message) Write-Output "  $esc[33m[!]$esc[0m $Message" }
function Write-Err { param($Message) Write-Output "  $esc[31m[X]$esc[0m $Message" }

Write-Output ""
Write-Output "$esc[35m========================================================$esc[0m"
Write-Output "$esc[35m            DB-MCP Test Database Reset                   $esc[0m"
Write-Output "$esc[35m========================================================$esc[0m"

# Verify prerequisites
if (-not (Test-Path $SqlFile)) {
    Write-Err "test-database.sql not found at: $SqlFile"
    exit 1
}
Write-Output ""
Write-Output "$esc[90mScript directory: $ScriptDir$esc[0m"
Write-Output "$esc[90mDatabase path: $DatabasePath$esc[0m"
Write-Output "$esc[32mSQL seed file: $SqlFile$esc[0m"

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
    Write-Output "$esc[32mSQLite3 path: $sqlite3Path$esc[0m"
    $useCli = $false
}

$totalSteps = if ($SkipVerify) { 2 } else { 3 }

# ============================================================================
# Step 1: Clean up test artifacts and delete existing database
# ============================================================================
Write-Step "1" $totalSteps "Cleaning up test artifacts and deleting database..."

# Remove backup .db files and WAL/SHM artifacts left by tests
$backupFiles = Get-ChildItem -Path $ScriptDir -Filter "*.db*" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "\.db(-wal|-shm|-journal)?$" -and $_.Name -ne "test.db" }
if ($backupFiles) {
    foreach ($bf in $backupFiles) {
        Remove-Item $bf.FullName -Force -ErrorAction SilentlyContinue
        if ($Verbose) { Write-Info "Deleted backup: $($bf.Name)" }
    }
    Write-Success "Cleaned up $($backupFiles.Count) backup file(s)"
}

# Remove snapshot .json.gz files left by audit backup tests
$snapshotDir = Join-Path (Split-Path -Parent $ScriptDir) "logs\snapshots"
if (Test-Path $snapshotDir) {
    $snapshotFiles = Get-ChildItem -Path $snapshotDir -Filter "*.snapshot.json.gz" -ErrorAction SilentlyContinue
    if ($snapshotFiles) {
        foreach ($sf in $snapshotFiles) {
            Remove-Item $sf.FullName -Force -ErrorAction SilentlyContinue
            if ($Verbose) { Write-Info "Deleted snapshot: $($sf.Name)" }
        }
        Write-Success "Cleaned up $($snapshotFiles.Count) audit snapshot file(s)"
    }
}

# Remove dump .sql files left by sqlite_dump tests
$dumpFiles = Get-ChildItem -Path $ScriptDir -Filter "*.sql" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "test-database.sql" }
if ($dumpFiles) {
    foreach ($df in $dumpFiles) {
        Remove-Item $df.FullName -Force -ErrorAction SilentlyContinue
        if ($Verbose) { Write-Info "Deleted dump: $($df.Name)" }
    }
    Write-Success "Cleaned up $($dumpFiles.Count) dump file(s)"
}

# Warn about any node processes that hold the database file open (e.g. MCP servers)
$resolvePath = Resolve-Path $DatabasePath -ErrorAction SilentlyContinue
$dbFullPath = if ($resolvePath) { $resolvePath.Path } else { $DatabasePath }
$dbNameEscaped = [regex]::Escape(($dbFullPath -replace '\\', '/'))
$dbNameEscapedBackslash = [regex]::Escape($dbFullPath)

$nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $dbNameEscaped -or $_.CommandLine -match $dbNameEscapedBackslash }

if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        Write-Warn "Node process PID $($proc.ProcessId) is using this database (likely an MCP server)"
    }
    Write-Warn "The database is currently in use and cannot be safely reset."
    Write-Warn "Please close any active connections (e.g. restart the MCP server) and try again."
    exit 1
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
                Write-Warn "Database file is locked by another process (likely your IDE or an MCP server)."
                Write-Warn "The database cannot be safely reset while in use."
                Write-Warn "Please close any active connections and try again."
                exit 1
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
        if ($_ -match "database is locked" -or $_ -match "SQLITE_BUSY") {
            Write-Err "Failed to reset database because it is locked by another process (likely your IDE or SQLite extension)."
            Write-Err "Please close any active connections to the test database and try again."
        } else {
            Write-Err "Failed to create database: $_"
        }
        exit 1
    }
} else {
    # Use Node.js with better-sqlite3 via inline script
    $dbMcpRoot = Split-Path -Parent $ScriptDir
    $nodeScript = @'
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
'@

    # Write temp script to project directory so node can resolve dependencies
    $tempScript = Join-Path $dbMcpRoot ".create-test-db.js"
    $nodeScript | Out-File -FilePath $tempScript -Encoding utf8 -NoNewline

    Push-Location $dbMcpRoot
    try {
        $result = node $tempScript $DatabasePath $SqlFile 2>&1
        if ($LASTEXITCODE -ne 0 -or $result -notmatch "SUCCESS") {
            if ($result -match "database is locked" -or $result -match "SQLITE_BUSY" -or $result -match "EBUSY") {
                Write-Err "Failed to reset database because it is locked by another process (likely your IDE or SQLite extension)."
                Write-Err "Please close any active connections to the test database and try again."
            } else {
                Write-Err "Failed to create database: $result"
            }
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

# Seed audit snapshot for admin-audit testing
$snapshotDir = Join-Path (Split-Path -Parent $ScriptDir) "logs\snapshots"
if (-not (Test-Path $snapshotDir)) {
    New-Item -ItemType Directory -Force -Path $snapshotDir | Out-Null
}
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss-fffZ")
$snapshotFilename = "${timestamp}_sqlite_drop_view_seed_audit_test_view.snapshot.json.gz"

$seedSnapshotScript = @"
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const snapshot = {
  metadata: {
    timestamp: new Date().toISOString(),
    tool: 'sqlite_drop_view',
    target: 'seed_audit_test_view',
    type: 'ddl',
    requestId: 'seed-request-id-0000',
    sizeBytes: 300
  },
  ddl: 'CREATE VIEW "seed_audit_test_view" AS SELECT 1 AS test'
};

const json = JSON.stringify(snapshot, null, 2);
const finalJson = json.replace('"sizeBytes": 300', '"sizeBytes": ' + Buffer.byteLength(json, 'utf8'));
const compressed = gzipSync(Buffer.from(finalJson, 'utf8'));

writeFileSync(join(process.argv[2], process.argv[3]), compressed);
"@
$dbMcpRoot = Split-Path -Parent $ScriptDir
$tempSnapshot = Join-Path $dbMcpRoot ".seed-snapshot.js"
$seedSnapshotScript | Out-File -FilePath $tempSnapshot -Encoding utf8 -NoNewline
Push-Location $dbMcpRoot
try {
    node $tempSnapshot $snapshotDir $snapshotFilename | Out-Null
    Write-Success "Seeded 1 audit snapshot file"
} finally {
    Pop-Location
    Remove-Item $tempSnapshot -Force -ErrorAction SilentlyContinue
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

    $verifyScript = @'
import Database from 'better-sqlite3';
const db = new Database(process.argv[2], { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test_%'").all();
console.log('TABLES:' + tables.map(t => t.name).join(','));

for (const table of tables) {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM ' + table.name).get();
    console.log('COUNT:' + table.name + ':' + count.cnt);
}

db.close();
'@

    $dbMcpRoot = Split-Path -Parent $ScriptDir
    # Write temp script to project directory so node can resolve dependencies
    $tempVerify = Join-Path $dbMcpRoot ".verify-test-db.js"
    $verifyScript | Out-File -FilePath $tempVerify -Encoding utf8 -NoNewline

    Push-Location $dbMcpRoot
    try {
        $output = node $tempVerify $DatabasePath 2>&1

        $tableList = ($output | Where-Object { $_ -match "^TABLES:" }) -replace "^TABLES:", ""
        $tables = $tableList -split ","

        Write-Output "`n$esc[33m  Table verification:$esc[0m"

        $allPassed = $true
        foreach ($line in $output | Where-Object { $_ -match "^COUNT:" }) {
            $parts = ($line -replace "^COUNT:", "") -split ":"
            $tableName = $parts[0]
            $actualCount = [int]$parts[1]

            if ($expectedTables.ContainsKey($tableName)) {
                $expectedCount = $expectedTables[$tableName]
                if ($actualCount -eq $expectedCount) {
                    Write-Output "    $esc[32m[pass] $tableName ($($actualCount) rows)$esc[0m"
                } else {
                    Write-Output "    $esc[31m[fail] $tableName (expected $($expectedCount), got $($actualCount))$esc[0m"
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
        Write-Output "`n$esc[33m  Artifact check:$esc[0m"
        $allTableNames = ($output | Where-Object { $_ -match "^TABLES:" }) -replace "^TABLES:", ""
        # Get ALL tables from sqlite_master, not just test_* ones
        $allTablesScript = @'
import Database from 'better-sqlite3';
const db = new Database(process.argv[2], { readonly: true });
const all = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all();
for (const t of all) console.log('ALL:' + t.name);
db.close();
'@
        $tempAllTables = Join-Path $dbMcpRoot ".check-artifacts.js"
        $allTablesScript | Out-File -FilePath $tempAllTables -Encoding utf8 -NoNewline
        $allOutput = node $tempAllTables $DatabasePath 2>&1
        Remove-Item $tempAllTables -Force -ErrorAction SilentlyContinue

        $temporaryTables = @()
        $unexpectedTables = @()
        
        foreach ($line in $allOutput | Where-Object { $_ -match "^ALL:" }) {
            $name = ($line -replace "^ALL:", "").Trim()
            $isExpected = $expectedTables.ContainsKey($name) -or $knownSystemTables -contains $name
            if (-not $isExpected) {
                if ($name.StartsWith("stress_") -or $name.StartsWith("idx_stress_") -or $name.StartsWith("temp_") -or $name.StartsWith("idx_temp_")) {
                    $temporaryTables += $name
                } else {
                    $unexpectedTables += $name
                }
            }
        }

        $allTablesToDrop = $temporaryTables + $unexpectedTables

        if ($allTablesToDrop.Count -gt 0) {
            if ($unexpectedTables.Count -gt 0) {
                Write-Warn "Found $($unexpectedTables.Count) unexpected table(s) - stale test artifacts:"
            }
            if ($temporaryTables.Count -gt 0) {
                Write-Info "Found $($temporaryTables.Count) temporary test table(s) (stress_*, temp_*) - cleaning up:"
            }
            
            $dropScript = "import Database from 'better-sqlite3'; const db = new Database(process.argv[2]); db.pragma('foreign_keys = OFF'); "
            
            # First pass: drop main tables (non-shadow)
            foreach ($ut in $allTablesToDrop) {
                if ($ut -notmatch "_(data|idx|docsize|config|content|node|parent|rowid)$") {
                    $prefix = if ($unexpectedTables -contains $ut) { "[dropping]" } else { "[cleaning temp]" }
                    $ansiColor = if ($unexpectedTables -contains $ut) { "33" } else { "36" }
                    Write-Output "    $esc[${ansiColor}m$prefix $ut$esc[0m"
                    $dropScript += "try { db.exec('DROP TABLE IF EXISTS `"$ut`"'); } catch(e) {} try { db.exec('DROP VIEW IF EXISTS `"$ut`"'); } catch(e) {} "
                }
            }
            # Second pass: drop any remaining tables (shadow tables left behind)
            foreach ($ut in $allTablesToDrop) {
                if ($ut -match "_(data|idx|docsize|config|content|node|parent|rowid)$") {
                    $prefix = if ($unexpectedTables -contains $ut) { "[dropping shadow]" } else { "[cleaning temp shadow]" }
                    $ansiColor = if ($unexpectedTables -contains $ut) { "33" } else { "36" }
                    Write-Output "    $esc[${ansiColor}m$prefix $ut$esc[0m"
                    $dropScript += "try { db.exec('DROP TABLE IF EXISTS `"$ut`"'); } catch(e) {} try { db.exec('DROP VIEW IF EXISTS `"$ut`"'); } catch(e) {} "
                }
            }
            $dropScript += "db.pragma('foreign_keys = ON'); db.close();"
            
            $tempDrop = Join-Path $dbMcpRoot ".drop-artifacts.js"
            $dropScript | Out-File -FilePath $tempDrop -Encoding utf8 -NoNewline
            node $tempDrop $DatabasePath | Out-Null
            Remove-Item $tempDrop -Force -ErrorAction SilentlyContinue
            
            if ($unexpectedTables.Count -gt 0) {
                Write-Success "Cleaned up stale test artifacts"
            } else {
                Write-Success "Cleaned up temporary test tables"
            }
        } else {
            Write-Success "No stale test artifacts found"
        }

    } finally {
        Pop-Location
        Remove-Item $tempVerify -Force -ErrorAction SilentlyContinue
    }

    # Ensure WAL is checkpointed so WASM in-memory loads get all the data
    Write-Output "`n$esc[33m  Checkpointing WAL file...$esc[0m"
    $checkpointScript = @"
import Database from 'better-sqlite3';
const db = new Database(process.argv[2]);
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
"@
    $tempCheckpoint = Join-Path $dbMcpRoot ".checkpoint.js"
    $checkpointScript | Out-File -FilePath $tempCheckpoint -Encoding utf8 -NoNewline
    node $tempCheckpoint $DatabasePath | Out-Null
    Remove-Item $tempCheckpoint -Force -ErrorAction SilentlyContinue
    Write-Success "WAL checkpointed to main database file"

    # Generate encrypted copy
    Write-Output "`n$esc[33m  Generating encrypted database copy...$esc[0m"
    $encryptedDbPath = $DatabasePath -replace '\.db$', '-encrypted.db'
    
    # Remove existing encrypted db if it exists
    $filesToDelete = @(
        $encryptedDbPath,
        "$encryptedDbPath-shm",
        "$encryptedDbPath-wal",
        "$encryptedDbPath-journal"
    )
    foreach ($file in $filesToDelete) {
        if (Test-Path $file) {
            Remove-Item $file -Force -ErrorAction SilentlyContinue
        }
    }
    
    # Copy the unencrypted database
    Copy-Item $DatabasePath $encryptedDbPath -Force
    
    # Attempt to load DB_ENCRYPTION_KEY from secrets.env if not set
    if (-not $env:DB_ENCRYPTION_KEY) {
        $secretsPath = "C:\Users\chris\Desktop\adamic\secrets.env"
        if (Test-Path $secretsPath) {
            $keys = Get-Content $secretsPath | Where-Object { $_ -match "^DB_ENCRYPTION_KEY=(.+)$" } | ForEach-Object {
                $matches[1].Trim('"')
            }
            if ($keys) {
                # Get the last non-empty key (in case of multiple lines)
                $env:DB_ENCRYPTION_KEY = $keys | Where-Object { $_ -ne "x''" -and $_ -ne "''" -and $_ -ne "" } | Select-Object -Last 1
            }
        }
    }

    if (-not $env:DB_ENCRYPTION_KEY) {
        Write-Info "Skipping encrypted database copy (no DB_ENCRYPTION_KEY found)"
    } else {
        $encryptScript = @"
import Database from 'better-sqlite3-multiple-ciphers';

const dbPath = process.argv[2];
const key = process.argv[3];

if (!key) {
    console.error('No DB_ENCRYPTION_KEY provided');
    process.exit(1);
}

try {
    const db = new Database(dbPath);
    // Wrap the key in double quotes for SQLite PRAGMA syntax
    // This handles both string passphrases and "x'...'" hex keys
    db.pragma('rekey = "' + key + '"');
    db.close();
} catch (err) {
    console.error('Failed to encrypt:', err);
    process.exit(1);
}
"@
        $tempEncrypt = Join-Path $dbMcpRoot ".encrypt.js"
        $encryptScript | Out-File -FilePath $tempEncrypt -Encoding utf8 -NoNewline
        Push-Location $dbMcpRoot
        try {
            # Quote the key so powershell doesn't eat the single quotes inside it
            $output = ""
            try {
                $output = node $tempEncrypt $encryptedDbPath "$($env:DB_ENCRYPTION_KEY)" 2>&1
            } catch {
                $output = $_.ToString()
            }
            
            if ($LASTEXITCODE -ne 0 -or $output -match "Failed to encrypt") {
                if ($output -match "database is locked" -or $output -match "SQLITE_BUSY" -or $output -match "EBUSY") {
                    Write-Warn "Failed to encrypt copy because it is locked by another process (likely your IDE or an MCP server)."
                } else {
                    Write-Warn "Failed to encrypt copy: $output"
                }
            } else {
                Write-Success "Created encrypted database copy at: $encryptedDbPath"
            }
        } finally {
            Pop-Location
            Remove-Item $tempEncrypt -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Output ""
Write-Output "$esc[32m========================================================$esc[0m"
Write-Output "$esc[32m                    Reset Complete!                      $esc[0m"
Write-Output "$esc[32m========================================================$esc[0m"
