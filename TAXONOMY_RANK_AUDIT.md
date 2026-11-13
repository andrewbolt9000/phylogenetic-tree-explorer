# Taxonomy Rank Audit Report

## Executive Summary

**Critical Issue**: The taxonomy rank schema uses a hardcoded enum that is **INCOMPATIBLE** with the 30 ranks returned by the Open Tree of Life API for our 597 eligible animal taxa.

- **Schema enum has 14 ranks** (old, pre-OTL)
- **OTL API returned 30 ranks** (real data from our dataset)
- **9 new ranks not in schema**: `cohort`, `infraclass`, `infraorder`, `no rank`, `parvorder`, `section`, `species group`, `species subgroup`, `subcohort`, `subsection`
- **Impact**: Any attempt to load OTL-derived taxonomy data will **fail schema validation**

---

## Ranks in Schema vs. Reality

### Current Schema (hardcoded enum)
**File**: `data/schemas/taxonomy.schema.json` line 49-50

```json
"rank": {
  "type": "string",
  "enum": ["domain", "kingdom", "phylum", "class", "order", "family", "subfamily", "tribe", "subtribe", "superfamily", "genus", "subgenus", "species", "subspecies"]
}
```

**Total: 14 ranks**

### OTL API Returned Ranks (from 597 animal taxa)
Ordered by frequency (approximate):
```
- species (most common - hundreds)
- genus
- family
- order
- suborder
- class
- subclass
- superfamily
- subfamily
- tribe
- phylum
- kingdom
- domain
- infraorder
- subphylum
- infraclass
- superorder
- no rank
- superclass
- section
- subspecies
- parvorder
- species group
- subsection
- subcohort
- cohort
- species subgroup
- subtribe
```

**Total: 30 unique ranks**

### Missing from Schema (9 new ranks)
1. `cohort` - optional grouping between order and infraorder
2. `infraclass` - subdivision of class
3. `infraorder` - subdivision of suborder
4. `no rank` - used by OTL for nodes without formal rank
5. `parvorder` - fine-grained order subdivision
6. `section` - subdivision below genus
7. `species group` - grouping of closely related species
8. `species subgroup` - subdivision of species group
9. `subcohort` - subdivision of cohort

---

## Files Requiring Changes

### 1. **Schema Definition** (BLOCKING)
**File**: `data/schemas/taxonomy.schema.json`

**Lines**: 49-50 (rank enum definition)

**Change Required**: 
- Expand enum to include all 30 ranks
- OR change to `"type": "string"` without enum (permissive)

**Impact**: Without this, schema validation will reject OTL data

**Current Code**:
```json
"rank": {
  "type": "string",
  "enum": ["domain", "kingdom", "phylum", "class", "order", "family", "subfamily", "tribe", "subtribe", "superfamily", "genus", "subgenus", "species", "subspecies"],
  "description": "Taxonomic rank."
}
```

---

### 2. **OTL Name Resolver** (RANK FILTERING)
**File**: `scripts/ott_name_resolver.py`

**Lines**: 212-215 (rank filtering logic)

**Current Logic**:
```python
# Check if this is a higher rank (not species)
rank = match.get('taxon', {}).get('rank', '').lower()
if rank and rank not in ['species', 'subspecies']:
    return ('higher_rank', 'exact')
```

**Issue**: 
- Assumes only `species` and `subspecies` are "low rank"
- All other 28 ranks are treated as "higher_rank"
- This classification is problematic for:
  - `no rank` nodes (should not auto-classify)
  - `species group` / `species subgroup` (are these "higher" than species?)
  - Intermediate taxa like `infraorder`, `parvorder` (are these definitively "higher"?)

**Also Line 330**: 
```python
m.get('taxon', {}).get('rank') == 'species'
```
Hardcodes species filtering, misses subspecies matches

**Impact**: 
- Non-species matches classified as "higher_rank" without nuance
- May incorrectly reject valid candidates
- Cannot distinguish between 28 different non-species ranks

**Required Changes**:
1. Decide: what counts as "higher rank" in your domain?
   - Option A: Only `species` and `subspecies` are low-rank
   - Option B: Terminal candidates should match rank, not be forced to species
   - Option C: Accept any rank from OTL, let user review
2. Update filtering logic accordingly
3. May need separate rank hierarchy awareness

---

### 3. **Test Fixtures** (DATA COMPATIBILITY)
**File**: `data/test-fixtures/taxonomy-fixture.json`

**Lines**: All rank values

**Current Ranks Used**:
```
kingdom, phylum, class, order, superfamily, family, genus, species
```

**Issue**: 
- Uses only 8 ranks from schema
- No test coverage for new 22 ranks
- No test for `no rank`

**Required Changes**:
1. Add test cases with all 30 ranks
2. Add specific tests for edge cases:
   - `no rank` nodes
   - `species group` classification
   - `infraorder`, `parvorder` intermediate ranks

---

### 4. **Test Suite** (OTL RANK COVERAGE)
**Files**: 
- `scripts/test_ott_name_resolver.py` (line 153-163)
- Any rank-specific filtering tests

**Current Coverage**:
- Single test: `test_classify_match_higher_rank()` 
- Only tests `genus` as non-species rank
- No coverage for:
  - `no rank`
  - `species group` / `species subgroup`
  - Intermediate ranks (`infraorder`, `parvorder`, etc.)
  - Rank filtering ambiguities

**Required Changes**:
1. Add tests for each OTL-returned rank
2. Add tests for rank classification edge cases
3. Verify filtering logic handles all 30 ranks correctly

---

### 5. **OTL Resolver Output** (DOCUMENTATION)
**File**: `scripts/OTL_NAME_RESOLVER_README.md`

**Section**: Output field documentation

**Issue**: 
- Documents `ott_rank` field
- Shows only common ranks in examples
- No guidance on handling `no rank` or unusual ranks

**Required Changes**:
1. Document all 30 possible rank values
2. Explain handling of `no rank` nodes
3. Clarify rank hierarchy assumptions (if any)

---

### 6. **PhyloPic Resolver** (RANK INFERENCE)
**File**: `scripts/phylopic_image_resolver.py`

**Lines**: 372, 436, 471-473 (rank extraction and reporting)

**Current Logic**:
```python
# Extract rank if available
# ... 
rank = result.get('phylopic_matched_node_rank', 'unknown')
if rank not in self.stats['by_rank']:
    self.stats['by_rank'][rank] = 0
self.stats['by_rank'][rank] += 1
```

**Issue**:
- Attempts to extract rank from PhyloPic nodes (not OTL)
- PhyloPic node rank may differ from OTL rank
- Currently hardcoded to 'unknown' as fallback
- No validation of extracted ranks against known values

**Required Changes**:
1. Decide: should PhyloPic node rank override OTL rank?
2. If extracting rank, validate against known ranks
3. Document rank inference strategy in resolver
4. May need rank hierarchy awareness for lineage matching

---

### 7. **Documentation** (POLICY ALIGNMENT)
**Files**:
- `docs/DATA_POLICY.md` (section 2.3 on hierarchy)
- `docs/ARCHITECTURE.md` (taxonomic roster example)
- `docs/PROJECT_SPEC.md` (if rank discussion exists)

**Issues**:
- References "Linnaean hierarchy" but uses only 14 ranks
- Examples show `kingdom`, `phylum`, `class`, `order`, `family`, `genus`, `species`
- No mention of 16 additional ranks
- No guidance on handling `no rank` nodes
- No mention of non-Linnaean ranks like `cohort`, `parvorder`, `section`

**Required Changes**:
1. Update examples to include real OTL ranks
2. Document that OTL uses extended rank set beyond Linnaean
3. Explain handling of `no rank`
4. Clarify rank hierarchy assumptions
5. Add note about rank-agnostic filtering where possible

---

## Code Patterns and Assumptions

### Pattern 1: Rank Equality Checks
**Locations**:
- `ott_name_resolver.py:214` - `rank not in ['species', 'subspecies']`
- `ott_name_resolver.py:330` - `rank == 'species'`

**Issue**: Hardcoded rank values assume fixed set

**Risk**: New ranks cause unexpected behavior

---

### Pattern 2: Rank Enum Validation
**Location**: `taxonomy.schema.json:49-50`

**Issue**: Enum is restrictive but incomplete

**Risk**: Any OTL data with new ranks fails validation before processing

---

### Pattern 3: Rank Hierarchy Assumptions
**Location**: `docs/DATA_POLICY.md:110`

```
"A taxonomic parent represents the next higher rank in the Linnaean hierarchy 
(e.g., species → genus → family → order)."
```

**Issue**: Assumes strict Linnaean order; OTL has non-Linnaean ranks

**Risk**: Code may assume parent rank > child rank; will fail with `section` < `genus`

---

### Pattern 4: "Higher Rank" Classification
**Location**: `ott_name_resolver.py:212-215`

**Issue**: Binary classification (species vs. higher_rank) is imprecise

**Ranks affected**:
- `subspecies` (lower than species)
- `species group`, `species subgroup` (related to species)
- `no rank` (unknown relative position)

---

## Edge Cases and Ambiguities

### 1. `no rank` Nodes
- **Prevalence**: Present in OTL data from our 597 taxa
- **Question**: How should these be treated?
  - As missing data?
  - As functionally equal to parent rank?
  - As unknown/to-be-reviewed?
- **Current Handling**: Unknown (needs audit in resolver)

### 2. `species group` and `species subgroup`
- **Question**: Are these below species (subspecies-like) or above?
- **OTL interpretation**: Groups of closely related species
- **Implication**: May be above species in rank hierarchy
- **Current Code Assumption**: Treat as "higher_rank" (line 214)
- **Risk**: May misclassify matches

### 3. Non-Linnaean Ranks
**Ranks outside traditional hierarchy**:
- `cohort`, `subcohort` - mammal-specific groupings
- `section`, `subsection` - botanical-ish but used in zoology
- `parvorder`, `infraorder` - mammal systematics refinements

**Question**: Where in hierarchy do these sit?
- Between `order` and `family`?
- Between `suborder` and `infraorder`?

**Current Assumption**: None (code doesn't distinguish)

**Risk**: If code assumes strict hierarchy, will break

---

## Questions for Project Requirements

### Q1: Rank Hierarchy
Should the system maintain knowledge of rank ordering?
- **Option A**: Yes - implement rank hierarchy for validation/filtering
- **Option B**: No - treat ranks as labels, don't assume order
- **Option C**: Partial - only validate known hierarchies (Linnaean core)

### Q2: Higher Rank Definition
How should "higher rank" be determined?
- **Option A**: Anything not species/subspecies (current)
- **Option B**: Use rank hierarchy if available
- **Option C**: Don't auto-classify; always require review
- **Option D**: Rank-aware: different thresholds for different contexts

### Q3: `no rank` Handling
How to handle OTL's `no rank` nodes?
- **Option A**: Reject them (validation failure)
- **Option B**: Accept them; treat as unknowns
- **Option C**: Try to infer rank from lineage
- **Option D**: Accept and flag for manual review

### Q4: Schema Flexibility
Should taxonomy schema allow any rank string?
- **Option A**: Keep enum (restrictive, needs maintenance)
- **Option B**: Allow any string (permissive, less validation)
- **Option C**: Enum + optional whitelist for new ranks
- **Option D**: Separate schema for OTL data vs. curated taxonomy

---

## Summary of Changes Required

| File | Lines | Change | Severity |
|------|-------|--------|----------|
| `data/schemas/taxonomy.schema.json` | 49-50 | Expand rank enum to 30 values or switch to string | **BLOCKING** |
| `scripts/ott_name_resolver.py` | 212-215 | Revise "higher_rank" classification logic | HIGH |
| `scripts/ott_name_resolver.py` | 330 | Handle rank filtering for all 30 ranks | HIGH |
| `data/test-fixtures/taxonomy-fixture.json` | All ranks | Add test cases with all 30 ranks | MEDIUM |
| `scripts/test_ott_name_resolver.py` | rank tests | Expand test coverage for all ranks | MEDIUM |
| `scripts/OTL_NAME_RESOLVER_README.md` | rank section | Document all 30 ranks and edge cases | MEDIUM |
| `scripts/phylopic_image_resolver.py` | 372, 436 | Verify rank extraction, handle new ranks | MEDIUM |
| `docs/DATA_POLICY.md` | 2.3 | Update rank discussion with OTL reality | LOW |
| `docs/ARCHITECTURE.md` | examples | Update examples with extended rank set | LOW |

---

## Recommended Action Plan

### Phase 1 (Immediate - Blocking)
1. Update `taxonomy.schema.json` to accept all 30 ranks
2. Update OTL resolver filtering logic to handle all ranks
3. Add comprehensive test coverage

### Phase 2 (Near-term)
1. Update documentation to reflect 30-rank reality
2. Implement rank hierarchy awareness (if needed)
3. Add edge case handling (`no rank`, `species group`)

### Phase 3 (Future)
1. Consider rank-aware filtering for advanced features
2. Implement rank hierarchy validation if needed
3. Enhanced UI for rank-aware taxonomy browsing

