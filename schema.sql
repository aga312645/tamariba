DROP TABLE IF EXISTS board_state;
CREATE TABLE board_state (
  id TEXT PRIMARY KEY,
  state TEXT
);
INSERT INTO board_state (id, state) VALUES ('main', '{}');