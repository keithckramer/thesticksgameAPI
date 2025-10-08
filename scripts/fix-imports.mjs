import { promises as fs } from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const SRC_DIR = path.join(projectRoot, "src");

const IGNORES = new Set(["node_modules", ".git", "dist", "build"]);

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORES.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      yield fullPath;
    }
  }
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const PRESERVE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".json", ".node"]);

async function resolveImport(spec, fileDir) {
  const ext = path.extname(spec);
  if (ext && PRESERVE_EXTENSIONS.has(ext)) {
    return spec;
  }

  const trimmed = spec.replace(/\/$/, "");
  const fileCandidate = path.resolve(fileDir, `${trimmed}.js`);
  if (await pathExists(fileCandidate)) {
    return `${trimmed}.js`;
  }

  const indexCandidate = path.resolve(fileDir, trimmed, "index.js");
  if (await pathExists(indexCandidate)) {
    return `${trimmed}/index.js`;
  }

  return spec;
}

async function fixFile(filePath) {
  let source = await fs.readFile(filePath, "utf8");
  const dir = path.dirname(filePath);
  const replacements = [];

  const patterns = [
    { regex: /(import|export)[\s\S]*?from\s+(['"])(\.{1,2}\/[^'"\n;]*)(\2)/g, specGroup: 3 },
    { regex: /import\s+(['"])(\.{1,2}\/[^'"\n;]*)(\1)/g, specGroup: 2 },
    { regex: /import\s*\(\s*(['"])(\.{1,2}\/[^'"]*)(\1)/g, specGroup: 2 },
  ];

  for (const { regex, specGroup } of patterns) {
    const matches = Array.from(source.matchAll(regex));
    for (const match of matches) {
      const spec = match[specGroup];
      const resolved = await resolveImport(spec, dir);
      if (resolved !== spec) {
        const relativeIndex = match[0].indexOf(spec);
        if (relativeIndex === -1) continue;
        const start = match.index + relativeIndex;
        const end = start + spec.length;
        replacements.push({ start, end, value: resolved });
      }
    }
  }

  if (replacements.length === 0) return;

  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, value } of replacements) {
    source = `${source.slice(0, start)}${value}${source.slice(end)}`;
  }

  await fs.writeFile(filePath, source, "utf8");
  console.log("Fixed:", path.relative(projectRoot, filePath));
}

(async () => {
  for await (const filePath of walk(SRC_DIR)) {
    await fixFile(filePath);
  }
  console.log("Import fix complete.");
})();
