let STORE = {
  settings: {
    showPrices: false,
    currency: 'تومان',
    paymentEnabled: false
  },
  products: [],
  categories: []
};

let cart = JSON.parse(
  localStorage.getItem('hilaCart') || '[]'
);

const $ = id => document.getElementById(id);


/* --------------------------------------------------
   تصویر
-------------------------------------------------- */

function img(p) {
  const v = String(p || '');

  if (!v) return '';

  if (
    v.startsWith('assets/') ||
    v.startsWith('category/')
  ) {
    return v;
  }

  return 'assets/' + v;
}


/* --------------------------------------------------
   قیمت
-------------------------------------------------- */

function money(n) {
  return Number(n || 0).toLocaleString('fa-IR') +
    ' ' +
    (STORE.settings.currency || 'تومان');
}


function finalPrice(p) {
  return Number(
    p.discountPrice > 0
      ? p.discountPrice
      : p.price || 0
  );
}


/* --------------------------------------------------
   دریافت اطلاعات از Cloudflare D1
-------------------------------------------------- */

async function load() {

  try {

    const r = await fetch(
      '/api/store?v=' + Date.now(),
      {
        cache: 'no-store'
      }
    );

    if (!r.ok) {
      throw new Error('خطا در دریافت اطلاعات فروشگاه');
    }

    const data = await r.json();

    if (data.error) {
      throw new Error(data.error);
    }

    STORE = data;

  } catch (e) {

    console.error(e);

    alert(
      'ارتباط با اطلاعات فروشگاه برقرار نشد. لطفاً دوباره تلاش کنید.'
    );

    return;
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

  const el = $('categoryRail');

  if (!el) return;

  el.innerHTML =
    (STORE.categories || [])
      .map(c => `
        <a
          class="category-card"
          href="category.html?cat=${encodeURIComponent(c.name)}"
        >
          <img
            src="${img(c.image)}"
            loading="lazy"
            alt="${c.name}"
          >

          <b>${c.name}</b>
        </a>
      `)
      .join('');
}


/* --------------------------------------------------
   کارت محصول
-------------------------------------------------- */

function card(p) {

  const d =
    p.discountPrice > 0 &&
    p.discountPrice < p.price;

  const price =
    STORE.settings.showPrices

      ? (
          d

            ? `
              <del>${money(p.price)}</del>
              <strong>${money(p.discountPrice)}</strong>
            `

            : money(p.price)
        )

      : 'قیمت فعلاً اعلام نشده';


  return `
    <article class="product">

      <a
        href="category.html?cat=${encodeURIComponent(
          p.stage || p.cat || ''
        )}"
      >

        <div class="photo ${p.img ? '' : 'no-image'}">

          ${
            p.img

              ? `
                <img
                  src="${img(p.img)}"
                  loading="lazy"
                  alt="${p.name}"
                >
              `

              : `
                <div class="no-image-text">
                  تصویر محصول
                  <br>
                  <small>هنوز اضافه نشده</small>
                </div>
              `
          }

          <span class="badge">
            ${d ? 'تخفیف' : 'فراسودمند'}
          </span>

        </div>

      </a>


      <div class="product-body">

        <small>
          ${p.cat || ''} |
          ${p.stage || ''}
        </small>

        <h3>${p.name}</h3>

        <p>${p.desc || ''}</p>


        <div class="product-foot">

          <span>${price}</span>

          <button
            class="details"
            onclick="addToCart('${String(p.id)}')"
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

  const productRail = $('productRail');

  if (productRail) {

    productRail.innerHTML =
      list.map(card).join('');

  }


  const d =
    list.filter(
      p =>
        p.discountPrice > 0 &&
        p.discountPrice < p.price
    );


  const discountRail = $('discountRail');

  if (discountRail) {

    discountRail.innerHTML =
      d.length

        ? d.map(card).join('')

        : `
          <div class="empty">
            فعلاً محصولی با تخفیف ثبت نشده است.
          </div>
        `;
  }
}


/* --------------------------------------------------
   جستجو
-------------------------------------------------- */

function filterProducts(q) {

  q = (q || '').trim();

  const list =
    STORE.products.filter(
      p =>
        p.active !== false &&
        (
          !q ||
          String(p.name || '').includes(q) ||
          String(p.cat || '').includes(q) ||
          String(p.desc || '').includes(q) ||
          String(p.stage || '').includes(q)
        )
    );


  renderProducts(list);
}


/* --------------------------------------------------
   ویدئو
-------------------------------------------------- */

function renderVideo() {

  const box = $('videoBox');

  if (!box) return;

  const p =
    STORE.products.find(
      x => x.video
    );


  if (p) {

    box.innerHTML = `
      <div>

        <h3>${p.name}</h3>

        <p>
          برای مشاهده طرز آماده‌سازی،
          ویدئوی محصول را ببینید.
        </p>

        <a
          class="btn purple"
          href="${p.video}"
          target="_blank"
          rel="noopener"
        >
          ▶ مشاهده ویدئو
        </a>

      </div>
    `;
  }
}


/* --------------------------------------------------
   افزودن به سبد
-------------------------------------------------- */

function addToCart(id) {

  const p =
    STORE.products.find(
      x => String(x.id) === String(id)
    );


  if (
    !p ||
    !STORE.settings.showPrices ||
    !finalPrice(p)
  ) {

    return alert(
      'قیمت این محصول هنوز ثبت یا فعال نشده است.'
    );
  }


  const x =
    cart.find(
      i => String(i.id) === String(id)
    );


  if (x) {

    x.qty++;

  } else {

    cart.push({
      id: String(id),
      qty: 1
    });
  }


  localStorage.setItem(
    'hilaCart',
    JSON.stringify(cart)
  );


  updateCart();

  openCart();
}


/* --------------------------------------------------
   سبد خرید
-------------------------------------------------- */

function updateCart() {

  document
    .querySelectorAll('.cart-count')
    .forEach(e => {

      e.textContent =
        cart
          .reduce(
            (a, x) => a + x.qty,
            0
          )
          .toLocaleString('fa-IR');
    });


  if (!$('cartItems')) return;


  $('cartItems').innerHTML =

    cart.length

      ? cart.map(x => {

          const p =
            STORE.products.find(
              y =>
                String(y.id) === String(x.id)
            );


          if (!p) return '';


          return `
            <div class="cart-row">

              <b>

                ${p.name}

                <small>
                  ${money(finalPrice(p))}
                </small>

              </b>


              <div class="qty">

                <button
                  onclick="qty('${String(x.id)}',-1)"
                >
                  −
                </button>

                ${x.qty}

                <button
                  onclick="qty('${String(x.id)}',1)"
                >
                  +
                </button>

              </div>

            </div>
          `;

        }).join('')

      : `
        <div class="empty">
          سبد خرید خالی است.
        </div>
      `;


  const total =
    cart.reduce(
      (a, x) => {

        const p =
          STORE.products.find(
            y =>
              String(y.id) === String(x.id)
          );

        return a +
          (
            p
              ? finalPrice(p) * x.qty
              : 0
          );

      },
      0
    );


  if ($('cartTotal')) {

    $('cartTotal').textContent =
      money(total);

  }
}


/* --------------------------------------------------
   تعداد محصول
-------------------------------------------------- */

function qty(id, d) {

  const x =
    cart.find(
      i =>
        String(i.id) === String(id)
    );


  if (!x) return;


  x.qty += d;


  if (x.qty < 1) {

    cart =
      cart.filter(
        i =>
          String(i.id) !== String(id)
      );
  }


  localStorage.setItem(
    'hilaCart',
    JSON.stringify(cart)
  );


  updateCart();
}


/* --------------------------------------------------
   باز کردن سبد
-------------------------------------------------- */

function openCart() {

  if ($('cartDrawer')) {
    $('cartDrawer')
      .classList
      .add('open');
  }


  if ($('cartShade')) {
    $('cartShade')
      .classList
      .add('show');
  }
}


/* --------------------------------------------------
   بستن سبد
-------------------------------------------------- */

function closeCart() {

  if ($('cartDrawer')) {
    $('cartDrawer')
      .classList
      .remove('open');
  }


  if ($('cartShade')) {
    $('cartShade')
      .classList
      .remove('show');
  }
}


/* --------------------------------------------------
   منو
-------------------------------------------------- */

function toggleMenu() {

  if ($('drawer')) {
    $('drawer')
      .classList
      .toggle('open');
  }


  if ($('shade')) {
    $('shade')
      .classList
      .toggle('show');
  }
}


/* --------------------------------------------------
   پرداخت
-------------------------------------------------- */

async function checkout() {

  if (!cart.length) {

    return alert(
      'سبد خرید خالی است.'
    );
  }


  if (!STORE.settings.paymentEnabled) {

    return alert(
      'درگاه زرین‌پال هنوز توسط مدیر فعال نشده است.'
    );
  }


  const amount =
    cart.reduce(
      (a, x) => {

        const p =
          STORE.products.find(
            y =>
              String(y.id) === String(x.id)
          );

        return a +
          (
            p
              ? finalPrice(p) * x.qty
              : 0
          );

      },
      0
    );


  try {

    const r =
      await fetch(
        '/api/payment',
        {
          method: 'POST',

          headers: {
            'content-type':
              'application/json'
          },

          body: JSON.stringify({
            items: cart,
            amount
          })
        }
      );


    const d =
      await r.json()
        .catch(() => ({}));


    if (d.url) {

      location.href = d.url;

    } else {

      alert(
        d.error ||
        'شروع پرداخت ناموفق بود.'
      );
    }

  } catch (e) {

    console.error(e);

    alert(
      'ارتباط با درگاه پرداخت برقرار نشد.'
    );
  }
}


/* --------------------------------------------------
   شروع
-------------------------------------------------- */

document.addEventListener(
  'DOMContentLoaded',
  load
);
