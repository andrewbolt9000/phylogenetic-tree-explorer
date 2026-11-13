# Taxonomy Rank Support - Developer Quick Reference

## What Changed

The application now supports all 28 Open Tree of Life ranked taxonomic ranks plus `no rank`, enabling validation of comprehensive taxonomic data from OTL.

## Quick Facts

- **28 ranked ranks** in defined hierarchy order
- **Plus `no rank`** for unranked organisms
- **Permissive schema** (string type, not enum)
- **Loader-agnostic** (no rank hierarchy enforcement during loading)
- **Rank hierarchy utility** for queries (isRankHigher, getRankLevel, etc.)

## Using rankHierarchy Module

```javascript
import {
  isRankHigher,
  getRankLevel,
  isRanked,
  getAllRanks,
  LINNAEAN_HIERARCHY
} from './src/taxonomy/rankHierarchy.js';

// Check if rank1 is higher than rank2 in hierarchy
isRankHigher('family', 'genus');        // true
isRankHigher('genus', 'family');        // false
isRankHigher('no rank', 'family');      // null (incomparable)

// Get numeric level in hierarchy (0 = most inclusive)
getRankLevel('kingdom');                // 1
getRankLevel('species');                // 26
getRankLevel('no rank');                // null

// Check if a rank is in the known hierarchy
isRanked('species');                    // true
isRanked('no rank');                    // false
isRanked('unknown_rank');               // false

// Get all ranks in order
const ranks = getAllRanks();            // Returns array of 28 ranks
```

## The 28 Ranked Ranks (In Order)

```
domain > kingdom > phylum > subphylum > superclass > class > subclass > 
infraclass > cohort > subcohort > superorder > order > suborder > 
infraorder > parvorder > superfamily > family > subfamily > tribe > 
subtribe > genus > subgenus > section > subsection > species group > 
species subgroup > species > subspecies
```

## Testing

```bash
# Run all tests (including new rank tests)
npm test

# Run only rank hierarchy tests
npm test -- src/taxonomy/rankHierarchy.test.js

# Run only taxonomy loader tests with rank support
npm test -- src/data/taxonomyLoader.test.js
```

## Common Tasks

### Task: Filter taxa by a minimum rank
```javascript
import { getRankLevel } from './src/taxonomy/rankHierarchy.js';

const minimumRankLevel = getRankLevel('genus');  // 20

const taxa = taxonomy.taxa;
const genusOrBelow = Object.values(taxa).filter(taxon => {
  const level = getRankLevel(taxon.rank);
  return level !== null && level >= minimumRankLevel;
});
```

### Task: Check if rank A is above rank B in hierarchy
```javascript
import { isRankHigher } from './src/taxonomy/rankHierarchy.js';

if (isRankHigher(parentRank, childRank)) {
  console.log(`${parentRank} is above ${childRank}`);
} else if (isRankHigher(childRank, parentRank)) {
  console.log(`${childRank} is above ${parentRank}`);
} else {
  console.log(`Ranks are incomparable or equal`);
}
```

### Task: Validate a rank string
```javascript
import { isRanked } from './src/taxonomy/rankHierarchy.js';

const userProvidedRank = 'superfamily';
if (isRanked(userProvidedRank)) {
  console.log(`Valid rank: ${userProvidedRank}`);
} else if (userProvidedRank === 'no rank') {
  console.log(`Unranked organism`);
} else {
  console.log(`Unknown rank: ${userProvidedRank}`);
}
```

## Important Implementation Notes

### 1. No Rank Inference
The TaxonomyLoader **does not** validate rank hierarchy. Parent-child relationships come from lineage data only.

**Bad** (don't do this):
```javascript
// DON'T: infer from rank that family is parent of genus
if (isRankHigher('family', child.rank)) {
  childParent = family;  // WRONG - actual parent might differ!
}
```

**Good** (do this instead):
```javascript
// DO: use actual parent reference from taxonomy
const childParent = taxonomy.taxa[child.parent];
```

### 2. Case Handling
rankHierarchy APIs are case-insensitive:
```javascript
isRanked('KINGDOM');        // true
isRanked('kingdom');        // true
getRankLevel('Species');    // 26
```

But the actual rank **value** in taxonomy is preserved exactly:
```javascript
taxon.rank                  // 'order' (exact as stored)
getRankLevel(taxon.rank);   // Works despite different case
```

### 3. The `no rank` Special Case
`no rank` is valid in taxonomy but:
- `isRanked('no rank')` returns `false`
- `getRankLevel('no rank')` returns `null`
- `isRankHigher('no rank', anything)` returns `null`

This is by design: `no rank` indicates an unknown or unformalized position in hierarchy.

## Data Schema Changes

### Before (14 hardcoded ranks):
```json
{
  "type": "string",
  "enum": ["kingdom", "phylum", "class", "order", "family", "genus", "species", ...]
}
```

### After (permissive, extensible):
```json
{
  "type": "string",
  "minLength": 1,
  "description": "Taxonomic rank from OTL vocabulary (e.g., kingdom, phylum, class, order, family, genus, species, no rank, etc.)"
}
```

## Backward Compatibility

All existing taxonomy data continues to load without modification. The 14 original ranks all remain fully supported.

## References

- **Module**: `src/taxonomy/rankHierarchy.js` (97 lines)
- **Tests**: `src/taxonomy/rankHierarchy.test.js` (206 lines)
- **Loader Tests**: `src/data/taxonomyLoader.test.js` (190 lines)
- **Schema**: `data/schemas/taxonomy.schema.json` (lines 49-54)
- **Documentation**: `docs/DATA_POLICY.md` (section 2.3), `docs/ARCHITECTURE.md` (section 7)
- **Fixture**: `data/test-fixtures/taxonomy-fixture.json` (~40 taxa, all ranks)

## Support

For questions about rank handling:
1. Check `rankHierarchy.js` docstrings
2. Review test cases in `rankHierarchy.test.js`
3. See real-world examples in `taxonomy-fixture.json`
4. Read `docs/DATA_POLICY.md` section 2.3 for design rationale
