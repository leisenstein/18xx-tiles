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

## Developer setup

What a developer needs beyond the first-time setup above.

### Editors

| Editor | Use it for | Add |
|---|---|---|
| Visual Studio, with the "ASP.NET and web development" workload | The API (`Tiles18xx.slnx`), debugging, `api/Tiles18xx.Api.http` requests | nothing else needed |
| Visual Studio Code | The website (`web/`) | the ESLint, Prettier, and Tailwind CSS IntelliSense extensions; set Prettier as the formatter and turn on format on save |

Either editor can open the whole repository. Line endings are handled by Git; if Prettier reports formatting problems on files saved in Visual Studio, run `npm run format` in `web`.

### How the code is organized

| Folder | Contents |
|---|---|
| `api/Controllers/` | One `*Controller` class per area (`[ApiController]`). Admin-only routes are in `AdminController` |
| `api/Data/Repositories/` | Database access with Dapper, one `*Repository` per area |
| `api/Data/Migrations/Scripts/` | DbUp schema scripts, `NNNN_VerbNoun.sql` |
| `api/Data/Seeding/` | The startup import (`DataImporter`) and the shapes of the seed files |
| `api/Data/Backups/` | Nightly snapshots (`DatabaseBackupService`) and their settings (`BackupSettings`) |
| `api/Domain/` | Shared rules: tile colors, sort order, counts, definition validation |
| `api/Dtos/` | Request and response shapes, named `*Dto` |
| `api/Auth/` | Sign-in: Identity, admin seeding, email senders, EF Core migrations |
| `web/src/pages/` | One `*Page.tsx` per route (routes are in `App.tsx`) |
| `web/src/components/` | Shared components; `ui/` holds shadcn/ui components |
| `web/src/api/` | Calls to the API, one file per area |
| `web/src/lib/` | Helpers: tile drawing (`tiles/`), number circles (`circles/`), constants |
| `web/src/types/` | TypeScript types matching the API's DTOs |

### Conventions

- One type per file. Names: `*Controller`, `*Repository`, `*Dto` in the API; `*Page.tsx` for pages in the website.
- Lines are at most 160 characters (`.editorconfig` and Prettier: single quotes, no semicolons).
- Each file starts with a comment saying what it is for, and comments explain why, not what.
- Dapper results that include `bool` or nullable columns use records with `init` properties, not positional records.
- All database writes that belong together run in one transaction. Inputs are checked in the controller; the API answers 400 with every problem listed.
- Anything an admin can do is recorded in the History (ChangeRequests or GameChanges).
- Settings and secrets come from configuration (user-secrets, environment variables), never from code.
- Every change is described in `DESIGN.md` (progress table and the affected sections).

### Adding a feature: the usual steps

1. Schema change, if any: a new script in `api/Data/Migrations/Scripts/` (see "Change the schema").
2. API: DTOs in `api/Dtos/`, queries in a repository, an action in a controller. Add a sample request to `api/Tiles18xx.Api.http`.
3. Website: the type in `web/src/types/`, the call in `web/src/api/`, then the page or component. Add the route in `App.tsx` and, if needed, a header link in `components/Layout.tsx`. Use `PageHeader`, `EmptyState`, and `LoadingState` so the page matches the rest.
4. Check: `dotnet build`, `npm run lint`, `npm run format:check`, `npm run build`; try it in the browser, signed out, as a user, and as an admin.
5. Update `DESIGN.md`, and this runbook if setup or operations changed.

### Testing against a copy of the database

To try something risky without touching your data, run a second API on a copy:

1. Stop the API, then copy `data/tiles.db` (and `tiles.db-wal`, `tiles.db-shm` if present) to a scratch folder.
2. Start the API with that copy and a different address, for example in the `api` folder:

```bash
dotnet run --launch-profile https -- --urls https://localhost:7397 --ConnectionStrings:Tiles="Data Source=C:/scratch/tiles.db"
```

3. Point a second Vite at it, or call it with `curl`. Delete the copy when done.

## Email

The app sends two kinds of email: account confirmation and password reset. It uses [Resend](https://resend.com) through its web API; there is nothing to install.

- **No settings:** emails are written to the **API's console log** instead of being sent. This is the normal setup for development: copy the link from the log and open it.
- **With a Resend API key:** emails are sent for real. If sending fails (for example a wrong key), the error is in the API log and the user can ask for the email again from the sign-in page.

### Set up Resend (once)

1. Create a free account at https://resend.com (the free plan is far more than this app needs).
2. Add your domain in Resend and create the DNS records it shows (SPF and DKIM) at your domain registrar. Wait until Resend shows the domain as verified. Without a verified domain, Resend only delivers to your own address.
3. Create an API key (sending access is enough).

### Configure it when running locally

In the `api` folder, store the key and the sender in user-secrets (never in a file in the repository):

```bash
dotnet user-secrets set "Email:ResendApiKey" "re_your_key"
```

```bash
dotnet user-secrets set "Email:From" "18xx Tiles <no-reply@yourdomain.com>"
```

Restart the API. To go back to emails in the log, remove the key:

```bash
dotnet user-secrets remove "Email:ResendApiKey"
```

Password-reset emails link to the website. Locally the address is `App:PublicUrl` in `api/appsettings.Development.json` (`http://localhost:5173`, the Vite address); change it there if you run the website elsewhere.

### Configure it in Docker

Add to `.env` (see `.env.example`), then run `docker compose up -d` again:

```text
PUBLIC_URL=https://your-site-address
RESEND_API_KEY=re_your_key
EMAIL_FROM=18xx Tiles <no-reply@yourdomain.com>
```

`PUBLIC_URL` is the address people use to reach the site; it defaults to `http://localhost:8080`. Change it whenever the site moves.

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

### Nightly snapshots (automatic)

The API saves a snapshot of the database once a night, but **only when the data changed** since the last snapshot. A night with no changes (or only sign-ins) keeps nothing. Each snapshot is a complete, ready-to-use database file, taken safely while the app runs.

| Item | Detail |
|---|---|
| Where | `data/backups/` (Docker: `/data/backups` on the volume) |
| Files | `tiles-YYYYMMDD-HHmmss.db` (the database), `.sha256` next to it (its data fingerprint), and `keys/` (a copy of the sign-in keys) |
| When | 03:00 server time by default; Docker containers use UTC |
| How many | The last 90 snapshots; older ones are deleted |
| Log | "Backup saved", "Backup skipped: no changes since ...", "Backup removed", or "Backup failed" |

Settings (see the configuration reference):

| Setting | Default | Meaning |
|---|---|---|
| `Backup:Enabled` | `true` | Turn snapshots off with `false` |
| `Backup:Folder` | `../data/backups` | Where they go (relative to the `api` folder) |
| `Backup:RetainCount` | `90` | How many to keep |
| `Backup:RunAt` | `03:00` | Time of day, 24-hour, server time |
| `Backup:RunOnStartup` | `false` | Also check for changes when the API starts |

To change one locally, for example keep 30:

```bash
dotnet user-secrets set "Backup:RetainCount" "30"
```

In Docker, set `BACKUP_RETAIN_COUNT` or `BACKUP_RUN_AT` in `.env`.

> Snapshots live next to the database, so they protect against mistakes, not against losing the server. Copy them somewhere else too: download `data/backups` now and then, or set up an off-site copy when hosting (see the hosting notes in `DESIGN.md`).

### Back up by hand

Stop the API first, then copy all three files (`tiles.db`, `tiles.db-wal`, `tiles.db-shm`) and the `data/keys` folder somewhere safe. With the API stopped, the WAL is usually merged and only `tiles.db` remains. Or simply copy the newest file from `data/backups`.

### Restore

1. Stop the API.
2. Move the current `data/tiles.db`, `tiles.db-wal`, and `tiles.db-shm` aside (do not delete them until the restore works).
3. Copy the snapshot you want, for example `data/backups/tiles-20261010-030000.db`, to `data/tiles.db`.
4. If the sign-in keys were lost too, copy `data/backups/keys/` to `data/keys/`.
5. Start the API. It upgrades the schema if needed and skips data it already imported.

In Docker, do the same inside the volume: stop the app, then for example:

```bash
docker run --rm -v 18xx-tiles_tiles-data:/data alpine sh -c "mkdir -p /data/before-restore && mv /data/tiles.db* /data/before-restore/ && cp /data/backups/tiles-20261010-030000.db /data/tiles.db"
```

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

1. Create `.env` next to `docker-compose.yml` from `.env.example` and fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Optionally set `PUBLIC_URL`,
   `RESEND_API_KEY`, and `EMAIL_FROM` (see "Email"). `.env` is not in git; it holds secrets.
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
| Site's public address (reset links) | `App:PublicUrl` in `appsettings.Development.json` | `App__PublicUrl` (from `PUBLIC_URL`) | `http://localhost:5173` locally; `http://localhost:8080` in Docker |
| Nightly snapshots | `Backup:Enabled`, `Backup:Folder`, `Backup:RetainCount`, `Backup:RunAt`, `Backup:RunOnStartup` | `Backup__Folder` (`/data/backups`), `Backup__RetainCount` (from `BACKUP_RETAIN_COUNT`), `Backup__RunAt` (from `BACKUP_RUN_AT`) | on, `../data/backups`, 90, `03:00`, off |
| Resend API key | user-secret `Email:ResendApiKey` | `Email__ResendApiKey` (from `RESEND_API_KEY`) | none: emails go to the log |
| Email sender | user-secret `Email:From` | `Email__From` (from `EMAIL_FROM`) | none; required when the key is set |
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
| Cannot confirm a new account in development | No Resend key set, so emails go to the log | Copy the confirmation link from the API log |
| API stops at startup: "Email:From must be set" | The Resend key is set but the sender is not | Set `Email:From` (or `EMAIL_FROM`) |
| Emails not arriving | Wrong key, or the sender's domain is not verified in Resend | Look for "Email to ... failed" in the API log; check the domain in Resend; check the spam folder |
| Reset link opens the wrong site | `App:PublicUrl` (or `PUBLIC_URL`) is out of date | Set it to the site's current address and restart |
| 429 Too Many Requests | Rate limit | Wait a minute (sign-in) or an hour (submissions) |
| Import notes on **Imports** after an update | Upstream changed something edited here | See "The import report" above |
| "Backup failed" in the log | The backup folder is not writable, or the disk is full | Check `Backup:Folder` and free space |
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
| `api/Data/Backups/DatabaseBackupService.cs` | Nightly snapshots: change check, copy, retention |
| `data/backups/` | The snapshots (not in git) |
| `api/Auth/` | Sign-in: Identity, admin seeding, migrations |
| `api/Tiles18xx.Api.http` | Sample API requests for Visual Studio |
| `api/Auth/ResendEmailSender.cs` | Sending email through Resend |
| `web/src/pages/` | One file per page |
| `branding/` | Logo SVGs |
