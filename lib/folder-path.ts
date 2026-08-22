export function parseRelativePath(relativePath: string): {
  companyHint: string | null;
  branchHint: string | null;
  folderPath: string;
} {
  const parts = relativePath
    .split(/[/\\]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const dirs = parts.slice(0, -1);
  const folderPath = dirs.join("/");

  if (dirs.length >= 2) {
    return { companyHint: cleanName(dirs[0]), branchHint: cleanName(dirs[1]), folderPath };
  }
  if (dirs.length === 1) {
    return { companyHint: null, branchHint: cleanName(dirs[0]), folderPath };
  }
  return { companyHint: null, branchHint: null, folderPath };
}

function cleanName(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isJunkFile(name: string) {
  const base = name.split(/[/\\]/).pop() ?? name;
  const lower = base.toLowerCase();
  if (!base || base.startsWith(".")) return true;
  return ["ds_store", "thumbs.db", "desktop.ini"].includes(lower);
}
