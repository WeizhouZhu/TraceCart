import type { CheckoutDraft } from "../types";

export function isCheckoutAddressValid(address: CheckoutDraft["address"]) {
  return (
    address.recipient.trim().length >= 2 &&
    /^1\d{10}$/.test(address.phone.trim()) &&
    Boolean(address.province) &&
    Boolean(address.city) &&
    Boolean(address.district) &&
    address.detail.trim().length >= 5
  );
}
