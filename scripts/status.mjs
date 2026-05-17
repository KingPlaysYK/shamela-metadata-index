import fs from "node:fs/promises";
import path from "node:path";

async function sizeOf(dir) {
  let total = 0;
  let count = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const child = await sizeOf(full);
        total += child.total;
        count += child.count;
      } else if (entry.isFile()) {
        const stat = await fs.stat(full);
        total += stat.size;
        count += 1;
      }
    }
  } catch {
    return { total, count };
  }
  return { total, count };
}

const root = process.cwd();
const data = await sizeOf(path.join(root, "data"));
const issues = (await fs.readdir(path.join(root, "issues"))).filter((name) => /^\d{3}-.+\.md$/.test(name));

console.log(JSON.stringify({
  root,
  issueFiles: issues.length,
  dataFiles: data.count,
  dataBytes: data.total,
  dataGiB: Number((data.total / 1024 / 1024 / 1024).toFixed(2)),
}, null, 2));
