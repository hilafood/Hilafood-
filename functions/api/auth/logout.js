import { logout } from "../../lib/auth.mjs";

export async function onRequest(context) {
  return logout(context);
}
