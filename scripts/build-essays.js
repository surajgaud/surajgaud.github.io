// Pre-renders each essay in data/*.md into a standalone, crawlable HTML page
// under essays/. Mirrors blog.html's client-side rendering (same `marked`
// options, same H1-as-title extraction, same relative-image fixups) so the
// static page and the blog.html?post= fallback render identically — the
// difference is this output ships real <h1>/meta/JSON-LD in the raw HTML,
// which crawlers that don't execute JS (GPTBot, ClaudeBot, PerplexityBot,
// CCBot) can read directly.
//
// Essay slug = markdown filename stem, unchanged (data/foo.md -> essays/foo.html)
// so index.html can derive the source .md from an essay URL by string
// substitution alone, with no separate mapping to keep in sync.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_URL = 'https://surajgaud.github.io';

// Manually curated per-essay metadata (mirrors blog.html's META object —
// dates/descriptions aren't reliably derivable from the markdown alone).
const META = {
    'distilling_session_data_into_figments.md': {
        tag: 'Essay', date: 'August 2026', iso: '2026-08-02',
        desc: "Coding sessions end and the reasoning dies with the transcript. Figment distills each session into decisions, rejected alternatives, and open threads, then feeds them back to the next session."
    },
    'eval_driven_development_for_aoe2_copilot.md': {
        tag: 'Essay', date: 'July 2026', iso: '2026-07-01',
        desc: "Building a real-time AoE2 copilot: spend the LLM only where judgment lives, run everything below it as deterministic reflexes, and test the whole thing with eval-driven development because TDD structurally can't."
    },
    'the_philosophy_of_the_permeable_mind.md': {
        tag: 'Essay', date: 'June 2026', iso: '2026-06-01',
        desc: 'On treating LLMs not as isolated chatbots but as a cognitive layer over our data: MCP, RAG, and designing the silent weaver.'
    }
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function readMinutes(mdBody) {
    const words = mdBody.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
}

function renderEssay(mdFilename) {
    const slug = mdFilename.replace(/\.md$/, '');
    const mdPath = path.join(ROOT, 'data', mdFilename);
    const raw = readFileSync(mdPath, 'utf-8');

    // Resolve relative image src (./foo.svg) against data/ — same fixup blog.html does client-side.
    const fixedMd = raw.replace(/(<img\b[^>]*?\bsrc=["'])(\.\/[^"'>]+)(["'][^>]*>)/gi,
        (_, prefix, src, suffix) => `${prefix}${SITE_URL}/data/${src.replace(/^\.\//, '')}${suffix}`);

    const renderer = new marked.Renderer();
    renderer.image = (href, title, text) => {
        if (href && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) && !href.startsWith('/')) {
            href = `${SITE_URL}/data/${href.replace(/^\.\//, '')}`;
        }
        return `<img src="${href}" alt="${text || ''}"${title ? ` title="${title}"` : ''}>`;
    };
    marked.setOptions({ breaks: true, gfm: true, renderer });

    const lines = fixedMd.split('\n');
    let title = '';
    const idx = lines.findIndex(l => /^#\s+/.test(l));
    if (idx > -1) { title = lines[idx].replace(/^#\s+/, '').trim(); lines.splice(idx, 1); }
    const bodyMd = lines.join('\n');
    const bodyHtml = marked.parse(bodyMd);

    const m = META[mdFilename] || { tag: 'Essay', date: '', iso: '', desc: `${title} — an essay by Suraj Gaud.` };
    const readMin = readMinutes(bodyMd);
    const pageUrl = `${SITE_URL}/essays/${slug}.html`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        description: m.desc,
        url: pageUrl,
        ...(m.iso ? { datePublished: m.iso, dateModified: m.iso } : {}),
        author: { '@type': 'Person', name: 'Suraj Gaud', url: `${SITE_URL}/#person` },
        publisher: { '@type': 'Person', name: 'Suraj Gaud' },
        mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl }
    };

    return `<!DOCTYPE html>
<html lang="en" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)} | Suraj Gaud</title>
    <meta name="description" content="${esc(m.desc)}">
    <link rel="canonical" href="${pageUrl}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Suraj Gaud">
    <meta property="og:title" content="${esc(title)} | Suraj Gaud">
    <meta property="og:description" content="${esc(m.desc)}">
    <meta property="og:url" content="${pageUrl}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:site" content="@surajgaud_">
    <meta name="twitter:title" content="${esc(title)} | Suraj Gaud">
    <meta name="twitter:description" content="${esc(m.desc)}">
    <link rel="stylesheet" href="../styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
        .article-shell { max-width: 720px; margin: 0 auto; padding: 130px 28px 40px; position: relative; z-index: 1; }

        .back-link {
            display: inline-flex; align-items: center; gap: 9px; white-space: nowrap;
            font-family: var(--font-mono); font-size: 0.74rem; letter-spacing: 0.1em; text-transform: uppercase;
            color: var(--text-2); text-decoration: none; margin-bottom: 40px;
            padding: 8px 16px 8px 12px; border: 1px solid var(--border); border-radius: 100px;
            transition: color 0.2s, border-color 0.2s, transform 0.2s var(--ease), gap 0.2s;
        }
        .back-link:hover { color: var(--terracotta); border-color: var(--terracotta); gap: 12px; }

        .article-meta {
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
            font-family: var(--font-mono); font-size: 0.74rem; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--text-3); margin-bottom: 22px;
        }
        .article-meta span { white-space: nowrap; }
        .article-meta .tag { color: var(--terracotta); }

        .blog-post h1 {
            font-family: var(--font-display);
            font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 700; letter-spacing: -0.03em;
            line-height: 1.08; color: var(--text); margin-bottom: 40px; text-wrap: balance;
        }
        .blog-post h2 {
            font-family: var(--font-display);
            font-size: clamp(1.5rem, 3vw, 1.9rem); font-weight: 600; letter-spacing: -0.02em;
            color: var(--text); margin: 3rem 0 1.2rem; line-height: 1.2;
        }
        .blog-post h3 {
            font-family: var(--font-display);
            font-size: 1.3rem; font-weight: 600; color: var(--text); margin: 2.2rem 0 1rem;
        }
        .blog-post p { font-size: 1.16rem; line-height: 1.8; color: var(--text-2); margin-bottom: 1.5rem; }
        .blog-post strong { color: var(--text); font-weight: 600; }
        .blog-post em { font-style: italic; }
        .blog-post a {
            color: var(--text); text-decoration: none;
            background-image: linear-gradient(var(--terracotta), var(--terracotta));
            background-size: 100% 1.5px; background-repeat: no-repeat; background-position: 0 100%;
            transition: background-size 0.3s var(--ease), color 0.2s;
        }
        .blog-post a:hover { color: var(--terracotta); background-size: 100% 100%; }
        .blog-post ul, .blog-post ol { margin: 0 0 1.5rem 1.4rem; }
        .blog-post li { font-size: 1.16rem; line-height: 1.8; color: var(--text-2); margin-bottom: 0.6rem; }
        .blog-post li::marker { color: var(--terracotta); }
        .blog-post blockquote {
            border-left: 2px solid var(--terracotta); padding: 4px 0 4px 24px; margin: 2rem 0;
            font-family: var(--font-display); font-size: 1.3rem; font-style: normal; font-weight: 500;
            color: var(--text); line-height: 1.5;
        }
        .blog-post hr { border: 0; height: 1px; background: var(--border); margin: 3rem 0; }
        .blog-post code {
            background: var(--bg-2); padding: 0.15rem 0.45rem; border-radius: 5px;
            font-family: var(--font-mono); font-size: 0.86em; color: var(--terracotta);
        }
        .blog-post pre {
            background: var(--bg-2); border: 1px solid var(--border-2);
            padding: 1.4rem; border-radius: 14px; overflow-x: auto; margin-bottom: 1.5rem;
        }
        .blog-post pre code { background: none; padding: 0; color: var(--text-2); }

        .article-foot { margin-top: 64px; padding-top: 32px; border-top: 1px solid var(--border-2); }
    </style>
</head>

<body>
    <div class="bg-base" aria-hidden="true"></div>
    <div class="ambient" aria-hidden="true">
        <div class="wash"></div>
        <div class="wash two"></div>
        <div class="wash three"></div>
    </div>
    <div class="grain" aria-hidden="true"></div>

    <nav class="navbar" id="navbar">
        <a href="../index.html" class="brand">
            <span class="brand-text-wrapper">
                <span class="brand-text-primary">Suraj Gaud</span>
                <span class="brand-text-secondary">सूरज गौड़</span>
            </span><span class="dot">.</span>
        </a>
        <div class="nav-right">
            <div class="nav-links">
                <a href="../index.html#about" class="nav-link">About</a>
                <a href="../index.html#writing" class="nav-link">Writing</a>
                <a href="../index.html#now" class="nav-link">Now</a>
            </div>
            <button class="icon-btn theme-toggle" id="themeToggle" title="Toggle theme" aria-label="Toggle theme">
                <i class="fa-solid fa-sun sun"></i>
                <i class="fa-solid fa-moon moon"></i>
            </button>
        </div>
    </nav>

    <main class="article-shell">
        <a href="../index.html#writing" class="back-link"><i class="fa-solid fa-arrow-left"></i> All writing</a>
        <article class="blog-post">
            <div class="article-meta"><span class="tag">${esc(m.tag)}</span>${m.date ? `<span>${esc(m.date)}</span>` : ''}<span>· ${readMin} min read</span></div>
            <h1>${esc(title)}</h1>
            ${bodyHtml}
            <div class="article-foot"><a href="../index.html#writing" class="back-link"><i class="fa-solid fa-arrow-left"></i> All writing</a></div>
        </article>
    </main>

    <script>
        const root = document.documentElement;
        const stored = localStorage.getItem('sg-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', stored || (prefersDark ? 'dark' : 'light'));
        document.getElementById('themeToggle').addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            localStorage.setItem('sg-theme', next);
        });
        const brandWrapper = document.querySelector('.brand-text-wrapper');
        setInterval(() => brandWrapper.classList.toggle('show-hindi'), 4000);
        const navbar = document.getElementById('navbar');
        window.addEventListener('scroll', () => navbar.classList.toggle('tucked', window.scrollY > 20), { passive: true });
    </script>
</body>

</html>
`;
}

function main() {
    const dataDir = path.join(ROOT, 'data');
    const essaysDir = path.join(ROOT, 'essays');
    mkdirSync(essaysDir, { recursive: true });

    const mdFiles = readdirSync(dataDir).filter(f => f.endsWith('.md') && f !== 'journal.md');
    for (const mdFilename of mdFiles) {
        const html = renderEssay(mdFilename);
        const outPath = path.join(essaysDir, mdFilename.replace(/\.md$/, '.html'));
        writeFileSync(outPath, html, 'utf-8');
        console.log('built', path.relative(ROOT, outPath));
    }
}

main();
