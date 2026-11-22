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
    ? (v.startsWith('assets/') || v.startsWith('category/')
        ? v
        : 'assets/' + v)
    : '';
};

function money(n) {
  return window.HILA_I18N ? window.HILA_I18N.money(n) :
    Number(n || 0).toLocaleString('fa-IR') + ' ' + (DATA.settings.currency || 'تومان');
}

function price(p) {
  return Number(
    p.discountPrice > 0
      ? p.discountPrice
      : p.price || 0
  );
}

async function init() {
  const [r, fallbackResponse] = await Promise.all([
    fetch('/api/store?v=' + Date.now(), { cache: 'no-store' }),
    fetch('/data.json', { cache: 'no-cache' }).catch(() => null)
  ]);

  if (!r.ok) {
    throw new Error('خطا در دریافت اطلاعات');
  }

  DATA = await r.json();

  let fallbackCategories = [];
  try {
    if (fallbackResponse?.ok) {
      const fallbackData = await fallbackResponse.json();
      fallbackCategories = Array.isArray(fallbackData.categories) ? fallbackData.categories : [];
    }
  } catch (error) {
    console.warn('Fallback categories unavailable:', error);
  }

  const categoriesById = new Map();
  fallbackCategories.forEach(item => {
    if (item?.id) categoriesById.set(String(item.id), item);
  });
  (Array.isArray(DATA.categories) ? DATA.categories : []).forEach(item => {
    if (item?.id) categoriesById.set(String(item.id), { ...categoriesById.get(String(item.id)), ...item });
  });
  DATA.categories = Array.from(categoriesById.values());

  const c = DATA.categories?.find(x =>
    x.name === cat || x.id === cat
  );

  $('catTitle').textContent =
    c ? (window.HILA_I18N?.categoryName(c) || c.name) : (window.HILA_I18N?.t('همه محصولات') || 'همه محصولات');

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
      String(p.name || '').toLowerCase().includes(q.toLowerCase()) ||
      String(window.HILA_I18N?.productName(p) || '').toLowerCase().includes(q.toLowerCase()) ||
      String(p.cat || '').toLowerCase().includes(q.toLowerCase()) ||
      String(window.HILA_I18N?.t(p.cat || '') || '').toLowerCase().includes(q.toLowerCase()) ||
      String(p.stage || '').toLowerCase().includes(q.toLowerCase()) ||
      String(window.HILA_I18N?.t(p.stage || '') || '').toLowerCase().includes(q.toLowerCase()) ||
      String(p.desc || '').toLowerCase().includes(q.toLowerCase())
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
                    alt="${window.HILA_I18N?.productName(p) || p.name || 'محصول'}"
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
                ${window.HILA_I18N?.t(p.cat || '') || p.cat || ''}
                ${p.cat && p.stage ? ' | ' : ''}
                ${window.HILA_I18N?.t(p.stage || '') || p.stage || ''}
              </small>

              <h2>${window.HILA_I18N?.productName(p) || p.name || ''}</h2>

              <p>${window.HILA_I18N?.t(p.desc || '') || p.desc || ''}</p>

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


document.addEventListener("hila-language-change", () => {
  const category = (DATA.categories || []).find(x => x.id === cat || x.name === cat);
  $("catTitle").textContent = category ? (window.HILA_I18N?.categoryName(category) || category.name) : (window.HILA_I18N?.t("همه محصولات") || "همه محصولات");
  apply();
});
