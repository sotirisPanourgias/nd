CREATE TABLE IF NOT EXISTS users (
  room_id VARCHAR(36)  NOT NULL DEFAULT '',
  id      INT          NOT NULL,
  name    VARCHAR(255) NOT NULL,
  PRIMARY KEY (room_id, id)
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
