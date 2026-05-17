import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requestedPath = path.join(root, "config", "requested-book-batches.json");
const issuesDir = path.join(root, "issues");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const requested = JSON.parse((await fs.readFile(requestedPath, "utf8")).replace(/^\uFEFF/, ""));
await fs.mkdir(issuesDir, { recursive: true });

function requiredEditionBlock(item) {
  if (!item.required_edition) return "";
  const terms = Array.isArray(item.required_edition.required_terms)
    ? item.required_edition.required_terms.join(", ")
    : "";
  return `## Required Edition
- Description: ${item.required_edition.description || ""}
- Required terms: ${terms}
- Canonical rule: ${item.required_edition.canonical_rule || ""}`;
}

for (const item of requested) {
  const existing = (await fs.readdir(issuesDir)).find((name) => name.startsWith(`${item.id}-`) && name.endsWith(".md"));
  const file = existing || `${item.id}-${slugify(item.title)}.md`;
  const editionBlock = requiredEditionBlock(item);
  const body = `# ${item.title}

## Goal
Download, preserve, enrich metadata, validate, and index this requested source scope.

## Scope
- Scope type: ${item.scope}
- Author/source: ${item.author}
- Notes: ${item.notes}${editionBlock ? `\n\n${editionBlock}` : ""}

## Tasks
- [ ] Resolve canonical Arabic names and title variants.
- [ ] Identify all available Shamela/HF catalogue records.
- [ ] Select the most comprehensive detailed editions and avoid abridgements unless no better text exists.
- [ ] Download full Arabic text to \`data/raw\`.
- [ ] Record provenance, edition, editor, publisher, and source URL.
- [ ] Record author madhab and scholarly profile where known.
- [ ] Normalize Arabic search fields while preserving original evidence text.
- [ ] Build page, paragraph, logical, and evidence chunks.
- [ ] Extract deterministic baseline metadata.
- [ ] Extract enriched candidate metadata where useful.
- [ ] Detect and label claim types, including definitions, rulings, principles, exceptions, consensus, disagreement, hadith grading, biography, anecdotes, language usage, tafsir usage, and source criticism.
- [ ] Validate exact evidence spans and citations.
- [ ] Build lexical, metadata, and source lookup indexes.
- [ ] Add semantic/vector index when useful.
- [ ] Add graph/hypergraph relationships where useful.
- [ ] Run quality checks and produce a report.

## Acceptance
This scope is available for grounded word analysis, PDF footnote generation, source modal lookup, and research retrieval.
`;

  await fs.writeFile(path.join(issuesDir, file), body, "utf8");
}

console.log(`Generated ${requested.length} requested-scope issue files.`);
