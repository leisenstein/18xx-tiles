namespace Tiles18xx.Api.Domain;

// Where a change request is in its life (DESIGN.md section 7, ChangeRequests.Status). The API sets this from the caller's role; it is never read from a
// request body.
public static class ChangeRequestStatuses
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";

    public static bool IsKnown(string status) => status is Pending or Approved or Rejected;
}
