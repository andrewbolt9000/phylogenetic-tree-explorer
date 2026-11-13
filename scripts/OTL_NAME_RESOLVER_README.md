# Open Tree of Life Name Resolution Utility

A comprehensive taxonomic auditor for verifying candidate species against Open Tree of Life (OTL) taxonomy using API v3.

## Purpose

This utility validates the candidate species in `data/phyloexplorer_600_animal_master_list.csv` against the Open Tree of Life taxonomy. It performs exact name matching, handles synonyms, detects ambiguous matches, and retrieves full taxonomic information including OTT IDs, ranks, lineages, and source citations.

## Features

- **Exact Name Matching** — First attempts precise name resolution without fuzzy matching
- **Alternate Names** — Retries unmatched entries using alternate search names
- **Approximate Matching** — Falls back to fuzzy matching for persistent failures
- **Comprehensive Caching** — Caches all API responses to disk to avoid redundant requests
- **Match Classification** — Categorizes results as exact, synonym, ambiguous, no-match, or higher-rank
- **Full Lineage Retrieval** — Obtains complete taxonomic lineage for each accepted species
- **Detailed Output** — Produces CSV with all candidates, matches, and resolution metadata
- **Summary Report** — Generates resolution statistics by collection and broad group

## Installation

1. Ensure Python 3.7+ is installed
2. Install required dependencies:

```bash
pip install requests pytest
```

## Usage

### Basic Audit (Recommended)

Run the full audit against the default candidate list:

```bash
python3 scripts/ott_name_resolver.py
```

This will:
- Read from `data/phyloexplorer_600_animal_master_list.csv`
- Write results to `data/phyloexplorer_600_animal_master_list_resolved.csv`
- Save a detailed report to `scripts/ott_resolution_report.txt`
- Log all activity to `scripts/ott_resolution.log`

### Custom Input/Output

Specify different input and output files:

```bash
python3 scripts/ott_name_resolver.py \
  --input data/my_candidates.csv \
  --output data/my_candidates_resolved.csv
```

### Disable Caching

Force fresh API requests without using cached responses:

```bash
python3 scripts/ott_name_resolver.py --no-cache
```

## Input Format

The input CSV must contain these columns:

- `collection` — Collection or dataset name
- `common_name` — Common name of the species
- `candidate_scientific_name` — The scientific name to resolve
- `alternate_search_names` — Alternative names (semicolon-separated) for retry attempts
- `broad_group` — Broad taxonomic group (e.g., Mammalia, Carnivora)
- `phylum_candidate` — Optional phylum designation

Example:

```csv
collection,common_name,candidate_scientific_name,alternate_search_names,broad_group,phylum_candidate
well_known,African lion,Panthera leo,lion; African lion,Mammalia,
well_known,Tiger,Panthera tigris,Bengal tiger; Siberian tiger,Mammalia,
```

## Output Format

The output CSV includes all input columns plus:

- `_row_id` — Stable row identifier for mapping results back to candidates
- `matched_query_name` — Which name was ultimately matched (candidate or alternate)
- `accepted_scientific_name` — OTL-accepted scientific name
- `ott_id` — Open Tree of Life taxonomy ID
- `ott_rank` — Taxonomic rank (species, genus, family, etc.)
- `match_status` — Resolution status:
  - `exact_match` — Exact species match found
  - `synonym` — Matched to accepted name via synonym
  - `ambiguous` — Multiple possible matches; highest-confidence used
  - `no_match` — No match found
  - `higher_rank` — Matched to genus or higher rank, not species
- `match_method` — How the match was achieved:
  - `exact` — Exact matching on candidate name
  - `approximate` — Fuzzy matching
  - `alternate_search` — Match via alternate search names
  - `none` — No match
- `num_matches` — Number of candidate matches found
- `all_candidate_matches` — JSON array of all match details
- `synonyms` — JSON array of known synonyms
- `full_lineage` — JSON array of complete taxonomic lineage
- `taxonomy_version` — OTL data source and version
- `error` — Error message if resolution failed

Example output row:

```csv
_row_id,collection,common_name,candidate_scientific_name,accepted_scientific_name,ott_id,ott_rank,match_status,match_method
row_0,well_known,African lion,Panthera leo,Panthera leo,541927,species,exact_match,exact
row_1,well_known,Tiger,Panthera tigris,Panthera tigris,541928,species,exact_match,exact
```

## Report

After running the audit, a summary report is generated at `scripts/ott_resolution_report.txt`:

```
======================================================================
Open Tree of Life Name Resolution Report
======================================================================
Timestamp: 2024-11-12T22:30:45.123456

OVERALL STATISTICS
----------------------------------------------------------------------
Total candidates:          600
Exact matches:             580
Synonym matches:           12
Alternate name matches:    5
Ambiguous matches:         2
Unmatched:                 1
Higher rank matches:       0

RESULTS BY COLLECTION
----------------------------------------------------------------------
well_known                       300  resolved:  298  unmatched:    2  (99.3%)
diverse_taxa                     300  resolved:  299  unmatched:    1  (99.7%)

RESULTS BY GROUP
----------------------------------------------------------------------
Mammalia                         600  resolved:  599  unmatched:    1  (99.8%)
```

## Caching

API responses are cached to disk in `scripts/.ott_cache/` using SHA256 hashing of the query and parameters. This allows:

- Re-running the script without repeating API requests
- Resuming interrupted audits
- Reducing API load and rate limit issues
- Quick iteration during development

Cached responses are automatically loaded from disk if available. Use `--no-cache` to force fresh requests.

## Testing

Run the test suite:

```bash
python3 -m pytest scripts/test_ott_name_resolver.py -v
```

Tests cover:

- Cache initialization, key generation, memory/disk persistence
- Exact and fuzzy matching API requests
- Match classification logic (exact, synonym, ambiguous, higher-rank, no-match)
- CSV loading with stable row identifiers
- Single and batch resolution workflows
- Statistics tracking by collection and group
- Output CSV generation and format
- Error handling and resilience
- Full end-to-end integration with mocked API

All 21 tests pass.

## Architecture

### OTLCache

Persistent caching layer with memory and disk backends. Generates stable cache keys from query parameters using SHA256 hashing.

### OTLResolver

API client for Open Tree of Life TNRS and taxonomy endpoints. Implements:

- Rate limiting (0.5s between requests)
- Retry logic with exponential backoff
- Request/response caching
- Error handling for timeouts and HTTP errors
- Match classification based on result metadata

### ResolutionAuditor

Main orchestrator that coordinates the audit workflow:

1. Load candidates from CSV with stable row IDs
2. For each candidate:
   - Try exact matching on candidate name
   - If no match, try alternate search names
   - If still no match, try fuzzy matching
3. Classify all results and retrieve full taxon details
4. Track statistics by collection and group
5. Save results to output CSV
6. Generate summary report

## Error Handling

The utility handles:

- HTTP timeouts (default 30s)
- API rate limits (0.5s delay between requests)
- Malformed JSON responses
- Network failures
- Missing or invalid input files
- Encoding issues (UTF-8-sig with fallback)

All errors are logged to `scripts/ott_resolution.log` with timestamps and context.

## Rate Limiting

To respect the Open Tree of Life API's rate limits:

- Default delay: 0.5 seconds between requests
- Caching: Significantly reduces actual request volume
- Batch processing: Multiple names per request when possible
- Fuzzy matching: Limited to 250 names per request (API limit)

## API Documentation

- **Base URL**: `https://api.opentreeoflife.org/v3`
- **Endpoints Used**:
  - `POST /tnrs/match_names` — Name matching
  - `POST /taxonomy/taxon_info` — Taxon details
- **Official Docs**: https://github.com/OpenTreeOfLife/germinator/wiki/TNRS-API-v3

## Limitations and Future Work

### Current Limitations

- Only matches against Open Tree of Life taxonomy (doesn't validate against other sources)
- Cannot verify specimen numbers, collector data, or locality information
- Does not download or cache PhyloPic silhouettes (separate utility)
- Requires internet access for first run; uses cache on subsequent runs

### Future Enhancements

- Parallel batch processing for faster throughput
- Integration with PhyloPic silhouette discovery
- Support for other taxonomic sources (GBIF, Wikidata)
- Interactive review mode for ambiguous matches
- Export formats: JSON, TSV, JSON-LD
- Web dashboard for browsing and filtering results

## Files

- `scripts/ott_name_resolver.py` — Main utility (executable)
- `scripts/test_ott_name_resolver.py` — Comprehensive test suite
- `scripts/.ott_cache/` — API response cache (auto-created)
- `scripts/ott_resolution.log` — Audit log
- `scripts/ott_resolution_report.txt` — Summary report
- `data/phyloexplorer_600_animal_master_list.csv` — Input candidates
- `data/phyloexplorer_600_animal_master_list_resolved.csv` — Output with resolution

## License

Part of the PhyloExplorer project. See the repository LICENSE for details.

## Contributing

To extend this utility:

1. Add tests for new functionality in `test_ott_name_resolver.py`
2. Follow existing conventions for error handling and logging
3. Preserve cache compatibility
4. Document new output columns in the README
5. Run the full test suite before submitting

## Support

For issues or questions:

1. Check the log file: `scripts/ott_resolution.log`
2. Review the report: `scripts/ott_resolution_report.txt`
3. Verify the CSV format matches the input specification
4. Test API connectivity: `curl https://api.opentreeoflife.org/v3/about`
