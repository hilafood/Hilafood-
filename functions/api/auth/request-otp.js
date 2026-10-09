import { requestOtp } from "../../lib/auth.mjs";

export async function onRequest(context) {
  return requestOtp(context);
}
