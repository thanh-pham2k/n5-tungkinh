--liquibase formatted sql
--changeset kotoba:001-study-library
CREATE TABLE study_contents (
  id TEXT PRIMARY KEY NOT NULL,
  library_id TEXT NOT NULL,
  tool TEXT NOT NULL CHECK (tool IN ('instant','cards','order','typing','structures','speaking','writing','multiple-choice','markdown')),
  title TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en','ja')),
  source TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  parsed_json TEXT NOT NULL CHECK (json_valid(parsed_json)),
  item_count INTEGER NOT NULL CHECK (item_count > 0),
  created_at TEXT NOT NULL,
  last_studied_at TEXT NOT NULL,
  study_count INTEGER NOT NULL DEFAULT 1 CHECK (study_count > 0),
  UNIQUE (library_id, tool, language, source_hash)
);
CREATE INDEX idx_study_contents_library_tool_recent ON study_contents (library_id, tool, last_studied_at DESC, id DESC);
CREATE TABLE study_records (
  id TEXT PRIMARY KEY NOT NULL,
  library_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (library_id, request_id)
);
CREATE INDEX idx_study_records_content ON study_records (library_id, content_id, created_at DESC);
CREATE TABLE study_progress (
  content_id TEXT NOT NULL,
  library_id TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(state_json)),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (content_id, library_id)
);
CREATE TABLE study_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  updated_at TEXT NOT NULL
);
--rollback DROP TABLE study_catalog;
--rollback DROP TABLE study_progress;
--rollback DROP TABLE study_records;
--rollback DROP TABLE study_contents;
