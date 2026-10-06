let STORE = {
  settings: {
    showPrices: false,
    currency: "تومان",
    paymentEnabled: false,
    shippingMethods: []
  },
  products: [],
  categories: []
};

let cart = JSON.parse(
  localStorage.getItem("hilaCart") || "[]"
);

let selectedShippingId =
  localStorage.getItem("hilaShippingId") || "";


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
   روش‌های ارسال
-------------------------------------------------- */

function getShippingMethods() {

  const methods =
    STORE.settings.shippingMethods || [];

  return methods.filter(
    method =>
      method &&
      method.active !== false
  );
}


function getSelectedShipping() {

  const methods =
    getShippingMethods();

  if (!methods.length) {
    return null;
  }

  let selected =
    methods.find(
      method =>
        String(method.id) ===
        String(selectedShippingId)
    );

  if (!selected) {
    selected = methods[0];

    selectedShippingId =
      String(selected.id);

    localStorage.setItem(
      "hilaShippingId",
      selectedShippingId
    );
  }

  return selected;
}


function cartSubtotal() {

  return cart.reduce(
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
}


function shippingPrice() {

  const shipping =
    getSelectedShipping();

  return shipping
    ? Number(shipping.price || 0)
    : 0;
}


function cartGrandTotal() {

  return (
    cartSubtotal() +
    shippingPrice()
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


    if (
      !Array.isArray(
        STORE.settings.shippingMethods
      )
    ) {
      STORE.settings.shippingMethods = [];
    }


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
        paymentEnabled: false,
        shippingMethods: []
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
    cartSubtotal();


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
   ساخت مرحله انتخاب ارسال
-------------------------------------------------- */

function showCheckoutShipping() {

  const methods =
    getShippingMethods();


  if (!methods.length) {

    alert(
      "هنوز هیچ روش ارسال فعالی توسط مدیر ثبت نشده است."
    );

    return;
  }


  let selected =
    getSelectedShipping();


  const old =
    document.getElementById(
      "shippingCheckoutBox"
    );


  if (old) {
    old.remove();
  }


  const box =
    document.createElement("div");

  box.id =
    "shippingCheckoutBox";

  box.style.cssText = `
    margin:16px 0 0;
    padding:16px;
    border-radius:18px;
    background:rgba(255,255,255,.96);
    border:1px solid rgba(0,0,0,.08);
  `;


  box.innerHTML = `

    <div style="margin-bottom:14px">

      <strong style="font-size:18px">
        انتخاب روش ارسال
      </strong>

      <p style="
        margin:6px 0 0;
        opacity:.7;
        font-size:13px;
      ">
        روش ارسال سفارش خود را انتخاب کنید.
      </p>

    </div>


    <div id="shippingOptions">

      ${methods.map(method => {

        const checked =
          String(method.id) ===
          String(selected.id)
            ? "checked"
            : "";


        return `

          <label
            style="
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:10px;
              padding:12px;
              margin-bottom:8px;
              border:1px solid rgba(0,0,0,.08);
              border-radius:14px;
              cursor:pointer;
            "
          >

            <span style="
              display:flex;
              align-items:center;
              gap:8px;
            ">

              <input
                type="radio"
                name="shippingMethod"
                value="${method.id}"
                ${checked}
              >

              <b>
                ${method.name}
              </b>

            </span>


            <strong>
              ${
                Number(method.price || 0) > 0
                  ? money(method.price)
                  : "رایگان"
              }
            </strong>

          </label>

        `;

      }).join("")}

    </div>


    <div style="
      margin-top:16px;
      padding-top:14px;
      border-top:1px solid rgba(0,0,0,.08);
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        margin-bottom:8px;
      ">
        <span>جمع محصولات</span>
        <b id="shippingSubtotal">
          ${money(cartSubtotal())}
        </b>
      </div>


      <div style="
        display:flex;
        justify-content:space-between;
        margin-bottom:8px;
      ">
        <span>هزینه ارسال</span>
        <b id="shippingFee">
          ${money(selected.price)}
        </b>
      </div>


      <div style="
        display:flex;
        justify-content:space-between;
        font-size:18px;
        padding-top:10px;
        margin-top:8px;
        border-top:1px solid rgba(0,0,0,.08);
      ">
        <strong>مبلغ نهایی</strong>

        <strong id="shippingGrandTotal">
          ${money(
            cartSubtotal() +
            Number(selected.price || 0)
          )}
        </strong>
      </div>

    </div>


    <button
      id="confirmShippingBtn"
      type="button"
      style="
        width:100%;
        margin-top:16px;
        border:0;
        border-radius:14px;
        padding:13px;
        font-size:15px;
        font-weight:700;
        cursor:pointer;
      "
    >
      تأیید روش ارسال
    </button>

  `;


  const checkoutButton =
    document.querySelector(
      ".checkout"
    );


  if (checkoutButton) {

    checkoutButton.style.display =
      "none";

    checkoutButton
      .parentNode
      .insertBefore(
        box,
        checkoutButton
      );

  } else {

    const drawer =
      $("cartDrawer");

    if (drawer) {
      drawer.appendChild(box);
    }
  }


  box
    .querySelectorAll(
      'input[name="shippingMethod"]'
    )
    .forEach(input => {

      input.addEventListener(
        "change",
        function() {

          selectedShippingId =
            this.value;

          localStorage.setItem(
            "hilaShippingId",
            selectedShippingId
          );


          const method =
            methods.find(
              x =>
                String(x.id) ===
                String(this.value)
            );


          if (!method) return;


          const fee =
            Number(
              method.price || 0
            );


          const feeEl =
            document.getElementById(
              "shippingFee"
            );


          const totalEl =
            document.getElementById(
              "shippingGrandTotal"
            );


          if (feeEl) {
            feeEl.textContent =
              money(fee);
          }


          if (totalEl) {
            totalEl.textContent =
              money(
                cartSubtotal() +
                fee
              );
          }

        }
      );

    });


  const confirmButton =
    document.getElementById(
      "confirmShippingBtn"
    );


  if (confirmButton) {

    confirmButton.onclick =
      confirmShipping;

  }


  box.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


/* --------------------------------------------------
   تأیید روش ارسال
-------------------------------------------------- */

function confirmShipping() {

  const method =
    getSelectedShipping();


  if (!method) {

    alert(
      "لطفاً یک روش ارسال انتخاب کنید."
    );

    return;
  }


  const checkoutBox =
    document.getElementById(
      "shippingCheckoutBox"
    );


  if (checkoutBox) {
    checkoutBox.remove();
  }


  const checkoutButton =
    document.querySelector(
      ".checkout"
    );


  if (checkoutButton) {
    checkoutButton.style.display =
      "block";

    checkoutButton.textContent =
      "ادامه و پرداخت";
  }


  updateCart();


  alert(
    "روش ارسال انتخاب شد.\n" +
    "هزینه ارسال: " +
    money(method.price) +
    "\n" +
    "مبلغ نهایی: " +
    money(cartGrandTotal())
  );
}


/* --------------------------------------------------
   پرداخت / ادامه سفارش
-------------------------------------------------- */

async function checkout() {

  if (!cart.length) {

    alert(
      "سبد خرید خالی است."
    );

    return;
  }


  /*
   * مرحله اول:
   * انتخاب روش ارسال
   *
   * فعلاً قبل از اتصال زرین‌پال
   * همین مرحله را کامل می‌کنیم.
   */

  const shippingMethods =
    getShippingMethods();


  if (!shippingMethods.length) {

    alert(
      "هنوز هیچ روش ارسال فعالی ثبت نشده است."
    );

    return;
  }


  showCheckoutShipping();
}


/* --------------------------------------------------
   شروع
-------------------------------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  load
);
