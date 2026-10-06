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


/* ==================================================
   ابزارهای عمومی
================================================== */

const $ = id => document.getElementById(id);


function img(path) {

  const v = String(path || "");

  if (!v) {
    return "";
  }

  if (
    v.startsWith("assets/") ||
    v.startsWith("category/") ||
    v.startsWith("http://") ||
    v.startsWith("https://")
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

  const discount =
    Number(product.discountPrice || 0);

  const price =
    Number(product.price || 0);

  if (
    discount > 0 &&
    discount < price
  ) {
    return discount;
  }

  return price;
}


/* ==================================================
   سبد خرید
================================================== */

function cartSubtotal() {

  return cart.reduce(
    (sum, item) => {

      const product =
        STORE.products.find(
          p =>
            String(p.id) ===
            String(item.id)
        );

      if (!product) {
        return sum;
      }

      return (
        sum +
        finalPrice(product) *
        Number(item.qty || 0)
      );

    },
    0
  );
}


/* ==================================================
   ارسال
================================================== */

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


/* ==================================================
   دریافت اطلاعات فروشگاه
================================================== */

async function load() {

  try {

    const response =
      await fetch(
        "/api/store?v=" +
        Date.now(),
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "خطا در دریافت اطلاعات فروشگاه"
      );
    }

    const data =
      await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    STORE = {

      settings:
        data.settings || {},

      categories:
        data.categories || [],

      products:
        data.products || []

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


/* ==================================================
   دسته‌بندی‌ها
================================================== */

function renderCategories() {

  const el =
    $("categoryRail");

  if (!el) {
    return;
  }

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

            <b>
              ${c.name}
            </b>

          </a>

        `;

      })
      .join("");
}


/* ==================================================
   کارت محصول
================================================== */

function card(product) {

  const price =
    Number(product.price || 0);

  const discountPrice =
    Number(
      product.discountPrice || 0
    );

  const discount =
    discountPrice > 0 &&
    discountPrice < price;


  let priceHTML = "";


  if (
    STORE.settings.showPrices
  ) {

    priceHTML = discount

      ? `

        <del>
          ${money(price)}
        </del>

        <strong>
          ${money(discountPrice)}
        </strong>

      `

      : money(price);

  } else {

    priceHTML =
      "قیمت فعلاً اعلام نشده";

  }


  const category =
    product.stage ||
    product.cat ||
    "";


  const imageHTML =
    product.img

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
            product.img
              ? ""
              : "no-image"
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
              ? " | " +
                product.stage
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
            ${priceHTML}
          </span>


          <button
            class="details"
            type="button"
            onclick="addToCart('${product.id}')"
          >
            افزودن
          </button>

        </div>

      </div>

    </article>

  `;
}


/* ==================================================
   نمایش محصولات
================================================== */

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

  if (!discountRail) {
    return;
  }


  const discounted =
    list.filter(
      product => {

        const price =
          Number(product.price || 0);

        const discount =
          Number(
            product.discountPrice || 0
          );

        return (
          discount > 0 &&
          discount < price
        );

      }
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


/* ==================================================
   جستجو
================================================== */

function filterProducts(q) {

  q =
    String(q || "").trim();


  const result =
    STORE.products.filter(
      product => {

        if (
          product.active === false
        ) {
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

      }
    );


  renderProducts(result);
}


/* ==================================================
   ویدئو
================================================== */

function renderVideo() {

  const videoBox =
    $("videoBox");

  if (!videoBox) {
    return;
  }


  const product =
    STORE.products.find(
      x => x.video
    );


  if (!product) {
    return;
  }


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


/* ==================================================
   افزودن به سبد
================================================== */

function addToCart(id) {

  const product =
    STORE.products.find(
      x =>
        String(x.id) ===
        String(id)
    );


  if (!product) {

    alert(
      "محصول پیدا نشد."
    );

    return;
  }


  if (
    !STORE.settings.showPrices
  ) {

    alert(
      "قیمت محصولات فعلاً فعال نیست."
    );

    return;
  }


  const price =
    finalPrice(product);


  if (price <= 0) {

    alert(
      "قیمت این محصول هنوز ثبت نشده است."
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

    existing.qty =
      Number(existing.qty || 0) + 1;

  } else {

    cart.push({

      id:
        product.id,

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


/* ==================================================
   بروزرسانی سبد
================================================== */

function updateCart() {

  document
    .querySelectorAll(".cart-count")
    .forEach(element => {

      element.textContent =
        cart
          .reduce(
            (sum, item) =>
              sum +
              Number(item.qty || 0),
            0
          )
          .toLocaleString("fa-IR");

    });


  const cartItems =
    $("cartItems");

  if (!cartItems) {
    return;
  }


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
                    type="button"
                    onclick="qty('${product.id}', -1)"
                  >
                    −
                  </button>

                  ${Number(item.qty || 0)}

                  <button
                    type="button"
                    onclick="qty('${product.id}', 1)"
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


  const cartTotal =
    $("cartTotal");

  if (cartTotal) {

    cartTotal.textContent =
      money(cartSubtotal());

  }


  const shippingTotal =
    $("shippingTotal");

  if (shippingTotal) {

    shippingTotal.textContent =
      money(shippingPrice());

  }


  const grandTotal =
    $("grandTotal");

  if (grandTotal) {

    grandTotal.textContent =
      money(cartGrandTotal());

  }
}


/* ==================================================
   تعداد
================================================== */

function qty(id, change) {

  const item =
    cart.find(
      x =>
        String(x.id) ===
        String(id)
    );


  if (!item) {
    return;
  }


  item.qty =
    Number(item.qty || 0) +
    Number(change || 0);


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


/* ==================================================
   باز و بسته کردن سبد
================================================== */

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


/* ==================================================
   منوی موبایل
================================================== */

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


/* ==================================================
   فرم مشتری
================================================== */

function showCustomerForm() {

  const methods =
    getShippingMethods();


  if (!methods.length) {

    alert(
      "هنوز هیچ روش ارسال فعالی توسط مدیر ثبت نشده است."
    );

    return;
  }


  if (!cart.length) {

    alert(
      "سبد خرید خالی است."
    );

    return;
  }


  const oldBox =
    document.getElementById(
      "customerCheckoutBox"
    );


  if (oldBox) {
    oldBox.remove();
  }


  const shipping =
    getSelectedShipping();


  const box =
    document.createElement("div");


  box.id =
    "customerCheckoutBox";


  box.style.cssText = `

    margin:16px 0 0;

    padding:18px;

    border-radius:18px;

    background:#fff;

    border:1px solid rgba(0,0,0,.08);

  `;


  box.innerHTML = `

    <div style="
      margin-bottom:16px;
    ">

      <strong style="
        font-size:18px;
      ">
        اطلاعات دریافت سفارش
      </strong>

      <p style="
        margin:6px 0 0;
        opacity:.7;
        font-size:13px;
      ">
        اطلاعات خود را وارد کنید تا سفارش ثبت شود.
      </p>

    </div>


    <label style="
      display:block;
      margin-bottom:12px;
    ">

      <span style="
        display:block;
        margin-bottom:6px;
        font-weight:700;
      ">
        نام و نام خانوادگی
      </span>

      <input
        id="customerName"
        type="text"
        autocomplete="name"
        placeholder="مثلاً مریم احمدی"
        style="
          width:100%;
          box-sizing:border-box;
          padding:12px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:12px;
          font:inherit;
        "
      >

    </label>


    <label style="
      display:block;
      margin-bottom:12px;
    ">

      <span style="
        display:block;
        margin-bottom:6px;
        font-weight:700;
      ">
        شماره موبایل
      </span>

      <input
        id="customerPhone"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
        style="
          width:100%;
          box-sizing:border-box;
          padding:12px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:12px;
          font:inherit;
        "
      >

    </label>


    <label style="
      display:block;
      margin-bottom:12px;
    ">

      <span style="
        display:block;
        margin-bottom:6px;
        font-weight:700;
      ">
        آدرس کامل
      </span>

      <textarea
        id="customerAddress"
        rows="4"
        autocomplete="street-address"
        placeholder="استان، شهر، خیابان، کوچه، پلاک..."
        style="
          width:100%;
          box-sizing:border-box;
          padding:12px;
          border:1px solid rgba(0,0,0,.12);
          border-radius:12px;
          font:inherit;
          resize:vertical;
        "
      ></textarea>

    </label>


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

        <span>
          جمع محصولات
        </span>

        <b>
          ${money(cartSubtotal())}
        </b>

      </div>


      <div style="
        display:flex;
        justify-content:space-between;
        margin-bottom:8px;
      ">

        <span>
          ارسال
        </span>

        <b>
          ${
            Number(shipping.price || 0) > 0
              ? money(shipping.price)
              : "رایگان"
          }
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

        <strong>
          مبلغ نهایی
        </strong>

        <strong>
          ${money(cartGrandTotal())}
        </strong>

      </div>

    </div>


    <button
      id="submitOrderBtn"
      type="button"
      style="
        width:100%;
        margin-top:16px;
        border:0;
        border-radius:14px;
        padding:14px;
        font-size:15px;
        font-weight:700;
        cursor:pointer;
      "
    >
      ثبت سفارش
    </button>


    <button
      id="backToShippingBtn"
      type="button"
      style="
        width:100%;
        margin-top:8px;
        border:0;
        background:transparent;
        padding:10px;
        font-size:14px;
        cursor:pointer;
      "
    >
      تغییر روش ارسال
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

  }


  const submit =
    document.getElementById(
      "submitOrderBtn"
    );


  if (submit) {

    submit.onclick =
      submitOrder;

  }


  const back =
    document.getElementById(
      "backToShippingBtn"
    );


  if (back) {

    back.onclick =
      showShippingCheckout;

  }


  box.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


/* ==================================================
   انتخاب روش ارسال
================================================== */

function showShippingCheckout() {

  const methods =
    getShippingMethods();


  if (!methods.length) {

    alert(
      "هنوز هیچ روش ارسال فعالی توسط مدیر ثبت نشده است."
    );

    return;
  }


  const oldCustomerBox =
    document.getElementById(
      "customerCheckoutBox"
    );


  if (oldCustomerBox) {
    oldCustomerBox.remove();
  }


  const oldShippingBox =
    document.getElementById(
      "shippingCheckoutBox"
    );


  if (oldShippingBox) {
    oldShippingBox.remove();
  }


  const selected =
    getSelectedShipping();


  const box =
    document.createElement("div");


  box.id =
    "shippingCheckoutBox";


  box.style.cssText = `

    margin:16px 0 0;

    padding:16px;

    border-radius:18px;

    background:#fff;

    border:1px solid rgba(0,0,0,.08);

  `;


  box.innerHTML = `

    <div style="
      margin-bottom:14px;
    ">

      <strong style="
        font-size:18px;
      ">
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

          <label style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
            padding:12px;
            margin-bottom:8px;
            border:1px solid rgba(0,0,0,.08);
            border-radius:14px;
            cursor:pointer;
          ">

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

        <span>
          جمع محصولات
        </span>

        <b id="shippingSubtotal">
          ${money(cartSubtotal())}
        </b>

      </div>


      <div style="
        display:flex;
        justify-content:space-between;
        margin-bottom:8px;
      ">

        <span>
          هزینه ارسال
        </span>

        <b id="shippingFee">
          ${
            Number(selected.price || 0) > 0
              ? money(selected.price)
              : "رایگان"
          }
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

        <strong>
          مبلغ نهایی
        </strong>

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
      ادامه
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


          if (!method) {
            return;
          }


          const fee =
            Number(
              method.price || 0
            );


          const feeElement =
            document.getElementById(
              "shippingFee"
            );


          const totalElement =
            document.getElementById(
              "shippingGrandTotal"
            );


          if (feeElement) {

            feeElement.textContent =
              fee > 0
                ? money(fee)
                : "رایگان";

          }


          if (totalElement) {

            totalElement.textContent =
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
      showCustomerForm;

  }


  box.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


/* ==================================================
   ثبت سفارش در D1
================================================== */

async function submitOrder() {

  const nameInput =
    document.getElementById(
      "customerName"
    );

  const phoneInput =
    document.getElementById(
      "customerPhone"
    );

  const addressInput =
    document.getElementById(
      "customerAddress"
    );


  const name =
    String(
      nameInput?.value || ""
    ).trim();


  const phone =
    String(
      phoneInput?.value || ""
    ).trim();


  const address =
    String(
      addressInput?.value || ""
    ).trim();


  if (!name) {

    alert(
      "لطفاً نام و نام خانوادگی را وارد کنید."
    );

    nameInput?.focus();

    return;
  }


  if (!phone) {

    alert(
      "لطفاً شماره موبایل را وارد کنید."
    );

    phoneInput?.focus();

    return;
  }


  if (!address) {

    alert(
      "لطفاً آدرس کامل را وارد کنید."
    );

    addressInput?.focus();

    return;
  }


  const shipping =
    getSelectedShipping();


  if (!shipping) {

    alert(
      "لطفاً روش ارسال را انتخاب کنید."
    );

    return;
  }


  if (!cart.length) {

    alert(
      "سبد خرید خالی است."
    );

    return;
  }


  const button =
    document.getElementById(
      "submitOrderBtn"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "در حال ثبت سفارش...";

  }


  try {

    const items =
      cart.map(item => ({

        id:
          item.id,

        qty:
          Number(item.qty || 1)

      }));


    const response =
      await fetch(
        "/api/store",
        {

          method: "POST",

          headers: {
            "content-type":
              "application/json"
          },

          body:
            JSON.stringify({

              action:
                "create-order",

              customer: {

                name,

                phone,

                address

              },

              items,

              shippingId:
                String(shipping.id)

            })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "ثبت سفارش ناموفق بود."
      );

    }


    if (!data.success) {

      throw new Error(
        data.error ||
        "ثبت سفارش ناموفق بود."
      );

    }


    localStorage.removeItem(
      "hilaCart"
    );


    cart = [];


    updateCart();


    const customerBox =
      document.getElementById(
        "customerCheckoutBox"
      );


    if (customerBox) {
      customerBox.remove();
    }


    const shippingBox =
      document.getElementById(
        "shippingCheckoutBox"
      );


    if (shippingBox) {
      shippingBox.remove();
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


    alert(

      "سفارش شما با موفقیت ثبت شد.\n\n" +

      "شماره سفارش: " +
      data.orderId +
      "\n\n" +

      "مبلغ نهایی: " +
      money(data.total) +

      "\n\n" +

      "سفارش شما ثبت شد و به‌زودی پیگیری می‌شود."

    );


  } catch (error) {

    console.error(
      "Create order error:",
      error
    );


    alert(
      error?.message ||
      "ثبت سفارش انجام نشد. لطفاً دوباره تلاش کنید."
    );


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "ثبت سفارش";

    }

  }
}


/* ==================================================
   checkout
================================================== */

async function checkout() {

  if (!cart.length) {

    alert(
      "سبد خرید خالی است."
    );

    return;
  }


  const methods =
    getShippingMethods();


  if (!methods.length) {

    alert(
      "هنوز هیچ روش ارسال فعالی توسط مدیر ثبت نشده است."
    );

    return;
  }


  showShippingCheckout();
}


/* ==================================================
   شروع برنامه
================================================== */

document.addEventListener(
  "DOMContentLoaded",
  load
);
