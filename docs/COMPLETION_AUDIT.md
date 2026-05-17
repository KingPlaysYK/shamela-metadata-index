# Completion Audit

This audit records the real project state so the repository does not confuse planning work with completed data work.

## Completed

- D-drive project repository exists at `D:\ShamelaMetadataIndex`.
- GitHub repository exists at `https://github.com/KingPlaysYK/shamela-metadata-index`.
- Local preserved app RAG data exists at `D:\ShamelaMetadataIndex\data\existing-app-rag-data`.
- Preserved local data inventory currently reports 349 files, 68,235,417,017 bytes, about 63.55 GiB.
- Sixty task issue files exist under `issues/`.
- Sixty GitHub issues were created or reconciled from the local issue files.
- Requested book scope includes the later additions: al-Bayhaqi, Abu Layth al-Samarqandi, Ibn Muflih, al-Khatib al-Baghdadi, al-Zarkashi, Ibn Hajar's Takhrij Ahadith al-Kashshaf, al-Baydawi, and al-Mawsu'ah al-Fiqhiyyah al-Kuwaitiyyah.
- Iqd al-Farid issue #50 is scoped to the Ahmad Amin, Ahmad al-Zayn, and Ibrahim al-Abyari edition rather than a generic Iqd al-Farid text.
- Pipeline scaffolding exists for catalogue, download, baseline metadata, enrichment, validation, and indexing stages.

## Not Complete Yet

- The full requested book set has not been downloaded.
- The exact Ahmad Amin, Ahmad al-Zayn, and Ibrahim al-Abyari edition of Iqd al-Farid has not been confirmed in the copied local Shamela catalogue.
- Rich metadata has not been generated for all requested books.
- Evidence-span validation has not been run across the new requested collections.
- Exact Arabic, normalized Arabic, metadata, vector, and graph indexes have not been built for the full requested scope.
- The translation/word-analysis app is not yet wired to this repository as its production retrieval backend.
- Per-book quality reports are not yet complete.

## Current Evidence

Run these commands from `D:\ShamelaMetadataIndex`:

```powershell
node scripts/status.mjs
node scripts/export-github-issues.mjs
node scripts/resolve-requested-books.mjs
```

Expected current high-level status:

- `issueFiles`: 60
- `dataGiB`: about 63.55
- GitHub issue export should contain the same sixty issue records as the local `issues/` folder.

## Quality Standard

The project is not considered complete for a book until the following are true:

- The selected edition is identified and recorded.
- The full Arabic text is preserved unchanged.
- Normalized Arabic search text is generated separately from the preserved original.
- Page, paragraph, and logical chunks are created where useful.
- Metadata claims include exact evidence text.
- AI-enriched claims remain candidate claims until evidence validation passes.
- Every cited source can open to the relevant text or page.
- Non-numeric volume values such as `مقدمة` are displayed as section labels, not volume numbers.
- Footnote retrieval searches original normalized Arabic, not translated English.

