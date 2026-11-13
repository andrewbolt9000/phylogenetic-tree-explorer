# PhyloExplorer: Visual Improvements Investigation — Complete Index

**Status**: Investigation Complete (No Code Modified)  
**Date**: November 12, 2026  
**Scope**: Pre-implementation analysis of 6 visual features + 3 critical bugs + 1 new requirement

---

## Documents Provided

### 1. FINDINGS_SUMMARY.md (Start Here)
- **Length**: 7.3 KB | **Read Time**: 10-15 minutes
- **Content**: Executive overview, key findings table, next actions
- **Best For**: Quick overview, decision makers, project managers
- **Sections**:
  - Key findings (bugs + data types)
  - Staged implementation path
  - Files to modify
  - Critical architectural insights
  - Browser verification requirements
  - Testing strategy summary

### 2. COMPREHENSIVE_FINDINGS_PART1.md (Technical Reference)
- **Length**: 24 KB | **Read Time**: 30-45 minutes
- **Content**: Detailed technical analysis with exact code locations
- **Best For**: Developers, architects, implementation planning
- **Sections**:
  - Section 1: Files and functions (SVG rendering, node creation, labels, hover, persistence)
  - Section 2: showNodeDates startup bug (root cause + evidence)
  - Section 3: SVG layer hierarchy (current + proposed fixes)
  - Section 4: Text measurement for gradients (techniques + options)
  - Section 5: Silhouette shadows (loading mechanism + implementation)
  - Section 6: Root position persistence (architecture + storage options)
  - Section 7: Date information in dataset (divergence vs. establishment vs. fossil)
  - Section 14: Summary of confirmed vs. assumptions

### 3. COMPREHENSIVE_FINDINGS_PART2.md (Implementation Guide)
- **Length**: 19 KB | **Read Time**: 25-40 minutes
- **Content**: Testing requirements, dependencies, implementation order
- **Best For**: QA, test planning, execution
- **Sections**:
  - Section 8: Text layer strategy (guarantee text stays on top)
  - Section 9: Hover highlighting (implementation walkthrough)
  - Section 10: Complete testing requirements (unit + browser tests)
  - Section 11: Dependencies and order recommendations
  - Section 12: Risk assessment and mitigation
  - Section 13: Pre/post-implementation checklists
  - Appendix: Browser verification checklist

### 4. DECISION_POINTS.md (Planning Document)
- **Length**: 12 KB | **Read Time**: 20-30 minutes
- **Content**: 9 key decisions with options, pros/cons, recommendations
- **Best For**: Technical leads, project planning
- **Sections**:
  - Decision 1: Species establishment dates feature scope (full vs. placeholder vs. defer)
  - Decision 2: Position persistence scope (full vs. simple vs. defer)
  - Decision 3: Text background implementation (dynamic vs. estimate vs. simple)
  - Decision 4: Hover appearance (dark circle vs. colored vs. stroke)
  - Decision 5: Shadow implementation (duplicate vs. filter vs. advanced)
  - Decision 6: Text layer structure (.raise() vs. dedicated layer vs. CSS)
  - Decision 7: Implementation sequence (parallel vs. sequential)
  - Decision 8: Browser testing approach (comprehensive vs. minimal vs. deferred)
  - Decision 9: Deferred work (what NOT to implement now)
  - Summary: Recommended path forward + confirmation checklist

---

## Quick Navigation

### By Role

**Project Manager**:
1. Start: FINDINGS_SUMMARY.md
2. Review: DECISION_POINTS.md (Summary section)
3. Timeline: Implementation order in FINDINGS_SUMMARY.md

**Developer**:
1. Start: FINDINGS_SUMMARY.md (5 min)
2. Deep dive: COMPREHENSIVE_FINDINGS_PART1.md (key sections)
3. Implementation: COMPREHENSIVE_FINDINGS_PART2.md (Section 11-12)
4. Execute: DECISION_POINTS.md (confirm decisions)

**QA/Tester**:
1. Start: FINDINGS_SUMMARY.md (Testing Strategy section)
2. Details: COMPREHENSIVE_FINDINGS_PART2.md (Section 10, Appendix)
3. Checklist: DECISION_POINTS.md (Decision 8)

**Architect**:
1. Start: COMPREHENSIVE_FINDINGS_PART1.md (Sections 1-3, 6-7)
2. Details: COMPREHENSIVE_FINDINGS_PART2.md (Sections 8-9, 11-12)
3. Decisions: DECISION_POINTS.md (all sections)

### By Task

**Understand the bugs**:
→ COMPREHENSIVE_FINDINGS_PART1.md, Section 2 (showNodeDates bug)

**Plan implementation order**:
→ DECISION_POINTS.md, Summary section + COMPREHENSIVE_FINDINGS_PART2.md, Section 11

**Prepare unit tests**:
→ COMPREHENSIVE_FINDINGS_PART2.md, Section 10

**Plan browser testing**:
→ COMPREHENSIVE_FINDINGS_PART2.md, Appendix + DECISION_POINTS.md, Decision 8

**Make architectural decisions**:
→ DECISION_POINTS.md (all 9 decisions)

**Get code locations**:
→ COMPREHENSIVE_FINDINGS_PART1.md (every section has file:line references)

---

## Critical Findings Summary

### Confirmed Bugs (Must Fix Phase 1)

| Bug | Severity | Location | Line | Fix Time |
|-----|----------|----------|------|----------|
| showNodeDates not applied at startup | CRITICAL | index.html init | 790 | 10 min |
| nodeDateLabels reference never set | CRITICAL | _renderDateLabels | 414 | 5 min |
| Date label font not independent | MEDIUM | _renderDateLabels | 416 | 20 min |

### Proposed Features (Phase 2)

| Feature | Complexity | Time | Dependencies | Status |
|---------|-----------|------|--------------|--------|
| Hover highlighting | Low | 1-2h | None | Ready |
| Silhouette shadows | Low | 1-2h | None | Ready |
| Text backgrounds | Medium | 2-3h | None | Ready |
| Node date font size | Low | 1-2h | Phase 1 bugs | Ready |
| showSpeciesEstablishmentDates (placeholder) | Low | 15m | None | Ready |

### Optional Features (Phase 3)

| Feature | Complexity | Time | Status |
|---------|-----------|------|--------|
| Position persistence (file export/import) | Medium | 2-3h | Ready to defer |

### Date Information in Dataset

| Type | Available | Location | Status |
|------|-----------|----------|--------|
| Divergence estimates | YES ✓ | divergence-estimates.json | IMPLEMENTED |
| Fossil occurrence dates | NO ✗ | N/A | Future work |
| Species establishment dates | NO ✗ | N/A | Extend taxonomy needed |

---

## Implementation Roadmap

### Phase 1: Critical Bug Fixes (1-2 hours) — START NOW
```
✓ showNodeDates initialization
✓ nodeDateLabels reference storage  
✓ Placeholder showSpeciesEstablishmentDates setting
→ Add 2-3 unit tests
→ Run full test suite (should still pass)
→ Commit
```

### Phase 2: Visual Features (4-6 hours) — Parallelizable
```
✓ Hover highlighting (1-2h)
✓ Silhouette shadows (1-2h)
✓ Text backgrounds (2-3h)
✓ Node date font size (1-2h)
→ Add 15-20 unit tests
→ Run full test suite
→ Browser test each feature
→ Commit incrementally
```

### Phase 3: Position Persistence (1-2 hours) — Optional
```
✓ File-based export/import
→ Add 5-6 unit tests
→ Run full test suite
→ Browser test workflow
→ Commit
```

### Phase 4: Polish (1-2 hours) — Optional
```
✓ Upgrade text backgrounds if time permits
✓ Visual refinement based on testing
✓ Performance optimization
```

---

## Key Decisions Required

**Before implementation begins**, confirm these 9 decisions:

1. Species establishment dates: Full vs. Placeholder vs. Defer? → See DECISION_POINTS.md
2. Position persistence: Full vs. Simple vs. Defer? → See DECISION_POINTS.md
3. Text backgrounds: Dynamic vs. Estimate vs. Simple? → See DECISION_POINTS.md
4. Hover appearance: Dark vs. Colored vs. Stroke? → See DECISION_POINTS.md
5. Shadow implementation: Duplicate vs. Filter vs. Advanced? → See DECISION_POINTS.md
6. Text layer structure: Dedicated layer vs. .raise() vs. CSS? → See DECISION_POINTS.md
7. Implementation: Parallel vs. Sequential? → See DECISION_POINTS.md
8. Browser testing: Comprehensive vs. Minimal vs. Deferred? → See DECISION_POINTS.md
9. Deferred work: What not to do now? → See DECISION_POINTS.md

**Recommended answers** provided in DECISION_POINTS.md Summary section.

---

## Verified Facts vs. Assumptions

### Verified Source-Code Facts ✓
All statements with exact file:line references, code inspection complete:
- showNodeDates setting not called at startup
- nodeDateLabels never set in _renderDateLabels
- Date label font is 0.75× multiplier (hardcoded)
- Silhouettes are external images (paths not accessible)
- Text elements are siblings not children
- Hover handler only changes grey circle opacity
- No position persistence exists
- Divergence data supports multiple estimates

See COMPREHENSIVE_FINDINGS_PART1.md, Section 1 (all with line numbers)

### Assumptions Requiring Browser Verification ⚠️
Cannot confirm without running app:
- Text gradients fade correctly during zoom/pan
- getBBox() works for text measurement
- pointer-events: none prevents drag issues
- Shadow double-load doesn't impact performance
- Highlight opacity 0.2 looks appropriate
- Pre-set positions converge correctly
- Transitions are smooth

See COMPREHENSIVE_FINDINGS_PART2.md, Section 8-9 and Appendix

---

## Files to Modify (5 files total)

| File | Changes | Complexity | Risk |
|------|---------|-----------|------|
| index.html | Init calls + HTML controls | Low | Very Low |
| src/visualization/forceDirectedVisualization.js | 6 methods + setters | Medium | Low |
| src/settings/VisualizationSettings.js | Add settings to schema | Low | Very Low |
| src/ui/SettingsUI.js | Add control mappings | Low | Very Low |
| config/default-settings.yaml | Add defaults | Low | Very Low |

No changes to data schemas, hypothesis, or test fixtures.

---

## Testing Requirements Summary

### New Unit Tests to Add: 15-25 tests
- showNodeDates applies at startup
- Date label font updates when setting changes
- Text backgrounds render before text
- Hover highlighting opacity updates
- Shadow images positioned with offset
- Position export/import round-trip
- Placeholder establishment dates setting doesn't crash

### Existing Tests to Verify: ~431 tests
- All physics/force tests (no changes to forces)
- All silhouette tests (shadows added alongside)
- All label rendering tests (text layer adds structure)
- All grid/zoom/pan tests (not affected)

### Browser Tests to Perform: ~10-15 checks
- Text gradient fade on zoom/pan
- Hover smooth appearance
- Shadows position realistically
- Position persistence full workflow
- No visual glitches or performance issues

See COMPREHENSIVE_FINDINGS_PART2.md Section 10 for complete test list.

---

## Conclusion

**Investigation Status**: COMPLETE ✓

**Ready to Proceed**: YES, pending decision confirmation

**No Code Modified**: All analysis only

**Time to Implementation**: ~1-2 hours (Phase 1 bugs) + 4-6 hours (Phase 2 features)

**Risk Level**: LOW (clear bugs, well-understood features, dependencies mapped)

**Browser Verification**: REQUIRED (visual appearance cannot be confirmed in analysis)

---

## Next Action

1. Read FINDINGS_SUMMARY.md (10-15 min)
2. Confirm 9 decisions from DECISION_POINTS.md (15-20 min)
3. Begin Phase 1 implementation when ready
4. Follow COMPREHENSIVE_FINDINGS_PART2.md Section 11-12 for execution

All technical details, code references, and implementation guidance ready in these 4 documents.
