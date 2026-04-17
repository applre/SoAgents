# SoAgents Website Design Spec

## Overview

SoAgents official website at soagents.io. Landing page + blog + docs, supporting Chinese and English, deployed on Cloudflare Pages.

## Tech Stack

| Item | Choice |
|------|--------|
| Framework | Astro 5 + `@astrojs/react` |
| Styling | TailwindCSS v4 (CSS-based `@theme` config, no JS config file) |
| Font | Inter (self-hosted), system CJK fallback |
| i18n | URL-based: `/` (zh, default), `/en/` |
| Blog | Astro Content Collections (Markdown) |
| Docs | Astro Content Collections (Markdown) |
| Deploy | Cloudflare Pages |
| Analytics | Cloudflare Web Analytics (GA unreliable in China) |
| SEO | SSG + hreflang + Schema.org structured data |
| Package Manager | bun |

## Brand

- **Slogan**: "The AI that works where you work"
- **Tagline**: "So personal, so powerful."
- **Chinese slogan**: "在你的世界里工作的 AI"
- **License**: MIT

## Design System

Reuse SoAgents desktop design tokens.

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--paper` | `#FFFFFF` | Page background |
| `--surface` | `#F7F7F7` | Card/section background |
| `--hover` | `#EFEFEF` | Hover state |
| `--ink` | `#1A1A1A` | Primary text |
| `--ink-secondary` | `#666666` | Secondary text |
| `--ink-tertiary` | `#999999` | Tertiary text |
| `--accent` | `#c26d3a` | Accent (warm brown) |
| `--accent-light` | `#e8a472` | Accent light variant |
| `--border` | `#E8E6E3` | Borders |
| `--error` | `#c25a3a` | Error/danger |
| `--success` | `#2e6f5e` | Success |

Light mode only (dark mode is future work, same as desktop app).

Sections alternate between `--paper` and `--surface` backgrounds for layering.

### Typography

- English: `Inter` (self-hosted, not Google Fonts)
- Chinese: `-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
- Monospace: `ui-monospace, 'SF Mono', monospace`

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, hamburger nav |
| Tablet | 768-1024px | Two columns |
| Desktop | > 1024px | Max 1200px, centered |

## Project Structure

```
soagents-website/
├── src/
│   ├── components/        # React interactive components
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── BlogLayout.astro
│   │   └── DocsLayout.astro
│   ├── pages/
│   │   ├── index.astro            # zh landing
│   │   ├── 404.astro              # 404 page (bilingual)
│   │   ├── en/
│   │   │   └── index.astro        # en landing
│   │   ├── blog/
│   │   │   ├── index.astro        # zh blog list
│   │   │   └── [...slug].astro    # zh blog post
│   │   ├── en/blog/
│   │   │   ├── index.astro        # en blog list
│   │   │   └── [...slug].astro    # en blog post
│   │   ├── docs/
│   │   │   ├── index.astro        # zh docs
│   │   │   └── [...slug].astro
│   │   └── en/docs/
│   │       ├── index.astro        # en docs
│   │       └── [...slug].astro
│   ├── content/
│   │   ├── config.ts              # Content Collections schema
│   │   ├── blog/
│   │   │   ├── zh/
│   │   │   └── en/
│   │   └── docs/
│   │       ├── zh/
│   │       └── en/
│   ├── i18n/
│   │   ├── zh.json
│   │   └── en.json
│   └── styles/
│       └── global.css
├── public/
│   ├── images/
│   ├── fonts/
│   └── favicon.svg
├── astro.config.mjs
└── package.json
```

## Pages

### Landing Page (`/`)

9 sections in order:

1. **Nav** (fixed top, backdrop-blur)
   - Logo + Docs + Blog + GitHub Star + Language Switch + Download button (accent)

2. **Hero**
   - Title: "SoAgents" (accent color)
   - Subtitle: "The AI that works where you work"
   - Tagline: "So personal, so powerful."
   - CTA: Download for Mac + View on GitHub
   - Version badge
   - Product screenshot below

3. **Positioning** (surface background)
   - "From Task Tool to Personal Partner"
   - Two-column comparison: Traditional AI Tools vs SoAgents
   - Rows: Metaphor, Context, Capability, Model

4. **Why Desktop** (paper background)
   - "Why It Must Live in Your Computer"
   - 3 cards: Infinite Tools, Your Context, Your Identity

5. **Features** (surface background)
   - "See How It Works"
   - 4 feature blocks, left-right alternating:
     - Multi-Thread Conversations
     - Connect Your World (IM integration, "Key Highlight" badge)
     - Runs While You Sleep (scheduled tasks)
     - You Choose the AI (provider logo grid)

6. **Open Source** (surface background)
   - "Open Source, Because It Belongs to You"
   - Founder quote + Star on GitHub + MIT License

7. **Blog Preview** (paper background)
   - "Creator's Journal"
   - 3 latest blog cards + "View all posts" link

8. **FAQ** (surface background)
   - SoAgents and Claude Code CLI difference
   - Is it free?
   - Supported operating systems
   - Data safety
   - Supported AI models
   - How to configure API Key

9. **Footer**
   - Logo + copyright + GitHub + Email

### Blog (`/blog`)

- List page: article cards with date, tag, title, summary
- Article page: Markdown rendered + right-side TOC

### Docs (`/docs`)

- Three-column layout: sidebar nav | content | page TOC
- Mobile: sidebar collapses to hamburger, TOC hidden

## i18n Strategy

- URL-based routing: `/` = Chinese (default), `/en/` = English
- `hreflang` tags for SEO cross-referencing
- UI text from `i18n/zh.json` and `i18n/en.json`
- Blog/docs content in `content/{type}/{lang}/` directories
- Blog posts may be Chinese-only initially

## Deployment

- Platform: Cloudflare Pages
- Build: `astro build` outputs static files
- No ICP filing needed (`.io` domain on Cloudflare)
- Self-hosted Inter font (no Google Fonts dependency for China access)

## Download Button Behavior

- Auto-detect platform via `navigator.platform` / `navigator.userAgentData`
- Mac: show "Download for Mac (Apple Silicon)" as primary, "Mac (Intel)" in dropdown
- Windows: show "Download for Windows"
- Linux / unknown: show "View on GitHub" as primary
- Download URLs point to GitHub Releases (`https://github.com/applre/SoAgents/releases/latest`)
- Dropdown shows version number and all available platforms

## Content Collection Schema

### Blog frontmatter
```yaml
title: string        # required
date: date           # required
tag: string          # e.g. "Product", "Technical"
summary: string      # 1-2 sentence excerpt
lang: "zh" | "en"    # required
```

### Docs frontmatter
```yaml
title: string        # required
order: number        # sidebar sort order
section: string      # sidebar group name
lang: "zh" | "en"    # required
```

## Interactive Components (React Islands)

Components requiring `client:` directive:

- `LanguageSwitcher` — language toggle button
- `DownloadDropdown` — platform detection + download options
- `ImageCarousel` — product screenshot carousel
- `FaqAccordion` — collapsible FAQ items
- `MobileNav` — hamburger menu on mobile

## SEO

- Schema.org `SoftwareApplication` structured data on landing page
- `hreflang` alternate links for zh/en
- Open Graph + Twitter Card meta tags
- Sitemap via `@astrojs/sitemap`
- RSS feed for blog via `@astrojs/rss`
- Static HTML output (SSG) for full crawlability

## Reference

- Design preview: `/tmp/soagents-preview/index.html`
- SoAgents design guide: `specs/guides/design_guide.md`
