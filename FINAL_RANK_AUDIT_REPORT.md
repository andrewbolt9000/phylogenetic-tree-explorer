# TAXONOMY RANK AUDIT - FINAL REPORT

**Date**: November 13, 2024  
**Scope**: Complete codebase audit for taxonomy rank handling  
**Status**: ⛔ BLOCKING ISSUES IDENTIFIED

---

## CRITICAL FINDINGS

### Issue 1: Schema Rank Enum Mismatch (BLOCKING) ⛔

**Severity**: CRITICAL - Data cannot load

**File**: `data/schemas/taxonomy.schema.json` (lines 49-50)

**The Problem**:
- Schema defines rank as enum with 14 hardcoded values
- OTL API returned 30 unique ranks for our 597 animal taxa
- Gap: 16 ranks in OTL data are NOT in schema enum
- **Result**: Any OTL taxonomy data will FAIL JSON Schema validation

**Schema Ranks (14)**:
```
domain, kingdom, phylum, class, order, family, subfamily, tribe, subtribe, 
superfamily, genus, subgenus, species, subspecies
```

**OTL Ranks (30)** - Missing from schema (16 new):
```
subphylum, superclass, subclass, infraclass, cohort, subcohort, superorder, 
infraorder, parvorder, section, subsection, species group, species subgroup, 
no rank, (+ 2 already in schema that need verification)
```

**Fix Options**:
1. ✅ **Recommended**: Change rank to `"type": "string"` (no enum)
   - Accepts any rank from OTL
   - Future-proof for new ranks
   - Simple implementation
   
2. Expand enum to include all 30 ranks
   - More restrictive validation
   - Higher maintenance burden
   - Requires updates as OTL evolves

---

### Issue 2: OTL Resolver Rank Filtering (HIGH) ⚠️

**Severity**: HIGH - Produces incorrect classifications

**File**: `scripts/ott_name_resolver.py` (lines 212-215, 330)

**The Problem**:

**(A) Binary "Higher Rank" Classification** (lines 212-215)
```python
rank = match.get('taxon', {}).get('rank', '').lower()
if rank and rank not in ['species', 'subspecies']:
    return ('higher_rank', 'exact')
```

- Only distinguishes: species/subspecies vs. everything else
- 28 other ranks all lumped as "higher_rank"
- No nuance for:
  - `no rank` - unknown position, needs special handling
  - `species group` / `species subgroup` - may be species-related, not "higher"
  - Non-Linnaean ranks (infraorder, parvorder, cohort, section) - ambiguous hierarchy

**Impact**: 
- Genus matches classified as "higher_rank" (correct in Linnaean sense)
- But `species group` also classified as "higher_rank" (may be wrong)
- Statistics lump all 28 ranks together; no insight into what matched

**(B) Hardcoded Species Filtering** (line 330)
```python
m.get('taxon', {}).get('rank') == 'species'
```

- Only accepts species matches
- Rejects genus/family/etc. even if they are valid answers
- Biases results toward species-only resolution

**Impact**:
- Legitimate higher-rank matches (genus, family) filtered out
- Resolution report shows fewer matches than actually found
- User sees artificial "no match" when genus match exists

**Fix Required**:
- Clarify: what ranks should be considered "higher" vs. "low"?
- Add special handling for `no rank` nodes
- Decide: is filtering by species essential, or is it optional?
- Update statistics to track rank distribution, not just binary count
- Add tests for all 30 ranks

---

### Issue 3: Test Coverage Gap (MEDIUM) ⚠️

**Severity**: MEDIUM - Bugs will appear in production

**Files**: 
- `scripts/test_ott_name_resolver.py` (lines 153-163)
- `data/test-fixtures/taxonomy-fixture.json` (all ranks)

**The Problem**:

**Test Fixture** (`taxonomy-fixture.json`):
- Uses only 8 ranks: kingdom, phylum, class, order, superfamily, family, genus, species
- Missing: All 22 new OTL ranks
- Missing: `no rank`, `species group`, `species subgroup`
- Missing: All non-Linnaean ranks (cohort, infraorder, parvorder, section)

**Test Suite** (`test_ott_name_resolver.py`):
- Only 1 test for rank classification
- Test only covers "genus" as non-species rank
- No tests for edge cases
- No tests for 28 other ranks

**Impact**:
- New ranks untested until production
- Rank-specific logic bugs won't be caught
- OTL resolver tested with only 8 of 30 ranks

**Fix Required**:
1. Expand fixture to include test cases for all 30 ranks
2. Add comprehensive test suite:
   - Each OTL rank tested for classification
   - Edge cases: `no rank`, `species group`
   - Filtering logic tested with mixed ranks
3. Verify stats tracking with all ranks

---

## Secondary Issues

### Issue 4: Phylopic Resolver Rank Extraction (MEDIUM)

**File**: `scripts/phylopic_image_resolver.py` (lines 299, 305, 368-375, 436)

**Problem**:
- Rank extraction from PhyloPic nodes unclear
- `phylopic_matched_node_rank` initialized empty, unclear when populated
- No validation of extracted ranks
- Fallback to 'unknown' for missing ranks
- Unclear if PhyloPic rank should override OTL rank
- Stats track by rank but no insights provided

**Impact**:
- PhyloPic rank mismatch may indicate wrong node selected
- No way to distinguish real issues from missing data
- Stats report "by_rank" but unhelpful without rank hierarchy

---

### Issue 5: Documentation Gaps (LOW)

**Files**:
- `docs/DATA_POLICY.md` (section 2.3, line 110)
- `docs/ARCHITECTURE.md` (taxonomic roster examples)

**Problems**:
- Assume strict Linnaean hierarchy only
- No mention of non-Linnaean ranks
- No guidance on `no rank` handling
- Examples use only 8 ranks
- Developers may incorrectly assume parent is always "higher rank"

**Impact**:
- Incomplete mental model for developers
- May lead to rank-based assumptions in future code
- Code that relies on rank ordering will fail

---

## Files That Need Changes

| File | Issue | Change | Priority |
|------|-------|--------|----------|
| `data/schemas/taxonomy.schema.json` | Rank enum incomplete | Expand or convert to string | **BLOCKING** |
| `scripts/ott_name_resolver.py` | Binary higher_rank logic | Revise classification & filtering | HIGH |
| `scripts/test_ott_name_resolver.py` | Insufficient rank tests | Add tests for all 30 ranks | HIGH |
| `data/test-fixtures/taxonomy-fixture.json` | Missing rank examples | Add test cases for all ranks | MEDIUM |
| `scripts/phylopic_image_resolver.py` | Unclear rank handling | Document and validate | MEDIUM |
| `docs/DATA_POLICY.md` | Outdated hierarchy docs | Update with OTL rank reality | LOW |
| `docs/ARCHITECTURE.md` | Incomplete examples | Update examples with new ranks | LOW |

---

## Rank Hierarchy Analysis

**Question**: Does your code assume a rank hierarchy?

**Linnaean Hierarchy (Safe)**:
```
domain > kingdom > phylum > class > order > family > genus > species > subspecies
```

**OTL Extensions (Ambiguous)**:
- Where do `cohort`, `infraorder`, `parvorder` fit?
- Where do `section`, `subsection` fit?
- What is `no rank`?
- Is `species group` above or below `species`?

**Recommendation**: 
- Don't assume strict ordering in code
- Treat ranks as labels only
- Filtering should be explicit (not rank-based when possible)
- Use only species/subspecies for filtering if you must

---

## Immediate Action Items

### Phase 1 (Blocking)
- [ ] Update `taxonomy.schema.json` line 49-50
  - Change rank from enum to `"type": "string"`
  - Add description mentioning OTL ranks
- [ ] Test that OTL data can load without validation errors

### Phase 2 (High Priority)
- [ ] Audit `ott_name_resolver.py` rank logic
  - Document what counts as "higher_rank"
  - Update lines 212-215 for nuance
  - Clarify line 330 filtering requirement
- [ ] Add comprehensive rank tests
  - Expand test fixture with all 30 ranks
  - Add test cases for each rank
  - Test edge cases: `no rank`, `species group`, etc.

### Phase 3 (Medium Priority)
- [ ] Review `phylopic_image_resolver.py` rank handling
- [ ] Update documentation (DATA_POLICY, ARCHITECTURE)
- [ ] Verify no other code assumes fixed rank set

---

## Acceptance Criteria

✅ All 30 OTL ranks can be loaded without schema validation errors  
✅ Test suite covers all 30 ranks with specific test cases  
✅ OTL resolver explicitly documents rank classification logic  
✅ Documentation updated to reflect OTL rank reality  
✅ No hardcoded rank assumptions remain in code  

---

## Questions for Project Team

1. **Rank Filtering**: Is filtering by species-only essential, or optional for user control?
2. **Hierarchy Awareness**: Should code understand rank ordering, or treat ranks as opaque labels?
3. **No Rank Nodes**: How should OTL's `no rank` nodes be classified or handled?
4. **Species Groups**: Are `species group` and `species subgroup` considered "higher rank" or "species-related"?

---

## Audit Summary

**Audit Date**: November 13, 2024  
**Files Audited**: 8  
**Blocking Issues**: 1  
**High Priority Issues**: 1  
**Medium Priority Issues**: 2  
**Low Priority Issues**: 2  

**Recommendation**: Fix blocking schema issue immediately before attempting to load OTL taxonomy data. Then address high-priority resolver logic and test coverage.

---

## Appendix: All 30 OTL Ranks Found

1. domain
2. kingdom
3. phylum
4. subphylum ⭐ NEW
5. superclass ⭐ NEW
6. class
7. subclass ⭐ NEW
8. infraclass ⭐ NEW
9. cohort ⭐ NEW
10. subcohort ⭐ NEW
11. superorder ⭐ NEW
12. order
13. suborder
14. infraorder ⭐ NEW
15. parvorder ⭐ NEW
16. superfamily
17. family
18. subfamily
19. tribe
20. subtribe
21. genus
22. subgenus
23. section ⭐ NEW
24. subsection ⭐ NEW
25. species group ⭐ NEW
26. species subgroup ⭐ NEW
27. species
28. subspecies
29. no rank ⭐ NEW

(⭐ marks the 15 ranks NOT in current schema)

---

**END OF REPORT**
