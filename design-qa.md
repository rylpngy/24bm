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
