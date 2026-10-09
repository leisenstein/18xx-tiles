CREATE TABLE Games (
  Id          INTEGER PRIMARY KEY,
  Title       TEXT NOT NULL UNIQUE,
  SourceKey   TEXT NOT NULL UNIQUE,      -- folder name, e.g. g_1830
  Designer    TEXT NULL,
  Publisher   TEXT NULL,
  DevStage    TEXT NULL,                 -- production, beta, alpha, prealpha
  CreatedUtc  TEXT NOT NULL
);
