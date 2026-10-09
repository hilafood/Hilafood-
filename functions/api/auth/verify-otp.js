import { verifyOtp } from "../../lib/auth.mjs";

export async function onRequest(context) {
  return verifyOtp(context);
}
