namespace Tiles18xx.Api.Domain;

// The kinds of change request (DESIGN.md section 7, ChangeRequests.Type). Add, Edit, and Delete are about one tile; AddGame proposes a new game with its
// tile list.
public static class ChangeRequestTypes
{
    public const string Add = "Add";
    public const string Edit = "Edit";
    public const string Delete = "Delete";
    public const string AddGame = "AddGame";

    public static bool IsKnown(string type) => type is Add or Edit or Delete or AddGame;
}
