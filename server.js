import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";

const app = express();
const serverPort = process.env.PORT;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const generate = () => {
  let length = 6;
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let encrypt = "";
  for (let i = 0; i < length; i++) {
    encrypt += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return encrypt;
};

const isUnique = async (s) => {
  const [response] = await connection.query(
    "SELECT COUNT(*) as count FROM urls WHERE short_url = ?;",
    [s]
  );
  return response[0].count === 0;
};

app.get("/create", async (req, res) => {
  try {
    const response = await connection.query(
      "CREATE TABLE IF NOT EXISTS urls( id INT AUTO_INCREMENT PRIMARY KEY, original_url VARCHAR(255) NOT NULL, short_url VARCHAR(6) NOT NULL UNIQUE);"
    );
    res.status(200);
  } catch (error) {
    console.error("Can not create table :", error);
    res.status(500);
  }
});

app.get("/clear", async (req, res) => {
  try {
    const response = await connection.query("DELETE FROM urls");
  } catch (err) {
    console.error(err);
  }
});

app.get("/check", async (req, res) => {
  try {
    const [rows] = await connection.query("SELECT * FROM urls;");
    console.log(rows);
  } catch (err) {
    console.error(err);
  }
  res.send("got data ?");
});

app.post("/shorten", async (req, res) => {
  const url = req.body.url;
  let hash;
  let isGood = false;

  if (url.length > 255) {
    res.status(403).json({
      error: "Length of Input URL must be less than 255 characters.",
    });
    return;
  }

  while (!isGood) {
    hash = generate();
    isGood = await isUnique(hash);
  }

  try {
    const response = await connection.query(
      "INSERT INTO urls (original_url, short_url) VALUES (?, ?);",
      [url, hash]
    );
    res.json({ compressed: `localhost:3000/${hash}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error in compressing the url" });
  }
});

app.get("/:compressed", async (req, res) => {
  const { compressed } = req.params;

  if (compressed.length != 6) {
    res.status(404).json({ error: "Incorrect URL" });
    return;
  }

  try {
    const [rows] = await connection.query(
      "SELECT original_url FROM urls WHERE short_url = ?",
      [compressed]
    );
    res.redirect(rows[0].original_url);
  } catch (err) {
    console.error(err);
    res.json({ error: "No URL found" });
  }
});

app.listen(serverPort, () => {
  console.log(`Server is running on port ${serverPort}`);
});
