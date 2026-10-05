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
    {
      id: "pre",
      name: "اقدام به بارداری",
      image: "category/pre.webp"
    },
    {
      id: "preg",
      name: "بارداری",
      image: "category/pregnancy.webp"
    },
    {
      id: "6m",
      name: "کودک ۶ ماه",
      image: "category/6m.webp"
    },
    {
      id: "7m",
      name: "کودک ۷ ماه",
      image: "category/7m.webp"
    },
    {
      id: "8m",
      name: "کودک ۸ ماه",
      image: "category/8m.webp"
    },
    {
      id: "9m",
      name: "کودک ۹ ماه",
      image: "category/9m.webp"
    },
    {
      id: "10m",
      name: "کودک ۱۰ ماه",
      image: "category/10m.webp"
    },
    {
      id: "11m",
      name: "کودک ۱۱ ماه",
      image: "category/11m.webp"
    },
    {
      id: "12m",
      name: "کودک ۱۲ ماه",
      image: "category/12m.webp"
    },
    {
      id: "post",
      name: "پس از زایمان و شیردهی",
      image: "category/postpartum.webp"
    },
    {
      id: "cycle",
      name: "قاعدگی",
      image: "category/cycle.webp"
    },
    {
      id: "uterus",
      name: "رحم و تخمدان",
      image: "category/uterus.webp"
    },
    {
      id: "elder",
      name: "پک مامانجون و باباجون",
      image: "category/elder.webp"
    },
    {
      id: "weak",
      name: "ضعف",
      image: "category/weak.webp"
    },
    {
      id: "test",
      name: "محصولات تست",
      image: "category/test.webp"
    }
  ],

  products: [
    {
      id: "1",
      name: "پودر کاچی ساده | ۳۵۰ گرم",
      price: 120000,
      img: ""
    },
    {
      id: "2",
      name: "کاچی ۴مغز۳ارد | ترکیب ۳ آرد",
      price: 450000,
      img: ""
    },
    {
      id: "3",
      name: "پودر کاچی کودک",
      price: 300000,
      img: ""
    },
    {
      id: "4",
      name: "پودر کاچی بَزَرَک",
      price: 409000,
      img: "kachi-bozorg.webp"
    },
    {
      id: "5",
      name: "پودر کاچی قاعدگی",
      price: 330000,
      img: ""
    },
    {
      id: "6",
      name: "پودر گداخته | کاچی مخصوص زایمان | ۲۵۰ گرم",
      price: 340000,
      img: ""
    },
    {
      id: "7",
      name: "چاشنی اُمیلا",
      price: 189000,
      img: "chasni-omega.webp"
    },
    {
      id: "8",
      name: "فرنی تخم خربزه",
      price: 135000,
      img: "farni-tokhm-kharbeze.webp"
    },
    {
      id: "9",
      name: "حریره بادام",
      price: 300000,
      img: ""
    },
    {
      id: "10",
      name: "حریره نارگیل",
      price: 400000,
      img: ""
    },
    {
      id: "11",
      name: "فرنی جوانه گندم",
      price: 450000,
      img: ""
    },
    {
      id: "12",
      name: "فرنی برنج ساده",
      price: 120000,
      img: ""
    },
    {
      id: "13",
      name: "فرنی کدوحلوایی",
      price: 500000,
      img: ""
    },
    {
      id: "14",
      name: "فرنی به، سیب",
      price: 550000,
      img: "farni-beh-sib.webp"
    },
    {
      id: "15",
      name: "سویلاک",
      price: 700000,
      img: ""
    }
  ]
};


/* --------------------------------------------------
   ساخت جدول‌ها
-------------------------------------------------- */

async function createTables(db) {
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
}


/* --------------------------------------------------
   وارد کردن اطلاعات اولیه
-------------------------------------------------- */

async function seedDatabase(db) {

  const countResult = await db
    .prepare(`SELECT COUNT(*) AS total FROM products`)
    .first();

  const totalProducts = Number(
    countResult?.total || 0
  );

  /*
    اگر اطلاعات قبلاً وارد شده باشد،
    دوباره وارد نمی‌کنیم.
  */

  if (totalProducts > 0) {
    return;
  }


  /* تنظیمات */

  for (const [key, value] of Object.entries(DATA.settings)) {

    await db
      .prepare(`
        INSERT OR REPLACE INTO settings
        (key, value)
        VALUES (?, ?)
      `)
      .bind(
        key,
        JSON.stringify(value)
      )
      .run();
  }


  /* دسته‌بندی‌ها */

  for (const category of DATA.categories) {

    await db
      .prepare(`
        INSERT OR REPLACE INTO categories
        (id, name, image)
        VALUES (?, ?, ?)
      `)
      .bind(
        category.id,
        category.name,
        category.image
      )
      .run();
  }


  /* محصولات */

  for (const product of DATA.products) {

    await db
      .prepare(`
        INSERT OR REPLACE INTO products
        (
          id,
          name,
          cat,
          desc,
          price,
          discount_price,
          stage,
          video,
          img,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        String(product.id),
        product.name || "",
        product.cat || "",
        product.desc || "",
        Number(product.price || 0),
        product.discountPrice == null
          ? null
          : Number(product.discountPrice),
        product.stage || "",
        product.video || "",
        product.img || "",
        product.active === false ? 0 : 1
      )
      .run();
  }
}


/* --------------------------------------------------
   API اصلی
   /api/store
-------------------------------------------------- */

export async function onRequestGet({ env }) {

  if (!env.DB) {

    return Response.json(
      {
        error: "D1 database is not configured"
      },
      {
        status: 500
      }
    );
  }


  try {

    const db = env.DB;


    /* ساخت جدول‌ها */

    await createTables(db);


    /* وارد کردن اطلاعات اولیه */

    await seedDatabase(db);


    /* دریافت تنظیمات */

    const settingsResult = await db
      .prepare(`
        SELECT key, value
        FROM settings
        ORDER BY key
      `)
      .all();


    /* دریافت دسته‌بندی‌ها */

    const categoriesResult = await db
      .prepare(`
        SELECT
          id,
          name,
          image
        FROM categories
        ORDER BY rowid
      `)
      .all();


    /* دریافت محصولات */

    const productsResult = await db
      .prepare(`
        SELECT
          id,
          name,
          cat,
          desc,
          price,
          discount_price,
          stage,
          video,
          img,
          active,
          created_at,
          updated_at
        FROM products
        ORDER BY rowid
      `)
      .all();


    /* تبدیل تنظیمات */

    const settings = {};

    for (const row of settingsResult.results || []) {

      try {

        settings[row.key] =
          JSON.parse(row.value);

      } catch {

        settings[row.key] =
          row.value;
      }
    }


    /* تبدیل محصولات به فرمت سایت */

    const products =
      (productsResult.results || []).map(
        product => ({
          id: product.id,
          name: product.name,
          cat: product.cat || "",
          desc: product.desc || "",
          price: Number(product.price || 0),
          discountPrice:
            product.discount_price == null
              ? 0
              : Number(product.discount_price),
          stage: product.stage || "",
          video: product.video || "",
          img: product.img || "",
          active: Number(product.active) === 1,
          createdAt: product.created_at || ""
        })
      );


    /* پاسخ نهایی */

    return new Response(
      JSON.stringify({
        settings,
        categories:
          categoriesResult.results || [],
        products
      }),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json; charset=utf-8",
          "cache-control":
            "no-store"
        }
      }
    );

  } catch (error) {

    return new Response(
      JSON.stringify({
        error:
          error?.message ||
          String(error)
      }),
      {
        status: 500,
        headers: {
          "content-type":
            "application/json; charset=utf-8",
          "cache-control":
            "no-store"
        }
      }
    );
  }
}
