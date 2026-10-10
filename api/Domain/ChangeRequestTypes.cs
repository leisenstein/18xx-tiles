namespace Tiles18xx.Api.Domain;

// The three kinds of change request (DESIGN.md section 7, ChangeRequests.Type).
public static class ChangeRequestTypes
{
    public const string Add = "Add";
    public const string Edit = "Edit";
    public const string Delete = "Delete";

    public static bool IsKnown(string type) => type is Add or Edit or Delete;
}
