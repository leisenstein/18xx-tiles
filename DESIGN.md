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
| Auth | ASP.NET Core Identity with its EF Core store, used only for Identity tables (`AspNet*`). All app data uses Dapper. `Admin` role seeded at startup |
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
│   ├── Auth/                 (planned, Phase 3) Identity setup; EF Core DbContext for AspNet* tables only
│   ├── Controllers/          [ApiController] classes, *Controller: GamesController, HealthController, ...
│   ├── Data/                 Everything that touches the database
│   │   ├── SqliteConnectionFactory.cs
│   │   ├── Migrations/       DatabaseMigrator.cs (runs DbUp at startup)
│   │   │   └── Scripts/      DbUp SQL scripts, NNNN_VerbNoun.sql
│   │   ├── Repositories/     *Repository classes (Dapper): GamesRepository, ...
│   │   └── Seeding/          DataSeeder.cs (fills an empty database at startup)
│   │       ├── SeedFiles/    games.json, tiles.json (embedded; not in source control, see 6.4)
│   │       └── SeedModels/   SeedGame, SeedGameTile, SeedGenericTile (shapes of the seed JSON)
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
├── tools/import/             Import scripts and seed data generation (see section 6)
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

**Startup order (implemented).** Build the app, run `DatabaseMigrator.Upgrade`, then `DataSeeder.SeedIfEmpty`, then accept requests.

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
9. Counts: the prototype did not store per-game tile counts, and the current `games.json` does not contain them. `GameTiles.Count` is NULL for all seeded rows. To capture counts, update the parser: an integer count as given, `unlimited` as 999, anything else as NULL, with `Notes` set to "Count from 18xx.games manifest" so imported counts are distinguishable from counts verified against a physical box.

### 6.4 Import plan (implemented in Phase 1)

`reference/parse_games.py` and `reference/build_data.py` produce `games.json` and `tiles.json`. Copies live in `api/Data/Seeding/SeedFiles/` and are embedded in the API assembly as `Seed.games.json` and `Seed.tiles.json`.

**Source control.** `games.json` and `tiles.json` are excluded from git in both `reference/` and `api/Data/Seeding/SeedFiles/`, because they are regenerated as needed. A fresh clone must have them copied into `api/Data/Seeding/SeedFiles/` before the first run; otherwise the seeder stops with "Embedded seed file ... was not found" when the database is empty. The Docker build context must include them (do not exclude them in `.dockerignore`).

**Seeder rules (`api/Data/Seeding/DataSeeder.cs`):**

1. Runs at startup after DbUp, only when `Tiles` is empty. All inserts run in one transaction.
2. JSON is read strictly (missing required fields or nulls in non-nullable fields fail the startup).
3. Games are inserted in ordinal order of their module key. `SourceKey` = folder name. The snapshot's `stage` value is ignored.
4. Generic tiles from `tiles.json` are inserted with `Source = 'generic'`.
5. For each game's manifest entry:
   - Not custom: link to the generic tile with that number; if none exists, skip with a warning.
   - Custom: find or create a tile keyed by (number, color, sorted definition). A match with a generic tile links to it. A new tile gets `Source = 'game-version'` if the number exists in the generic set, otherwise `'game-specific'`.
6. Unknown colors fail the seed.
7. `HasCity` / `HasTown` = the definition has a part whose type (text before `=`) is `city` / `town`.
8. `SourceRef` = `18xx.games commit 46a592e40494368390c9a731978a577ac4ecb1e0`.
9. Display names follow section 7.

**Re-seeding in development.** The seeder never wipes data. To reset: stop the API, delete `data/tiles.db*` (including the `-wal` and `-shm` files), and start the API. Refreshing a database that holds user edits is a separate future feature (open item 5).

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
  ReviewNote      TEXT NULL
);
CREATE INDEX IX_ChangeRequests_Status ON ChangeRequests(Status);
```

**Allowed colors:** `yellow`, `green`, `brown`, `gray`, `greenbrown`, `browngray`, `brownsepia`, `none`, plus (added in 1.2, used by game-specific tiles) `red`, `blue`, `purple`, `white`, `orange`.

**Display names:**

- `#N` for a generic tile, and for any tile whose number has only one row.
- `#N (Game)` for a non-generic tile whose number has several rows and which is used by one game, for example `#10 (1825)`.
- `#N (variant k)` for a non-generic tile whose number has several rows and which is shared by several games; k counts from 1 per number in seeding order. 116 rows use this form.

Rules:
- Tiles holds only approved, live data. Pending work lives only in ChangeRequests.
- Admin changes also create a ChangeRequest, recorded as Approved by that admin, so every change has an audit row.
- The API sets `Status` from the caller's role. It never reads it from the request body.
- Delete is a soft delete (`IsDeleted = 1`).
- Unlimited count: define one named constant (`UnlimitedTileCount = 999`) in both the API and the frontend. Display it as "Unlimited", exclude it from count totals, and reject other counts above a sensible limit so a typo cannot be mistaken for it.
- Count and Notes changes go through the same ChangeRequest approval flow as other edits.
- Validate `Color` and `Type` in the API with explicit branches; reject unknown values.
- Enable WAL mode and foreign keys on each connection (`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`). Implemented in `SqliteConnectionFactory.Open()`.

## 8. API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check; reports SQLite journal mode and foreign-key setting |
| GET | `/api/games` | Public | Games with tile counts (for Home) |
| GET | `/api/games/{id}` | Public | One game |
| GET | `/api/tiles?game=&color=&kind=city\|town&q=&page=` | Public | Filtered tile list |
| GET | `/api/tiles/{id}` | Public | Tile detail, its games, other tiles with the same number (`{id:long}` constraint) |
| GET | `/api/tiles/common?minGames=10` | Public | Tiles used by at least `minGames` games (section 9.3) |
| POST | `/api/change-requests` | User | Propose Add, Edit, or Delete; applied immediately for Admin |
| GET | `/api/change-requests/mine` | User | My requests and their status |
| GET | `/api/admin/change-requests?status=Pending` | Admin | Review queue |
| POST | `/api/admin/change-requests/{id}/approve` | Admin | Apply in a transaction |
| POST | `/api/admin/change-requests/{id}/reject` | Admin | Reject with a note |
| | Identity endpoints | | Register, confirm email, login, logout, password reset (consider `MapIdentityApi`) |

Notes:
- Approval applies the change and updates the request in one transaction.
- On approve, re-check the `UNIQUE (Number, Color, DefinitionCode)` constraint and return a clear error on conflict.
- Use ASP.NET Core rate-limiting middleware on login, registration, and change-request routes.
- Validate definition strings on the server: known part types only (including `offboard`), edges 0 to 5, node references in range.
- Validate colors against the allowed list in section 7.
- **Tile sort order** (one shared helper, used by `/api/tiles` and `/api/tiles/common`): color group in the order yellow, green, brown, gray, then all other colors alphabetically; then the leading numeric part of `Number` ascending (numbers without a leading digit sort after numbered ones); then the remaining suffix (ordinal); then `Id`.
- Email confirmation needs an email-sending service (open item).
- The template's `/weatherforecast` endpoint has been removed; delete the unused `WeatherForecast` record at the end of `Program.cs`.

## 9. Frontend

### 9.1 Routes

| Route | Page |
|---|---|
| `/` | Home: game list with tile counts; each links to `/tiles?game={id}` |
| `/tiles` | Tile card grid with FilterBar; filters in URL (`game`, `color`, `kind`, `q`) |
| `/tiles/common` | Common Tiles: tiles used by at least N games (section 9.3); linked from Home and the main navigation |
| `/tiles/:id` | Detail: large drawing, number, color, definition string, games with counts and notes, other versions of the same number |
| `/submit` | Propose a new tile, with live drawing preview |
| `/tiles/:id/edit` | Propose an edit or deletion |
| `/account/requests` | My change requests |
| `/admin/queue` | Pending requests (shadcn/ui Table), approve or reject, before/after drawings |
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
| 2.7 | Tile detail page | #10 shows its games and its other versions | Not started |
| 2.8 | Common Tiles: `/api/tiles/common` and `/tiles/common` (section 9.3) | `minGames=10` returns 87 tiles; `minGames=1` and `abc` return 400 | Not started |

## 11a. Docker

- **One container.** ASP.NET Core serves the built Vite output from `wwwroot` plus the `/api` routes. One origin also keeps Identity cookie auth simple (no cross-origin setup).
- **Multi-stage Dockerfile:** (1) Node image runs `npm ci` and `npm run build` in /web; (2) .NET SDK image runs `dotnet publish` for /api; (3) ASP.NET runtime image copies the publish output and the web `dist` folder into `wwwroot`.
- **Seed files:** `api/Data/Seeding/SeedFiles/*.json` are not in source control but must be in the build context so they are embedded. Build from a working copy that has them.
- **Volume:** the SQLite file lives at `/data/tiles.db`, set by a connection-string environment variable (`ConnectionStrings__Tiles=Data Source=/data/tiles.db`). Without a volume, the database is lost when the container is replaced.
- **Data Protection keys:** persist them to `/data/keys`. Identity uses them for auth cookies, so keys kept only inside the container would log every user out on each restart or redeploy.
- **Single instance only.** Do not run multiple replicas against one SQLite file, and do not place the file on a network file system. SQLite's documentation warns that file locking can be unreliable on network file systems.
- **Startup order:** run DbUp scripts and EF Core migrations for the Identity tables, seed data, then seed the Admin role, before the app accepts requests.
- **Configuration and secrets** (email service, admin bootstrap account) come from environment variables or Docker secrets, never from the image.
- **Development:** run the API and `npm run dev` natively, with a Vite proxy to the API. Use Docker to check the production build and for deployment.

## 12. Open items

1. **Licensing:** confirm what may be published publicly for game titles and tile data.
2. **Email service:** choose a provider for confirmation and password-reset emails.
3. **Hosting:** choose a Docker host that supports persistent volumes; plan backups of the `/data` volume.
4. **Display names:** scheme defined in section 7; confirm it reads well in the UI during Phase 2.
5. **Import refresh:** decide whether to re-import when tobymao/18xx changes, and how to treat rows users have edited.
6. **Parser gaps:** Harzbahn 1873 manifest; 18Mag `L33`. Imported counts come from 18xx.games manifests and may not match every physical box.
7. **Tile counts:** update the parser to capture per-game counts (section 6.3 rule 9).
8. **Seed file distribution:** `games.json` and `tiles.json` are not in source control. Decide where the authoritative copies live (for example, regenerated by `tools/import`) so a fresh clone or a CI build can obtain them.
9. **Game metadata:** designer and publisher are not in the snapshot; extend the parser if they are wanted.
10. **Tile number circle samples:** `reference/tile_number_circles_sample.pdf` and `reference/tile_number_circles_train_styles.pdf` are referenced by section 9.4 but not yet in `reference/`.

## 13. Reference files

| File | Contents |
|---|---|
| `reference/parse_games.py` | Prototype game-manifest parser |
| `reference/build_data.py` | Combines generic tiles with game usage and versions |
| `reference/build_pdf.py` | Prototype tile renderer (`render_tile`) and PDF builder |
| `reference/games.json` | Parsed games snapshot (commit 46a592e). Not in source control |
| `reference/tiles.json` | Generic tiles with games and versions (commit 46a592e). Not in source control |
| `reference/TILES.md` | Copy of the tobymao/18xx tile language documentation |
| `reference/18xx_Generic_Tile_Reference.pdf` | Rendered reference from the planning session. Not in source control |
| `reference/tile_number_circles_sample.pdf` | Tile number circles, Plain city style (section 9.4). Not yet added |
| `reference/tile_number_circles_train_styles.pdf` | Tile number circles, Track ring and Crossing sign styles; driving wheel style rejected (section 9.4). Not yet added |
