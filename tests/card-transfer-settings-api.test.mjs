import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/store.js";

function makeDb() {
  const settings = new Map();
  return {
    settings,
    prepare(sql) {
      const statement = { args: [], bind(...args) { statement.args = args; return statement; } };
      statement.run = async () => {
        if (/INSERT INTO settings/i.test(sql)) settings.set(statement.args[0], statement.args[1]);
        return { meta: { changes: 1 } };
      };
      statement.all = async () => {
        if (/SELECT key, value FROM settings/i.test(sql)) {
          return { results: [...settings.entries()].map(([key, value]) => ({ key, value })) };
        }
        if (/PRAGMA table_info\(courses\)/i.test(sql)) {
          return { results: [{ name: "discount_price" }, { name: "title_en" }] };
        }
        return { results: [] };
      };
      statement.first = async () => null;
      return statement;
    }
  };
}

function postSettings(db, settings, adminKey) {
  return onRequestPost({
    request: new Request("https://example.test/api/store", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminKey ? { "x-admin-key": adminKey } : {})
      },
      body: JSON.stringify({ action: "save-settings", settings })
    }),
    env: { DB: db, ADMIN_KEY: "secret-admin-key" }
  });
}
function getStore(db, adminKey) {
  return onRequestGet({
    request: new Request("https://example.test/api/store", {
      headers: adminKey ? { "x-admin-key": adminKey } : {}
    }),
    env: { DB: db, ADMIN_KEY: "secret-admin-key" }
  });
}

test("negative: anonymous and wrong-key users cannot save card transfer settings", async () => {
  for (const key of [undefined, "wrong-key"]) {
    const db = makeDb();
    const response = await postSettings(db, {
      cardNumber: "1234567812345678",
      accountHolderName: "آزمایش",
      cardTransferEnabled: true
    }, key);
    assert.equal(response.status, 401);
    assert.equal(db.settings.size, 0);
  }
});

test("positive: authorized admin saves and reloads card transfer settings", async () => {
  const db = makeDb();
  const save = await postSettings(db, {
    cardNumber: "1234567812345678",
    accountHolderName: "صاحب حساب آزمایشی",
    cardTransferEnabled: true
  }, "secret-admin-key");
  assert.equal(save.status, 200);
  assert.equal((await save.json()).success, true);

  const reload = await getStore(db, "secret-admin-key");
  assert.equal(reload.status, 200);
  const settings = (await reload.json()).settings;
  assert.equal(settings.cardNumber, "1234567812345678");
  assert.equal(settings.accountHolderName, "صاحب حساب آزمایشی");
  assert.equal(settings.cardTransferEnabled, true);
});

test("negative: public store API never exposes card number or account-holder name, even when enabled", async () => {
  const db = makeDb();
  await postSettings(db, {
    cardNumber: "1234567812345678",
    accountHolderName: "صاحب حساب آزمایشی",
    cardTransferEnabled: true
  }, "secret-admin-key");

  const response = await getStore(db);
  assert.equal(response.status, 200);
  const settings = (await response.json()).settings;
  assert.equal(settings.cardTransferEnabled, true);
  assert.equal(Object.hasOwn(settings, "cardNumber"), false);
  assert.equal(Object.hasOwn(settings, "accountHolderName"), false);
});

test("negative: invalid card number and enabling without account details are rejected", async () => {
  const db = makeDb();
  const badCard = await postSettings(db, { cardNumber: "1234", accountHolderName: "آزمایش", cardTransferEnabled: true }, "secret-admin-key");
  assert.equal(badCard.status, 400);
  const missingName = await postSettings(db, { cardNumber: "1234567812345678", accountHolderName: "", cardTransferEnabled: true }, "secret-admin-key");
  assert.equal(missingName.status, 400);
  assert.equal(db.settings.size, 0);
});

test("disabling card transfer persists the disabled state while retaining the account details", async () => {
  const db = makeDb();
  await postSettings(db, { cardNumber: "1234567812345678", accountHolderName: "صاحب حساب آزمایشی", cardTransferEnabled: true }, "secret-admin-key");
  const disabled = await postSettings(db, { cardTransferEnabled: false }, "secret-admin-key");
  assert.equal(disabled.status, 200);
  const reload = await getStore(db, "secret-admin-key");
  const settings = (await reload.json()).settings;
  assert.equal(settings.cardTransferEnabled, false);
  assert.equal(settings.cardNumber, "1234567812345678");
  assert.equal(settings.accountHolderName, "صاحب حساب آزمایشی");
});
