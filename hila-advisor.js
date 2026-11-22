(() => {
  "use strict";

  // راهنمای ثابت محصولات؛ قیمت و موجودی از فروشگاه خوانده می‌شود.
  const GUIDE = [
    {
      name: "سویلاک کامل",
      aliases: ["سویلاک", "سویلاک کامل", "فرنی سویلاک"],
      keywords: ["کودک", "غلات", "میوه", "حبوبات"],
      desc: "ترکیب سویق برنج، گندم و جو با سیب و به، همراه سویق سنجد، نخود، عدس، ماش و جوانه گندم. در فرمول فرنی به/سیب از سویق برنج استفاده می‌شود، نه آرد برنج."
    },
    {
      name: "سویلاک ورزشکار",
      aliases: ["ورزشکار", "سویق ورزشکار", "سویلاک ورزشکار"],
      keywords: ["تمرین", "بدنسازی", "ساده", "وانیل", "کاکائو"],
      desc: "در طعم‌های ساده، وانیلی و کاکائویی عرضه می‌شود. ترکیبات اعلام‌شده: سویق نخود، عدس، ماش و سنجد، تخم کدو، بادام، گل محمدی، استویا و جوانه گندم."
    },
    {
      name: "چاشنی اُمیلا",
      aliases: ["اُمیلا", "امیلا", "چاشنی", "امگا"],
      keywords: ["سالاد", "ماست", "سس", "کتان", "کنجد"],
      desc: "چاشنی ترکیبی از تخم کتان، کنجد، سماق، نمک، آویشن، سیر، زنجبیل و جوانه گندم؛ برای افزودن به سالاد، ماست یا سس معرفی شده است."
    },
    {
      name: "کاچی سه آرد سه مغز",
      aliases: ["کاچی سه آرد سه مغز", "سه آرد سه مغز", "کاچی سه آرد", "کاچی سه مغز"],
      keywords: ["بادام", "گردو", "پسته", "آرد"],
      desc: "ترکیب آرد گندم سبوس‌دار، جوانه گندم، آرد برنج، پودر نبات و ادویه، همراه بادام، گردو و پسته."
    },
    {
      name: "کاچی بَزَرَک",
      aliases: ["بزرک", "بَزَرَک", "کاچی بزرک", "کاچی بذرک"],
      keywords: ["کتان", "ضعف", "قوا"],
      desc: "ترکیب کتان، آرد سبوس‌دار، پودر نبات و ادویه. روش آماده‌سازی اعلام‌شده: با آب و کره روی حرارت آماده می‌شود؛ برای مقدار دقیق مواد، دستور روی بسته را ملاک قرار بده."
    },
    {
      name: "کاچی کودک",
      aliases: ["کاچی کودک", "کودک"],
      keywords: ["بادام", "نارگیل", "غذای کودک"],
      desc: "در ترکیب آن بادام، آرد گندم، پودر جوانه گندم، پودر نبات، شکر و ادویه به‌کار می‌رود؛ نارگیل نیز در دستور تهیه اعلام‌شده وجود دارد. وجود این محصول به‌تنهایی به معنی مناسب‌بودن برای هر سن یا هر کودک نیست؛ سن مصرف و حساسیت‌ها را پیش از استفاده با متخصص کودک بررسی کن."
    },
    {
      name: "فرنی تخم خربزه",
      aliases: ["فرنی تخم خربزه", "تخم خربزه", "فرنی خربزه"],
      keywords: ["کیسه", "تی‌بگ", "دمنوش"],
      desc: "بسته داخلی شبیه تی‌بگ حاوی تخم خربزه نیم‌کوب است. طبق روش معرفی‌شده، آن را در آب می‌خیسانند، کیسه را خارج می‌کنند و سپس پودر را به آب اضافه کرده و می‌پزند تا فرنی آماده شود. این محصول را درمان بیماری یا پاکسازی پزشکی معرفی نکن."
    },
    {
      name: "فرنی کدوحلوایی",
      aliases: ["فرنی کدوحلوایی", "کدوحلوایی", "فرنی کدو"],
      keywords: ["پنکیک", "حلوا", "پودینگ"],
      desc: "پودر فرنی کدوحلوایی؛ علاوه بر تهیه فرنی، در دستورهای خانگی مانند حلوا، پنکیک و پودینگ هم قابل استفاده است."
    },
    {
      name: "فرنی به و سیب",
      aliases: ["فرنی به سیب", "فرنی به، سیب", "به و سیب", "سیب و به"],
      keywords: ["سویق برنج", "گندم", "میوه"],
      desc: "با سویق برنج، سویق گندم و میوه به و سیب تهیه می‌شود. شیرینی آن از خود میوه‌هاست و در این محصول از آرد برنج استفاده نمی‌شود."
    },
    {
      name: "کاچی گز",
      aliases: ["کاچی گز", "گز"],
      keywords: ["پسته", "بادام", "مغز"],
      desc: "طعم گز در کنار کاچی، همراه مغز پسته و بادام؛ طبق معرفی محصول، بدون نیاز به افزودن شکر یا شیرینی اضافه."
    }
  ];

  const clean = s => String(s || "").toLocaleLowerCase("fa").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ");
  const liveProducts = () => (typeof STORE !== "undefined" && Array.isArray(STORE.products) ? STORE.products.filter(p => p.active !== false) : []);
  const root = document.createElement("section");
  root.className = "hila-advisor";
  root.innerHTML = '<button class="hila-advisor-launch" type="button" aria-label="مشاور هوشمند هیلافود">✦ <span>مشاور هیلافود</span></button><div class="hila-advisor-panel" hidden><div class="hila-advisor-head"><div><strong>مشاور هوشمند هیلافود</strong><small>راهنمای انتخاب و شناخت محصولات</small></div><button class="hila-advisor-close" type="button" aria-label="بستن">×</button></div><div class="hila-advisor-messages" aria-live="polite"><div class="hila-advisor-bubble bot">سلام! 🌿 نام محصول یا ترکیباتی را که می‌خواهی بشناسی بنویس.</div></div><div class="hila-advisor-chips"><button type="button">محصولات ورزشکار</button><button type="button">ترکیبات اُمیلا</button><button type="button">انواع کاچی</button><button type="button">فرنی‌ها</button></div><form class="hila-advisor-form"><input name="question" maxlength="300" placeholder="مثلاً سویلاک چه ترکیباتی دارد؟" autocomplete="off" required><button type="submit">ارسال</button></form><p class="hila-advisor-note">اطلاعات این راهنما برای معرفی محصولات است و جایگزین نظر پزشک یا متخصص تغذیه نیست.</p></div>';
  document.body.appendChild(root);

  const panel = root.querySelector(".hila-advisor-panel");
  const messages = root.querySelector(".hila-advisor-messages");
  const input = root.querySelector("input");

  const add = (message, who = "bot", items = []) => {
    const bubble = document.createElement("div");
    bubble.className = "hila-advisor-bubble " + who;
    bubble.textContent = window.HILA_I18N?.t(message) || message;
    messages.appendChild(bubble);
    if (items.length) {
      const list = document.createElement("div");
      list.className = "hila-advisor-products";
      items.slice(0, 4).forEach(p => {
        const item = document.createElement("div");
        item.className = "hila-advisor-product";
        const name = document.createElement("strong");
        name.textContent = window.HILA_I18N?.productName({name:p.name}) || p.name;
        const desc = document.createElement("small");
        desc.textContent = window.HILA_I18N?.t(p.desc) || p.desc;
        item.append(name, desc);
        list.appendChild(item);
      });
      messages.appendChild(list);
    }
    messages.scrollTop = messages.scrollHeight;
  };

  const findGuide = query => {
    const q = clean(query);
    return GUIDE.filter(p => [p.name, window.HILA_I18N?.productName({name:p.name}), ...p.aliases, ...p.keywords, p.desc].some(v => v && (clean(v).includes(q) || q.includes(clean(v)))));
  };

  const findLive = query => {
    const q = clean(query);
    return liveProducts().filter(p => clean([p.name, p.cat, p.stage, p.desc].join(" ")).includes(q));
  };

  const answer = raw => {
    const q = clean(raw);
    const language = window.HILA_I18N?.language || "fa";
    if (language !== "fa") {
      const localized = (en, ar) => language === "ar" ? ar : en;
      if (/hello|hi\b|good morning|مرحبا|السلام|أهلا/.test(q)) return [localized("Hello! 🌿 Ask me about product ingredients, flavors, or preparation.","مرحبًا! 🌿 اسألي عن مكونات المنتجات أو نكهاتها أو طريقة تحضيرها.")];
      if (/price|cost|how much|سعر|كم السعر|بكم/.test(q)) return [localized("Prices and availability may change. Please check the current price on the product page.","قد تتغير الأسعار والتوافر. يرجى مراجعة السعر الحالي في صفحة المنتج.")];
      if (/order|buy|shipping|delivery|طلب|شراء|توصيل|شحن/.test(q)) return [localized("Add the product to your cart and follow the checkout steps. For order follow-up, use the contact details on the website.","أضيفي المنتج إلى سلة التسوق واتبعي خطوات إتمام الطلب. لمتابعة الطلب، استخدمي بيانات التواصل الموجودة على الموقع.")];
      if (/pregnan|breastfeed|period|ovary|uterus|disease|treat|medicine|allerg|حامل|حمل|رضاع|دورة|مبيض|رحم|مرض|علاج|دواء|حساسية/.test(q)) return [localized("I can explain ingredients, but I cannot prescribe a product or confirm that it is suitable for pregnancy, breastfeeding, a medical condition, medication use, or allergies. Please check with a qualified healthcare professional. Hila Food products are not medical treatments.","يمكنني شرح المكونات، لكن لا أستطيع وصف منتج أو تأكيد ملاءمته للحمل أو الرضاعة أو الحالات الطبية أو الأدوية أو الحساسية. يرجى استشارة مختص صحي. منتجات هيلا فود ليست علاجات طبية.")];
      if (/child|baby|infant|month|طفل|رضيع|أشهر|شهر/.test(q)) return [localized("I can share the listed ingredients of children's products, but I cannot confirm the suitable age or safety for an individual child. Please consult your child's healthcare professional.","يمكنني توضيح المكونات المذكورة لمنتجات الأطفال، لكن لا أستطيع تأكيد العمر المناسب أو السلامة لطفل بعينه. يرجى استشارة مختص رعاية الطفل.")];
      if (/sport|athlet|workout|gym|رياض|رياضي|تمرين/.test(q)) return [localized("The sports-related product is Soylak for Athletes, offered in plain, vanilla, and cocoa flavors. This is a product description, not a guarantee of athletic performance.","المنتج المرتبط بالرياضة هو سويلاك للرياضيين، بنكهات السادة والفانيليا والكاكاو. هذا تعريف بالمنتج وليس ضمانًا للأداء الرياضي."), GUIDE.filter(x => x.name === "سویلاک ورزشکار" || x.name === "سویلاک ورزشکار")];
      const matches = findGuide(q);
      if (matches.length) return [localized("Here is the product information available in our guide:","إليك معلومات المنتج المتاحة في دليلنا:"), matches];
      if (/ingredient|composition|contain|what is in|مكونات|تركيب|ماذا يحتوي/.test(q)) return [localized("Please include the product name in your question, for example: “What are the ingredients in Soylak for Athletes?”","يرجى ذكر اسم المنتج في سؤالك، مثل: «ما مكونات سويلاك للرياضيين؟»")];
      if (/prepare|make|recipe|how to use|تحضير|طريقة|كيف أعد|كيف أحضر/.test(q)) return [localized("Please mention the exact product name. For exact quantities, follow the instructions printed on the package.","يرجى ذكر اسم المنتج بدقة. للكميات المحددة، اتبعي التعليمات المطبوعة على العبوة.")];
      return [localized("I do not yet have reliable information for this question. Please ask about a specific Hila Food product or contact support.","لا تتوفر لدي معلومات موثوقة عن هذا السؤال حاليًا. يرجى السؤال عن منتج محدد من هيلا فود أو التواصل مع الدعم.")];
    }
    if (/سلام|درود|وقت بخیر/.test(q)) return ["سلام و خوش اومدی 🌿 درباره ترکیبات، طعم‌ها و روش آماده‌سازی محصولات از من بپرس."];
    if (/قیمت|هزینه|چند تومن|چنده/.test(q)) return ["قیمت و موجودی ممکن است تغییر کند؛ قیمت به‌روز را در صفحه همان محصول در فروشگاه هیلافود ببین."];
    if (/سفارش|خرید|ارسال|پست|پیگیری/.test(q)) return ["برای خرید، محصول را به سبد اضافه کن و مراحل ثبت سفارش را ادامه بده. برای پیگیری سفارش از راه ارتباطی درج‌شده در سایت استفاده کن."];
    if (/باردار|شیرده|زایمان|قاعدگی|تخمدان|رحم|بیماری|درمان|درمانی|دارو|حساسیت/.test(q)) return ["برای بارداری، شیردهی، بیماری، مصرف دارو یا حساسیت غذایی نمی‌توانم محصولی را تجویز یا مناسب اعلام کنم. ترکیبات را با پزشک یا متخصص تغذیه بررسی کن. محصولات هیلافود درمان بیماری نیستند."];
    if (/کودک|نوزاد|شیرخوار|ماهگی|ماهگ/.test(q)) {
      const p = GUIDE.filter(x => /کودک|سویلاک/.test(clean(x.name + " " + x.aliases.join(" "))));
      return ["درباره محصولات کودک می‌توانم ترکیبات اعلام‌شده را توضیح بدهم؛ اما از روی نام محصول نمی‌توانم سن مناسب یا ایمنی آن را برای یک کودک تأیید کنم. سن مصرف، حساسیت‌ها و آمادگی کودک برای غذای کمکی را با متخصص کودک بررسی کن.", p];
    }
    if (/ورزش|بدنساز|عضله|تمرین/.test(q)) return ["محصول مرتبط با ورزش در هیلافود «سویلاک ورزشکار» است. ترکیبات و طعم‌های آن را اینجا می‌بینی؛ این معرفی به معنی تضمین عملکرد ورزشی نیست.", GUIDE.filter(x => x.name === "سویلاک ورزشکار")];
    if (/ترکیب|مواد|داخلش|محتویات|چی داره/.test(q)) {
      const matches = findGuide(q).length ? findGuide(q) : GUIDE.filter(p => q.split(/\s+/).some(w => w.length > 2 && clean(p.name + " " + p.aliases.join(" ") + " " + p.desc).includes(w)));
      return matches.length ? ["اطلاعات ترکیباتی که برای این محصول ثبت شده:", matches] : ["نام محصول را هم در سؤالت بنویس؛ مثلاً «ترکیبات سویلاک ورزشکار چیست؟» تا اطلاعات دقیق‌تری نشان بدهم."];
    }
    if (/روش مصرف|چطور درست|چطور آماده|طرز تهیه|آماده سازی|آماده‌سازی/.test(q)) {
      const matches = findGuide(q);
      return matches.length ? ["روش آماده‌سازی ثبت‌شده برای این محصول:", matches] : ["نام محصول را بنویس تا روش آماده‌سازی ثبت‌شده آن را پیدا کنم. برای مقدار دقیق مواد، دستور روی بسته را ملاک قرار بده."];
    }
    const matches = findGuide(q);
    if (matches.length) return ["این اطلاعات درباره محصولی است که پرسیدی:", matches];
    const live = findLive(q);
    if (live.length) return ["این محصول در فهرست فروشگاه ثبت شده است. جزئیات ترکیبات هنوز در راهنمای من کامل نیست؛ لطفاً توضیحات محصول یا برچسب بسته را بررسی کن.", live.map(p => ({name:p.name, desc:p.desc || "توضیحات تکمیلی در صفحه محصول بررسی شود."}))];
    return ["برای این سؤال هنوز اطلاعات مطمئنی در راهنمای من ثبت نشده. نام دقیق محصول را بنویس یا از پشتیبانی هیلافود بپرس."];
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