using System.Text;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Tiles18xx.Api.Auth;
using Tiles18xx.Api.Data;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// Admin-only account management for the Users page (DESIGN.md section 8): list accounts, give or take roles, disable or enable, confirm an email by
// hand, send a password-reset email, and delete. Accounts are still created by people registering themselves.
//
// Safety rules, so the site can never be left without a working admin:
// - An admin cannot change their own account here (no removing their own Admin role, disabling, or deleting themselves).
// - The account in Admin:Email cannot lose the Admin role, be disabled, or be deleted: startup (AdminSeeder) would only restore it.
// - The last admin cannot lose the role.
//
// Changes reach people who are already signed in within a minute: the sign-in cookie is re-checked against the database every minute (Program.cs
// A4c), which picks up new roles and signs out deleted and disabled accounts (disabling also changes the account's security stamp).
[ApiController]
[Route("api/admin")]
[Authorize(Roles = AdminSeeder.AdminRole)]
public sealed class UsersController(
    UserManager<IdentityUser> users,
    RoleManager<IdentityRole> roles,
    IEmailSender<IdentityUser> emailSender,
    SqliteConnectionFactory db,
    IConfiguration config,
    ILogger<UsersController> logger) : ControllerBase
{
    // Lockout end used for "disabled by an admin": far enough away to never pass. Identity's own lockouts last minutes.
    private static readonly DateTimeOffset DisabledUntil = new(9999, 12, 31, 0, 0, 0, TimeSpan.Zero);

    // GET /api/admin/users?q=text -> every account (or those whose email contains q), sorted by email.
    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<AdminUserDto>>> List([FromQuery] string? q = null)
    {
        var all = await users.Users.AsNoTracking().ToListAsync();
        var search = q?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            all = all.Where(u => (u.Email ?? "").Contains(search, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var counts = RequestCounts();
        var result = new List<AdminUserDto>();
        foreach (var user in all.OrderBy(u => u.Email, StringComparer.OrdinalIgnoreCase))
        {
            result.Add(ToDto(user, await users.GetRolesAsync(user), counts));
        }
        return Ok(result);
    }

    // GET /api/admin/roles -> the roles that exist (today only "Admin"), for the Users page.
    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<string>>> Roles() =>
        Ok(await roles.Roles.AsNoTracking().Select(r => r.Name!).OrderBy(n => n).ToListAsync());

    // PUT /api/admin/users/{id}/roles/{role} -> give the role. DELETE -> take it away (not from yourself, the configured admin, or the last admin).
    [HttpPut("users/{id}/roles/{role}")]
    public Task<IActionResult> AddRole(string id, string role) => ChangeRole(id, role, add: true);

    [HttpDelete("users/{id}/roles/{role}")]
    public Task<IActionResult> RemoveRole(string id, string role) => ChangeRole(id, role, add: false);

    // POST /api/admin/users/{id}/disable -> the account cannot sign in, and is signed out within a minute. POST .../enable -> undo it, and also ends
    // a short lockout after too many wrong passwords.
    [HttpPost("users/{id}/disable")]
    public async Task<IActionResult> Disable(string id)
    {
        if (await FindAsync(id) is not { } user)
        {
            return NotFound();
        }
        if (Protected(user, "disable") is { } refused)
        {
            return refused;
        }
        // The new security stamp makes the every-minute cookie check sign the person out.
        if (Fail(await users.SetLockoutEnabledAsync(user, true)) is { } failed)
        {
            return failed;
        }
        if (Fail(await users.SetLockoutEndDateAsync(user, DisabledUntil)) is { } failed2)
        {
            return failed2;
        }
        if (Fail(await users.UpdateSecurityStampAsync(user)) is { } failed3)
        {
            return failed3;
        }
        logger.LogInformation("Admin {Admin} disabled {Email}.", User.Identity?.Name, user.Email);
        return await Updated(user);
    }

    [HttpPost("users/{id}/enable")]
    public async Task<IActionResult> Enable(string id)
    {
        if (await FindAsync(id) is not { } user)
        {
            return NotFound();
        }
        if (Fail(await users.SetLockoutEndDateAsync(user, null)) is { } failed)
        {
            return failed;
        }
        if (Fail(await users.ResetAccessFailedCountAsync(user)) is { } failed2)
        {
            return failed2;
        }
        logger.LogInformation("Admin {Admin} enabled {Email}.", User.Identity?.Name, user.Email);
        return await Updated(user);
    }

    // POST /api/admin/users/{id}/confirm-email -> mark the email confirmed, so the account can sign in without the emailed link (useful while no email
    // service is set up). Only do this when you know the address is the person's.
    [HttpPost("users/{id}/confirm-email")]
    public async Task<IActionResult> ConfirmEmail(string id)
    {
        if (await FindAsync(id) is not { } user)
        {
            return NotFound();
        }
        if (!user.EmailConfirmed)
        {
            var token = await users.GenerateEmailConfirmationTokenAsync(user);
            if (Fail(await users.ConfirmEmailAsync(user, token)) is { } failed)
            {
                return failed;
            }
            logger.LogInformation("Admin {Admin} confirmed the email of {Email}.", User.Identity?.Name, user.Email);
        }
        return await Updated(user);
    }

    // POST /api/admin/users/{id}/password-reset -> email the person a password-reset link, the same one "Forgot password" sends. The admin never sees
    // or sets the password. Without an email service the link goes to the API log (LogEmailSender).
    [HttpPost("users/{id}/password-reset")]
    public async Task<IActionResult> SendPasswordReset(string id)
    {
        if (await FindAsync(id) is not { } user)
        {
            return NotFound();
        }
        if (string.IsNullOrEmpty(user.Email))
        {
            return Problem(detail: "This account has no email address.", statusCode: StatusCodes.Status409Conflict);
        }
        // Encoded exactly as Identity's /api/auth/forgotPassword does, so the site's reset page (/api/auth/resetPassword) accepts it.
        var token = await users.GeneratePasswordResetTokenAsync(user);
        var code = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        await emailSender.SendPasswordResetCodeAsync(user, user.Email, code);
        logger.LogInformation("Admin {Admin} sent a password reset to {Email}.", User.Identity?.Name, user.Email);
        return NoContent();
    }

    // DELETE /api/admin/users/{id} -> delete the account and its roles. Its tile requests and history stay; they show "an unknown user" as the person.
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        if (await FindAsync(id) is not { } user)
        {
            return NotFound();
        }
        if (Protected(user, "delete") is { } refused)
        {
            return refused;
        }
        if (await users.IsInRoleAsync(user, AdminSeeder.AdminRole) && await AdminCount() <= 1)
        {
            return Conflict("This is the last admin. Make someone else an admin first.");
        }
        if (Fail(await users.DeleteAsync(user)) is { } failed)
        {
            return failed;
        }
        logger.LogInformation("Admin {Admin} deleted the account {Email}.", User.Identity?.Name, user.Email);
        return NoContent();
    }

    private async Task<IActionResult> ChangeRole(string id, string role, bool add)
    {
        if (await FindAsync(id) is not { } user)
        {
            return NotFound();
        }
        if (await roles.FindByNameAsync(role) is null)
        {
            return NotFound();
        }
        var has = await users.IsInRoleAsync(user, role);
        if (add && !has)
        {
            if (Fail(await users.AddToRoleAsync(user, role)) is { } failed)
            {
                return failed;
            }
            logger.LogInformation("Admin {Admin} gave {Email} the {Role} role.", User.Identity?.Name, user.Email, role);
        }
        else if (!add && has)
        {
            if (role == AdminSeeder.AdminRole)
            {
                if (Protected(user, "remove the Admin role from") is { } refused)
                {
                    return refused;
                }
                if (await AdminCount() <= 1)
                {
                    return Conflict("This is the last admin. Make someone else an admin first.");
                }
            }
            if (Fail(await users.RemoveFromRoleAsync(user, role)) is { } failed)
            {
                return failed;
            }
            logger.LogInformation("Admin {Admin} removed the {Role} role from {Email}.", User.Identity?.Name, role, user.Email);
        }
        return await Updated(user);
    }

    // Refuse to change the signed-in admin's own account, or the configured admin's; null when the change is allowed.
    private IActionResult? Protected(IdentityUser user, string action)
    {
        if (user.Id == users.GetUserId(User))
        {
            return Conflict($"You cannot {action} your own account. Ask another admin.");
        }
        if (IsConfiguredAdmin(user))
        {
            return Conflict($"You cannot {action} this account: it is the admin in the Admin:Email setting, which the site restores at every start.");
        }
        return null;
    }

    private bool IsConfiguredAdmin(IdentityUser user) =>
        config["Admin:Email"] is { Length: > 0 } email && string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase);

    private async Task<int> AdminCount() => (await users.GetUsersInRoleAsync(AdminSeeder.AdminRole)).Count;

    private async Task<IdentityUser?> FindAsync(string id) => await users.FindByIdAsync(id);

    private async Task<IActionResult> Updated(IdentityUser user) =>
        Ok(ToDto(user, await users.GetRolesAsync(user), RequestCounts()));

    // Change requests each account has submitted, by account id (shown so an admin can see who has contributed before deleting).
    private Dictionary<string, int> RequestCounts()
    {
        using var connection = db.Open();
        return connection.Query<(string SubmittedBy, int Count)>("SELECT SubmittedBy, COUNT(*) FROM ChangeRequests GROUP BY SubmittedBy;")
            .ToDictionary(r => r.SubmittedBy, r => r.Count, StringComparer.Ordinal);
    }

    private AdminUserDto ToDto(IdentityUser user, IList<string> userRoles, Dictionary<string, int> counts)
    {
        var lockoutEnd = user.LockoutEnd is { } end && end > DateTimeOffset.UtcNow ? end : (DateTimeOffset?)null;
        var status = lockoutEnd is null ? "Active" : lockoutEnd.Value.Year >= DisabledUntil.Year ? "Disabled" : "Locked";
        return new AdminUserDto(
            user.Id,
            user.Email ?? "",
            user.EmailConfirmed,
            userRoles.Order(StringComparer.Ordinal).ToList(),
            status,
            status == "Locked" ? lockoutEnd : null,
            counts.GetValueOrDefault(user.Id),
            user.Id == users.GetUserId(User),
            IsConfiguredAdmin(user));
    }

    private ObjectResult Conflict(string detail) => Problem(detail: detail, statusCode: StatusCodes.Status409Conflict);

    // Identity reports failures as a result object; turn one into a 409 with its reasons, or null when it succeeded.
    private ObjectResult? Fail(IdentityResult result) =>
        result.Succeeded ? null : Conflict(string.Join(" ", result.Errors.Select(e => e.Description)));
}
