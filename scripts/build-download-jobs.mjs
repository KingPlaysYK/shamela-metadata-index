import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const approvedManifestPath = path.join(root, "manifests", "approved-downloads.json");
const manifestsDir = path.join(root, "manifests");
const reportsDir = path.join(root, "reports");

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function inferSource(link) {
  if (String(link || "").includes("shamela.ws")) return "shamela_ws";
  if (String(link || "").includes("huggingface.co")) return "huggingface";
  return "unknown";
}

function safePathPart(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const approvedManifest = JSON.parse(await fs.readFile(approvedManifestPath, "utf8"));
const downloads = Array.isArray(approvedManifest.downloads) ? approvedManifest.downloads : [];

const jobs = downloads.map((item, index) => {
  const source = inferSource(item.source_link);
  const bookId = String(item.book_id);
  const jobId = `${String(index + 1).padStart(4, "0")}-${safePathPart(item.scope_id)}-${safePathPart(bookId)}`;
  return {
    job_id: jobId,
    status: "queued",
    source,
    scope_id: item.scope_id,
    request: item.request,
    role: item.role,
    book_id: bookId,
    title_ar: item.title_ar,
    author_ar: item.author_ar,
    source_link: item.source_link,
    scope_file: item.scope_file,
    output_path: `data/raw/${source}/${bookId}.jsonl`,
    provenance_path: `data/raw/${source}/${bookId}.provenance.json`,
    preconditions: [
      "approved in curation scope file",
      "original Arabic text must be preserved",
      "normalized search text must be stored separately later",
      "download provenance must record source URL and retrieval method"
    ]
  };
});

const manifest = {
  generated_from: ["manifests/approved-downloads.json"],
  rule: "Only jobs generated from approved-downloads.json may be executed by the download runner.",
  job_count: jobs.length,
  jobs
};

await fs.mkdir(manifestsDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(manifestsDir, "download-jobs.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const md = [
  "# Download Jobs",
  "",
  "This report is generated from `manifests/approved-downloads.json`.",
  "",
  `Queued jobs: ${jobs.length}`,
  "",
  jobs.length
    ? [
        "| Job | Source | Book ID | Title | Output |",
        "|---|---|---|---|---|",
        ...jobs.map((job) => `| ${escapeMd(job.job_id)} | ${escapeMd(job.source)} | ${escapeMd(job.book_id)} | ${escapeMd(job.title_ar)} | \`${job.output_path}\` |`)
      ].join("\n")
    : "No download jobs are queued because no curation scope has been approved yet.",
  ""
];

await fs.writeFile(path.join(reportsDir, "download-jobs.md"), md.join("\n"), "utf8");

console.log(`Download jobs: ${jobs.length}`);
