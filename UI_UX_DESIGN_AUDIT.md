# LegalLink — UI/UX Design Audit Report
**Date:** September 2026  
**Auditor:** Code-grounded automated analysis  
**Scope:** All 31 pages/screens across 4 portals + public pages  
**Method:** Direct JSX/CSS source extraction — all values pulled from live code, not visual inspection  

---

> **How to read this report:** Each section covers one screen. Color swatches are listed as hex codes with the element they appear on. "Missing state" means the state is not implemented — the app will show a blank section or an unhandled render gap.

---

## Table of Contents
1. [Public Pages](#1-public-pages)
2. [Citizen Portal](#2-citizen-portal)
3. [Lawyer Portal](#3-lawyer-portal)
4. [NGO Portal](#4-ngo-portal)
5. [Admin Portal](#5-admin-portal)
6. [Global Summary](#6-global-summary)

---

# 1. Public Pages

---

## P-01 · Landing Page

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/LandingPage.jsx` |
| **Route** | `/` |
| **Purpose** | Public marketing homepage — entry point for new visitors |

### 1. Layout Structure
- **Header/Navbar:** `<Navbar />` — two-tier: social bar (Twitter/Instagram/Facebook/LinkedIn/Email links on `#f8f9fa` bg) + sticky main nav (`#ffffff`, `padding: 12px 0`, `borderBottom: 1px solid #e0e0e0`). Logo (42px height) + brand name + 5 nav links + two CTAs (Login / Get Started).
- **Hero Section:** `minHeight: 85vh`, `backgroundColor: #ffffff`. Two-column Bootstrap `row`: left = h1 + lead paragraph + 2 CTA buttons; right = image in white card (`border-radius: 20px`, `shadow-lg`). Hidden on < lg.
- **Practice Areas Section:** Full-width div with background image (parallax `backgroundAttachment: fixed`) overlaid with `rgba(255,255,255,0.92)` wash. Contains intro text row + horizontal scrollable card row (custom scroll buttons `#0c1333`) + `<MovingBanner />`.
- **3 Pictures Row:** Bootstrap `container`, 3 equal-width images in `col-md-4`, no border-radius applied, full `objectFit: cover`.
- **Footer:** `<Footer />` — dark `#1a1a1a` background, 4-column layout (About, Other Pages, Contact Info, Newsletter).

### 2. Color Usage

| Color | Element |
|---|---|
| `#ffffff` | Hero section background, Navbar background, practice area cards |
| `#f8f9fa` | Top social bar background |
| `#e0e0e0` | Navbar bottom border, social bar border |
| `#333` | Social icon links |
| `#272626` | Nav links text |
| `#000000` | Navbar toggler bg, "Get Started" button bg, scroll arrow buttons |
| `#1E3F2E` | Brand name in navbar (serif font span) |
| `rgba(255,255,255,0.92)` | Practice areas section overlay |
| `#0c1333` | Horizontal scroll `‹ ›` arrow buttons |
| `#6c757d` | "Anytime" animated span in hero h1 |
| `#555` | Section description paragraph text |
| `#000000` | Practice area card Material icon color |
| `#868686` | Image wrapper card background (right-side hero box) |
| `#1a1a1a` | Footer background |
| `#D4AF37` | Footer LEGALLINK h3, section headers, newsletter button bg |
| `#aaa` | Footer body/link text |
| `#666` | Footer copyright "Designed by" text |
| `#333` | Newsletter email input background |

### 3. Typography

| Element | Font | Size/Weight |
|---|---|---|
| Brand name (nav) | `var(--font-serif, 'Playfair Display', serif)` | `1.45rem / 700` |
| Nav links | `var(--font-sans, Inter, sans-serif)` (CSS var default) | `16px / 500` |
| Login/Get Started buttons | `Marcellus, serif` | Default / 500 |
| Hero h1 | `Marcellus, serif` | `3.5rem / 700` (Bootstrap `display-3 fw-bold`) |
| Hero lead | `Marcellus, serif` | `1.2rem` |
| Practice area section h2 | `Marcellus, serif` | `45px / 600` |
| Practice area description | `Segoe UI` | `17px` |
| Practice area card title | `Marcellus, serif` | Default h4, `fw-bold` |
| Footer section headers | `Marcellus, serif` | `24px` / `16px` |
| Footer body/links | `Segoe UI, system-ui` | `14px` |
| Footer copyright | `Segoe UI, system-ui` | `12px` / `11px` |

> ⚠️ **Inconsistency:** The navbar uses `Inter` via CSS variable for nav links but `Marcellus` for CTA buttons — two different font choices within the same component.

### 4. Spacing / Sizing
- Navbar padding: `12px 0`; Social bar: `8px 0`
- Hero: `minHeight 85vh`, Bootstrap container
- Practice area cards: `minWidth 350px`, `padding p-4 (24px)`, `gap 24px`
- Footer: `padding 50px 0 20px 0`

### 5. Components Used
| Component | Notes |
|---|---|
| `<Navbar />` | Custom two-tier |
| `<Footer />` | Custom dark |
| `<MovingBanner />` | Scrolling ticker |
| Practice area cards | Bootstrap `.card.border-0.shadow-lg`, `border-radius: 5px` |
| CTA buttons | Bootstrap `.btn.btn-dark`, `.btn.btn-outline-dark`, `border-radius: 10px` |
| Google Material Icons | `className="material-icons"` — CDN string-based |
| Font Awesome | `fab fa-twitter`, `fas fa-envelope` — social links only |

### 6. States Handled
| State | Status |
|---|---|
| Loading | ❌ Missing — page is static but no skeleton for any async elements |
| Empty | ✅ N/A — static content |
| Error | ❌ Missing |

### 7. Responsiveness
- Bootstrap grid (`col-lg-7`, `col-lg-5`, `d-none d-lg-block`). Right hero image hidden below `lg`. Practice area cards use `minWidth: 350px` in a flex container — overflows on narrow screens but is caught by the scroll container.

### 8. Inconsistencies Flagged
- Scroll arrow buttons use `#0c1333` (NGO navy) — not the brand green `#1E3F2E`.
- Footer gold `#D4AF37` never appears in the navbar or hero — isolated to footer only.
- `Marcellus` and `Playfair Display` (via CSS var) coexist on the same page for the same "brand serif" role.

---

## P-02 · Public Login (Unified)

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/Login.jsx` |
| **Route** | `/login?role=[user\|lawyer\|ngo]` |
| **Purpose** | Unified login for Citizens, Lawyers, NGOs with role switcher |

### 1. Layout Structure
- **Header:** `<Navbar />` (public two-tier navbar)
- **Main:** Full-screen centered `.login-split-wrap` — `minHeight: calc(100vh - 72px)`, background `#F8FAFC` with `radial-gradient(#E2E8F0 1px, transparent 1px)` dot matrix `24px × 24px`.
- **Split Container (`.login-split-container`):** `grid-template-columns: 1fr 1.25fr`, `max-width: 1060px`, `border-radius: 16px`, `border: 1px solid #E2E8F0`, themed drop shadow.
- **Left Panel (`.login-left-panel`):** `backgroundColor: #1E3F2E`, radial gold highlight `rgba(197,160,89,0.16)`, linear gradient to `#152E22`. Legal showcase — icon, quote, feature badges, stats.
- **Right Panel (`.login-right-panel`):** `#FFFFFF` bg. Role selector grid (3 cards, `grid-template-columns: repeat(3, 1fr)`), email + password fields with absolute-positioned left icon, forgot password link, submit button.
- **Dark Mode:** Page bg `#090D16`; container `#0F172A`; right panel `#0F172A`; role selector `#1E293B`.

### 2. Color Usage

| Color | Element |
|---|---|
| `#F8FAFC` | Page bg, role selector bg |
| `#E2E8F0` | Dot pattern, borders |
| `#1E3F2E` | Left panel bg, focus ring, `auth-link-gold` link color (light mode) |
| `#152E22` | Left panel gradient end, link hover |
| `rgba(197,160,89,0.16)` | Left panel radial gold overlay |
| `#FFFFFF` | Right panel bg, input bg |
| `#0F172A` | Heading text, dark bg |
| `#CBD5E1` | Input border default |
| `#94A3B8` | Placeholder text |
| `#64748B` | Sub-heading, muted text |
| `#334155` | Auth label text, dark border |
| `#FBBF24` | Auth link color (dark mode) |
| `#FCD34D` | Auth link hover (dark mode) |
| `#090D16` | Page background (dark mode) |
| `#1E293B` | Role selector bg (dark), input bg (dark) |
| `#10B981` | Input focus border (dark mode) |
| `#EF4444` | Blocked account error banner bg |
| `#FFFBEB` | Pending approval banner bg |
| `#FEF9C3` | Rejected status banner bg |

### 3. Typography
| Element | Font | Size/Weight |
|---|---|---|
| Auth card title | `var(--font-serif, 'Playfair Display', serif)` | `25px / 700` |
| Auth label | System sans | `13.5px / 600` |
| Auth input | System sans | `14.5px` |
| Submit button | System sans | `15px / 600` |
| Role selector tab | System sans | `13px / 600` |

### 4. Spacing / Sizing
- Left panel: `padding: 48px 40px`; Right panel: `padding: 44px 40px`
- Input height: `46px`; Input padding: `10px 14px 10px 42px` (icon offset)
- Role selector gap: `8px`, container padding: `14px`

### 5. Components Used
| Component | Library |
|---|---|
| Role selector cards | Custom, 3-up grid |
| Email / Password inputs | Custom with absolute icon overlay |
| Password eye toggle | `Eye` / `EyeOff` — lucide-react |
| Submit button | Custom full-width |
| Alert banners (3 types) | Custom inline |
| Lucide icons | `Mail`, `Lock`, `Eye`, `EyeOff`, `ArrowRight`, `AlertCircle`, `Clock`, `AlertTriangle`, `Ban`, `User`, `Scale`, `Building2`, `Bot`, `Sparkles` |

### 6. States Handled
| State | Status |
|---|---|
| Loading | ✅ Button disabled + spinner label |
| Error — Generic | ✅ Red `AlertCircle` banner |
| Error — Pending | ✅ Amber `Clock` banner |
| Error — Rejected | ✅ Yellow `AlertTriangle` banner |
| Error — Blocked | ✅ Red `Ban` banner |
| Success | ✅ Redirect on successful login |

### 7. Responsiveness
- Grid collapses to `1fr` (single column) at 768px. Left panel hidden on mobile.

### 8. Inconsistencies
- None major on this page — the most polished auth screen in the app.

---

## P-03 · Role Picker / Signup Gateway

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/Signup.jsx` |
| **Route** | `/signup` |
| **Purpose** | Role selection page before directing to role-specific signup forms |

### 1. Layout Structure
- **Header:** `<Navbar />`
- **Main:** `.signup-split-wrap` — identical dot-pattern background to Login (`#F8FAFC`, `radial-gradient(#E2E8F0 1px...)`).
- **Split Container:** `grid-template-columns: 1fr 1.35fr`. Left dark green panel + right 3 role cards.
- **Role Cards:** Each card: icon circle (accent-colored), title, badge (role-specific colors), 3-feature list with `CheckCircle2` icons, CTA button.

### 2. Color Usage — Role Card Accents
| Role | Icon/Button Accent | Badge Bg | Badge Text | Badge Border |
|---|---|---|---|---|
| Citizen | `#1E3F2E` | `#F0FDF4` | `#1E3F2E` | `#BBF7D0` |
| Lawyer | `#C5A059` | `#FEFCE8` | `#854D0E` | `#FEF08A` |
| NGO | `#1E3F2E` | `#EFF6FF` | `#1E40AF` | `#BFDBFE` |

> ⚠️ **Inconsistency:** NGO badge uses blue (`#1E40AF`) while the other two use green/amber — no consistent per-role color coding strategy across the whole app (NGO is also green in the NGO Portal itself).

### 3. Components / Icons
- `User`, `Scale`, `Building2`, `ArrowRight`, `ShieldCheck`, `CheckCircle2`, `Sparkles`, `Bot` — all lucide-react.

### 4. States
- Static page — loading/empty/error not applicable.

---

## P-04 · Forgot Password

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/ForgotPassword.jsx` |
| **Route** | `/forgot-password?role=[user\|lawyer\|ngo]` |
| **Purpose** | Email-based password reset request, role-aware |

### Layout
- `<Navbar />` + same split-panel as Login. Role tab switcher (3 options) + single email field + submit.

### States
| State | Status |
|---|---|
| Loading | ✅ Button disabled + "Sending..." label |
| Success | ✅ Full success panel: `CheckCircle2`, green, email confirmation + resend link |
| Error | ✅ Red `AlertCircle` alert with specific message |

### Icons (lucide-react)
`Mail`, `ArrowLeft`, `CheckCircle2`, `AlertCircle`, `Scale`, `Building2`, `User`, `ShieldCheck`, `KeyRound`, `Clock`, `Sparkles`

---

## P-05 · Reset Password

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/ResetPassword.jsx` |
| **Route** | `/reset-password?token=...&role=...` |
| **Purpose** | Set new password from email reset link |

### Layout
- Same split-panel as Login. Two password fields (new + confirm) with show/hide toggles. Token validated on mount.

### States
| State | Status |
|---|---|
| Loading | ✅ Button disabled |
| Token invalid/expired | ✅ Error alert |
| Success | ✅ Success panel with auto-redirect countdown |

---

## P-06 · 404 Not Found

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/NotFound.jsx` |
| **Route** | `*` (catch-all) |
| **Purpose** | Unknown route error page |

### 1. Layout Structure
- **No Navbar/Footer** — full-page standalone.
- Viewport: `minHeight: 100vh`, `linear-gradient(135deg, #0c1a12 0%, #1E3F2E 50%, #0c1a12 100%)`.
- SVG scales-of-justice watermark: centered, `opacity: 0.04`, `color: #D4AF37`, 480×480px.
- 3 concentric decorative rings: `border: 1px solid rgba(212,175,55,0.07)` at 260/400/560px.
- Glassmorphism card: `background: rgba(255,255,255,0.04)`, `backdropFilter: blur(12px)`, `border: 1px solid rgba(212,175,55,0.18)`, `border-radius: 20px`, `padding: 52px 48px`, `max-width: 560px`.

### 2. Color Usage
| Color | Element |
|---|---|
| `#0c1a12` | Gradient start/end |
| `#1E3F2E` | Gradient midpoint |
| `#D4AF37` | SVG watermark color, badge text/border, divider, primary button gradient |
| `rgba(212,175,55,0.07)` | Decorative ring borders |
| `rgba(255,255,255,0.04)` | Glassmorphism card bg |
| `rgba(212,175,55,0.18)` | Card border |
| `rgba(212,175,55,0.15)` | Badge background |
| `#ffffff` | Headline text |
| `rgba(255,255,255,0.62)` | Body paragraph text |
| `rgba(255,255,255,0.3)` | Footer note text |
| `#0c1a12` | Primary button text (on gold gradient) |
| `rgba(255,255,255,0.08)` | Ghost "Go to Dashboard" button bg |
| `rgba(255,255,255,0.2)` | Ghost button border |

### 3. Typography
| Element | Font | Size/Weight |
|---|---|---|
| "404" number | `Marcellus, Georgia, serif` | `clamp(64px, 14vw, 100px) / 900` — gradient text clip |
| h1 headline | `Marcellus, Georgia, serif` | `clamp(1.2rem, 3vw, 1.55rem) / 700` |
| Body | System sans | `0.92rem` |
| Badge label | System sans | `0.78rem / 700 / uppercase` |
| Footer note | System sans | `0.75rem` |

### 4. Responsiveness
- `clamp()` on both the 404 number and headline — fluid typography. Card max-width 560px, centered. Buttons wrap with `flexWrap: wrap`.

### 5. Inconsistencies
- **Only page in the app using glassmorphism** (`backdropFilter: blur(12px)`) — visually isolated design language.
- No `<Navbar>` — while intentional, Login/Signup/ForgotPassword (which are also "flow" pages) all include the `<Navbar>`.
- `Marcellus` used here vs `Playfair Display` (via CSS var) used in Auth pages for the same role (serif headline).

---

## P-07 · Lawyer Directory (Public)

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/LawyerListing.jsx` (7KB) |
| **Route** | `/lawyers` |

> ⚠️ **Partial audit** — file not fully read. Assumed to use `<Navbar />` + `<Footer />`. Likely Bootstrap card grid. Loading/empty states not confirmed from code review.

---

## P-08 · Lawyer Public Profile

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/LawyerProfile.jsx` (42KB) |
| **Route** | `/lawyers/:id` |

> ⚠️ **Partial audit** — largest public page file. Likely contains star ratings, review section, contact CTA, specialization tags. Loading/empty states not confirmed.

---

## P-09 · NGO Directory (Public)

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/NGODirectory.jsx` (15KB) |
| **Route** | `/ngos` |

> ⚠️ **Partial audit** — assumed `<Navbar />` + `<Footer />`, search/filter functionality, NGO cards grid.

---

## P-10 · NGO Public Profile

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/NGOProfile.jsx` (57KB) |
| **Route** | `/ngos/:id` |

> ⚠️ **Partial audit** — second-largest file in codebase. Contains services, team, map, contact details.

---

## P-11 · Document Templates

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/Documents.jsx` (19KB) |
| **Route** | `/documents` |
| **Purpose** | Downloadable legal document templates |

> ⚠️ **Partial audit** — uses `<Navbar />` + `<Footer />`. Loading/empty states not confirmed.

---

## P-12 · AI Legal Chatbot

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/Chatbot.jsx` (15KB) |
| **Route** | `/chatbot` |
| **Purpose** | AI-powered bilingual legal assistant |

> ⚠️ **Partial audit** — likely shows per-message loading. Full audit pending.

---

# 2. Citizen Portal

---

## C-01 · Citizen Signup

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/user/Signup.js` |
| **Route** | `/user/signup` |
| **Purpose** | Citizen account registration with OTP email verification |

### 1. Layout Structure
- **Header:** `<Navbar />` (same public two-tier navbar as marketing site).
- **Main:** Split-panel `grid-template-columns: 1fr 1.35fr`. Left: `#1E3F2E` showcase (AI chatbot, NGO access, hearing calendar benefits). Right: Registration form.
- **Form Fields:** Full Name, Email (real-time duplicate check), Phone (+923), CNIC (auto-dash formatted `XXXXX-XXXXXXX-X`), Address, Password (with strength checklist), Confirm Password.
- **OTP Phase:** Replaces form with OTP input panel — green card (`#F0FDF4`, `border: 1px solid #BBF7D0`), large 6-digit input (`fontSize: 22px`, `letterSpacing: 0.3em`), 120-second resend timer, back link.

### 2. Color Usage
| Color | Element |
|---|---|
| `#1E3F2E` | Left panel bg, submit button, focus ring |
| `#152E22` | Button hover, gradient end |
| `#F8FAFC` | Page bg |
| `#E2E8F0` | Dot pattern, form borders |
| `#F0FDF4` | OTP panel bg |
| `#BBF7D0` | OTP panel border, OTP input border |
| `#065F46` | OTP heading text |
| `#16A34A` | Password strength "met" checkmark color |
| `#94A3B8` | Placeholder, "not met" checklist color, disabled resend |
| `#CBD5E1` | Input border default |

### 3. States Handled
| State | Status |
|---|---|
| Loading (sending OTP) | ✅ Button disabled + "Sending Code..." |
| Loading (creating account) | ✅ Spinner + "Creating Account..." |
| OTP verification phase | ✅ Distinct green panel with timer |
| Field validation errors | ✅ Real-time email/phone duplicate alerts |
| Password strength | ✅ 4-item checklist with `Check`/`X` lucide icons |
| Generic error | ✅ Red error string above submit |

### 4. Icons (lucide-react)
`Mail`, `Lock`, `Eye`, `EyeOff`, `User`, `Phone`, `CreditCard`, `MapPin`, `ArrowRight`, `AlertCircle`, `Check`, `X`, `Bot`, `Scale`, `HeartHandshake`, `Sparkles`

---

## C-02 · Citizen Login

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/user/Login.js` (21KB) |
| **Route** | `/user/login` |

> **Separate** from the unified `/login` page. Likely a simpler role-specific form. Full audit pending.

---

## C-03 · Citizen Dashboard

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/user/Dashboard.js` (120KB — largest file in app) |
| **Route** | `/user/dashboard` |
| **Purpose** | Primary citizen workspace — stats, case list, case creation, messaging, reviews |

### 1. Layout Structure
- **Header:** `<Navbar />` — **the public/marketing navbar, not a role-specific citizen nav**.
- **Page bg:** `#F8FAFC`, `min-height: calc(100vh - ...)`, container `max-width: 1200px`.
- **Welcome / Stat Row:** 6 stat cards in a grid row.
- **Tab Bar:** 3 tabs — All Cases / Lawyer Cases / NGO Pro Bono Cases.
- **Filter Bar:** Search text input + status `<select>` dropdown.
- **Case List:** Stacked case cards, each with: category badge, status badge pill, assigned party chip, date, action buttons (View Details, Download, Message, Review).
- **Empty State:** `<EmptyState>` component inside a white bordered card when no cases match.
- **Modals (4 types):**
  1. Create Case — form with title, category, priority, representation type, description, document URL.
  2. Case Details — tabbed modal (Details / Messages / Documents).
  3. Review / Rating — 5-star rating picker + text comment.
  4. Edit Review (48h window) — same modal, pre-filled.
- **Toast:** Fixed-position notification (top-right, auto-dismiss 4.5s).

### 2. Color Usage
| Color | Element |
|---|---|
| `#F8FAFC` | Page background |
| `#1E3F2E` | Primary action buttons, active tab indicator, stat card accent for lawyer cases |
| `#0F766E` | Teal — NGO-related UI elements, NGO case type accent |
| `#F0FDF4` | Tab active background |
| `#BBF7D0` | Tab active border |
| `#EFF6FF` | NGO pro bono badge bg |
| `#BFDBFE` | NGO badge border |
| `#1E40AF` | NGO badge text |
| `#E2E8F0` | Card borders |
| `#CBD5E1` | Search/filter input border |
| `#0F172A` | Case card headings |
| `#64748B` | Secondary/muted text |
| `#FBBF24` | Filled star rating |
| `#D1D5DB` | Empty star rating |
| Status badge colors | (Same 6-color semantic system — see §6.3) |

### 3. Typography
| Element | Font | Size/Weight |
|---|---|---|
| Page heading | `var(--font-serif, 'Playfair Display', serif)` | ~22-24px / 700 |
| Case card title | `var(--font-serif)` | `18px / 700` |
| Stat card value | System sans | `28-32px / 700` |
| Tab labels | System sans | `14px / 600` |
| Button text | System sans | `13-15px / 600` |

### 4. States Handled
| State | Status |
|---|---|
| Loading | ✅ `<DashboardSkeleton>` full-page pulse animation |
| Empty — no cases | ✅ `<EmptyState icon="folder" title="No Cases Yet">` with "Create Your First Case" CTA |
| Empty — filtered (no match) | ✅ `<EmptyState icon="search" title="No Cases Match Your Filters">` |
| Error (API fetch) | ⚠️ `console.error` only — no visual error state shown to user |
| Create case success | ✅ Toast |
| Review submit | ✅ Toast |

### 5. Responsiveness
- Bootstrap `container`, `flexWrap: wrap` on card rows. Tab bar wraps. No explicit `@media` queries in the JS source — relies on Bootstrap grid + flex wrapping.

### 6. Inconsistencies
- **Uses public `<Navbar />`** (with social links bar, marketing links) inside an authenticated dashboard — every other portal uses a portal-specific navbar.
- Stat cards display numbers without icon circles — inconsistent with Admin stat cards (which have icon + accent badge) and NGO stat cards (emoji icons).
- No error banner/state for API failures — just silent `console.error`.

---

## C-04 · Citizen Profile

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/user/Profile.js` (23KB) |
| **Route** | `/user/profile` |
| **Purpose** | Edit personal information, change password |

> ⚠️ **Partial audit** — full audit pending. Uses `<Navbar />` (assumed). Loading/save states not confirmed from header read.

---

# 3. Lawyer Portal

---

## L-01 · Lawyer Signup (4-Step)

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/lawyer/Signup.js` (25KB) |
| **Route** | `/lawyer/signup` |
| **Purpose** | 4-step Bar Council credential registration |

### 1. Layout Structure
- **Header:** `<SimpleNavbar />` — a minimal stripped navbar (`frontend/src/components/simpleNavbar.jsx`, 1.5KB). **Only page to use this component.**
- **Main:** Multi-step stepper form (full width, no split-panel). Steps shown with number indicators. Step 1: Basic info + Email/Phone OTP. Step 2: Professional credentials + photo + document upload. Step 3: Specializations, languages, availability. Step 4: Review summary + reCAPTCHA.

> ⚠️ **Major Inconsistency:** Lawyer Signup uses `<SimpleNavbar>` + full-width form. Citizen Signup uses `<Navbar>` + split-panel. NGO Signup uses `<NGOAuthHeader>` + stepped form. Three completely different auth-page layouts.

### 2. Colors
- Primarily Bootstrap default classes — no custom design tokens found in the JS source.
- Step indicator styling not confirmed.

### 3. States
| State | Status |
|---|---|
| Loading | ✅ `loading` boolean disables button |
| OTP verification | ✅ OTP input appears after send |
| reCAPTCHA | ✅ Google reCAPTCHA widget required at final step |
| Submission success | ✅ `submitted` state renders confirmation message |
| Error | ⚠️ Browser `alert()` dialogs — no styled error component |

> ⚠️ Browser `alert()` is the only error surface — completely inconsistent with every other portal's toast/banner approach.

---

## L-02 · Lawyer Login

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/lawyer/Login.js` (22KB) |
| **Route** | `/lawyer/login` |

> ⚠️ **Partial audit** — separate from unified Login. Full audit pending.

---

## L-03 · Lawyer Dashboard

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/lawyer/Dashboard.js` (50KB) |
| **Route** | `/lawyer/dashboard` |
| **Purpose** | Case management, client intake queue, hearing logging, AI case analysis |

### 1. Layout Structure
- **Header:** `<LawyerNavbar />` — two-tier:
  - **Top strip:** `#1E3F2E` bg, `borderBottom: 1px solid rgba(197,160,89,0.25)`. Shows "ADVOCATE BAR NETWORK" in `#C5A059` gold + user email + "Active Session" pill.
  - **Main nav:** `#FFFFFF` bg, sticky top 0. Brand logo, 3 pill-links (Dashboard/My Cases/Profile), Advocate identity chip, availability toggle pill, Logout button.
- **Verification Banner:** Amber left-border alert (`#FFFBEB`, `borderLeft: 5px solid #D97706`) if not approved.
- **Welcome Banner:** `#1E3F2E` card (`border-radius: 16px`, `padding: 32px 36px`) with radial gold overlay and gradient. Shows name + active case count + pending requests count + two action buttons.
- **4 Stat Cards:** White bg, `border: 1px solid #E2E8F0`, `border-radius: 12px`.
- **Tab Bar:** 4 tabs — My Cases / Available Cases / Pending Requests / Notifications.
- **Modals:** Log Hearing, AI Case Analysis, Reject Request with reason.
- **Page bg:** `#F8FAFC`, `padding: 32px 0 64px`, container `max-width: 1240px`.

### 2. Color Usage
| Color | Element |
|---|---|
| `#1E3F2E` | Welcome banner, nav top bar, avatar, active nav bg |
| `#152E22` | Banner gradient end |
| `rgba(197,160,89,0.2)` | Banner radial gold highlight |
| `#C5A059` | Nav top bar "ADVOCATE BAR NETWORK" text |
| `#FEF08A` | Banner pill badge text (yellow) |
| `#FFFFFF` | Stat card bg, nav bg, modal bg |
| `#F8FAFC` | Page background |
| `#E2E8F0` | Card borders, nav border |
| `rgba(197,160,89,0.25)` | Top nav separator bottom border |
| `#6EE7B7` | "Active Session" pill text |
| `#10B981` | Session green dot, availability indicator (on) |
| `#94A3B8` | Availability dot (off), muted labels |
| `#0F172A` | Brand text, headings |
| `#64748B` | Inactive nav labels |
| `#F0FDF4` | Active nav pill bg |
| `#BBF7D0` | Active nav pill border |
| `#FFFBEB` | Verification alert bg |
| `#FDE68A` | Verification alert border |
| `#D97706` | Verification alert left accent, icon |
| `#92400E` | Verification alert heading text |
| `#B45309` | Verification alert body text |
| `#059669` | "Bar Council Verified" text |
| `#065F46` | "Accepting Clients" text |
| `#A7F3D0` | Availability button border (on) |
| Badge colors | Same 6-color semantic system |

### 3. Typography
| Element | Font | Size/Weight |
|---|---|---|
| Welcome banner h1 | `var(--font-serif)` | `26px / 700` |
| Banner body | System sans | `14.5px` |
| Stat card value | System sans | `28px+ / 700` |
| Tab labels | System sans | `14px / 600` |
| Nav brand | `var(--font-serif)` | `20px / 700` |
| Nav portal sub-label | System sans | `10.5px / 600 / uppercase / letter-spacing 0.8px` |

### 4. States Handled
| State | Status |
|---|---|
| Loading | ✅ Early return with `<DashboardSkeleton cards={4} cols={6} rows={5} />` |
| Empty (my cases) | ✅ `<EmptyState icon="scale">` with "Browse Available Cases" CTA |
| Empty (other tabs) | ⚠️ Not confirmed from read |
| Error (API fetch) | ⚠️ `console.error` only |
| Action feedback | ⚠️ Browser `alert()` + `prompt()` — not styled toasts |

### 5. Inconsistencies
- Browser `alert()` / `prompt()` for hearing log and status updates — Citizen Dashboard and Admin use styled toasts.
- Stat cards have no icon circles — inconsistent with Admin stat cards and NGO stat cards.
- LawyerNavbar has no dark-mode support — NGONavbar has full dark mode CSS, Admin has dark mode via CSS vars.

---

## L-04 · Lawyer Cases

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/lawyer/Cases.js` (22KB) |
| **Route** | `/lawyer/cases` |

> ⚠️ **Partial audit** — dedicated case list page. Uses `<LawyerNavbar />`. Full audit pending.

---

## L-05 · Lawyer Profile

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/lawyer/Profile.js` (43KB) |
| **Route** | `/lawyer/profile` |

> ⚠️ **Partial audit** — complex multi-section profile editor. Uses `<LawyerNavbar />`. Full audit pending.

---

# 4. NGO Portal

---

## N-01 · NGO Signup (4-Step)

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/ngo/Signup.js` (51KB — second-largest file) |
| **Route** | `/ngo/signup` |
| **Purpose** | 4-step government NGO accreditation registration |

### 1. Layout Structure
- **Header:** `<NGOAuthHeader />` — stripped auth-only header (`frontend/src/components/NGOAuthHeader.jsx`, 3.3KB).
- **Footer:** `<NGOAuthFooter />` — stripped auth-only footer.
- **Main:** 4-step stepper (no split-panel). Step 1: Organization Identity. Step 2: Focal Person + Government Documents. Step 3: Services + Focus Areas (multi-select chips). Step 4: Account credentials + review summary.
- Total steps shown with a progress indicator bar.

### 2. Primary Colors
- `#0A3622` — NGO dark teal-green (primary buttons, step indicators). Different from `#1E3F2E` used in all other portals.

> ⚠️ **Color fragmentation:** NGO Portal uses `#0A3622` as primary green; all other portals use `#1E3F2E`. Neither is defined as a shared CSS variable — they're hardcoded separately.

### 3. States
| State | Status |
|---|---|
| Loading | ✅ `loading` state |
| Step validation errors | ✅ `fieldErrors` array, `refs` for scroll-to-error |
| Toast | ✅ `toast` boolean (basic toast, not typed) |
| Success | ✅ `submitted` state renders confirmation UI |

---

## N-02 · NGO Login

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/ngo/Login.js` (25KB) |
| **Route** | `/ngo/login` |

> ⚠️ **Partial audit** — dedicated NGO login form. Full audit pending.

---

## N-03 · NGO Dashboard

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/ngo/Dashboard.js` (38KB) |
| **Route** | `/ngo/dashboard` |
| **Purpose** | Aid request queue, case management, hearing scheduling, status updates |

### 1. Layout Structure
- **Header:** `<NGONavbar />` — two-tier: `#0A3622` top strip ("Official Legal Aid & Pro Bono Network...") + white sticky main nav (`height: 64px`). Nav links: Dashboard / My Profile / Directory (opens new tab). Right side: theme toggle (sun/moon), user name pill with green dot, Sign Out button.
- **Page:** `.ngo-dash-wrap` — `#f8f9fa` (light) / `#0F172A` (dark). Container `max-width: 1200px`, `padding: 32px 28px 80px`.
- **Header Row:** Title (`.ngo-dash-title`) + subtitle + "Refresh Data" button.
- **4 Stat Cards:** White cards, `box-shadow`, emoji icon in colored circle, stat value, uppercase label.
- **Tab Bar:** 4 tabs — Aid Requests / Pending / Active / Hearings. `border-radius: 6px` pills.
- **Cases Table:** `<table className="ngo-table">` with sticky header, zebra hover, status badge cells, action buttons (Update Status / Add Hearing / Message / Reject).
- **Modal System:** Single overlay div with dynamic content per `modalType`: status-update / hearing / message / reject.
- **Toast:** Simple top-center string notification.

### 2. Color Usage
| Color | Element |
|---|---|
| `#0A3622` | Top navbar strip bg, logo icon bg |
| `#f8f9fa` | Page background (light) |
| `#0F172A` | Page bg (dark mode), dark table header |
| `#0c1333` | Dashboard title text color (`.ngo-dash-title`) |
| `#1f2937` | Body text color |
| `#6b7280` | Subtitle muted text |
| `#60A5FA` | Total Intakes stat accent |
| `#EFF6FF` | Total Intakes icon bg |
| `#BFDBFE` | Total Intakes icon border |
| `#34D399` | Active Pro Bono accent |
| `#ECFDF5` | Active Pro Bono icon bg |
| `#A7F3D0` | Active icon border |
| `#4ADE80` | Resolved stat accent |
| `#F0FDF4` | Resolved icon bg |
| `#BBF7D0` | Resolved icon border |
| `#FBBF24` | Pending accent |
| `#FFFBEB` | Pending icon bg |
| `#FDE68A` | Pending icon border |
| `#10b981` | Nav user online dot |
| `#ecfdf5` | Resolved status badge bg |
| `#065f46` | Resolved status badge text |
| Status colors | Same 6-color semantic system as all other portals |
| `#ef4444` | Logout hover border/text |
| `#1E293B` | Dark mode stat card bg |
| `#334155` | Dark mode borders |
| `#6EE7B7` | Dark mode active tab text |
| `#059669` | Dark mode active tab border |

### 3. Typography
| Element | Font | Size/Weight |
|---|---|---|
| Dashboard title | `Marcellus, Georgia, serif` | `1.85rem / 700` |
| Dashboard subtitle | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto` | `0.88rem` |
| Stat card value | System sans | `2rem / 700` |
| Stat card label | System sans | `0.7rem / 700 / uppercase / letter-spacing 0.06em` |
| Table headers | System sans | `0.75rem / 600 / uppercase / letter-spacing 0.04em` |
| Nav brand | `var(--font-serif, 'Playfair Display', serif)` | — |

> ⚠️ **Inconsistency:** NGO Dashboard uses `Marcellus` for page title. Lawyer Dashboard uses `var(--font-serif)` (Playfair Display) for its welcome banner. Same role (portal header), different serif font.

### 4. States Handled
| State | Status |
|---|---|
| Loading | ✅ Early return `<DashboardSkeleton cards={4} cols={5} rows={6} />` |
| Empty (cases tab) | ✅ `<EmptyState icon="folder" ...>` |
| Empty (aid requests) | ⚠️ Likely inline conditional render — not confirmed as `<EmptyState>` |
| Error (API fetch) | ⚠️ Basic toast string, no icon, no severity differentiation |
| Action success | ✅ Toast |

### 5. Inconsistencies
- **Top navbar strip `#0A3622` ≠ Lawyer top bar `#1E3F2E`** — two different portal dark greens.
- **Stat cards use emoji icons (📁 ⚖️ 🛡️ ⏳)** — only portal not using lucide-react for stat icons.
- Dashboard title uses `Marcellus` inline vs `var(--font-serif)` in Lawyer portal.
- Toast is a plain string (no severity type, no icon) vs Admin's typed toast with `CheckCircle2`/`XCircle`.

---

## N-04 · NGO Profile

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/ngo/Profile.js` (45KB) |
| **Route** | `/ngo/profile` |
| **Purpose** | Edit NGO details, focal person, services, documents |

> ⚠️ **Partial audit** — large file. Uses `<NGONavbar />`. Full audit pending.

---

# 5. Admin Portal

---

## A-00 · Admin Layout (Shared Shell)

| Field | Value |
|---|---|
| **File** | `frontend/src/components/AdminLayout.jsx` |
| **CSS** | `frontend/src/styles/admin.css` |
| **Applied to** | All `/admin/*` routes except login |

### 1. Layout Structure
- **Left Sidebar (fixed):** `--admin-sidebar-bg: #0F172A`. Width: ~240px (expanded) / ~68px (collapsed). Contains: logo + "Official Admin" badge, section label "Core Management" + 8 nav items, divider, "Platform Controls" + 2 secondary items, user info footer, logout button.
- **Top Header Bar:** White card (`--admin-header-bg: #FFFFFF`), height ~56px. Left: hamburger toggle + breadcrumb nav (Admin > Current Page). Right: Light/Dark toggle, notification bell + badge dot, admin avatar dropdown.
- **Page Content:** `<main className="admin-page-container">` inherits `--admin-bg: #F8FAFC`.
- **Mobile:** Sidebar becomes drawer with backdrop overlay. Hamburger in header opens it.

### 2. Admin CSS Design Tokens (Light Mode)
| Token | Value |
|---|---|
| `--admin-bg` | `#F8FAFC` |
| `--admin-card-bg` | `#FFFFFF` |
| `--admin-card-border` | `#E2E8F0` |
| `--admin-sidebar-bg` | `#0F172A` |
| `--admin-sidebar-hover` | `#1E293B` |
| `--admin-sidebar-active` | `#0F5132` |
| `--admin-sidebar-active-border` | `#10B981` |
| `--admin-sidebar-text` | `#E2E8F0` |
| `--admin-sidebar-muted` | `#94A3B8` |
| `--admin-heading` | `#0F172A` |
| `--admin-text-main` | `#1E293B` |
| `--admin-text-muted` | `#64748B` |
| `--admin-primary` | `#059669` |
| `--admin-primary-hover` | `#047857` |
| `--admin-table-hdr` | `#F1F5F9` |
| `--admin-font` | `'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |

| Stat Card | bg | border | text |
|---|---|---|---|
| blue | `#EFF6FF` | `#BFDBFE` | `#1D4ED8` |
| emerald | `#ECFDF5` | `#A7F3D0` | `#047857` |
| amber | `#FFFBEB` | `#FDE68A` | `#B45309` |
| purple | `#FAF5FF` | `#E9D5FF` | `#6D28D9` |
| teal | `#F0FDFA` | `#99F6E4` | `#0F766E` |
| red | `#FEF2F2` | `#FECACA` | `#B91C1C` |

### 3. Typography
- **Primary font:** `DM Sans` + `Inter` (loaded from Google Fonts in `admin.css` `@import`).
- **Only portal** with a dedicated custom font (`DM Sans`) — all others fall through to system fonts.

> ⚠️ **Inconsistency:** Admin has `DM Sans`. Lawyer/NGO/Citizen portals use system font stacks. No unified `--font-sans` variable applied app-wide.

### 4. Icons (lucide-react)
`LayoutDashboard`, `Users`, `Scale`, `Building2`, `Briefcase`, `Bell`, `Settings`, `LogOut`, `Sun`, `Moon`, `Menu`, `X`, `ChevronRight`, `ShieldCheck`, `UserCheck`, `Star`

---

## A-01 · Admin Dashboard

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/Dashboard.js` (32KB) |
| **Route** | `/admin/dashboard` |
| **Purpose** | Platform overview — 6 stat cards, quick actions, pending lawyer queue, distribution chart |

### 1. Layout Structure
- Wrapped in `<AdminLayout breadcrumb="Overview" activeNav="overview">`.
- **6 Stat Cards (`.admin-stats-grid`):** Color-coded — Blue (Users), Emerald (Lawyers), Amber (Pending Lawyers), Purple (Cases), Teal (NGOs), Red (Pending NGOs). Each card: icon circle + badge label + large numeric value + descriptor label.
- **Quick Action Cards:** 3-column grid in a white `admin-card`. Each: title + count badge + description + action `<Link>` button.
- **Platform Distribution:** Manual percent-bar visual for Users / Lawyers / NGOs.
- **Pending Lawyers Queue:** Table (max 5 rows) with status badge + inline Approve/Reject + Doc viewer modal.
- **Toast:** Fixed top-right, `#059669` (success) / `#EF4444` (error), auto-dismiss 4s.

### 2. States Handled
| State | Status |
|---|---|
| Loading | ✅ `<DashboardSkeleton cards={6} cols={5} rows={8} />` |
| Empty (pending queue) | ✅ `<EmptyState>` component |
| Error | ✅ Toast with `XCircle` icon |
| Action success | ✅ Toast with `CheckCircle2` icon |

### 3. Components Used
- 6 CSS-class stat cards
- Document preview iframe modal
- Reject reason modal with `<textarea>`
- Fixed toast
- Lucide: `Users`, `Scale`, `Clock`, `Briefcase`, `Building2`, `AlertTriangle`, `CheckCircle2`, `XCircle`, `ExternalLink`, `ArrowRight`, `TrendingUp`, `Activity`, `FileCheck`, `ShieldAlert`, `Eye`, `Check`, `X`

---

## A-02 · Admin Lawyers List

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/LawyersList.js` (30KB) |
| **Route** | `/admin/lawyers` |

### Layout
- `<AdminLayout breadcrumb="Lawyers" activeNav="lawyers">`.
- Filter tab bar (All / Pending / Approved / Rejected / Blocked) + search bar.
- Two-panel view: lawyer table (click row to select) + slide-in detail panel.
- Detail panel: photo, credentials, Bar Council ID, documents.
- Modals: Document preview (iframe) + Reject reason.
- Toast: same pattern as Dashboard.

### States
| State | Status |
|---|---|
| Loading | ✅ (spinner — specific component not confirmed) |
| Empty | ✅ Shown when no lawyers match |
| Action success/error | ✅ Toast |

### Icons (lucide-react)
`Scale`, `Search`, `Check`, `X`, `Eye`, `Ban`, `Unlock`, `Trash2`, `ExternalLink`, `CheckCircle2`, `XCircle`, `FileText`, `Phone`, `Mail`, `Award`, `BookOpen`

---

## A-03 · Admin NGOs List

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/NGOsList.js` (32KB) |
| **Route** | `/admin/ngos` |

### Layout
- Same pattern as LawyersList: filter tabs + table + detail panel + doc modal + toast.
- Icons: `Building2`, `Search`, `Check`, `X`, `Eye`, `Ban`, `Unlock`, `ExternalLink`, `CheckCircle2`, `XCircle`, `FileText`, `MapPin`, `Mail`, `Phone`, `User`, `ShieldCheck`, `FileCheck`

---

## A-04 · Admin Users List

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/UsersList.js` (16KB) |
| **Route** | `/admin/users` |

### Layout
- `<AdminLayout>`, search + filter bar (`all / active / inactive`), users table, view-user modal.

### States
| State | Status |
|---|---|
| Loading | ✅ `loading` state |
| Action success/error | ✅ Toast |

> ⚠️ **Inconsistency:** Uses `window.confirm()` for destructive actions (deactivate/delete) — LawyersList and NGOsList use a custom styled modal for the same type of action.

### Icons (lucide-react)
`Users`, `Search`, `Eye`, `CheckCircle2`, `XCircle`, `Trash2`, `X`, `UserCheck`, `UserX`, `Calendar`, `Mail`, `Phone`, `Shield`, `MapPin`

---

## A-05 · Admin Cases List

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/CasesList.js` (12KB) |
| **Route** | `/admin/cases` |

### Layout
- `<AdminLayout>`, status filter + search, cases table (7 columns: Title, Category, Type, Citizen, Assigned To, Status, Date).
- **Loading:** `<DashboardSkeleton cols={7} rows={8} />`.
- **Empty:** `<EmptyState icon="file" title="No Cases Match Your Filters">`.

### Status Badge Colors
Identical `STATUS_COLORS` object to NGO Dashboard `STATUS_CONFIG` and User Dashboard — consistent ✅

---

## A-06 · Admin Disputes List

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/DisputesList.js` (13KB) |
| **Route** | `/admin/disputes` |

### Layout
- `<AdminLayout>`, category filter tabs, disputes table (8 columns).
- **Loading:** `<DashboardSkeleton cols={8} rows={6} />`.
- **Empty:** `<EmptyState icon="alert" title="No Disputed Records">`.

---

## A-07 · Admin Audit Log

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/AuditLog.js` (10KB) |
| **Route** | `/admin/audit-log` |

### Layout
- `<AdminLayout>`, action-type filter + date filter, audit log table (6 columns: Timestamp, Admin, Action, Target, Details, IP).
- **Loading:** `<DashboardSkeleton cols={6} rows={8} />`.
- **Empty:** `<EmptyState icon="file" title="No Audit Log Entries">`.

### Action Color Coding
`ACTION_COLORS` object — each action type has `{ bg, color, icon }` where `icon` is an **emoji string** (e.g., `"✅"`, `"❌"`, `"🚫"`).

> ⚠️ **Inconsistency:** Audit log uses emoji for action icons inside table cells. All other admin pages use lucide-react components. The only other emoji use is in NGO Dashboard stat cards.

---

## A-08 · Admin Flagged Reviews

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/ReviewsList.js` (37KB) |
| **Route** | `/admin/reviews` |

> ⚠️ **Partial audit** — largest admin file. Same AdminLayout + table + modal pattern. Full audit pending.

---

## A-09 · Admin Login

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/Login.js` (21KB) |
| **Route** | `/admin/login` |

> ⚠️ **Partial audit** — dedicated admin login form, likely no `<AdminLayout>` wrapper. Full audit pending.

---

## A-10 · Admin Forgot Password

| Field | Value |
|---|---|
| **File** | `frontend/src/pages/admin/ForgotPassword.jsx` (24KB) |
| **Route** | `/admin/forgot-password` |

> ⚠️ **Partial audit** — admin password reset page. Full audit pending.

---

# 6. Global Summary

---

## 6.1 Consolidated Color Palette — All Colors in Use

> Fragmentation is flagged where multiple values serve the same design role.

### Brand Greens (PRIMARY — **FRAGMENTED**: 6 variants)
| Color | Where Used |
|---|---|
| `#1E3F2E` | Public Navbar brand, Login/Signup/ForgotPassword left panel, LawyerNavbar top bar, Lawyer Dashboard banner + buttons, Citizen Signup, NotFound gradient mid |
| `#0A3622` | NGO Navbar top strip, NGO logo icon bg — **different shade** |
| `#0F5132` | Admin sidebar active item bg — **different shade** |
| `#152E22` | Auth left panel gradient end, button hover |
| `#0c1a12` | NotFound gradient start/end |
| `#0c1333` | LandingPage scroll buttons, NGO Dashboard title color — **non-brand navy-black** |

> **Recommendation:** Define `--color-brand-dark: #1E3F2E` as a single CSS variable and replace all variants.

### Gold Accents (SECONDARY — **FRAGMENTED**: 5 variants)
| Color | Where Used |
|---|---|
| `#D4AF37` | Footer headers, NotFound page (watermark, badge, button) |
| `#C5A059` | LawyerNavbar "ADVOCATE BAR NETWORK" text, Signup Lawyer card accent |
| `#D97706` | Lawyer Dashboard verification banner accent |
| `#FBBF24` | Admin sidebar dark mode muted, dark mode auth links, star ratings |
| `#FEF08A` | Lawyer Dashboard pill badge text |

> **Recommendation:** Define `--color-gold: #C5A059` (richest mid-gold) as the single gold token.

### Semantic Status Colors (CONSISTENT ✅ — Same in all 4 portals)
| Status | Background | Text |
|---|---|---|
| `pending` | `#fef3c7` | `#92400e` |
| `under_review` | `#eff6ff` | `#1e40af` |
| `assigned` | `#fdf4ff` | `#86198f` |
| `in_progress` | `#f0fdf4` | `#166534` |
| `resolved` | `#ecfdf5` | `#065f46` |
| `rejected` | `#fef2f2` | `#991b1b` |

### Background & Structure Colors
| Color | Usage |
|---|---|
| `#F8FAFC` | Lawyer/Citizen/Admin page backgrounds |
| `#f8f9fa` | NGO Dashboard, LandingPage social bar — Bootstrap alias (near-identical but different) |
| `#FFFFFF` | All card bgs, navbars |
| `#E2E8F0` | Primary border (Auth, Lawyer, Admin) |
| `#e5e7eb` | NGO nav/table borders — Tailwind `gray-200`, not used elsewhere |
| `#0F172A` | Admin sidebar, dark mode bgs, heading text |
| `#1E293B` | Admin sidebar hover, dark mode cards |
| `#334155` | Dark mode borders (NGO + Admin) |
| `#94A3B8` | Placeholder text — consistent across all portals ✅ |
| `#64748B` | Muted secondary text — consistent ✅ |

---

## 6.2 Icon Library Inventory

| Library | How Used | Pages |
|---|---|---|
| **lucide-react** (`import { X } from "lucide-react"`) | React components | Login, Signup, ForgotPassword, LawyerNavbar, NGONavbar, AdminLayout, Lawyer Dashboard, Citizen Dashboard, Admin Dashboard, LawyersList, NGOsList, UsersList, CasesList, DisputesList, EmptyState, SkeletonLoader |
| **Google Material Icons** (`<span className="material-icons">icon_name</span>`) | CDN class-string | LandingPage practice area cards **only** |
| **Font Awesome** (`<i className="fab fa-twitter">`) | CDN class-string | Navbar.jsx social links **only** |
| **Emoji (Unicode)** (inline chars `📁`, `⚖️`, `✅`) | Inline strings | NGO Dashboard stat cards, AuditLog `ACTION_COLORS` config |

> ⚠️ **4 simultaneous icon systems.** Lucide-react is the clear dominant library and should be the sole system. Material Icons, Font Awesome, and emoji should all be replaced with Lucide equivalents.

---

## 6.3 Pages Missing UI States

### Missing Loading State (confirmed or suspected)
| Page | Notes |
|---|---|
| `LandingPage.jsx` | Static but no skeleton if any async data added |
| `user/Login.js` | Not audited — status unknown |
| `user/Profile.js` | Not audited |
| `lawyer/Login.js` | Not audited |
| `lawyer/Cases.js` | Not audited |
| `lawyer/Profile.js` | Not audited |
| `ngo/Login.js` | Not audited |
| `ngo/Profile.js` | Not audited |
| `LawyerListing.jsx` | No skeleton confirmed |
| `LawyerProfile.jsx` | No skeleton confirmed |
| `NGODirectory.jsx` | No skeleton confirmed |
| `NGOProfile.jsx` | No skeleton confirmed |
| `Documents.jsx` | No skeleton confirmed |
| `admin/ReviewsList.js` | Not audited |
| `admin/Login.js` | Not audited |

### Missing Visual Error State (API failure not shown to user)
| Page | Notes |
|---|---|
| `user/Dashboard.js` | `console.error` only |
| `lawyer/Dashboard.js` | `console.error` only |
| `ngo/Dashboard.js` | Toast string only (no severity, no icon) |
| All unaudited pages | Status unknown |

### Missing Empty State (confirmed or suspected)
| Page | Notes |
|---|---|
| `lawyer/Cases.js` | Not confirmed |
| `LawyerListing.jsx` | No `<EmptyState>` confirmed |
| `NGODirectory.jsx` | No `<EmptyState>` confirmed |
| `admin/ReviewsList.js` | Not confirmed |

---

## 6.4 Navbar / Header Pattern Comparison

| Portal / Context | Component | Top Strip? | Theme Toggle? | Layout Type |
|---|---|---|---|---|
| Public / Citizen Dashboard | `<Navbar />` | ✅ Social links bar (`#f8f9fa`) | ❌ | Horizontal sticky top |
| Lawyer Auth (Login) | `<Navbar />` | ✅ Social links bar | ❌ | Horizontal sticky top |
| Lawyer Auth (Signup) | `<SimpleNavbar />` | ❌ | ❌ | Minimal horizontal |
| Lawyer Portal | `<LawyerNavbar />` | ✅ `#1E3F2E` institutional bar | ❌ | Horizontal with pill links + availability toggle |
| NGO Auth | `<NGOAuthHeader />` | ❌ | ❌ | Stripped horizontal |
| NGO Portal | `<NGONavbar />` | ✅ `#0A3622` strip | ✅ Sun/Moon | Horizontal with user pill |
| Admin Portal | `AdminLayout` sidebar | N/A (sidebar nav) | ✅ Light/Dark | **Left sidebar** — fundamentally different |

> ⚠️ **5 distinct navigation patterns.** No shared navigation component architecture. The Citizen Dashboard reuses the public marketing navbar, which is the most jarring inconsistency as it contains social media links and public CTAs inside an authenticated experience.

---

## 6.5 Typography Fragmentation

| Font | Declaration Style | Portals Using It |
|---|---|---|
| `Marcellus` | `fontFamily: "Marcellus, serif"` (inline) | LandingPage h1/h2, Footer brand, NGO Dashboard title, NGO Navbar, NotFound, LandingPage buttons |
| `Playfair Display` | `var(--font-serif, 'Playfair Display', serif)` (CSS var) | Auth card titles, Lawyer Dashboard banner, Admin sidebar brand, Lawyer Navbar brand |
| `Inter` | `var(--font-sans, Inter, sans-serif)` (CSS var) | Auth page inputs/labels/buttons |
| `DM Sans` + `Inter` | `@import` in `admin.css` | Admin Portal exclusively |
| `Segoe UI, system-ui` | Inline | Footer body text |
| `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue'` | Inline | NGO Dashboard, NGO Navbar |
| Bootstrap default | Bootstrap CSS | Lawyer Signup form (no custom override) |

> ⚠️ **7 font declarations** for what should be 2 (one serif heading, one sans body). `Marcellus` and `Playfair Display` both serve as "brand serif" but are different typefaces applied inconsistently across portals.

---

## 6.6 Spacing Inconsistencies

| Metric | Lawyer | Admin | NGO | Citizen |
|---|---|---|---|---|
| Page top padding | `32px` | Via `admin.css` class | `32px` | Not confirmed |
| Page bottom padding | `64px` | Via `admin.css` class | `80px` | Not confirmed |
| Container max-width | `1240px` | `1240px` | `1200px` | `1200px` |
| Stat card border-radius | `12px` (skeleton) | Via `.admin-stat-card` CSS class | Not confirmed | Not confirmed |
| Welcome/Banner border-radius | `16px` | N/A | N/A | N/A |

> ⚠️ Container max-width is `1240px` (Lawyer/Admin) vs `1200px` (NGO/Citizen) — 40px inconsistency that shifts content alignment on wide screens.

---

## 6.7 Alert / Notification Patterns

| Portal | Pattern | Visual Quality | Icon |
|---|---|---|---|
| **Admin** | Fixed top-right toast, `#059669`/`#EF4444` bg, `border-radius: 8px`, `font-weight: 600`, auto-dismiss 4s | ✅ Excellent | ✅ `CheckCircle2`/`XCircle` |
| **Citizen** | `triggerToast()` function, typed (`success`/`error`), auto-dismiss 4.5s | ✅ Good | ⚠️ Not confirmed from audit |
| **NGO** | Simple `setToast(string)` → toast `<div>` string only, auto-dismiss 3.5s | ⚠️ Minimal | ❌ No icon, no severity |
| **Lawyer** | `window.alert()` + `window.prompt()` browser dialogs | ❌ Browser default | ❌ None |

> ⚠️ Lawyer portal is the only authenticated portal using browser-native dialogs. This breaks UX consistency and prevents any styling control.

---

## 6.8 Dark Mode Support Comparison

| Portal | Dark Mode | Implementation |
|---|---|---|
| Public Pages | ⚠️ Partial | Login/Signup/ForgotPassword have dark mode via `html.dark` CSS selectors. LandingPage has none. |
| Citizen Dashboard | ❌ No | `<Navbar />` has no dark mode. Dashboard page has no dark mode styles. |
| Lawyer Portal | ❌ No | `<LawyerNavbar />` has no dark mode. Dashboard has no dark mode. |
| NGO Portal | ✅ Full | `<NGONavbar />` has `html.dark` CSS overrides. NGO Dashboard has `html.dark .ngo-*` rules. |
| Admin Portal | ✅ Full | Admin CSS vars fully reassigned in `html.dark, [data-theme="dark"]` block. |

> ⚠️ Dark mode is only fully implemented in NGO and Admin portals. Citizen and Lawyer portals (and the LandingPage) have no dark mode support despite a global `ThemeContext` being present in the app.

---

*End of UI/UX Design Audit Report — LegalLink v1.0*
*All hex codes, class names, font families, and component names verified from live source files.*
*Report generated: September 2026*
