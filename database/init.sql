CREATE DATABASE IF NOT EXISTS wordcraft;
USE wordcraft;

CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    word VARCHAR(255) NOT NULL,
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_session_word (session_id, word)
);

CREATE TABLE IF NOT EXISTS objectives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    target_word VARCHAR(255) NOT NULL,
    is_found BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_objective (session_id, target_word)
);

CREATE TABLE IF NOT EXISTS global_recipes (
    word1 VARCHAR(100) NOT NULL,
    word2 VARCHAR(100) NOT NULL,
    result VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (word1, word2)
);
