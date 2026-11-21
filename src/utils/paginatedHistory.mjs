/** Follow advertised DRF next links; array responses have no further pages. */
export async function paginatedHistory(path, request, apiBase) {
  const base = new URL(apiBase || '/', 'http://localhost');
  const endpoint = new URL(path, base);
  const visited = new Set();
  const records = [];
  let next = endpoint;
  while (next) {
    // Never send authentication to another endpoint or origin supplied in a link.
    if (next.origin !== endpoint.origin || next.pathname !== endpoint.pathname || visited.has(next.href)) {
      throw new Error('پیوند صفحه‌بندی تاریخچه معتبر نیست.');
    }
    visited.add(next.href);
    const payload = await request(`${next.pathname}${next.search}`);
    const page = Array.isArray(payload) ? payload : payload?.results ?? payload?.data;
    if (!Array.isArray(page)) throw new Error('پاسخ تاریخچه معتبر نیست.');
    records.push(...page);
    next = !Array.isArray(payload) && payload.next ? new URL(payload.next, next) : null;
  }
  return records;
}
