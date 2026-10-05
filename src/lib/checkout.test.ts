import { describe, expect, it } from "vitest";
import { isCheckoutAddressValid } from "./checkout";

const completeAddress = {
  recipient: "张三",
  phone: "13800000000",
  province: "广东省",
  city: "广州市",
  district: "天河区",
  detail: "体育西路 88 号",
  postalCode: "510000",
};

describe("isCheckoutAddressValid", () => {
  it("accepts a complete Chinese delivery address", () => {
    expect(isCheckoutAddressValid(completeAddress)).toBe(true);
  });

  it("rejects an invalid phone number", () => {
    expect(isCheckoutAddressValid({ ...completeAddress, phone: "1380000000" })).toBe(false);
  });

  it("rejects missing required address fields", () => {
    expect(isCheckoutAddressValid({ ...completeAddress, district: "" })).toBe(false);
    expect(isCheckoutAddressValid({ ...completeAddress, detail: "短" })).toBe(false);
  });
});
