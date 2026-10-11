# 18xx Tiles runbook

How to set up, run, update, and look after the 18xx Tiles app. For admins. The design and the reasons behind it are in `DESIGN.md`; this document is the how-to.

> Shown in the app at **Docs**, **Runbook** (admins only). The source is `docs/RUNBOOK.md` in the repository; edit it there, then rebuild the API. The
> database's tables and columns are described in **Docs**, **Database** (`docs/DATABASE.md`).

## Overview

| Part | What it is | Where | Address in development |
|---|---|---|---|
| API | ASP.NET Core (.NET 10) controllers, Dapper, SQLite | `api/` | https://localhost:7299 |
| Website | React 19, Vite 8, Tailwind 4, shadcn/ui | `web/` | http://localhost:5173 (Vite sends `/api` calls to the API) |
| Database | One SQLite file, plus the sign-in key folder | `data/tiles.db`, `data/keys/` (not in git) | |
| Data import | Python script that reads tobymao/18xx | `tools/import/update_data.py` | |
| Docker | One container: the API serves the built website | `Dockerfile`, `docker-compose.yml` | http://localhost:8080 |

At startup the API, in order:
1. creates or updates the app's tables (DbUp, `api/Data/Migrations/Scripts`);
2. imports the seed data if it is new (DataImporter);
3. creates or updates the sign-in tables (EF Core);
4. creates the Admin role and the first admin account.

## Prerequisites

| Tool | Version | Check with |
|---|---|---|
| .NET SDK | 10.0 (pinned in `global.json`) | `dotnet --version` |
| Node.js | 24 LTS | `node --version` |
| Python | 3.10 or later | `python --version` |
| Git | any recent | `git --version` |
| Docker Desktop | only for Docker runs | `docker --version` |

## First-time setup

Run these from the repository root unless a step says otherwise.

1. Trust the .NET development certificate (once per computer), so the browser and Vite accept https://localhost:7299:

```bash
dotnet dev-certs https --trust
```

2. Restore the .NET tools (the EF Core command line, used only for sign-in table migrations):

```bash
dotnet tool restore
```

3. Generate the seed data files. They are never stored in git; this downloads the pinned tobymao/18xx commit (about 14 MB, cached in `tools/import/.cache/`) and writes `api/Data/Seeding/SeedFiles/games.json`, `tiles.json`, and `source.json`:

```bash
python -I tools/import/update_data.py --pinned
```

4. Set the first admin account. These are stored in your user profile (user-secrets), never in the repository. Run in the `api` folder:

```bash
dotnet user-secrets set "Admin:Email" "you@example.com"
```

```bash
dotnet user-secrets set "Admin:Password" "a-strong-password"
```

5. Install the website's packages. Run in the `web` folder:

```bash
npm ci
```

6. Start the API (Visual Studio, or in the `api` folder):

```bash
dotnet run --launch-profile https
```

7. Start the website in a second terminal, in the `web` folder, then open http://localhost:5173:

```bash
npm run dev
```

The first start creates `data/tiles.db`, imports 131 games and about 2,000 tiles, and creates your admin account. Sign in with the email and password from step 4.

## Everyday development

| Task | Command | Where |
|---|---|---|
| Start the API | `dotnet run --launch-profile https` (or F5 in Visual Studio) | `api` |
| Start the website | `npm run dev` | `web` |
| Check the API is up | open https://localhost:7299/api/health | browser |
| Type-check and build the website | `npm run build` | `web` |
| Lint | `npm run lint` | `web` |
| Format all files | `npm run format` | `web` |
| Check formatting only | `npm run format:check` | `web` |
| Build the API | `dotnet build` | `api` |

Before committing, run lint and format:check in `web`, and `dotnet build` in `api`. Lines are at most 160 characters (`.editorconfig`, Prettier).

### Emails in development

There is no email provider yet. Registration confirmation and password-reset emails are written to the **API's console log** instead of being sent. To confirm a new account in development, copy the link from the API log and open it.

## Data: games and tiles from tobymao/18xx

The games, tiles, counts, designers, and publishers come from [tobymao/18xx](https://github.com/tobymao/18xx), the code behind 18xx.games. The app never stores their files in git; it pins one commit in `tools/import/18xx-commit.txt` and generates its seed files from that commit.

### Update to the latest upstream data

1. Download and parse the latest commit. The script prints what changed: games added or removed, tiles added or changed, and counts.

```bash
python -I tools/import/update_data.py
```

2. Review the summary. If you want to keep it, commit the updated pin (`tools/import/18xx-commit.txt`).
3. Rebuild and restart the API. On startup it applies the new data, then shows the result on **Imports** and **History**.

### Other ways to run the script

| Command | What it does |
|---|---|
| `python -I tools/import/update_data.py` | Latest commit on tobymao/18xx's default branch; updates the pin |
| `python -I tools/import/update_data.py --ref <commit, branch, or tag>` | A specific commit; updates the pin |
| `python -I tools/import/update_data.py --pinned` | The pinned commit, pin unchanged (fresh clone, Docker build) |
| `python -I tools/import/update_data.py --no-fetch` | Re-parse the commit already downloaded, no network |
| `python -I tools/import/update_data.py --out <folder>` | Write the files somewhere else (for a test) |

Always run it with `-I`, which stops Python from loading anything from the downloaded folder.

### What happens when the API imports

- **Empty database:** everything is imported ("seed").
- **Existing database:** the import only **adds and fills** ("merge"). It adds new games, tiles, and game links, and fills empty counts. It never overwrites or deletes anything edited in the app.
- **Each version of the data is imported once.** `source.json` carries a hash of the data, and the API skips data it has already applied.

### The import report

Open **Imports**. Each import lists what it added and notes about upstream changes it did not apply. Notes are grouped:

| Note | Meaning | What to do |
|---|---|---|
| Tile changed upstream (not applied) | The game's tile has a different definition upstream | If upstream is right, use **Edit tile** on that tile |
| Generic tile changed upstream | A standard numbered tile changed upstream | Edit the generic tile if wanted |
| Count differs from upstream | Someone set a different count in the app | Usually nothing; the app's count is kept |
| Deleted in the app | Upstream still has a tile that was deleted here | Nothing, unless the delete was a mistake |
| In the app but not upstream | A link exists here but not upstream (removed upstream, or added by an admin) | Remove it with **Edit game tiles** if it is wrong |
| Game no longer upstream | The game was removed upstream | The app keeps it |
| Designers and publishers updated | Filled or changed from upstream | Nothing |

## Database

`data/tiles.db` (in Docker: `/data/tiles.db` on the `tiles-data` volume). SQLite in WAL mode, so `tiles.db-wal` and `tiles.db-shm` sit next to it while the API runs; they belong to the database.

### Back up

Stop the API first, then copy all three files (`tiles.db`, `tiles.db-wal`, `tiles.db-shm`) and the `data/keys` folder somewhere safe. With the API stopped, the WAL is usually merged and only `tiles.db` remains.

### Restore

Stop the API, put the backed-up files back in `data/`, and start the API.

### Reset the development database

This deletes all users, changes, and history in development. Stop the API, then delete `data/tiles.db`, `data/tiles.db-wal`, and `data/tiles.db-shm`, and start the API. It rebuilds the database, imports the data, and recreates the admin from user-secrets.

### Change the schema

The schema baseline is `api/Data/Migrations/Scripts/0001_CreateSchema.sql`.

- **Never edit a released script.** Add a new numbered one: `0002_AddSomething.sql`, `0003_...`, and so on. DbUp runs each script once, in order, and records it in `SchemaVersions`.
- Scripts are embedded in the API, so rebuild after adding one.
- SQLite cannot drop constraints or most column changes in place; rebuild the table in the script (create new, copy, drop old, rename) when needed.

The sign-in tables (`AspNet*`) are managed by EF Core instead. Only if Identity's model changes, add a migration in the `api` folder:

```bash
dotnet ef migrations add DescribeTheChange --context AuthDbContext --output-dir Auth/Migrations
```

## Accounts and admins

- **First admin:** created at startup from `Admin:Email` and `Admin:Password` (user-secrets in development; `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` for Docker). It is only created if missing. Changing the password setting later does **not** change an existing account's password.
- **Other users:** register on the site, then confirm from the email (in development, the link in the API log).
- **Make another user an admin:** there is no screen for this yet. With the API stopped, run this SQL against `data/tiles.db` in any SQLite tool (for example DB Browser for SQLite), replacing the email:

```sql
INSERT INTO AspNetUserRoles (UserId, RoleId)
SELECT u.Id, r.Id FROM AspNetUsers u, AspNetRoles r
WHERE u.NormalizedEmail = UPPER('someone@example.com') AND r.Name = 'Admin';
```

- **Rate limits:** sign-in, registration, and other `/api/auth` calls allow 10 per minute per IP address; tile submissions allow 30 per hour per user. Over the limit returns 429; wait and try again.

## Admin tasks in the app

| Task | Where | Notes |
|---|---|---|
| Review proposed tiles | **Review** | Approve publishes the tile; Reject needs a note the submitter sees |
| Edit or delete a tile | the tile's page: **Edit tile**, **Delete tile** | Applied at once; recorded in History. Delete hides the tile but keeps it |
| Edit a game's tiles and counts | Tiles filtered to a game: **Edit this game's tiles** | Add, remove, set counts and notes; saved as one History entry |
| See every change | **History** | Filter by type (Add, Edit, Delete, Import, Game) and status; search by tile, email, game, or commit |
| See imports | **Imports** | What each import added, and notes to review |
| Print tile numbers | a tile or a game: **Print number circle(s)** | Any signed-in user; PDF sheet, SVG, or PNG |

## Docker

Docker builds generate the seed data themselves from the pinned commit, so the build needs internet access to github.com.

1. Create `.env` next to `docker-compose.yml` from `.env.example` and fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD`. It is not in git.
2. Build and start, then open http://localhost:8080:

```bash
docker compose up --build -d
```

| Task | Command |
|---|---|
| See the logs (and confirmation links) | `docker compose logs -f app` |
| Stop | `docker compose down` |
| Stop and **delete the database volume** | `docker compose down -v` |
| Update after code or data changes | `docker compose up --build -d` |

### Back up the Docker database

Stop the app (`docker compose down`, without `-v`), then copy the volume into a file in the current folder:

```bash
docker run --rm -v 18xx-tiles_tiles-data:/data -v "${PWD}:/backup" alpine tar czf /backup/tiles-data-backup.tgz -C /data .
```

The volume name is the folder name plus `_tiles-data`; check it with `docker volume ls`.

## Configuration reference

| Setting | Development | Docker (environment) | Default |
|---|---|---|---|
| Database | `ConnectionStrings:Tiles` in `appsettings.json` | `ConnectionStrings__Tiles` | `Data Source=../data/tiles.db` |
| Sign-in keys folder | `DataProtection:KeysPath` | `DataProtection__KeysPath` | `../data/keys` |
| First admin email | user-secret `Admin:Email` | `Admin__Email` (from `ADMIN_EMAIL` in `.env`) | none: no admin created |
| First admin password | user-secret `Admin:Password` | `Admin__Password` (from `ADMIN_PASSWORD`) | none |
| Environment | `Development` (launch profile) | `Production` | |

Keep `data/keys` private and backed up with the database. Losing it signs everyone out; anyone who has it could forge sign-in cookies.

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Website says "Failed to fetch" or cannot load games | The API is not running, or its certificate is not trusted | Start the API; run `dotnet dev-certs https --trust` |
| API stops at startup: "Embedded seed file ... was not found" | The seed files were never generated (fresh clone) | `python -I tools/import/update_data.py --pinned`, then rebuild |
| `dotnet build` fails: file locked by Tiles18xx.Api | The API is still running | Stop it, then build again |
| "No admin account was created" in the API log | `Admin:Email` or `Admin:Password` not set | Set the user-secrets (or `.env`), restart |
| Admin password not accepted | Password setting changed after the account was created | Use the old password, or reset the password through the site |
| Cannot confirm a new account in development | No email provider yet | Copy the confirmation link from the API log |
| 429 Too Many Requests | Rate limit | Wait a minute (sign-in) or an hour (submissions) |
| Import notes on **Imports** after an update | Upstream changed something edited here | See "The import report" above |
| Everyone signed out after a restart | `data/keys` was deleted or not on the Docker volume | Keep the keys folder; check `DataProtection__KeysPath` |

## Important files

| File or folder | What it is |
|---|---|
| `DESIGN.md` | Design, decisions, schema, API, and progress |
| `docs/RUNBOOK.md` | This runbook |
| `THIRD-PARTY-NOTICES.md` | Licenses of the data, fonts, and libraries |
| `tools/import/update_data.py` | Data import script |
| `tools/import/18xx-commit.txt` | The pinned tobymao/18xx commit |
| `api/Data/Migrations/Scripts/` | Database schema scripts (DbUp) |
| `api/Data/Seeding/DataImporter.cs` | Startup import (seed or merge) |
| `api/Auth/` | Sign-in: Identity, admin seeding, migrations |
| `api/Tiles18xx.Api.http` | Sample API requests for Visual Studio |
| `web/src/pages/` | One file per page |
| `branding/` | Logo SVGs |
