# Phase 2B Browser Testing Checklist

## Hover Highlight Feature
- [ ] **Hover Detection**: Hover over any node and see a dark circle appear behind the silhouette
- [ ] **Smooth Animation**: Circle fades in smoothly (100ms transition)
- [ ] **Visibility**: Circle is clearly visible as a dark (#333) semi-transparent layer
- [ ] **Position**: Circle is centered on the node
- [ ] **Mouse Leave**: Moving mouse away from node fades circle out smoothly
- [ ] **Simulation Tracking**: While hovering, node moves due to simulation → circle follows
- [ ] **Dragging**: Click and drag a node while hovering → circle follows the drag
- [ ] **Zoom/Pan**: Zoom or pan while hovering → circle stays with node
- [ ] **Size Control**: Adjust "Highlight Size" slider → circle grows/shrinks instantly
- [ ] **X Offset**: Adjust "Highlight X Offset" slider → on next hover, circle offset horizontally
- [ ] **Y Offset**: Adjust "Highlight Y Offset" slider → on next hover, circle offset vertically

## Silhouette Shadow Feature
- [ ] **Shadow Visibility**: All animal silhouettes show shadows offset down and right
- [ ] **Shadow Color**: Shadows use opacity effect (not gray or colored)
- [ ] **Shadow Position**: Offset defaults to ~2px down and ~2px right
- [ ] **Toggle Shadows**: Toggle "Enable Shadows" ON/OFF → shadows appear/disappear
- [ ] **Position Updates**: During simulation, shadows move with silhouettes
- [ ] **Zoom Consistent**: Shadows maintain offset relationship during zoom
- [ ] **Pan Consistent**: Shadows stay with silhouettes during pan
- [ ] **X Offset Control**: Adjust "Shadow X Offset" → shadows shift horizontally
- [ ] **Y Offset Control**: Adjust "Shadow Y Offset" → shadows shift vertically
- [ ] **Opacity Control**: Adjust "Shadow Opacity" → shadows fade/brighten (0 = invisible, 100 = opaque)

## Settings UI Integration
- [ ] **Hover Controls**: Three sliders appear under "Hover Highlight" section
  - Highlight Size (5-100px)
  - Highlight X Offset (-50 to 50px)
  - Highlight Y Offset (-50 to 50px)
- [ ] **Shadow Controls**: One toggle + three sliders under "Silhouette Shadows" section
  - Enable Shadows (checkbox)
  - Shadow X Offset (-20 to 20px)
  - Shadow Y Offset (-20 to 20px)
  - Shadow Opacity (0-100%)
- [ ] **Display Values**: Numeric displays show correctly formatted values (px, %)
- [ ] **Slider Ranges**: Sliders cannot be dragged outside min/max bounds

## YAML Export/Import
- [ ] **Export**: Export settings to YAML file (look for button in sidebar or settings)
- [ ] **YAML Content**: Exported YAML includes:
  - `hoverHighlightSize: 15`
  - `hoverHighlightXOffset: 0`
  - `hoverHighlightYOffset: 0`
  - `silhouetteShadowEnabled: true`
  - `silhouetteShadowXOffset: 2`
  - `silhouetteShadowYOffset: 2`
  - `silhouetteShadowOpacity: 0.30`
- [ ] **Import Round-Trip**: 
  1. Adjust hover and shadow settings
  2. Export to YAML
  3. Reset settings to defaults
  4. Import YAML file back
  5. Verify all settings restored correctly
- [ ] **Backward Compat**: Load old YAML file (without Phase 2B settings) → new settings use defaults

## Performance
- [ ] **Frame Rate**: Animation remains smooth during simulation
- [ ] **Hover Responsiveness**: Hovering/unhovering is instant (no lag)
- [ ] **Slider Responsiveness**: Moving sliders updates view without stuttering
- [ ] **Zoom/Pan**: Interactive zoom and pan remain responsive
- [ ] **No Memory Leak**: Extended testing doesn't cause slowdown

## Edge Cases
- [ ] **Multiple Nodes**: Hover over different nodes quickly → only current node shows highlight
- [ ] **Fast Movement**: Rapid node movement (high wind) → circle stays with node
- [ ] **Extreme Settings**: 
  - Set highlight size to max (100px) → renders without issues
  - Set highlight size to min (5px) → still visible
  - Set shadow offset to max (±20px) → shadow still visible
  - Set shadow opacity to 0 → shadow invisible
  - Set shadow opacity to 1 → shadow very dark
- [ ] **Terminal vs Internal**: 
  - Hover terminal nodes → highlights work
  - Hover internal nodes → highlights work
  - Only terminal species show shadows (by design)

## Visual Consistency
- [ ] **Stacking Order**: Highlights behind silhouettes, shadows behind highlights
- [ ] **Color Consistency**: Highlight uses dark neutral (#333), shadows use opacity fade
- [ ] **Alignment**: Highlights and shadows centered correctly on nodes
- [ ] **Text Layer**: Node labels remain visible above highlights/shadows/silhouettes

## Browser Compatibility
- [ ] **Chrome/Chromium**: Test in Chrome
- [ ] **Firefox**: Test in Firefox  
- [ ] **Safari**: Test in Safari
- [ ] **Edge**: Test in Edge

## Known Limitations (Expected)
- ⚠️ Highlights only work for terminal species with silhouettes
- ⚠️ Shadows only rendered for terminal species
- ⚠️ No gradient backgrounds (scheduled for Phase 2C)
- ⚠️ No position persistence (scheduled for Phase 3)

---

## Sign-Off
When all items are verified, provide:
- [ ] Date tested
- [ ] Browser(s) tested
- [ ] Issues found (if any)
- [ ] Ready for production / Needs fixes
