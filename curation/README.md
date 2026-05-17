# Download Curation Workspace

This folder is the approval layer between catalogue resolution and large downloads.

A top catalogue candidate is not automatically canonical. Approve or reject candidates here before running download, metadata enrichment, or indexing jobs.

## Approval Status Summary

| Approval status | Count |
|---|---:|
| collection_curation_required | 13 |
| pending_review | 17 |
| blocked | 1 |
| rule | 1 |
| ambiguous | 1 |
| deferred | 1 |

## How To Use

1. Open the relevant `curation/scopes/{id}.json` file.
2. For single works, inspect the candidate's edition, editor, publisher, completeness, and source link.
3. Set `review.canonical_book_id` only when the candidate is accepted.
4. For author or field collections, populate `review.include_book_ids` and `review.exclude_book_ids`.
5. Keep blocked exact-edition requests blocked until the requested edition is acquired or verified.

## Scope Files

| ID | Status | Approval | File |
|---|---|---|---|
| 027 | requires_collection_curation | collection_curation_required | `curation/scopes/027.json` |
| 028 | requires_collection_curation | collection_curation_required | `curation/scopes/028.json` |
| 029 | requires_collection_curation | collection_curation_required | `curation/scopes/029.json` |
| 030 | requires_collection_curation | collection_curation_required | `curation/scopes/030.json` |
| 031 | requires_collection_curation | collection_curation_required | `curation/scopes/031.json` |
| 032 | requires_collection_curation | collection_curation_required | `curation/scopes/032.json` |
| 033 | requires_collection_curation | collection_curation_required | `curation/scopes/033.json` |
| 034 | requires_collection_curation | collection_curation_required | `curation/scopes/034.json` |
| 035 | ready_for_manual_review | pending_review | `curation/scopes/035.json` |
| 036 | requires_collection_curation | collection_curation_required | `curation/scopes/036.json` |
| 037 | ready_for_manual_review | pending_review | `curation/scopes/037.json` |
| 038 | ready_for_manual_review | pending_review | `curation/scopes/038.json` |
| 039 | ready_for_manual_review | pending_review | `curation/scopes/039.json` |
| 040 | ready_for_manual_review | pending_review | `curation/scopes/040.json` |
| 041 | ready_for_manual_review | pending_review | `curation/scopes/041.json` |
| 042 | ready_for_manual_review | pending_review | `curation/scopes/042.json` |
| 043 | requires_collection_curation | collection_curation_required | `curation/scopes/043.json` |
| 044 | requires_collection_curation | collection_curation_required | `curation/scopes/044.json` |
| 045 | ready_for_manual_review | pending_review | `curation/scopes/045.json` |
| 046 | ready_for_manual_review | pending_review | `curation/scopes/046.json` |
| 047 | ready_for_manual_review | pending_review | `curation/scopes/047.json` |
| 048 | ready_for_manual_review | pending_review | `curation/scopes/048.json` |
| 049 | requires_collection_curation | collection_curation_required | `curation/scopes/049.json` |
| 050 | blocked_exact_edition_not_confirmed | blocked | `curation/scopes/050.json` |
| 051 | requires_collection_curation | collection_curation_required | `curation/scopes/051.json` |
| 052 | cross_cutting_metadata_rule | rule | `curation/scopes/052.json` |
| 053 | ready_for_manual_review | pending_review | `curation/scopes/053.json` |
| 054 | ready_for_manual_review | pending_review | `curation/scopes/054.json` |
| 055 | ready_for_manual_review | pending_review | `curation/scopes/055.json` |
| 056 | ready_for_manual_review | pending_review | `curation/scopes/056.json` |
| 057 | ready_for_manual_review | pending_review | `curation/scopes/057.json` |
| 058 | ambiguous_candidate | ambiguous | `curation/scopes/058.json` |
| 059 | ready_for_manual_review | pending_review | `curation/scopes/059.json` |
| 060 | deferred_final_stage_review | deferred | `curation/scopes/060.json` |
