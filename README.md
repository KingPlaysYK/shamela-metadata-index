# Shamela Metadata Index

Project workspace for downloading selected Islamic and Arabic language books, building enriched evidence metadata, and indexing the material for retrieval and footnote generation.

This repository is intended to keep:

- raw download manifests
- book catalogues
- deterministic metadata extraction scripts
- AI-assisted metadata extraction prompts
- validation reports
- indexing configuration
- task issues and project documentation

Large raw datasets, generated indexes, model outputs, and secrets should not be committed to GitHub.

## Current local state

Existing app RAG data has been preserved at:

`D:/ShamelaMetadataIndex/data/existing-app-rag-data`

Current copied size: approximately 63.55 GiB.

Useful commands:

```powershell
node scripts/status.mjs
node scripts/inventory-existing-data.mjs
node scripts/export-github-issues.mjs
```
