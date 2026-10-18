import { describe, expect, it } from "vitest";
import {
  getCheckoutAddressErrors,
  getCitiesForProvince,
  getDistrictsForCity,
  isCheckoutAddressValid,
} from "./checkout";

const completeAddress = {
  recipient: "张三",
  phone: "13800000000",
  province: "广东省",
  city: "广州市",
  district: "天河区",
  detail: "体育西路 88 号",
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

  it("rejects a city that does not belong to the selected province", () => {
    const address = { ...completeAddress, city: "杭州市", district: "西湖区" };
    expect(isCheckoutAddressValid(address)).toBe(false);
    expect(getCheckoutAddressErrors(address).city).toContain("不匹配");
  });

  it("rejects a district that does not belong to the selected city", () => {
    const address = { ...completeAddress, district: "南山区" };
    expect(isCheckoutAddressValid(address)).toBe(false);
    expect(getCheckoutAddressErrors(address).district).toContain("不匹配");
  });

  it("provides cascading city and district choices", () => {
    expect(getCitiesForProvince("广东省")).toContain("广州市");
    expect(getCitiesForProvince("浙江省")).toContain("杭州市");
    expect(getCitiesForProvince("广东省")).not.toContain("杭州市");
    expect(getDistrictsForCity("广东省", "深圳市")).toContain("南山区");
    expect(getDistrictsForCity("广东省", "广州市")).not.toContain("南山区");
  });
});
