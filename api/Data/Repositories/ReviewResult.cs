namespace Tiles18xx.Api.Data.Repositories;

// Outcome of approving or rejecting: Done, NotFound, or a failure with a message for the admin (409 Conflict).
public sealed record ReviewResult(bool Succeeded, bool Found, string? Message)
{
    public static readonly ReviewResult Done = new(true, true, null);
    public static readonly ReviewResult NotFound = new(false, false, null);
    public static ReviewResult Fail(string message) => new(false, true, message);
}
