import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";

const root = process.cwd();
const jobsPath = path.join(root, "manifests", "download-jobs.json");
const parquetDir = path.join(root, "data", "existing-app-rag-data", "sources", "shamela-parquet");
const reportsDir = path.join(root, "reports");

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensureDir(filePath) {
  return fsp.mkdir(path.dirname(filePath), { recursive: true });
}

function runParquetlens(parquetPath, sql, onRow) {
  return new Promise((resolve, reject) => {
    const command = `& npx.cmd -y -p parquetlens -p '@parquetlens/sql' parquetlens ${psQuote(parquetPath)} --sql ${psQuote(sql)} --limit=100000000 --json --plain`;
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", command],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" ")
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("{")) return;
      try {
        onRow(JSON.parse(trimmed));
      } catch {
        // Ignore non-row diagnostics defensively; parquetlens can emit helper text in some failure modes.
      }
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `parquetlens exited with code ${code}`));
    });
  });
}

const jobsManifest = JSON.parse(await fsp.readFile(jobsPath, "utf8"));
const jobs = Array.isArray(jobsManifest.jobs) ? jobsManifest.jobs : [];
const jobsByBookId = new Map(jobs.map((job) => [String(job.book_id), job]));
const bookIds = [...jobsByBookId.keys()];

if (bookIds.length === 0) {
  console.log("No approved jobs to extract.");
  process.exit(0);
}

const parquetFiles = (await fsp.readdir(parquetDir))
  .filter((name) => name.endsWith(".parquet"))
  .sort()
  .map((name) => path.join(parquetDir, name));

const outputStreams = new Map();
const provenance = new Map();

for (const job of jobs) {
  const outputPath = path.join(root, job.output_path);
  await ensureDir(outputPath);
  const stream = fs.createWriteStream(outputPath, { encoding: "utf8" });
  outputStreams.set(String(job.book_id), stream);
  provenance.set(String(job.book_id), {
    book_id: String(job.book_id),
    title_ar: job.title_ar,
    author_ar: job.author_ar,
    request: job.request,
    source_link: job.source_link,
    extraction_source: "local_shamela_parquet",
    parquet_dir: path.relative(root, parquetDir).replaceAll("\\", "/"),
    row_count: 0,
    source_shards: []
  });
}

const inList = bookIds.map(sqlQuote).join(", ");
const sql = `SELECT serial_number, category_id, category, book_title, book_id, edition, publisher, page_number, volume_number, text, foot_note FROM data WHERE book_id IN (${inList})`;

console.log(`Extracting ${bookIds.length} approved books from ${parquetFiles.length} parquet shards.`);

for (let index = 0; index < parquetFiles.length; index += 1) {
  const parquetPath = parquetFiles[index];
  const shardName = path.basename(parquetPath);
  let shardRows = 0;
  const shardMatchedBookIds = new Set();
  console.log(`[${index + 1}/${parquetFiles.length}] ${shardName}`);

  await runParquetlens(parquetPath, sql, (row) => {
    const bookId = String(row.book_id || "");
    const stream = outputStreams.get(bookId);
    if (!stream) return;
    const prov = provenance.get(bookId);
    stream.write(`${JSON.stringify(row)}\n`);
    prov.row_count += 1;
    shardRows += 1;
    shardMatchedBookIds.add(bookId);
  });

  if (shardRows > 0) {
    for (const bookId of shardMatchedBookIds) {
      const prov = provenance.get(bookId);
      if (!prov.source_shards.includes(shardName)) prov.source_shards.push(shardName);
    }
    console.log(`  matched rows: ${shardRows}`);
  }
}

await Promise.all(
  [...outputStreams.values()].map(
    (stream) =>
      new Promise((resolve, reject) => {
        stream.end(resolve);
        stream.on("error", reject);
      })
  )
);

const extracted = [];
const missing = [];

for (const job of jobs) {
  const bookId = String(job.book_id);
  const prov = provenance.get(bookId);
  const provenancePath = path.join(root, job.provenance_path);
  await ensureDir(provenancePath);
  await fsp.writeFile(provenancePath, `${JSON.stringify(prov, null, 2)}\n`, "utf8");
  if (prov.row_count > 0) extracted.push(prov);
  else missing.push({ book_id: bookId, title_ar: job.title_ar, output_path: job.output_path });
}

const report = {
  generated_from: ["manifests/download-jobs.json", "data/existing-app-rag-data/sources/shamela-parquet/*.parquet"],
  approved_job_count: jobs.length,
  extracted_book_count: extracted.length,
  missing_book_count: missing.length,
  extracted,
  missing
};

await fsp.mkdir(reportsDir, { recursive: true });
await fsp.writeFile(path.join(reportsDir, "local-parquet-extraction.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const md = [
  "# Local Parquet Extraction",
  "",
  `Approved jobs: ${jobs.length}`,
  `Extracted books: ${extracted.length}`,
  `Missing books: ${missing.length}`,
  "",
  "## Extracted",
  "",
  extracted.length
    ? [
        "| Book ID | Rows | Output |",
        "|---|---:|---|",
        ...extracted.map((item) => {
          const job = jobsByBookId.get(item.book_id);
          return `| ${item.book_id} | ${item.row_count} | \`${job?.output_path || ""}\` |`;
        })
      ].join("\n")
    : "No books extracted.",
  "",
  "## Missing",
  "",
  missing.length
    ? [
        "| Book ID | Title |",
        "|---|---|",
        ...missing.map((item) => `| ${item.book_id} | ${String(item.title_ar || "").replace(/\|/g, "\\|")} |`)
      ].join("\n")
    : "No approved books were missing from the local parquet shards.",
  ""
];

await fsp.writeFile(path.join(reportsDir, "local-parquet-extraction.md"), md.join("\n"), "utf8");

console.log(`Extraction complete: ${extracted.length} books extracted, ${missing.length} missing.`);
