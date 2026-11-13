# Taxonomy Rank Support Implementation - Completion Report

## Summary

Successfully implemented comprehensive support for all 28 Open Tree of Life (OTL) ranked taxonomic ranks plus `no rank`, enabling the application to validate and process the complete OTL taxonomy without errors.

**Implementation scope:**
- Schema updated to accept any rank string (permissive design)
- Rank hierarchy utility created with ordered rank knowledge base
- Comprehensive test fixtures and test suites added
- All 563 tests passing

## Files Created

### 1. Rank Hierarchy Utility
- **`src/taxonomy/rankHierarchy.js`** (97 lines)
  - Exports LINNAEAN_HIERARCHY array with 28 ranked OTL ranks in order
  - Exports RANK_INDEX object for fast lookups
  - Provides `isRankHigher(rank1, rank2)` for hierarchy comparisons
  - Provides `getRankLevel(rank)` for position lookups
  - Provides `isRanked(rank)` to check if rank is in known hierarchy
  - Provides `getAllRanks()` to get full ordered rank list
  - Treats `no rank` as valid but not ranked (returns null from lookup functions)

### 2. Test Suites
- **`src/taxonomy/rankHierarchy.test.js`** (206 lines)
  - 21 test cases covering all rank hierarchy APIs
  - Tests all 28 ranked ranks
  - Tests unranked status (`no rank`)
  - Tests case-insensitivity
  - Tests edge cases (null, undefined, unknown ranks)
  - Tests consistency across all APIs

- **`src/data/taxonomyLoader.test.js`** (190 lines)
  - 20 test cases for taxonomy loading with rank support
  - Tests loading fixture with all 30 ranks (28 ranked + `no rank`)
  - Tests preservation of rank strings exactly as provided
  - Tests extinct flag and common/scientific names independently of rank
  - Tests backwards compatibility with original 14 ranks
  - Tests synchronous and asynchronous loading

### 3. Enhanced Test Fixture
- **`data/test-fixtures/taxonomy-fixture.json`** (expanded)
  - Increased from ~22 taxa to ~40+ taxa
  - Now exercises all 28 OTL ranks plus `no rank`
  - Includes extinct taxa and extinct unranked taxa
  - Includes edge cases (internal nodes with taxonId, multi-level hierarchies)
  - Updated metadata to document OTL rank coverage

## Files Modified

### 1. Schema
- **`data/schemas/taxonomy.schema.json`** (line 49-54)
  - Changed `rank` property from hardcoded enum (14 values) to permissive `minLength: 1` string type
  - Updated description to acknowledge OTL vocabulary evolution
  - Maintains backward compatibility (all 14 original ranks still valid)

### 2. Documentation
- **`docs/DATA_POLICY.md`**
  - Updated section 2.1 to list all supported ranks (including mammal-specific and intermediate ranks)
  - Updated section 2.3 to document rank hierarchy awareness
  - Added explicit note that parent-child relationships come from lineage data, never from rank inference
  - Added note on `no rank` handling
  - Clarified that rank values are preserved exactly as provided

- **`docs/ARCHITECTURE.md`**
  - Added `/src/taxonomy` module section to module structure (line 637-639)
  - Documents rankHierarchy.js and test file location
  - Integrated rank management into data loading pipeline

## Key Design Decisions

### 1. Permissive Schema (Not Restrictive Enum)
- **Decision**: Change rank from enum to permissive string type
- **Rationale**: OTL's rank vocabulary evolves; using an enum would require schema updates whenever OTL introduces new ranks. A permissive string type future-proofs the application.
- **Verification**: Schema still validates required fields and structure; rank content is flexible.

### 2. Separate Rank Hierarchy Knowledge Base
- **Decision**: Create rankHierarchy.js utility module with rank ordering
- **Rationale**: Centralizes rank knowledge; makes rank-aware operations (filtering, sorting) consistent; separates concerns (data loading vs. rank operations).
- **Benefit**: Code can query rank relationships without hardcoding assumptions in loaders or visualization.

### 3. No Rank Inference
- **Decision**: Loader never infers parent-child relationships from rank names or values
- **Rationale**: Real taxonomic data (especially from OTL) may have unexpected rank orderings due to how induced subtrees are constructed. Inferring relationships from rank alone would be brittle and incorrect.
- **Implementation**: Parent-child validation only checks that parent exists; no rank hierarchy validation is performed by loader.

### 4. Exact String Preservation
- **Decision**: Rank strings are preserved exactly as provided by OTL
- **Rationale**: Source database rank strings are authoritative. Normalizing (e.g., "no rank" → "unranked") would lose information about the source. If OTL changes rank naming conventions, we want to detect that.
- **Verification**: rankHierarchy.js performs case-insensitive lookups but never modifies strings.

### 5. No Rank as Valid but Unranked
- **Decision**: `no rank` is a valid rank value that doesn't appear in the Linnaean hierarchy
- **Rationale**: OTL uses `no rank` for taxa without formal rank classification. These are legitimate taxonomy entries with valid OTT IDs and lineage data. Discarding them would lose data.
- **Implementation**: rankHierarchy.js includes `no rank` in fixture support but isRanked('no rank') returns false, getRankLevel('no rank') returns null.

## Test Results

### Final Test Run
```
# tests 563
# suites 0
# pass 563
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2535.946038
```

### Test Coverage by Module
- **rankHierarchy.test.js**: 21 tests (PASS)
- **taxonomyLoader.test.js**: 20 tests (PASS)
- **Existing tests**: 522 tests (PASS, regression verified)
- **Total**: 563 tests passing

### Ranks Tested
All 28 ranked ranks:
- domain, kingdom, phylum, subphylum, superclass, class, subclass, infraclass
- cohort, subcohort, superorder, order, suborder, infraorder, parvorder
- superfamily, family, subfamily, tribe, subtribe
- genus, subgenus, section, subsection
- species group, species subgroup, species, subspecies

Plus `no rank` (verified as valid but unranked).

## Rank Hierarchy Reference

The 28 ranked ranks in order (most inclusive to least inclusive):

1. domain
2. kingdom
3. phylum
4. subphylum
5. superclass
6. class
7. subclass
8. infraclass
9. cohort
10. subcohort
11. superorder
12. order
13. suborder
14. infraorder
15. parvorder
16. superfamily
17. family
18. subfamily
19. tribe
20. subtribe
21. genus
22. subgenus
23. section
24. subsection
25. species group
26. species subgroup
27. species
28. subspecies

Plus `no rank` for unranked organisms.

## Backward Compatibility

- All 14 original ranks (kingdom, phylum, class, order, family, genus, species, superclass, subclass, superfamily, subfamily, tribe, subgenus, subspecies) remain fully supported
- Existing taxonomy data loads without modification
- Test fixture includes both original and new ranks
- Schema change is non-breaking (only relaxes validation)

## Unresolved Questions

### 1. Rank Filtering in OTL Resolver
- Current: Resolver classifies matches as "species" or "higher_rank" (binary)
- Future: Could be refined to distinguish `no rank`, `species group`, and explicit higher ranks separately
- Status: Out of scope for this task; resolver behavior unchanged per user decision

### 2. PhyloPic Rank Handling
- Current: PhyloPic resolver extracts node ranks when available
- Future: May need to validate extracted ranks against OTL rank vocabulary
- Status: Out of scope for this task; documented for reference

## Next Steps (For Future Work)

1. **Resolver Enhancement**: Refine OTL resolver rank classification to distinguish species-related matches from higher ranks
2. **PhyloPic Integration**: Clarify and test rank extraction from PhyloPic API responses
3. **Visualization Updates**: Consider rank-aware node styling (e.g., visual distinction for unranked taxa)
4. **Documentation**: Add rank examples to API documentation and user guides
5. **Deployment**: Update live taxonomy data to include all OTL ranks in production datasets

## Verification Checklist

- [x] Schema validates all 28 + 1 = 29 rank variants
- [x] Loader accepts and preserves all ranks exactly
- [x] rankHierarchy utility provides correct rank ordering
- [x] rankHierarchy utility handles `no rank` correctly
- [x] Test fixture exercises all ranks with realistic data
- [x] All new tests pass (21 + 20 = 41 tests)
- [x] All existing tests still pass (522 tests, regression verified)
- [x] Documentation updated to reflect rank support
- [x] No assumptions about rank ordering in validation logic
- [x] Parent-child relationships validated independently of rank

## Files Summary

**New files**: 4
- src/taxonomy/rankHierarchy.js
- src/taxonomy/rankHierarchy.test.js
- src/data/taxonomyLoader.test.js (new test file for loader with rank support)
- (data/test-fixtures/taxonomy-fixture.json is expanded, not new)

**Modified files**: 3
- data/schemas/taxonomy.schema.json
- docs/DATA_POLICY.md
- docs/ARCHITECTURE.md

**Lines of code**: ~600 new (including tests)

---

**Status**: ✅ COMPLETE - All requirements met. Ready for review and merge.
