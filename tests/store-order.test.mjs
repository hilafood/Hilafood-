import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestPost, onRequestPut } from "../functions/api/store.js";

const origin = "https://hilafood.pages.dev";
function makeDb() {
  const state = { orders: [], productWeights: { p1: 400 }, product: { id: "p1", name: "محصول آزمایشی", price: 120000, discount_price: 90000, active: 1 } };
  return {
    state,
    prepare(sql) {
      const stmt = { sql, args: [], bind(...args) { stmt.args = args; return stmt; } };
      stmt.first = async () => {
        if (sql.includes("SELECT COUNT(*) AS total FROM products")) return { total: 1 };
        if (sql.includes("SELECT id FROM products WHERE id = ?")) {
          return String(stmt.args[0]) === String(state.product.id) ? { id: state.product.id } : null;
        }
        if (sql.includes("FROM products") && sql.includes("discount_price") && sql.includes("WHERE id = ?")) {
          return String(stmt.args[0]) === String(state.product.id) ? state.product : null;
        }
        if (sql.includes("FROM settings") && sql.includes("productWeights")) {
          return { value: JSON.stringify(state.productWeights) };
        }
        if (sql.includes("FROM settings") && sql.includes("shippingMethods")) {
          return { value: JSON.stringify([{ id: "post-pishtaz", name: "پست پیشتاز", price: 25000, active: true }]) };
        }
        if (sql.includes("FROM settings") && sql.includes("smsEnabled")) return { value: "false" };
        return null;
      };
      stmt.all = async () => {
        if (sql.includes("FROM orders")) {
          return {
            results: state.orders.map((args, index) => ({
              id: 41 + index,
              customer_name: args[0],
              customer_phone: args[1],
              customer_address: args[2],
              items: args[3],
              subtotal: args[4],
              shipping_id: args[5],
              shipping_name: args[6],
              shipping_price: args[7],
              total: args[8],
              status: args[9],
              payment_status: args[10],
              created_at: "2026-10-11 12:00:00"
            }))
          };
        }
        return { results: [] };
      };
      stmt.run = async () => {
        if (sql.includes("UPDATE products")) {
          state.product = {
            id: stmt.args[9],
            name: stmt.args[0],
            price: stmt.args[3],
            discount_price: stmt.args[4],
            active: stmt.args[8]
          };
          return { meta: { changes: 1 } };
        }
        if (sql.includes("INSERT INTO settings") && sql.includes("productWeights")) {
          state.productWeights = JSON.parse(stmt.args[0]);
          return { meta: { changes: 1 } };
        }
        if (sql.includes("INSERT INTO orders")) {
          state.orders.push(stmt.args);
          return { meta: { last_row_id: 41, changes: 1 } };
        }
        if (sql.includes("UPDATE orders")) {
          const row = state.orders[stmt.args[2] - 41];
          if (row) {
            row[9] = stmt.args[0];
            row[10] = stmt.args[1];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        return { meta: { changes: 1 } };
      };
      return stmt;
    }
  };
}
function request(qty, itemOverrides = {}) {
  return new Request(origin + "/api/store", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create-order",
      customer: { name: "مشتری آزمایشی", phone: "09000000000", address: "نشانی آزمایشی" },
      shippingId: "post-pishtaz",
      items: [{ id: "p1", qty, price: 1, name: "قیمت جعلی مرورگر", ...itemOverrides }]
    })
  });
}

function adminRequest(action, body = {}) {
  return new Request(origin + "/api/store", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "x-admin-key": "test-admin-key"
    },
    body: JSON.stringify({ action, ...body })
  });
}

test("product order total uses database price and discount, not browser price", async () => {
  const db = makeDb();
  const response = await onRequestPost({ request: request(2), env: { DB: db } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.subtotal, 180000);
  assert.equal(body.shippingPrice, 25000);
  assert.equal(body.total, 205000);
  assert.equal(db.state.orders.length, 1);
  assert.equal(db.state.orders[0][4], 180000);
  assert.equal(db.state.orders[0][8], 205000);
  assert.equal(JSON.parse(db.state.orders[0][3])[0].price, 90000);
});

test("valid positive integer product quantities are accepted", async () => {
  for (const qty of [1, 2, "3"]) {
    const db = makeDb();
    const response = await onRequestPost({ request: request(qty), env: { DB: db } });
    assert.equal(response.status, 200, "quantity " + String(qty));
    assert.equal(db.state.orders.length, 1, "quantity " + String(qty));
    const items = JSON.parse(db.state.orders[0][3]);
    assert.equal(items[0].qty, Number(qty));
    assert.ok(Number.isSafeInteger(items[0].qty));
    assert.ok(items[0].qty > 0);
  }
});

test("missing product quantity retains the default of one", async () => {
  const db = makeDb();
  const response = await onRequestPost({ request: request(undefined), env: { DB: db } });
  assert.equal(response.status, 200);
  assert.equal(db.state.orders.length, 1);
  assert.equal(JSON.parse(db.state.orders[0][3])[0].qty, 1);
});

test("invalid product quantities return HTTP 400 without recording an order", async () => {
  for (const qty of ["not-a-number", "NaN", null, true, false, {}, [], 1.5, 0, -2, Number.MAX_SAFE_INTEGER + 1, "", " ", "2.2"]) {
    const db = makeDb();
    const response = await onRequestPost({ request: request(qty), env: { DB: db } });
    assert.equal(response.status, 400, "quantity " + String(qty));
    assert.equal(db.state.orders.length, 0, "quantity " + String(qty));
  }
});

test("test order uses one quarter of the currently payable discounted price and package weight", async () => {
  const db = makeDb();
  const response = await onRequestPost({
    request: request(2, { orderType: "test", price: 1, weightGrams: 99999 }),
    env: { DB: db }
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.subtotal, 45000);
  assert.equal(body.total, 70000);
  const item = JSON.parse(db.state.orders[0][3])[0];
  assert.equal(item.price, 22500);
  assert.equal(item.weightGrams, 100);
  assert.equal(item.orderType, "test");
  assert.equal(item.orderTypeLabel, "سفارش تست محصول");
});

test("test price and weight update automatically after an admin product edit", async () => {
  const db = makeDb();
  const updateResponse = await onRequestPut({
    request: new Request(origin + "/api/store", {
      method: "PUT",
      headers: { Origin: origin, "Content-Type": "application/json", "x-admin-key": "test-admin-key" },
      body: JSON.stringify({
        product: {
          id: "p1",
          name: "محصول آزمایشی",
          cat: "",
          desc: "",
          price: 280000,
          discountPrice: null,
          weightGrams: 600,
          stage: "",
          video: "",
          img: "",
          active: true
        }
      })
    }),
    env: { DB: db, ADMIN_KEY: "test-admin-key" }
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(db.state.product.price, 280000);
  assert.equal(db.state.productWeights.p1, 600);

  const response = await onRequestPost({
    request: request(1, { orderType: "test" }),
    env: { DB: db }
  });
  assert.equal(response.status, 200);
  const item = JSON.parse(db.state.orders[0][3])[0];
  assert.equal(item.price, 70000);
  assert.equal(item.weightGrams, 150);
});

test("test order rejects missing or invalid server-side package weight", async () => {
  for (const weight of [undefined, 0, -10, 1.5, "invalid"]) {
    const db = makeDb();
    db.state.productWeights.p1 = weight;
    const response = await onRequestPost({
      request: request(1, { orderType: "test", weightGrams: 400 }),
      env: { DB: db }
    });
    assert.equal(response.status, 400, String(weight));
    assert.equal(db.state.orders.length, 0);
  }
});

test("ordinary product orders retain the full current payable price and legacy defaults", async () => {
  const db = makeDb();
  const response = await onRequestPost({
    request: request(1, { orderType: "full", price: 1, weightGrams: 1 }),
    env: { DB: db }
  });
  assert.equal(response.status, 200);
  const item = JSON.parse(db.state.orders[0][3])[0];
  assert.equal(item.price, 90000);
  assert.equal(item.orderType, "full");
  assert.equal(item.weightGrams, 400);
});

test("cart, category page, admin form, and order list expose test-order metadata", async () => {
  const [app, category, admin] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../category.js", import.meta.url), "utf8"),
    readFile(new URL("../admin.html", import.meta.url), "utf8")
  ]);
  assert.match(app, /سفارش تست محصول/);
  assert.ok(app.includes("cartItemPrice(product, item)"));
  assert.match(category, /addCategoryToCart/);
  assert.match(admin, /id="packageWeightGrams"/);
  assert.match(admin, /orderTypeLabel/);
  assert.match(admin, /order-item-meta/);
});

test("order list requires admin access and retains paid orders for follow-up", async () => {
  const db = makeDb();
  const created = await onRequestPost({
    request: request(1),
    env: { DB: db }
  });
  assert.equal(created.status, 200);
  assert.equal(db.state.orders.length, 1);

  const denied = await onRequestPost({
    request: new Request(origin + "/api/store", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get-orders" })
    }),
    env: { DB: db, ADMIN_KEY: "test-admin-key" }
  });
  assert.equal(denied.status, 401);

  const listed = await onRequestPost({
    request: adminRequest("get-orders"),
    env: { DB: db, ADMIN_KEY: "test-admin-key" }
  });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).orders.length, 1);

  const updated = await onRequestPost({
    request: adminRequest("update-order", {
      orderId: 41,
      status: "completed",
      paymentStatus: "paid"
    }),
    env: { DB: db, ADMIN_KEY: "test-admin-key" }
  });
  assert.equal(updated.status, 200);

  const listedAgain = await onRequestPost({
    request: adminRequest("get-orders"),
    env: { DB: db, ADMIN_KEY: "test-admin-key" }
  });
  const orders = (await listedAgain.json()).orders;
  assert.equal(orders.length, 1);
  assert.equal(orders[0].paymentStatus, "paid");
  assert.equal(orders[0].status, "completed");
});
