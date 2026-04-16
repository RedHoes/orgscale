CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL
);

INSERT INTO users (name, role)
VALUES
    ('Alice', 'admin'),
    ('Bob', 'developer'),
    ('Carol', 'support');
