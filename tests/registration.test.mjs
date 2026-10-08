import assert from "node:assert/strict";
import test from "node:test";
import { asciiDigits, normalizeDeviceCode } from "../src/utils/deviceCode.js";
import { fromGregorianIso, toGregorianIso } from "../src/utils/jalaliDate.js";

test("public device codes retain leading zeros and normalize Persian and Arabic digits", () => {
  assert.equal(asciiDigits("۰١۲٣"), "0123");
  assert.equal(normalizeDeviceCode("NG_۰۰۰۱"), "NG-0001");
  assert.equal(normalizeDeviceCode(" ng-0001 "), "NG-0001");
  assert.equal(normalizeDeviceCode("RH-٠٠١٢"), "RH-0012");
  assert.equal(normalizeDeviceCode("LM-0001"), "LM-0001");
  assert.equal(normalizeDeviceCode("NG-XXXX"), "");
  assert.equal(normalizeDeviceCode("NG-04-0001"), "");
});

test("Jalali dates round trip through Gregorian ISO without shifting the day", () => {
  for (const [jalali, gregorian] of [
    [[1403, 1, 1], "2024-03-20"],
    [[1404, 1, 1], "2025-03-21"],
    [[1399, 12, 30], "2021-03-20"],
  ]) {
    assert.equal(toGregorianIso(...jalali), gregorian);
    assert.deepEqual(fromGregorianIso(gregorian), { year: jalali[0], month: jalali[1], day: jalali[2] });
  }
  assert.equal(toGregorianIso(1402, 12, 30), "");
});
