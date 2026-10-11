import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/store.js";

const origin = "https://hilafood.pages.dev";
const adminKey = "test-admin-key";

function makeDb({ hasDiscount = true, courses = [], simulateSlugRace = false, simulateUpdateSlugRace = false } = {}) {
  const state = {
    hasDiscount,
    simulateSlugRace,
    simulateUpdateSlugRace,
    slugPrecheckSeen: false,
    updateSlugPrecheckSeen: false,
    courses: courses.map(course => ({ ...course })),
    nextId: Math.max(0, ...courses.map(course => Number(course.id) || 0)) + 1
  };
  function courseColumns() {
    const names = ["id", "title", "slug", "description", "price"];
    if (state.hasDiscount) names.push("discount_price");
    names.push("image", "active", "created_at", "updated_at");
    return names.map(name => ({ name }));
  }
  return {
    state,
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async all() {
          if (sql.includes("PRAGMA table_info(courses)")) return { results: courseColumns() };
          if (sql.includes("SELECT key, value FROM settings")) return { results: [] };
          if (sql.includes("SELECT id, name, image FROM categories")) return { results: [] };
          if (sql.includes("FROM products")) return { results: [] };
          if (sql.includes("FROM courses") && sql.includes("ORDER BY id DESC")) {
            return { results: state.courses.filter(course => Number(course.active) === 1).map(course => ({ ...course, discount_price: state.hasDiscount ? course.discount_price ?? null : null })) };
          }
          if (sql.includes("SELECT *") && sql.includes("FROM courses")) return { results: state.courses.map(course => ({ ...course })) };
          return { results: [] };
        },
        async first() {
          if (sql.includes("SELECT COUNT(*) AS total FROM products")) return { total: 1 };
          if (sql.includes("SELECT id FROM courses WHERE slug = ? AND id != ?")) {
            if (state.simulateUpdateSlugRace && !state.updateSlugPrecheckSeen) {
              state.updateSlugPrecheckSeen = true;
              return null;
            }
            return state.courses.find(course =>
              course.slug === args[0] && Number(course.id) !== Number(args[1])
            ) || null;
          }
          if (sql.includes("SELECT id FROM courses WHERE slug = ?")) {
            if (state.simulateSlugRace && !state.slugPrecheckSeen) {
              state.slugPrecheckSeen = true;
              return null;
            }
            return state.courses.find(course => course.slug === args[0]) || null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INSERT INTO courses")) {
            if (state.simulateSlugRace && state.slugPrecheckSeen) {
              state.courses.push({ id: state.nextId++, title: "دوره درخواست هم‌زمان", slug: args[1], price: 500000, discount_price: null, active: 1 });
              state.simulateSlugRace = false;
              throw new Error("UNIQUE constraint failed: courses.slug");
            }
            if (sql.includes("discount_price") && !state.hasDiscount) throw new Error("no such column: discount_price");
            const row = sql.includes("discount_price")
              ? { id: state.nextId++, title: args[0], slug: args[1], description: args[2], price: args[3], discount_price: args[4], image: args[5], active: args[6], created_at: "test", updated_at: "test" }
              : { id: state.nextId++, title: args[0], slug: args[1], description: args[2], price: args[3], discount_price: null, image: args[4], active: args[5], created_at: "test", updated_at: "test" };
            state.courses.push(row);
            return { meta: { last_row_id: row.id, changes: 1 } };
          }
          if (sql.includes("UPDATE courses")) {
            if (state.simulateUpdateSlugRace && state.updateSlugPrecheckSeen) {
              state.courses.push({
                id: state.nextId++, title: "دوره درخواست هم‌زمان", slug: args[1],
                price: 500000, discount_price: null, active: 1
              });
              state.simulateUpdateSlugRace = false;
              throw new Error("UNIQUE constraint failed: courses.slug");
            }
            if (sql.includes("discount_price") && !state.hasDiscount) throw new Error("no such column: discount_price");
            const withDiscount = sql.includes("discount_price");
            const id = Number(args[withDiscount ? 7 : 6]);
            const row = state.courses.find(course => Number(course.id) === id);
            if (!row) return { meta: { changes: 0 } };
            Object.assign(row, withDiscount
              ? { title: args[0], slug: args[1], description: args[2], price: args[3], discount_price: args[4], image: args[5], active: args[6] }
              : { title: args[0], slug: args[1], description: args[2], price: args[3], image: args[4], active: args[5] });
            return { meta: { changes: 1 } };
          }
          if (sql.includes("DELETE FROM courses")) {
            const id = Number(args[0]);
            const before = state.courses.length;
            state.courses = state.courses.filter(course => Number(course.id) !== id);
            return { meta: { changes: before - state.courses.length } };
          }
          return { meta: { changes: 1 } };
        }
      };
      return statement;
    }
  };
}

function adminRequest(body) {
  return new Request(origin + "/api/store", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify(body)
  });
}
async function save(db, body) {
  return onRequestPost({ request: adminRequest(body), env: { DB: db, ADMIN_KEY: adminKey } });
}
const baseCourse = { title: "دوره آزمایشی", slug: "sample-course", description: "توضیح آزمایشی", price: 500000, image: "course.webp", active: true };

test("creates a course at its original price without a discount", async () => {
  const db = makeDb();
  const response = await save(db, { action: "admin-course-create", ...baseCourse, discountPrice: null });
  assert.equal(response.status, 200);
  assert.equal(db.state.courses[0].price, 500000);
  assert.equal(db.state.courses[0].discount_price, null);
});
test("creates a course with a valid discount", async () => {
  const db = makeDb();
  const response = await save(db, { action: "admin-course-create", ...baseCourse, discountPrice: 350000 });
  assert.equal(response.status, 200);
  assert.equal(db.state.courses[0].price, 500000);
  assert.equal(db.state.courses[0].discount_price, 350000);
});
test("rejects creating a course with a duplicate slug and preserves the existing course", async () => {
  const existing = { id: 7, ...baseCourse, title: "دوره موجود", slug: "sample-course", discount_price: null };
  const db = makeDb({ courses: [existing] });
  const response = await save(db, { action: "admin-course-create", ...baseCourse, title: "دوره جدید", discountPrice: null });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "COURSE_SLUG_TAKEN");
  assert.match(body.error, /نشانی.*ثبت شده/);
  assert.equal(db.state.courses.length, 1);
  assert.equal(db.state.courses[0].title, "دوره موجود");
  assert.equal(db.state.courses[0].slug, "sample-course");
});
test("rejects changing a course slug to another course's slug without changing either course", async () => {
  const first = { id: 7, ...baseCourse, title: "دوره اول", slug: "first-course", discount_price: null };
  const second = { id: 8, ...baseCourse, title: "دوره دوم", slug: "second-course", discount_price: null };
  const db = makeDb({ courses: [first, second] });
  const response = await save(db, { action: "admin-course-update", id: 7, ...baseCourse, title: "عنوان نباید ذخیره شود", slug: "second-course", discountPrice: null });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "COURSE_SLUG_TAKEN");
  assert.match(body.error, /نشانی.*ثبت شده/);
  assert.equal(db.state.courses.length, 2);
  assert.equal(db.state.courses[0].title, "دوره اول");
  assert.equal(db.state.courses[0].slug, "first-course");
  assert.equal(db.state.courses[1].title, "دوره دوم");
  assert.equal(db.state.courses[1].slug, "second-course");
});
test("updates the original and discounted prices together", async () => {
  const db = makeDb({ courses: [{ id: 4, ...baseCourse, discount_price: 350000 }] });
  const response = await save(db, { action: "admin-course-update", id: 4, ...baseCourse, title: "دوره ویرایش‌شده", price: 600000, discountPrice: 420000 });
  assert.equal(response.status, 200);
  assert.equal(db.state.courses[0].title, "دوره ویرایش‌شده");
  assert.equal(db.state.courses[0].price, 600000);
  assert.equal(db.state.courses[0].discount_price, 420000);
});
test("clearing the optional discount removes the previous value", async () => {
  const db = makeDb({ courses: [{ id: 4, ...baseCourse, discount_price: 350000 }] });
  const response = await save(db, { action: "admin-course-update", id: 4, ...baseCourse, discountPrice: null });
  assert.equal(response.status, 200);
  assert.equal(db.state.courses[0].discount_price, null);
});
test("public store API returns discount_price for active courses", async () => {
  const db = makeDb({ courses: [{ id: 4, ...baseCourse, discount_price: 350000 }] });
  const response = await onRequestGet({ env: { DB: db } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.courses[0].discount_price, 350000);
});
test("invalid, negative, equal-to-list, greater-than-list and fractional discounts are rejected", async () => {
  for (const discountPrice of [-1, 0, 500000, 500001, 350000.5]) {
    const db = makeDb();
    const response = await save(db, { action: "admin-course-create", ...baseCourse, discountPrice });
    assert.equal(response.status, 400, "discount " + discountPrice);
    assert.equal(db.state.courses.length, 0, "discount " + discountPrice);
  }
});
test("invalid original price is rejected even when no discount is supplied", async () => {
  for (const price of [-1, 0, 999, 1000.5, Number.MAX_SAFE_INTEGER + 1]) {
    const db = makeDb();
    const response = await save(db, { action: "admin-course-create", ...baseCourse, price, discountPrice: null });
    assert.equal(response.status, 400, "price " + price);
    assert.equal(db.state.courses.length, 0, "price " + price);
  }
});
test("legacy schema without discount_price stays readable and rejects discounted writes without partial saves", async () => {
  const db = makeDb({ hasDiscount: false });
  const response = await save(db, { action: "admin-course-create", ...baseCourse, discountPrice: 350000 });
  assert.equal(response.status, 503);
  assert.equal(db.state.courses.length, 0);
  const publicResponse = await onRequestGet({ env: { DB: db } });
  assert.equal(publicResponse.status, 200);
  const body = await publicResponse.json();
  assert.equal(body.courses.length, 0);
});
test("legacy schema can still save a course without a discount", async () => {
  const db = makeDb({ hasDiscount: false });
  const response = await save(db, { action: "admin-course-create", ...baseCourse, discountPrice: null });
  assert.equal(response.status, 200);
  assert.equal(db.state.courses[0].discount_price, null);
});

test("maps a database unique-slug race to a conflict without overwriting the concurrent course", async () => {
  const db = makeDb({ simulateSlugRace: true });
  const response = await save(db, { action: "admin-course-create", ...baseCourse, discountPrice: null });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "COURSE_SLUG_TAKEN");
  assert.equal(db.state.courses.length, 1);
  assert.equal(db.state.courses[0].title, "دوره درخواست هم‌زمان");
  assert.equal(db.state.courses[0].slug, "sample-course");
});

test("accepts a positive discount below the original price even when below 1000", async () => {
  const db = makeDb();
  const response = await save(db, { action: "admin-course-create", ...baseCourse, price: 1500, discountPrice: 1 });
  assert.equal(response.status, 200);
  assert.equal(db.state.courses[0].discount_price, 1);
});

test("rejects an invalid original price during edit and preserves the stored course", async () => {
  const existing = { id: 4, ...baseCourse, price: 500000, discount_price: 350000 };
  const db = makeDb({ courses: [existing] });
  const response = await save(db, {
    action: "admin-course-update", id: 4, ...baseCourse,
    title: "عنوان نباید ذخیره شود", price: 0, discountPrice: null
  });
  assert.equal(response.status, 400);
  assert.equal(db.state.courses.length, 1);
  assert.equal(db.state.courses[0].title, baseCourse.title);
  assert.equal(db.state.courses[0].price, 500000);
  assert.equal(db.state.courses[0].discount_price, 350000);
});

test("rejects discounted edit on legacy schema without partially updating the course", async () => {
  const existing = { id: 4, ...baseCourse, price: 500000, discount_price: null };
  const db = makeDb({ hasDiscount: false, courses: [existing] });
  const response = await save(db, {
    action: "admin-course-update", id: 4, ...baseCourse,
    title: "عنوان نباید ذخیره شود", price: 600000, discountPrice: 300000
  });
  assert.equal(response.status, 503);
  assert.equal(db.state.courses.length, 1);
  assert.equal(db.state.courses[0].title, baseCourse.title);
  assert.equal(db.state.courses[0].price, 500000);
});

test("admin course list includes discount_price when the column exists", async () => {
  const db = makeDb({ courses: [{ id: 4, ...baseCourse, discount_price: 350000 }] });
  const response = await save(db, { action: "admin-courses-list" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.courses[0].discount_price, 350000);
});

test("maps a database unique-slug race during update to a conflict and preserves both courses", async () => {
  const first = { id: 7, ...baseCourse, title: "دوره اول", slug: "first-course", discount_price: null };
  const db = makeDb({ courses: [first], simulateUpdateSlugRace: true });
  const response = await save(db, {
    action: "admin-course-update", id: 7, ...baseCourse,
    title: "عنوان نباید ذخیره شود", slug: "concurrent-course", discountPrice: null
  });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "COURSE_SLUG_TAKEN");
  assert.equal(db.state.courses.length, 2);
  assert.equal(db.state.courses[0].title, "دوره اول");
  assert.equal(db.state.courses[0].slug, "first-course");
  assert.equal(db.state.courses[1].title, "دوره درخواست هم‌زمان");
  assert.equal(db.state.courses[1].slug, "concurrent-course");
});

test("deleting a course remains supported", async () => {
  const db = makeDb({ courses: [{ id: 4, ...baseCourse, discount_price: 350000 }] });
  const response = await save(db, { action: "admin-course-delete", id: 4 });
  assert.equal(response.status, 200);
  assert.equal(db.state.courses.length, 0);
});

test("whitespace-only discount is treated as no discount", async () => {
  const db = makeDb();
  const response = await save(db, { action: "admin-course-create", ...baseCourse, discountPrice: "   " });
  assert.equal(response.status, 200);
  assert.equal(db.state.courses[0].discount_price, null);
});
