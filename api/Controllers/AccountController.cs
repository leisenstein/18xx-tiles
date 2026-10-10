using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// The signed-in user's own account. Register, login, and email confirmation are the built-in Identity endpoints under /api/auth; these fill the two gaps
// they leave: "who am I?" and sign-out. [Authorize] on the class: every action needs a signed-in user (otherwise 401).
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

    // POST /api/account/logout -> deletes the sign-in cookie (step 5 in Program.cs A4).
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signIn.SignOutAsync();
        return NoContent();
    }
}
