# 18xx Tile Reference App: Design Document

Version 1.2, October 8, 2026. Version 1.1 was prepared in a planning session in Claude chat; version 1.2 records decisions and findings from Phase 1 implementation. Review and verify before building from it.

### Changes in 1.2

- Toolchain verified and pinned: .NET 10 (LTS), Node 24 LTS, Vite 8, React 19, TypeScript 6.0, ESLint 10, Prettier (sections 4 and 5).
- Game-specific tiles (numbers not in the generic set) are now imported. Expected tile rows: 2,022, not 584 (sections 6 and 7).
- New `Tiles.Source` value `game-specific`; five additional tile colors; added index `IX_GameTiles_TileId` (section 7).
- Display-name scheme defined (section 7).
- Seed files `games.json` and `tiles.json`, and the reference PDF, are not kept in source control (sections 5, 6.4, 13).
- Renderer must also handle `offboard` parts, `track:thin`, and empty definitions (section 10).
- Phase 2 acceptance test corrected: 1830 does not use tile #10 (section 11).
- Phase 1 complete, including Docker; API fallback routing documented (sections 5 and 11).
- New feature: Common Tiles page (sections 8, 9.1, 9.3); shared tile sort order defined (section 8); Phase 2 step plan (section 11).
- `Games.DevStage` removed (script `0005_DropGamesDevStage.sql`): it was 18xx.games' status, not this project's (sections 6.1, 6.4, 7).
- API style switched from Minimal APIs to controllers (sections 4, 5.1, 5.2).
- Future feature on hold: printable tile number circles (sections 9.4, 11, 12, 13).
- Tile counts and import refresh (after Phase 4): `tools/import/update_data.py` downloads any tobymao/18xx commit and regenerates the seed files with
  per-game counts; the API's `DataImporter` applies a new commit once, adding new data and filling empty counts without overwriting app edits; import
  reports on `/admin/imports`; per-game physical tile totals (sections 5.1, 6.3, 6.4, 7, 9.1, 11, 12).
- Folder structure and naming conventions (sections 5.1 and 5.2). Database code consolidated under `api/Data/` (`Migrations`, `Repositories`, `Seeding`); seed models one type per file; database reset after the move.

## 1. Purpose

A public web app for browsing 18xx track tiles with pictures. Users can browse tiles by game, filter by color and by city or town, and propose new tiles or changes. User proposals need admin approval; admin changes apply immediately.

## 2. Working agreement for Claude Code

- The developer builds the app. Claude guides one step at a time and writes code only when asked.
- Start in Plan Mode. Do not edit files until the plan for a step is approved.
- Work one phase and one small step at a time. Each step ends with something the developer can run or check.
- Prefer explicit, defensive branching over a clever default (for example, an explicit error for an unknown color or change type).
- Verify against the actual current source before asserting a bug exists.
- Do not add unit-test projects yet.
- Keep explanations short. Give exact file paths and line locations for changes.

## 3. Assumptions

1. This is a personal project, separate from any employer systems.
2. Initial data comes from the open-source 18xx.games project (tobymao/18xx), as described in section 6.
3. Tile pictures are drawn from each tile's definition string. No image files are uploaded or stored.
4. "City vs town" is derived from the definition string (`city=` or `town=` parts).
5. One app server with a persistent disk hosts both the API and the SQLite file.

## 4. Decisions

| Area | Decision |
|---|---|
| Frontend build | Vite 8, `react-ts` template (create-vite 9) |
| Runtime | Node.js 24 LTS |
| UI | React 19 with TSX, Tailwind CSS, shadcn/ui, lucide-react |
| TypeScript | 6.0 as pinned by the template. Do not upgrade to 7.x yet: typescript-eslint supports TypeScript below 6.1 |
| Routing | React Router; filter state kept in URL search parameters |
| Data fetching | Built-in `fetch` |
| Tables | No grid library. Tailwind card grid for tiles; shadcn/ui Table for admin lists |
| Code quality | ESLint 10 (flat config: `@eslint/js`, typescript-eslint, react-hooks, react-refresh) and Prettier with `eslint-config-prettier`. Prettier style: single quotes, no semicolons. Scripts: `lint`, `format`, `format:check` |
| API | ASP.NET Core Web API on .NET 10 (current LTS, supported to November 2028; verified October 2026). Controller-based APIs (`[ApiController]`), chosen over Minimal APIs as developer preference. SDK pinned by `global.json` (`rollForward: latestFeature`) |
| Database | SQLite, single file, WAL mode |
| Data access | Dapper with `Microsoft.Data.Sqlite` |
| App schema changes | Versioned SQL scripts run by DbUp (`dbup-sqlite`), embedded in the API assembly |
| Auth | ASP.NET Core Identity with its EF Core store, used only for Identity tables (`AspNet*`). All app data uses Dapper. `Admin` role seeded at startup. Endpoints: built-in `MapIdentityApi` under `/api/auth` with cookie sign-in (framework-provided Minimal API endpoints; our own endpoints stay controllers). First admin account seeded at startup from secrets (user-secrets in development, environment variables in Docker), never stored in code or the image. Emails (confirmation, password reset) are written to the API log in development; a real provider is chosen in Phase 5 |
| Audience | Public. Email confirmation at registration, rate limiting on login and submissions |
| Tile versions | Separate tile rows (option A). The same number with a different definition is its own tile, linked to games through GameTiles |
| Changes | ChangeRequests table (Add, Edit, Delete). User requests wait for admin approval; admin requests apply immediately |
| Pictures | TSX component rendering inline SVG from the definition string |
| Tile counts | `GameTiles.Count` = tiles included in the box; NULL = unknown; 999 = unlimited; edition differences go in `GameTiles.Notes` |
| Containers | Runnable in Docker: one image (API serves the built React app), run with Docker Compose |
| Persistence in Docker | Named volume mounted at `/data` holding the SQLite file and Data Protection keys |

Rejected: EF Core for app data (developer preference for Dapper), Tabulator (not needed for about 2,000 tiles; added integration and styling work), Create React App (deprecated by the React team in February 2025), oxlint (create-vite's alternative linter; ESLint chosen to match the original plan).

## 5. Architecture

### 5.1 Folder structure

Folders marked (planned) are created in the step that first needs them.

```
18xx-tiles/
├── Tiles18xx.slnx            Solution file
├── global.json               Pins the .NET 10 SDK
├── DESIGN.md                 This document
├── Dockerfile                Multi-stage build: Node builds web, .NET SDK builds api, ASP.NET runtime runs both
├── docker-compose.yml        App service, named volume at /data, environment variables, port mapping
├── .dockerignore             Excludes node_modules, bin, obj, dist, local databases, reference, tools
│
├── api/                      ASP.NET Core Web API (project Tiles18xx.Api, root namespace Tiles18xx.Api)
│   ├── Program.cs            Startup: services, migrate, seed, middleware, MapControllers
│   ├── Tiles18xx.Api.http    Sample requests, one per endpoint
│   ├── Auth/                 Identity: AuthDbContext (AspNet* tables only), AdminSeeder, LogEmailSender, Migrations/ (EF Core, generated)
│   ├── Controllers/          [ApiController] classes, *Controller: GamesController, HealthController, ...
│   ├── Data/                 Everything that touches the database
│   │   ├── SqliteConnectionFactory.cs
│   │   ├── Migrations/       DatabaseMigrator.cs (runs DbUp at startup)
│   │   │   └── Scripts/      DbUp SQL scripts, NNNN_VerbNoun.sql
│   │   ├── Repositories/     *Repository classes (Dapper): GamesRepository, ...
│   │   └── Seeding/          DataImporter.cs (applies new seed files at startup: seed or merge, see 6.4)
│   │       ├── SeedFiles/    games.json, tiles.json, source.json (embedded; not in source control, see 6.4)
│   │       └── SeedModels/   SeedGame, SeedGameTile, SeedGenericTile, SeedSource (shapes of the seed JSON)
│   ├── Domain/               (planned, Step 2.2) Shared rules and constants: TileColors, TileSources,
│   │                         TileSort, TileCounts (UnlimitedTileCount = 999)
│   └── Dtos/                 API request and response shapes, *Dto
│
├── web/                      Vite React app
│   └── src/
│       ├── main.tsx          Entry point
│       ├── App.tsx           Routes and layout
│       ├── api/              (planned, Step 2.3) fetch wrappers per resource: games.ts, tiles.ts
│       ├── components/       Shared components: TileSvg, TileCard, FilterBar, ...
│       │   └── ui/           shadcn/ui generated components (do not hand-edit beyond styling)
│       ├── hooks/            (planned) Custom hooks: useX.ts
│       ├── lib/              (planned) Helpers and constants: utils.ts (shadcn), tileSort.ts, constants.ts
│       ├── pages/            One component per route: HomePage, TilesPage, TileDetailPage,
│       │                     CommonTilesPage, SubmitPage, AdminQueuePage, ...
│       └── types/            (planned) TypeScript types matching the API DTOs
│
├── tools/import/             update_data.py: downloads tobymao/18xx and regenerates the seed files (section 6.4);
│                             .cache/ holds the download (not in source control)
├── reference/                Prototype scripts from the planning session
└── data/                     Local development database (not in source control)
```

All database code lives under `Data/`: `Migrations` and `Seeding` build and fill the database at startup; `Repositories` read and write it while the app runs.

**DbUp script names.** DbUp records each script by its embedded resource name, which includes the folder path (`Tiles18xx.Api.Data.Migrations.Scripts.0001_CreateGames.sql`). Moving or renaming the `Scripts` folder makes DbUp try to run every script again. Before real user data exists, reset the database instead (delete `data/tiles.db*`, `docker compose down -v`). After that, give the scripts a fixed `LogicalName` in the `.csproj` before any move.

### 5.2 Naming conventions

**General**
- One public type per file; the file name matches the type name.
- Namespaces match folders: `Tiles18xx.Api.Data`, `Tiles18xx.Api.Data.Repositories`, `Tiles18xx.Api.Data.Seeding.SeedModels`, `Tiles18xx.Api.Dtos`, and so on.
- Prefer full words over abbreviations, except the established `Dto`, `Id`, `Api`, `Db`, `Utc`.

**API (C#)**

| Kind | Folder | Pattern | Example |
|---|---|---|---|
| Response and request shapes | `Dtos/` | `<Thing>Dto`; a list item may use `<Thing>SummaryDto` | `GameSummaryDto`, `TileDetailDto` |
| Database access | `Data/Repositories/` | `<PluralNoun>Repository` | `GamesRepository`, `TilesRepository` |
| API controllers | `Controllers/` | `<PluralNoun>Controller : ControllerBase`, with `[ApiController]` and an explicit `[Route("api/<plural-noun>")]`; dependencies by primary constructor; actions return `ActionResult<T>` | `GamesController` |
| Shared rules and constants | `Domain/` | Static class named for the concept | `TileColors.IsKnown(...)`, `TileCounts.Unlimited` |
| Seed JSON shapes | `Data/Seeding/SeedModels/` | `Seed<Thing>` | `SeedGame` |
| SQL scripts | `Data/Migrations/Scripts/` | `NNNN_VerbNoun.sql`, never renamed once run | `0005_AddTileNotesIndex.sql` |
| Types, methods, properties | | PascalCase | `GetById` |
| Locals and parameters | | camelCase | `gameId` |
| Private fields | | `_camelCase` | `_connectionString` |
| Constants | | PascalCase | `UnlimitedTileCount` |

**Database**
- Tables: plural PascalCase (`Games`, `GameTiles`). Columns: PascalCase (`DisplayName`, `CreatedUtc`).
- Keys: `Id`; foreign keys `<Table singular>Id` (`GameId`). Indexes: `IX_<Table>_<Columns>`.
- Timestamps: `<Verb>Utc`, stored as ISO 8601 text.

**API routes and JSON**
- Routes: lowercase, plural nouns, hyphens between words (`/api/change-requests`); IDs constrained (`{id:long}`).
- Query parameters and JSON properties: camelCase (`minGames`, `tileCount`). ASP.NET Core produces camelCase JSON by default.

**Web (TypeScript and React)**

| Kind | Folder | Pattern | Example |
|---|---|---|---|
| Pages | `pages/` | `<Name>Page.tsx` | `TileDetailPage.tsx` |
| Components | `components/` | PascalCase `.tsx` | `TileCard.tsx` |
| Hooks | `hooks/` | `use<Name>.ts` | `useTileFilters.ts` |
| API calls | `api/` | camelCase file per resource; functions `get<Thing>` | `games.ts` → `getGames()` |
| Types | `types/` | DTO name without `Dto` | `GameSummary` |
| Helpers and constants | `lib/` | camelCase file; `UPPER_SNAKE_CASE` constants | `UNLIMITED_TILE_COUNT` |
| URL routes | | lowercase, hyphens | `/tiles/common`, `/account/requests` |

**Git**
- Branches: `feature/<short-name>`, `fix/<short-name>`.
- Commit messages: imperative mood, short first line (`Add games endpoints`).

### 5.3 Runtime notes

Two schema tools share one SQLite file. EF Core migrations manage only the `AspNet*` tables. DbUp manages all other tables. Neither tool should touch the other's tables.

**Database location.** Connection string `ConnectionStrings:Tiles`, default `Data Source=../data/tiles.db` in `appsettings.json`. A relative path is resolved against the API content root, and the folder is created if missing. Docker overrides it with `/data/tiles.db`.

**Startup order (implemented).** Build the app, run `DatabaseMigrator.Upgrade`, then `DataImporter.Run` (section 6.4), then accept requests.

**Serving the React app (implemented).** `UseDefaultFiles` and `UseStaticFiles` serve the built app from `wwwroot`. Unknown `/api/...` routes return 404 (`MapFallback("/api/{**rest}", ...)`); every other unknown path returns `index.html` (`MapFallbackToFile`) so client-side routes work on refresh. In development `wwwroot` does not exist and Vite serves the app.

**Development ports.** API on `https://localhost:7299` only (one launch profile, `https`; no HTTP endpoint), using the trusted ASP.NET Core development certificate. Vite on `http://localhost:5173` with a proxy sending `/api` to the API (`secure: false`, because Node does not trust the Windows certificate store). `GET /api/health` reports `journalMode` and `foreignKeys`.

**HTTPS policy.** The API accepts HTTPS only. Outside development it also sends HSTS and redirects HTTP to HTTPS. In production, TLS is planned at a reverse proxy (Caddy, Phase 5) with the app container reachable only on Docker's internal network (no published port). Until then, `docker compose` serves plain HTTP on `localhost:8080` for local testing only.

## 6. Data source and import

### 6.1 Sources

| Data | Location in tobymao/18xx | Notes |
|---|---|---|
| Generic numbered tiles | `lib/engine/config/tile.rb` | Hashes YELLOW, GREEN, BROWN, GRAY, GREENBROWN, BROWNGRAY, BROWNSEPIA, NONE. Skip WHITE (blank, city, town are map hexes, not numbered tiles). Skip commented-out lines. File header says it was originally exported from 18xx-maker/export-rb |
| Definition language | `TILES.md` | "Tile language" and "Anatomy of a Flat Tile" sections |
| Per-game tile manifests | `lib/engine/game/g_*/` (`map.rb`, `game.rb`, `meta.rb`) | `TILES = { ... }` hashes; values are a count or a hash with `count`, `color`, `code` |
| Game metadata | `lib/engine/game/g_*/meta.rb` | `GAME_TITLE` (if absent, title is the module name without the leading `G`), `GAME_DESIGNER`, `GAME_PUBLISHER`. (`DEV_STAGE` is 18xx.games' own status and is not imported.) |

Snapshot used in planning: commit `46a592e40494368390c9a731978a577ac4ecb1e0` (October 7, 2026).

**License:** the repository LICENSE says the MIT License applies to the platform software and does not apply to rights associated with the game titles. Confirm what may be published on a public site before launch (open item, section 12).

### 6.2 Snapshot counts

From the planning session:

- 476 generic tiles: yellow 59, green 216, brown 146, gray 48, none 3, browngray 2, greenbrown 1, brownsepia 1.
- 311 generic tiles contain a city; 88 contain a town.
- 131 game folders with `meta.rb`; 128 had a parseable tile manifest (empty: 1873 Harzbahn, Rolling Stock, Rolling Stock Stars).

Found during Phase 1:

- `games.json` holds 2,152 custom tile entries. 1,952 of them (in 113 games) use numbers that are not in the generic set. The prototype's `tiles.json` left these out; the seeder now imports them.
- `games.json` has no designer, publisher, or count data. 11 games have stage `?`.

Seeded result (verified):

| Table | Rows |
|---|---|
| Games | 131 |
| Tiles | 2,022: 476 `generic`, 107 `game-version`, 1,439 `game-specific` |
| GameTiles | 7,235 |

Version 1.1 expected 584 tiles (476 + 108). The difference: game-specific tiles are now included, and sorted-part comparison merges one version pair (#82 green in 1825 and 18Ireland), giving 107 versions.

### 6.3 Parsing rules learned in the prototype

1. Module name: take the `module G...` line that is not `module Game`.
2. `GAME_TITLE` may contain escaped quotes (for example `Uncle Lachlan\'s ...`); unescape them.
3. Some games build their manifest in a method (`def game_tiles` with `tiles = { ... }`); parse those too.
4. Some games alias another game's manifest (`TILES = G1846::Map::TILES`) or inherit it (`class Game < G1824::Game`); copy the parent's tiles.
5. Also read other `*_TILES = { ... }` hashes in a game folder (for example 1825's unit tile sets), but only entries whose value is a count or a hash with `count` or `code`.
6. A game entry with no `code`, or with a code identical to the generic definition, uses the generic tile.
7. Compare definitions by splitting on `;`, trimming, and sorting the parts (ordinal), so part order does not create false versions. Caution: paths refer to nodes by position (`_0`, `_1`), so reordering city or town parts can change meaning, and sorting could in principle merge two different tiles. In the current snapshot sorting merges exactly two pairs (#780 brown, #82 green); both are path-only tiles and were verified as genuine duplicates. Recheck when the snapshot is refreshed.
8. Known gaps: Harzbahn 1873 declares tiles in a form the prototype did not parse. Rolling Stock and Rolling Stock Stars have no track tiles. Optional rules that add or remove tiles in code are not reflected. 18Mag refers to tile `L33`, which is not in the generic set; the seeder skips it with a warning.
9. Counts (implemented after Phase 4): an integer count from 1 to 100 as given, `unlimited` (string or symbol) as 999, anything else (constants, formulas) as NULL. Imported counts get `Notes` = "Count from 18xx.games manifest", so they can be told apart from counts verified against a physical box. At commit 46a592e: 7,235 links, 7,234 with a count (458 unlimited).
10. Process game folders in folder-name order, not full-path order: on Windows the backslash sorts after digits, which put `g_18_los_angeles1` before its parent `g_18_los_angeles` and left it with no tiles. Resolve inherited manifests repeatedly until nothing changes, so chains work in any order. Read each folder's `.rb` files in sorted order.

### 6.4 Import plan (Phase 1; refresh added after Phase 4)

**Generating the seed files.** `tools/import/update_data.py` (a cleaned-up merge of `reference/parse_games.py` and `reference/build_data.py`, plus counts) writes `games.json`, `tiles.json`, and `source.json` (repository, commit, commit time in UTC) to `api/Data/Seeding/SeedFiles/`. They are embedded in the API assembly as `Seed.games.json`, `Seed.tiles.json`, and `Seed.source.json`. Run it from the repo root:

- `python -I tools/import/update_data.py`: latest commit on the default branch.
- `python -I tools/import/update_data.py --ref <commit, branch, or tag>`: a specific commit.
- `python -I tools/import/update_data.py --no-fetch`: re-parse the commit already downloaded.

It downloads only `lib/engine/game/`, `lib/engine/config/tile.rb`, and `LICENSE` (a shallow, sparse git fetch, about 14 MB) into `tools/import/.cache/18xx`, and prints what changed compared with the previous seed files. `-I` keeps Python from loading code from the downloaded folder. Verified: at commit 46a592e the output equals the Phase 1 seed files except for the added counts (and a meaningless `aliased` flag on Rolling Stock Stars, which has no tiles).

**Applying changed data.** `source.json` includes `dataHash`, a SHA-256 of `games.json` and `tiles.json`. DataImporter skips a run only when `ImportRuns` already has that hash (script `0010_AddImportRunsDataHash.sql`), so a parser improvement for the same commit is applied by a merge. Merge also takes upstream designer and publisher (games are not editable in the app), with one summary note.

**Pinned commit.** Every run except `--pinned` writes the commit it used to `tools/import/18xx-commit.txt`, which is in source control. `--pinned` fetches that commit without changing it; the Docker build uses it.

**Refreshing.** Run the script, review its summary, commit `18xx-commit.txt`, then rebuild and restart the API (or rebuild the Docker image). The import report is on `/admin/imports`.

**Source control (decided after Phase 4).** The seed files always come from tobymao/18xx and are never stored in git (excluded in `api/Data/Seeding/SeedFiles/` and `reference/`); only the pinned commit is. A fresh clone runs `python -I tools/import/update_data.py --pinned` before the first local build; otherwise startup stops with "Embedded seed file ... was not found". Docker builds generate them (section 11a).

**Importer rules (`api/Data/Seeding/DataImporter.cs`):**

1. Runs at startup after DbUp. If `ImportRuns` already has the commit in `source.json`, it does nothing. Otherwise it runs in one transaction and records a row in `ImportRuns` (counts and notes).
2. **Seed mode** (`Tiles` is empty): inserts everything, as below.
3. **Merge mode** (existing data) only adds and fills; it never overwrites or deletes anything:
   - New games (matched by `SourceKey`) are added. A changed title is applied (games are not editable in the app) unless another game has that title.
   - Tiles are matched by (number, color, sorted definition). A game link to a tile the game does not have yet is added, creating the tile if needed (display name as in section 7; if taken, `#N (Game)` or the next free `#N (variant k)`).
   - Empty `GameTiles.Count` values are filled from the manifest (with the import note, if `Notes` is empty). Counts entered in the app are kept.
   - Reported in the import notes and not applied: a game's tile whose definition differs from the app's version; a generic tile whose definition changed; links to tiles deleted in the app; counts that differ; games and links in the app that are not upstream. An admin applies wanted changes with Edit tile.
2. JSON is read strictly (missing required fields or nulls in non-nullable fields fail the startup).
3. Games are inserted in ordinal order of their module key. `SourceKey` = folder name. The snapshot's `stage` value is ignored.
4. Generic tiles from `tiles.json` are inserted with `Source = 'generic'`.
5. For each game's manifest entry:
   - Not custom: link to the generic tile with that number; if none exists, skip with a warning.
   - Custom: find or create a tile keyed by (number, color, sorted definition). A match with a generic tile links to it. A new tile gets `Source = 'game-version'` if the number exists in the generic set, otherwise `'game-specific'`.
6. Unknown colors fail the seed.
7. `HasCity` / `HasTown` = the definition has a part whose type (text before `=`) is `city` / `town`.
8. `SourceRef` = `18xx.games commit <commit from source.json>`.
9. Display names follow section 7.

10. Counts: see section 6.3 rule 9. Counts outside the app's rules (`Domain/TileCounts`) are stored as NULL.

**Re-seeding in development.** The importer never wipes data. To reset: stop the API, delete `data/tiles.db*` (including the `-wal` and `-shm` files), and start the API.

Porting the parser to C# is optional later work.

## 7. Database schema (app tables, managed by DbUp)

User IDs are TEXT to match `AspNetUsers.Id`. Scripts: `api/Data/Migrations/Scripts/0001` to `0005`. The schema below is the result after all scripts (`0005_DropGamesDevStage.sql` removed `Games.DevStage`, which was 18xx.games' own implementation status and not relevant to this project).

```sql
CREATE TABLE Games (
  Id          INTEGER PRIMARY KEY,
  Title       TEXT NOT NULL UNIQUE,
  SourceKey   TEXT NOT NULL UNIQUE,      -- folder name, e.g. g_1830
  Designer    TEXT NULL,
  Publisher   TEXT NULL,
  CreatedUtc  TEXT NOT NULL
);

CREATE TABLE Tiles (
  Id              INTEGER PRIMARY KEY,
  Number          TEXT NOT NULL,          -- not unique: versions share numbers
  Color           TEXT NOT NULL,          -- see allowed colors below
  DefinitionCode  TEXT NOT NULL,          -- may be empty (blank tile)
  DisplayName     TEXT NOT NULL,          -- see display names below
  HasCity         INTEGER NOT NULL,       -- derived on save
  HasTown         INTEGER NOT NULL,       -- derived on save
  Source          TEXT NOT NULL,          -- 'generic', 'game-version', 'game-specific', 'user'
  SourceRef       TEXT NULL,              -- e.g. commit hash and file path
  IsDeleted       INTEGER NOT NULL DEFAULT 0,
  CreatedBy       TEXT NULL,
  CreatedUtc      TEXT NOT NULL,
  UpdatedUtc      TEXT NULL,
  UNIQUE (Number, Color, DefinitionCode)
);
CREATE INDEX IX_Tiles_Number ON Tiles(Number);
CREATE INDEX IX_Tiles_Color ON Tiles(Color);

CREATE TABLE GameTiles (
  GameId  INTEGER NOT NULL REFERENCES Games(Id),
  TileId  INTEGER NOT NULL REFERENCES Tiles(Id),
  Count   INTEGER NULL,                   -- tiles included in the box; NULL = unknown; 999 = unlimited
  Notes   TEXT NULL,                      -- e.g. different counts in other editions or printings
  PRIMARY KEY (GameId, TileId)
);
CREATE INDEX IX_GameTiles_TileId ON GameTiles(TileId);   -- added in 1.2: a tile's games by TileId

CREATE TABLE ChangeRequests (
  Id              INTEGER PRIMARY KEY,
  Type            TEXT NOT NULL,          -- 'Add', 'Edit', 'Delete'
  TileId          INTEGER NULL REFERENCES Tiles(Id),   -- NULL for Add
  ProposedJson    TEXT NULL,              -- number, color, definition, game links
  Status          TEXT NOT NULL,          -- 'Pending', 'Approved', 'Rejected'
  SubmittedBy     TEXT NOT NULL,
  SubmittedUtc    TEXT NOT NULL,
  ReviewedBy      TEXT NULL,
  ReviewedUtc     TEXT NULL,
  ReviewNote      TEXT NULL,
  Reason          TEXT NULL               -- added in Phase 4 (script 0006): the submitter's explanation
);
CREATE INDEX IX_ChangeRequests_Status ON ChangeRequests(Status);
CREATE INDEX IX_ChangeRequests_SubmittedBy ON ChangeRequests(SubmittedBy);   -- Phase 4: "my requests"
```

**Change request rules (implemented in Phase 4):**
- `ProposedJson` holds the proposed tile: `{ number, color, definitionCode, games: [{ gameId, count, notes }] }`. For an Edit, `games: null` keeps the tile's current game links; a list replaces them.
- For an Add, `TileId` is NULL while Pending and is set to the new tile's id when approved, so the audit row links to the tile.
- Tiles created by users get `Source = 'user'` and `CreatedBy` = the submitter. Display name: with a variant name (`TileContentDto.VariantName`, up to 40
  characters, no parentheses), `#N (name)`, falling back to `#N (name 2)` if that name was taken after submitting; without one, `#N` if no other live tile has
  that number, otherwise the first free `#N (variant k)`. An Edit keeps the display name unless the number changes or a variant name is given.
- While typing a number, the form calls `GET /api/change-requests/number-check?number=&exceptTileId=`, lists the live tiles and Pending requests that use
  it, explains that the tile becomes a variant, and offers a variant-name field with a preview of the final name. A variant name already used by another
  tile with that number is rejected with 400.
- Duplicates (same Number, Color, DefinitionCode, including deleted rows) are rejected when submitting and again when approving (409 with the conflicting tile named).
- Approving an Edit or Delete whose tile has since been deleted fails with a clear message; the admin rejects it instead.
- Counts: NULL (unknown), 1 to 100, or 999 (unlimited); anything else is rejected (`Domain/TileCounts`).

**Allowed colors:** `yellow`, `green`, `brown`, `gray`, `greenbrown`, `browngray`, `brownsepia`, `none`, plus (added in 1.2, used by game-specific tiles) `red`, `blue`, `purple`, `white`, `orange`.

**Display names:**

- `#N` for a generic tile, and for any tile whose number has only one row.
- `#N (Game)` for a non-generic tile whose number has several rows and which is used by one game, for example `#10 (1825)`.
- `#N (variant k)` for a non-generic tile whose number has several rows and which is shared by several games; k counts from 1 per number in seeding order. 116 rows use this form.

Rules:
- Tiles holds only approved, live data. Pending work lives only in ChangeRequests.
- Admin changes also create a ChangeRequest, recorded as Approved by that admin, so every change has an audit row.
- Audit trail: `Tiles.CreatedBy`/`CreatedUtc` (who added a user tile, when), `Tiles.UpdatedBy`/`UpdatedUtc` (last change and the admin who made or
  approved it), and per request `SubmittedBy`/`SubmittedUtc`, `ReviewedBy`/`ReviewedUtc`, `ProposedJson` (after) and `BeforeJson` (the tile with its games
  just before an approved Edit or Delete). Admins see it as a History section on the tile page, and across all tiles on `/admin/history`
  (`GET /api/admin/history`).
- Permissions (decided after Phase 4): any signed-in user may propose a **new** tile (Add), which waits for an admin. Only admins may **edit or delete**
  existing tiles (the API answers 403 to anyone else); their changes apply at once. Only admins approve or reject.
- The API sets `Status` from the caller's role. It never reads it from the request body.
- Delete is a soft delete (`IsDeleted = 1`).
- Unlimited count: define one named constant (`UnlimitedTileCount = 999`) in both the API and the frontend. Display it as "Unlimited", exclude it from count totals, and reject other counts above a sensible limit so a typo cannot be mistaken for it.
- Count and Notes changes go through the same ChangeRequest approval flow as other edits.
- Validate `Color` and `Type` in the API with explicit branches; reject unknown values.
- Enable WAL mode and foreign keys on each connection (`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`). Implemented in `SqliteConnectionFactory.Open()`.

**ImportRuns** (script `0008_CreateImportRuns.sql`, after Phase 4): one row per applied seed-file commit (section 6.4).

```sql
CREATE TABLE ImportRuns (
  Id            INTEGER PRIMARY KEY,
  SourceCommit  TEXT NOT NULL,            -- tobymao/18xx commit hash (UNIQUE dropped by script 0009)
  CommittedUtc  TEXT NULL,
  ImportedUtc   TEXT NOT NULL,
  Mode          TEXT NOT NULL,            -- 'seed' or 'merge'
  GamesAdded    INTEGER NOT NULL,
  TilesAdded    INTEGER NOT NULL,
  LinksAdded    INTEGER NOT NULL,
  CountsFilled  INTEGER NOT NULL,
  NotesJson     TEXT NOT NULL             -- [{ kind, message }]
);
```

Script `0009_RecordInitialImport.sql` rebuilds the table without `UNIQUE` (indexes on `SourceCommit` and `ImportedUtc`) and backfills a `seed` row for a database seeded before `ImportRuns` existed, from the imported tiles' `CreatedUtc` and `SourceRef` (note kind `backfilled`). DataImporter still applies each commit once.

## 8. API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check; reports SQLite journal mode and foreign-key setting |
| GET | `/api/games` | Public | Games with tile counts (for Home) |
| GET | `/api/games/{id}` | Public | One game |
| GET | `/api/tiles?game=&color=&kind=city\|town&q=&page=` | Public | Filtered tile list |
| GET | `/api/tiles/{id}` | Public | Tile detail, its games, other tiles with the same number (`{id:long}` constraint) |
| GET | `/api/tiles/common?minGames=10` | Public | Tiles used by at least `minGames` games (section 9.3) |
| POST | `/api/change-requests` | User (Add); Admin (Edit, Delete) | Propose a new tile (Pending for users); Edit and Delete are admin-only and apply at once |
| GET | `/api/change-requests/mine` | User | My requests and their status |
| GET | `/api/change-requests/number-check?number=&exceptTileId=` | User | Live tiles and Pending requests using a number; default display name |
| GET | `/api/admin/change-requests?status=Pending` | Admin | Review queue |
| POST | `/api/admin/change-requests/{id}/approve` | Admin | Apply in a transaction |
| POST | `/api/admin/change-requests/{id}/reject` | Admin | Reject with a note |
| | Identity endpoints | | Register, confirm email, login, logout, password reset (consider `MapIdentityApi`) |

Notes:
- Approval applies the change and updates the request in one transaction.
- On approve, re-check the `UNIQUE (Number, Color, DefinitionCode)` constraint and return a clear error on conflict.
- Use ASP.NET Core rate-limiting middleware on login, registration, and change-request routes.
- Validate definition strings on the server: known part types only (including `offboard`), edges 0 to 5, node references in range.
  Implemented in `Domain/TileDefinition.cs`. Known part types (all found in the imported data): nodes `city`, `town`, `junction`, `offboard`, `pass`,
  `halt`; others `path`, `label`, `frame`, `upgrade`, `icon`, `future_label`, `border`, `stripes`.
- Rate limits: "auth" (10 per minute per IP on `/api/auth/*`) and "submissions" (30 per hour per signed-in user on `POST /api/change-requests`).
- Submit returns 201 with the stored request (Pending, or Approved for an admin); 400 lists every problem; 409 for a duplicate. Approve/reject return 404
  for an unknown request and 409 when the request is not Pending, its tile is gone, or the result would duplicate a tile. Reject requires a note.
- Validate colors against the allowed list in section 7.
- **Tile sort order** (one shared helper, used by `/api/tiles` and `/api/tiles/common`): color group in the order yellow, green, brown, gray, then all other colors alphabetically; then the leading numeric part of `Number` ascending (numbers without a leading digit sort after numbered ones); then the remaining suffix (ordinal); then `Id`.
- Email confirmation needs an email-sending service (open item).
- The template's `/weatherforecast` endpoint has been removed; delete the unused `WeatherForecast` record at the end of `Program.cs`.

## 9. Frontend

### 9.1 Routes

| Route | Page |
|---|---|
| `/` | Home: game list with tile designs and physical tiles in the box (unlimited and unknown counts listed separately); each links to `/tiles?game={id}` |
| `/tiles` | Tile card grid with FilterBar; filters in URL (`game`, `color`, `kind`, `q`) |
| `/tiles/common` | Common Tiles: tiles used by at least N games (section 9.3); linked from Home and the main navigation |
| `/tiles/:id` | Detail: large drawing, number, color, definition string, games with counts and notes, other versions of the same number |
| `/submit` | Propose a new tile, with live drawing preview |
| `/tiles/:id/edit` | Edit or delete a tile (admins only; the tile page shows Edit and Delete buttons to admins) |
| `/account/requests` | My change requests |
| `/admin/queue` | Pending requests (shadcn/ui Table), approve or reject, before/after drawings |
| `/admin/history` | All change requests across all tiles and every data import (initial and later), newest first; filter by type (Add, Edit, Delete, Import) and status, search by tile number, email, or commit; paged (admins only) |
| `/admin/imports` | Import history: each applied tobymao/18xx commit, what it added, and notes on upstream changes not applied (admins only) |
| `/login`, `/register` | Auth |

### 9.2 Key components

- `TileSvg`: draws a tile from `definitionCode` and `color` (section 10).
- `TileCard`: drawing, display name, color, game count; tile count in the box when filtered by game.
- `FilterBar`: game select, color select, city/town toggle, number search; reads and writes URL search parameters.
- `RequireRole`: route guard for user and admin pages. The API still enforces permissions.

### 9.3 Common Tiles page (added in 1.2)

**Purpose:** show the tiles shared by many games, so players can see which tiles are common across 18xx titles.

**Behavior**
- Lists every live tile (`IsDeleted = 0`) used by at least N games, where the number of games is the count of distinct `GameTiles.GameId` rows for that tile.
- N defaults to 10 and can be changed on the page. It is stored in the URL (`/tiles/common?minGames=10`) so filtered views can be linked.
- Grouped by color, using the tile sort order in section 8 (yellow, green, brown, gray, then other colors; within a group, numeric part, then suffix).
- Each entry shows the drawing (`TileSvg`), display name, and number of games, and links to `/tiles/:id`.
- Per-game versions are included when they meet the threshold, since they are separate tiles.
- Page note: "Game counts include variants and scenarios as separate titles (for example the 1822 family), so the number of distinct published games may be lower."

**API:** `GET /api/tiles/common?minGames=10`. `minGames` must be an integer from 2 to 200; anything else returns 400 with a clear message. Query:

```sql
SELECT t.Id, t.Number, t.Color, t.DisplayName, t.DefinitionCode,
       COUNT(DISTINCT gt.GameId) AS GameCount
FROM Tiles t
JOIN GameTiles gt ON gt.TileId = t.Id
WHERE t.IsDeleted = 0
GROUP BY t.Id
HAVING COUNT(DISTINCT gt.GameId) >= @MinGames;
```

Sorting is done in the API with the shared sort helper.

**Expected result** with the initial import (commit 46a592e), `minGames = 10` (verified against the seeded database): 87 tiles, made up of 86 generic tiles (yellow 19, green 39, brown 26, gray 2) and 1 per-game version, `#169 (variant 1)` (gray, 10 games).

### 9.4 Future feature: Printable tile number circles (on hold)

**Status:** on hold until per-game tile counts exist (phase "Later", section 11). Not part of Phases 2 to 5.

**Image.** The user picks one of three styles. All share a centered white "city" circle with a black outline and the tile number in bold black.
- **Track ring:** outer circle in the tile's color with a circle of rails and ties around the city circle (city about 58% of the outer diameter).
- **Crossing sign:** outer circle in the tile's color with a black border, a black X, and the letters "R R" (city about 42% of the outer diameter).
- **Plain city:** outer circle in the tile's color with a thin gray outline (city about 68% of the outer diameter).
- Two-color tiles: the outer circle is split into halves, matching the main renderer.
- Text size scales down to fit long numbers ("1168", "298LA").

**Sizes.** Diameter of 1/4, 1/2, 3/4, or 1 inch. Track ring and Crossing sign are offered at 1/2 inch and above; 1/4 inch offers Plain city only. PNG output is 300 DPI.

**Selection.** A single tile from the detail page, or all tiles for a game from the filtered tile list. Quantity per tile comes from `GameTiles.Count`; when Count is NULL or 999, the user enters the quantity.

**Output.** SVG or PNG for one image. A PDF print sheet where the user sets diameter, margins, and spacing, with an optional cut line and bleed; circles are laid out in rows and columns to match label stock.

**Look.** See `reference/tile_number_circles_sample.pdf` (Plain city) and `reference/tile_number_circles_train_styles.pdf` (Track ring and Crossing sign). The driving wheel style in the second PDF was rejected.

**Notes for when work starts**
- Reuse the tile color fills and two-color split from `TileSvg` (section 10) so colors match.
- Decide where PDF and PNG generation runs (browser or API) and which library to use.
- The `none` color and the five game-specific colors (section 7) need a defined outer-circle appearance.

## 10. Tile renderer specification

Port from `reference/build_pdf.py` (`render_tile`). Behavior to keep:

- **Orientation:** flat-topped hex. Edges per TILES.md: 0 bottom, 1 lower-left, 2 upper-left, 3 top, 4 upper-right, 5 lower-right. Edge angle = -90 - 60 x edge degrees.
- **Parts:** `city` (slots 0 to 4, revenue), `town` (revenue), `offboard` (revenue, groups; added in 1.2), `junction` (Lawson center), `pass`, `path` (a, b, terminal, track: broad, narrow, dual, thin), `label`, `frame` (color), `upgrade` (cost), `icon` (image name shown as text), `future_label`.
- **Revenue:** phase lists like `#cb7743_50|brown_60` or `yellow_30|green_40` show as `50/60` and `30/40`.
- **Node placement** (the definition language leaves this to the renderer):
  - `loc:center` at center; integer `loc` toward that edge; `x.5` `loc` toward that corner.
  - A town with exactly two edge paths sits on the curve between those edges, drawn as a bar across the track.
  - A single city or town with no `loc` sits at center.
  - Otherwise, a node sits toward the average direction of its connected edges.
  - Unconnected nodes are spread opposite the placed ones.
- **Track:** edge-to-edge paths are cubic curves with control points pulled toward center; edge-to-node paths curve into the node; node-to-node paths are straight.
- **Track styles** (document convention, not publisher art): broad = solid black; narrow = thinner dashed black; dual = black with a white dashed center line; thin = treat as narrow until a distinct style is chosen.
- **Colors:** light fills for printing; two-color sections split into left and right halves; `none` uses a dashed outline. Provide fills for `red`, `blue`, `purple`, `white`, and `orange`. An empty definition draws a blank hex.
- **Revenue circles and labels:** pick the candidate position with the most clearance from track and nodes, kept inside the hex.
- **Unknown part types:** render nothing for the part and show a small warning marker, rather than failing the whole tile.

**Implementation (Step 2.5).** `web/src/lib/tiles/` holds `colors.ts` (fills, including red, blue, purple, orange), `parse.ts` (definition parser, revenue text), and `drawing.ts` (`buildTileDrawing`: geometry as a list of shapes, computed y-up like the prototype and flipped for SVG). `web/src/components/TileSvg.tsx` renders the shapes. `/dev/tiles` (development builds only) shows 24 sample tiles covering every feature. Differences from the prototype:
- The tile-number corner is reserved before labels are placed, so labels never cover the number.
- `offboard` nodes draw as a small black triangle under their revenue (the prototype drew nothing).
- `slots:0` draws as one slot.
- Revenue text takes only each phase's trailing digits, so color codes such as `#cb7743` are not read as numbers.
- Unknown part types are skipped silently; the warning marker is not implemented yet.
- Known limitation: long extra text (for example "future X (brown)") can crowd labels.

## 11. Phases

| Phase | Scope | Done when |
|---|---|---|
| 1 | Solution scaffolding (API + Vite app), DbUp scripts, seeder loading `games.json` and `tiles.json`, Dockerfile and docker-compose.yml | Database has 131 games, 2,022 tiles, 7,235 game-tile links; spot-check #10 (generic, "#10 (1825)", "#10 (1829)"); `docker compose up` runs the app and data survives a container restart |
| 2 | Read-only API and pages: Home, `/tiles` with filters, tile detail, `TileSvg` | Filtering by 1830 shows its 46 tiles, including the generic #59 and no #10; filtering by 1825 shows "#10 (1825)" and not the generic #10 |
| 3 | Identity, Admin role seed, login and registration, email confirmation, rate limiting | Admin and regular user can sign in; admin routes refuse regular users |
| 4 | Change requests: submit, my requests, admin queue, approve and reject | User request stays Pending until approved; admin request applies immediately |
| 5 | Polish and launch prep: styling, licensing check, hosting, backups | Open items in section 12 resolved |
| Later | Per-game tile counts shown and edited in the UI (schema supports them; parser must be updated to capture them, see 6.3 rule 9) | Counts display per game; 999 shows as "Unlimited" |
| Later | Printable tile number circles (section 9.4); depends on per-game counts | One tile exports as SVG and PNG; a game's tiles print on a PDF sheet with the chosen layout |

### Phase 1 progress

| Step | Scope | Status |
|---|---|---|
| 1.1 | .NET 10 SDK, repository, folders, `global.json`, `.gitignore` | Done |
| 1.2 | Reference files in `reference/` | Done |
| 1.3 | API project `Tiles18xx.Api` in `Tiles18xx.slnx` | Done |
| 1.4 | Vite React app, ESLint and Prettier, Vite proxy, `/api/health` | Done |
| 1.5 | SQLite connection factory, DbUp, schema scripts 0001 to 0004 | Done |
| 1.6 | Data seeder | Done |
| 1.7 | Dockerfile, docker-compose.yml, .dockerignore | Done. Verified: app on port 8080, data survives `docker compose down` and `up` |

### Phase 2 plan

| Step | Scope | Check | Status |
|---|---|---|---|
| 2.1 | Games API: `/api/games`, `/api/games/{id}` (`GamesController`); `/api/health` moved to `HealthController` | 131 games; 1830 has 46 tiles; unknown id returns 404 | Done (verified) |
| 2.2 | Tiles API: `/api/tiles` (filters, paging), `/api/tiles/{id}`, shared sort helper (`Domain/TileSort`, `Domain/TileColors`) | 1830: 46 tiles incl. #59, no #10; 1825 has "#10 (1825)"; bad input returns 400; tile 60 lists its two other versions | Done (verified) |
| 2.3 | Frontend setup: Tailwind, shadcn/ui, React Router, layout and navigation | Navigation between empty pages works | Done (verified): Tailwind 4, shadcn/ui (radix, nova), React Router 8, `@` alias via `paths` (no `baseUrl` in TypeScript 6) |
| 2.4 | Home page (game list) | 131 games, each linking to its tiles | Done (verified) |
| 2.5 | `TileSvg` renderer | #10, #59, and sample game-specific tiles draw correctly | Done (verified on `/dev/tiles`, 24 sample tiles) |
| 2.6 | Tiles page: `FilterBar`, `TileCard` | 1830 shows 46 tiles including #59 | Done (verified): filters in URL via `useTileFilters`; bad URL values ignored; shadcn `input` and `native-select` |
| 2.7 | Tile detail page | #10 shows its games and its other versions | Done (verified): generic #10 shows 0 games and versions "#10 (1825)", "#10 (1829)"; #59 lists 15 games linking to `/tiles?game=`; unknown or non-numeric id shows "Tile not found" (`ApiError.status` 404) |
| 2.8 | Common Tiles: `/api/tiles/common` and `/tiles/common` (section 9.3) | `minGames=10` returns 87 tiles; `minGames=1` and `abc` return 400 | Done (verified): 87 tiles (yellow 19, green 39, brown 26, gray 3 incl. `#169 (variant 1)`); 400 for 1, 201, abc; page validates input before calling the API |

**Phase 2 complete.** Shared frontend helpers added along the way: `ApiError` (status on failed requests) in `api/client.ts`, `countText` in `lib/tileCount.ts`, `TILE_COLORS` in `lib/tiles/colors.ts`.

### Phase 3 progress

| Step | Scope | Status |
|---|---|---|
| 3.1 | Packages (Identity EF Core store, EF Core SQLite, EF Core Design) and the `dotnet-ef` local tool (`dotnet-tools.json`) | Done |
| 3.2 | Identity setup in `Program.cs` (A4): `AuthDbContext`, `AddIdentityApiEndpoints` with roles, confirmed email required, unique email, 10-character passwords; cookie Secure + SameSite=Strict (+ HttpOnly); Data Protection keys on disk | Done |
| 3.3 | EF Core migration `CreateIdentitySchema` in `api/Auth/Migrations`, applied at startup after DbUp | Done (7 AspNet* tables; app data untouched) |
| 3.4 | `LogEmailSender`: emails written to the log (links HTML-decoded) | Done |
| 3.5 | `AdminSeeder`: Admin role and first admin from `Admin:Email` / `Admin:Password` (user-secrets in development) | Done |
| 3.6 | `MapIdentityApi` under `/api/auth`; `AccountController` (`GET /api/account/me`, `POST /api/account/logout`); `AdminController` (`GET /api/admin/ping`, Admin role) | Done (verified: regular user 403, admin 200) |
| 3.7 | Rate limiting: policy "auth", 10 requests per minute per IP on `/api/auth/*` | Done (verified: 11th request 429) |
| 3.8 | Frontend: `api/client.ts` (POST, problem details), `api/auth.ts`, `types/account.ts`, `AuthProvider` + `useAuth` (`lib/authContext.ts`), Login and Register pages, header sign-in area; Vite proxy `changeOrigin: true` so confirmation links point to the API | Done |
| 3.9 | `RequireRole` route guard, `/admin/queue` placeholder (`AdminQueuePage`), Admin link for admins | Done (verified: signed out → /login?returnTo, regular user "Not allowed", admin sees page) |
| 3.10 | Docker: `DataProtection__KeysPath=/data/keys`, `Admin__Email` / `Admin__Password` from `.env` (not in git or the image; template `.env.example`) | Done (verified: sign-in cookie survives container recreation) |

**Phase 3 complete.** Notes for later phases:
- The emailed confirmation link opens the API's built-in `/api/auth/confirmEmail`, which shows plain text. A friendlier React confirmation page can be added with the real email provider (Phase 5).
- Behind a reverse proxy (Phase 5), configure forwarded headers so rate limiting sees each visitor's IP and links use the public `https` address.
- Registering an email that already exists returns Identity's "already taken" message, which reveals that the account exists. Acceptable for now; revisit before launch.

### Phase 4 progress

| Step | Scope | Status |
|---|---|---|
| 4.1 | Schema: `ChangeRequests.Reason` and `IX_ChangeRequests_SubmittedBy` (script `0006_AddChangeRequestReason.sql`) | Done |
| 4.2 | Rules: `Domain/ChangeRequestTypes`, `ChangeRequestStatuses`, `TileCounts`, `TileDefinition` (validation, HasCity/HasTown) | Done |
| 4.3 | `ChangeRequestsRepository` (create, read with submitter/reviewer emails, approve in one transaction, reject); `ReviewResult` | Done |
| 4.4 | `ChangeRequestsController` (submit with "submissions" rate limit, mine); `AdminController` (queue, approve, reject) | Done (verified: validation, 409 duplicates, admin auto-apply, stale edit refused, 403 for non-admins) |
| 4.5 | Frontend: `TileForm` (fields, live drawing, games with counts, reason), `TileChange` (before/after), `StatusBadge`, `RequestOutcome`; pages `/submit`, `/tiles/:id/edit`, `/account/requests`, `/admin/queue`; header links; "Propose a change" on tile pages | Done (verified in the browser end to end) |
| 4.6 | Variant names and number check; definition guide (`DefinitionGuide`: edge diagram, parts table, 12 examples with "Use this example") | Done (verified) |
| 4.7 | Edit and delete restricted to admins (API 403 for others; admin-only `/tiles/:id/edit`; `AdminTileActions` with Edit and Delete on the tile page) | Done (verified) |
| 4.8 | Audit trail and history: script `0007_AddAuditColumns.sql` (`ChangeRequests.BeforeJson`, `Tiles.UpdatedBy`, index on `TileId`); before-snapshot on every approved Edit/Delete; `GET /api/admin/tiles/{id}/history`; admin-only History section on the tile page | Done (verified) |
| 4.9 | Tile counts and import refresh: `tools/import/update_data.py`; `DataImporter` (seed or merge, once per commit) replaces `DataSeeder`; script `0008_CreateImportRuns.sql`; `GET /api/admin/imports` and `/admin/imports`; per-game totals in `GameSummaryDto` (physical, unlimited, unknown), shown on Home and the game-filtered Tiles page | Done (verified: merge filled 7,234 counts on a copy of the dev database; restart skipped; scenario test produced each kind of note; fresh seed equals the existing data) |
| 4.10 | Admin History page: `GET /api/admin/history` (type, status, search, paging; `ChangeHistoryQueryDto`); `/admin/history` with filters in the URL; shared `ChangeRequestEntry` component (also used by the tile page's History section) | Done (verified: filters, search, validation, 401 when signed out, browser) |
| 4.11 | Fixes: Delete tile uses an on-page confirmation panel instead of `window.prompt()` (which some browsers block, so the button did nothing); imports in History (`HistoryRepository` UNION of change requests and imports, `HistoryEntryDto`, type `Import`; script `0009` backfills the first import) | Done (verified: UI delete, merged timeline, filters, fresh and existing databases) |
| 4.12 | Open items 8, 9, 12: pinned commit and Docker seed stage; designer and publisher (parser, script `0010` data hash, Home and Tiles pages); renderer `halt`, `border`, `stripes` | Done (verified: Docker data identical to local; re-import on an existing database filled 130 designers; fresh seed; drawings on `/dev/tiles`) |

**Phase 4 complete.**

## 11a. Docker

- **One container.** ASP.NET Core serves the built Vite output from `wwwroot` plus the `/api` routes. One origin also keeps Identity cookie auth simple (no cross-origin setup).
- **Multi-stage Dockerfile:** (1) Node image runs `npm ci` and `npm run build` in /web; (2) Python image with git runs `tools/import/update_data.py --pinned` to generate the seed files; (3) .NET SDK image copies them into `api/Data/Seeding/SeedFiles/` and runs `dotnet publish` for /api; (4) ASP.NET runtime image copies the publish output and the web `dist` folder into `wwwroot`.
- **Seed files:** never in source control or the build context (`.dockerignore` excludes local copies). Stage 2 generates them from the commit pinned in `tools/import/18xx-commit.txt`, so the build needs internet access to github.com. Verified: the files generated in Docker are byte-for-byte identical to those generated on Windows.
- **Volume:** the SQLite file lives at `/data/tiles.db`, set by a connection-string environment variable (`ConnectionStrings__Tiles=Data Source=/data/tiles.db`). Without a volume, the database is lost when the container is replaced.
- **Data Protection keys:** persist them to `/data/keys` (implemented: `DataProtection__KeysPath` in `docker-compose.yml`). Identity uses them for auth cookies, so keys kept only inside the container would log every user out on each restart or redeploy.
- **Single instance only.** Do not run multiple replicas against one SQLite file, and do not place the file on a network file system. SQLite's documentation warns that file locking can be unreliable on network file systems.
- **Startup order:** run DbUp scripts and EF Core migrations for the Identity tables, seed data, then seed the Admin role, before the app accepts requests.
- **Configuration and secrets** (email service, admin bootstrap account) come from environment variables or Docker secrets, never from the image. Implemented: `docker-compose.yml` reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from a `.env` file next to it, which is excluded by `.gitignore` and `.dockerignore`; `.env.example` lists the required names.
- **Development:** run the API and `npm run dev` natively, with a Vite proxy to the API. Use Docker to check the production build and for deployment.

## 12. Open items

1. **Licensing:** confirm what may be published publicly for game titles and tile data.
2. **Email service:** choose a provider for confirmation and password-reset emails. Until then, development writes emails to the API log (Phase 3 decision).
3. **Hosting:** choose a Docker host that supports persistent volumes; plan backups of the `/data` volume.
4. **Display names:** scheme defined in section 7; confirm it reads well in the UI during Phase 2.
5. ~~**Import refresh**~~ Resolved after Phase 4: merge import that only adds and fills, with a report (section 6.4).
6. **Parser gaps:** Harzbahn 1873 manifest; 18Mag `L33`. Imported counts come from 18xx.games manifests and may not match every physical box.
7. ~~**Tile counts**~~ Resolved after Phase 4 (section 6.3 rule 9).
8. ~~**Seed file distribution**~~ Resolved after Phase 4: never stored in git; generated from tobymao/18xx for the commit pinned in `tools/import/18xx-commit.txt`, by the developer locally and by Docker stage 2 (sections 6.4, 11a).
9. ~~**Game metadata**~~ Resolved after Phase 4: designer and publisher from each game's `meta.rb` (inherited from the parent game's Meta module when not set), publisher names from `lib/engine/publisher.rb`. 130 of 131 games have a designer and 89 a publisher at commit 46a592e. Shown on Home and the game-filtered Tiles page.
10. **Tile number circle samples:** `reference/tile_number_circles_sample.pdf` and `reference/tile_number_circles_train_styles.pdf` are referenced by section 9.4 but not yet in `reference/`.
11. **Broken imported definitions (found in Phase 4):** 93 game-specific tiles contain unexpanded Ruby placeholders from the prototype parser
    (for example `#{TILE_O_O}`, `#{Engine::Config::Tile::YELLOW['3']}`), and 9 path ends use edges outside 0 to 5. Fix them through change
    requests (the validator rejects these forms, so a corrected edit is required), or fix the parser and re-import.
12. ~~**Renderer gaps**~~ Resolved after Phase 4: `halt` is a node (fixes node numbering) drawn as a white circle with its symbol; `border` paints the
    edge in the tile color (typed borders: colored line and cost); `stripes` draws diagonal bands clipped to the hex. Samples added to `/dev/tiles`.
13. **Pre-release reset (decided after Phase 4; do last, before the first production release):** until then, schema changes keep adding numbered
    DbUp scripts as usual. At the end of development:
    1. Fix the parser (item 11), regenerate the seed files, and check them.
    2. Replace DbUp scripts `0001` to `00NN` with one baseline script, `0001_CreateSchema.sql`, holding the final schema (no ALTERs, no backfills such
       as `0009`). Also keep a single EF Core Identity migration (regenerate it if more were added).
    3. Delete `data/tiles.db*` (and `docker compose down -v`) and start the API: a clean database, seeded by DataImporter with counts.
    After the first production release, every schema change is a new numbered script on top of the baseline; never edit or renumber released scripts.

## 13. Reference files

| File | Contents |
|---|---|
| `tools/import/18xx-commit.txt` | The pinned tobymao/18xx commit the seed files are generated from (in source control) |
| `tools/import/update_data.py` | Downloads tobymao/18xx and regenerates the seed files, with counts (section 6.4). Replaces the two prototype scripts below |
| `reference/parse_games.py` | Prototype game-manifest parser |
| `reference/build_data.py` | Combines generic tiles with game usage and versions |
| `reference/build_pdf.py` | Prototype tile renderer (`render_tile`) and PDF builder |
| `reference/games.json` | Parsed games snapshot (commit 46a592e). Not in source control |
| `reference/tiles.json` | Generic tiles with games and versions (commit 46a592e). Not in source control |
| `reference/TILES.md` | Copy of the tobymao/18xx tile language documentation |
| `reference/18xx_Generic_Tile_Reference.pdf` | Rendered reference from the planning session. Not in source control |
| `reference/tile_number_circles_sample.pdf` | Tile number circles, Plain city style (section 9.4). Not yet added |
| `reference/tile_number_circles_train_styles.pdf` | Tile number circles, Track ring and Crossing sign styles; driving wheel style rejected (section 9.4). Not yet added |
