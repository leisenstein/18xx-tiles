using System.Net;

namespace Tiles18xx.Api.Auth;

// The link in a password-reset email: the website's /reset-password page with the email and the one-time code filled in (DESIGN.md section 9.1).
// Identity's /api/auth/forgotPassword produces only a code, so the site's public address comes from App:PublicUrl (appsettings.Development.json in
// development; App__PublicUrl in Docker). Returns null when it is not set; the email then shows just the code.
public static class PasswordResetLink
{
    public const string PublicUrlSetting = "App:PublicUrl";

    public static string? For(IConfiguration config, string email, string code)
    {
        var site = config[PublicUrlSetting]?.TrimEnd('/');
        return string.IsNullOrWhiteSpace(site) ? null : $"{site}/reset-password?email={WebUtility.UrlEncode(email)}&code={WebUtility.UrlEncode(code)}";
    }
}
