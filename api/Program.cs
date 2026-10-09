using Tiles18xx.Api.Db;
using Dapper;
using Microsoft.Data.Sqlite;
using Tiles18xx.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// This code fails with a clear error if the connection string is missing, turns the relative path into a full path, and creates the data folder. SQLite creates the database file itself, but not missing folders.
var tilesConnectionString = builder.Configuration.GetConnectionString("Tiles") ?? throw new InvalidOperationException("Connection string 'Tiles' is missing.");

var sqliteBuilder = new SqliteConnectionStringBuilder(tilesConnectionString);

if (string.IsNullOrWhiteSpace(sqliteBuilder.DataSource))
{
    throw new InvalidOperationException("Connection string 'Tiles' has no Data Source.");
}

if (!Path.IsPathRooted(sqliteBuilder.DataSource))
{
    sqliteBuilder.DataSource = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, sqliteBuilder.DataSource));
}

Directory.CreateDirectory(Path.GetDirectoryName(sqliteBuilder.DataSource)!);

builder.Services.AddSingleton(new SqliteConnectionFactory(sqliteBuilder.ToString()));



var app = builder.Build();
DatabaseMigrator.Upgrade(sqliteBuilder.ToString());
DataSeeder.SeedIfEmpty(app.Services.GetRequiredService<SqliteConnectionFactory>(), app.Logger);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();


app.MapGet("/api/health", (SqliteConnectionFactory db) =>
{
    using var connection = db.Open();
    var journalMode = connection.ExecuteScalar<string>("PRAGMA journal_mode;");
    var foreignKeys = connection.ExecuteScalar<long>("PRAGMA foreign_keys;");
    return new { status = "ok", journalMode, foreignKeys };
});


var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
