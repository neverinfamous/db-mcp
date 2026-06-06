import { existsSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import CipherDatabase from 'better-sqlite3-multiple-ciphers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Colors for output
const esc = '\x1b';
const c = {
    cyan: `${esc}[36m`,
    white: `${esc}[37m`,
    green: `${esc}[32m`,
    gray: `${esc}[90m`,
    yellow: `${esc}[33m`,
    red: `${esc}[31m`,
    magenta: `${esc}[35m`,
    reset: `${esc}[0m`
};

const writeStep = (step, total, msg) => console.log(`\n${c.cyan}[${step}/${total}] ${c.white}${msg}${c.reset}`);
const writeSuccess = (msg) => console.log(`  ${c.green}[OK]${c.reset} ${msg}`);
const writeInfo = (msg) => console.log(`  ${c.gray}--> ${msg}${c.reset}`);
const writeWarn = (msg) => console.log(`  ${c.yellow}[!]${c.reset} ${msg}`);
const writeErr = (msg) => console.log(`  ${c.red}[X]${c.reset} ${msg}`);

// Parse arguments
const args = process.argv.slice(2);
let dbPath = '';
let skipVerify = false;
let verbose = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db-path' || args[i] === '-d') {
        dbPath = args[++i];
    } else if (args[i] === '--skip-verify') {
        skipVerify = true;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
        verbose = true;
    }
}

if (!dbPath) {
    dbPath = join(__dirname, 'test.db');
}
const sqlFile = join(__dirname, 'test-database.sql');
const totalSteps = skipVerify ? 2 : 3;

console.log(`\n${c.magenta}========================================================${c.reset}`);
console.log(`${c.magenta}            DB-MCP Test Database Reset                   ${c.reset}`);
console.log(`${c.magenta}========================================================${c.reset}`);

if (!existsSync(sqlFile)) {
    writeErr(`test-database.sql not found at: ${sqlFile}`);
    process.exit(1);
}

console.log(`\n${c.gray}Script directory: ${__dirname}${c.reset}`);
console.log(`${c.gray}Database path: ${dbPath}${c.reset}`);
console.log(`${c.green}SQL seed file: ${sqlFile}${c.reset}`);

// ============================================================================
// Step 1: Clean up test artifacts and delete existing database
// ============================================================================
writeStep(1, totalSteps, 'Cleaning up test artifacts and deleting database...');

// Clean up backup .db files and WAL/SHM artifacts
try {
    const files = readdirSync(__dirname);
    let backupCount = 0;
    for (const file of files) {
        if (file.includes('.db') && file !== 'test.db' && (file.endsWith('.db') || file.endsWith('-wal') || file.endsWith('-shm') || file.endsWith('-journal'))) {
            rmSync(join(__dirname, file), { force: true });
            if (verbose) writeInfo(`Deleted backup: ${file}`);
            backupCount++;
        }
    }
    if (backupCount > 0) writeSuccess(`Cleaned up ${backupCount} backup file(s)`);
} catch (e) {
    writeWarn(`Failed to clean backup files: ${e.message}`);
}

// Clean up snapshots
const snapshotDir = join(projectRoot, 'logs', 'snapshots');
if (existsSync(snapshotDir)) {
    try {
        const files = readdirSync(snapshotDir);
        let snapshotCount = 0;
        for (const file of files) {
            if (file.endsWith('.snapshot.json.gz')) {
                rmSync(join(snapshotDir, file), { force: true });
                if (verbose) writeInfo(`Deleted snapshot: ${file}`);
                snapshotCount++;
            }
        }
        if (snapshotCount > 0) writeSuccess(`Cleaned up ${snapshotCount} audit snapshot file(s)`);
    } catch (e) {
        writeWarn(`Failed to clean snapshots: ${e.message}`);
    }
}

// Clean up dumps
try {
    const files = readdirSync(__dirname);
    let dumpCount = 0;
    for (const file of files) {
        if (file.endsWith('.sql') && file !== 'test-database.sql') {
            rmSync(join(__dirname, file), { force: true });
            if (verbose) writeInfo(`Deleted dump: ${file}`);
            dumpCount++;
        }
    }
    if (dumpCount > 0) writeSuccess(`Cleaned up ${dumpCount} dump file(s)`);
} catch (e) {
    writeWarn(`Failed to clean dump files: ${e.message}`);
}

// Delete main db files
const filesToDelete = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`, `${dbPath}-journal`];
let deletedCount = 0;
for (const file of filesToDelete) {
    if (existsSync(file)) {
        try {
            rmSync(file, { force: true });
            deletedCount++;
            if (verbose) writeInfo(`Deleted: ${file}`);
        } catch (e) {
            if (file === dbPath) {
                writeWarn("Database file is locked by another process (likely your IDE or an MCP server).");
                writeWarn("The database cannot be safely reset while in use.");
                writeWarn("Please close any active connections and try again.");
                process.exit(1);
            } else {
                writeInfo(`Could not delete ${file} (may be in use): ${e.message}`);
            }
        }
    }
}
if (deletedCount > 0) writeSuccess(`Deleted ${deletedCount} file(s)`);
else writeInfo("No existing database files found");

// ============================================================================
// Step 2: Create fresh database from seed file
// ============================================================================
writeStep(2, totalSteps, 'Creating database from seed file...');

try {
    const db = new Database(dbPath);
    const sql = readFileSync(sqlFile, 'utf-8');
    db.exec(sql);
    db.close();
    writeSuccess("Database created using Node.js (better-sqlite3)");
} catch (err) {
    if (err.message.includes('database is locked') || err.message.includes('SQLITE_BUSY') || err.message.includes('EBUSY')) {
        writeErr("Failed to reset database because it is locked by another process (likely your IDE or SQLite extension).");
        writeErr("Please close any active connections to the test database and try again.");
    } else {
        writeErr(`Failed to create database: ${err.message}`);
    }
    process.exit(1);
}

// Seed audit snapshot
if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
}
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const snapshotFilename = `${timestamp}_sqlite_drop_view_seed_audit_test_view.snapshot.json.gz`;
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
const finalJson = json.replace('"sizeBytes": 300', `"sizeBytes": ${Buffer.byteLength(json, 'utf8')}`);
const compressed = gzipSync(Buffer.from(finalJson, 'utf8'));
writeFileSync(join(snapshotDir, snapshotFilename), compressed);
writeSuccess("Seeded 1 audit snapshot file");

// ============================================================================
// Step 3: Verification
// ============================================================================
if (!skipVerify) {
    writeStep(3, totalSteps, 'Verifying database...');

    const expectedTables = {
        "test_products": 16,
        "test_orders": 20,
        "test_jsonb_docs": 6,
        "test_articles": 8,
        "test_users": 9,
        "test_measurements": 200,
        "test_embeddings": 20,
        "test_locations": 15,
        "test_categories": 17,
        "test_events": 100
    };

    const knownSystemTables = [
        "sqlite_sequence", "sqlite_stat1", "sqlite_stat4",
        "ElementaryGeometries", "KNN2", "SpatialIndex",
        "data_licenses", "geometry_columns", "geometry_columns_auth",
        "geometry_columns_field_infos", "geometry_columns_statistics",
        "geometry_columns_time", "spatial_ref_sys", "spatial_ref_sys_aux",
        "spatialite_history", "sql_statements_log",
        "views_geometry_columns", "views_geometry_columns_auth",
        "views_geometry_columns_field_infos", "views_geometry_columns_statistics",
        "virts_geometry_columns", "virts_geometry_columns_auth",
        "virts_geometry_columns_field_infos", "virts_geometry_columns_statistics",
        "geom_cols_ref_sys", "spatial_ref_sys_all",
        "vector_layers", "vector_layers_auth",
        "vector_layers_field_infos", "vector_layers_statistics",
        "test_articles_fts", "test_articles_fts_config", "test_articles_fts_content",
        "test_articles_fts_data", "test_articles_fts_docsize", "test_articles_fts_idx",
        "_mcp_migrations"
    ];

    try {
        const db = new Database(dbPath);
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test_%'").all();
        
        console.log(`\n${c.yellow}  Table verification:${c.reset}`);
        let allPassed = true;
        
        for (const table of tables) {
            const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${table.name}"`).get().cnt;
            if (table.name in expectedTables) {
                const expected = expectedTables[table.name];
                if (count === expected) {
                    console.log(`    ${c.green}[pass] ${table.name} (${count} rows)${c.reset}`);
                } else {
                    console.log(`    ${c.red}[fail] ${table.name} (expected ${expected}, got ${count})${c.reset}`);
                    allPassed = false;
                }
            }
        }
        
        if (allPassed) writeSuccess("All tables verified successfully");
        else writeWarn("Some tables have unexpected row counts");

        // Artifact check
        console.log(`\n${c.yellow}  Artifact check:${c.reset}`);
        const allTables = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all();
        
        const temporaryTables = [];
        const unexpectedTables = [];
        
        for (const t of allTables) {
            const name = t.name;
            const isExpected = (name in expectedTables) || knownSystemTables.includes(name);
            if (!isExpected) {
                if (name.startsWith('stress_') || name.startsWith('idx_stress_') || name.startsWith('temp_') || name.startsWith('idx_temp_')) {
                    temporaryTables.push(name);
                } else {
                    unexpectedTables.push(name);
                }
            }
        }

        const allTablesToDrop = [...temporaryTables, ...unexpectedTables];
        if (allTablesToDrop.length > 0) {
            if (unexpectedTables.length > 0) writeWarn(`Found ${unexpectedTables.length} unexpected table(s) - stale test artifacts:`);
            if (temporaryTables.length > 0) writeInfo(`Found ${temporaryTables.length} temporary test table(s) (stress_*, temp_*) - cleaning up:`);
            
            db.pragma('foreign_keys = OFF');
            // First pass
            for (const ut of allTablesToDrop) {
                if (!ut.match(/_(data|idx|docsize|config|content|node|parent|rowid)$/)) {
                    const prefix = unexpectedTables.includes(ut) ? "[dropping]" : "[cleaning temp]";
                    const col = unexpectedTables.includes(ut) ? c.yellow : c.cyan;
                    console.log(`    ${col}${prefix} ${ut}${c.reset}`);
                    try { db.exec(`DROP TABLE IF EXISTS "${ut}"`); } catch(e){}
                    try { db.exec(`DROP VIEW IF EXISTS "${ut}"`); } catch(e){}
                }
            }
            // Second pass (shadow)
            for (const ut of allTablesToDrop) {
                if (ut.match(/_(data|idx|docsize|config|content|node|parent|rowid)$/)) {
                    const prefix = unexpectedTables.includes(ut) ? "[dropping shadow]" : "[cleaning temp shadow]";
                    const col = unexpectedTables.includes(ut) ? c.yellow : c.cyan;
                    console.log(`    ${col}${prefix} ${ut}${c.reset}`);
                    try { db.exec(`DROP TABLE IF EXISTS "${ut}"`); } catch(e){}
                    try { db.exec(`DROP VIEW IF EXISTS "${ut}"`); } catch(e){}
                }
            }
            db.pragma('foreign_keys = ON');
            
            if (unexpectedTables.length > 0) writeSuccess("Cleaned up stale test artifacts");
            else writeSuccess("Cleaned up temporary test tables");
        } else {
            writeSuccess("No stale test artifacts found");
        }

        console.log(`\n${c.yellow}  Checkpointing WAL file...${c.reset}`);
        db.pragma('wal_checkpoint(TRUNCATE)');
        writeSuccess("WAL checkpointed to main database file");
        db.close();

    } catch (e) {
        writeErr(`Verification failed: ${e.message}`);
    }

    // Encrypted copy
    console.log(`\n${c.yellow}  Generating encrypted database copy...${c.reset}`);
    const encryptedDbPath = dbPath.replace(/\.db$/, '-encrypted.db');
    
    // Clean up old encrypted db
    const encryptFilesToDelete = [encryptedDbPath, `${encryptedDbPath}-shm`, `${encryptedDbPath}-wal`, `${encryptedDbPath}-journal`];
    for (const f of encryptFilesToDelete) {
        if (existsSync(f)) {
            try { rmSync(f, { force: true }); } catch (e) {}
        }
    }
    
    try { copyFileSync(dbPath, encryptedDbPath); } catch (e) { writeErr(`Failed to copy for encryption: ${e.message}`); }
    
    let key = process.env.DB_ENCRYPTION_KEY;
    if (!key) {
        try {
            const secretsPath = 'C:\\Users\\chris\\Desktop\\adamic\\secrets.env';
            if (existsSync(secretsPath)) {
                const content = readFileSync(secretsPath, 'utf8');
                const matches = content.match(/^DB_ENCRYPTION_KEY=(.+)$/gm);
                if (matches) {
                    const keys = matches.map(m => m.replace(/^DB_ENCRYPTION_KEY=/, '').replace(/^"|"$/g, '').trim());
                    const validKeys = keys.filter(k => k !== "x''" && k !== "''" && k !== "");
                    if (validKeys.length > 0) key = validKeys[validKeys.length - 1];
                }
            }
        } catch (e) {}
    }

    if (!key) {
        writeInfo("Skipping encrypted database copy (no DB_ENCRYPTION_KEY found)");
    } else {
        try {
            const cipherDb = new CipherDatabase(encryptedDbPath);
            cipherDb.pragma(`rekey = "${key}"`);
            cipherDb.close();
            writeSuccess(`Created encrypted database copy at: ${encryptedDbPath}`);
        } catch (e) {
            writeWarn(`Failed to encrypt copy: ${e.message}`);
        }
    }
}

console.log(`\n${c.green}========================================================${c.reset}`);
console.log(`${c.green}                    Reset Complete!                      ${c.reset}`);
console.log(`${c.green}========================================================${c.reset}\n`);
