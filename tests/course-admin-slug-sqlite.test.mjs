import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { onRequestGet, onRequestPost } from "../functions/api/store.js";

const origin = "https://hilafood.test";
const adminKey = "test-admin-key";

function makeSqliteDb({ legacyCourses = false } = {}) {
  const native = new DatabaseSync(":memory:");
  if (legacyCourses) {
    native.exec(`
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        price INTEGER DEFAULT 0,
        image TEXT DEFAULT '',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return {
    native,
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async all() {
          return { results: native.prepare(sql).all(...args) };
        },
        async first() {
          return native.prepare(sql).get(...args) ?? null;
        },
        async run() {
          const result = native.prepare(sql).run(...args);
          return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
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

const baseCourse = {
  title: "دوره SQLite",
  slug: "sqlite-course",
  description: "آزمون محلی",
  price: 500000,
  image: "sqlite-course.webp",
  active: true,
  discountPrice: null
};

test("real in-memory SQLite rejects duplicate course slugs on create and update without mutating other rows", async t => {
  const db = makeSqliteDb();
  t.after(() => db.native.close());

  const first = await save(db, { action: "admin-course-create", ...baseCourse });
  assert.equal(first.status, 200);

  const duplicateCreate = await save(db, {
    action: "admin-course-create",
    ...baseCourse,
    title: "دوره تکراری"
  });
  assert.equal(duplicateCreate.status, 409);
  assert.match((await duplicateCreate.json()).error, /نشانی.*قبلاً/);

  const second = await save(db, {
    action: "admin-course-create",
    ...baseCourse,
    title: "دوره دوم",
    slug: "sqlite-course-2"
  });
  assert.equal(second.status, 200);

  const rowsBefore = db.native.prepare("SELECT id, title, slug FROM courses ORDER BY id").all();
  const updateConflict = await save(db, {
    action: "admin-course-update",
    id: rowsBefore[0].id,
    ...baseCourse,
    title: "این تغییر نباید ذخیره شود",
    slug: "sqlite-course-2"
  });
  assert.equal(updateConflict.status, 409);
  assert.match((await updateConflict.json()).error, /نشانی.*قبلاً/);
  assert.deepEqual(db.native.prepare("SELECT id, title, slug FROM courses ORDER BY id").all(), rowsBefore);

  const updateOwnSlug = await save(db, {
    action: "admin-course-update",
    id: rowsBefore[0].id,
    ...baseCourse,
    title: "ویرایش مجاز"
  });
  assert.equal(updateOwnSlug.status, 200);
  assert.equal(db.native.prepare("SELECT title FROM courses WHERE id = ?").get(rowsBefore[0].id).title, "ویرایش مجاز");
});

test("real in-memory SQLite legacy schema remains readable and rejects discounted writes without partial rows", async t => {
  const db = makeSqliteDb({ legacyCourses: true });
  t.after(() => db.native.close());

  const initial = await save(db, { action: "admin-course-create", ...baseCourse });
  assert.equal(initial.status, 200);

  const discounted = await save(db, {
    action: "admin-course-create",
    ...baseCourse,
    title: "تخفیف روی ساختار قدیمی",
    slug: "legacy-discount-course",
    discountPrice: 300000
  });
  assert.equal(discounted.status, 503);
  assert.equal(db.native.prepare("SELECT COUNT(*) AS count FROM courses").get().count, 1);

  const publicResponse = await onRequestGet({ env: { DB: db } });
  assert.equal(publicResponse.status, 200);
  const publicBody = await publicResponse.json();
  assert.equal(publicBody.courses.length, 1);
  assert.equal(publicBody.courses[0].discount_price, null);
});
