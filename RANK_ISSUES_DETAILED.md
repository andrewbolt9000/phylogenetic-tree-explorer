# Detailed Rank Issues by File and Location

## 1. SCHEMA - BLOCKING ISSUE ⛔

### File: `data/schemas/taxonomy.schema.json`

**Location**: Lines 49-50

**Current Code**:
```json
"rank": {
  "type": "string",
  "enum": ["domain", "kingdom", "phylum", "class", "order", "family", "subfamily", "tribe", "subtribe", "superfamily", "genus", "subgenus", "species", "subspecies"],
  "description": "Taxonomic rank."
}
```

**Problem**: 
- Enum has only 14 ranks
- OTL data has 30 ranks
- Any OTL rank not in enum will fail JSON Schema validation
- **This is a hard blocker** - cannot load OTL data without fixing this

**Missing Ranks**:
```
"cohort", "infraclass", "infraorder", "no rank", "parvorder", 
"section", "species group", "species subgroup", "subcohort", "subsection",
"subphylum", "superclass", "superorder", "subclass"
```

**Impact**: 
- Cannot validate OTL-derived taxonomy
- Must either:
  1. Expand enum (high maintenance)
  2. Change to plain string type (recommended)
  3. Filter OTL data before loading (data loss)

---

## 2. OTL RESOLVER - RANK FILTERING ISSUE ⚠️

### File: `scripts/ott_name_resolver.py`

### Issue 2A: Binary "Higher Rank" Classification

**Location**: Lines 212-215

**Current Code**:
```python
# Check if this is a higher rank (not species)
rank = match.get('taxon', {}).get('rank', '').lower()
if rank and rank not in ['species', 'subspecies']:
    return ('higher_rank', 'exact')
```

**Problem**:
- Only handles binary classification: species/subspecies vs. everything else
- 28 other ranks all lumped into "higher_rank"
- No nuance for:
  - `no rank` - what does it mean? Should be flagged separately
  - `species group` - is this above or below species? Currently treated as "higher"
  - `species subgroup` - same ambiguity
  - Intermediate ranks like `infraorder`, `parvorder` - may need special handling

**Affected Ranks** (incorrectly classified as "higher_rank"):
```
infraclass, infraorder, parvorder, section, species group, species subgroup,
subcohort, subclass, subphylum, superclass, superorder, cohort, no rank,
subsection, and others
```

**Example Failure**:
- Query for "Species A" (expecting a species match)
- OTL returns match with rank="genus"
- Code returns ('higher_rank', 'exact')
- Auditor logs this as higher_rank match
- User sees this in resolution report as "not a species match"

**But what if**:
- Query for "Genus A" (expecting a genus match)
- OTL returns match with rank="species"
- Code returns ('exact_match', 'exact')
- Wrong classification: species is "lower" than genus

### Issue 2B: Hardcoded Species-Only Filtering

**Location**: Line 330

**Current Code**:
```python
m.get('taxon', {}).get('rank') == 'species'
```

**Problem**:
- Only matches species
- Ignores all other valid ranks
- If a query could legitimately resolve to genus/family/etc., this filters it out
- Misses valid matches due to rank restriction

**Impact**: 
- Biased toward species-only matches
- Loses valid higher-rank matches even when they are the correct answer
- No support for genus-level queries

### Issue 2C: Statistics Tracking

**Location**: Lines 249, 404-405, 491

**Tracking Code**:
```python
'higher_rank_matches': 0,
# ...
elif status == 'higher_rank':
    self.stats['higher_rank_matches'] += 1
# ...
f"Higher rank matches:       {self.stats['higher_rank_matches']}",
```

**Problem**:
- Statistics lump all 28 non-species ranks into single counter
- Cannot distinguish between:
  - Genuinely "higher" matches (genus, family)
  - Ambiguous matches (species group, no rank)
  - Rank classification issues
- Report shows "Higher rank matches: 47" but doesn't explain which ranks

---

## 3. TEST FIXTURES - INCOMPLETE COVERAGE ⚠️

### File: `data/test-fixtures/taxonomy-fixture.json`

**Location**: All rank values throughout file

**Current Ranks Used**: 
```
kingdom, phylum, class, order, superfamily, family, genus, species
```
(Only 8 of 30 possible ranks)

**Missing Test Coverage**:
- No tests for 22 new ranks
- No test for `no rank`
- No test for `species group` / `species subgroup`
- No test for non-Linnaean ranks (cohort, infraorder, parvorder, section)

**Impact**:
- Schema validation tests only exercise 8 ranks
- Rank-specific logic untested with new ranks
- Bugs will only appear in production with real OTL data

---

## 4. RESOLVER TESTS - INSUFFICIENT RANK COVERAGE ⚠️

### File: `scripts/test_ott_name_resolver.py`

### Current Rank Testing

**Location**: Lines 153-163

**Current Test**:
```python
def test_classify_match_higher_rank(self):
    """Classify higher rank matches correctly."""
    # ...
    # Creates a match with rank="genus"
    # Expects status == 'higher_rank'
```

**Problems**:
1. Only tests ONE non-species rank (genus)
2. Only tests the "higher_rank" classification
3. No tests for:
   - `no rank` (edge case)
   - `species group` / `species subgroup` (ambiguous)
   - Other 28 ranks
   - Subspecies (lower than species - is it handled?)
   - Filtering edge cases

**Missing Tests Should Cover**:
```python
# Test each non-species rank
for rank in ['genus', 'family', 'order', 'class', 'phylum', 'kingdom', 
             'infraorder', 'parvorder', 'cohort', 'section',
             'species group', 'species subgroup', 'no rank', ...]:
    # Verify correct classification
    # Verify filtering behavior
    # Verify stats tracking
```

---

## 5. PHYLOPIC RESOLVER - RANK EXTRACTION ⚠️

### File: `scripts/phylopic_image_resolver.py`

### Issue: Rank Extraction and Reporting

**Location**: Lines 299, 305, 368-375, 436, 471-473

**Extraction Code**:
```python
'ott_rank': candidate.get('ott_rank', ''),
# ...
'phylopic_matched_node_rank': '',
# ...
# Extract rank if available
# ... (unclear what happens here)
rank = result.get('phylopic_matched_node_rank', 'unknown')
```

**Problems**:
1. `phylopic_matched_node_rank` is initialized empty (line 305)
2. Rank extraction code location unclear (line 368-375)
3. Fallback to 'unknown' for missing ranks
4. No validation of extracted rank against known values
5. Stats tracking by rank but no validation
6. No special handling for OTL-specific ranks

**Impact**:
- PhyloPic node rank may differ from OTL rank
- Unknown if PhyloPic rank should override OTL rank
- Rank mismatch could indicate wrong node
- Stats don't distinguish by rank type
- New ranks will just be tracked as-is without validation

---

## 6. DOCUMENTATION - OUTDATED ASSUMPTIONS 📝

### File A: `docs/DATA_POLICY.md`

**Location**: Section 2.3, Line 110

**Current Text**:
```
"A taxonomic parent represents the next higher rank in the Linnaean hierarchy 
(e.g., species → genus → family → order)."
```

**Problems**:
- Assumes strict Linnaean ordering
- OTL has non-Linnaean ranks:
  - `cohort`, `subcohort` - not in Linnaean system
  - `parvorder`, `infraorder` - mammal-specific refinements
  - `section`, `subsection` - intermediate groupings
  - `species group`, `species subgroup` - modern groupings
- No mention of `no rank`
- No guidance for handling non-Linnaean ranks

**Impact**:
- Policy doesn't match implementation reality
- Developers may assume strict hierarchy
- Code that relies on rank ordering will fail with new ranks

### File B: `docs/ARCHITECTURE.md`

**Location**: Section 2.2, Taxonomic Roster example

**Current Code**:
```json
{
  "id": "tax_homo_sapiens",
  "scientificName": "Homo sapiens",
  "rank": "species",
  ...
},
{
  "id": "tax_homo",
  "scientificName": "Homo",
  "rank": "genus",
  ...
}
```

**Problems**:
- Only shows Linnaean ranks (species, genus, tribe, etc.)
- No example of:
  - `no rank`
  - `species group`
  - `infraorder`, `parvorder`
  - Non-Linnaean ranks
- Implies these ranks aren't expected

**Impact**:
- Readers may not expect these ranks to exist
- Incomplete mental model for future work

### File C: `docs/PROJECT_SPEC.md`

**Current Status**: Not checked in detail, but likely same assumptions as DATA_POLICY and ARCHITECTURE

---

## 7. POTENTIAL ASSUMPTIONS IN CODEBASE

### Pattern 1: Rank Comparison
**Risk**: Code that compares ranks or assumes ordering
- Example: `if rank > 'genus'` (nonsensical as string compare)
- Example: `rank_hierarchy = {'species': 0, 'genus': 1, ...}` (incomplete)

**Mitigation**: Search for rank comparisons in all code

### Pattern 2: Terminal vs. Rank
**Risk**: Confusing "terminal node" (tree structure) with "species rank"
- Terminal nodes could have any rank (genus terminal, order terminal, etc.)
- Code may assume terminal nodes are always species

**Current**: Already fixed in forceDirectedVisualization.js - supports internal taxonId

### Pattern 3: Rank-Based Filtering
**Risk**: Filtering by specific ranks
- Example: "only show species" - valid use case
- Example: "skip genus nodes" - may exclude legitimate data

**Current**: Seen in OTL resolver line 330

---

## Summary Table of All Changes Needed

| File | Lines | Issue | Severity | Type |
|------|-------|-------|----------|------|
| taxonomy.schema.json | 49-50 | Rank enum too small | **BLOCKING** | Schema |
| ott_name_resolver.py | 212-215 | Binary higher_rank classification | HIGH | Logic |
| ott_name_resolver.py | 330 | Hardcoded species filtering | HIGH | Logic |
| test_ott_name_resolver.py | 153-163 | Insufficient rank test coverage | MEDIUM | Tests |
| taxonomy-fixture.json | All ranks | Missing rank examples | MEDIUM | Tests |
| phylopic_image_resolver.py | 299, 305, 368-375, 436 | Rank extraction unclear | MEDIUM | Logic |
| DATA_POLICY.md | 110 | Outdated Linnaean assumption | LOW | Docs |
| ARCHITECTURE.md | Examples | Incomplete rank examples | LOW | Docs |

---

## Recommended Fix Priority

1. **First** (BLOCKING): Fix schema rank enum → String type
2. **Second** (HIGH): Fix OTL resolver rank logic
3. **Third** (MEDIUM): Expand test coverage
4. **Fourth** (MEDIUM): Clarify rank handling in resolver docs
5. **Fifth** (LOW): Update DATA_POLICY and ARCHITECTURE docs

