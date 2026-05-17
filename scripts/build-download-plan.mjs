import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const resolutionPath = path.join(root, "reports", "requested-book-resolution.json");
const reportsDir = path.join(root, "reports");

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function classify(item) {
  if (item.scope === "cross_cutting") {
    return {
      status: "cross_cutting_metadata_rule",
      action: "Apply this rule to every selected book record; no standalone download is required."
    };
  }

  const top = item.top_candidates?.[0] || null;
  if (!top) {
    return {
      status: "blocked_no_catalogue_candidate",
      action: "Find or acquire a reliable source before download."
    };
  }

  if (String(item.edition_status || "").startsWith("missing required edition terms")) {
    return {
      status: "blocked_exact_edition_not_confirmed",
      action: "Do not download as canonical. Locate the requested edition or mark this candidate as fallback-only."
    };
  }

  if (item.scope === "single_work" && Number(top.score) >= 70) {
    return {
      status: "ready_for_manual_review",
      action: "Review the top candidate's edition/publisher/editor, then approve for download."
    };
  }

  if (item.scope === "single_work_final_stage" && Number(top.score) >= 70) {
    return {
      status: "deferred_final_stage_review",
      action: "Review the top candidate now, but run download/enrichment only after the prior requested batches are complete."
    };
  }

  if (item.scope === "author_collection" || item.scope === "field_collection") {
    return {
      status: "requires_collection_curation",
      action: "Curate the candidate list into included/excluded books before download."
    };
  }

  return {
    status: "ambiguous_candidate",
    action: "Review candidates manually; the resolver cannot safely select a canonical text."
  };
}

const resolution = JSON.parse(await fs.readFile(resolutionPath, "utf8"));
const plan = resolution.map((item) => {
  const top = item.top_candidates?.[0] || null;
  const classification = classify(item);
  return {
    id: item.id,
    request: item.title,
    scope: item.scope,
    author: item.author,
    ...(item.required_edition ? { required_edition: item.required_edition } : {}),
    candidate_count: item.candidate_count,
    status: classification.status,
    recommended_action: classification.action,
    edition_status: item.edition_status,
    top_candidate: top ? {
      book_id: top.book_id,
      title_ar: top.title_ar,
      author_ar: top.author_ar,
      author_death_h: top.author_death_h,
      pages: top.pages,
      volumes: top.volumes,
      edition: top.edition,
      publisher: top.publisher,
      editor: top.editor,
      link: top.link,
      score: top.score,
      reasons: top.reasons
    } : null
  };
});

await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(path.join(reportsDir, "download-plan.json"), JSON.stringify(plan, null, 2), "utf8");

const grouped = plan.reduce((acc, item) => {
  acc[item.status] ||= [];
  acc[item.status].push(item);
  return acc;
}, {});

const md = [
  "# Download Plan",
  "",
  "This is a conservative plan. It does not treat top catalogue candidates as approved downloads until edition and scope review are complete.",
  "",
  "## Summary",
  "",
  "| Status | Count |",
  "|---|---:|",
  ...Object.entries(grouped).map(([status, items]) => `| ${escapeMd(status)} | ${items.length} |`),
  "",
  "## Items",
  "",
  "| ID | Request | Status | Top candidate | Action |",
  "|---|---|---|---|---|",
  ...plan.map((item) => {
    const top = item.top_candidate
      ? `${escapeMd(item.top_candidate.title_ar)} (${item.top_candidate.book_id}, score ${item.top_candidate.score})`
      : "None";
    return `| ${item.id} | ${escapeMd(item.request)} | ${escapeMd(item.status)} | ${top} | ${escapeMd(item.recommended_action)} |`;
  }),
  "",
  "Full structured plan is stored in `reports/download-plan.json`.",
  ""
];

await fs.writeFile(path.join(reportsDir, "download-plan.md"), md.join("\n"), "utf8");

console.log(`Wrote download plan for ${plan.length} requested scopes.`);
