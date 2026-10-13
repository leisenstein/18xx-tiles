namespace Tiles18xx.Api.Data.Backups;

// Settings for the nightly database snapshots (DatabaseBackupService), read from the "Backup" section of configuration:
//   Backup:Enabled       true or false (default true)
//   Backup:Folder        where snapshots go; relative paths are from the API folder (default ../data/backups; in Docker /data/backups)
//   Backup:RetainCount   how many snapshots to keep; older ones are deleted (default 90)
//   Backup:RunAt         time of day, server time, 24-hour "HH:mm" (default 03:00; Docker containers run on UTC)
//   Backup:RunOnStartup  also check for changes when the API starts (default false; handy for testing and after deployments)
// KeysFolder is the sign-in keys folder (DataProtection:KeysPath); a copy goes into the backup folder with each snapshot.
public sealed record BackupSettings(bool Enabled, string Folder, int RetainCount, TimeOnly RunAt, bool RunOnStartup, string KeysFolder)
{
    public const int DefaultRetainCount = 90;

    public static BackupSettings From(IConfiguration config, string contentRoot, string keysFolder)
    {
        var folder = config["Backup:Folder"] ?? "../data/backups";
        if (!Path.IsPathRooted(folder))
        {
            folder = Path.GetFullPath(Path.Combine(contentRoot, folder));
        }
        var retain = config.GetValue("Backup:RetainCount", DefaultRetainCount);
        if (retain < 1)
        {
            throw new InvalidOperationException("Backup:RetainCount must be 1 or more.");
        }
        var runAtText = config["Backup:RunAt"] ?? "03:00";
        if (!TimeOnly.TryParseExact(runAtText, "HH:mm", out var runAt))
        {
            throw new InvalidOperationException($"Backup:RunAt must be a 24-hour time such as 03:00, not '{runAtText}'.");
        }
        return new BackupSettings(config.GetValue("Backup:Enabled", true), folder, retain, runAt, config.GetValue("Backup:RunOnStartup", false), keysFolder);
    }
}
