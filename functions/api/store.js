export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cat TEXT,
      desc TEXT,
      price REAL DEFAULT 0,
      discount_price REAL,
      stage TEXT,
      video TEXT,
      img TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);

  const settingsResult = await db.prepare(
    `SELECT key, value FROM settings`
  ).all();

  const categoriesResult = await db.prepare(
    `SELECT * FROM categories ORDER BY rowid`
  ).all();

  const productsResult = await db.prepare(
    `SELECT * FROM products ORDER BY rowid`
  ).all();

  return Response.json({
    settings: Object.fromEntries(
      (settingsResult.results || []).map(x => [x.key, x.value])
    ),
    categories: categoriesResult.results || [],
    products: productsResult.results || []
  });
}
