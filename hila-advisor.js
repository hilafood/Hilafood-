(() => {
  "use strict";
  const products = () => (typeof STORE !== "undefined" && Array.isArray(STORE.products) ? STORE.products.filter(p => p.active !== false) : []);
  const clean = s => String(s || "").toLocaleLowerCase("fa");
  const root = document.createElement("section");
  root.className = "hila-advisor";
  root.innerHTML = '<button class="hila-advisor-launch" type="button" aria-label="مشاور هوشمند هیلافود">✦ <span>مشاور هیلافود</span></button><div class="hila-advisor-panel" hidden><div class="hila-advisor-head"><div><strong>مشاور هوشمند هیلافود</strong><small>راهنمای انتخاب و خرید محصولات</small></div><button class="hila-advisor-close" type="button" aria-label="بستن">×</button></div><div class="hila-advisor-messages" aria-live="polite"><div class="hila-advisor-bubble bot">سلام! من راهنمای محصولات هیلافود هستم. بگو دنبال چه محصولی هستی یا سؤالت رو بنویس.</div></div><div class="hila-advisor-chips"><button type="button">محصولات کودک</button><button type="button">محصولات ورزشکار</button><button type="button">روش مصرف</button><button type="button">ترکیبات محصولات</button></div><form class="hila-advisor-form"><input name="question" maxlength="300" placeholder="سؤالت رو اینجا بنویس..." autocomplete="off" required><button type="submit">ارسال</button></form><p class="hila-advisor-note">این راهنما جایگزین نظر پزشک یا متخصص تغذیه نیست.</p></div>';
  document.body.appendChild(root);
  const panel = root.querySelector(".hila-advisor-panel");
  const messages = root.querySelector(".hila-advisor-messages");
  const input = root.querySelector("input");
  const add = (text, who = "bot", items = []) => {
    const bubble = document.createElement("div");
    bubble.className = "hila-advisor-bubble " + who;
    bubble.textContent = text;
    messages.appendChild(bubble);
    if (items.length) {
      const list = document.createElement("div");
      list.className = "hila-advisor-products";
      items.slice(0, 4).forEach(p => {
        const item = document.createElement("div");
        item.className = "hila-advisor-product";
        const name = document.createElement("strong");
        name.textContent = p.name || "محصول هیلافود";
        item.appendChild(name);
        if (p.desc) {
          const desc = document.createElement("small");
          desc.textContent = p.desc;
          item.appendChild(desc);
        }
        list.appendChild(item);
      });
      messages.appendChild(list);
    }
    messages.scrollTop = messages.scrollHeight;
  };
  const find = terms => products().filter(p => terms.some(t => clean(p.name + " " + p.cat + " " + p.stage + " " + p.desc).includes(t)));
  const answer = raw => {
    const q = clean(raw);
    if (/سلام|درود|وقت بخیر/.test(q)) return ["سلام و خوش اومدی 🌿 برای انتخاب محصول، ترکیبات یا روش آماده‌سازی هر محصول راهنماییت می‌کنم."];
    if (/قیمت|هزینه|چند تومن|چنده/.test(q)) return ["قیمت روز هر محصول در صفحه فروشگاه نمایش داده می‌شود. اگر قیمت محصولی را نمی‌بینی، از پشتیبانی هیلافود استعلام بگیر."];
    if (/سفارش|خرید|ارسال|پست|پیگیری/.test(q)) return ["برای خرید، محصول را به سبد اضافه کن و مراحل ثبت سفارش را ادامه بده. برای پیگیری سفارش یا سؤال درباره ارسال می‌توانی از راه ارتباطی هیلافود کمک بگیری."];
    if (/کودک|نوزاد|شیرخوار|ماهگی|ماهگ/.test(q)) return ["برای انتخاب غذای کودک، سن دقیق، مرحله شروع غذای کمکی و ترکیبات حساسیت‌زا اهمیت دارد. من نمی‌توانم مناسب‌بودن یک محصول را برای کودک تأیید پزشکی کنم؛ قبل از خرید، ترکیبات و سن مصرف را با پشتیبانی بررسی کن.", find(["کودک","حریره","فرنی","سویلاک"])];
    if (/ورزش|بدنساز|عضله|تمرین/.test(q)) return ["برای آشنایی با گزینه‌های مرتبط با ورزش، محصولات زیر را ببین. این پیشنهاد به معنی تضمین افزایش عملکرد یا جایگزینی برنامه غذایی تخصصی نیست.", find(["ورزشکار","سویق نخود","پروتئین"])];
    if (/اُم|امگا|چاشنی|سالاد|ماست/.test(q)) return ["چاشنی اُمیلا برای افزودن به غذاهایی مثل سالاد و ماست معرفی شده است. اگر به کنجد یا سایر ترکیبات حساسیت داری، پیش از مصرف فهرست مواد تشکیل‌دهنده را بررسی کن.", find(["اُمیلا","امیلا","چاشنی"])];
    if (/کاچی|بزرک|بزرک|گز/.test(q)) return ["برای دیدن انواع کاچی و ترکیبات هرکدام، این محصولات را بررسی کن. روش آماده‌سازی را مطابق دستور روی بسته انجام بده.", find(["کاچی","بزرک","بزرَک"])];
    if (/فرنی|حریره|صبحانه/.test(q)) return ["این محصولات در دسته فرنی و حریره قرار می‌گیرند. برای انتخاب، ترکیبات، شیوه آماده‌سازی و تناسب با سن مصرف‌کننده را بررسی کن.", find(["فرنی","حریره","سویلاک"])];
    if (/ترکیب|مواد|داخلش|محتویات/.test(q)) return ["ترکیبات دقیق هر محصول باید از توضیحات همان محصول یا برچسب بسته بررسی شود. نام محصولی را که مدنظرت است بنویس تا اطلاعات ثبت‌شده فروشگاه را پیدا کنم.", find(q.split(/\s+/).filter(w => w.length > 2))];
    if (/باردار|شیرده|زایمان|قاعدگی|تخمدان|رحم|بیماری|درمان|درمانی|دارو|حساسیت/.test(q)) return ["برای بارداری، شیردهی، بیماری‌ها، داروها یا حساسیت غذایی، پیشنهاد محصول بدون بررسی فردی ایمن نیست. لطفاً برای تصمیم مصرف با پزشک یا متخصص تغذیه مشورت کن؛ محصولات هیلافود درمان بیماری نیستند."];
    const words = q.split(/\s+/).filter(w => w.length > 2);
    const matches = find(words);
    if (matches.length) return ["این محصولات با واژه‌هایی که نوشتی مرتبط‌اند. برای انتخاب دقیق‌تر، بگو محصول را برای چه کسی و با چه کاربردی می‌خواهی.", matches];
    return ["هنوز پاسخ مشخصی برای این سؤال در راهنمای من ثبت نشده. می‌توانی نام محصول یا موضوع دقیق‌تری بنویسی یا از طریق پشتیبانی هیلافود سؤال کنی."];
  };
  root.querySelector(".hila-advisor-launch").addEventListener("click", () => { panel.hidden = !panel.hidden; if (!panel.hidden) input.focus(); });
  root.querySelector(".hila-advisor-close").addEventListener("click", () => { panel.hidden = true; });
  root.querySelectorAll(".hila-advisor-chips button").forEach(btn => btn.addEventListener("click", () => {
    const q = btn.textContent;
    add(q, "user");
    const result = answer(q);
    add(result[0], "bot", result[1] || []);
  }));
  root.querySelector(".hila-advisor-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    add(q, "user");
    input.value = "";
    const result = answer(q);
    add(result[0], "bot", result[1] || []);
  });
})();