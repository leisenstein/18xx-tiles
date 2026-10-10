using DbUp;

namespace Tiles18xx.Api.Data.Migrations;

public static class DatabaseMigrator
{
    public static void Upgrade(string connectionString)
    {
        var upgrader = DeployChanges.To
            .SqliteDatabase(connectionString)
            .WithScriptsEmbeddedInAssembly(typeof(DatabaseMigrator).Assembly)
            .WithTransactionPerScript()
            .LogToConsole()
            .Build();

        var result = upgrader.PerformUpgrade();
        if (!result.Successful)
        {
            throw new InvalidOperationException("Database upgrade failed.", result.Error);
        }
    }
}