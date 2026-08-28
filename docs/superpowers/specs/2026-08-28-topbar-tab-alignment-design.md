# Topbar & Tab Alignment Design

## Goal
Fix the vertical alignment mismatch between the topbar Logo ("Lumin") and the tab bar, and optimize the active tab height and top margin to match standard modern browser proportions (Chrome style).

## Background & Problem Analysis
1. **Vertical Offset**: The topbar has a height of 40px with `align-items: center` for the logo container (centerline at Y=20px), while the tab bar has `align-items: flex-end` with 32px height (centerline at Y=24px), causing a 4px vertical stagger.
2. **Top Spacing**: 32px tabs inside 40px topbar leave 8px (20%) top gap, making the active tab appear sunken.
3. **Control Items Alignment**: The Home button and Search button next to the logo currently have slight style and height discrepancies with the rest of the tab strip.

## Proposed Solution (Approach A - Chrome Style)
- **Top Margin & Proportions**:
  - Keep `--topbar-h: 40px`.
  - Increase tab height to `34px`, reducing top gap from 8px to 6px (matching Chrome's standard proportions).
- **Centerline Alignment**:
  - Align `.topbar-logo` height to `34px` (bottom aligned in the 40px topbar), so that the logo icon (20px) and "Lumin" text (12px) share the exact same optical centerline at Y=23px as the tab text and icons.
- **Controls & Search**:
  - Standardize `.tab-home-item` and `.tab-search-item` to 34px height, ensuring uniform visual rhythm.
- **Window Controls**:
  - Keep window action buttons properly aligned with the topbar layout.
