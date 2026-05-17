import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const issuesDir = path.join(root, "issues");
const reportsDir = path.join(root, "reports");

await fs.mkdir(reportsDir, { recursive: true });

const files = (await fs.readdir(issuesDir))
  .filter((name) => /^\d{3}-.+\.md$/.test(name))
  .sort();

const issues = [];

for (const file of files) {
  const body = await fs.readFile(path.join(issuesDir, file), "utf8");
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.replace(/^\d{3}-/, "").replace(/\.md$/, "");
  issues.push({
    source_file: `issues/${file}`,
    title,
    labels: ["metadata-pipeline"],
    body,
  });
}

await fs.writeFile(path.join(reportsDir, "github-issues.json"), JSON.stringify(issues, null, 2), "utf8");

const md = [
  "# GitHub Issue Export",
  "",
  "Use `reports/github-issues.json` with the GitHub API or the included issue creation script.",
  "",
  ...issues.map((issue, index) => `## ${index + 1}. ${issue.title}\n\nSource: \`${issue.source_file}\`\n`),
];

await fs.writeFile(path.join(reportsDir, "github-issues.md"), md.join("\n"), "utf8");
console.log(`Exported ${issues.length} issues.`);
