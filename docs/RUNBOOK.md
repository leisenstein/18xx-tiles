# 18xx Tiles runbook

How to set up, run, update, and look after the 18xx Tiles app. For admins. The design and the reasons behind it are in `DESIGN.md`; this document is the how-to.

> Shown in the app at **Docs**, **Runbook** (admins only). The source is `docs/RUNBOOK.md` in the repository; edit it there, then rebuild the API. The
> database's tables and columns are described in **Docs**, **Database** (`docs/DATABASE.md`), and putting the site on the internet in **Docs**, **Going live**
> (`docs/guide/going-live.html`, also as a PDF in the same folder).

## Overview

| Part | What it is | Where | Address in development |
|---|---|---|---|
| API | ASP.NET Core (.NET 10) controllers, Dapper, SQLite | `api/` | https://localhost:7299 |
| Website | React 19, Vite 8, Tailwind 4, shadcn/ui | `web/` | http://localhost:5173 (Vite sends `/api` calls to the API) |
| Database | One SQLite file, plus the sign-in key folder | `data/tiles.db`, `data/keys/` (not in git) | |
| Data import | Python script that reads tobymao/18xx | `tools/import/update_data.py` | |
| 18xx.net games | Reviewed extra games and links from 18xx.net, in games.json format, kept in git | `tools/import/18xxnet/` | |
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

8. Optional: add the extra games from 18xx.net (49 games, units, and variants). Follow "Import it" under [Data: extra games from 18xx.net](#data-extra-games-from-18xx-net).

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

### Website settings (web/.env)

The website's development server and build read optional settings from `web/.env` (or `web/.env.local`). Copy `web/.env.example` to start; every
value has a default, so most people never need the file. Restart `npm run dev` after a change.

| Setting | Default | Use it to |
|---|---|---|
| `VITE_PORT` | `5173` | run `npm run dev` on another port |
| `VITE_PREVIEW_PORT` | `4173` | run `npm run preview` on another port |
| `VITE_ALLOWED_HOSTS` | localhost only | let other host names reach the dev server, comma-separated (for example a tunnel address), or `all` |
| `VITE_API_PROXY_TARGET` | `https://localhost:7299` | send `/api` calls to an API on another address or port |
| `VITE_API_PROXY_SECURE` | `false` | `true` to require a trusted certificate from that API. Keep `false` for the .NET development certificate |
| `VITE_API_BASE_URL` | empty | built into the website: the API's address when it is not the website's own (see below) |

Example `web/.env` for an API started on port 7397:

```text
VITE_PORT=5180
VITE_API_PROXY_TARGET=https://localhost:7397
```

### How the website finds the API

All API calls go through `web/src/api/client.ts`, which uses relative addresses such as `/api/games`. That works everywhere the app normally runs:

- **Development:** Vite forwards `/api` to the API (`VITE_API_PROXY_TARGET`).
- **Docker and hosting:** the API serves the website itself, so `/api` is the same site.

Only if you ever host the website and the API on **different addresses**:
1. Set `VITE_API_BASE_URL` (for example `https://api.example.com`) before `npm run build`.
2. List the website's address in the API setting `Cors:AllowedOrigins`.

Keep both on one domain (for example `example.com` and `api.example.com`): the sign-in cookie only travels within the same site.

### Ports

| Part | Default | How to change |
|---|---|---|
| API in development | https://localhost:7299 (launch profile) | `dotnet run --launch-profile https -- --urls https://localhost:7400`, or edit `api/Properties/launchSettings.json` |
| API in Docker and on hosts | 8080 | Hosts that set `PORT` (Railway, Render, Fly.io) are followed automatically; `--urls` or `ASPNETCORE_URLS` override it |
| Docker on your PC | http://localhost:8080 | `APP_PORT` in `.env` |
| Website dev server | 5173 | `VITE_PORT` in `web/.env` |

### Testing against a copy of the database

To try something risky without touching your data, run a second API on a copy:

1. Stop the API, then copy `data/tiles.db` (and `tiles.db-wal`, `tiles.db-shm` if present) to a scratch folder.
2. Start the API with that copy and a different address, for example in the `api` folder:

```bash
dotnet run --launch-profile https -- --urls https://localhost:7397 --ConnectionStrings:Tiles="Data Source=C:/scratch/tiles.db"
```

3. Point a second website at it with `VITE_API_PROXY_TARGET=https://localhost:7397` and another `VITE_PORT` in `web/.env.local`, or call it
   with `curl`. Delete the copy when done.

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

## Data: extra games from 18xx.net

[18xx.net](http://www.18xx.net/) (Blackwater Station and its Tile Encyclopaedia, by Chris Lawson, John David Galt and contributors) lists games that 18xx.games does not have: older and unpublished designs, 1825's units and kits, 1830 variants, and others. The site has not changed since about 2009. What we chose to take from it is kept in git, in `tools/import/18xxnet/`:

| File | What it is |
|---|---|
| `18xxnet-games.json` | **The file to import.** Exactly the format of `games.json`: 49 games, units, and variants (their `dir` starts with `18xxnet_`) with the tiles the database has, plus 17 existing games with only the links and empty publishers to add |
| `18xxnet-source.json` | Its `source.json` (commit `18xx.net`, and a hash so it is imported once) |
| `18xxnet-diff.json`, `18xxnet-diff.md` | The review: every difference found, each with its `decision` |
| `18xxnet-missing-tiles.json` | Tiles 18xx.net lists for those games that the database does not have (not imported) |
| `compare_18xxnet.py`, `build_games_file.py` | The scripts that make the files above |

It never adds tiles (18xx.net has no track layouts), only games, links, counts, and empty publishers.

### How it works, and why the seed files are swapped

- **The importer reads three fixed files.** At startup `DataImporter` reads `games.json`, `tiles.json`, and `source.json`, which are built into the API from `api/Data/Seeding/SeedFiles/`. It has no setting for "import this other file", so to import the 18xx.net file without changing the importer, you put it in place of `games.json` for one start.
- **Why `source.json` is swapped too.** The importer remembers the hash in `source.json` of every data set it has applied (in `ImportRuns`) and skips one it has seen. `18xxnet-source.json` carries the 18xx.net file's own hash, so the importer treats it as new data and applies it once.
- **Why `tiles.json` stays.** It holds the standard numbered tiles. The 18xx.net games refer to them by number, so they must be there, and they are the same in both cases.
- **Why the database already having data matters.** With existing data the importer runs in merge mode: it only adds games and links and fills empty values. It never deletes or overwrites anything, so the 18xx.games games stay as they are. On an empty database it would load only the 18xx.net file, which is why the normal data is imported first.
- **Why swapping is safe.** `games.json`, `tiles.json`, and `source.json` are not in git and are never edited by hand; `update_data.py --pinned --no-fetch` rebuilds them exactly from the pinned commit, without a download. The 18xx.net files in `tools/import/18xxnet/` are only copied, never changed.
- **Why you put the normal files back.** So that later builds, and 18xx.games updates, use the normal data again. The 18xx.net games stay in the database.
- **What 18xxnet-games.json contains.** New games (their `dir`, stored as `Games.SourceKey`, starts with `18xxnet_`), each with the tiles the database already has. Existing games appear with their usual `dir` and title, listing only the links and the empty publishers to add; a game listed this way keeps its other tiles.

### Import it

Import the normal data first (a new database gets it on its first start). Then, from the repo root:

1. Put the 18xx.net files in place of the normal seed files (`tiles.json` stays):

```bash
cp tools/import/18xxnet/18xxnet-games.json api/Data/Seeding/SeedFiles/games.json
```

```bash
cp tools/import/18xxnet/18xxnet-source.json api/Data/Seeding/SeedFiles/source.json
```

2. Rebuild and start the API. It imports the file in merge mode: **Imports** shows commit `18xx.net` with 49 games and about 1,590 links added.
3. Stop the API and put the normal seed files back (no download needed):

```bash
python -I tools/import/update_data.py --pinned --no-fetch
```

4. Rebuild and start the API again. The normal data was already applied, so nothing more is imported.

Docker builds always generate the normal seed files, so they cannot import this file themselves. Import it with the API on your PC (steps 1 to 4) into the database you will deploy, or restore a snapshot that already has it.

**Notes in the report are expected.** The importer treats the file as the whole upstream: it lists the 18xx.games games as "Game no longer upstream" and the other links of the 17 games it touches as "In the app but not upstream". Both are kept; nothing is removed. Later 18xx.games updates likewise list the 18xx.net games and their added links as not upstream, and keep them.

### Change what is imported

1. Optional: compare again with `python -I tools/import/18xxnet/compare_18xxnet.py` (add `--offline` to use only the pages already downloaded to `tools/import/.cache/18xxnet`). Decisions already made are kept.
2. Edit `"decision"` in `18xxnet-diff.json`: `"import"`, `"skip"`, or `null` (later).
3. Run `python -I tools/import/18xxnet/build_games_file.py`. It fills undecided entries with the rules agreed in review (`RULES` in the script), never changing a decision made by hand, and rewrites `18xxnet-games.json` and `18xxnet-source.json`.
4. Import it as above, and commit the files in `tools/import/18xxnet/`.

Tile numbers 18xx.net has but the database does not (`newTile` entries, left undecided) need a track definition written by hand before they can be added.

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

The extra games from 18xx.net are not part of that automatic import. To get them back, follow "Import it" under [Data: extra games from 18xx.net](#data-extra-games-from-18xx-net); the file to import is kept in git (`tools/import/18xxnet/18xxnet-games.json`).

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
- **Change your own password:** click your email (or initial) in the header to open **My account**, then **Change password**. It needs your current password; you stay signed in, and your other devices are signed out within a minute. Forgot it? Use **Forgot password** on the sign-in page.
- **Manage accounts:** the **Users** page (admins only). See the next section.

- **Rate limits:** sign-in, registration, and other `/api/auth` calls allow 10 per minute per IP address; tile submissions allow 30 per hour per user. Over the limit returns 429; wait and try again.

### The Users page

**Users** lists every account with its roles, state, and how many tile requests it has submitted. Search by email. For each account:

| Action | What it does |
|---|---|
| **Make Admin** / **Remove Admin** | Gives or takes the Admin role |
| **Confirm email** | Marks the email confirmed so the person can sign in without the emailed link. Useful while no email service is set up; only do it when you know the address is theirs |
| **Send password reset** | Emails the person the same reset link as "Forgot password". You never see or set their password. Without an email service, the link is in the API log |
| **Disable** / **Enable** | A disabled account cannot sign in. Enable also ends the short lockout Identity applies after 5 wrong passwords (shown as "Locked until ...") |
| **Delete** | Removes the account and its roles, after you confirm. Its tile requests and history stay, shown as "an unknown user". Disabling is usually better: it can be undone |

Rules that keep the site from losing its admins (the buttons are off, and the API refuses):
- You cannot remove the Admin role from, disable, or delete **your own account**. Ask another admin.
- The same goes for the **configured admin** (the `Admin:Email` account): the site would restore it at the next start anyway.
- The **last admin** cannot lose the role.

Changes reach people who are already signed in **within a minute**: the site re-checks every sign-in once a minute, so new roles apply, and disabled or deleted accounts are signed out.

Roles: the site has one role, **Admin**. Accounts are created by people registering; there is no "add user" button.

## Admin tasks in the app

| Task | Where | Notes |
|---|---|---|
| Review proposed tiles and games | **Review** | Approve publishes the tile, or adds the proposed game with its tiles and counts (refused if a game with that title was added since); Reject needs a note the submitter sees |
| Edit or delete a tile | the tile's page: **Edit tile**, **Delete tile** | Applied at once; recorded in History. Delete hides the tile but keeps it |
| Add a game | Games: **New game** | Title (unique), designer, publisher; then you go straight to Edit game tiles to add its tiles and counts |
| Edit or delete a game | Tiles filtered to a game: **Edit or delete game** | Change the title, designer, or publisher (later imports keep your values). **Delete game** hides it everywhere and clears its tile list; the tiles stay, History keeps what it had, and imports never add it back |
| Edit a game's tiles and counts | Tiles filtered to a game: **Edit this game's tiles** | Add, remove, set counts and notes; saved as one History entry |
| See every change | **History** | Filter by type (Add, Edit, Delete, Import, Game) and status; search by tile, email, game, or commit |
| See imports | **Imports** | What each import added, and notes to review |
| Manage accounts | **Users** | Admin role, confirm email, password reset, disable, delete; see "The Users page" |
| Print tile stickers | a tile or a game: **Print tray stickers** | Any signed-in user; stickers for tile trays: a number circle (1/2, 3/4, or 1 inch) or a picture of the tile on a 3/4 or 1 inch hex (very busy tiles may look jumbled); PDF sheet, SVG, or PNG |

## Docker

Docker builds generate the seed data themselves from the pinned commit, so the build needs internet access to github.com.

1. Create `.env` next to `docker-compose.yml` from `.env.example` and fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Optionally set `PUBLIC_URL`,
   `RESEND_API_KEY`, and `EMAIL_FROM` (see "Email"). `.env` is not in git; it holds secrets.
2. Build and start, then open http://localhost:8080 (or the port in `APP_PORT`):

```bash
docker compose up --build -d
```

| Task | Command |
|---|---|
| See the logs (and confirmation links) | `docker compose logs -f app` |
| Stop | `docker compose down` |
| Stop and **delete the database volume** | `docker compose down -v` |
| Update after code or data changes | `docker compose up --build -d` |

### Use it from a phone or tablet on your network

Open `http://<this PC's address>:8080` on the other device (find the address with `ipconfig`, the "IPv4 Address" line, for example
`http://192.168.1.20:8080`). If it does not load, allow port 8080 through Windows Firewall for private networks.

Signing in works over this plain HTTP address because Docker sets `SECURE_COOKIE` to false by default: the sign-in cookie is HTTPS-only only when the
site is reached over HTTPS. (Browsers throw away HTTPS-only cookies sent over plain HTTP, except on `localhost`, so with it on, signing in from
another device seems to work but leaves you signed out.) On a public site set `SECURE_COOKIE=true` in `.env`.

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
| Port the API listens on | launch profile (`https://localhost:7299`) | `PORT` if the host sets it, otherwise 8080 | `--urls` or `ASPNETCORE_URLS` override both |
| Website on another address (CORS) | `Cors:AllowedOrigins` | `Cors__AllowedOrigins` (from `CORS_ALLOWED_ORIGINS`) | empty: no cross-site calls |
| Docker port on your PC | | `APP_PORT` in `.env` | 8080 |
| Behind a host's proxy | | `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` | off (needed on Railway and similar; see the going-live guide) |
| Sign-in cookie HTTPS-only | `Auth:SecureCookie` | `Auth__SecureCookie` (from `SECURE_COOKIE` in `.env`) | true in the app; **false in docker-compose.yml**, so devices on your network can sign in over HTTP. Keep true on a public site |
| Environment | `Development` (launch profile) | `Production` | |

Website settings (`VITE_PORT`, `VITE_ALLOWED_HOSTS`, `VITE_API_PROXY_TARGET`, `VITE_API_PROXY_SECURE`, `VITE_API_BASE_URL`) are in `web/.env`; see
"Website settings" under Developer setup.

Keep `data/keys` private and backed up with the database. Losing it signs everyone out; anyone who has it could forge sign-in cookies.

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Signing in from a phone or tablet does nothing; the site still shows Sign in | The sign-in cookie is HTTPS-only and the device uses `http://<PC address>` | Set `SECURE_COOKIE=false` in `.env` (the Docker default) and run `docker compose up -d`; see "Use it from a phone or tablet" |
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
| Browser shows "Blocked request. This host is not allowed" (development) | The dev server was opened with a host name it does not know (for example a tunnel) | Add it to `VITE_ALLOWED_HOSTS` in `web/.env` and restart `npm run dev` |
| Vite log: proxy error "self-signed certificate" | `VITE_API_PROXY_SECURE=true` against the development API | Set it back to `false` (or remove it) |
| Vite says the port is in use | Another program (or a second `npm run dev`) uses 5173 | Stop it, or set `VITE_PORT` |
| Browser console: "blocked by CORS policy" | The website calls the API on another address that does not allow it | Add the website's address to `Cors:AllowedOrigins`, or leave `VITE_API_BASE_URL` empty to use relative addresses |
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
| `tools/import/18xxnet/18xxnet-games.json` | The extra games from 18xx.net, ready to import (with `18xxnet-source.json`) |
| `tools/import/18xxnet/` | Also the 18xx.net comparison, review, and the scripts that build the import file |
| `api/Data/Migrations/Scripts/` | Database schema scripts (DbUp) |
| `api/Data/Seeding/DataImporter.cs` | Startup import (seed or merge) |
| `api/Data/Backups/DatabaseBackupService.cs` | Nightly snapshots: change check, copy, retention |
| `data/backups/` | The snapshots (not in git) |
| `api/Auth/` | Sign-in: Identity, admin seeding, migrations |
| `api/Tiles18xx.Api.http` | Sample API requests for Visual Studio |
| `web/.env.example` | The website's optional settings (ports, proxy, allowed hosts, API address) |
| `web/vite.config.ts` | Development server and proxy, reading `web/.env` |
| `api/Auth/ResendEmailSender.cs` | Sending email through Resend |
| `web/src/pages/` | One file per page |
| `branding/` | Logo SVGs |
