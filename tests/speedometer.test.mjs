import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("speedometer distinguishes zero, missing and stale data and bounds its needle", async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
  try {
    const { default: Speedometer } = await vite.ssrLoadModule("/src/components/Speedometer.jsx");
    const render = (value, fresh = false) => renderToStaticMarkup(createElement(Speedometer, { value, fresh }));
    assert.match(render("0", true), /<strong>0<\/strong>/);
    assert.match(render("0", true), /داده تازه/);
    assert.match(render("0.72228"), /<strong>1<\/strong>/);
    assert.match(render("84.6"), /<strong>85<\/strong>/);
    assert.match(render("84.6"), /داده قدیمی/);
    assert.match(render(0), /rotate\(-120deg\)/);
    assert.match(render(120), /rotate\(0deg\)/);
    assert.match(render(250), /rotate\(120deg\)/);
    assert.match(render(250), /<strong>250<\/strong>/);
    for (const missing of [null, undefined, "", "  ", "—", "invalid", -1, Infinity, NaN]) {
      const html = render(missing, true);
      assert.match(html, /<strong>—<\/strong>/);
      assert.match(html, /سرعت دریافت نشده/);
      assert.doesNotMatch(html, /class="speed-needle"|is-fresh|NaN|Infinity/);
    }
  } finally {
    await vite.close();
  }
});
