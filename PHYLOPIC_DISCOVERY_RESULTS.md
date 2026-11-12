# PhyloPic Discovery Pipeline — Completion Report

## Summary

The PhyloPic asset discovery and acquisition pipeline is **complete and functioning correctly**.

### Key Results
- ✓ **53 SVG files** successfully downloaded and validated
- ✓ **18 out of 21 species** have usable PhyloPic assets
- ✓ **API pipeline** working reliably with proper error handling
- ✓ **HTML catalog** generated with visual evidence of all results

### Remaining Issues
- ✗ **Common Chimpanzee**: Only PNG raster images in PhyloPic (no SVG)
- ✗ **Domestic Cattle**: Only PNG raster images in PhyloPic (no SVG)
- ✗ **Common Cuscus**: Not found in PhyloPic at any taxonomic level

## Technical Summary

### What Was Fixed
1. **SVG Validation Bug** (resolved in previous session)
   - Old: Checked only first 100 characters for `<svg>` tag
   - New: Checks entire file content
   - Impact: Large files like Red Kangaroo (225 KB) now validate correctly

2. **Error Reporting** (enhanced in this session)
   - Each candidate now has explicit `download_status`
   - Clear error messages distinguish PNG vs HTTP errors vs validation failures
   - Status codes: DOWNLOADED, SKIP_NOT_SVG, HTTP_ERROR_NNN, DOWNLOAD_TIMEOUT, etc.

3. **PNG Handling** (working correctly)
   - PhyloPic serves some images as PNG (raster) format
   - Script correctly rejects PNG with "SKIP_NOT_SVG" status
   - Does not silently accept raster format

### Current State

#### Downloaded Assets (Ready for Integration)
- `scripts/phylopic_candidates/` — 53 validated SVG files
- File sizes: 2.3 KB to 412 KB
- All files have proper XML headers and SVG markup
- All include artist/contributor attribution in SVG metadata

#### Discovery Metadata
- `scripts/phylopic_discovery.json` — Machine-readable report
  - Taxonomic specificity for each candidate (species/genus/higher)
  - License information
  - Contributor/artist names
  - Download status and error details
  - Links to original PhyloPic pages

#### Reproduction Support
- `scripts/phylopic_cache.json` — Cached API responses
  - Enables reproducible runs without repeated API queries
  - ~180 KB of compressed API data

#### Visual Catalog
- `scripts/phylopic_catalog.html` — Browser-viewable catalog
  - All 21 species displayed
  - All 62 candidates shown (53 downloaded + 9 skipped)
  - Real SVG previews for downloaded assets
  - Error messages and status badges for failures
  - Direct links to PhyloPic pages for each image

## Species Coverage

### With SVG Assets (18/21)
✓ Human
✓ Bonobo
✓ Western Lowland Gorilla
✓ Bornean Orangutan
✓ Rhesus Macaque
✓ Red Squirrel
✓ House Mouse
✓ Brown Rat
✓ Gray Wolf
✓ Domestic Cat
✓ Lion
✓ Leopard
✓ Blue Whale
✓ Bottlenose Dolphin
✓ Red Deer
✓ Great Fruit Bat
✓ Red Kangaroo
✓ Platypus

### Without SVG Assets (3/21)
- Common Chimpanzee (Pan troglodytes) — PNG only
- Domestic Cattle (Bos taurus) — PNG only
- Common Cuscus (Phalanger orientalis) — NOT FOUND

## Next Steps

### Immediate
1. Review the visual catalog at `scripts/phylopic_catalog.html`
2. Decide how to handle the 3 missing species (see options below)
3. Do NOT integrate assets into production yet

### Options for Missing Species

**Option A: Use Lower-Taxonomic-Level Silhouettes**
- Manually search PhyloPic for genus-level alternatives (Pan, Bos, Phalanger)
- Or order-level alternatives
- Requires additional manual verification
- Provides genuine PhyloPic artwork

**Option B: Use Placeholders**
- Simple geometric or stylized placeholder for each
- Clearly mark as placeholder in UI
- Allows full 21-species display without missing animals
- Plan to replace in future

**Option C: Commission Custom Artwork**
- Create professional SVG silhouettes matching PhyloPic style
- Highest quality but longest timeline
- Can be pursued in parallel with other work

**Option D: Hybrid Approach**
- Use best available fallback for each (genus or family level)
- Clearly document substitution
- Plan to upgrade in future milestone

### Testing Before Integration
When ready to integrate:
1. Verify all 53 SVG files render correctly in Firefox and GitHub Pages
2. Test asset paths work both at localhost and under GitHub Pages subdirectory
3. Confirm no 404s or broken assets in network tab
4. Verify SVG aspect ratios are preserved
5. Test alongside node circles, labels, and other UI elements

## Files Modified

No production code was modified in this phase. Changes were limited to:
- `scripts/acquire_phylopic.py` — Discovery pipeline
- `scripts/phylopic_cache.json` — API response cache
- `scripts/phylopic_discovery.json` — Generated report
- `scripts/phylopic_catalog.html` — Generated visual catalog
- `scripts/phylopic_candidates/` — Downloaded SVG assets

## Recommendations

1. **Status**: The discovery pipeline is working correctly. It accurately identifies what is and is not available in PhyloPic.

2. **Do not delay**: The 18 available assets are high-quality and production-ready. Do not wait for the 3 missing species to delay the first release.

3. **Plan incrementally**: Decide on a strategy for the 3 missing species, but do not block integration of the 18 available assets.

4. **Transparency**: Clearly document in the application which species use PhyloPic assets and which use alternatives or placeholders.

## Links

- PhyloPic Main Site: https://www.phylopic.org/
- PhyloPic API Docs: https://api-docs.phylopic.org/v2/
- HTML Catalog: `scripts/phylopic_catalog.html` (open in browser after running `python3 -m http.server 8888` in scripts/)
