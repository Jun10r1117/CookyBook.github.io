// 1. Setup Express and SQLite
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;
const db = new sqlite3.Database('recipes.db');

// 2. Middleware
app.use(express.json());

// 3. Create table and insert sample recipes if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      ingredients TEXT,
      instructions TEXT
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM recipes", (err, row) => {
    if (err) {
      console.error(err);
      return;
    }

    if (row.count === 0) {
      db.run("INSERT INTO recipes (name, ingredients, instructions) VALUES ('Chicken Fried Rice', 'chicken, rice, egg, peas', 'Cook rice and chicken, mix with peas and egg.')");
      db.run("INSERT INTO recipes (name, ingredients, instructions) VALUES ('Grilled Chicken', 'chicken, olive oil, spices', 'Grill chicken with oil and spices.')");
    }
  });
});

// 4. Serve the frontend HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// 5. API endpoint to search recipes with percent match
// Search by ingredients (with match percentage)
app.get('/search', (req, res) => {
  const { ingredients } = req.query;

  if (!ingredients) {
    return res.status(400).send({ error: 'Ingredients are required' });
  }

  const ingredientsArray = ingredients.split(',').map(i => i.trim().toLowerCase());

  const query = `SELECT * FROM recipes`;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).send({ error: err.message });
    }

    const results = rows.map(recipe => {
      const recipeIngredients = recipe.ingredients.split(',').map(i => i.trim().toLowerCase());
      const matchedIngredients = recipeIngredients.filter(ri => ingredientsArray.includes(ri));
      const matchPercent = Math.round((matchedIngredients.length / recipeIngredients.length) * 100);

      return {
        id: recipe.id,
        name: recipe.name,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        matchPercent: matchPercent
      };
    });

    // Sort recipes by best match first
    results.sort((a, b) => b.matchPercent - a.matchPercent);

    res.json({ recipes: results });
  });
});
// API endpoint to search recipes by name
app.get('/search-name', (req, res) => {
  const { name } = req.query;
  const query = `SELECT * FROM recipes WHERE LOWER(name) LIKE ?`;

  db.all(query, [`%${name.toLowerCase()}%`], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ recipes: rows });
  });
});
// Serve the single recipe page
app.get('/recipe', (req, res) => {
  const { id } = req.query;

  const query = `SELECT * FROM recipes WHERE id = ?`;

  db.get(query, [id], (err, row) => {
    if (err) {
      res.status(500).send('Error loading recipe');
      return;
    }
    if (!row) {
      res.status(404).send('Recipe not found');
      return;
    }

    res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${row.name}</title>
    <style>
      body {
        font-family: 'Poppins', sans-serif;
        background: linear-gradient(135deg, #FBFBD4, #FFB646);
        margin: 0;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .card {
        background: #ffffff;
        padding: 30px;
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        width: 90%;
        max-width: 600px;
        animation: fadeIn 0.5s ease;
      }
      .card h1 {
        margin-top: 0;
        color: #333333;
      }
      .card h3 {
        color: #555555;
      }
      .card p {
        color: #666666;
        line-height: 1.6;
      }
      .back-link {
        display: inline-block;
        margin-bottom: 20px;
        color: #FFB646;
        text-decoration: none;
        font-weight: bold;
      }
      .back-link:hover {
        text-decoration: underline;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <a href="/" class="back-link">← Back to Search</a>
      <h1>${row.name}</h1>
      <h3>Ingredients</h3>
      <p>${row.ingredients}</p>
      <h3>Instructions</h3>
      <p>${row.instructions}</p>
    </div>
  </body>
  </html>
`);
  });
});

// 6. Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
