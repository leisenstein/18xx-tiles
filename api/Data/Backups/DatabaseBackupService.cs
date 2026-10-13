using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.Data.Sqlite;

namespace Tiles18xx.Api.Data.Backups;

// Nightly database snapshots (DESIGN.md section 11a, runbook "Back up"). Once a day at Backup:RunAt it:
//   1. works out a fingerprint of the data (a SHA-256 of every row that matters, read in a fixed order);
//   2. compares it with the newest snapshot's fingerprint, and does nothing if they match ("no changes");
//   3. otherwise saves a consistent copy of the database with SQLite's VACUUM INTO (safe while the app runs), as tiles-YYYYMMDD-HHmmss.db, with its
//      fingerprint next to it in a .sha256 file, and refreshes the copy of the sign-in keys (backups/keys);
//   4. deletes the oldest snapshots beyond Backup:RetainCount.
// The fingerprint covers all app tables plus accounts (email, confirmation, password) and admin roles, but not counters such as failed sign-ins, so a
// night with only sign-ins keeps no snapshot. These snapshots sit next to the database: copy them off the server too (runbook).
public sealed class DatabaseBackupService(SqliteConnectionFactory db, BackupSettings settings, ILogger<DatabaseBackupService> logger) : BackgroundService
{
    private const string Prefix = "tiles-";
    private const string StampFormat = "yyyyMMdd-HHmmss";

    // What the fingerprint reads: each query returns rows in a fixed order, so the same data always gives the same hash.
    private static readonly string[] FingerprintQueries =
    [
        "SELECT * FROM Games ORDER BY Id",
        "SELECT * FROM Tiles ORDER BY Id",
        "SELECT * FROM GameTiles ORDER BY GameId, TileId",
        "SELECT * FROM ChangeRequests ORDER BY Id",
        "SELECT * FROM GameChanges ORDER BY Id",
        "SELECT * FROM ImportRuns ORDER BY Id",
        "SELECT Id, Email, EmailConfirmed, PasswordHash FROM AspNetUsers ORDER BY Id",
        "SELECT Id, Name FROM AspNetRoles ORDER BY Id",
        "SELECT UserId, RoleId FROM AspNetUserRoles ORDER BY UserId, RoleId",
    ];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!settings.Enabled)
        {
            logger.LogInformation("Nightly backups are turned off (Backup:Enabled).");
            return;
        }
        logger.LogInformation("Nightly backups at {RunAt} server time into {Folder}, keeping {Count}.", settings.RunAt, settings.Folder, settings.RetainCount);
        if (settings.RunOnStartup)
        {
            RunOnce();
        }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(UntilNextRun(DateTime.Now), stoppingToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }
            RunOnce();
        }
    }

    // How long until the next Backup:RunAt (today if it is still ahead, otherwise tomorrow).
    private TimeSpan UntilNextRun(DateTime now)
    {
        var next = now.Date + settings.RunAt.ToTimeSpan();
        if (next <= now)
        {
            next = next.AddDays(1);
        }
        return next - now;
    }

    // One backup pass. Never throws: a failed backup is logged, and the app keeps running.
    public void RunOnce()
    {
        try
        {
            Directory.CreateDirectory(settings.Folder);
            var fingerprint = Fingerprint();
            var newest = Snapshots().LastOrDefault();
            var newestFingerprint = newest is null ? null : Path.ChangeExtension(newest, ".sha256");
            if (newestFingerprint is not null && File.Exists(newestFingerprint) && File.ReadAllText(newestFingerprint).Trim() == fingerprint)
            {
                logger.LogInformation("Backup skipped: no changes since {Snapshot}.", Path.GetFileName(newest));
                return;
            }

            var name = Prefix + DateTime.Now.ToString(StampFormat, CultureInfo.InvariantCulture);
            var target = Path.Combine(settings.Folder, name + ".db");
            var temp = target + ".partial";
            File.Delete(temp);
            using (var connection = db.Open())
            {
                // VACUUM INTO writes a complete, compacted copy from one consistent read, even while other requests are writing.
                connection.Execute($"VACUUM INTO '{temp.Replace("'", "''")}';");
            }
            SqliteConnection.ClearAllPools(); // release the copy's file handle so it can be renamed on Windows
            File.Move(temp, target);
            File.WriteAllText(Path.ChangeExtension(target, ".sha256"), fingerprint);
            CopyKeys();
            logger.LogInformation("Backup saved: {Snapshot} ({Size:N0} bytes).", name + ".db", new FileInfo(target).Length);
            Prune();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or SqliteException)
        {
            logger.LogError(ex, "Backup failed.");
        }
    }

    // Snapshot files, oldest first (the timestamp in the name sorts by time).
    private string[] Snapshots() =>
        Directory.GetFiles(settings.Folder, Prefix + "*.db").Order(StringComparer.Ordinal).ToArray();

    private void Prune()
    {
        var snapshots = Snapshots();
        foreach (var old in snapshots.Take(Math.Max(0, snapshots.Length - settings.RetainCount)))
        {
            File.Delete(old);
            File.Delete(Path.ChangeExtension(old, ".sha256"));
            logger.LogInformation("Backup removed (keeping {Count}): {Snapshot}.", settings.RetainCount, Path.GetFileName(old));
        }
    }

    // A copy of the sign-in keys (a few small files): without them, a restored database signs everyone out.
    private void CopyKeys()
    {
        if (!Directory.Exists(settings.KeysFolder))
        {
            return;
        }
        var target = Path.Combine(settings.Folder, "keys");
        Directory.CreateDirectory(target);
        foreach (var file in Directory.GetFiles(settings.KeysFolder))
        {
            File.Copy(file, Path.Combine(target, Path.GetFileName(file)), overwrite: true);
        }
    }

    // SHA-256 over every value of FingerprintQueries, with each value's type and length marked, so different data can never hash the same by accident.
    private string Fingerprint()
    {
        using var connection = db.Open();
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (var sql in FingerprintQueries)
        {
            hash.AppendData(Encoding.UTF8.GetBytes(sql));
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    var value = reader.IsDBNull(i) ? "\u0000null" : Convert.ToString(reader.GetValue(i), CultureInfo.InvariantCulture) ?? "";
                    hash.AppendData(Encoding.UTF8.GetBytes($"{value.Length}:{value}|"));
                }
                hash.AppendData("\n"u8);
            }
        }
        return Convert.ToHexString(hash.GetHashAndReset());
    }
}
