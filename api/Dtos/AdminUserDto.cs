namespace Tiles18xx.Api.Dtos;

// One account on the admin Users page (GET /api/admin/users).
// Status: "Active"; "Locked" (Identity's own short lockout after 5 wrong passwords, until LockoutEndUtc); or "Disabled" (by an admin, until enabled).
// IsYou: the signed-in admin's own account. IsConfiguredAdmin: the account named in Admin:Email, which startup always keeps as an admin.
// Both are protected from changes that would lock an admin out (UsersController).
public sealed record AdminUserDto(
    string Id,
    string Email,
    bool EmailConfirmed,
    IReadOnlyList<string> Roles,
    string Status,
    DateTimeOffset? LockoutEndUtc,
    int RequestCount,
    bool IsYou,
    bool IsConfiguredAdmin);
