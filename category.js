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
  return Number(n || 0).toLocaleString('fa-IR') +
    ' ' +
    (DATA.settings.currency || 'تومان');
}

function price(p) {
  return Number(
    p.discountPrice > 0
      ? p.discountPrice
      : p.price || 0
  );
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
  let list = (DATA.products || []).filter(p =>
    p.active !== false &&
    (
      !cat ||
      p.stage === cat ||
      p.cat === cat ||
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
                    alt="${p.name || 'محصول'}"
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

              <h2>${p.name || ''}</h2>

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
