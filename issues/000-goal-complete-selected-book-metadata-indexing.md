# GOAL: Complete Selected Book Metadata And Indexing

## Goal
Download, preserve, enrich metadata, validate, and index the selected Arabic/Islamic books requested for the app.

This goal covers the selected books and collections listed in the requested-book scopes, including Arabic language books, Ibn Taymiyyah-related existing data, Ibn al-Jawzi, Ibn Hajar, Ibn Qudamah, al-Dhahabi, Ibn al-Qayyim, al-Albani, Ibn Uthaymin, al-Qurtubi, Ibn Rushd, Qadi Iyad, Ibn Hazm, al-Ithyubi, al-Baghawi, al-Shafi'i, al-Kasani, Ibn Kathir, al-Nawawi, al-Tabari, Ibn al-Athir, Ibn Khaldun, al-Ayni, Ibn Abd al-Barr, al-Bayhaqi, Abu Layth al-Samarqandi, Ibn Muflih, al-Khatib al-Baghdadi, al-Zarkashi, al-Baydawi, and al-Mawsuah al-Fiqhiyyah al-Kuwaitiyyah.

## Required Outcome
- Full Arabic source text is stored with provenance.
- Book, author, madhab, edition, volume, page, and source-link metadata are recorded.
- Rich metadata is extracted for language, tafsir, hadith, fiqh/usul, aqidah/manhaj, biography, anecdotes, principles, maxims, rulings, disagreements, consensus, and source criticism.
- Exact evidence spans are validated against the original Arabic text.
- Lexical, metadata, source lookup, and semantic indexes are built where useful.
- The app can retrieve sources for word analysis, PDF footnotes, passage explanation, hadith commentary, tafsir usage, biography notes, and “explain further” notes.

## Execution Phases
- [x] Resolve selected book/source catalogue records.
- [x] Curate exact editions and block generic replacements where edition matters.
- [ ] Approve canonical book IDs or curated include lists.
- [ ] Download approved raw Arabic texts.
- [ ] Build deterministic baseline metadata.
- [ ] Extract rich candidate metadata.
- [ ] Validate evidence spans and citations.
- [ ] Build search/index layers.
- [ ] Run quality checks.
- [ ] Connect resulting indexes to the app.

## Progress Snapshot
- High-confidence single-work auto-approval was added and run. It approved 11 exact-title single-work scopes and left collection scopes, ambiguous matches, and exact-edition blockers untouched.
- Approved books were extracted from the local Shamela parquet shards into `data/raw/shamela_ws/` on D drive. Extraction report: 11 extracted, 0 missing.
- Deterministic baseline metadata and a normalized Arabic search index were built for those extracted books. Current baseline: 62,928 chunks and 303,916 unique normalized Arabic terms.
- Large raw/index outputs are intentionally stored locally on D drive and ignored by git; GitHub stores the scripts, manifests, reports, and issue plan.

## Current Guardrail
Do not treat top catalogue candidates as approved downloads. Every book must pass curation first. If a specific edition was requested, only that edition can be canonical.

## Related Issue Scopes
- Issues 001-026: core metadata/indexing pipeline and app integration tasks.
- Issues 027-060: requested book/source download, enrichment, and indexing scopes.

## Acceptance
This goal is complete only when all requested selected books have passed download, rich metadata extraction, validation, indexing, and app retrieval checks, or when a scope is explicitly marked blocked with a reason and source evidence.
