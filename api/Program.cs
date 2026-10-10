using Microsoft.Data.Sqlite;
using Tiles18xx.Api.Data;
using Tiles18xx.Api.Data.Migrations;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Data.Seeding;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// API controllers live in the Controllers folder ([ApiController] classes).
builder.Services.AddControllers()
    // Validation error keys in camelCase ("game", not "Game") to match the rest of the JSON.
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);
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


// Repositories are stateless, so one shared instance is fine.
builder.Services.AddSingleton(new SqliteConnectionFactory(sqliteBuilder.ToString()));
builder.Services.AddSingleton<GamesRepository>();
builder.Services.AddSingleton<TilesRepository>();


var app = builder.Build();
DatabaseMigrator.Upgrade(sqliteBuilder.ToString());
DataSeeder.SeedIfEmpty(app.Services.GetRequiredService<SqliteConnectionFactory>(), app.Logger);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// HSTS tells browsers to use HTTPS for this site from now on, even if a user types http://.
// Not in development, because it would stick to "localhost" in your browser.
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();

// Serve the built React app (index.html, JavaScript, CSS) from the wwwroot folder.
app.UseDefaultFiles();
app.UseStaticFiles();


// Routes from all controllers (GamesController, HealthController, ...).
app.MapControllers();

// If an /api address does not exist, return "404 Not Found".
app.MapFallback("/api/{**rest}", () => Results.NotFound());

// Any other unknown address loads the React app, so pages like /tiles/42 work on refresh.
app.MapFallbackToFile("index.html");



app.Run();


