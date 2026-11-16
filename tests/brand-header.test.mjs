import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("both app headers share the LTR Gamma brand and retain notification and switch controls", async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
  try {
    for (const name of ["AppHeader", "AccessAppHeader"]) {
      const { default: Header } = await vite.ssrLoadModule(`/src/components/${name}.jsx`);
      const html = renderToStaticMarkup(createElement(Header, {
        product: "NEGAHBAN", vehicle: { deviceCode: "NG-0001" }, availableProducts: ["RAHBAN", "NEGAHBAN"],
      }));
      assert.equal((html.match(/class="platform-title gamma-brand" dir="ltr"/g) || []).length, 1);
      assert.match(html, /gamma-brand-logo.*<svg/);
      assert.match(html, /gamma-brand-wordmark">GAMMA<\/strong>/);
      assert.match(html, /gamma-brand-subtitle">VEHICLE PLATFORM<\/span>/);
      assert.match(html, /aria-label="اعلان‌ها"/);
      assert.match(html, /aria-label="انتخاب محصول"/);
    }
  } finally { await vite.close(); }
});
