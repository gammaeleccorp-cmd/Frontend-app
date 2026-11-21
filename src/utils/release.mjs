export const RELEASE_QUERY = "__gamma_release";

export async function readRelease(fetcher = fetch) {
  const response = await fetcher("/release.json", {
    cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Release unavailable");
  const value = await response.json();
  if (value.component !== "frontend" || !/^[a-f0-9]{40}$/.test(value.source_commit)) {
    throw new Error("Invalid release metadata");
  }
  return value.source_commit;
}

export function releaseUrl(href, release) {
  const url = new URL(href);
  url.searchParams.set(RELEASE_QUERY, release);
  return url.href;
}
