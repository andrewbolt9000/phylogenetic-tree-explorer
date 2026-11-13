# PhyloExplorer: Investigation — Decision Points

This document summarizes key decisions required before implementation begins.

---

## Decision 1: Species Establishment Dates Feature Scope

### Current Status
- **Data Available**: NO — taxonomy.json lacks descriptionYear, descriptionAuthority
- **Requirement**: Add `showSpeciesEstablishmentDates` toggle for species/taxon naming dates
- **Data Needed**: Extend taxonomy schema, populate from ITIS/NCBI/WoRMS

### Options

**Option A: Implement Full Feature Now** ⚠️ Not Recommended
- Add schema fields to taxonomy.json
- Populate descriptionYear and descriptionAuthority for all species
- Add HTML control and setting
- Add rendering logic for species origin dates
- Time: 4-6 hours
- Risk: Data entry/verification overhead

**Option B: Create Placeholder Setting + Defer Data** ✓ Recommended
- Add showSpeciesEstablishmentDates to VisualizationSettings schema (default: false)
- Add HTML control (toggle, disabled for now)
- Add empty renderer (detects missing data, renders nothing)
- Add documentation: "Data not yet loaded, future feature"
- Extend taxonomy schema (fields added, no data)
- Time: 1-2 hours
- Benefit: Feature ready when data becomes available

**Option C: Skip Entirely** ⚠️ Possible
- Don't add setting or feature
- Add to roadmap for future
- Time: 0 hours
- Risk: Feature forgotten

### Recommendation
**Option B**: Add placeholder setting now, data later. Keeps feature in mind without blocking implementation. Can populate data in future work.

---

## Decision 2: Position Persistence Implementation Scope

### Current Status
- **Mechanism**: Does not exist
- **Requirement**: Save/restore node positions
- **Use Case**: User arranges tree, wants to save/restore layout

### Options

**Option A: Full Implementation (Browser + File)** ⚠️ 2-3 hours
- Add Export Layout button → downloads JSON file
- Add Import Layout button → accepts JSON file
- Add localStorage auto-save (optional)
- Support round-trip export/import
- Time: 2-3 hours
- Complexity: Medium (file I/O, validation)

**Option B: Simple Implementation (File Only)** ✓ Recommended for MVP
- Add Export Layout button → downloads JSON file
- Add Import Layout button → accepts JSON file
- No localStorage or auto-save
- Simple JSON format with version
- Time: 1-2 hours
- Complexity: Low

**Option C: Defer Entirely** ⚠️ Possible
- Post-pone to Phase 3
- Focus on visual features first
- Time: 0 hours now, 2-3 hours later

### Recommendation
**Option B**: Implement file-based export/import only. Fits GitHub Pages static model. Can add localStorage later if needed. Schedule for Phase 3 (after visual features tested).

---

## Decision 3: Text Background Implementation Approach

### Current Status
- **Feature**: Gradient background behind labels
- **Requirement**: Semi-transparent backgrounds with horizontal gradient fade
- **Complexity**: Depends on measurement technique

### Options

**Option A: Dynamic Measurement (getBBox)** ✓ Recommended
- Render text first, then measure with getBBox()
- Create background rect with measured dimensions
- Gradient applied dynamically
- Time: 2-3 hours
- Accuracy: High (exact text width)
- Browser Verification: Required (getBBox timing)

**Option B: Estimated Width (Static Calculation)** 
- Estimate text width: character count × average character width
- Create background with estimated dimensions
- Gradient applied with estimate
- Time: 1-2 hours
- Accuracy: Medium (may clip long names)
- Browser Verification: Not required

**Option C: Simpler Approach (No Gradient)**
- Background rectangles only, no horizontal gradient
- Simpler SVG, easier to implement
- Visual: Less sophisticated but acceptable
- Time: 1 hour
- Trade-off: Simpler but less visually interesting

### Recommendation
**Option A** if browser testing is acceptable. **Option B** if must avoid browser dependencies. Start with **Option C** (simplest), upgrade to **Option A** after Phase 2 browser testing.

---

## Decision 4: Hover Highlighting Appearance

### Current Status
- **Feature**: Larger circle behind nodes on hover
- **Requirement**: 20% opacity highlight
- **Options**: Color and styling

### Options

**Option A: Dark Circle (Black, Simple)** ✓ Recommended
- Color: #000 (black)
- Opacity: 0.2 (20%)
- Radius: 1.5× grey circle
- Pros: Works with any background, simplest
- Cons: Subtle, may be hard to see
- Time: 15 min

**Option B: Colored Circle (Blue)**
- Color: #2E86AB (matches node-marker)
- Opacity: 0.15 (15%)
- Radius: 1.5× grey circle
- Pros: Design-consistent, more visible
- Cons: May clash with backgrounds
- Time: 15 min

**Option C: Stroke (No Fill)**
- Stroke: #2E86AB, 2px width
- Opacity: 0.8
- Radius: 1.3× grey circle
- Pros: Doesn't obscure silhouettes
- Cons: Thinner visual indication
- Time: 20 min

### Recommendation
**Option A**: Implement first (simplest, most universal). Test in browser. Upgrade to **Option B** if feedback requests higher visibility.

---

## Decision 5: Silhouette Shadow Implementation

### Current Status
- **Feature**: Offset shadow beneath silhouettes
- **Requirement**: Second image with 2px offset, dimmed
- **Concerns**: Double HTTP request load

### Options

**Option A: Duplicate Image (Recommended)** ✓
- Create second `<image>` element with same href
- Offset 2px right/down
- Opacity 0.15, filter: brightness(50%)
- Time: 15 min
- Browser Caching: Should cache second request
- Visual: Realistic shadow effect

**Option B: CSS Filter Drop-Shadow**
- Apply `filter: drop-shadow(2px 2px 4px)` to image
- Simpler, no extra element
- Time: 10 min
- Limitation: Affects entire image, not just silhouette
- Visual: Less controllable

**Option C: SVG Filter with feGaussianBlur**
- Create custom SVG filter
- More control over shadow appearance
- Time: 30 min
- Browser Support: May vary
- Visual: Professional but complex

### Recommendation
**Option A**: Start with duplicate image (simple, predictable). If performance issues arise, try **Option B** or **Option C**.

---

## Decision 6: SVG Text Layer Structure

### Current Status
- **Problem**: Text elements scattered across multiple data joins
- **Risk**: Text may not stay on top after updates
- **Solution**: Create dedicated text layer

### Options

**Option A: Create Text Layer Group (Recommended)** ✓
- Add `<g class="text-layer">` as last child of this.g
- Move all text creation to this.textLayer
- Ensures text always on top
- Time: 2-3 hours (requires refactoring)
- Risk: Medium (affects multiple functions)
- Guarantee: Very high

**Option B: Use .raise() During Updates**
- Keep current structure
- Call `this.g.selectAll('text').raise()` at end of each render
- Simpler, less refactoring
- Time: 30 min
- Risk: Low (non-invasive)
- Guarantee: Medium (depends on timing)

**Option C: Add Explicit z-order via CSS**
- Use CSS z-index or SVG order
- Keep current structure
- Time: 15 min
- Risk: Very low
- Guarantee: Low (SVG doesn't fully respect CSS z-index)

### Recommendation
**Option B**: Simplest, lowest risk. Implement .raise() calls where needed. Upgrade to **Option A** if issues arise during browser testing.

---

## Decision 7: Implementation Sequence and Parallelization

### Current Status
- Multiple independent features ready to implement
- Some have dependencies (date features depend on Phase 1 bugs)
- Testing required after each feature

### Options

**Option A: Sequential** ⚠️ Safest but Slower
1. Phase 1: Bug fixes (1-2 hours)
2. Phase 2A: Single visual feature at a time (4-6 hours)
3. Phase 2B: Remaining features (3-4 hours)
4. Phase 3: Position persistence (2 hours)
- Total: 10-14 hours
- Risk: Very low
- Benefit: Each feature individually tested

**Option B: Parallel Phase 2** ✓ Recommended
1. Phase 1: Bug fixes (1-2 hours)
2. Phase 2 (parallel):
   - Developer A: Hover highlighting (1-2 hours)
   - Developer B: Silhouette shadows (1-2 hours)
   - Developer C: Text backgrounds (2-3 hours)
   - Developer D: Node date font size (1-2 hours)
3. Phase 3: Position persistence (2 hours)
- Total: 7-11 hours (parallelizable)
- Risk: Medium (merge conflicts possible)
- Benefit: Faster delivery

**Option C: All-in-One** ⚠️ Risky but Fastest
- Implement all features simultaneously
- Risk: Very high (conflicts, hard to debug)
- Not recommended

### Recommendation
**Option B**: Parallel Phase 2 if team available. Otherwise, **Option A** sequential. Phase 1 must complete first (blocker for date features).

---

## Decision 8: Browser Testing Approach

### Current Status
- Many assumptions require browser verification
- Unit tests can't verify visual appearance or animations
- Manual testing needed for zoom/pan/drag interactions

### Options

**Option A: Comprehensive Browser Testing** ✓ Recommended
- Test each feature in browser after implementation
- Verify visual appearance (hover, shadows, backgrounds)
- Test interactions (zoom, pan, drag, hover)
- Verify smooth animations/transitions
- Time: 1-2 hours per feature
- Coverage: Complete

**Option B: Minimal Browser Testing**
- Only test for crashes/errors
- Skip visual verification
- Time: 30 min total
- Risk: Visual bugs missed

**Option C: Defer Browser Testing**
- Implement all features
- Browser test everything at end
- Time: Concentrated in Phase 4
- Risk: Bugs hard to debug (multiple features)

### Recommendation
**Option A**: Test each feature after implementation. Use browser pages already open (localhost:8000, localhost:8888). Schedule 1-2 hours for browser testing throughout implementation.

---

## Decision 9: Deferred Work — What NOT to Implement Now

### NOT Recommended Now (Defer to Future)

**1. Full Species Establishment Dates Feature**
- Reason: Data model incomplete (taxonomy.json lacks data)
- Defer Until: Data available from ITIS/NCBI/WoRMS
- Alternative: Create placeholder setting only (Option B from Decision 1)

**2. Complex Text Background Gradient**
- Reason: Requires getBBox() browser verification, complex measurement
- Defer Until: Browser testing framework established
- Alternative: Start with simpler background rectangles (Option C from Decision 3)

**3. LocalStorage Auto-Save Position Persistence**
- Reason: Adds persistence complexity beyond initial need
- Defer Until: User feedback indicates necessity
- Alternative: File-based export/import only (Option B from Decision 2)

**4. Advanced SVG Filter Shadow Effects**
- Reason: Browser compatibility concerns, complexity
- Defer Until: Performance profiling shows need
- Alternative: Simple duplicate image shadow (Option A from Decision 5)

---

## Summary: Recommended Path Forward

### Approved Implementation Sequence

**Phase 1: Bug Fixes (1-2 hours)** ✓ CRITICAL
1. showNodeDates initialization (10 min)
2. nodeDateLabels reference storage (5 min)
3. Add placeholder showSpeciesEstablishmentDates setting (15 min)
4. Run full test suite
5. Commit

**Phase 2: Visual Features (4-6 hours)** ✓ PARALLELIZABLE
1. Hover highlighting (1-2 hours) — Option A: dark circle
2. Silhouette shadows (1-2 hours) — Option A: duplicate image
3. Text backgrounds (2-3 hours) — Option C: simple rectangles first
4. Node date font size (1-2 hours)
5. Run full test suite
6. Browser test each feature
7. Commit incrementally

**Phase 3: Position Persistence (1-2 hours)** ✓ OPTIONAL
1. File-based export/import (1-2 hours) — Option B
2. Run full test suite
3. Browser test full workflow
4. Commit

**Phase 4: Browser Polish** (1-2 hours)
1. Upgrade to complex text backgrounds if time allows
2. Visual refinement based on testing
3. Performance optimization if needed

---

## Decisions Awaiting Confirmation

Before implementation begins, please confirm:

- [ ] Decision 1: Create placeholder showSpeciesEstablishmentDates setting (Option B)?
- [ ] Decision 2: Implement file-based position persistence (Option B)?
- [ ] Decision 3: Start with simple text backgrounds (Option C), upgrade later?
- [ ] Decision 4: Dark circle hover highlight (Option A)?
- [ ] Decision 5: Duplicate image silhouette shadow (Option A)?
- [ ] Decision 6: Use .raise() for text layer (Option B)?
- [ ] Decision 7: Parallel Phase 2 implementation?
- [ ] Decision 8: Browser test each feature after implementation?
- [ ] Proceed with Phase 1 bug fixes immediately after confirmation?

---

## Questions Before Implementation

1. **Timeline**: How many hours/days available for this work?
2. **Team**: One developer or multiple?
3. **Priority**: Visual features or position persistence?
4. **Browser Testing**: Who will test in browser?
5. **Data Model**: When can species establishment dates be populated?
6. **Feedback**: When is community feedback available for refinement?

