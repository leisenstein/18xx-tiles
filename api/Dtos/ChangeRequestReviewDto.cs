namespace Tiles18xx.Api.Dtos;

// Body of POST /api/admin/change-requests/{id}/approve and /reject. A note is required when rejecting, so the submitter knows why.
public sealed record ChangeRequestReviewDto
{
    public string? Note { get; init; }
}
