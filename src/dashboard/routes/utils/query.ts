// Create a toggle URL that preserves existing query params (e.g. page)
export function buildRefreshToggleHref(
  requestUrl: string,
  refreshOn: boolean
): string {
  try {
    const current = new URL(requestUrl);
    const params = new URLSearchParams(current.searchParams);
    if (refreshOn) {
      params.set("refresh", "off");
    } else {
      params.delete("refresh");
    }
    const query = params.toString();
    return query ? `${current.pathname}?${query}` : current.pathname;
  } catch {
    return refreshOn ? "?refresh=off" : "";
  }
}
