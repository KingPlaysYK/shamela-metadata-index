# Data Pipeline

## Stage 1: Catalogue

Build a searchable catalogue of books, authors, editions, categories, and availability.

Output:

- `data/catalogue/books.parquet`
- `data/catalogue/authors.parquet`
- `data/catalogue/source-status.parquet`

## Stage 2: Download

Download only selected books first. Keep original Arabic text intact.

Output:

- `data/raw/{source}/{book_id}.jsonl`
- `data/raw/download-manifest.json`

## Stage 3: Normalize

Add search-normalized Arabic while preserving original source text.

Output:

- `data/processed/pages.parquet`
- `data/processed/paragraphs.parquet`

## Stage 4: Chunk

Create multiple retrieval layers:

- page chunks
- paragraph chunks
- logical chunks
- evidence snippets

Output:

- `data/processed/chunks.parquet`

## Stage 5: Baseline Metadata

Run deterministic extraction first.

Extract:

- definitions
- root meanings
- derivations
- Qur'an references
- hadith references
- source references
- fiqh rulings
- usul principles
- conditions
- exceptions
- consensus
- disagreement
- biography entries
- narrator judgments
- stories and benefits

Output:

- `data/metadata/baseline/*.jsonl`

## Stage 6: Enriched Metadata

Use AI only where it adds real value.

Rules:

- Exact Arabic evidence is required.
- Unsupported claims are rejected.
- AI records are marked as candidate until validated.

Output:

- `data/metadata/enriched/*.jsonl`

## Stage 7: Validation

Validate:

- exact evidence span
- book/page citation
- claim type
- source suitability
- retrieval relevance

Output:

- `data/reports/validation/*.json`

## Stage 8: Indexing

Build:

- exact Arabic search
- normalized Arabic search
- metadata filtered search
- optional vector index
- optional graph/hypergraph relationships

Output:

- `data/indexes/meilisearch`
- `data/indexes/qdrant`
- `data/graph`

## Stage 9: App Integration

Expose retrieval to:

- word analysis
- PDF footnote generation
- source modal
- explain further
- research mode

## Runnable Scaffolds

These scripts are intentionally conservative. They help prepare and verify the work before expensive downloads or AI runs.

```powershell
node scripts/status.mjs
node scripts/inventory-existing-data.mjs
node scripts/resolve-requested-books.mjs
node scripts/build-download-plan.mjs
node scripts/pipeline-stage.mjs --stage=catalogue
node scripts/pipeline-stage.mjs --stage=download
node scripts/pipeline-stage.mjs --stage=baseline
node scripts/pipeline-stage.mjs --stage=enrich
node scripts/pipeline-stage.mjs --stage=validate
node scripts/pipeline-stage.mjs --stage=index
```

Full long-running download/enrichment/index jobs should be run in batches and logged under `data/logs`.
