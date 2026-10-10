import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { onRequestPost } from "../functions/api/store.js";

const origin = "https://hilafood.test";
const adminKey = "sqlite-test-admin-key";

function sqliteD1(database) {
  return {
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...args) {
          values = args;
          return statement;
        },
        async run() {
          const result = database.prepare(sql).run(...values);
          return {
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid || 0)
            }
          };
        },
        async all() {
          return { results: database.prepare(sql).all(...values) };
        },
        async first() {
          return database.prepare(sql).get(...values) || null;
        }
      };
      return statement;
    }
  };
}

function makeEnv() {
  const database = new DatabaseSync(":memory:");
  return {
    database,
    env: { DB: sqliteD1(database), ADMIN_KEY: adminKey }
  };
}

function request(body) {
  return new Request(origin + "/api/store", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "x-admin-key": adminKey
    },
    body: JSON.stringify(body)
  });
}

async function save(env, body) {
  return onRequestPost({ request: request(body), env });
}

const course = {
  title: "SQLite test course",
  description: "Isolated SQLite integration fixture",
  price: 500000,
  discountPrice: 350000,
  image: "test-course.webp",
  active: true
};

test("real SQLite: duplicate slug on create returns 409 and preserves existing row", async () => {
  const { database, env } = makeEnv();
  try {
    const first = await save(env, { action: "admin-course-create", ...course, slug: "sqlite-duplicate" });
    assert.equal(first.status, 200);

    const second = await save(env, { action: "admin-course-create", ...course, title: "Second course", slug: "sqlite-duplicate" });
    const body = await second.json();
    assert.equal(second.status, 409);
    assert.match(body.error, /نشانی/);

    const rows = database.prepare("SELECT id, title, slug FROM courses ORDER BY id").all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "SQLite test course");
    assert.equal(rows[0].slug, "sqlite-duplicate");
  } finally {
    database.close();
  }
});

test("real SQLite: duplicate slug on update returns 409 and changes neither course", async () => {
  const { database, env } = makeEnv();
  try {
    const first = await save(env, { action: "admin-course-create", ...course, title: "First course", slug: "sqlite-first" });
    const firstBody = await first.json();
    const second = await save(env, { action: "admin-course-create", ...course, title: "Second course", slug: "sqlite-second" });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);

    const response = await save(env, {
      action: "admin-course-update",
      id: firstBody.id,
      ...course,
      title: "This must not be saved",
      slug: "sqlite-second",
      price: 700000,
      discountPrice: 450000
    });
    const body = await response.json();
    assert.equal(response.status, 409);
    assert.match(body.error, /نشانی/);

    const rows = database.prepare("SELECT id, title, slug, price, discount_price FROM courses ORDER BY id").all();
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(row => ({ title: row.title, slug: row.slug, price: row.price, discount_price: row.discount_price })), [
      { title: "First course", slug: "sqlite-first", price: 500000, discount_price: 350000 },
      { title: "Second course", slug: "sqlite-second", price: 500000, discount_price: 350000 }
    ]);
  } finally {
    database.close();
  }
});

test("real SQLite: updating a course while keeping its own slug succeeds", async () => {
  const { database, env } = makeEnv();
  try {
    const created = await save(env, { action: "admin-course-create", ...course, slug: "sqlite-stable-slug" });
    const createdBody = await created.json();
    assert.equal(created.status, 200);

    const updated = await save(env, {
      action: "admin-course-update",
      id: createdBody.id,
      ...course,
      title: "Updated title",
      slug: "sqlite-stable-slug"
    });
    assert.equal(updated.status, 200);
    const row = database.prepare("SELECT title, slug FROM courses WHERE id = ?").get(createdBody.id);
    assert.equal(row.title, "Updated title");
    assert.equal(row.slug, "sqlite-stable-slug");
  } finally {
    database.close();
  }
});
