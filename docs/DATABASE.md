# 18xx Tiles database

The database's tables, columns, relationships, stored JSON, and conventions, with useful queries. For admins. How to back up, reset, and change the schema is in the **Runbook**; the design reasons are in `DESIGN.md` section 7.

> Shown in the app at **Docs**, **Database** (admins only). The source is `docs/DATABASE.md` in the repository.

## At a glance

| Item | Value |
|---|---|
| Engine | SQLite, one file, WAL mode, foreign keys on (set on every connection) |
| File | `data/tiles.db` in development; `/data/tiles.db` on the `tiles-data` volume in Docker |
| App tables | `Games`, `Tiles`, `GameTiles`, `ChangeRequests`, `GameChanges`, `ImportRuns` |
| Sign-in tables | `AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`, and four more (ASP.NET Core Identity) |
| App schema | `api/Data/Migrations/Scripts/0001_CreateSchema.sql`, applied by DbUp, recorded in `SchemaVersions` |
| Sign-in schema | `api/Auth/Migrations/`, applied by EF Core, recorded in `__EFMigrationsHistory` |
| Data access | Dapper (plain SQL) for app tables; EF Core only for sign-in tables |

## How the tables relate

```text
Games 1 ──< GameTiles >── 1 Tiles          a game uses many tiles; a tile is used by many games
Games 1 ──< GameChanges                    each save of a game's tile list
Tiles 1 ──< ChangeRequests                 proposals and applied edits for a tile (TileId empty for an Add until approved)
AspNetUsers 1 ──< ChangeRequests           SubmittedBy, ReviewedBy (user ids, not enforced by a foreign key)
AspNetUsers 1 ──< GameChanges              ChangedBy
AspNetUsers 1 ──< Tiles                    CreatedBy (user tiles), UpdatedBy (last change)
AspNetUsers >──< AspNetRoles               through AspNetUserRoles (the Admin role)
ImportRuns                                 standalone: one row per applied data import
```

User ids in app tables are plain text columns holding `AspNetUsers.Id`, without a foreign key, so the two sets of tables stay independent of each other.

## Conventions

| Topic | Rule |
|---|---|
| Times | Text in ISO 8601 UTC with fractional seconds, for example `2026-10-10T17:08:35.9585578Z`. They sort correctly as text. The website shows them in the viewer's local time |
| Booleans | `INTEGER` 0 or 1 (`HasCity`, `HasTown`, `IsDeleted`) |
| Ids | `INTEGER PRIMARY KEY` (SQLite row id), assigned on insert |
| Counts | `GameTiles.Count`: NULL = unknown, 999 = unlimited, otherwise 1 to 100 |
| Deletes | Tiles are never removed: Delete sets `IsDeleted = 1`. Lists and searches show live tiles only (`IsDeleted = 0`); history keeps everything |
| Tile definitions | tobymao/18xx's tile language, for example `city=revenue:20;path=a:0,b:_0;path=a:_0,b:3`. Two definitions are the same tile when their `;` parts match in any order |
| Display names | `#57` for a generic tile or the only tile with that number; `#10 (1825)` for a version used by one game; `#10 (variant 2)` for a version shared by several games; `#57 (Kansas City)` when a variant name was given |

## Games

One row per game, imported from tobymao/18xx. Not editable in the app.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `Id` | INTEGER | no | Primary key |
| `Title` | TEXT | no | Game title, unique, for example `1830` |
| `SourceKey` | TEXT | no | Upstream folder name, unique, for example `g_1830`; `18xxnet_<name>` for games imported from 18xx.net (runbook). Imports match games by this, so a title can change upstream |
| `Designer` | TEXT | yes | From the game's `meta.rb`; NULL when upstream lists none |
| `Publisher` | TEXT | yes | One or more names, comma-separated |
| `CreatedUtc` | TEXT | no | When the import added it |

## Tiles

Every distinct tile: number, color, and definition. Only approved, live data; proposals wait in `ChangeRequests`.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `Id` | INTEGER | no | Primary key |
| `Number` | TEXT | no | Tile number as printed, for example `57`, `X20`, `298LA`. Not unique: versions share numbers |
| `Color` | TEXT | no | `yellow`, `green`, `brown`, `gray`, `greenbrown`, `browngray`, `brownsepia`, `none`, `red`, `blue`, `purple`, `white`, `orange` |
| `DefinitionCode` | TEXT | no | The tile language string, drawn by the website |
| `DisplayName` | TEXT | no | Name shown on the site (see Conventions) |
| `HasCity`, `HasTown` | INTEGER | no | 1 if the definition has a `city` / `town` part; set on every save |
| `Source` | TEXT | no | `generic` (standard numbered tile), `game-version` (a game's own version of a generic number), `game-specific` (a number only some games use), `user` (added in the app) |
| `SourceRef` | TEXT | yes | Imported tiles: `18xx.games commit <hash>` |
| `IsDeleted` | INTEGER | no | 1 = deleted (hidden, kept for history) |
| `CreatedBy` | TEXT | yes | User tiles: who proposed it |
| `CreatedUtc` | TEXT | no | When it was imported or approved |
| `UpdatedUtc`, `UpdatedBy` | TEXT | yes | The last approved change and the admin who made or approved it |

Unique: (`Number`, `Color`, `DefinitionCode`). Indexes: `IX_Tiles_Number`, `IX_Tiles_Color`.

## GameTiles

Which tiles each game uses, and how many come in the box. Primary key (`GameId`, `TileId`).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `GameId` | INTEGER | no | References `Games.Id` |
| `TileId` | INTEGER | no | References `Tiles.Id` |
| `Count` | INTEGER | yes | Tiles in the box: NULL = unknown, 999 = unlimited |
| `Notes` | TEXT | yes | For example `Count from 18xx.games manifest` (set by the import) or edition differences |

Index: `IX_GameTiles_TileId` (a tile's games). Links to deleted tiles stay, but the site ignores them.

## ChangeRequests

Tile proposals and applied changes, and the audit trail. A regular user's Add is Pending until an admin decides; an admin's Add, Edit, or Delete is recorded as Approved at once.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `Id` | INTEGER | no | Primary key; shown as "request #12" |
| `Type` | TEXT | no | `Add`, `Edit`, or `Delete` |
| `TileId` | INTEGER | yes | The tile; for an Add, set when it is approved |
| `ProposedJson` | TEXT | yes | The tile as proposed (Add, Edit); see Stored JSON |
| `BeforeJson` | TEXT | yes | Approved Edit or Delete: the tile and its games just before the change |
| `Reason` | TEXT | yes | The submitter's explanation |
| `Status` | TEXT | no | `Pending`, `Approved`, or `Rejected` |
| `SubmittedBy`, `SubmittedUtc` | TEXT | no | Who and when |
| `ReviewedBy`, `ReviewedUtc` | TEXT | yes | The admin who decided, and when |
| `ReviewNote` | TEXT | yes | Required when rejecting; `Applied directly by an admin.` for admin changes |

Indexes: `IX_ChangeRequests_Status` (review queue), `IX_ChangeRequests_SubmittedBy` (My requests), `IX_ChangeRequests_TileId` (a tile's history).

## GameChanges

One row per save on **Edit game tiles**.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `Id` | INTEGER | no | Primary key |
| `GameId` | INTEGER | no | References `Games.Id` |
| `ChangedBy`, `ChangedUtc` | TEXT | no | The admin, and when |
| `Reason` | TEXT | yes | Optional reason |
| `BeforeJson`, `AfterJson` | TEXT | no | The game's live tile links before and after the save; History shows the difference |

Index: `IX_GameChanges_GameId`.

## ImportRuns

One row per applied import of the tobymao/18xx data.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `Id` | INTEGER | no | Primary key |
| `SourceCommit` | TEXT | no | The tobymao/18xx commit |
| `CommittedUtc` | TEXT | yes | When that commit was made upstream |
| `DataHash` | TEXT | yes | SHA-256 of the seed files; an import is skipped if a run with this hash exists |
| `ImportedUtc` | TEXT | no | When the import ran |
| `Mode` | TEXT | no | `seed` (empty database) or `merge` (added to existing data) |
| `GamesAdded`, `TilesAdded`, `LinksAdded`, `CountsFilled` | INTEGER | no | What it did |
| `NotesJson` | TEXT | no | Notes for review; see Stored JSON |

Indexes: `IX_ImportRuns_SourceCommit`, `IX_ImportRuns_DataHash`, `IX_ImportRuns_ImportedUtc`.

## Stored JSON

JSON columns use camelCase names, the same as the API.

`ChangeRequests.ProposedJson` and `BeforeJson`, a tile's content:

```json
{
  "number": "57",
  "color": "yellow",
  "definitionCode": "city=revenue:20;path=a:0,b:_0;path=a:_0,b:3",
  "variantName": null,
  "games": [{ "gameId": 25, "count": 4, "notes": null }]
}
```

`games` null in an Edit means the tile's games were not changed. `BeforeJson` also carries `displayName`.

`GameChanges.BeforeJson` and `AfterJson`, a game's tile links:

```json
[{ "tileId": 8, "count": 8, "notes": "Count from 18xx.games manifest" }]
```

`ImportRuns.NotesJson`, the import report:

```json
[{ "kind": "definition-changed", "message": "1825: tile 10 upstream is ... Not applied." }]
```

Note kinds: `definition-changed`, `generic-changed`, `count-differs`, `deleted-in-app`, `not-upstream`, `game-not-upstream`, `game-renamed`, `game-not-renamed`, `game-details`.

## Sign-in tables (ASP.NET Core Identity)

Created and changed only through EF Core migrations. Do not edit their structure by hand.

| Table | Holds |
|---|---|
| `AspNetUsers` | Accounts: `Id` (text), `Email`, `NormalizedEmail` (upper case, used for lookups), `EmailConfirmed`, `PasswordHash`, lockout fields |
| `AspNetRoles` | Roles; the app uses one, `Admin` |
| `AspNetUserRoles` | Which users have which roles (`UserId`, `RoleId`) |
| `AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserTokens`, `AspNetRoleClaims` | Standard Identity tables; unused or used internally |

Passwords are stored only as hashes. Never copy `PasswordHash` values anywhere.

## Bookkeeping tables

| Table | Holds |
|---|---|
| `SchemaVersions` | DbUp's list of app schema scripts already run |
| `__EFMigrationsHistory`, `__EFMigrationsLock` | EF Core's list of sign-in migrations already run, and its lock |

## How data gets in

| Path | Writes |
|---|---|
| Startup import (DataImporter) | `Games`, `Tiles`, `GameTiles`, `ImportRuns`; merge mode only adds and fills empty counts |
| Submit a tile (Add) | `ChangeRequests` (Pending) |
| Approve an Add | `Tiles`, `GameTiles`, and the request (Approved), in one transaction |
| Edit tile (admin) | `ChangeRequests` with `BeforeJson`, then `Tiles` and the tile's `GameTiles`, in one transaction |
| Delete tile (admin) | `ChangeRequests` with `BeforeJson`, then `Tiles.IsDeleted = 1` |
| Edit game tiles (admin) | `GameTiles` for that game, and one `GameChanges` row, in one transaction |
| Register, sign in | `AspNetUsers` and related tables |

## Useful queries

Run these read-only against a copy of the database, or with the API stopped. Any SQLite tool works, for example DB Browser for SQLite.

A game's tiles with counts:

```sql
SELECT t.DisplayName, t.Color, gt.Count, gt.Notes
FROM GameTiles gt JOIN Tiles t ON t.Id = gt.TileId JOIN Games g ON g.Id = gt.GameId
WHERE g.Title = '1830' AND t.IsDeleted = 0
ORDER BY t.Color, t.Number;
```

Every version of a tile number, and how many games use each:

```sql
SELECT t.Id, t.DisplayName, t.Color, t.Source, COUNT(gt.GameId) AS Games
FROM Tiles t LEFT JOIN GameTiles gt ON gt.TileId = t.Id
WHERE t.Number = '57' AND t.IsDeleted = 0
GROUP BY t.Id;
```

Proposals waiting for review, oldest first:

```sql
SELECT cr.Id, cr.Type, json_extract(cr.ProposedJson, '$.number') AS Number, u.Email, cr.SubmittedUtc
FROM ChangeRequests cr LEFT JOIN AspNetUsers u ON u.Id = cr.SubmittedBy
WHERE cr.Status = 'Pending'
ORDER BY cr.Id;
```

Who changed what in the last 30 days:

```sql
SELECT cr.ReviewedUtc, u.Email, cr.Type, t.DisplayName
FROM ChangeRequests cr
LEFT JOIN AspNetUsers u ON u.Id = cr.ReviewedBy
LEFT JOIN Tiles t ON t.Id = cr.TileId
WHERE cr.Status = 'Approved' AND cr.ReviewedUtc >= strftime('%Y-%m-%dT%H:%M:%S', 'now', '-30 days')
ORDER BY cr.ReviewedUtc DESC;
```

Deleted tiles:

```sql
SELECT Id, DisplayName, UpdatedUtc FROM Tiles WHERE IsDeleted = 1 ORDER BY UpdatedUtc DESC;
```

Games with tiles whose count is unknown:

```sql
SELECT g.Title, COUNT(*) AS Unknown
FROM GameTiles gt JOIN Games g ON g.Id = gt.GameId JOIN Tiles t ON t.Id = gt.TileId
WHERE gt.Count IS NULL AND t.IsDeleted = 0
GROUP BY g.Id ORDER BY Unknown DESC;
```

Admins:

```sql
SELECT u.Email FROM AspNetUsers u
JOIN AspNetUserRoles ur ON ur.UserId = u.Id JOIN AspNetRoles r ON r.Id = ur.RoleId
WHERE r.Name = 'Admin';
```

## Rules for changing data by hand

- Prefer the app's screens. They validate input, keep the audit trail, and run in transactions.
- If you must use SQL: stop the API, work on a backup copy first, and never change `Tiles` rows without also recording why somewhere (History will not show it).
- Never insert a tile whose (`Number`, `Color`, `DefinitionCode`) already exists; the database refuses it.
- Never delete rows from `Tiles` or `ChangeRequests`; set `IsDeleted = 1` instead, so history keeps working.
- Schema changes go in a new numbered script (see the Runbook), never by hand.
