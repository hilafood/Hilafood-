import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const admin = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const store = await readFile(new URL("../functions/api/store.js", import.meta.url), "utf8");

test("admin has a dedicated card transfer settings section with save, reload, and disable controls", () => {
  assert.match(admin, /id="cardTransferSettings"/);
  assert.match(admin, /تنظیمات پرداخت کارت‌به‌کارت/);
  assert.match(admin, /id="cardNumber"/);
  assert.match(admin, /id="accountHolderName"/);
  assert.match(admin, /id="cardTransferEnabled"/);
  assert.match(admin, /onclick="saveCardTransferSettings\(\)"/);
  assert.match(admin, /onclick="loadStore\(\)"/);
  assert.match(admin, /onclick="disableCardTransfer\(\)"/);
});

test("settings load from server response and remain available to the authenticated administrator after refresh", () => {
  assert.match(admin, /data\s*=\s*await api\("GET"\)/);
  assert.match(admin, /\$\("cardNumber"\)\.value\s*=\s*data\.settings\.cardNumber\s*\|\|\s*""/);
  assert.match(admin, /\$\("accountHolderName"\)\.value\s*=\s*data\.settings\.accountHolderName\s*\|\|\s*""/);
  assert.match(admin, /\$\("cardTransferEnabled"\)\.checked\s*=\s*data\.settings\.cardTransferEnabled === true/);
  assert.match(admin, /await api\("POST",\s*\{\s*action:\s*"save-settings",\s*settings:\s*\{\s*cardNumber,\s*accountHolderName,\s*cardTransferEnabled: enabled/s);
  assert.match(admin, /await loadStore\(\)/);
});

test("disabling card transfer preserves stored card details while setting enabled=false", () => {
  assert.match(admin, /async function disableCardTransfer\(\)\s*\{\s*\$\("cardTransferEnabled"\)\.checked = false;\s*await saveCardTransferSettings\(\);/);
  assert.match(admin, /const settings = \{ cardTransferEnabled: enabled \}/);
  assert.match(admin, /if \(enabled \|\| cardNumber \|\| accountHolderName\)/);
  assert.match(admin, /settings\.cardNumber = cardNumber/);
  assert.match(admin, /settings\.accountHolderName = accountHolderName/);
});

test("server validates card details and protects settings writes with admin authorization", () => {
  assert.match(store, /adminActions\.has\(action\) && !isAdmin\(request, env\)/);
  assert.match(store, /"cardTransferEnabled", "cardNumber", "accountHolderName"/);
  assert.match(store, /شماره کارت باید ۱۶ رقم باشد/);
  assert.match(store, /settings\.cardTransferEnabled === true/);
  assert.match(store, /delete store\.settings\.cardNumber/);
  assert.match(store, /delete store\.settings\.accountHolderName/);
});
