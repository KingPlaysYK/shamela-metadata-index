import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const curationPath = path.join(root, "curation", "download-curation.json");
const reportsDir = path.join(root, "reports");

const allowedApprovalStatuses = new Set([
  "pending_review",
  "collection_curation_required",
  "blocked",
  "rule",
  "ambiguous",
  "deferred",
  "approved",
  "approved_collection",
  "fallback_only",
  "external_required"
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

const manifest = await readJson(curationPath);
const structuralErrors = [];
const warnings = [];
const blockers = [];
const readyDownloads = [];
const scopeSummaries = [];

for (const scope of asArray(manifest.scopes)) {
  const absoluteScopePath = path.join(root, scope.file);
  let record = null;
  try {
    record = await readJson(absoluteScopePath);
  } catch (error) {
    structuralErrors.push({
      id: scope.id,
      file: scope.file,
      message: `Cannot read scope file: ${error.message}`
    });
    continue;
  }

  if (record.id !== scope.id) {
    structuralErrors.push({
      id: scope.id,
      file: scope.file,
      message: `Scope file id ${record.id} does not match manifest id ${scope.id}`
    });
  }

  const review = record.review || {};
  const approvalStatus = review.approval_status || scope.approval_status;
  if (!allowedApprovalStatuses.has(approvalStatus)) {
    structuralErrors.push({
      id: scope.id,
      file: scope.file,
      message: `Unknown approval status: ${approvalStatus}`
    });
  }

  const candidateIds = new Set(asArray(record.candidates).map((candidate) => String(candidate.book_id)));
  const candidateById = new Map(asArray(record.candidates).map((candidate) => [String(candidate.book_id), candidate]));
  const canonicalId = hasValue(review.canonical_book_id) ? String(review.canonical_book_id) : null;
  const includeIds = asArray(review.include_book_ids).map(String).filter(Boolean);
  const fallbackIds = asArray(review.fallback_book_ids).map(String).filter(Boolean);

  if (canonicalId && !candidateIds.has(canonicalId)) {
    structuralErrors.push({
      id: scope.id,
      file: scope.file,
      message: `canonical_book_id ${canonicalId} is not present in candidates`
    });
  }

  for (const includeId of includeIds) {
    if (!candidateIds.has(includeId)) {
      structuralErrors.push({
        id: scope.id,
        file: scope.file,
        message: `include_book_ids contains ${includeId}, but it is not present in candidates`
      });
    }
  }

  for (const fallbackId of fallbackIds) {
    if (!candidateIds.has(fallbackId)) {
      structuralErrors.push({
        id: scope.id,
        file: scope.file,
        message: `fallback_book_ids contains ${fallbackId}, but it is not present in candidates`
      });
    }
  }

  if (approvalStatus === "approved" && !canonicalId) {
    structuralErrors.push({
      id: scope.id,
      file: scope.file,
      message: "approved scope must set review.canonical_book_id"
    });
  }

  if (approvalStatus === "approved_collection" && includeIds.length === 0) {
    structuralErrors.push({
      id: scope.id,
      file: scope.file,
      message: "approved_collection scope must set at least one review.include_book_ids entry"
    });
  }

  if (record.status === "blocked_exact_edition_not_confirmed") {
    if (approvalStatus !== "blocked" && approvalStatus !== "external_required") {
      structuralErrors.push({
        id: scope.id,
        file: scope.file,
        message: "exact-edition blocked scope cannot be approved until the requested edition is verified"
      });
    }

    if (canonicalId) {
      structuralErrors.push({
        id: scope.id,
        file: scope.file,
        message: "exact-edition blocked scope must not set a canonical_book_id"
      });
    }

    for (const fallbackId of fallbackIds) {
      const candidate = candidateById.get(fallbackId);
      if (candidate && candidate.role !== "fallback_context") {
        warnings.push({
          id: scope.id,
          file: scope.file,
          message: `fallback candidate ${fallbackId} should be labelled role=fallback_context`
        });
      }
    }
  }

  if (approvalStatus === "blocked" || approvalStatus === "external_required") {
    blockers.push({
      id: scope.id,
      request: scope.request,
      file: scope.file,
      blockers: asArray(review.blockers),
      recommended_action: record.recommended_action
    });
  }

  if (approvalStatus === "pending_review" && canonicalId) {
    warnings.push({
      id: scope.id,
      file: scope.file,
      message: "canonical_book_id is set but approval_status is still pending_review"
    });
  }

  if (approvalStatus === "collection_curation_required" && includeIds.length > 0) {
    warnings.push({
      id: scope.id,
      file: scope.file,
      message: "include_book_ids are set but approval_status is still collection_curation_required"
    });
  }

  if (approvalStatus === "approved" && canonicalId) {
    readyDownloads.push({
      id: scope.id,
      request: scope.request,
      file: scope.file,
      book_ids: [canonicalId]
    });
  } else if (approvalStatus === "approved_collection" && includeIds.length) {
    readyDownloads.push({
      id: scope.id,
      request: scope.request,
      file: scope.file,
      book_ids: includeIds
    });
  }

  scopeSummaries.push({
    id: scope.id,
    request: scope.request,
    status: record.status,
    approval_status: approvalStatus,
    candidate_count: asArray(record.candidates).length,
    canonical_book_id: canonicalId,
    include_count: includeIds.length,
    blocker_count: asArray(review.blockers).length,
    file: scope.file
  });
}

const statusCounts = scopeSummaries.reduce((acc, scope) => {
  acc[scope.approval_status] ||= 0;
  acc[scope.approval_status] += 1;
  return acc;
}, {});

const report = {
  generated_from: ["curation/download-curation.json", "curation/scopes/*.json"],
  valid: structuralErrors.length === 0,
  status_counts: statusCounts,
  ready_download_scope_count: readyDownloads.length,
  ready_download_book_count: readyDownloads.reduce((sum, item) => sum + item.book_ids.length, 0),
  structural_errors: structuralErrors,
  warnings,
  blockers,
  scopes: scopeSummaries
};

await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(reportsDir, "curation-validation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const md = [
  "# Curation Validation",
  "",
  `Valid: ${report.valid ? "yes" : "no"}`,
  "",
  "## Approval Status Counts",
  "",
  "| Status | Count |",
  "|---|---:|",
  ...Object.entries(statusCounts).map(([status, count]) => `| ${escapeMd(status)} | ${count} |`),
  "",
  "## Download Readiness",
  "",
  `Ready download scopes: ${report.ready_download_scope_count}`,
  "",
  `Ready download books: ${report.ready_download_book_count}`,
  "",
  "## Structural Errors",
  "",
  structuralErrors.length
    ? structuralErrors.map((error) => `- ${error.id}: ${escapeMd(error.message)} (${error.file})`).join("\n")
    : "None.",
  "",
  "## Blockers",
  "",
  blockers.length
    ? blockers.map((blocker) => `- ${blocker.id}: ${escapeMd(blocker.request)} - ${escapeMd(asArray(blocker.blockers).join("; ") || blocker.recommended_action)}`).join("\n")
    : "None.",
  "",
  "## Warnings",
  "",
  warnings.length
    ? warnings.map((warning) => `- ${warning.id}: ${escapeMd(warning.message)} (${warning.file})`).join("\n")
    : "None.",
  ""
];

await fs.writeFile(path.join(reportsDir, "curation-validation.md"), md.join("\n"), "utf8");

console.log(`Curation validation ${report.valid ? "passed" : "failed"}: ${structuralErrors.length} errors, ${warnings.length} warnings, ${blockers.length} blockers.`);
if (!report.valid) process.exitCode = 1;
