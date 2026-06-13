const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://ml-service:5000';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'wordcraft',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Basic combination logic (mocked)
const recipes = {
    'Water+Fire': 'Steam',
    'Fire+Water': 'Steam',
    'Earth+Water': 'Mud',
    'Water+Earth': 'Mud',
    'Air+Fire': 'Smoke',
    'Fire+Air': 'Smoke',
    'Air+Water': 'Rain',
    'Water+Air': 'Rain',
    'Earth+Fire': 'Lava',
    'Fire+Earth': 'Lava',
    'Earth+Air': 'Dust',
    'Air+Earth': 'Dust',
    'Steam+Air': 'Cloud',
    'Air+Steam': 'Cloud',
    'Cloud+Water': 'Rain',
    'Water+Cloud': 'Rain',
    'Dust+Fire': 'Ash',
    'Fire+Dust': 'Ash',
};

// API: Start a new session
app.post('/api/session', async (req, res) => {
    try {
        const [result] = await pool.query('INSERT INTO sessions () VALUES ()');
        const sessionId = result.insertId;
        
        // Add base elements to session words
        const baseElements = ['Water', 'Fire', 'Wind', 'Earth'];
        for (const word of baseElements) {
            await pool.query('INSERT INTO session_words (session_id, word) VALUES (?, ?)', [sessionId, word]);
        }
        
        res.json({ sessionId, elements: baseElements });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// API: Set objectives for a session
app.post('/api/session/:id/objectives', async (req, res) => {
    const sessionId = req.params.id;
    const { objectives } = req.body; // Array of words
    
    if (!objectives || !Array.isArray(objectives)) {
        return res.status(400).json({ error: 'Invalid objectives' });
    }
    
    try {
        for (const word of objectives) {
            await pool.query('INSERT INTO objectives (session_id, target_word) VALUES (?, ?)', [sessionId, word]);
        }
        res.json({ success: true, objectives });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// API: Get current objectives
app.get('/api/session/:id/objectives', async (req, res) => {
    const sessionId = req.params.id;
    try {
        const [rows] = await pool.query('SELECT target_word, is_found FROM objectives WHERE session_id = ?', [sessionId]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Helper function to handle a successfully crafted word
async function handleDiscoveredWord(sessionId, resultWord, res) {
    try {
        const [rows] = await pool.query('SELECT id FROM session_words WHERE session_id = ? AND word = ?', [sessionId, resultWord]);
        let isNew = false;
        
        if (rows.length === 0) {
            await pool.query('INSERT INTO session_words (session_id, word) VALUES (?, ?)', [sessionId, resultWord]);
            isNew = true;
            await pool.query('UPDATE objectives SET is_found = true WHERE session_id = ? AND target_word = ?', [sessionId, resultWord]);
        }
        
        return res.json({ success: true, word: resultWord, isNew });
    } catch (error) {
        console.error("Database error in handleDiscoveredWord:", error);
        return res.status(500).json({ error: 'Database error' });
    }
}

// API: Craft words
app.post('/api/craft', async (req, res) => {
    const { sessionId, word1, word2 } = req.body;
    
    if (!sessionId || !word1 || !word2) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    const recipeKey1 = `${word1}+${word2}`;
    const recipeKey2 = `${word2}+${word1}`;
    
    let resultWord = recipes[recipeKey1] || recipes[recipeKey2];
    
    if (resultWord) {
        return await handleDiscoveredWord(sessionId, resultWord, res);
    }
    
    try {
        // Check global_recipes cache in DB
        const [globalRows] = await pool.query('SELECT result FROM global_recipes WHERE (word1 = ? AND word2 = ?) OR (word1 = ? AND word2 = ?)', [word1, word2, word2, word1]);
        if (globalRows.length > 0) {
            return await handleDiscoveredWord(sessionId, globalRows[0].result, res);
        }

        // Call ML Service
        const mlRes = await fetch(`${ML_SERVICE_URL}/combine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word1, word2 })
        });
        
        if (!mlRes.ok) {
            console.error("ML service returned error:", mlRes.status);
            return res.json({ success: false, message: 'Nothing happened.' });
        }

        const mlData = await mlRes.json();
        
        if (mlData.result && mlData.result !== 'Nothing') {
            resultWord = mlData.result;
            // Cache in global_recipes
            await pool.query('INSERT IGNORE INTO global_recipes (word1, word2, result) VALUES (?, ?, ?)', [word1, word2, resultWord]);
            return await handleDiscoveredWord(sessionId, resultWord, res);
        }
        
        return res.json({ success: false, message: 'Nothing happened.' });

    } catch (error) {
        console.error("Error in craft API:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Get all discovered words
app.get('/api/session/:id/words', async (req, res) => {
    const sessionId = req.params.id;
    try {
        const [rows] = await pool.query('SELECT word FROM session_words WHERE session_id = ?', [sessionId]);
        res.json(rows.map(row => row.word));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(port, () => {
    console.log(`App running on port ${port}`);
});
