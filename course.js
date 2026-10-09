(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const courseId = params.get("id");
  const statusBox = $("courseStatus");
  let loadedData = null;
  function message(text, error = false) {
    statusBox.textContent = text; statusBox.className = error ? "course-error" : "course-empty"; statusBox.hidden = !text;
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function safeMediaUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(https?:\/\/|\/|assets\/)/i.test(raw)) return raw;
    return "";
  }
  function money(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? new Intl.NumberFormat("fa-IR").format(number) + " تومان" : "قیمت اعلام نشده";
  }
  function paymentMessage() {
    const state = params.get("payment");
    if (state === "success") return "پرداخت از سمت سرور تأیید شد. اگر دسترسی هنوز نمایش داده نمی‌شود، صفحه را تازه‌سازی کنید.";
    if (state === "failed") return "پرداخت تأیید نشد؛ تا تأیید سمت سرور دسترسی پولی ایجاد نمی‌شود.";
    if (state === "processing") return "نتیجه پرداخت هنوز نهایی نشده است. از پرداخت دوباره خودداری کنید و وضعیت سفارش را در حساب کاربری بررسی کنید.";
    if (state === "disabled") return "خرید دوره در حال حاضر در محیط عملیاتی غیرفعال است.";
    return "";
  }
  function render(data) {
    loadedData = data;
    const course = data.course || {};
    const image = course.image ? '<img src="' + escapeHtml(course.image) + '" alt="' + escapeHtml(course.title || "دوره آموزشی") + '" loading="lazy">' : "";
    const price = Number(course.price), discount = Number(course.discount_price);
    let priceHtml = '<p class="course-price">قیمت: <strong>' + escapeHtml(money(price)) + '</strong></p>';
    if (Number.isSafeInteger(discount) && discount > 0 && Number.isSafeInteger(price) && discount < price) priceHtml = '<p class="course-price"><del>' + escapeHtml(money(price)) + '</del> <strong>' + escapeHtml(money(discount)) + '</strong> <span class="course-discount">تخفیف</span></p>';
    let purchaseUi = "";
    if (data.entitled) purchaseUi = '<p class="course-purchase-state success">این دوره برای حساب شما خریداری شده است؛ دسترسی از سمت سرور بررسی می‌شود.</p>';
    else if (!data.authenticated) {
      const next = "course.html?id=" + encodeURIComponent(String(course.id || courseId)) + "&checkout=1";
      purchaseUi = '<a class="course-login" href="account.html?next=' + encodeURIComponent(next) + '">ورود و ادامه خرید دوره</a>';
    } else {
      purchaseUi = '<button id="courseBuyButton" class="course-login" type="button">خرید کامل دوره</button>';
      if (!data.purchaseEnabled) purchaseUi += '<p class="course-subtitle">خرید در این نسخه عمداً غیرفعال است؛ پس از تأیید تنظیمات و فعال‌سازی جداگانه امکان پرداخت فراهم می‌شود.</p>';
    }
    $("courseInfo").innerHTML = '<div class="course-hero"><div><p style="color:var(--purple);font-weight:700">دوره آموزشی هیلا فود</p><h1>' + escapeHtml(course.title || "دوره آموزشی") + '</h1><p class="course-subtitle">' + escapeHtml(course.description || "") + '</p>' + priceHtml + '<p>' + (data.entitled ? "وضعیت دسترسی: تأییدشده" : "وضعیت دسترسی: محتوای پولی تا تأیید مالکیت مسدود است.") + '</p>' + purchaseUi + '</div>' + image + '</div>';
    const chapters = Array.isArray(data.chapters) ? data.chapters : [];
    const lessons = Array.isArray(data.lessons) ? data.lessons : [];
    if (!chapters.length) $("courseLessons").innerHTML = '<div class="course-empty">هنوز فصلی برای این دوره ثبت نشده است.</div>';
    else $("courseLessons").innerHTML = chapters.map(chapter => {
      const chapterLessons = lessons.filter(lesson => String(lesson.chapter_id) === String(chapter.id));
      return '<section class="course-chapter"><h2>' + escapeHtml(chapter.title || "فصل") + '</h2>' + (chapterLessons.length ? chapterLessons.map(lesson => {
        const open = lesson.contentAvailable === true, free = Number(lesson.is_free) === 1 || lesson.is_free === true;
        let html = '<article class="course-lesson"><div class="course-lesson-head"><strong>' + escapeHtml(lesson.title || "درس") + '</strong>' + (open ? '<span class="course-lock" style="background:#edf9f1;color:#22663a">قابل مشاهده</span>' : free ? '<span class="course-lock">محتوا در دسترس نیست</span>' : '<span class="course-lock">🔒 درس پولی</span>') + '</div>';
        if (lesson.description) html += '<p class="course-subtitle">' + escapeHtml(lesson.description) + '</p>';
        if (open && lesson.content_text) html += '<div class="course-content">' + escapeHtml(lesson.content_text) + '</div>';
        const media = open ? safeMediaUrl(lesson.content_url) : "";
        if (media) html += '<p><a class="course-login" href="' + escapeHtml(media) + '" target="_blank" rel="noopener noreferrer">مشاهده محتوای درس</a></p>';
        if (open && !lesson.content_text && !media && lesson.content_type === "video") html += '<p class="course-subtitle">پخش امن ویدئوی این درس هنوز پیکربندی نشده است؛ نشانی عمومی یا خارجی رسانه به‌عنوان محتوای محافظت‌شده استفاده نمی‌شود.</p>';
        if (!open && !free) html += '<p class="course-subtitle">درس پولی تا تأیید مالکیت معتبر از سمت سرور مسدود می‌ماند.</p>';
        return html + '</article>';
      }).join("") : '<div class="course-empty">در این فصل هنوز درسی ثبت نشده است.</div>') + '</section>';
    }).join("");
    const buyButton = $("courseBuyButton");
    if (buyButton) buyButton.addEventListener("click", startCheckout);
    const pmsg = paymentMessage();
    if (pmsg) message(pmsg, params.get("payment") === "failed" || params.get("payment") === "disabled");
    if (params.get("checkout") === "1" && data.authenticated && !data.entitled) {
      if (data.purchaseEnabled) startCheckout();
      else message("ورود شما تأیید شد، اما خرید دوره هنوز در محیط عملیاتی فعال نشده است.", true);
    }
  }
  async function startCheckout() {
    if (!loadedData || !loadedData.authenticated) {
      const next = "course.html?id=" + encodeURIComponent(String(courseId)) + "&checkout=1";
      location.href = "account.html?next=" + encodeURIComponent(next); return;
    }
    if (!loadedData.purchaseEnabled) { message("خرید دوره هنوز فعال نشده است؛ هیچ پرداختی انجام نشد و دسترسی پولی باز نشد.", true); return; }
    const button = $("courseBuyButton");
    if (button) { button.disabled = true; button.textContent = "در حال آماده‌سازی سفارش…"; }
    message("در حال آماده‌سازی سفارش امن دوره…");
    try {
      const response = await fetch("/api/course-checkout", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId: Number(courseId) }) });
      let data = {}; try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(data.error || "آماده‌سازی سفارش ناموفق بود.");
      const target = new URL(String(data.paymentUrl || ""));
      if (target.origin !== "https://www.zarinpal.com" || !target.pathname.startsWith("/pg/StartPay/")) throw new Error("نشانی درگاه معتبر نیست.");
      location.assign(target.toString());
    } catch (error) {
      message(error.message || "آماده‌سازی سفارش ناموفق بود؛ هیچ دسترسی پولی ایجاد نشد.", true);
      if (button) { button.disabled = false; button.textContent = "خرید کامل دوره"; }
    }
  }
  async function load() {
    if (!courseId || !/^\d+$/.test(courseId) || Number(courseId) <= 0) { message("شناسه دوره معتبر نیست.", true); return; }
    try {
      const response = await fetch("/api/course-content?course_id=" + encodeURIComponent(courseId), { credentials: "same-origin", cache: "no-store" });
      let data = {}; try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(response.status === 503 ? "نمایش دوره فعلاً در دسترس نیست؛ هیچ محتوای پولی باز نشد." : data.error || "دریافت اطلاعات دوره ناموفق بود.");
      message(""); render(data);
    } catch (error) { message(error.message || "دریافت اطلاعات دوره ناموفق بود.", true); }
  }
  load();
})();