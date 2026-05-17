import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const curationDir = path.join(root, "curation", "scopes");
const reportsDir = path.join(root, "reports");

const MIN_SCORE = 120;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasExactTitle(candidate) {
  return asArray(candidate?.reasons).some((reason) => String(reason).toLowerCase().includes("exact title:"));
}

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const entries = await fs.readdir(curationDir, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort();

const approved = [];
const skipped = [];

for (const filename of files) {
  const filePath = path.join(curationDir, filename);
  const record = JSON.parse(await fs.readFile(filePath, "utf8"));
  const review = record.review || {};
  const candidates = asArray(record.candidates);
  const topCandidate = candidates[0];
  const topScore = Number(topCandidate?.score || 0);

  if (record.scope !== "single_work") {
    skipped.push({
      id: record.id,
      request: record.request,
      reason: "not a single-work scope"
    });
    continue;
  }

  if (record.status !== "ready_for_manual_review" || review.approval_status !== "pending_review") {
    skipped.push({
      id: record.id,
      request: record.request,
      reason: `status is ${record.status}/${review.approval_status}`
    });
    continue;
  }

  if (!topCandidate) {
    skipped.push({
      id: record.id,
      request: record.request,
      reason: "no candidates"
    });
    continue;
  }

  if (topScore < MIN_SCORE || !hasExactTitle(topCandidate)) {
    skipped.push({
      id: record.id,
      request: record.request,
      reason: `top candidate not high-confidence enough: score=${topScore}, exact_title=${hasExactTitle(topCandidate)}`
    });
    continue;
  }

  record.review = {
    ...review,
    approval_status: "approved",
    canonical_book_id: String(topCandidate.book_id),
    fallback_book_ids: asArray(review.fallback_book_ids),
    blockers: [],
    approval_basis:
      "Auto-approved as a high-confidence single-work match: top candidate has an exact-title resolver reason and score >= 120. Collection scopes, ambiguous matches, and exact-edition blockers are not auto-approved.",
    approved_by_script: "scripts/approve-high-confidence-single-works.mjs"
  };

  record.candidates = candidates.map((candidate, index) => {
    if (index === 0) {
      return {
        ...candidate,
        decision: "approved",
        role: "canonical",
        review_notes:
          "Auto-approved as the canonical single-work text because it was the top exact-title candidate above the confidence threshold."
      };
    }

    return {
      ...candidate,
      decision: candidate.decision === "undecided" ? "not_selected" : candidate.decision,
      role: candidate.role || null,
      review_notes: candidate.review_notes || "Not selected by high-confidence single-work auto-approval."
    };
  });

  await fs.writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  approved.push({
    id: record.id,
    request: record.request,
    book_id: String(topCandidate.book_id),
    title_ar: topCandidate.title_ar,
    author_ar: topCandidate.author_ar,
    score: topScore,
    file: `curation/scopes/${filename}`
  });
}

const report = {
  generated_from: ["curation/scopes/*.json"],
  rule: `Auto-approve only high-confidence single-work scopes with exact-title match and score >= ${MIN_SCORE}.`,
  approved_count: approved.length,
  skipped_count: skipped.length,
  approved,
  skipped
};

await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(reportsDir, "auto-approval.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const md = [
  "# Auto Approval Report",
  "",
  `Rule: single-work scopes only; top candidate must have an exact-title resolver reason and score >= ${MIN_SCORE}.`,
  "",
  `Approved: ${approved.length}`,
  `Skipped: ${skipped.length}`,
  "",
  "## Approved",
  "",
  approved.length
    ? [
        "| Scope | Book ID | Score | Title |",
        "|---|---:|---:|---|",
        ...approved.map((item) => `| ${item.id} | ${item.book_id} | ${item.score} | ${escapeMd(item.title_ar)} |`)
      ].join("\n")
    : "No scopes approved.",
  "",
  "## Skipped",
  "",
  "| Scope | Reason |",
  "|---|---|",
  ...skipped.map((item) => `| ${item.id} | ${escapeMd(item.reason)} |`),
  ""
];

await fs.writeFile(path.join(reportsDir, "auto-approval.md"), md.join("\n"), "utf8");

console.log(`Auto-approval complete: ${approved.length} approved, ${skipped.length} skipped.`);
