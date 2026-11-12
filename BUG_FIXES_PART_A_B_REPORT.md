# Bug Fixes: Part A & B Completion Report

## Summary
Both control bugs have been identified, fixed, and tested. All 132 tests pass (including 6 new regression tests).

---

## Part A: Sidebar Font Size Bug Fix

### Problem
The Sidebar Font Size slider was changing line-height/spacing instead of actual text size. This was because the CSS used hardcoded pixel values (e.g., `font-size: 12px`) instead of scaling with the CSS variable.

### Root Cause
CSS classes had hardcoded values:
- `h1`: `font-size: calc(18px * 1.3)`
- `h2`: `font-size: calc(14px * 1.0)`
- `.control-label`: `font-size: 12px`
- `button`: `font-size: 12px`
- `.stats`, `.info-text`, `.legend`: `font-size: 12px`
- `.checkbox-label`: `font-size: 14px`

### Solution
Replaced all hardcoded font sizes with CSS variable expressions:
- `h1`: `font-size: calc(var(--sidebar-font-size) * 1.3)`
- `h2`: `font-size: var(--sidebar-font-size)`
- `.control-label`: `font-size: calc(var(--sidebar-font-size) * 0.86)`
- `button`: `font-size: calc(var(--sidebar-font-size) * 0.86)`
- `stats`, `info-text`, `legend`: `font-size: calc(var(--sidebar-font-size) * 0.86)`
- `.checkbox-label`: `font-size: var(--sidebar-font-size)`

**Key insight**: Multipliers preserve the intended visual hierarchy:
- h1 is 1.3x the base size
- Control labels and buttons are 0.86x (12px at 14px base) = smaller helper text
- h2, checkbox labels use base size

### Verification
✅ All CSS rules now use `var(--sidebar-font-size)` or `calc(var(--sidebar-font-size) * factor)`
✅ Event listener correctly sets CSS variable on slider change
✅ Browser will now render different text sizes when slider moves

---

## Part B: Repulsion Charge Bug Fix

### Problem
The Repulsion (Charge) slider displayed confusing negative values (-1500 to 0) and didn't behave intuitively:
- Moving the slider "up" (toward 0) reduced repulsion
- Moving it "down" (toward -1500) increased repulsion
- The UI showed negative values, which users don't typically think of as "repulsion strength"

### Root Cause
D3's `forceManyBody().strength()` uses negative values for repulsion (this is by design in D3). The slider was directly passing negative values to D3, making the UI counter-intuitive.

### Solution
**Inverted the UI/backend mapping**:
- Slider now displays: **0 to 1500** (positive, intuitive)
- Internally maps to: **0 to -1500** (for D3)

Changes made:
1. Changed slider HTML:
   - `min="-1500" max="0" value="-300"` → `min="0" max="1500" value="300"`
2. Updated help text:
   - Old: "Negative values repel nodes. More negative = stronger repulsion."
   - New: "Higher values increase repulsion between nodes. Zero disables repulsion."
3. Updated event listener:
   ```javascript
   chargeSlider.addEventListener('input', (e) => {
     const uiValue = parseInt(e.target.value);
     document.getElementById('charge-value').textContent = uiValue;
     // Map UI value (0-1500) to D3 negative value (0 to -1500)
     const d3Value = uiValue === 0 ? 0 : -uiValue;
     viz.setChargeStrength(d3Value);
   });
   ```

### Verification
✅ Slider min/max are now 0/1500 (positive range)
✅ Default value is 300 (equivalent to previous -300)
✅ Event listener correctly maps positive UI value to negative D3 value
✅ Zero case handled (0 stays 0, not -0)
✅ Help text updated and clarified

---

## Test Coverage

### Bug Fix Tests (6 new tests)
File: `src/__tests__/control-bug-fixes.test.js`

**Part A Tests:**
1. ✅ CSS uses CSS variable for font sizing (all classes verified)
2. ✅ No hardcoded font-size pixels remain in sidebar CSS

**Part B Tests:**
3. ✅ Slider uses positive UI range (0-1500)
4. ✅ Event listener maps UI value to D3 negative value
5. ✅ Charge slider help text is updated
6. ✅ Default value is positive (300 not -300)

### Regression Tests
✅ All 126 existing tests pass
✅ No regressions in data loading, graph operations, or visualization

### Total Test Results
```
Total Tests: 132
Passed: 132 ✅
Failed: 0
```

---

## Files Modified

1. **index.html**
   - Updated 8 CSS classes to use `var(--sidebar-font-size)` with appropriate multipliers
   - Changed charge-slider HTML range from -1500..0 to 0..1500
   - Updated charge-slider default value from -300 to 300
   - Updated charge-slider help text
   - Updated chargeSlider event listener to map positive UI to negative D3 value
   - Fixed error message pre style to use CSS variable

2. **src/__tests__/control-bug-fixes.test.js** (NEW)
   - 6 regression tests for both bug fixes

---

## Impact Analysis

### Sidebar Font Size Fix
- **Visual Impact**: Sidebar text will now properly scale when users adjust the Sidebar Font Size slider
- **No Breaking Changes**: Event listener and CSS variable binding were already correct; only CSS values needed updating
- **Independence Preserved**: Graph Font Size remains independent (uses different slider and SVG styling)

### Repulsion Charge Fix
- **User Experience**: Slider now behaves intuitively (higher = more repulsion)
- **Backward Compatibility**: Default appearance preserved (300 on new scale ≈ -300 on old scale)
- **API Unchanged**: `setChargeStrength()` still receives D3-compatible negative values; only the event listener changed

---

## Remaining Known Issues
None. Both bugs are fixed and tested.

---

## Next Steps: Stage 2 Implementation
Ready to proceed with Stage 2:
1. Common and scientific name labels for terminal species
2. Root node labeling
3. Ancestral node labels toggle
4. Silhouette integration into node rendering

All bug fixes are working and verified. The application is stable for Stage 2 implementation.
