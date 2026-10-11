import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("public HTML escaping neutralizes markup and attribute injection", () => {
  const context = {
    localStorage: { getItem: () => null },
    document: { addEventListener() {}, getElementById: () => null },
    console,
    URLSearchParams,
    location: { search: "" }
  };

  vm.runInNewContext(
    app + "\nglobalThis.__escapeHtmlForTest = escapeHtml;",
    context
  );

  assert.equal(
    context.__escapeHtmlForTest("<img src=x onerror='alert(1)'>&\""),
    "&lt;img src=x onerror=&#39;alert(1)&#39;&gt;&amp;&quot;"
  );
});

test("dynamic public store fields are escaped before HTML interpolation", () => {
  assert.ok(app.includes('escapeHtml(String(category.name || ""))'));
  assert.ok(app.includes('escapeHtml(img(category.image || ""))'));
  assert.ok(app.includes('escapeHtml(img(product.img))'));
  assert.ok(app.includes('escapeHtml(displayProductName(product.name))'));
  assert.ok(app.includes('escapeHtml(product.cat || "")'));
  assert.ok(app.includes('escapeHtml(product.desc || "")'));
  assert.ok(app.includes('escapeHtml(JSON.stringify(String(product.id || "")))'));
  assert.ok(app.includes('escapeHtml(course.title || "")'));
  assert.ok(app.includes('escapeHtml(course.description || "")'));
  assert.ok(app.includes('escapeHtml(item.src)'));
  assert.ok(app.includes('const title = escapeHtml(item.title);'));
});
