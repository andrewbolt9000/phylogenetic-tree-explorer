# PhyloPic Image UUID Resolver

Finds PhyloPic silhouette images for animals using their resolved Open Tree of Life (OTT) identifiers and taxonomic lineages.

**Purpose:** Automate the first pass of image discovery for the 600-animal master list, producing a CSV mapping each animal to a PhyloPic image UUID and comprehensive metadata, while distinguishing exact species matches from inherited ancestor images.

## Overview

This utility:

1. Reads the Open Tree of Life resolution results (`phyloexplorer_600_animal_master_list_resolved.csv`)
2. Loads the original master list to preserve manual UUID overrides
3. For each animal, submits its OTT ID and lineage to the PhyloPic API
4. Extracts the resolved node UUID and primary image UUID
5. Determines if the match is an exact species or ancestor image
6. Preserves manual UUIDs from the original list (takes precedence over automatic)
7. Generates a detailed CSV with image metadata, statistics, and resolution status
8. Creates a summary report of results by collection and taxonomic group

## API Workflow

### PhyloPic API v2

**Base URL:** `https://api.phylopic.org`

**Build Detection:** The resolver automatically detects the current PhyloPic build number (currently 562) from API responses and includes it in all subsequent requests.

### Taxonomic Matching Process

1. **Build OTT Lineage:** The animal's own OTT ID is included first, followed by ancestor OTT IDs in order from least inclusive (animal) to most inclusive (kingdom)

2. **Submit to Resolve Endpoint:**
   ```
   GET /resolve/opentreeoflife.org/taxonomy?objectIDs=<ott_id>,<ancestor_1>,...,<ancestor_n>&build=<build>
   ```
   PhyloPic resolves to the closest taxonomic match available.

3. **Extract Node UUID:** The response contains the resolved node's UUID in the `uuid` field.

4. **Retrieve Node Details:**
   ```
   GET /nodes/<node_uuid>?embed_primaryImage=true&build=<build>
   ```
   This retrieves the node's detailed information including its primary image.

5. **Extract Image and Metadata:**
   - Image UUID: from `_embedded.primaryImage.uuid`
   - License: from `_embedded.primaryImage._links.license.href`
   - Contributor: from `_embedded.primaryImage.attribution`
   - Other metadata as available

### Exact vs Inherited Matches

- **Exact Species Match:** lineage distance = 0 (the node represents the exact species)
- **Inherited Ancestor Match:** lineage distance > 0 (the node represents a genus, family, order, etc., and the image is inherited from that ancestor)

The match type helps distinguish between silhouettes that directly illustrate the species and those that show a related ancestor's form.

## Lineage Ordering

**Critical:** The `full_lineage` JSON field from the OTT resolved CSV must be parsed and linearized correctly:

```json
{
  "full_lineage": "[
    {\"name\": \"Panthera\", \"rank\": \"genus\", \"ott_id\": 125641},
    {\"name\": \"Felidae\", \"rank\": \"family\", \"ott_id\": 125642},
    ...
  ]"
}
```

The resolver constructs the lineage as:
```
[animal_ott_id, ancestor_ott_id_1, ancestor_ott_id_2, ...]
```

This ordering (least to most inclusive) ensures PhyloPic resolves to the most specific available match.

## Output CSV Format

**File:** `data/phyloexplorer_600_animal_master_list_phylopic.csv`

### Fields

| Field | Description |
|-------|-------------|
| `_row_id` | Stable identifier mapping to original row (row_0, row_1, ...) |
| `collection` | Collection name from original master list |
| `common_name` | Common name of animal |
| `accepted_scientific_name` | Scientific name from OTT resolution |
| `ott_id` | Open Tree of Life taxon ID |
| `ott_rank` | OTT taxonomic rank (species, genus, etc.) |
| `match_status` | OTT resolution status (exact, synonym, etc.) |
| `phylopic_node_uuid` | UUID of matched PhyloPic node |
| `phylopic_image_uuid` | UUID of primary image (if available) |
| `manual_phylopic_image_uuid` | Manual UUID from original master list (preserved exactly) |
| `effective_phylopic_image_uuid` | Image UUID to use: manual if present, else automatic |
| `phylopic_match_status` | Image resolution status (see below) |
| `phylopic_matched_node_name` | Display name of matched PhyloPic node |
| `phylopic_matched_node_rank` | Taxonomic rank of matched node (if available) |
| `phylopic_match_type` | `exact_species` or `ancestor` |
| `phylopic_lineage_distance` | Steps from requested taxon to matched node (0 = exact) |
| `phylopic_license` | License URL for primary image |
| `phylopic_contributor` | Image contributor attribution |
| `phylopic_image_url` | URL to PhyloPic image page (if available) |
| `phylopic_error` | Error message if resolution failed |

### Match Status Values

| Status | Meaning |
|--------|---------|
| `image_match` | Successfully resolved to image UUID |
| `node_without_image` | PhyloPic node found but no primary image available |
| `no_match` | No PhyloPic node corresponds to OTT lineage |
| `no_ott_id` | Animal has no OTT ID (cannot resolve) |
| `api_error` | API error during resolution attempt |

## Manual UUID Override Behavior

The original master list contains a `manual_phylopic_image_uuid` column. This column is preserved exactly in the output.

**Effective UUID Logic:**
- If `manual_phylopic_image_uuid` is present and non-empty, use it as `effective_phylopic_image_uuid`
- Otherwise, use `phylopic_image_uuid` (from automatic resolution)

This allows manual curation to override automatic matches while preserving the audit trail showing both manual and automatic values.

## Caching

The resolver uses transparent persistent caching:

- **Cache Location:** `scripts/.phylopic_cache/` (disk) + memory cache
- **Cache Key:** SHA256 hash of endpoint + parameters
- **Persistence:** Cache survives across runs
- **Memory Cache:** Faster access for repeated requests within same run

To disable caching and force fresh API requests:
```bash
python3 scripts/phylopic_image_resolver.py --no-cache
```

## Rate Limiting and Retries

- **Rate Limit:** 0.5 seconds between API requests (prevents overwhelming PhyloPic servers)
- **Timeout:** 30 seconds per request
- **Retries:** Transient failures (timeouts) retry automatically with backoff
- **Failed Requests:** Failures are logged but not cached; next run can retry

## Error Handling

The resolver handles errors gracefully:

- **Missing OTT ID:** Recorded as `no_ott_id` status, no API call made
- **Malformed Lineage JSON:** Logged, lineage skipped, ancestor search not performed
- **API Timeouts:** Logged and retried; counts as `api_error` after max retries
- **HTTP Errors:** Logged with response code and text
- **Malformed JSON Response:** Logged as parse error
- **Missing Image Fields:** Recorded as `node_without_image`, not treated as failure

All 600 original animals are preserved in output, even if resolution fails. This ensures no data loss.

## Statistics and Reporting

After resolution, the utility generates:

**File:** `scripts/phylopic_resolution_report.txt`

**Contents:**
- Total animals processed
- Count of exact species matches
- Count of ancestor/inherited matches
- Count of nodes found without images
- Count of no matching PhyloPic node
- Count of missing OTT IDs
- Count of API errors
- Results grouped by collection
- Results grouped by broad taxonomic group
- Counts by matched node rank

## Usage

### Basic Resolution

Resolve all 600 animals using the OTT resolved CSV:

```bash
python3 scripts/phylopic_image_resolver.py
```

This uses default paths:
- Input (resolved): `data/phyloexplorer_600_animal_master_list_resolved.csv`
- Input (original): `data/phyloexplorer_600_animal_master_list.csv`
- Output: `data/phyloexplorer_600_animal_master_list_phylopic.csv`

### Custom Input/Output

```bash
python3 scripts/phylopic_image_resolver.py \
  --resolved data/custom_resolved.csv \
  --original data/custom_original.csv \
  --output data/custom_phylopic.csv
```

### Disable Caching

```bash
python3 scripts/phylopic_image_resolver.py --no-cache
```

This forces fresh API requests and overwrites cache with new results.

### Expected Runtime

- **First run:** ~5 minutes (600 API calls with rate limiting)
- **Subsequent runs with cache:** ~30 seconds (only unmatched or error cases retry)

## Testing

Run the comprehensive test suite (no live API calls required):

```bash
python3 -m pytest scripts/test_phylopic_image_resolver.py -v
```

**Test Coverage:**
- Cache persistence and key generation
- API build detection and redirect handling
- OTT lineage ordering and inclusion
- Node UUID extraction
- Primary image extraction and metadata
- Exact vs ancestor classification
- Missing primary image handling
- No matching node handling
- Missing OTT ID handling
- Malformed API responses
- CSV loading and merging
- Preservation of manual UUIDs
- Statistics tracking

All tests use mocked HTTP responses; no internet access required.

## Logging

The resolver generates detailed logs:

**File:** `scripts/phylopic_resolution.log`

**Log Levels:**
- `INFO`: Progress milestones, build detection, API requests (cached or fresh)
- `WARNING`: API errors, malformed JSON, cache write failures
- `ERROR`: Missing input files, fatal errors

Logs are printed to console and written to file simultaneously.

## Limitations

1. **Image Availability:** Not all PhyloPic nodes have primary images. For nodes with images available elsewhere in the database, this resolver uses the primary image only. Secondary images must be manually curated.

2. **Rank Information:** The API response may not always include the exact taxonomic rank of the matched node. When unavailable, the field is left empty in the output.

3. **API Build Changes:** If PhyloPic releases a new build during resolution, the resolver detects it and updates automatically. Cached responses from older builds may become stale; use `--no-cache` to refresh.

4. **Lineage Distances:** Currently, lineage distance is set to 0 for all matches. A future enhancement would compute the actual distance by comparing the matched node's rank to the requested taxon's rank.

5. **Image URLs:** The resolver extracts license URIs but not the direct image URLs. Future enhancement could extract raster/vector file URLs from the image object.

## Dependencies

- Python 3.8+
- `requests` library (for HTTP requests)
- Standard library: `json`, `csv`, `pathlib`, `hashlib`, `datetime`, `logging`

Install requests:
```bash
pip install requests
```

## Architecture

The resolver consists of three main classes:

### PhyloPicCache

Handles persistent response caching with SHA256-keyed storage.

**Methods:**
- `get(endpoint, params)` — Retrieve cached response
- `set(endpoint, params, response)` — Cache response to disk and memory

### PhyloPicResolver

Interacts with PhyloPic API v2.

**Methods:**
- `_detect_build()` — Detect current build number
- `_rate_limit()` — Enforce inter-request delays
- `_api_request(endpoint, params)` — Execute request with caching
- `resolve_ott_lineage(ott_ids)` — Resolve OTT lineage to PhyloPic node
- `get_node_details(node_uuid, embed_image)` — Retrieve node information
- `get_image_details(image_uuid)` — Retrieve image metadata

### ImageResolutionAuditor

Orchestrates the full resolution workflow.

**Methods:**
- `load_original_csv(csv_path)` — Load original master list
- `load_resolved_csv(csv_path)` — Load OTT resolution results
- `parse_lineage_json(lineage_json)` — Parse full_lineage field
- `resolve_candidate_image(candidate)` — Resolve single animal to image
- `merge_with_original(results, original_data)` — Merge and preserve manual UUIDs
- `save_results(results, csv_path)` — Write output CSV
- `generate_report()` — Generate statistics report
- `audit(...)` — Execute full workflow

## Future Enhancements

1. **Lineage Distance Calculation:** Compute actual distance based on node rank vs requested taxon rank
2. **Image URL Extraction:** Extract direct raster/vector file URLs for embedding
3. **Batch Image Validation:** Verify image UUIDs with direct HTTP requests
4. **PhyloPic Image Comparison:** Support matching alternative (non-primary) images when primary is unavailable
5. **Contributor Contact:** Extract and catalog contributor information for attribution
6. **License Verification:** Validate license compatibility with project distribution

## References

- PhyloPic API Documentation: https://api-docs.phylopic.org/
- PhyloPic API Recipes: https://www.phylopic.org/articles/api-recipes
- Open Tree of Life API: https://github.com/OpenTreeOfLife/germinator/wiki/TNRS-API-v3
- CSV Input Format: See `data/phyloexplorer_600_animal_master_list_resolved.csv`

## License and Attribution

This resolver is part of PhyloExplorer. PhyloPic images are subject to their respective contributor licenses. The resolver preserves license information in output for attribution compliance.

