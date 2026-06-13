from flask import Flask, request, jsonify
import spacy
import numpy as np

app = Flask(__name__)

# Load the medium-sized English model which includes word vectors
print("Loading spaCy model...")
nlp = spacy.load('en_core_web_md')
print("Model loaded.")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/combine', methods=['POST'])
def combine():
    data = request.json
    word1 = data.get('word1')
    word2 = data.get('word2')

    if not word1 or not word2:
        return jsonify({"error": "word1 and word2 are required"}), 400

    # Ensure words are lowercase for consistency
    w1 = word1.lower()
    w2 = word2.lower()

    # Get tokens
    token1 = nlp(w1)
    token2 = nlp(w2)

    if not token1.has_vector or not token2.has_vector:
        return jsonify({"result": "Nothing", "message": "Unknown words"}), 200

    # Mathematically combine the vectors (average them)
    # Adding them or averaging them achieves similar cosine distance results, 
    # but averaging keeps the magnitude similar to original words
    combined_vector = (token1.vector + token2.vector) / 2

    # Find the most similar word in the vocabulary
    # spaCy doesn't have a direct "find closest by vector" that is fast without iterating,
    # but we can approximate or iterate over a subset of common words.
    # To keep it lightweight, we'll use a trick: 
    # nlp.vocab has vectors, we compare our combined_vector to them.
    
    # Pre-filter vocab to valid words (alpha, lowercase, not stop words, and has vector)
    GAME_VOCAB = {
        "water", "fire", "earth", "wind", "air", "steam", "mud", "smoke", "rain", "lava", "dust", "cloud", "ash", "stone", 
        "metal", "glass", "sand", "plant", "life", "human", "animal", "bird", "fish", 
        "tree", "wood", "paper", "book", "house", "city", "boat", "ship", "car", 
        "train", "plane", "sun", "moon", "star", "planet", "galaxy", "universe", 
        "energy", "electricity", "lightning", "computer", "internet", "robot", 
        "cyborg", "alien", "monster", "dragon", "magic", "wizard", "spell", "ghost", 
        "spirit", "soul", "mind", "idea", "thought", "dream", "nightmare", "sleep", 
        "time", "past", "future", "history", "story", "myth", "legend", "god", 
        "religion", "faith", "belief", "truth", "lie", "secret", "mystery", "puzzle", 
        "game", "toy", "child", "adult", "old", "new", "good", "bad", "evil", "hero", 
        "villain", "war", "peace", "love", "hate", "anger", "joy", "sadness", "fear", 
        "courage", "bravery", "cowardice", "strength", "weakness", "power", "control", 
        "freedom", "slavery", "prison", "escape", "journey", "adventure", "quest",
        "sword", "shield", "bow", "arrow", "gun", "bullet", "bomb", "explosion",
        "firework", "party", "celebration", "music", "song", "dance", "art",
        "painting", "sculpture", "statue", "building", "tower", "castle", "fortress",
        "wall", "door", "window", "roof", "floor", "room", "bed", "table", "chair",
        "food", "drink", "milk", "wine", "beer", "bread", "meat", "cheese",
        "fruit", "vegetable", "apple", "banana", "orange", "lemon", "potato",
        "carrot", "onion", "garlic", "pepper", "salt", "sugar", "spice", "herb",
        "flower", "rose", "lily", "tulip", "daisy", "sunflower", "grass", "leaf",
        "root", "branch", "trunk", "bark", "seed", "nut", "berry", "mushroom",
        "fungus", "mold", "bacteria", "virus", "disease", "medicine", "pill",
        "doctor", "hospital", "nurse", "patient", "health", "sickness", "death",
        "birth", "youth", "nature", "science", "physics", "chemistry", "biology",
        "math", "number", "word", "letter", "shape", "color", "red", "blue", "green",
        "yellow", "black", "white", "light", "dark", "shadow", "reflection", "mirror",
        "sound", "noise", "silence", "voice", "speech", "language", "communication"
    }
    
    # We will do it lazily on the first request if not already done.
    if not hasattr(app, 'valid_lexemes'):
        print("Caching valid lexemes...")
        app.valid_lexemes = []
        for word in GAME_VOCAB:
            lex = nlp.vocab[word]
            if lex.has_vector:
                app.valid_lexemes.append(lex)
        print(f"Cached {len(app.valid_lexemes)} lexemes.")

    best_match = None
    highest_similarity = -1

    # Normalizing combined vector
    norm_combined = np.linalg.norm(combined_vector)
    if norm_combined == 0:
        return jsonify({"result": "Nothing"}), 200

    for lex in app.valid_lexemes:
        # Ignore the input words themselves and simple plurals
        if lex.text in (w1, w2, w1 + 's', w2 + 's', w1[:-1], w2[:-1]):
            continue
            
        norm_lex = np.linalg.norm(lex.vector)
        if norm_lex == 0:
            continue
            
        # Cosine similarity
        similarity = np.dot(combined_vector, lex.vector) / (norm_combined * norm_lex)
        
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match = lex.text

    # Formatting output: capitalize first letter
    result = best_match.capitalize() if best_match else "Nothing"

    return jsonify({"result": result, "similarity": float(highest_similarity)}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
