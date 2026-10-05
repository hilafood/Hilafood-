const DATA = {
  settings: {
    showPrices: true,
    currency: "تومان",
    paymentEnabled: false,
    paymentProvider: "zarinpal",
    phone: "۰۹۲۲۷۱۴۰۷۲۶",
    eitaa: "https://eitaa.com/hilafood",
    instagram: "https://instagram.com/hila_mamaa",
    eitaaMama: "https://eitaa.com/hila_mama"
  },

  categories: [
    ["pre","اقدام به بارداری","category/pre.webp"],
    ["preg","بارداری","category/pregnancy.webp"],
    ["6m","کودک ۶ ماه","category/6m.webp"],
    ["7m","کودک ۷ ماه","category/7m.webp"],
    ["8m","کودک ۸ ماه","category/8m.webp"],
    ["9m","کودک ۹ ماه","category/9m.webp"],
    ["10m","کودک ۱۰ ماه","category/10m.webp"],
    ["11m","کودک ۱۱ ماه","category/11m.webp"],
    ["12m","کودک ۱۲ ماه","category/12m.webp"],
    ["post","پس از زایمان و شیردهی","category/postpartum.webp"],
    ["cycle","قاعدگی","category/cycle.webp"],
    ["uterus","رحم و تخمدان","category/uterus.webp"],
    ["elder","پک مامانجون و باباجون","category/elder.webp"],
    ["weak","ضعف","category/weak.webp"],
    ["test","محصولات تست","category/test.webp"]
  ],

  products: [
    [1,"پودر کاچی ساده | ۳۵۰ گرم",120000,""],
    [2,"کاچی ۴مغز ۳آرد",450000,""],
    [3,"پودر کاچی کودک",300000,""],
    [4,"پودر کاچی بَزَرَک",409000,"kachi-bozorg.webp"],
    [5,"پودر کاچی قاعدگی",330000,""],
    [6,"پودر گداخته، کاچی مخصوص زایمان، ۲۵۰ گرم",340000,""],
    [7,"چاشنی اُمیلا",189000,"chasni-omega.webp"],
    [8,"فرنی تخم خربزه",135000,"farni-tokhm-kharbeze.webp"],
    [9,"حریره بادام",300000,""],
    [10,"حریره نارگیل",400000,""],
    [11,"فرنی جوانه گندم",450000,""],
    [12,"فرنی برنج ساده",120000,""],
    [13,"فرنی کدوحلوایی",500000,""],
    [14,"فرنی به، سیب",550000,"farni-beh-sib.webp"],
    [15,"سَویلاک",700000,""]
  ]
};

async function setup(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        image TEXT
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS products (
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
      )
    `)
  ]);

  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM products")
    .first();

  if (Number(count?.n || 0) === 0) {

    const commands = [];

    for (const [key,value] of Object.entries(DATA.settings)) {
      commands.push(
        db.prepare(
          "INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
          [key, JSON.stringify(value)]
        )
      );
    }

    for (const [id,name,image] of DATA.categories) {
      commands.push(
        db.prepare(
          "INSERT OR REPLACE INTO categories (id,name,image) VALUES (?,?,?)",
          [id,name,image]
        )
      );
    }

    for (const [id,name,price,img] of DATA.products) {
      commands.push(
        db.prepare(`
          INSERT OR REPLACE INTO products
          (id,name,cat,desc,price,discount_price,stage,video,img,active)
          VALUES (?,?,?,?,?,?,?,?,?,?)
        `,[
          String(id),
          name,
          "",
          "",
          price,
          0,
          "",
          "",
          img,
          1
        ])
      );
    }

    await db.batch(commands);
  }
}

export async function onRequestGet({ env }) {

  if (!env.DB) {
    return Response.json(
      {error:"D1 binding DB is not configured"},
      {status:500}
    );
  }

  try {

    await setup(env.DB);

    const s = await env.DB
      .prepare("SELECT key,value FROM settings")
      .all();

    const c = await env.DB
      .prepare("SELECT * FROM categories ORDER BY rowid")
      .all();

    const p = await env.DB
      .prepare("SELECT * FROM products ORDER BY rowid")
      .all();

    const settings = {};

    for (const row of s.results || []) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    const products = (p.results || []).map(x => ({
      id: x.id,
      name: x.name,
      cat: x.cat || "",
      desc: x.desc || "",
      price: Number(x.price || 0),
      discountPrice: Number(x.discount_price || 0),
      stage: x.stage || "",
      video: x.video || "",
      img: x.img || "",
      active: !!x.active,
      createdAt: x.created_at || ""
    }));

    return new Response(
      JSON.stringify({
        settings,
        categories: c.results || [],
        products
      }),
      {
        headers: {
          "content-type":"application/json; charset=utf-8",
          "cache-control":"no-store"
        }
      }
    );

  } catch (e) {

    return new Response(
      JSON.stringify({
        error: String(e?.message || e)
      }),
      {
        status:500,
        headers:{
          "content-type":"application/json; charset=utf-8"
        }
      }
    );
  }
}
