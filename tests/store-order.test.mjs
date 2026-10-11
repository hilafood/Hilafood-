import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/store.js";

const origin = "https://hilafood.pages.dev";
function makeDb() {
  const state = { orders: [], product: { id: "p1", name: "محصول آزمایشی", price: 120000, discount_price: 90000, active: 1 } };
  return {
    state,
    prepare(sql) {
      const stmt = { sql, args: [], bind(...args) { stmt.args = args; return stmt; } };
      stmt.first = async () => {
        if (sql.includes("SELECT COUNT(*) AS total FROM products")) return { total: 1 };
        if (sql.includes("FROM products") && sql.includes("discount_price") && sql.includes("WHERE id = ?")) {
          return String(stmt.args[0]) === String(state.product.id) ? state.product : null;
        }
        if (sql.includes("FROM settings") && sql.includes("shippingMethods")) {
          return { value: JSON.stringify([{ id: "post-pishtaz", name: "پست پیشتاز", price: 25000, active: true }]) };
        }
        if (sql.includes("FROM settings") && sql.includes("smsEnabled")) return { value: "false" };
        return null;
      };
      stmt.all = async () => ({ results: [] });
      stmt.run = async () => {
        if (sql.includes("INSERT INTO orders")) {
          state.orders.push(stmt.args);
          return { meta: { last_row_id: 41, changes: 1 } };
        }
        return { meta: { changes: 1 } };
      };
      return stmt;
    }
  };
}
function request(qty) {
  return new Request(origin + "/api/store", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create-order",
      customer: { name: "مشتری آزمایشی", phone: "09000000000", address: "نشانی آزمایشی" },
      shippingId: "post-pishtaz",
      items: [{ id: "p1", qty, price: 1, name: "قیمت جعلی مرورگر" }]
    })
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

test("invalid product quantity is rejected without recording an order", async () => {
  for (const qty of ["not-a-number", 1.5, 0, -2, Number.MAX_SAFE_INTEGER + 1]) {
    const db = makeDb();
    const response = await onRequestPost({ request: request(qty), env: { DB: db } });
    assert.equal(response.status, 400, "quantity " + String(qty));
    assert.equal(db.state.orders.length, 0, "quantity " + String(qty));
  }
});
