CREATE TABLE IF NOT EXISTS users (
  id   INT          PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name   VARCHAR(255)  NOT NULL,
  league VARCHAR(20)   NOT NULL DEFAULT 'NBA' CHECK (league IN ('NBA', 'EUROLEAGUE')),
  active BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS coaches (
  id     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name   VARCHAR(255)  NOT NULL,
  league VARCHAR(20)   NOT NULL DEFAULT 'NBA' CHECK (league IN ('NBA', 'EUROLEAGUE')),
  active BOOLEAN       NOT NULL DEFAULT TRUE
);
