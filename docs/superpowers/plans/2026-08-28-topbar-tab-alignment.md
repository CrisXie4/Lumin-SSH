# Topbar & Tab Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the topbar logo and tab bar alignment, standardize tab height to 34px, and reduce the top gap to 6px following Chrome's design ratio.

**Architecture:** Update CSS variables, align topbar items to a shared 34px height container along the bottom edge of the 40px topbar, eliminating the 4px vertical offset between logo/title and session tabs.

**Tech Stack:** React, Tailwind CSS, Vanilla CSS (tokens.css, topbar.css, tabs.css).

## Global Constraints
- Maintain existing draggable behavior for `--wails-draggable: drag` and `--wails-draggable: no-drag`.
- Support both dark mode and light mode seamlessly.
- Preserve active tab SVG inverse corner curves.

---

### Task 1: Tokens & Height Variables
**Files:**
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: Check token variables for topbar and tab heights**
- [ ] **Step 2: Commit token variable updates**

### Task 2: Topbar Container & Logo Alignment
**Files:**
- Modify: `frontend/src/styles/components/topbar.css`
- Modify: `frontend/src/components/AppTopbar.tsx`

- [ ] **Step 1: Update `.topbar-content` and `.topbar-logo` styles to align with tab bar height**
- [ ] **Step 2: Verify logo and title vertical alignment**

### Task 3: Tab Proportions & Control Button Polish
**Files:**
- Modify: `frontend/src/styles/components/tabs.css`

- [ ] **Step 1: Update `.tab-item`, `.tab-home-item`, and `.tab-search-item` to 34px height**
- [ ] **Step 2: Verify active tab SVG curves and hover styles**
- [ ] **Step 3: Run frontend build and verification**
