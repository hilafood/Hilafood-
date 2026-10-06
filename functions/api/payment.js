export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);

  /*
   * کلید زرین‌پال باید در Cloudflare به صورت Secret
   * با نام ZARINPAL_MERCHANT_ID ذخیره شود.
   */
  const merchantId = env.ZARINPAL_MERCHANT_ID;

  if (!merchantId) {
    return new Response(
      JSON.stringify({
        error: "ZARINPAL_MERCHANT_ID تنظیم نشده است."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      }
    );
  }


  /* --------------------------------------------------
     بازگشت از زرین‌پال
  -------------------------------------------------- */

  if (
    request.method === "GET" &&
    url.searchParams.has("Authority")
  ) {

    const authority =
      url.searchParams.get("Authority");

    const status =
      url.searchParams.get("Status");


    if (
      status !== "OK" ||
      !authority
    ) {

      return Response.redirect(
        new URL(
          "/payment-result.html?status=cancel",
          url.origin
        ),
        302
      );
    }


    /*
     * مبلغ واقعی تراکنش را هنگام درخواست پرداخت
     * داخل Authority ذخیره نمی‌کنیم.
     *
     * برای مرحله فعلی، مبلغ از پارامتر amount
     * که هنگام شروع پرداخت ساخته می‌شود دریافت می‌شود.
     */

    const amount =
      Number(
        url.searchParams.get("amount") || 0
      );


    if (!amount || amount < 1000) {

      return Response.redirect(
        new URL(
          "/payment-result.html?status=failed",
          url.origin
        ),
        302
      );
    }


    const verifyResponse =
      await fetch(
        "https://api.zarinpal.com/pg/v4/payment/verify.json",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            merchant_id: merchantId,

            amount: amount * 10,

            authority: authority
          })
        }
      );


    const verifyData =
      await verifyResponse.json();


    const code =
      verifyData?.data?.code;


    if (
      code === 100 ||
      code === 101
    ) {

      const refId =
        verifyData?.data?.ref_id || "";


      const resultUrl =
        new URL(
          "/payment-result.html",
          url.origin
        );


      resultUrl.searchParams.set(
        "status",
        "success"
      );


      resultUrl.searchParams.set(
        "ref",
        String(refId)
      );


      return Response.redirect(
        resultUrl.toString(),
        302
      );
    }


    return Response.redirect(
      new URL(
        "/payment-result.html?status=failed",
        url.origin
      ),
      302
    );
  }


  /* --------------------------------------------------
     شروع پرداخت
  -------------------------------------------------- */

  if (request.method !== "POST") {

    return new Response(
      JSON.stringify({
        error:
          "روش درخواست نامعتبر است."
      }),
      {
        status: 405,
        headers: {
          "Content-Type":
            "application/json; charset=utf-8"
        }
      }
    );
  }


  let body;

  try {

    body =
      await request.json();

  } catch {

    return new Response(
      JSON.stringify({
        error:
          "اطلاعات پرداخت نامعتبر است."
      }),
      {
        status: 400,
        headers: {
          "Content-Type":
            "application/json; charset=utf-8"
        }
      }
    );
  }


  const amount =
    Number(body.amount || 0);


  if (
    !Number.isFinite(amount) ||
    amount < 1000
  ) {

    return new Response(
      JSON.stringify({
        error:
          "مبلغ پرداخت نامعتبر است."
      }),
      {
        status: 400,
        headers: {
          "Content-Type":
            "application/json; charset=utf-8"
        }
      }
    );
  }


  /*
   * زرین‌پال مبلغ را به ریال می‌گیرد.
   * مبلغ‌های فروشگاه ما تومان هستند.
   */
  const rialAmount =
    Math.round(amount * 10);


  const callbackUrl =
    new URL(
      "/api/payment",
      url.origin
    );


  /*
   * مبلغ را برای مرحله بازگشت نیز همراه Callback
   * ارسال می‌کنیم.
   */
  callbackUrl.searchParams.set(
    "amount",
    String(amount)
  );


  const requestResponse =
    await fetch(
      "https://api.zarinpal.com/pg/v4/payment/request.json",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          merchant_id:
            merchantId,

          amount:
            rialAmount,

          callback_url:
            callbackUrl.toString(),

          description:
            "خرید از هیلا فود",

          metadata: {
            mobile:
              body.mobile || ""
          }

        })
      }
    );


  const requestData =
    await requestResponse.json();


  const requestCode =
    requestData?.data?.code;


  const authority =
    requestData?.data?.authority;


  if (
    requestCode !== 100 ||
    !authority
  ) {

    return new Response(
      JSON.stringify({
        error:
          "دریافت درگاه پرداخت از زرین‌پال انجام نشد.",
        code:
          requestCode || null
      }),
      {
        status: 400,
        headers: {
          "Content-Type":
            "application/json; charset=utf-8"
        }
      }
    );
  }


  const paymentUrl =
    "https://www.zarinpal.com/pg/StartPay/" +
    authority;


  return new Response(
    JSON.stringify({
      success: true,

      authority:
        authority,

      paymentUrl:
        paymentUrl
    }),
    {
      status: 200,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );
}
