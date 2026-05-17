# Next Runbook

Use this runbook to continue the project in batches without losing the thread.

## 1. Confirm Catalogue Coverage

Goal: know which requested books already exist in the local/HF/Shamela catalogue and which must be acquired externally.

```powershell
node scripts/resolve-requested-books.mjs
node scripts/build-download-plan.mjs
node scripts/build-curation-workspace.mjs
node scripts/validate-curation.mjs
node scripts/build-approved-download-manifest.mjs
```

Output to inspect:

- `reports/requested-book-resolution.json`
- `reports/requested-book-resolution.md`
- `reports/download-plan.json`
- `reports/download-plan.md`
- `curation/download-curation.json`
- `curation/scopes/{id}.json`
- `reports/curation-validation.json`
- `manifests/approved-downloads.json`

Special watch item: Iqd al-Farid must be the Ahmad Amin, Ahmad al-Zayn, and Ibrahim al-Abyari edition. A generic Shamela edition should be treated as fallback context only, not the canonical target.

The curation workspace is the approval layer. Do not run large downloads from top candidates alone; approve candidates in `curation/scopes/` first.
Future download jobs should read only `manifests/approved-downloads.json`, not the raw candidate reports.

## 2. Download In Batches

Process one author or book group at a time. Keep each batch small enough to validate before moving on.

Recommended first batches:

- Arabic language books and lexicons
- Ibn Taymiyyah continuation and source quality cleanup
- Ibn Hajar and hadith commentary works
- al-Nawawi and hadith commentary works
- Tafsir works
- Tarikh and tarajim works
- Fiqh/usul works
- Adab and benefit/story works

## 3. Build Baseline Metadata First

Baseline metadata should be deterministic where possible:

- Qur'an references
- hadith references
- names and biographies
- book/page/source references
- explicit definitions
- explicit rulings
- explicit principles, conditions, exceptions, consensus, and disagreement
- Arabic root and derivative information in language books

Do not use AI to invent metadata. AI can classify and summarize only after exact evidence text is available.

## 4. Enrich Candidate Claims

Use AI enrichment in controlled batches. Each candidate claim must contain:

- `claim_type`
- `claim_text`
- `evidence_text`
- `book_id`
- `book_title`
- `author`
- `author_death`
- `madhab`
- `volume_or_section`
- `page`
- `confidence`
- `validation_status`

Candidate claims are not final until the evidence text can be found in the preserved Arabic source.

## 5. Validate Before Indexing

Reject or quarantine claims when:

- the evidence text is missing
- the cited page/book does not match the evidence
- the claim type is too broad or wrong
- the passage only mentions the term incidentally
- the claim depends on inference but is labelled as direct evidence

## 6. Build Retrieval Layers

Recommended retrieval order:

1. exact Arabic text
2. normalized Arabic text
3. metadata-filtered search
4. semantic search for broader themes
5. graph/hypergraph expansion only after direct evidence exists

The app should never generate a source-backed footnote from a source that cannot be opened.

## 7. App Integration Gate

Before wiring a collection into the app, test:

- single Arabic word selection
- multi-word Arabic selection
- translated English selection mapped back to original Arabic
- Qur'an verse detection
- hadith detection
- biography/name detection
- language detail footnotes
- hadith grading/commentary footnotes
- explain-further footnotes
- source modal opening to the relevant evidence
