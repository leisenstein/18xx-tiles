using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Tiles18xx.Api.Auth;
using Tiles18xx.Api.Data;
using Tiles18xx.Api.Data.Migrations;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Data.Seeding;

// Program.cs runs once when the API starts. It has two halves:
//   Part A: register "services" (the building blocks the app can use) on builder.Services.
//   Part B: build the app, prepare the database, and set up the "pipeline" every web request passes through.

var builder = WebApplication.CreateBuilder(args);

// =====================================================================================================================
// Part A: services
// =====================================================================================================================

// ---- A1. Controllers ----
// API controllers live in the Controllers folder ([ApiController] classes). Validation error keys are camelCase ("game", not "Game") to match the JSON.
builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

// OpenAPI describes the API's endpoints (served at /openapi/v1.json in development). https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// ---- A2. Database location ----
// Read the connection string, fail with a clear error if it is missing, turn a relative path into a full path, and create the data folder. SQLite creates
// the database file itself, but not missing folders.
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

// ---- A3. App data (games and tiles), read with Dapper ----
// Repositories are stateless, so one shared instance is fine.
builder.Services.AddSingleton(new SqliteConnectionFactory(sqliteBuilder.ToString()));
builder.Services.AddSingleton<GamesRepository>();
builder.Services.AddSingleton<TilesRepository>();

// ---- A4. Accounts: ASP.NET Core Identity (Phase 3) ----
//
// How signing in works, in plain terms:
//   1. Register: the browser sends an email and password. Identity stores the user in the AspNetUsers table. The password is never stored, only a
//      one-way "hash" of it, so even the database cannot reveal it.
//   2. Confirm: Identity emails a one-time link. Until the user clicks it, they cannot sign in.
//   3. Sign in: the browser sends the email and password again. If they match, Identity creates a "ticket" (who the user is and which roles they have,
//      such as Admin) and puts it in an encrypted cookie.
//   4. Every later request: the browser sends the cookie back automatically. ASP.NET Core decrypts it and knows who is asking. [Authorize] on a
//      controller then allows or refuses the request.
//   5. Sign out: the cookie is deleted.
//
// The pieces below set this up. The endpoints are mapped in B2 (MapIdentityApi, plus AccountController for "who am I?" and sign-out).
// Still to come: rate limiting (step 3.7).

// A4a. Where users and roles are stored: the AspNet* tables in the same SQLite file. Identity reads and writes them through EF Core (AuthDbContext),
//      separate from our Dapper code.
builder.Services.AddDbContext<AuthDbContext>(options => options.UseSqlite(sqliteBuilder.ToString()));

// A4b. Identity itself: users, password rules, and roles. AddIdentityApiEndpoints also prepares the ready-made register/login/confirm/reset endpoints.
builder.Services
    .AddIdentityApiEndpoints<IdentityUser>(options =>
    {
        options.SignIn.RequireConfirmedEmail = true; // step 2 above: must click the emailed link before signing in
        options.User.RequireUniqueEmail = true;      // one account per email address
        options.Password.RequiredLength = 10;        // plus Identity's defaults: upper, lower, digit, and symbol
    })
    .AddRoles<IdentityRole>()                       // roles such as "Admin" (stored in AspNetRoles / AspNetUserRoles)
    .AddEntityFrameworkStores<AuthDbContext>();      // store everything through A4a

// A4c. The sign-in cookie from step 3 above. Secure: only sent over HTTPS. SameSite=Strict: never sent when another website triggers the request, which
//      blocks "cross-site request forgery" (a malicious site acting as the signed-in user). The cookie is also HttpOnly by default, so JavaScript in the
//      page cannot read or steal it.
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
});

// A4d. The keys that encrypt the cookie ("Data Protection"). If the keys were lost on every restart, every cookie would become unreadable and everyone
//      would be signed out. So they are saved to disk: data/keys in development, /data/keys in Docker (DESIGN.md section 11a). Keep this folder private.
var keysPath = builder.Configuration["DataProtection:KeysPath"] ?? "../data/keys";
if (!Path.IsPathRooted(keysPath))
{
    keysPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, keysPath));
}
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keysPath)).SetApplicationName("Tiles18xx");

// A4e. Emails (confirmation link, password reset). Identity calls this "sender" whenever it needs to email someone. Ours writes the email to the API log
//      instead of sending it, until a real provider is chosen (DESIGN.md open item 2).
builder.Services.AddSingleton<IEmailSender<IdentityUser>, LogEmailSender>();

// =====================================================================================================================
// Part B: build the app, prepare the database, and set up the request pipeline
// =====================================================================================================================

var app = builder.Build();

// ---- B1. Database: our tables (DbUp), initial data, then the Identity tables (EF Core) and the admin account ----
DatabaseMigrator.Upgrade(sqliteBuilder.ToString());
DataSeeder.SeedIfEmpty(app.Services.GetRequiredService<SqliteConnectionFactory>(), app.Logger);

// Create or update the AspNet* tables from the migrations in Auth/Migrations. Like DbUp, EF Core records which migrations already ran (in the
// __EFMigrationsHistory table), so each one runs only once. AuthDbContext is a "scoped" service (one per request), so borrow one in a temporary scope.
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<AuthDbContext>().Database.Migrate();
}

// Create the Admin role and the first admin account (from user-secrets or environment variables) if missing.
await AdminSeeder.SeedAsync(app.Services, app.Configuration, app.Logger);

// ---- B2. Pipeline: each request passes through these steps in order ----

// OpenAPI document, in development only.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// HSTS tells browsers to use HTTPS for this site from now on, even if a user types http://. Not in development, because it would stick to "localhost" in
// your browser.
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();

// Serve the built React app (index.html, JavaScript, CSS) from the wwwroot folder.
app.UseDefaultFiles();
app.UseStaticFiles();

// Note: reading the sign-in cookie (UseAuthentication) and checking [Authorize] (UseAuthorization) are added to the pipeline automatically, because
// Identity is registered in A4.

// Routes from all controllers (GamesController, HealthController, AccountController, AdminController, ...).
app.MapControllers();

// Built-in Identity endpoints under /api/auth: register, login, confirmEmail, resendConfirmationEmail, forgotPassword, resetPassword, and manage/info.
// Login with ?useCookies=true sets the sign-in cookie (step 3 in A4).
app.MapGroup("/api/auth").MapIdentityApi<IdentityUser>();

// If an /api address does not exist, return "404 Not Found".
app.MapFallback("/api/{**rest}", () => Results.NotFound());

// Any other unknown address loads the React app, so pages like /tiles/42 work on refresh.
app.MapFallbackToFile("index.html");

app.Run();
