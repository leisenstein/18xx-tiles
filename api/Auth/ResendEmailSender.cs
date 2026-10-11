using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Identity;

namespace Tiles18xx.Api.Auth;

// Sends Identity's emails (account confirmation, password reset) through Resend's web API (https://resend.com, POST /emails), DESIGN.md open item 2.
// Used when Email:ResendApiKey is set; otherwise Program.cs keeps LogEmailSender, which writes the emails to the log. Settings (never in code or git):
//   Email:ResendApiKey  the API key from the Resend dashboard (user-secrets in development; Email__ResendApiKey in Docker)
//   Email:From          the sender, e.g. "18xx Tiles <no-reply@yourdomain.com>", on a domain verified in Resend
// A failed send is logged and not thrown: the account already exists by then, and the user can ask for the email again from the sign-in page.
public sealed class ResendEmailSender(HttpClient http, IConfiguration config, ILogger<ResendEmailSender> logger) : IEmailSender<IdentityUser>
{
    public const string ApiKeySetting = "Email:ResendApiKey";
    public const string FromSetting = "Email:From";
    public const string BaseUrlSetting = "Email:ResendBaseUrl"; // only for tests: a local stand-in for Resend; leave unset otherwise

    // Called by Program.cs when the API key is set: the base address and key for every request.
    public static void Configure(HttpClient client, IConfiguration config)
    {
        client.BaseAddress = new Uri(config[BaseUrlSetting] ?? "https://api.resend.com/");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config[ApiKeySetting]);
        client.Timeout = TimeSpan.FromSeconds(15);
    }

    // Identity passes links already HTML-encoded for use in an href, so they go into the HTML as they are.
    public Task SendConfirmationLinkAsync(IdentityUser user, string email, string confirmationLink) =>
        Send(email, "Confirm your 18xx Tiles account",
            "Welcome to 18xx Tiles. Confirm your email address to finish creating your account.",
            ("Confirm my account", confirmationLink),
            "If you did not create an account, you can ignore this email.");

    public Task SendPasswordResetLinkAsync(IdentityUser user, string email, string resetLink) =>
        Send(email, "Reset your 18xx Tiles password",
            "Someone asked to reset the password for this account. Use the button below to choose a new one.",
            ("Reset my password", resetLink),
            "If you did not ask for this, you can ignore this email; your password stays the same.");

    // Identity's forgotPassword endpoint sends a long one-time code; the email links to the site's reset page with it filled in (PasswordResetLink).
    public Task SendPasswordResetCodeAsync(IdentityUser user, string email, string resetCode) =>
        PasswordResetLink.For(config, email, resetCode) is { } link
            ? Send(email, "Reset your 18xx Tiles password",
                "Someone asked to reset the password for this account. Use the button below to choose a new one. The link works once.",
                ("Choose a new password", WebUtility.HtmlEncode(link)),
                "If you did not ask for this, you can ignore this email; your password stays the same.")
            : Send(email, "Your 18xx Tiles password reset code",
                $"Your password reset code is:<br><span style=\"font-family:monospace;font-size:13px;word-break:break-all\">{WebUtility.HtmlEncode(resetCode)}</span>",
                null,
                "If you did not ask for this, you can ignore this email; your password stays the same.");

    private async Task Send(string to, string subject, string messageHtml, (string Text, string Url)? button, string footer)
    {
        var body = new
        {
            from = config[FromSetting],
            to = new[] { to },
            subject,
            html = Html(subject, messageHtml, button, footer),
        };
        try
        {
            using var response = await http.PostAsJsonAsync("emails", body);
            if (!response.IsSuccessStatusCode)
            {
                // Resend explains the problem in the body (for example an unverified sender domain). The body never contains the link.
                logger.LogError("Email to {Email} failed: {Status} {Body}", to, (int)response.StatusCode, await response.Content.ReadAsStringAsync());
                return;
            }
            logger.LogInformation("Email \"{Subject}\" sent to {Email}.", subject, to);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogError(ex, "Email to {Email} failed: could not reach Resend.", to);
        }
    }

    // A simple email in the site's style: the tile-color strip, the name, the message, one button, and a footer. Inline styles and tables, because many
    // email programs ignore style sheets.
    private static string Html(string title, string messageHtml, (string Text, string Url)? button, string footer) =>
        $"""
        <!doctype html>
        <html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">
            <tr><td style="padding:0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="height:4px;background:#F2C230"></td><td style="height:4px;background:#5FAE57"></td>
              <td style="height:4px;background:#B9814B"></td><td style="height:4px;background:#ABABAB"></td>
            </tr></table></td></tr>
            <tr><td style="padding:24px 28px 8px;font-size:20px;font-weight:700">18xx <span style="color:#6b6b6b;font-weight:500">Tiles</span></td></tr>
            <tr><td style="padding:8px 28px;font-size:15px;line-height:1.6">
              <p style="margin:0 0 4px;font-size:17px;font-weight:600">{WebUtility.HtmlEncode(title)}</p>
              <p style="margin:0 0 20px">{messageHtml}</p>
              {(button is { } b
                  ? $"""<a href="{b.Url}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">{WebUtility.HtmlEncode(b.Text)}</a>"""
                  : "")}
            </td></tr>
            <tr><td style="padding:20px 28px 24px;font-size:12px;color:#78716c;line-height:1.5">{WebUtility.HtmlEncode(footer)}</td></tr>
          </table>
        </body></html>
        """;
}
