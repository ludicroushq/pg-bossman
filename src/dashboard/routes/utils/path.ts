const TRAILING_SLASH_RE = /\/+$/;

export function withBasePath(basePath: string | undefined, path: string) {
  const base = (basePath || "").replace(TRAILING_SLASH_RE, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const fullPath = `${base}${suffix}` || suffix;
  // Remove trailing slash unless it's the root path "/"
  return fullPath === "/" ? fullPath : fullPath.replace(TRAILING_SLASH_RE, "");
}
