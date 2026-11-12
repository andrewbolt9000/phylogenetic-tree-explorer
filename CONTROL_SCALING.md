# Control Scaling Documentation

This document defines the user-facing control scaling and internal value conversions for all visualization parameters.

The user-facing controls use a 10× scaling for better UI granularity, while internal parameters maintain their original ranges and units.

## Numeric Control Scaling Reference

### Force Parameters

#### Charge Strength (Repulsion)
- **UI Range**: 0 to 1500 (displayed as-is, no 10× scaling applied)
- **Internal Range**: 0 to -1500 (negated for D3)
- **Default**: 300
- **Conversion**: `internal = -Math.max(0, uiValue)` (zero stays zero, non-zero becomes negative)
- **Step**: 50
- **Units**: D3 force magnitude
- **Effect**: Controls node repulsion strength. Higher values push nodes further apart.
- **Note**: Display range is already intuitive (0-1500); no 10× scaling needed.

#### Link Strength (Edge Stiffness)
- **UI Range**: 0 to 100 (displayed as-is)
- **Internal Range**: 0 to 1.0
- **Conversion**: `internal = uiValue / 100`
- **Default**: 50 (= 0.5 internal)
- **Step**: 5
- **Units**: D3 link strength (0-1)
- **Effect**: Lower values = more flexible edges, higher = stiffer edges

#### Edge Thickness (Base)
- **UI Range**: 5 to 30 (multiplied by 10 from 0.5-3.0 internal)
- **Internal Range**: 0.5 to 3.0
- **Conversion**: `internal = uiValue / 10`
- **Default**: 15 (= 1.5 internal)
- **Step**: 1
- **Units**: SVG stroke-width (pixels)
- **Effect**: Controls base width of all edges

### Appearance Parameters

#### Node Circle Size
- **UI Range**: 5 to 20 (multiplied by 10 from 0.5-2.0 internal)
- **Internal Range**: 0.5 to 2.0
- **Conversion**: `internal = uiValue / 10`
- **Default**: 10 (= 1.0 internal)
- **Step**: 1
- **Units**: Radius multiplier
- **Effect**: Scales all node circles

#### Graph Font Size
- **UI Range**: 80 to 200 (multiplied by 10 from 8-20 px internal)
- **Internal Range**: 8 to 20 px
- **Conversion**: `internal = uiValue / 10`
- **Default**: 110 (= 11 px internal)
- **Step**: 10
- **Units**: Pixels
- **Effect**: Font size for node labels in graph

#### Sidebar Font Size
- **UI Range**: 100 to 200 (multiplied by 10 from 10-20 px internal)
- **Internal Range**: 10 to 20 px
- **Conversion**: `internal = uiValue / 10`
- **Default**: 140 (= 14 px internal)
- **Step**: 10
- **Units**: Pixels
- **Effect**: Font size for sidebar controls and text

### Silhouette Parameters

#### Silhouette Size
- **UI Range**: 30 to 300 (no scaling, displayed as percent)
- **Internal Range**: 30 to 300
- **Default**: 100 (%)
- **Step**: 10
- **Units**: Percent of default size
- **Effect**: Scales the SVG image dimensions

#### Silhouette X Offset
- **UI Range**: -100 to 100 (no scaling, in pixels)
- **Internal Range**: -100 to 100 px
- **Default**: 0 px
- **Step**: 1
- **Units**: Pixels
- **Effect**: Horizontal displacement relative to node center

#### Silhouette Y Offset
- **UI Range**: -100 to 100 (no scaling, in pixels)
- **Internal Range**: -100 to 100 px
- **Default**: 0 px
- **Step**: 1
- **Units**: Pixels
- **Effect**: Vertical displacement relative to node center

#### Silhouette Grayscale
- **UI Range**: 0 to 100 (displayed as-is)
- **Internal Range**: 0 to 100
- **Default**: 50
- **Step**: 5
- **Units**: Percent
- **Effect**: Conversion to grayscale (0=black, 50=gray, 100=white)

#### Silhouette Opacity
- **UI Range**: 0 to 100 (multiplied by 10 from 0-1.0 internal)
- **Internal Range**: 0 to 1.0
- **Conversion**: `internal = uiValue / 100`
- **Default**: 100 (= 1.0 internal, fully opaque)
- **Step**: 5
- **Units**: Percent (0-100) or fraction (0-1) internally
- **Effect**: Transparency of silhouettes

### Advanced Edge Encoding Parameters

#### Root Proximity Weighting
- **UI Range**: 0 to 100 (multiplied by 10 from 0-1.0 internal)
- **Internal Range**: 0 to 1.0
- **Conversion**: `internal = uiValue / 100`
- **Default**: 0 (disabled)
- **Step**: 5
- **Equation**: `W_root = W_base * (1 + S * (1 - d / D_max))`
- **Units**: Multiplier
- **Effect**: Edges near root become thicker

#### Age-Based Edge Thickness
- **UI Range**: 0 to 100 (represents addition to edge width)
- **Internal Range**: 0 to 1.0 (multiplier for age in Ma)
- **Conversion**: `internal = uiValue / 100`
- **Default**: 0 (disabled)
- **Step**: 5
- **Equation**: `W_age = W_existing + S_age * T_Ma`
- **Units**: Addition factor per million years
- **Effect**: Older edges become thicker

#### Topology Repulsion - X (Master Control)
- **UI Range**: 0 to 100 (multiplied by 10 from 0-10 internal)
- **Internal Range**: 0 to 10
- **Conversion**: `internal = uiValue / 10`
- **Default**: 0 (disabled)
- **Step**: 5
- **Equation**: `F = B * (A + X) / D`
- **Units**: Unitless multiplier
- **Effect**: Master control for topology repulsion (X=0 disables)

#### Topology Repulsion - A (Baseline/Offset)
- **UI Range**: 0 to 100 (multiplied by 10 from 0-10 internal)
- **Internal Range**: 0 to 10
- **Conversion**: `internal = uiValue / 10`
- **Default**: 10 (= 1.0 internal)
- **Step**: 5
- **Equation**: `F = B * (A + X) / D`
- **Units**: Baseline offset
- **Effect**: Minimum repulsion when X=0

#### Topology Repulsion - B (Force Multiplier)
- **UI Range**: 0 to 100 (multiplied by 10 from 0-10 internal)
- **Internal Range**: 0 to 10
- **Conversion**: `internal = uiValue / 10`
- **Default**: 10 (= 1.0 internal)
- **Step**: 5
- **Equation**: `F = B * (A + X) / D`
- **Units**: Overall force scale
- **Effect**: Scales all topology repulsion forces

### Toggle Parameters

#### Show Node Dates
- **UI Type**: Checkbox
- **Internal Type**: Boolean
- **Default**: false
- **Effect**: Display divergence age estimates on ancestral nodes

#### Show Ancestral Labels
- **UI Type**: Checkbox
- **Internal Type**: Boolean
- **Default**: false
- **Effect**: Display clade names on ancestral nodes

## Scaling Implementation Notes

### 10× Scaling Convention
For parameters where 10× scaling is applied:
1. The UI slider range is 10× the internal range
2. The step value is also scaled (e.g., internal step 0.1 = UI step 1)
3. Conversion is always: `internal = uiValue / 10`
4. Inverse conversion: `uiValue = internal * 10`

### Parameters NOT Scaled
- Charge Strength: Already intuitive at 0-1500 range
- Silhouette offsets: Pixel values are intuitive at -100 to 100
- Silhouette size: Percent values are intuitive at 30-300%
- Silhouette grayscale: Percent values are intuitive at 0-100%
- All boolean toggles

### Consistent UI Presentation
All numeric controls use:
- Visible range reflected in slider `min`/`max` attributes
- Appropriate `step` for granularity
- Display value showing current setting (with units where applicable)
- Consistent rounding/formatting

## Round-Trip Validation
When exporting/importing YAML:
- All internal values must be preserved exactly
- UI conversion happens only when rendering controls
- YAML contains internal values, not UI-scaled values
- Example: `edgeThickness: 1.5` in YAML, displayed as `15` on UI slider
