const DATA = {
  settings: {
    showPrices: true,
    currency: "تومان",
    paymentEnabled: false,
    paymentProvider: "zarinpal",

    phone: "۰۹۲۲۷۱۴۰۷۲۶",
    eitaa: "https://eitaa.com/hilafood",
    instagram: "https://instagram.com/hila_mamaa",
    eitaaMama: "https://eitaa.com/hila_mama",

    /* ----------------------------------------------
       تنظیمات پیامک
       در صورت نبود این تنظیم در D1، پیامک فعال است
    ---------------------------------------------- */

    smsEnabled: true,

    shippingMethods: [
      {
        id: "post-pishtaz",
        name: "پست پیشتاز",
        price: 0,
        active: true
      },
      {
        id: "post-sefareshi",
        name: "پست سفارشی",
        price: 0,
        active: false
      }
    ]
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


/* ==================================================
   ابزار عمومی
================================================== */

function json(data, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=utf-8",

        "cache-control":
          "no-store"
      }
    }
  );
}


/* ==================================================
   ساخت جدول‌های D1
================================================== */

async function createTables(db) {

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `).run();


  await db.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image TEXT
    )
  `).run();


  await db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cat TEXT,
      "desc" TEXT,
      price REAL DEFAULT 0,
      discount_price REAL,
      stage TEXT,
      video TEXT,
      img TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();


  await db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      customer_name TEXT NOT NULL,

      customer_phone TEXT NOT NULL,

      customer_address TEXT NOT NULL,

      items TEXT NOT NULL,

      subtotal INTEGER DEFAULT 0,

      shipping_id TEXT DEFAULT '',

      shipping_name TEXT DEFAULT '',

      shipping_price INTEGER DEFAULT 0,

      total INTEGER DEFAULT 0,

      status TEXT DEFAULT 'new',

      payment_status TEXT DEFAULT 'unpaid',

      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
    // ================================
  // جداول دوره‌های آموزشی
  // ================================

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      price INTEGER DEFAULT 0,
      image TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS course_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE CASCADE
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS course_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      content_type TEXT DEFAULT 'text',
      content_url TEXT DEFAULT '',
      content_text TEXT DEFAULT '',
      image TEXT DEFAULT '',
      is_free INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chapter_id)
        REFERENCES course_chapters(id)
        ON DELETE CASCADE
    )
  `).run();
}


/* ==================================================
   تنظیمات اولیه
================================================== */

async function seedSettings(db) {

  for (
    const [key, value]
    of Object.entries(DATA.settings)
  ) {

    await db.prepare(`
      INSERT OR IGNORE INTO settings
      (key, value)
      VALUES (?, ?)
    `)
    .bind(
      key,
      JSON.stringify(value)
    )
    .run();
  }
}


/* ==================================================
   دسته‌بندی‌های اولیه
================================================== */

async function seedCategories(db) {

  for (const category of DATA.categories) {

    await db.prepare(`
      INSERT OR IGNORE INTO categories
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
}


/* ==================================================
   محصولات اولیه
================================================== */

async function seedProducts(db) {

  const countResult =
    await db.prepare(`
      SELECT COUNT(*) AS total
      FROM products
    `).first();


  const totalProducts =
    Number(
      countResult?.total || 0
    );


  if (totalProducts > 0) {
    return;
  }


  for (const product of DATA.products) {

    await db.prepare(`
      INSERT OR IGNORE INTO products
      (
        id,
        name,
        cat,
        "desc",
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

      Number(
        product.price || 0
      ),

      product.discountPrice == null
        ? null
        : Number(product.discountPrice),

      product.stage || "",

      product.video || "",

      product.img || "",

      product.active === false
        ? 0
        : 1
    )
    .run();
  }
}


/* ==================================================
   آماده‌سازی دیتابیس
================================================== */

async function setupDatabase(db) {

  await createTables(db);

  await seedSettings(db);

  await seedCategories(db);

  await seedProducts(db);
}


/* ==================================================
   بررسی کلید مدیریت
================================================== */

function isAdmin(request, env) {

  const key =
    request.headers.get(
      "x-admin-key"
    ) || "";

  return (
    !!env.ADMIN_KEY &&
    key === env.ADMIN_KEY
  );
}


/* ==================================================
   خواندن وضعیت فعال بودن پیامک
================================================== */

async function isSmsEnabled(db) {

  try {

    const result =
      await db.prepare(`
        SELECT value
        FROM settings
        WHERE key = 'smsEnabled'
      `)
      .first();


    if (!result?.value) {

      return true;
    }


    return JSON.parse(
      result.value
    ) !== false;

  } catch {

    return true;
  }
}


/* ==================================================
   ارسال SMS از طریق ASA SMS
================================================== */

async function sendSms(
  env,
  message
) {

  if (
    !env.SMS_API_KEY ||
    !env.SMS_TO ||
    !env.SMS_FROM
  ) {

    return {
      success: false,
      configured: false,
      error:
        "تنظیمات SMS در Cloudflare کامل نیست"
    };
  }


  try {

    const url =
      new URL(
        `https://api-payamak.com/api/v4/${encodeURIComponent(
          env.SMS_API_KEY
        )}/sms/send.json`
      );


    url.searchParams.set(
      "from",
      String(env.SMS_FROM)
    );


    url.searchParams.set(
      "recipients",
      String(env.SMS_TO)
    );


    url.searchParams.set(
      "message",
      String(message)
    );


    url.searchParams.set(
      "type",
      "0"
    );


    const response =
      await fetch(
        url.toString(),
        {
          method: "GET"
        }
      );


    const responseText =
      await response.text();


    let data = null;


    try {

      data =
        JSON.parse(
          responseText
        );

    } catch {

      data = null;
    }


    if (!response.ok) {

      console.error(
        "SMS HTTP error:",
        response.status,
        responseText
      );


      return {
        success: false,
        configured: true,
        error:
          `SMS HTTP ${response.status}`
      };
    }


    const apiStatus =
      Number(
        data?.return?.status ?? -1
      );


    if (
      apiStatus !== 200
    ) {

      console.error(
        "SMS API error:",
        responseText
      );


      return {
        success: false,
        configured: true,
        error:
          data?.return?.message ||
          "ارسال پیامک ناموفق بود"
      };
    }


    return {
      success: true,
      configured: true,
      messageId:
        data?.data?.messageid || null,
      response: data
    };

  } catch (error) {

    console.error(
      "SMS request failed:",
      error
    );


    return {
      success: false,
      configured: true,
      error:
        error?.message ||
        String(error)
    };
  }
}


/* ==================================================
   ارسال SMS سفارش
================================================== */

async function sendSmsOrderNotification(
  db,
  env,
  orderNumber,
  customerName,
  shippingName,
  total
) {

  const enabled =
    await isSmsEnabled(db);


  if (!enabled) {

    return;
  }


  const message =
`🛍 سفارش جدید هیلا فود
HF-${orderNumber}
مشتری: ${customerName}
مبلغ: ${Number(total).toLocaleString("fa-IR")} تومان
ارسال: ${shippingName}`;


  const result =
    await sendSms(
      env,
      message
    );


  if (!result.success) {

    console.error(
      "Order SMS failed:",
      result.error
    );
  }
}


/* ==================================================
   ارسال اعلان سفارش به ایتا
================================================== */

async function sendEitaaOrderNotification(
  env,
  orderNumber,
  customerName,
  customerPhone,
  customerAddress,
  items,
  subtotal,
  shippingName,
  shippingPrice,
  total
) {

  if (
    !env.EITAA_TOKEN ||
    !env.EITAA_CHAT_ID
  ) {
    return;
  }


  const itemsText =
    items
      .map(item =>
        `• ${item.name} × ${item.qty} — ${Number(
          item.price * item.qty
        ).toLocaleString("fa-IR")} تومان`
      )
      .join("\n");


  const message =
`🛍 سفارش جدید هیلا فود

🔢 شماره سفارش:
HF-${orderNumber}

👤 مشتری:
${customerName}

📱 موبایل:
${customerPhone}

📍 آدرس:
${customerAddress}

🧺 محصولات:
${itemsText}

💰 مبلغ کالاها:
${Number(subtotal).toLocaleString("fa-IR")} تومان

🚚 روش ارسال:
${shippingName}

💰 هزینه ارسال:
${Number(shippingPrice).toLocaleString("fa-IR")} تومان

💵 مبلغ نهایی:
${Number(total).toLocaleString("fa-IR")} تومان

💳 پرداخت:
پرداخت نشده

📌 وضعیت:
جدید`;


  try {

    const url =
      `https://eitaayar.ir/api/${encodeURIComponent(
        env.EITAA_TOKEN
      )}/sendMessage`;


    const body =
      new URLSearchParams({

        chat_id:
          String(env.EITAA_CHAT_ID),

        text:
          message,

        title:
          "سفارش جدید هیلا فود"

      });


    await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body
      }
    );

  } catch (error) {

    console.error(
      "Eitaa notification failed:",
      error
    );

  }
}


/* ==================================================
   خواندن اطلاعات کامل فروشگاه
================================================== */

async function getStore(db) {

  const settingsResult =
    await db.prepare(`
      SELECT key, value
      FROM settings
      ORDER BY key
    `).all();


  const categoriesResult =
    await db.prepare(`
      SELECT id, name, image
      FROM categories
      ORDER BY rowid
    `).all();


  const productsResult =
    await db.prepare(`
      SELECT
        id,
        name,
        cat,
        "desc",
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
    `).all();


  const settings = {};


  for (
    const row
    of settingsResult.results || []
  ) {

    try {

      settings[row.key] =
        JSON.parse(row.value);

    } catch {

      settings[row.key] =
        row.value;
    }
  }


  if (
    !Array.isArray(
      settings.shippingMethods
    )
  ) {

    settings.shippingMethods = [

      {
        id: "post-pishtaz",
        name: "پست پیشتاز",
        price: 0,
        active: true
      },

      {
        id: "post-sefareshi",
        name: "پست سفارشی",
        price: 0,
        active: false
      }

    ];
  }


  if (
    typeof settings.smsEnabled !==
    "boolean"
  ) {

    settings.smsEnabled = true;
  }


  const products =
    (
      productsResult.results || []
    ).map(product => ({

      id: product.id,

      name: product.name,

      cat:
        product.cat || "",

      desc:
        product.desc || "",

      price:
        Number(
          product.price || 0
        ),

      discountPrice:
        product.discount_price == null
          ? 0
          : Number(
              product.discount_price
            ),

      stage:
        product.stage || "",

      video:
        product.video || "",

      img:
        product.img || "",

      active:
        Number(product.active) === 1,

      createdAt:
        product.created_at || "",

      updatedAt:
        product.updated_at || ""

    }));


  return {

    settings,

    categories:
      categoriesResult.results || [],

    products

  };
}


/* ==================================================
   GET
================================================== */

export async function onRequestGet({
  env
}) {

  if (!env.DB) {

    return json({
      error:
        "D1 database is not configured"
    }, 500);
  }


  try {

    const db =
      env.DB;




    const store =
      await getStore(db);


    return json(store);

  } catch (error) {

    return json({
      error:
        error?.message ||
        String(error)
    }, 500);
  }
}


/* ==================================================
   POST
================================================== */

export async function onRequestPost({
  request,
  env
}) {

  if (!env.DB) {

    return json({
      error:
        "D1 database is not configured"
    }, 500);
  }


  try {

    const db =
      env.DB;


    const body =
      await request.json();


    const action =
      body.action || "";
        // =========================================
    // مدیریت دوره‌های آموزشی
    // =========================================

    if (
      action === "admin-courses-list" ||
      action === "admin-course-create" ||
      action === "admin-course-update" ||
      action === "admin-course-delete"
    ) {

      const adminKey =
        request.headers.get("x-admin-key") || "";

      if (
        !env.ADMIN_KEY ||
        adminKey !== env.ADMIN_KEY
      ) {

        return json({
          error: "دسترسی غیرمجاز"
        }, 403);

      }

      // لیست دوره‌ها
      if (action === "admin-courses-list") {

        const result =
          await db.prepare(`
            SELECT *
            FROM courses
            ORDER BY id DESC
          `).all();

        return json({
          courses: result.results || []
        });

      }

      // افزودن دوره
      if (action === "admin-course-create") {

        const title =
          String(body.title || "").trim();

        if (!title) {

          return json({
            error: "نام دوره الزامی است"
          }, 400);

        }

        const slug =
          String(
            body.slug ||
            title
              .toLowerCase()
              .replace(/\s+/g, "-")
          ).trim();

        const description =
          String(body.description || "");

        const price =
          Math.max(
            0,
            Number(body.price || 0)
          );

        const image =
          String(body.image || "");

        const active =
          body.active === false ? 0 : 1;

        const result =
          await db.prepare(`
            INSERT INTO courses
            (
              title,
              slug,
              description,
              price,
              image,
              active
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .bind(
            title,
            slug,
            description,
            price,
            image,
            active
          )
          .run();

        return json({
          ok: true,
          id: result.meta?.last_row_id || null
        });

      }

      // ویرایش دوره
      if (action === "admin-course-update") {

        const id =
          Number(body.id || 0);

        if (!id) {

          return json({
            error: "شناسه دوره نامعتبر است"
          }, 400);

        }

        const title =
          String(body.title || "").trim();

        if (!title) {

          return json({
            error: "نام دوره الزامی است"
          }, 400);

        }

        const slug =
          String(body.slug || "").trim();

        const description =
          String(body.description || "");

        const price =
          Math.max(
            0,
            Number(body.price || 0)
          );

        const image =
          String(body.image || "");

        const active =
          body.active === false ? 0 : 1;

        await db.prepare(`
          UPDATE courses
          SET
            title = ?,
            slug = ?,
            description = ?,
            price = ?,
            image = ?,
            active = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          title,
          slug,
          description,
          price,
          image,
          active,
          id
        )
        .run();

        return json({
          ok: true
        });

      }

      // حذف دوره
      if (action === "admin-course-delete") {

        const id =
          Number(body.id || 0);

        if (!id) {

          return json({
            error: "شناسه دوره نامعتبر است"
          }, 400);

        }

        await db.prepare(`
          DELETE FROM courses
          WHERE id = ?
        `)
        .bind(id)
        .run();

        return json({
          ok: true
        });

      }

    }


    /* ==================================================
       ثبت سفارش مشتری
       این بخش عمومی است و ADMIN_KEY نمی‌خواهد
    ================================================== */

    if (action === "create-order") {

      const customer =
        body.customer || {};


      const items =
        Array.isArray(body.items)
          ? body.items
          : [];


      const shippingId =
        String(
          body.shippingId || ""
        );


      const customerName =
        String(
          customer.name || ""
        ).trim();


      const customerPhone =
        String(
          customer.phone || ""
        ).trim();


      const customerAddress =
        String(
          customer.address || ""
        ).trim();


      if (!customerName) {

        return json({
          error:
            "نام مشتری الزامی است"
        }, 400);
      }


      if (!customerPhone) {

        return json({
          error:
            "شماره موبایل الزامی است"
        }, 400);
        }


      if (!customerAddress) {

        return json({
          error:
            "آدرس الزامی است"
        }, 400);
      }


      if (!items.length) {

        return json({
          error:
            "سبد خرید خالی است"
        }, 400);
      }


      /* ----------------------------------------------
         محاسبه مبلغ محصولات از D1
      ---------------------------------------------- */

      let subtotal = 0;

      const cleanItems = [];


      for (const item of items) {

        const productId =
          String(
            item.id || ""
          );


        const quantity =
          Math.max(
            1,
            Math.floor(
              Number(
                item.qty || 1
              )
            )
          );


        if (!productId) {
          continue;
        }


        const product =
          await db.prepare(`
            SELECT
              id,
              name,
              price,
              discount_price,
              active
            FROM products
            WHERE id = ?
          `)
          .bind(productId)
          .first();


        if (!product) {
          continue;
        }


        if (
          Number(product.active) !== 1
        ) {
          continue;
        }


        const price =
          Number(
            product.discount_price != null &&
            Number(product.discount_price) > 0 &&
            Number(product.discount_price) <
              Number(product.price || 0)

              ? product.discount_price

              : product.price || 0
          );


        if (price <= 0) {
          continue;
        }


        subtotal +=
          price * quantity;


        cleanItems.push({

          id:
            product.id,

          name:
            product.name,

          qty:
            quantity,

          price

        });
      }


      if (!cleanItems.length) {

        return json({
          error:
            "هیچ محصول معتبر و فعالی در سفارش وجود ندارد"
        }, 400);
      }


      /* ----------------------------------------------
         دریافت روش ارسال از D1
      ---------------------------------------------- */

      const shippingSetting =
        await db.prepare(`
          SELECT value
          FROM settings
          WHERE key = 'shippingMethods'
        `)
        .first();


      let shippingMethods = [];


      if (shippingSetting?.value) {

        try {

          shippingMethods =
            JSON.parse(
              shippingSetting.value
            );

        } catch {

          shippingMethods = [];

        }
      }


      if (
        !Array.isArray(
          shippingMethods
        )
      ) {

        shippingMethods = [];

      }


      const shipping =
        shippingMethods.find(
          method =>
            method &&
            method.active !== false &&
            String(method.id) ===
            shippingId
        );


      if (!shipping) {

        return json({
          error:
            "روش ارسال انتخاب‌شده معتبر نیست"
        }, 400);
      }


      const shippingPrice =
        Math.max(
          0,
          Number(
            shipping.price || 0
          )
        );


      const total =
        subtotal +
        shippingPrice;


      /* ----------------------------------------------
         ذخیره سفارش
      ---------------------------------------------- */

      const result =
        await db.prepare(`
          INSERT INTO orders
          (
            customer_name,
            customer_phone,
            customer_address,
            items,
            subtotal,
            shipping_id,
            shipping_name,
            shipping_price,
            total,
            status,
            payment_status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(

          customerName,

          customerPhone,

          customerAddress,

          JSON.stringify(
            cleanItems
          ),

          subtotal,

          String(
            shipping.id
          ),

          String(
            shipping.name
          ),

          shippingPrice,

          total,

          "new",

          "unpaid"

        )
        .run();


      const orderNumber =
        Number(
          result.meta?.last_row_id || 0
        );


      /* ----------------------------------------------
         اعلان سفارش در کانال ایتا
      ---------------------------------------------- */

      await sendEitaaOrderNotification(

        env,

        orderNumber,

        customerName,

        customerPhone,

        customerAddress,

        cleanItems,

        subtotal,

        String(
          shipping.name
        ),

        shippingPrice,

        total

      );


      /* ----------------------------------------------
         اعلان سفارش از طریق SMS
         خطای SMS نباید ثبت سفارش را خراب کند
      ---------------------------------------------- */

      await sendSmsOrderNotification(

        db,

        env,

        orderNumber,

        customerName,

        String(
          shipping.name
        ),

        total

      );


      return json({

        success: true,

        orderId:
          `HF-${orderNumber}`,

        orderNumber,

        customerName,

        subtotal,

        shippingPrice,

        total,

        shipping: {

          id:
            shipping.id,

          name:
            shipping.name,

          price:
            shippingPrice

        },

        items:
          cleanItems

      });
    }


    /* ==================================================
       از اینجا به بعد فقط مدیریت
    ================================================== */

    if (!isAdmin(request, env)) {

      return json({
        error:
          "Unauthorized"
      }, 401);
    }


    /* ----------------------------------------------
       بررسی کلید مدیریت
    ---------------------------------------------- */

    if (action === "check-admin") {

      return json({
        success: true
      });
    }


    /* ----------------------------------------------
       وضعیت اتصال پیامک
    ---------------------------------------------- */

    if (action === "get-sms-status") {

      const enabled =
        await isSmsEnabled(db);


      const configured =
        !!(
          env.SMS_API_KEY &&
          env.SMS_TO &&
          env.SMS_FROM
        );


      return json({

        success: true,

        enabled,

        configured,

        hasApiKey:
          !!env.SMS_API_KEY,

        hasRecipient:
          !!env.SMS_TO,

        hasSender:
          !!env.SMS_FROM

      });
    }


    /* ----------------------------------------------
       فعال / غیرفعال کردن پیامک
    ---------------------------------------------- */

    if (action === "save-sms-settings") {

      const enabled =
        body.enabled !== false;


      await db.prepare(`
        INSERT INTO settings
        (key, value)
        VALUES (?, ?)
        ON CONFLICT(key)
        DO UPDATE SET
          value = excluded.value
      `)
      .bind(

        "smsEnabled",

        JSON.stringify(
          enabled
        )

      )
      .run();


      return json({

        success: true,

        enabled

      });
    }


    /* ----------------------------------------------
       ارسال SMS تست
    ---------------------------------------------- */

    if (action === "send-sms-test") {

      const result =
        await sendSms(

          env,

          `🧪 پیام تست هیلا فود

اتصال سیستم پیامکی با موفقیت برقرار شد.

هیلا فود`

        );


      if (!result.success) {

        return json({

          success: false,

          error:
            result.error ||
            "ارسال پیامک تست ناموفق بود"

        }, 400);
      }


      return json({

        success: true,

        message:
          "پیامک تست با موفقیت به سرویس ارسال شد",

        messageId:
          result.messageId || null

      });
    }


    /* ----------------------------------------------
       افزودن محصول
    ---------------------------------------------- */

    if (action === "create-product") {

      const p =
        body.product || {};


      if (
        !String(
          p.name || ""
        ).trim()
      ) {

        return json({
          error:
            "نام محصول الزامی است"
        }, 400);
      }


      const id =
        String(
          p.id ||
          Date.now()
        );


      await db.prepare(`
        INSERT INTO products
        (
          id,
          name,
          cat,
          "desc",
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

        id,

        String(
          p.name || ""
        ).trim(),

        String(
          p.cat || ""
        ),

        String(
          p.desc || ""
        ),

        Number(
          p.price || 0
        ),

        p.discountPrice == null ||
        p.discountPrice === ""
          ? null
          : Number(
              p.discountPrice
            ),

        String(
          p.stage || ""
        ),

        String(
          p.video || ""
        ),

        String(
          p.img || ""
        ),

        p.active === false
          ? 0
          : 1

      )
      .run();


      return json({
        success: true,
        id
      });
    }


    /* ----------------------------------------------
       ذخیره تنظیمات فروشگاه
    ---------------------------------------------- */

    if (action === "save-settings") {

      const settings =
        body.settings || {};


      for (
        const [key, value]
        of Object.entries(settings)
      ) {

        await db.prepare(`
          INSERT INTO settings
          (key, value)
          VALUES (?, ?)
          ON CONFLICT(key)
          DO UPDATE SET
            value = excluded.value
        `)
        .bind(

          key,

          JSON.stringify(
            value
          )

        )
        .run();
      }


      return json({
        success: true
      });
    }


    /* ----------------------------------------------
       ذخیره نوع ارسال و کرایه
    ---------------------------------------------- */

    if (action === "save-shipping") {

      let shippingMethods =
        body.shippingMethods;


      if (
        !Array.isArray(
          shippingMethods
        )
      ) {

        return json({
          error:
            "اطلاعات روش‌های ارسال نامعتبر است"
        }, 400);
      }


      shippingMethods =
        shippingMethods

          .map(
            (item, index) => ({

              id:
                String(
                  item.id ||
                  `shipping-${Date.now()}-${index}`
                ),

              name:
                String(
                  item.name || ""
                ).trim(),

              price:
                Math.max(
                  0,
                  Number(
                    item.price || 0
                  )
                ),

              active:
                item.active !== false

            })
          )

          .filter(
            item =>
              item.name
          );


      await db.prepare(`
        INSERT INTO settings
        (key, value)
        VALUES (?, ?)
        ON CONFLICT(key)
        DO UPDATE SET
          value = excluded.value
      `)
      .bind(

        "shippingMethods",

        JSON.stringify(
          shippingMethods
        )

      )
      .run();


      return json({

        success: true,

        shippingMethods

      });
    }


    /* ----------------------------------------------
       دریافت سفارش‌ها برای مدیریت
    ---------------------------------------------- */

    if (action === "get-orders") {

      const ordersResult =
        await db.prepare(`
          SELECT
            id,
            customer_name,
            customer_phone,
            customer_address,
            items,
            subtotal,
            shipping_id,
            shipping_name,
            shipping_price,
            total,
            status,
            payment_status,
            created_at
          FROM orders
          ORDER BY id DESC
        `)
        .all();


      const orders =
        (ordersResult.results || [])
          .map(order => {

            let items = [];

            try {

              items =
                JSON.parse(
                  order.items || "[]"
                );

            } catch {

              items = [];

            }


            return {

              id:
                order.id,

              orderId:
                `HF-${order.id}`,

              customerName:
                order.customer_name,

              customerPhone:
                order.customer_phone,

              customerAddress:
                order.customer_address,

              items,

              subtotal:
                Number(
                  order.subtotal || 0
                ),

              shippingId:
                order.shipping_id,

              shippingName:
                order.shipping_name,

              shippingPrice:
                Number(
                  order.shipping_price || 0
                ),

              total:
                Number(
                  order.total || 0
                ),

              status:
                order.status || "new",

              paymentStatus:
                order.payment_status ||
                "unpaid",

              createdAt:
                order.created_at

            };

          });


      return json({

        success: true,

        orders

      });
    }


    /* ----------------------------------------------
       تغییر وضعیت سفارش
    ---------------------------------------------- */

    if (action === "update-order") {

      const orderId =
        Number(
          body.orderId || 0
        );


      if (!orderId) {

        return json({
          error:
            "شماره سفارش نامعتبر است"
        }, 400);

      }


      const status =
        String(
          body.status || "new"
        );


      const paymentStatus =
        String(
          body.paymentStatus || "unpaid"
        );


      const allowedStatuses = [
        "new",
        "processing",
        "shipped",
        "completed",
        "cancelled"
      ];


      const allowedPaymentStatuses = [
        "unpaid",
        "paid",
        "failed"
      ];


      if (
        !allowedStatuses.includes(
          status
        )
      ) {

        return json({
          error:
            "وضعیت سفارش نامعتبر است"
        }, 400);

      }


      if (
        !allowedPaymentStatuses.includes(
          paymentStatus
        )
      ) {

        return json({
          error:
            "وضعیت پرداخت نامعتبر است"
        }, 400);

      }


      const result =
        await db.prepare(`
          UPDATE orders
          SET
            status = ?,
            payment_status = ?
          WHERE id = ?
        `)
        .bind(
          status,
          paymentStatus,
          orderId
        )
        .run();


      if (
        !result.meta?.changes
      ) {

        return json({
          error:
            "سفارش پیدا نشد"
        }, 404);

      }


      return json({

        success: true

      });
    }


    return json({
      error:
        "Unknown action"
    }, 400);


  } catch (error) {

    console.error(
      "POST store error:",
      error
    );


    return json({

      error:
        error?.message ||
        String(error)

    }, 500);
  }
}


/* ==================================================
   PUT
================================================== */

export async function onRequestPut({
  request,
  env
}) {

  if (!env.DB) {

    return json({
      error:
        "D1 database is not configured"
    }, 500);
  }


  if (!isAdmin(request, env)) {

    return json({
      error:
        "Unauthorized"
    }, 401);
  }


  try {

    const db =
      env.DB;



    const body =
      await request.json();


    const p =
      body.product || {};


    const id =
      String(
        p.id || ""
      );


    if (!id) {

      return json({
        error:
          "شناسه محصول الزامی است"
      }, 400);
    }


    const exists =
      await db.prepare(`
        SELECT id
        FROM products
        WHERE id = ?
      `)
      .bind(id)
      .first();


    if (!exists) {

      return json({
        error:
          "محصول پیدا نشد"
      }, 404);
    }


    await db.prepare(`
      UPDATE products
      SET
        name = ?,
        cat = ?,
        "desc" = ?,
        price = ?,
        discount_price = ?,
        stage = ?,
        video = ?,
        img = ?,
        active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(

      String(
        p.name || ""
      ).trim(),

      String(
        p.cat || ""
      ),

      String(
        p.desc || ""
      ),

      Number(
        p.price || 0
      ),

      p.discountPrice == null ||
      p.discountPrice === ""
        ? null
        : Number(
            p.discountPrice
          ),

      String(
        p.stage || ""
      ),

      String(
        p.video || ""
      ),

      String(
        p.img || ""
      ),

      p.active === false
        ? 0
        : 1,

      id

    )
    .run();


    return json({

      success: true,

      id

    });

  } catch (error) {

    console.error(
      "PUT store error:",
      error
    );


    return json({

      error:
        error?.message ||
        String(error)

    }, 500);
  }
          }
