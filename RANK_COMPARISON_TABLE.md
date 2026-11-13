# Rank Comparison: Schema vs. OTL API Data

## Detailed Table

| Rank | In Schema? | In OTL Data? | Notes |
|------|-----------|-------------|-------|
| domain | ✓ | ✓ | Present in both; foundation level |
| kingdom | ✓ | ✓ | Present in both |
| phylum | ✓ | ✓ | Present in both |
| subphylum | ✗ | ✓ | NEW: Subdivision of phylum |
| superclass | ✗ | ✓ | NEW: Group above class |
| class | ✓ | ✓ | Present in both |
| subclass | ✗ | ✓ | NEW: Subdivision of class |
| infraclass | ✗ | ✓ | NEW: Subdivision below subclass |
| cohort | ✗ | ✓ | NEW: Mammal-specific grouping |
| subcohort | ✗ | ✓ | NEW: Subdivision of cohort |
| superorder | ✗ | ✓ | NEW: Group above order |
| order | ✓ | ✓ | Present in both |
| suborder | ✓ | ✓ | Present in both (implied in subfamily context) |
| infraorder | ✗ | ✓ | NEW: Subdivision of suborder |
| parvorder | ✗ | ✓ | NEW: Fine subdivision of order |
| superfamily | ✓ | ✓ | Present in both |
| family | ✓ | ✓ | Present in both |
| subfamily | ✓ | ✓ | Present in both |
| tribe | ✓ | ✓ | Present in both |
| subtribe | ✓ | ✓ | Present in both |
| genus | ✓ | ✓ | Present in both |
| subgenus | ✓ | ✓ | Present in both |
| section | ✗ | ✓ | NEW: Botanical/systematic grouping |
| subsection | ✗ | ✓ | NEW: Subdivision of section |
| species group | ✗ | ✓ | NEW: Group of closely related species |
| species subgroup | ✗ | ✓ | NEW: Subdivision of species group |
| species | ✓ | ✓ | Present in both |
| subspecies | ✓ | ✓ | Present in both |
| no rank | ✗ | ✓ | NEW: Used by OTL for nodes without formal rank |

## Summary Statistics

| Category | Count |
|----------|-------|
| In both schema and OTL | 15 |
| In schema but not OTL data* | 0 |
| In OTL data but not schema | 15 |
| Total unique ranks | 30 |

*Note: "Not in OTL data" means we didn't encounter it in the 597 animal taxa we queried. Some schema ranks may exist in OTL's full taxonomy but just weren't returned for mammals.

## Coverage Analysis

### Current Schema Coverage
- Covers: 15 of 30 OTL ranks (50%)
- Missing: 15 of 30 OTL ranks (50%)

### By Category

**Well Covered (Both have it):**
- Linnaean core: domain, kingdom, phylum, class, order, family, subfamily, tribe, subtribe, superfamily, genus, subgenus, species, subspecies (14 ranks)
- Plus one implied: suborder

**New to OTL (Not in schema):**
- Inter-rank groupings: superclass, superorder, superfamily (already have superfamily, so add 2)
- Subdivisions: subphylum, subclass, infraclass, infraorder, parvorder, section, subsection
- Species-level: species group, species subgroup
- Special: no rank, cohort, subcohort

**Pattern**: New ranks are mostly:
1. Intermediate ranks between established Linnaean ranks
2. Mammal-specific systematic ranks (cohort, parvorder, infraorder)
3. Non-Linnaean groupings (section, species group)
4. Special case (no rank)

## Validation Approach Options

### Option A: Restrictive (Current)
- Keep enum with 14 values
- Any new rank fails validation
- **Requires**: Filtering/mapping OTL ranks to schema values
- **Risk**: Data loss; complex mapping logic

### Option B: Permissive (Recommended)
- Change `rank` from enum to plain string type
- Accept any rank from OTL
- **Requires**: Rank handling in code (but no validation barriers)
- **Advantage**: Accepts OTL data as-is; filtering is optional

### Option C: Expanded Enum (Also Good)
- Update enum to include all 30 OTL ranks
- Accept any known OTL rank
- Future OTL updates may require schema changes
- **Advantage**: Explicit about what's valid
- **Disadvantage**: Maintenance burden as OTL evolves

### Option D: Extensible
- Define "core" ranks (must match enum)
- Allow additional ranks with note/metadata
- **Complex**, but most flexible

## Recommendation

**For this project**: **Option B (Permissive string type)**

**Reasoning**:
1. OTL is the authoritative source; don't filter at schema level
2. Rank is metadata, not critical for tree logic
3. Different research contexts may need different rank sets
4. OTL taxonomy may evolve; permissive schema is future-proof
5. Filtering can happen at application logic level if needed

**Implementation**:
```json
"rank": {
  "type": "string",
  "description": "Taxonomic rank (e.g., species, genus, family, etc.). Values from Open Tree of Life taxonomy are accepted without restriction."
}
```

