# Migrating to Encrypted SQLite (SQLCipher)

This guide covers how to encrypt an existing `db-mcp` plaintext SQLite database for use with the `DB_ENCRYPTION_KEY` feature (Encryption at Rest).

> [!WARNING]
> Encryption is only supported when running the Native (`better-sqlite3`) backend. WASM (`sql.js`) is incompatible with SQLCipher.

## Prerequisites

You will need the `sqlcipher` command-line utility installed on your system.

- **macOS**: `brew install sqlcipher`
- **Ubuntu/Debian**: `sudo apt-get install sqlcipher`
- **Windows**: Download from [zetetic.net/sqlcipher](https://www.zetetic.net/sqlcipher/open-source/) or use WSL.

## Encryption Steps

If you have an existing database named `data.db` and you want to encrypt it:

1. Open your terminal and create a new encrypted database file:

   ```bash
   sqlcipher encrypted_data.db
   ```

2. Set the encryption key for the new database (this must be done first):

   ```sql
   sqlite> PRAGMA key = 'your-super-secret-key-here';
   ```

3. Attach your existing plaintext database:

   ```sql
   sqlite> ATTACH DATABASE 'data.db' AS plaintext KEY '';
   ```

4. Export the plaintext data into the encrypted database:

   ```sql
   sqlite> SELECT sqlcipher_export('main', 'plaintext');
   ```

5. Detach the plaintext database and exit:
   ```sql
   sqlite> DETACH DATABASE plaintext;
   sqlite> .quit
   ```

Your `encrypted_data.db` is now fully encrypted.

## Running db-mcp with Encryption

To start `db-mcp` using your newly encrypted database, set the `DB_ENCRYPTION_KEY` environment variable or use the `--encryption-key` flag alongside `--sqlite-native`:

```bash
DB_ENCRYPTION_KEY="your-super-secret-key-here" \
db-mcp --sqlite-native ./encrypted_data.db
```

Or using CLI flags exclusively:

```bash
db-mcp --sqlite-native ./encrypted_data.db --encryption-key "your-super-secret-key-here"
```

## Considerations

- **System Database**: If you enable encryption, your sidecar `SystemDb` (which contains audit logs and metrics) will also be encrypted using the same key automatically. This ensures sensitive queries recorded in the audit log are protected.
- **Performance**: SQLCipher introduces a slight performance overhead (typically 5-15%) compared to plaintext SQLite due to page-level encryption and decryption.
- **Key Rotation**: To change your encryption key, you must connect to the encrypted database using `sqlcipher`, execute `PRAGMA key = 'old-key';` followed by `PRAGMA rekey = 'new-key';`. You cannot rotate keys directly through `db-mcp`.
