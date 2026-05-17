import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const root = process.cwd();
const jobsPath = path.join(root, "manifests", "download-jobs.json");
const metadataDir = path.join(root, "data", "metadata", "baseline");
const indexDir = path.join(root, "data", "indexes", "baseline");
const reportsDir = path.join(root, "reports");

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;

function normalizeArabic(value) {
  return String(value || "")
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{Script=Arabic}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalizedText) {
  return normalizedText
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function writeLine(stream, value) {
  stream.write(`${JSON.stringify(value)}\n`);
}

async function readJsonl(filePath, onRow) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    onRow(JSON.parse(trimmed));
  }
}

function makeChunkId(row, serial) {
  const bookId = String(row.book_id || "unknown");
  const volume = String(row.volume_number || "none").replace(/[^a-zA-Z0-9\u0600-\u06FF._-]+/g, "-");
  const page = String(row.page_number || "none").replace(/[^a-zA-Z0-9\u0600-\u06FF._-]+/g, "-");
  const rowSerial = String(row.serial_number || serial).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${bookId}::${volume}::${page}::${rowSerial}`;
}

await fsp.mkdir(metadataDir, { recursive: true });
await fsp.mkdir(indexDir, { recursive: true });
await fsp.mkdir(reportsDir, { recursive: true });

const jobsManifest = JSON.parse(await fsp.readFile(jobsPath, "utf8"));
const jobs = Array.isArray(jobsManifest.jobs) ? jobsManifest.jobs : [];

const metadataPath = path.join(metadataDir, "approved-books.page-metadata.jsonl");
const searchIndexPath = path.join(indexDir, "approved-books.search.jsonl");
const termIndexPath = path.join(indexDir, "approved-books.term-index.json");
const bookStatsPath = path.join(metadataDir, "approved-books.stats.json");

const metadataStream = fs.createWriteStream(metadataPath, { encoding: "utf8" });
const searchStream = fs.createWriteStream(searchIndexPath, { encoding: "utf8" });

const termIndex = new Map();
const bookStats = new Map();
let totalChunks = 0;

for (const job of jobs) {
  const rawPath = path.join(root, job.output_path);
  if (!fs.existsSync(rawPath)) continue;

  await readJsonl(rawPath, (row) => {
    const originalText = String(row.text || "");
    const normalizedText = normalizeArabic(originalText);
    if (!normalizedText) return;

    const chunkId = makeChunkId(row, totalChunks + 1);
    const tokens = tokenize(normalizedText);
    const uniqueTerms = [...new Set(tokens)];

    const metadata = {
      chunk_id: chunkId,
      source_type: "shamela_page",
      book_id: String(row.book_id || job.book_id),
      book_title: row.book_title || job.title_ar,
      author_ar: job.author_ar || null,
      category: row.category || null,
      category_id: row.category_id || null,
      edition: row.edition || null,
      publisher: row.publisher || null,
      volume_number: row.volume_number || null,
      page_number: row.page_number || null,
      serial_number: row.serial_number || null,
      source_link: job.source_link || null,
      provenance_path: job.provenance_path,
      original_char_count: originalText.length,
      normalized_char_count: normalizedText.length,
      token_count: tokens.length,
      has_footnote: row.foot_note && row.foot_note !== "None",
      metadata_level: "deterministic_baseline",
      next_stage: "AI rich metadata claim extraction and validation"
    };

    writeLine(metadataStream, metadata);
    writeLine(searchStream, {
      ...metadata,
      text: originalText,
      normalized_text: normalizedText,
      foot_note: row.foot_note && row.foot_note !== "None" ? row.foot_note : null
    });

    const stats = bookStats.get(metadata.book_id) || {
      book_id: metadata.book_id,
      book_title: metadata.book_title,
      category: metadata.category,
      chunks: 0,
      tokens: 0,
      first_page: metadata.page_number,
      last_page: metadata.page_number,
      volumes: new Set()
    };
    stats.chunks += 1;
    stats.tokens += tokens.length;
    stats.last_page = metadata.page_number;
    if (metadata.volume_number) stats.volumes.add(String(metadata.volume_number));
    bookStats.set(metadata.book_id, stats);

    for (const term of uniqueTerms) {
      const entry = termIndex.get(term) || { term, document_frequency: 0, examples: [] };
      entry.document_frequency += 1;
      if (entry.examples.length < 5) {
        entry.examples.push({
          chunk_id: chunkId,
          book_id: metadata.book_id,
          volume_number: metadata.volume_number,
          page_number: metadata.page_number
        });
      }
      termIndex.set(term, entry);
    }

    totalChunks += 1;
  });
}

await Promise.all([
  new Promise((resolve, reject) => {
    metadataStream.end(resolve);
    metadataStream.on("error", reject);
  }),
  new Promise((resolve, reject) => {
    searchStream.end(resolve);
    searchStream.on("error", reject);
  })
]);

const sortedTerms = [...termIndex.values()].sort((a, b) => b.document_frequency - a.document_frequency || a.term.localeCompare(b.term));
const stats = {
  generated_from: ["data/raw/shamela_ws/*.jsonl"],
  metadata_path: path.relative(root, metadataPath).replaceAll("\\", "/"),
  search_index_path: path.relative(root, searchIndexPath).replaceAll("\\", "/"),
  term_index_path: path.relative(root, termIndexPath).replaceAll("\\", "/"),
  job_count: jobs.length,
  chunk_count: totalChunks,
  term_count: sortedTerms.length,
  books: [...bookStats.values()].map((item) => ({
    ...item,
    volumes: [...item.volumes].sort()
  }))
};

await fsp.writeFile(termIndexPath, `${JSON.stringify({ generated_from: [stats.search_index_path], terms: sortedTerms }, null, 2)}\n`, "utf8");
await fsp.writeFile(bookStatsPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
await fsp.writeFile(path.join(reportsDir, "baseline-metadata-index.json"), `${JSON.stringify(stats, null, 2)}\n`, "utf8");

const md = [
  "# Baseline Metadata And Index",
  "",
  `Jobs: ${jobs.length}`,
  `Chunks indexed: ${totalChunks}`,
  `Unique normalized Arabic terms: ${sortedTerms.length}`,
  "",
  "## Outputs",
  "",
  `- Metadata: \`${stats.metadata_path}\``,
  `- Search index: \`${stats.search_index_path}\``,
  `- Term index: \`${stats.term_index_path}\``,
  "",
  "## Books",
  "",
  "| Book ID | Chunks | Tokens | Title |",
  "|---|---:|---:|---|",
  ...stats.books.map((book) => `| ${book.book_id} | ${book.chunks} | ${book.tokens} | ${String(book.book_title || "").replace(/\|/g, "\\|")} |`),
  ""
];

await fsp.writeFile(path.join(reportsDir, "baseline-metadata-index.md"), md.join("\n"), "utf8");

console.log(`Baseline metadata/index complete: ${totalChunks} chunks, ${sortedTerms.length} unique terms.`);
