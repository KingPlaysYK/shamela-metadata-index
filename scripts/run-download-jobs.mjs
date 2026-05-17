import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const jobsPath = path.join(root, "manifests", "download-jobs.json");
const reportsDir = path.join(root, "reports");

const execute = process.argv.includes("--execute");

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function makeResult(job, mode) {
  if (mode === "dry-run") {
    return {
      job_id: job.job_id,
      book_id: job.book_id,
      status: "dry_run_ready",
      output_path: job.output_path,
      message: "Job is structurally ready but was not executed."
    };
  }

  return {
    job_id: job.job_id,
    book_id: job.book_id,
    status: "not_executed",
    output_path: job.output_path,
    message: "Execution is intentionally blocked until a source-specific downloader is implemented and approved."
  };
}

const manifest = JSON.parse(await fs.readFile(jobsPath, "utf8"));
const jobs = Array.isArray(manifest.jobs) ? manifest.jobs : [];
const mode = execute ? "execute" : "dry-run";
const results = jobs.map((job) => makeResult(job, mode));

const runReport = {
  generated_from: ["manifests/download-jobs.json"],
  mode,
  job_count: jobs.length,
  executed_count: 0,
  skipped_count: jobs.length,
  results,
  notes: execute
    ? [
        "No network download was performed.",
        "Implement and validate a source-specific downloader before enabling execution."
      ]
    : [
        "Dry run only.",
        "Use this report to confirm that approved jobs resolve to the expected raw-data output paths."
      ]
};

await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(reportsDir, "download-run.json"), `${JSON.stringify(runReport, null, 2)}\n`, "utf8");

const md = [
  "# Download Run",
  "",
  `Mode: ${mode}`,
  "",
  `Jobs: ${jobs.length}`,
  "",
  jobs.length
    ? [
        "| Job | Book ID | Status | Output |",
        "|---|---|---|---|",
        ...results.map((result) => `| ${escapeMd(result.job_id)} | ${escapeMd(result.book_id)} | ${escapeMd(result.status)} | \`${result.output_path}\` |`)
      ].join("\n")
    : "No jobs to run.",
  "",
  "## Notes",
  "",
  ...runReport.notes.map((note) => `- ${note}`),
  ""
];

await fs.writeFile(path.join(reportsDir, "download-run.md"), md.join("\n"), "utf8");

console.log(`Download runner ${mode}: ${jobs.length} jobs, 0 executed.`);
if (execute && jobs.length > 0) process.exitCode = 1;
