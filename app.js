let STORE = {
  settings: {
    showPrices: false,
    currency: "تومان",
    paymentEnabled: false
  },
  products: [],
  categories: []
};

let cart = JSON.parse(
  localStorage.getItem("hilaCart") || "[]"
);


/* --------------------------------------------------
   ابزارهای عمومی
-------------------------------------------------- */

const $ = id => document.getElementById(id);

function img(path) {
  const v = String(path || "");

  if (!v) return "";

  if (
    v.startsWith("assets/") ||
    v.startsWith("category/")
  ) {
    return v;
  }

  return "assets/" + v;
}


function money(n) {
  return (
    Number(n || 0).toLocaleString("fa-IR") +
    " " +
    (STORE.settings.currency || "تومان")
  );
}


function finalPrice(product) {
  return Number(
    product.discountPrice > 0
      ? product.discountPrice
      : product.price || 0
  );
}


/* --------------------------------------------------
   دریافت اطلاعات از D1
-------------------------------------------------- */

async function load() {

  try {

    const response = await fetch(
      "/api/store?v=" + Date.now(),
      {
        cache: "no-store"
      }
    );


    if (!response.ok) {
      throw new Error(
        "خطا در دریافت اطلاعات فروشگاه"
      );
    }


    const data = await response.json();


    if (data.error) {
      throw new Error(data.error);
    }


    STORE = {
      settings: data.settings || {},
      categories: data.categories || [],
      products: data.products || []
    };


  } catch (error) {

    console.error(
      "Store loading error:",
      error
    );


    alert(
      "اطلاعات فروشگاه دریافت نشد. لطفاً دوباره تلاش کنید."
    );


    STORE = {
      settings: {
        showPrices: false,
        currency: "تومان",
        paymentEnabled: false
      },
      products: [],
      categories: []
    };
  }


  renderCategories();

  renderProducts(
    STORE.products.filter(
      p => p.active !== false
    )
  );

  updateCart();

  renderVideo();
}


/* --------------------------------------------------
   دسته‌بندی‌ها
-------------------------------------------------- */

function renderCategories() {

  const el = $("categoryRail");

  if (!el) return;


  el.innerHTML =
    (STORE.categories || [])
      .map(c => {

        return `
          <a
            class="category-card"
            href="category.html?cat=${encodeURIComponent(
              c.name
            )}"
          >

            ${
              c.image
                ? `
                  <img
                    src="${img(c.image)}"
                    loading="lazy"
                    alt="${c.name}"
                  >
                `
                : ""
            }

            <b>${c.name}</b>

          </a>
        `;

      })
      .join("");
}


/* --------------------------------------------------
   کارت محصول
-------------------------------------------------- */

function card(product) {

  const discount =
    Number(product.discountPrice || 0) > 0 &&
    Number(product.discountPrice || 0) <
      Number(product.price || 0);


  let price = "";


  if (STORE.settings.showPrices) {

    price = discount

      ? `
        <del>
          ${money(product.price)}
        </del>

        <strong>
          ${money(product.discountPrice)}
        </strong>
      `

      : money(product.price);

  } else {

    price = "قیمت فعلاً اعلام نشده";

  }


  const category =
    product.stage ||
    product.cat ||
    "";


  const imageHTML = product.img

    ? `
      <img
        src="${img(product.img)}"
        loading="lazy"
        alt="${product.name}"
      >
    `

    : `
      <div class="no-image-text">
        تصویر محصول
        <br>
        <small>
          هنوز اضافه نشده
        </small>
      </div>
    `;


  return `

    <article class="product">

      <a
        href="category.html?cat=${encodeURIComponent(
          category
        )}"
      >

        <div
          class="photo ${
            product.img ? "" : "no-image"
          }"
        >

          ${imageHTML}

          <span class="badge">
            ${
              discount
                ? "تخفیف"
                : "فراسودمند"
            }
          </span>

        </div>

      </a>


      <div class="product-body">

        <small>
          ${product.cat || ""}
          ${
            product.stage
              ? " | " + product.stage
              : ""
          }
        </small>


        <h3>
          ${product.name}
        </h3>


        <p>
          ${product.desc || ""}
        </p>


        <div class="product-foot">

          <span>
            ${price}
          </span>


          <button
            class="details"
            onclick="addToCart('${product.id}')"
          >
            افزودن
          </button>

        </div>

      </div>

    </article>

  `;
}


/* --------------------------------------------------
   نمایش محصولات
-------------------------------------------------- */

function renderProducts(list) {

  const productRail =
    $("productRail");


  if (productRail) {

    productRail.innerHTML =
      list
        .map(card)
        .join("");

  }


  const discountRail =
    $("discountRail");


  if (!discountRail) return;


  const discounted =
    list.filter(
      product =>
        Number(product.discountPrice || 0) > 0 &&
        Number(product.discountPrice || 0) <
          Number(product.price || 0)
    );


  discountRail.innerHTML =
    discounted.length

      ? discounted
          .map(card)
          .join("")

      : `
        <div class="empty">
          فعلاً محصولی با تخفیف ثبت نشده است.
        </div>
      `;
}


/* --------------------------------------------------
   جستجوی محصولات
-------------------------------------------------- */

function filterProducts(q) {

  q = (q || "").trim();


  const result =
    STORE.products.filter(product => {

      if (product.active === false) {
        return false;
      }


      if (!q) {
        return true;
      }


      return (

        String(product.name || "")
          .includes(q)

        ||

        String(product.cat || "")
          .includes(q)

        ||

        String(product.desc || "")
          .includes(q)

        ||

        String(product.stage || "")
          .includes(q)

      );

    });


  renderProducts(result);
}


/* --------------------------------------------------
   ویدئوی محصول
-------------------------------------------------- */

function renderVideo() {

  const videoBox =
    $("videoBox");


  if (!videoBox) return;


  const product =
    STORE.products.find(
      x => x.video
    );


  if (!product) return;


  videoBox.innerHTML = `

    <div>

      <h3>
        ${product.name}
      </h3>

      <p>
        برای مشاهده طرز آماده‌سازی،
        ویدئوی محصول را ببینید.
      </p>

      <a
        class="btn purple"
        href="${product.video}"
        target="_blank"
        rel="noopener"
      >
        ▶ مشاهده ویدئو
      </a>

    </div>

  `;
}


/* --------------------------------------------------
   افزودن به سبد
-------------------------------------------------- */

function addToCart(id) {

  const product =
    STORE.products.find(
      x =>
        String(x.id) ===
        String(id)
    );


  if (
    !product ||
    !STORE.settings.showPrices ||
    !finalPrice(product)
  ) {

    alert(
      "قیمت این محصول هنوز ثبت یا فعال نشده است."
    );

    return;
  }


  const existing =
    cart.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (existing) {

    existing.qty++;

  } else {

    cart.push({
      id: product.id,
      qty: 1
    });

  }


  localStorage.setItem(
    "hilaCart",
    JSON.stringify(cart)
  );


  updateCart();

  openCart();
}


/* --------------------------------------------------
   بروزرسانی سبد خرید
-------------------------------------------------- */

function updateCart() {

  document
    .querySelectorAll(".cart-count")
    .forEach(element => {

      element.textContent =
        cart
          .reduce(
            (sum, item) =>
              sum + item.qty,
            0
          )
          .toLocaleString("fa-IR");

    });


  const cartItems =
    $("cartItems");


  if (!cartItems) return;


  cartItems.innerHTML =
    cart.length

      ? cart
          .map(item => {

            const product =
              STORE.products.find(
                p =>
                  String(p.id) ===
                  String(item.id)
              );


            if (!product) {
              return "";
            }


            return `

              <div class="cart-row">

                <b>

                  ${product.name}

                  <small>
                    ${money(
                      finalPrice(product)
                    )}
                  </small>

                </b>


                <div class="qty">

                  <button
                    onclick="qty('${product.id}',-1)"
                  >
                    −
                  </button>

                  ${item.qty}

                  <button
                    onclick="qty('${product.id}',1)"
                  >
                    +
                  </button>

                </div>

              </div>

            `;

          })
          .join("")

      : `
        <div class="empty">
          سبد خرید خالی است.
        </div>
      `;


  const total =
    cart.reduce(
      (sum, item) => {

        const product =
          STORE.products.find(
            p =>
              String(p.id) ===
              String(item.id)
          );


        return (
          sum +
          (
            product
              ? finalPrice(product) *
                item.qty
              : 0
          )
        );

      },
      0
    );


  const cartTotal =
    $("cartTotal");


  if (cartTotal) {

    cartTotal.textContent =
      money(total);

  }
}


/* --------------------------------------------------
   تغییر تعداد
-------------------------------------------------- */

function qty(id, change) {

  const item =
    cart.find(
      x =>
        String(x.id) ===
        String(id)
    );


  if (!item) return;


  item.qty += change;


  if (item.qty < 1) {

    cart =
      cart.filter(
        x =>
          String(x.id) !==
          String(id)
      );

  }


  localStorage.setItem(
    "hilaCart",
    JSON.stringify(cart)
  );


  updateCart();
}


/* --------------------------------------------------
   باز کردن سبد
-------------------------------------------------- */

function openCart() {

  const drawer =
    $("cartDrawer");

  const shade =
    $("cartShade");


  if (drawer) {
    drawer.classList.add("open");
  }


  if (shade) {
    shade.classList.add("show");
  }
}


/* --------------------------------------------------
   بستن سبد
-------------------------------------------------- */

function closeCart() {

  const drawer =
    $("cartDrawer");

  const shade =
    $("cartShade");


  if (drawer) {
    drawer.classList.remove("open");
  }


  if (shade) {
    shade.classList.remove("show");
  }
}


/* --------------------------------------------------
   منوی موبایل
-------------------------------------------------- */

function toggleMenu() {

  const drawer =
    $("drawer");

  const shade =
    $("shade");


  if (drawer) {
    drawer.classList.toggle("open");
  }


  if (shade) {
    shade.classList.toggle("show");
  }
}


/* --------------------------------------------------
   پرداخت
-------------------------------------------------- */

async function checkout() {

  if (!cart.length) {

    alert(
      "سبد خرید خالی است."
    );

    return;
  }


  if (
    !STORE.settings.paymentEnabled
  ) {

    alert(
      "درگاه زرین‌پال هنوز توسط مدیر فعال نشده است."
    );

    return;
  }


  const amount =
    cart.reduce(
      (sum, item) => {

        const product =
          STORE.products.find(
            p =>
              String(p.id) ===
              String(item.id)
          );


        return (
          sum +
          (
            product
              ? finalPrice(product) *
                item.qty
              : 0
          )
        );

      },
      0
    );


  try {

    const response =
      await fetch(
        "/api/payment",
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json"
          },

          body: JSON.stringify({
            items: cart,
            amount
          })
        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    if (data.url) {

      location.href =
        data.url;

    } else {

      alert(
        data.error ||
        "شروع پرداخت ناموفق بود."
      );

    }

  } catch (error) {

    console.error(error);


    alert(
      "ارتباط با درگاه پرداخت برقرار نشد."
    );
  }
}


/* --------------------------------------------------
   شروع
-------------------------------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  load
);
