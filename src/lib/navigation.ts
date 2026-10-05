export type CatalogTab =
  | { type: "home" }
  | { type: "category"; value: string }
  | { type: "sort"; value: string };

export function isCatalogTabActive(pathname: string, search: string, tab: CatalogTab) {
  if (tab.type === "home") return pathname === "/";
  if (pathname !== "/search") return false;

  const params = new URLSearchParams(search);
  if (tab.type === "category") {
    return params.get("category") === tab.value;
  }
  return !params.has("category") && params.get("sort") === tab.value;
}
