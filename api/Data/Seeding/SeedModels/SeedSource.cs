namespace Tiles18xx.Api.Data.Seeding.SeedModels;

// source.json, written by tools/import/update_data.py: which tobymao/18xx commit the seed files came from, and a hash of their data (DataHash changes
// whenever the data does, even for the same commit). Older source.json files have no hash.
public sealed record SeedSource(string Repository, string Commit, string? CommittedUtc = null, string? DataHash = null);
