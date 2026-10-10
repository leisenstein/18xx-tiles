using Dapper;
using Microsoft.AspNetCore.Mvc;
using Tiles18xx.Api.Data;

namespace Tiles18xx.Api.Controllers;

// GET /api/health -> confirms the database opens with WAL mode and foreign keys on.
[ApiController]
[Route("api/health")]
public sealed class HealthController(SqliteConnectionFactory db) : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        using var connection = db.Open();
        var journalMode = connection.ExecuteScalar<string>("PRAGMA journal_mode;");
        var foreignKeys = connection.ExecuteScalar<long>("PRAGMA foreign_keys;");
        return Ok(new { status = "ok", journalMode, foreignKeys });
    }
}
