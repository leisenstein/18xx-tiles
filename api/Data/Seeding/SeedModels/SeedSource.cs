namespace Tiles18xx.Api.Data.Seeding.SeedModels;

// source.json, written by tools/import/update_data.py: which tobymao/18xx commit the seed files came from.
public sealed record SeedSource(string Repository, string Commit, string? CommittedUtc = null);
