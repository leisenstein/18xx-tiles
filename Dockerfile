# ============================================================
# Stage 1: Build the React app
# ============================================================
FROM node:24-alpine AS web-build
WORKDIR /src/web

# Copy the package list first and install packages.
# Docker caches this step, so it only reruns when packages change.
COPY web/package.json web/package-lock.json ./
RUN npm ci

# Copy the rest of the React code and build it. Output goes to /src/web/dist.
COPY web/ ./
RUN npm run build

# ============================================================
# Stage 2: Generate the seed data from tobymao/18xx
# ============================================================
# The seed files (games.json, tiles.json, source.json) are never stored in git (DESIGN.md section 6.4). This stage downloads the pinned commit
# (tools/import/18xx-commit.txt) and runs the same script used on a developer machine, so every image is built from the repository alone.
# Needs internet access to github.com during the build.
FROM python:3.14-slim AS seed-data
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY tools/import/update_data.py tools/import/18xx-commit.txt tools/import/
RUN python -I tools/import/update_data.py --pinned --out /seed

# ============================================================
# Stage 3: Build the API
# ============================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src

# Copy the project file first and download NuGet packages (cached like npm above).
COPY global.json ./
COPY api/Tiles18xx.Api.csproj api/
RUN dotnet restore api/Tiles18xx.Api.csproj

# Copy the rest of the API code, add the seed files generated in stage 2 (embedded in the API), and publish it.
COPY api/ api/
# Admin documents (runbook, database), embedded in the API and served only to admins.
COPY docs/*.md docs/
COPY --from=seed-data /seed/ api/Data/Seeding/SeedFiles/
RUN dotnet publish api/Tiles18xx.Api.csproj -c Release -o /app/publish --no-restore

# ============================================================
# Stage 4: The final, small image that actually runs
# ============================================================
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Copy the published API from stage 3.
COPY --from=api-build /app/publish ./

# Copy the built React app from stage 1 into wwwroot, where the API serves it.
COPY --from=web-build /src/web/dist ./wwwroot

# Create the /data folder for the database and let the app user write to it.
RUN mkdir -p /data && chown $APP_UID /data

# Run as a normal user, not as root (safer).
USER $APP_UID

# The app listens on port 8080 inside the container.
EXPOSE 8080

# Start the app.
ENTRYPOINT ["dotnet", "Tiles18xx.Api.dll"]