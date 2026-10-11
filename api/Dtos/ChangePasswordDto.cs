namespace Tiles18xx.Api.Dtos;

// Body of POST /api/account/password: the current password (proves it is really the account's owner) and the new one.
public sealed record ChangePasswordDto(string CurrentPassword, string NewPassword);
