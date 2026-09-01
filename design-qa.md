**Source visual truth path**
- `/Users/note/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_vf6l4qa2in9k22_38af/temp/RWTemp/2026-07/272bc2433ab98411c1c1be8123b1e192.png`

**Implementation screenshot path**
- Desktop: `/Users/note/Documents/Codex/代码/24Bid/test-results/portal-landing-desktop.png`
- Mobile: `/Users/note/Documents/Codex/代码/24Bid/test-results/portal-landing-mobile.png`
- Login desktop: `/Users/note/Documents/Codex/代码/24Bid/test-results/portal-login-desktop.png`
- Login mobile: `/Users/note/Documents/Codex/代码/24Bid/test-results/portal-login-mobile.png`

**Viewport**
- Desktop: 1440 x 1800
- Mobile: 390 x 1200

**State**
- Public tenant portal landing page, logged out.

**Full-view comparison evidence**
- The reference and implementation were opened and compared at the same desktop state.
- The implementation keeps the same information architecture: white nav, dark centered hero, search bar, ecosystem cards, buyer cards, opportunity grid, supplier cards, blue CTA, and dark footer.
- Mobile capture confirms the same content stacks without overlap or horizontal overflow.

**Focused region comparison evidence**
- Hero: matched dark navy background, centered headline, blue-violet emphasis, search control, and keyword row.
- Cards: matched compact white/slate cards, icon accents, six-column desktop rows, and stacked mobile layout.
- Footer: fixed after QA so the logo text remains legible on the dark background.
- Login page: matched the left dark brand panel, split-screen layout, large brand headline, white login card, tabs, outlined inputs, dark primary login button, social login row, and mobile stacked card layout.

**Findings**
- No actionable P0/P1/P2 findings remain.

**Patches made since previous QA pass**
- Added dark footer logo variant so `智采云` remains visible on the dark footer.
- Replaced the portal login modal with the reference-style split login page and changed the primary login button to dark navy for closer fidelity.

**Follow-up Polish**
- P3: Reference has a slightly more pronounced rounded transition between hero and white content. Current implementation keeps the transition close while using the repo's existing 8px card radius discipline.
- P3: Reference includes browser chrome in the supplied image; implementation QA focuses on the page content only.
- P3: Login card includes an extra demo-role section for local development and role acceptance testing; this makes the card taller than the pure visual reference but preserves existing test workflows.

**Final result**
- final result: passed

---

# 组织架构成员操作区视觉验收（2026-08-28）

**Source visual truth path**
- `/var/folders/rh/96k_7lt939128gxywxjy2khr0000gn/T/codex-clipboard-768c3e34-4257-4188-aa24-47992d6f85ed.png`

**Implementation screenshot path**
- Full page: `/Users/epl/Documents/Codex/代码/24Bid-latest-audit/artifacts/org-page-after-sticky-actions.png`
- Focused source: `/Users/epl/Documents/Codex/代码/24Bid-latest-audit/artifacts/org-actions-source-focus.png`
- Focused implementation: `/Users/epl/Documents/Codex/代码/24Bid-latest-audit/artifacts/org-actions-implementation-focus.png`

**Viewport and normalization**
- Source image: 1810 x 654 px. The supplied crop is a Retina-density view of the department member table.
- Implementation capture: 1280 x 720 px, browser CSS viewport 1280 x 720.
- The full views have different surrounding page crops, so the operation column was also compared as a focused region. DOM measurements were used as the authoritative wrapping and overflow evidence.

**State**
- Buyer administrator logged in, organization structure module, 信息化部 selected, two active members displayed.

**Full-view comparison evidence**
- The member table keeps the existing visual language, typography, row density, status treatment, and blue secondary action treatment.
- The operation column remains visible at the right edge while the rest of the table can scroll within its own container.
- Browser measurement confirms the document width equals the 1280 px viewport width; no whole-page horizontal overflow was introduced.

**Focused region comparison evidence**
- Before: percentage-based column sizing compressed both actions, causing `编辑` and `设为主管` to wrap vertically.
- After: the operation column is a fixed 224 px sticky column; `编辑` is 68 x 32 px and `设为主管` is 100 x 32 px.
- Both buttons report `white-space: nowrap` and equal client/scroll heights, confirming no hidden second line.
- Buttons use consistent icon placement, height, spacing, border treatment, hover state, and right alignment.

**Required fidelity surfaces**
- Fonts and typography: existing font scale and weight retained; operation labels now remain on one line.
- Spacing and layout rhythm: fixed action width and 8 px action gap restore consistent row alignment.
- Colors and visual tokens: existing slate secondary and blue supervisory-action tokens retained.
- Image quality and asset fidelity: no raster assets are used in this table; existing Lucide icons remain sharp and consistent.
- Copy and content: action labels remain `编辑` and `设为主管` without abbreviation or semantic change.

**Comparison history**
- P1 initial finding: operation buttons wrapped into two lines and visually broke row alignment.
- Fix: changed to a fixed table layout, fixed/sticky action column, non-shrinking controls, and explicit no-wrap behavior.
- Post-fix evidence: all three rendered actions are 32 px high, no button text overflows, the operation column remains visible, and browser error/warning logs are empty.

**Findings**
- No actionable P0/P1/P2 findings remain.

**Follow-up polish**
- None required for this scoped operation-column adjustment.

**Final result**
- final result: passed
