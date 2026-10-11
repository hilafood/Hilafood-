let DATA = {
  products: [],
  categories: [],
  settings: {
    showPrices: true,
    currency: 'تومان'
  }
};

let cat = new URLSearchParams(location.search).get('cat') || '';

const $ = id => document.getElementById(id);

const path = x => {
  const v = String(x || '');
  return v
    ? ((v === 'farni-tokhm-kharboze.webp' || v === 'farni-tokhm-kharbeze.webp')
        ? 'farni-tokhm-kharbeze.jpg'
        : v === 'farni-tokhm-kharbeze.jpg' || v.startsWith('assets/') || v.startsWith('category/') || v.startsWith('http://') || v.startsWith('https://')
        ? v
        : 'assets/' + v)
    : '';
};

function money(n) {
  return Number(n || 0).toLocaleString('fa-IR') +
    ' ' +
    (DATA.settings.currency || 'تومان');
}

function price(p) {
  const original = Number(p.price || 0);
  const discount = Number(p.discountPrice || 0);
  return discount > 0 && discount < original ? discount : original;
}
function normalizeWeightDigits(value) {
  return String(value || "").replace(/[۰-۹٠-٩]/g, digit =>
    "۰۱۲۳۴۵۶۷۸۹".includes(digit)
      ? String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
      : String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
  );
}

function parseProductWeightGrams(name) {
  const normalized = normalizeWeightDigits(name);
  const match = normalized.match(new RegExp("(?:^|[^0-9])([0-9]+)\\s*(?:گرم|g\\b)", "i"));
  const grams = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(grams) && grams > 0 ? grams : 0;
}

function displayProductName(name) {
  return String(name || "").replace(/\s*[|،·-]?\s*[0-9۰-۹٠-٩]+\s*(?:گرم|g\b)/gi, "").replace(/\s{2,}/g, " ").trim();
}

function productWeightGrams(product) {
  const configured = Number(DATA.settings?.productWeights?.[String(product.id)]);
  if (Number.isSafeInteger(configured) && configured > 0) return configured;
  return parseProductWeightGrams(product.name);
}

function addCategoryToCart(id, orderType = "full") {
  const product = (DATA.products || []).find(item => String(item.id) === String(id));
  if (!product) { alert("محصول پیدا نشد."); return; }
  if (!DATA.settings.showPrices || price(product) <= 0) { alert("قیمت این محصول فعلاً در دسترس نیست."); return; }
  if (orderType === "test" && productWeightGrams(product) <= 0) {
    alert("سفارش تست این محصول فعلاً فعال نیست.");
    return;
  }
  let cart = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("hilaCart") || "[]");
    cart = Array.isArray(parsed) ? parsed : [];
  } catch { cart = []; }
  const existing = cart.find(item => String(item.id) === String(id) && (item.orderType || "full") === orderType);
  if (existing) existing.qty = Number(existing.qty || 0) + 1;
  else cart.push({ id: product.id, qty: 1, orderType });
  localStorage.setItem("hilaCart", JSON.stringify(cart));
  location.href = "index.html?openCart=1";
}

async function init() {
  const r = await fetch('/api/store?v=' + Date.now(), {
    cache: 'no-store'
  });

  if (!r.ok) {
    throw new Error('خطا در دریافت اطلاعات');
  }

  DATA = await r.json();

  const c = DATA.categories?.find(x =>
    x.name === cat || x.id === cat
  );

  $('catTitle').textContent =
    c ? c.name : (cat || 'همه محصولات');

  apply();
}

function apply() {
  const category = (DATA.categories || []).find(
  c => c.id === cat || c.name === cat
);

const categoryName = category ? category.name : cat;

let list = (DATA.products || []).filter(p =>
  p.active !== false &&
  (
    !cat ||
    p.stage === cat ||
    p.cat === cat ||
    p.stage === categoryName ||
    p.cat === categoryName ||
    p.name === cat
  )
);

  const q = ($('q').value || '').trim();

  if (q) {
    list = list.filter(p =>
      String(p.name || '').includes(q) ||
      String(p.cat || '').includes(q) ||
      String(p.stage || '').includes(q) ||
      String(p.desc || '').includes(q)
    );
  }

  const s = $('sort').value;

  if (s === 'new') {
    list.sort((a, b) =>
      String(b.created_at || b.createdAt || '')
        .localeCompare(
          String(a.created_at || a.createdAt || '')
        )
    );
  }

  if (s === 'old') {
    list.sort((a, b) =>
      String(a.created_at || a.createdAt || '')
        .localeCompare(
          String(b.created_at || b.createdAt || '')
        )
    );
  }

  if (s === 'low') {
    list.sort((a, b) => price(a) - price(b));
  }

  if (s === 'high') {
    list.sort((a, b) => price(b) - price(a));
  }

  if (s === 'discount') {
    list.sort((a, b) => {
      const da =
        Number(a.price || 0) -
        Number(a.discountPrice || a.price || 0);

      const db =
        Number(b.price || 0) -
        Number(b.discountPrice || b.price || 0);

      return db - da;
    });
  }

  $('grid').innerHTML = list.length
    ? list.map(p => {

        const d =
          Number(p.discountPrice) > 0 &&
          Number(p.discountPrice) < Number(p.price);

        return `
          <article class="vertical-product">

            ${
              p.img
                ? `
                  <img
                    src="${path(p.img)}"
                    loading="lazy"
                    alt="${displayProductName(p.name || 'محصول')}"
                  >
                `
                : `
                  <div class="vertical-no-image">
                    تصویر محصول
                    <br>
                    <small>هنوز اضافه نشده</small>
                  </div>
                `
            }

            <div>

              <small>
                ${p.cat || ''}
                ${p.cat && p.stage ? ' | ' : ''}
                ${p.stage || ''}
              </small>

              <h2>${displayProductName(p.name || '')}</h2>

              <p>${p.desc || ''}</p>

              ${
                DATA.settings.showPrices
                  ? `
                    <div class="price">
                      ${
                        d
                          ? `
                            <del>${money(p.price)}</del>
                            <strong>${money(p.discountPrice)}</strong>
                          `
                          : money(p.price)
                      }
                    </div>
                  `
                  : `
                    <div class="no-price">
                      قیمت فعلاً اعلام نشده
                    </div>
                  `
              }

              ${
                p.video
                  ? `
                    <a
                      class="video-link"
                      href="${p.video}"
                      target="_blank"
                      rel="noopener"
                    >
                      ▶ ویدئوی آماده‌سازی
                    </a>
                  `
                  : ''
              }

              <div class="vertical-order-actions">
                <button type="button" class="details" onclick="addCategoryToCart('${p.id}', 'full')">خرید محصول کامل</button>
              </div>

              <section class="test-order-panel" aria-label="سفارش تست محصول">
                <strong>سفارش تست محصول</strong>
                ${productWeightGrams(p) > 0
                  ? `
                    <p>قیمت بسته تست: ${money(Math.round(price(p) / 4))}</p>
                    <button type="button" class="test-order-button" onclick="addCategoryToCart('${p.id}', 'test')">سفارش تست</button>
                  `
                  : `
                    <p>سفارش تست این محصول فعلاً فعال نیست.</p>
                    <button type="button" class="test-order-button" disabled>فعلاً در دسترس نیست</button>
                  `
                }
              </section>

            </div>

          </article>
        `;

      }).join('')
    : `
      <div class="empty">
        محصولی در این دسته پیدا نشد.
      </div>
    `;
}

init().catch(() => {
  $('grid').innerHTML = `
    <div class="empty">
      خطا در دریافت محصولات.
    </div>
  `;
});
