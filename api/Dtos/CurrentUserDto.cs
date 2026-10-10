namespace Tiles18xx.Api.Dtos;

// The signed-in user, as returned by GET /api/account/me.
public sealed record CurrentUserDto(string Email, IReadOnlyList<string> Roles);
