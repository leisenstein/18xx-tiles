using System.Net;
using Microsoft.AspNetCore.Identity;

namespace Tiles18xx.Api.Auth;

// "Sends" Identity emails by writing them to the API log, so registration and password reset can be tested without an email service. Used when no
// email provider is configured (no Email:ResendApiKey; see ResendEmailSender). Links in the log are single-use secrets; do not share logs. Logged at Warning level so the emails stand out in
// the console; they are not errors.
public sealed class LogEmailSender(ILogger<LogEmailSender> logger, IConfiguration config) : IEmailSender<IdentityUser>
{
    // Identity HTML-encodes links for use in an HTML email ("&" becomes "&amp;"). Decode them so the logged link can be pasted into a browser.
    public Task SendConfirmationLinkAsync(IdentityUser user, string email, string confirmationLink)
    {
        logger.LogWarning("EMAIL to {Email}: confirm your account: {Link}", email, WebUtility.HtmlDecode(confirmationLink));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetLinkAsync(IdentityUser user, string email, string resetLink)
    {
        logger.LogWarning("EMAIL to {Email}: reset your password: {Link}", email, WebUtility.HtmlDecode(resetLink));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetCodeAsync(IdentityUser user, string email, string resetCode)
    {
        // The same link the real email would contain (PasswordResetLink), so the reset page can be tested; the bare code if App:PublicUrl is not set.
        if (PasswordResetLink.For(config, email, resetCode) is { } link)
        {
            logger.LogWarning("EMAIL to {Email}: reset your password: {Link}", email, link);
        }
        else
        {
            logger.LogWarning("EMAIL to {Email}: your password reset code is {Code}", email, resetCode);
        }
        return Task.CompletedTask;
    }
}
