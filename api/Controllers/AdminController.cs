using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tiles18xx.Api.Auth;

namespace Tiles18xx.Api.Controllers;

// Admin-only routes. Phase 4 adds the change-request review queue here.
// [Authorize(Roles = "Admin")]: not signed in -> 401; signed in without the Admin role -> 403 (forbidden).
[ApiController]
[Route("api/admin")]
[Authorize(Roles = AdminSeeder.AdminRole)]
public sealed class AdminController : ControllerBase
{
    // GET /api/admin/ping -> proves the caller is an admin (placeholder until Phase 4).
    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { status = "ok" });
}
