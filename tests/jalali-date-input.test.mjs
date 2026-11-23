import test from "node:test";
import assert from "node:assert/strict";
import { isoToJalali, jalaliToIso, normalizeJalaliInput } from "../src/utils/jalali.mjs";

test("registration and profile accept both slash and dot Jalali birth dates", () => {
  for (const value of ["1379/01/01", "1379.01.01", "۱۳۷۹/۰۱/۰۱", "۱۳۷۹.۰۱.۰۱", "١٣٧٩.٠١.٠١"]) {
    assert.equal(jalaliToIso(value), "2000-03-20", value);
  }
  assert.equal(jalaliToIso("1379/01.01"), "2000-03-20");
  assert.equal(isoToJalali("2000-03-20"), "1379/01/01");
});

test("birth-date typing preserves separators and normalizes Persian/Arabic digits", () => {
  assert.equal(normalizeJalaliInput("۱۳۷۹.۰۱.۰۱"), "1379.01.01");
  assert.equal(normalizeJalaliInput("۱۳۷۹/۰۱/۰۱"), "1379/01/01");
  assert.equal(normalizeJalaliInput("١٣٧٩.٠١.٠١text"), "1379.01.01");
  assert.equal(normalizeJalaliInput("1379-01-01"), "13790101");
});

test("invalid or future dates remain invalid", () => {
  for (const value of ["1379-01-01", "1379/13/01", "1398.12.30", "1500/01/01", "1379/1/1", ""]) {
    assert.equal(jalaliToIso(value), "", value);
  }
});
