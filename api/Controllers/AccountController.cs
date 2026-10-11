using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// The signed-in user's own account. Register, login, and email confirmation are the built-in Identity endpoints under /api/auth; these fill the gaps
// they leave: "who am I?", changing the password while staying signed in, and sign-out. [Authorize] on the class: every action needs a signed-in user (otherwise 401).
// Identity's UserManager and SignInManager are async-only, so these actions are async.
[ApiController]
[Route("api/account")]
[Authorize]
public sealed class AccountController(UserManager<IdentityUser> users, SignInManager<IdentityUser> signIn) : ControllerBase
{
    // GET /api/account/me -> email and roles of the signed-in user. The React app calls this to know who is signed in.
    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserDto>> Me()
    {
        // User is the identity read from the sign-in cookie; GetUserAsync loads that user's row from AspNetUsers.
        var user = await users.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }
        var roles = await users.GetRolesAsync(user);
        return Ok(new CurrentUserDto(user.Email ?? "", roles.ToList()));
    }

    // POST /api/account/password with { currentPassword, newPassword } -> changes the signed-in user's password (My account page).
    // 400 with the reasons (wrong current password, or a new one that breaks the password rules). Rate-limited like sign-in, so it cannot be used to
    // guess the current password. Changing the password signs out the account's other sessions within a minute (new security stamp); this one gets
    // a fresh cookie so it stays signed in. Identity's own /api/auth/manage/info can also change it, but leaves this session to be signed out too.
    [HttpPost("password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto body)
    {
        var user = await users.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }
        var result = await users.ChangePasswordAsync(user, body.CurrentPassword ?? "", body.NewPassword ?? "");
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                // "PasswordMismatch" is Identity's code for a wrong current password; its own text ("Incorrect password.") is vague here.
                ModelState.AddModelError(error.Code, error.Code == "PasswordMismatch" ? "Your current password is not correct." : error.Description);
            }
            return ValidationProblem();
        }
        await signIn.RefreshSignInAsync(user);
        return NoContent();
    }

    // POST /api/account/logout -> deletes the sign-in cookie (step 5 in Program.cs A4).
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signIn.SignOutAsync();
        return NoContent();
    }
}
