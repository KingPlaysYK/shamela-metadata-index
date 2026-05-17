# Architecture

## Layers

1. Source catalogue
   - Book id, title, author, author death, edition, publisher, category, source URL.

2. Raw text
   - Original Arabic page text.
   - Optional paragraph/section segmentation.
   - Stable source ids.

3. Baseline metadata
   - Deterministic extraction for definitions, Qur'an references, hadith references, grammar rules, poetry, proverbs, fiqh, aqidah, biography, historical reports, and source references.

4. Enriched metadata
   - AI-assisted claim extraction only when exact Arabic evidence is present.
   - Each claim must include evidence text, claim type, confidence, and citation.

5. Validation
   - Exact substring validation.
   - Citation validation.
   - Claim type validation.
   - Relevance validation for retrieval usage.

6. Indexing
   - Lexical search for exact Arabic terms.
   - Metadata-filtered search by claim type/book/category.
   - Optional vector search for semantic retrieval.
   - Optional graph/hypergraph layer for relationships.

7. App integration
   - Word analysis.
   - PDF footnote options.
   - Source modal.
   - Explain further.

## Retrieval Rule

Generation must never invent sources. If a source is used, the exact evidence must be viewable and citeable.
