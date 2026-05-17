const repoName = process.argv.find((arg) => arg.startsWith("--name="))?.slice("--name=".length) || "shamela-metadata-index";
const description =
  process.argv.find((arg) => arg.startsWith("--description="))?.slice("--description=".length) ||
  "Local-first Shamela metadata and indexing pipeline";
const visibility = process.argv.includes("--public") ? "public" : "private";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!token) {
  console.error("Set GITHUB_TOKEN or GH_TOKEN before running this script.");
  process.exit(1);
}

const response = await fetch("https://api.github.com/user/repos", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "shamela-metadata-index-repo-creator",
  },
  body: JSON.stringify({
    name: repoName,
    description,
    private: visibility !== "public",
    has_issues: true,
    auto_init: false,
  }),
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Failed creating repository: ${response.status} ${text}`);
}

const repo = await response.json();
console.log(repo.full_name);
console.log(repo.clone_url);
