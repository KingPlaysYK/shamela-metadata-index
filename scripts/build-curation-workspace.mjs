import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const resolutionPath = path.join(root, "reports", "requested-book-resolution.json");
const planPath = path.join(root, "reports", "download-plan.json");
const curationDir = path.join(root, "curation");
const scopesDir = path.join(curationDir, "scopes");

function reviewTemplate(item) {
  switch (item.status) {
    case "ready_for_manual_review":
      return {
        approval_status: "pending_review",
        canonical_book_id: null,
        fallback_book_ids: [],
        blockers: [],
        instructions: [
          "Check edition, editor, publisher, completeness, and page/volume metadata.",
          "Set canonical_book_id only after confirming this is the intended full text.",
          "Do not approve abridgements unless no fuller text exists and the limitation is recorded."
        ]
      };
    case "requires_collection_curation":
      return {
        approval_status: "collection_curation_required",
        canonical_book_id: null,
        include_book_ids: [],
        exclude_book_ids: [],
        fallback_book_ids: [],
        blockers: [],
        instructions: [
          "Review candidates and create a curated include list.",
          "Prefer comprehensive authored works and avoid unrelated studies about the author unless explicitly useful.",
          "Record why any major work is missing."
        ]
      };
    case "blocked_exact_edition_not_confirmed":
      return {
        approval_status: "blocked",
        canonical_book_id: null,
        fallback_book_ids: item.top_candidate?.book_id ? [item.top_candidate.book_id] : [],
        blockers: [item.edition_status],
        instructions: [
          "Do not process the fallback as the canonical edition.",
          "Acquire or verify the requested edition before download, enrichment, or indexing.",
          "Fallback candidates can be used only for context and must be labelled as fallback."
        ]
      };
    case "deferred_final_stage_review":
      return {
        approval_status: "deferred",
        canonical_book_id: null,
        fallback_book_ids: [],
        blockers: ["Run after the earlier requested author/source batches."],
        instructions: [
          "Review the candidate now but defer processing until prior batches are complete.",
          "This stage should receive full metadata and indexing after the corpus foundations are stable."
        ]
      };
    case "cross_cutting_metadata_rule":
      return {
        approval_status: "rule",
        canonical_book_id: null,
        fallback_book_ids: [],
        blockers: [],
        instructions: [
          "Apply this metadata rule to every selected book.",
          "No standalone text download is required."
        ]
      };
    default:
      return {
        approval_status: "ambiguous",
        canonical_book_id: null,
        fallback_book_ids: [],
        blockers: ["Resolver could not safely select a canonical text."],
        instructions: [
          "Review candidates manually.",
          "If the target is absent, mark as external acquisition required."
        ]
      };
  }
}

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const resolution = JSON.parse(await fs.readFile(resolutionPath, "utf8"));
const plan = JSON.parse(await fs.readFile(planPath, "utf8"));
const resolutionById = new Map(resolution.map((item) => [item.id, item]));

await fs.mkdir(scopesDir, { recursive: true });

const manifest = {
  generated_from: [
    "reports/requested-book-resolution.json",
    "reports/download-plan.json"
  ],
  purpose: "Human-readable and machine-readable curation layer before downloads, enrichment, and indexing.",
  rule: "No candidate is canonical until approval_status is reviewed and canonical_book_id or include_book_ids are set.",
  scopes: []
};

for (const item of plan) {
  const resolved = resolutionById.get(item.id) || {};
  const template = reviewTemplate(item);
  const scopeRecord = {
    id: item.id,
    request: item.request,
    scope: item.scope,
    author: item.author,
    status: item.status,
    recommended_action: item.recommended_action,
    edition_status: item.edition_status,
    review: template,
    candidates: (resolved.top_candidates || []).slice(0, 25).map((candidate) => ({
      book_id: candidate.book_id,
      decision: "undecided",
      role: null,
      title_ar: candidate.title_ar,
      author_ar: candidate.author_ar,
      author_death_h: candidate.author_death_h,
      category: candidate.category,
      pages: candidate.pages,
      volumes: candidate.volumes,
      edition: candidate.edition,
      publisher: candidate.publisher,
      editor: candidate.editor,
      link: candidate.link,
      score: candidate.score,
      reasons: candidate.reasons || [],
      review_notes: ""
    }))
  };

  const filename = `${item.id}.json`;
  await fs.writeFile(path.join(scopesDir, filename), `${JSON.stringify(scopeRecord, null, 2)}\n`, "utf8");
  manifest.scopes.push({
    id: item.id,
    request: item.request,
    status: item.status,
    approval_status: template.approval_status,
    file: `curation/scopes/${filename}`,
    top_candidate_book_id: item.top_candidate?.book_id || null
  });
}

await fs.writeFile(path.join(curationDir, "download-curation.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const counts = manifest.scopes.reduce((acc, scope) => {
  acc[scope.approval_status] ||= 0;
  acc[scope.approval_status] += 1;
  return acc;
}, {});

const readme = [
  "# Download Curation Workspace",
  "",
  "This folder is the approval layer between catalogue resolution and large downloads.",
  "",
  "A top catalogue candidate is not automatically canonical. Approve or reject candidates here before running download, metadata enrichment, or indexing jobs.",
  "",
  "## Approval Status Summary",
  "",
  "| Approval status | Count |",
  "|---|---:|",
  ...Object.entries(counts).map(([status, count]) => `| ${escapeMd(status)} | ${count} |`),
  "",
  "## How To Use",
  "",
  "1. Open the relevant `curation/scopes/{id}.json` file.",
  "2. For single works, inspect the candidate's edition, editor, publisher, completeness, and source link.",
  "3. Set `review.canonical_book_id` only when the candidate is accepted.",
  "4. For author or field collections, populate `review.include_book_ids` and `review.exclude_book_ids`.",
  "5. Keep blocked exact-edition requests blocked until the requested edition is acquired or verified.",
  "",
  "## Scope Files",
  "",
  "| ID | Status | Approval | File |",
  "|---|---|---|---|",
  ...manifest.scopes.map((scope) => `| ${scope.id} | ${escapeMd(scope.status)} | ${escapeMd(scope.approval_status)} | \`${scope.file}\` |`),
  ""
];

await fs.writeFile(path.join(curationDir, "README.md"), readme.join("\n"), "utf8");

console.log(`Wrote curation workspace for ${manifest.scopes.length} scopes.`);
