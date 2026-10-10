using Microsoft.AspNetCore.Identity;

namespace Tiles18xx.Api.Auth;

// Creates the Admin role, and the first admin account from configuration, at startup. Admin:Email and Admin:Password come from user-secrets (development) or
// environment variables (Docker: Admin__Email, Admin__Password); they are never in code or the image. Runs every startup but only creates what is missing;
// changing Admin:Password later does not change an existing account's password.
public static class AdminSeeder
{
    public const string AdminRole = "Admin";

    public static async Task SeedAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        // RoleManager and UserManager are Identity's tools for roles and users. They are "scoped" services, so borrow them in a temporary scope (like the
        // migration step in Program.cs).
        using var scope = services.CreateScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();

        if (!await roles.RoleExistsAsync(AdminRole))
        {
            Require(await roles.CreateAsync(new IdentityRole(AdminRole)), "create the Admin role");
        }

        var email = config["Admin:Email"];
        var password = config["Admin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("Admin:Email or Admin:Password is not set; no admin account was created.");
            return;
        }

        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            // The admin's email is trusted configuration, so it starts confirmed.
            user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = true };
            Require(await users.CreateAsync(user, password), $"create admin account {email}");
            logger.LogInformation("Created admin account {Email}.", email);
        }

        if (!await users.IsInRoleAsync(user, AdminRole))
        {
            Require(await users.AddToRoleAsync(user, AdminRole), $"add {email} to the Admin role");
        }
    }

    // Identity reports failures as a result object; stop startup with a clear message instead.
    private static void Require(IdentityResult result, string action)
    {
        if (!result.Succeeded)
        {
            var reasons = string.Join(" ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException($"Could not {action}: {reasons}");
        }
    }
}
