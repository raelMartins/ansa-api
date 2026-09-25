const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  const s = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s.length >= 2 ? s : "item";
}

export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value) && value.length >= 2 && value.length <= 80;
}

export function withSuffix(base: string, suffix: string): string {
  const clipped = base.slice(0, Math.max(2, 80 - suffix.length - 1));
  return `${clipped}-${suffix}`;
}
