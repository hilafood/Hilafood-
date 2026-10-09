(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const courseId = params.get("id");
  const statusBox = $("courseStatus");

  function message(text, error = false) {
    statusBox.textContent = text;
    statusBox.className = error ? "course-error" : "course-empty";
    statusBox.hidden = !text;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function safeMediaUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(https?:\/\/|\/|assets\/)/i.test(raw)) return raw;
    return "";
  }

  function render(data) {
    const course = data.course || {};
    const image = course.image ? `<img src="${escapeHtml(course.image)}" alt="${escapeHtml(course.title || "دوره آموزشی")}" loading="lazy">` : "";
    $("courseInfo").innerHTML = `
      <div class="course-hero">
        <div>
          <p style="color:var(--purple);font-weight:700">دوره آموزشی هیلا فود</p>
          <h1>${escapeHtml(course.title || "دوره آموزشی")}</h1>
          <p class="course-subtitle">${escapeHtml(course.description || "")}</p>
          <p>${data.entitled ? "وضعیت دسترسی: دسترسی معتبر از سمت سرور تأیید شد." : "وضعیت دسترسی: محتوای پولی برای این حساب باز نیست."}</p>
          ${data.authenticated ? "" : '<a class="course-login" href="account.html">ورود به حساب کاربری</a>'}
        </div>
        ${image}
      </div>
    `;

    const chapters = Array.isArray(data.chapters) ? data.chapters : [];
    const lessons = Array.isArray(data.lessons) ? data.lessons : [];
    if (!chapters.length) {
      $("courseLessons").innerHTML = '<div class="course-empty">هنوز فصلی برای این دوره ثبت نشده است.</div>';
      return;
    }

    $("courseLessons").innerHTML = chapters.map(chapter => {
      const chapterLessons = lessons.filter(lesson => String(lesson.chapter_id) === String(chapter.id));
      return `
        <section class="course-chapter">
          <h2>${escapeHtml(chapter.title || "فصل")}</h2>
          ${chapterLessons.length ? chapterLessons.map(lesson => {
            const open = lesson.contentAvailable === true;
            const free = Number(lesson.is_free) === 1 || lesson.is_free === true;
            return `
              <article class="course-lesson">
                <div class="course-lesson-head">
                  <strong>${escapeHtml(lesson.title || "درس")}</strong>
                  ${open ? '<span class="course-lock" style="background:#edf9f1;color:#22663a">قابل مشاهده</span>' : free ? '<span class="course-lock">محتوا در دسترس نیست</span>' : '<span class="course-lock">🔒 درس پولی</span>'}
                </div>
                ${lesson.description ? `<p class="course-subtitle">${escapeHtml(lesson.description)}</p>` : ""}
                ${open && lesson.content_text ? `<div class="course-content">${escapeHtml(lesson.content_text)}</div>` : ""}
                ${open && safeMediaUrl(lesson.content_url) ? `<p><a class="course-login" href="${escapeHtml(safeMediaUrl(lesson.content_url))}" target="_blank" rel="noopener noreferrer">مشاهده محتوای درس</a></p>` : ""}
                ${open && !lesson.content_text && !safeMediaUrl(lesson.content_url) && lesson.content_type === "video" ? '<p class="course-subtitle">پخش امن ویدئوی این درس هنوز پیکربندی نشده است؛ ویدئوی پولی باز نمی‌شود.</p>' : ""}
                ${!open && !free ? '<p class="course-subtitle">پس از اتصال و تأیید مالکیت معتبر، محتوای این درس از سرور ارائه می‌شود.</p>' : ""}
              </article>
            `;
          }).join("") : '<div class="course-empty">در این فصل هنوز درسی ثبت نشده است.</div>'}
        </section>
      `;
    }).join("");
  }

  async function load() {
    if (!courseId || !/^\d+$/.test(courseId) || Number(courseId) <= 0) {
      message("شناسه دوره معتبر نیست.", true);
      return;
    }
    try {
      const response = await fetch(`/api/course-content?course_id=${encodeURIComponent(courseId)}`, {
        credentials: "same-origin",
        cache: "no-store"
      });
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) {
        throw new Error(response.status === 503
          ? "نمایش محتوای دوره فعلاً در دسترس نیست. ساختار پایگاه داده یا تنظیمات لازم هنوز آماده نیست؛ هیچ محتوای پولی باز نشد."
          : data.error || "دریافت اطلاعات دوره ناموفق بود.");
      }
      message("");
      render(data);
    } catch (error) {
      message(error.message || "دریافت اطلاعات دوره ناموفق بود.", true);
    }
  }
  load();
})();