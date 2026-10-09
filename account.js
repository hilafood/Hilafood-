(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const statusBox = $("accountStatus");
  const phoneStep = $("phoneStep");
  const codeStep = $("codeStep");
  const loggedOut = $("accountLoggedOut");
  const loggedIn = $("accountLoggedIn");
  const requestButton = $("requestOtpButton");
  const verifyButton = $("verifyOtpButton");
  const resendButton = $("resendOtpButton");
  const logoutButton = $("logoutButton");
  let phone = "";
  let resendUntil = 0;
  let countdownTimer = null;

  function showStatus(message, kind = "") {
    statusBox.textContent = message;
    statusBox.className = "account-status" + (kind ? " " + kind : "");
    statusBox.hidden = !message;
  }

  function digits(value) {
    return String(value || "")
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  }

  function normalizedPhone(value) {
    let result = digits(value).trim().replace(/[\s()-]/g, "");
    if (result.startsWith("+98")) result = "0" + result.slice(3);
    if (result.startsWith("0098")) result = "0" + result.slice(4);
    return /^09\d{9}$/.test(result) ? result : null;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(options.method === "POST" ? { "Content-Type": "application/json" } : {})
      }
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data.error || "درخواست انجام نشد. دوباره تلاش کنید.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setBusy(button, busy, busyText, normalText) {
    button.disabled = busy;
    button.textContent = busy ? busyText : normalText;
  }

  function startCountdown(seconds = 60) {
    clearInterval(countdownTimer);
    resendUntil = Date.now() + seconds * 1000;
    resendButton.disabled = true;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000));
      resendButton.textContent = remaining
        ? `ارسال دوباره کد (${remaining})`
        : "ارسال دوباره کد";
      resendButton.disabled = remaining > 0;
      if (!remaining) clearInterval(countdownTimer);
    };
    tick();
    countdownTimer = setInterval(tick, 250);
  }

  function showLoggedOut() {
    loggedOut.hidden = false;
    loggedIn.hidden = true;
  }

  function showLoggedIn(user, expiresAt) {
    loggedOut.hidden = true;
    loggedIn.hidden = false;
    const verified = user.phoneVerifiedAt ? "تأیید شده" : "تأیید نشده";
    $("accountUser").textContent =
      `شماره موبایل: ${user.phone || "—"} | وضعیت شماره: ${verified} | اعتبار نشست تا: ${expiresAt || "—"}`;
    loadCourseOrders();
    continueToNext();
  }

  function continueToNext() {
    const next = new URLSearchParams(location.search).get("next");
    if (!next || next.startsWith("//") || next.includes("\\\\")) return;
    try {
      const target = new URL(next, location.origin);
      if (target.origin !== location.origin || target.pathname === "/account.html") return;
      setTimeout(() => location.replace(target.pathname + target.search + target.hash), 250);
    } catch {}
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? new Intl.NumberFormat("fa-IR").format(number) + " تومان" : "—";
  }

  async function loadCourseOrders() {
    const box = $("accountCourseOrders");
    if (!box) return;
    box.textContent = "در حال دریافت سفارش‌های دوره…";
    try {
      const data = await api("/api/course-orders");
      const orders = Array.isArray(data.orders) ? data.orders : [];
      if (!orders.length) {
        box.textContent = "هنوز سفارشی برای دوره‌های آموزشی ثبت نشده است.";
        return;
      }
      box.textContent = "";
      orders.forEach(order => {
        const card = document.createElement("article");
        card.className = "account-course-order";
        const title = document.createElement("strong");
        title.textContent = order.course_title || "دوره آموزشی";
        const status = document.createElement("p");
        const labels = {
          pending_gateway: "در انتظار آماده‌سازی درگاه",
          pending_payment: "در انتظار پرداخت",
          paid: "پرداخت تأیید شده",
          failed: "پرداخت ناموفق",
          cancelled: "لغوشده"
        };
        status.textContent = "وضعیت: " + (labels[order.status] || "نامشخص") +
          " | مبلغ: " + money(order.amount_due_toman);
        card.append(title, status);
        if (order.status === "paid") {
          const link = document.createElement("a");
          link.href = "course.html?id=" + encodeURIComponent(String(order.course_id));
          link.textContent = "ورود به دوره";
          link.className = "account-primary";
          card.append(link);
        }
        box.append(card);
      });
    } catch (error) {
      box.textContent = error.status === 401
        ? "برای دیدن سفارش‌ها باید وارد حساب شوید."
        : "سفارش‌های دوره فعلاً در دسترس نیستند.";
    }
  }

  async function refreshSession() {
    try {
      const data = await api("/api/auth/me");
      if (!data.user || !data.user.phoneVerifiedAt) throw new Error("نشست معتبر نیست.");
      showLoggedIn(data.user, data.sessionExpiresAt);
    } catch (error) {
      showLoggedOut();
      if (error.status !== 401) {
        showStatus(error.message || "وضعیت حساب در حال حاضر قابل دریافت نیست.", "error");
      }
    }
  }

  async function requestCode() {
    const value = normalizedPhone($("accountPhone").value);
    if (!value) {
      showStatus("شماره موبایل معتبر وارد کنید؛ نمونه: ۰۹۱۲۳۴۵۶۷۸۹", "error");
      $("accountPhone").focus();
      return;
    }
    phone = value;
    setBusy(requestButton, true, "در حال درخواست کد…", "دریافت کد ورود");
    showStatus("");
    try {
      const data = await api("/api/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ phone })
      });
      phoneStep.hidden = true;
      codeStep.hidden = false;
      $("accountCode").value = "";
      $("accountCode").focus();
      startCountdown(Number(data.expiresIn) > 0 ? 60 : 60);
      showStatus(data.message || "اگر ارسال پیامک امکان‌پذیر باشد، کد ورود ارسال می‌شود.", "success");
    } catch (error) {
      const message = error.status === 503
        ? "ارسال کد فعلاً در دسترس نیست. تنظیمات احراز هویت یا سرویس پیامک ممکن است کامل نباشد؛ راه ورود جایگزین وجود ندارد."
        : error.message;
      showStatus(message, "error");
    } finally {
      setBusy(requestButton, false, "در حال درخواست کد…", "دریافت کد ورود");
    }
  }

  async function verifyCode() {
    const code = digits($("accountCode").value).trim();
    if (!/^\d{6}$/.test(code)) {
      showStatus("کد شش‌رقمی را درست وارد کنید.", "error");
      $("accountCode").focus();
      return;
    }
    setBusy(verifyButton, true, "در حال بررسی…", "تأیید کد و ورود");
    showStatus("");
    try {
      const data = await api("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, code })
      });
      if (!data.user || !data.user.phoneVerifiedAt) throw new Error("تأیید ورود از سمت سرور کامل نشد.");
      clearInterval(countdownTimer);
      showLoggedIn(data.user, data.expiresAt);
      showStatus("ورود با موفقیت انجام شد.", "success");
    } catch (error) {
      showStatus(error.status === 503
        ? "ورود فعلاً در دسترس نیست؛ تنظیمات سرور یا پایگاه داده کامل نیست."
        : error.message, "error");
    } finally {
      setBusy(verifyButton, false, "در حال بررسی…", "تأیید کد و ورود");
    }
  }

  async function logout() {
    setBusy(logoutButton, true, "در حال خروج…", "خروج از حساب");
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      clearInterval(countdownTimer);
      showLoggedOut();
      phoneStep.hidden = false;
      codeStep.hidden = true;
      showStatus("از حساب خارج شدید.", "success");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setBusy(logoutButton, false, "در حال خروج…", "خروج از حساب");
    }
  }

  $("accountPhone").addEventListener("keydown", event => {
    if (event.key === "Enter") requestCode();
  });
  $("accountCode").addEventListener("keydown", event => {
    if (event.key === "Enter") verifyCode();
  });
  requestButton.addEventListener("click", requestCode);
  verifyButton.addEventListener("click", verifyCode);
  resendButton.addEventListener("click", requestCode);
  $("changePhoneButton").addEventListener("click", () => {
    clearInterval(countdownTimer);
    phoneStep.hidden = false;
    codeStep.hidden = true;
    showStatus("");
    $("accountPhone").focus();
  });
  logoutButton.addEventListener("click", logout);

  refreshSession();
})();