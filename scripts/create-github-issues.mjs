import fs from "node:fs/promises";
import path from "node:path";

const repo = process.argv.find((arg) => arg.startsWith("--repo="))?.slice("--repo=".length);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const root = process.cwd();
const issuesDir = path.join(root, "issues");

if (!repo) {
  console.error("Usage: node scripts/create-github-issues.mjs --repo=OWNER/REPO");
  process.exit(1);
}

if (!token) {
  console.error("Set GITHUB_TOKEN or GH_TOKEN before running this script.");
  process.exit(1);
}

const files = (await fs.readdir(issuesDir))
  .filter((name) => /^\d{3}-.+\.md$/.test(name))
  .sort();

for (const file of files) {
  const fullPath = path.join(issuesDir, file);
  const body = await fs.readFile(fullPath, "utf8");
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.replace(/^\d{3}-/, "").replace(/\.md$/, "");

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "shamela-metadata-index-issue-loader",
    },
    body: JSON.stringify({
      title,
      body,
      labels: ["metadata-pipeline"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed creating issue for ${file}: ${response.status} ${text}`);
  }

  const issue = await response.json();
  console.log(`#${issue.number} ${issue.title}`);
}
