import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataRoot = path.join(root, "data", "existing-app-rag-data");
const reportsDir = path.join(root, "reports");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listFiles(full));
      } else if (entry.isFile()) {
        const stat = await fs.stat(full);
        files.push({
          path: path.relative(root, full).replaceAll("\\", "/"),
          bytes: stat.size,
        });
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function readJsonIfSmall(file) {
  if (!file.path.endsWith(".json") || file.bytes > 5_000_000) return null;
  try {
    const text = await fs.readFile(path.join(root, file.path), "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function groupByTopFolder(files) {
  const grouped = {};
  for (const file of files) {
    const parts = file.path.split("/");
    const key = parts.slice(0, 3).join("/");
    grouped[key] ??= { files: 0, bytes: 0 };
    grouped[key].files += 1;
    grouped[key].bytes += file.bytes;
  }
  return grouped;
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes} B`;
}

await ensureDir(reportsDir);
const files = await listFiles(dataRoot);
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const summaries = [];

for (const file of files) {
  if (!file.path.endsWith(".summary.json") && !file.path.endsWith(".manifest.json")) continue;
  const json = await readJsonIfSmall(file);
  if (json) summaries.push({ file: file.path, bytes: file.bytes, json });
}

const inventory = {
  generated_at: new Date().toISOString(),
  data_root: path.relative(root, dataRoot).replaceAll("\\", "/"),
  file_count: files.length,
  total_bytes: totalBytes,
  total_gib: Number((totalBytes / 1024 ** 3).toFixed(2)),
  grouped: groupByTopFolder(files),
  summaries,
};

await fs.writeFile(path.join(reportsDir, "existing-data-inventory.json"), JSON.stringify(inventory, null, 2), "utf8");

const lines = [
  "# Existing Data Inventory",
  "",
  `Generated: ${inventory.generated_at}`,
  "",
  `Files: ${inventory.file_count}`,
  "",
  `Size: ${formatBytes(totalBytes)}`,
  "",
  "## Groups",
  "",
  "| Group | Files | Size |",
  "|---|---:|---:|",
  ...Object.entries(inventory.grouped).map(([key, value]) => `| ${key} | ${value.files} | ${formatBytes(value.bytes)} |`),
  "",
  "## Summary Files",
  "",
  ...summaries.map((item) => `- ${item.file}`),
  "",
];

await fs.writeFile(path.join(reportsDir, "existing-data-inventory.md"), lines.join("\n"), "utf8");
console.log(`Wrote ${path.join(reportsDir, "existing-data-inventory.json")}`);
console.log(`Wrote ${path.join(reportsDir, "existing-data-inventory.md")}`);
