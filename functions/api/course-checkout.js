import { startCourseCheckout } from "../lib/course-payment-flow.mjs";

export async function onRequest(context) {
  return startCourseCheckout(context);
}
