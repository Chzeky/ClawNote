PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS knowledge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category TEXT,
    tags TEXT DEFAULT '[]',
    source TEXT,
    source_url TEXT,
    content_type TEXT DEFAULT 'text',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
    title,
    content,
    summary,
    tags,
    content='knowledge_items',
    content_rowid='id',
    tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS knowledge_insert
AFTER INSERT ON knowledge_items
BEGIN
    INSERT INTO knowledge_fts(rowid, title, content, summary, tags)
    VALUES (new.id, new.title, new.content, new.summary, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_delete
AFTER DELETE ON knowledge_items
BEGIN
    INSERT INTO knowledge_fts(
        knowledge_fts, rowid, title, content, summary, tags
    )
    VALUES (
        'delete', old.id, old.title, old.content, old.summary, old.tags
    );
END;

CREATE TRIGGER IF NOT EXISTS knowledge_update
AFTER UPDATE ON knowledge_items
BEGIN
    INSERT INTO knowledge_fts(
        knowledge_fts, rowid, title, content, summary, tags
    )
    VALUES (
        'delete', old.id, old.title, old.content, old.summary, old.tags
    );

    INSERT INTO knowledge_fts(rowid, title, content, summary, tags)
    VALUES (new.id, new.title, new.content, new.summary, new.tags);
END;
