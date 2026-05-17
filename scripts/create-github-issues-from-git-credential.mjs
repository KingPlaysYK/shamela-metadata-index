import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

const issueExportPath = "reports/github-issues.json";

function parseArgs() {
  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    args.set(key, value || "true");
  }
  return args;
}

function getRepoFromRemote() {
  const remote = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" });
  if (remote.status !== 0) return null;
  const url = remote.stdout.trim();
  const match = url.match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/i);
  return match?.[1] || null;
}

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const credential = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    timeout: 15000
  });
  if (credential.status !== 0) return null;
  const password = credential.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith("password="))
    ?.slice("password=".length);
  return password || null;
}

async function github(path, token, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "shamela-metadata-index-issue-loader",
      ...(options.headers || {})
    }
  });
  clearTimeout(timeout);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
  }
  return response.status === 204 ? null : response.json();
}

async function listExistingIssueTitles(repo, token) {
  const titles = new Set();
  for (let page = 1; page <= 10; page += 1) {
    const issues = await github(`/repos/${repo}/issues?state=all&per_page=100&page=${page}`, token);
    if (!issues.length) break;
    for (const issue of issues) {
      if (!issue.pull_request) titles.add(issue.title);
    }
  }
  return titles;
}

const args = parseArgs();
const repo = args.get("repo") || getRepoFromRemote();
if (!repo) {
  console.error("Could not infer GitHub repository. Pass --repo=owner/name.");
  process.exit(1);
}

const token = getToken();
if (!token) {
  console.error("No GitHub token found in GITHUB_TOKEN or git credential manager.");
  process.exit(1);
}

const issues = JSON.parse(await fs.readFile(issueExportPath, "utf8"));
const existingTitles = await listExistingIssueTitles(repo, token);
let created = 0;
let skipped = 0;

for (const issue of issues) {
  if (existingTitles.has(issue.title)) {
    skipped += 1;
    continue;
  }

  await github(`/repos/${repo}/issues`, token, {
    method: "POST",
    body: JSON.stringify({
      title: issue.title,
      body: issue.body
    })
  });
  existingTitles.add(issue.title);
  created += 1;
  console.log(`Created: ${issue.title}`);
}

console.log(`Done. Created ${created}; skipped ${skipped}; repository ${repo}.`);
