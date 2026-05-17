import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const curationDir = path.join(root, "curation", "scopes");
const reportsDir = path.join(root, "reports");
const manifestsDir = path.join(root, "manifests");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const entries = await fs.readdir(curationDir, { withFileTypes: true });
const scopeFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort();

const downloads = [];
const skipped = [];

for (const filename of scopeFiles) {
  const record = JSON.parse(await fs.readFile(path.join(curationDir, filename), "utf8"));
  const review = record.review || {};
  const approvalStatus = review.approval_status;
  const candidateById = new Map(asArray(record.candidates).map((candidate) => [String(candidate.book_id), candidate]));

  if (approvalStatus === "approved" && hasValue(review.canonical_book_id)) {
    const bookId = String(review.canonical_book_id);
    const candidate = candidateById.get(bookId);
    downloads.push({
      scope_id: record.id,
      request: record.request,
      role: "canonical",
      book_id: bookId,
      title_ar: candidate?.title_ar || null,
      author_ar: candidate?.author_ar || null,
      source_link: candidate?.link || null,
      scope_file: `curation/scopes/${filename}`
    });
  } else if (approvalStatus === "approved_collection") {
    for (const bookId of asArray(review.include_book_ids).map(String).filter(Boolean)) {
      const candidate = candidateById.get(bookId);
      downloads.push({
        scope_id: record.id,
        request: record.request,
        role: "collection_member",
        book_id: bookId,
        title_ar: candidate?.title_ar || null,
        author_ar: candidate?.author_ar || null,
        source_link: candidate?.link || null,
        scope_file: `curation/scopes/${filename}`
      });
    }
  } else {
    const blockerText = asArray(review.blockers).filter(Boolean).join("; ");
    skipped.push({
      scope_id: record.id,
      request: record.request,
      approval_status: approvalStatus,
      reason: blockerText || record.recommended_action || "Not approved for download",
      scope_file: `curation/scopes/${filename}`
    });
  }
}

const manifest = {
  generated_from: ["curation/scopes/*.json"],
  rule: "Only approved curation records are eligible for download jobs.",
  approved_download_count: downloads.length,
  skipped_scope_count: skipped.length,
  downloads,
  skipped
};

await fs.mkdir(manifestsDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(manifestsDir, "approved-downloads.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const md = [
  "# Approved Download Manifest",
  "",
  "This manifest is the only safe input for future bulk download jobs. It intentionally excludes pending, blocked, ambiguous, and deferred scopes.",
  "",
  `Approved downloads: ${downloads.length}`,
  "",
  "## Downloads",
  "",
  downloads.length
    ? [
        "| Scope | Book ID | Title | Role |",
        "|---|---|---|---|",
        ...downloads.map((item) => `| ${item.scope_id} | ${item.book_id} | ${escapeMd(item.title_ar)} | ${escapeMd(item.role)} |`)
      ].join("\n")
    : "No books are approved for download yet.",
  "",
  "## Skipped Scopes",
  "",
  "| Scope | Approval status | Reason |",
  "|---|---|---|",
  ...skipped.map((item) => `| ${item.scope_id} | ${escapeMd(item.approval_status)} | ${escapeMd(item.reason)} |`),
  ""
];

await fs.writeFile(path.join(reportsDir, "approved-downloads.md"), md.join("\n"), "utf8");

console.log(`Approved download manifest: ${downloads.length} downloads, ${skipped.length} skipped scopes.`);
