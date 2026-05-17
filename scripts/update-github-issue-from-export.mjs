import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

function parseArgs() {
  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    args.set(key, rest.join("=") || "true");
  }
  return args;
}

function getRepoFromRemote() {
  const remote = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", timeout: 15000 });
  if (remote.status !== 0) return null;
  const match = remote.stdout.trim().match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/i);
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
  return credential.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith("password="))
    ?.slice("password=".length) || null;
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

async function listIssues(repo, token) {
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const issues = await github(`/repos/${repo}/issues?state=all&per_page=100&page=${page}`, token);
    if (!issues.length) break;
    all.push(...issues.filter((issue) => !issue.pull_request));
  }
  return all;
}

const args = parseArgs();
const repo = args.get("repo") || getRepoFromRemote();
const sourceFile = args.get("source");
const oldTitle = args.get("old-title");

if (!repo || !sourceFile) {
  console.error("Usage: node --use-system-ca scripts/update-github-issue-from-export.mjs --source=issues/050-file.md [--old-title=Old title]");
  process.exit(1);
}

const token = getToken();
if (!token) {
  console.error("No GitHub token found in GITHUB_TOKEN or git credential manager.");
  process.exit(1);
}

const exported = JSON.parse(await fs.readFile("reports/github-issues.json", "utf8"));
const desired = exported.find((issue) => issue.source_file === sourceFile);
if (!desired) {
  console.error(`No exported issue found for ${sourceFile}`);
  process.exit(1);
}

const existing = await listIssues(repo, token);
const target = existing.find((issue) => issue.title === desired.title || (oldTitle && issue.title === oldTitle));
if (!target) {
  console.error(`No GitHub issue found for ${desired.title}${oldTitle ? ` or ${oldTitle}` : ""}`);
  process.exit(1);
}

const updated = await github(`/repos/${repo}/issues/${target.number}`, token, {
  method: "PATCH",
  body: JSON.stringify({
    title: desired.title,
    body: desired.body
  })
});

console.log(`Updated issue #${updated.number}: ${updated.title}`);
