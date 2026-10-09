import { handleCoursePaymentCallback } from "../lib/course-payment-flow.mjs";

export async function onRequest(context) {
  return handleCoursePaymentCallback(context);
}
