using System.Net;
using Microsoft.AspNetCore.Identity;

namespace Tiles18xx.Api.Auth;

// "Sends" Identity emails by writing them to the API log, so registration and password reset can be tested without an email service. Replace with a real
// provider in Phase 5 (DESIGN.md open item 2). Links in the log are single-use secrets; do not share logs. Logged at Warning level so the emails stand out in
// the console; they are not errors.
public sealed class LogEmailSender(ILogger<LogEmailSender> logger) : IEmailSender<IdentityUser>
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
        logger.LogWarning("EMAIL to {Email}: your password reset code is {Code}", email, resetCode);
        return Task.CompletedTask;
    }
}
