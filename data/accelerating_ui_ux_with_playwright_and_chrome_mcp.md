# Accelerating UI/UX development with Playwright and Chrome MCP

<div style="display:flex; flex-wrap:wrap; gap:8px; margin:0 0 34px;">
  <span style="font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); border:1px solid var(--border); border-radius:100px; padding:5px 12px;">UI Engineering</span>
  <span style="font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); border:1px solid var(--border); border-radius:100px; padding:5px 12px;">Playwright</span>
  <span style="font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); border:1px solid var(--border); border-radius:100px; padding:5px 12px;">Chrome DevTools MCP</span>
  <span style="font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); border:1px solid var(--border); border-radius:100px; padding:5px 12px;">Network</span>
</div>

Most UI bugs are not "the component failed to render." They are a button that stayed disabled, a layout that only breaks at 390px, a toast that never appeared because the API returned an empty body. Fixing that with a coding agent means letting it *see* the page the way you do in DevTools — tree, styles, console, network — while you are still editing. Separately, you need automation that still passes on the next push. Those are two different outputs: a debugging session, and a Playwright spec.

I wire both through MCP. [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) owns the session: snapshots, clicks on snapshot uids, CSS on a node, mocked routes. Playwright MCP (and later the normal Playwright test runner) owns what survives the session: `getByRole`, assertions, `page.route` in CI. Confusing the two is how you end up committing ephemeral uids or trying to run Chrome MCP in a pipeline. The split is intentional.

## The loop Chrome MCP assumes

The project ships an agent skill for a reason — it describes a loop that matches how DevTools actually works, not "click until something happens." In full mode (not `--slim`, which caps you at three tools and is useless for UI), the agent should open or select a page, wait for something stable, take a **snapshot**, then interact using the **uid** from that snapshot. Snapshots carry role, name, and state; they are the right default for logic. Screenshots are for when a human needs to judge alignment, crop, or color — not for deciding whether a control is disabled.

After the DOM changes, take a new snapshot. Uids go stale. For style questions, `get_css_styles` on the same uid is the full cascade: winning rules are plain, overridden ones are marked `[overloaded]`, and `var()` values come back resolved. Pass `pageId` on page-scoped tools. On clicks and fills, `includeSnapshot: false` unless you need the updated tree in that same turn. `evaluate_script` is only when the tree and the cascade still do not answer the question.

That loop is the spine of the rest of this post: config gets you a sane browser; the tools below are what you use inside the loop depending on what kind of bug you are chasing.

## Default config: two servers, two throwaway browsers

The simplest setup is two MCP entries, each launching its own headed Chrome with `--isolated` (a temp profile — no daily cookies, no extensions). That is enough for many tasks. I enable network mocking at the server level so the agent can stand up slow or error responses without a backend, and I turn off memory tooling because heap snapshots do not help with layout or fetch failures.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--isolated"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--isolated",
        "--viewport=1280x800",
        "--categoryNetworkMocks",
        "--categoryMemory=false",
        "--screenshotMaxWidth=1280"
      ]
    }
  }
}
```

`--viewport=1280x800` is the size when the server launches Chrome — headed, not `--headless`. `--categoryNetworkMocks` turns on `mock_network` and `remove_network_mock` (off by default in the server). `--categoryMemory=false` drops heap tools that would otherwise be on by default. `--screenshotMaxWidth=1280` caps screenshot width because image cost scales with pixels.

I deliberately leave off `--slim`, `--headless`, `--experimentalVision` (coordinate `click_at`), and `--categoryExtensions`. `--autoConnect` is tempting — it attaches to whatever Chrome you already have open — but Playwright's MCP cannot be aimed at a URL the same way; if both servers must share one window, you attach both to a Chrome you start yourself (next section).

## One Chrome, both clients

Isolated mode is convenient but duplicates reality: two browsers, two consoles, two network logs. When I want the agent on the **same** tabs and traffic I am looking at, I drop `--isolated` on both entries and connect to one Chrome over CDP.

Chrome will not open a debugging port on your normal profile if that profile is already running. Use a separate user-data directory:

```
chrome --remote-debugging-port=9222 --user-data-dir=.chrome-mcp
```

`http://127.0.0.1:9222/json/version` should return a `webSocketDebuggerUrl`. Both MCP clients accept the HTTP URL and discover the socket. Playwright uses `--cdp-endpoint`; Chrome DevTools MCP uses `--browser-url`. Flags like `--viewport` and `--isolated` only apply when the **server** launches the browser, so they come off the Chrome entry in attach mode; category flags for mocks and screenshots stay.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest",
        "--cdp-endpoint=http://127.0.0.1:9222"
      ]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9222",
        "--categoryNetworkMocks",
        "--categoryMemory=false",
        "--screenshotMaxWidth=1280"
      ]
    }
  }
}
```

Tabbit's [Chrome DevTools MCP tutorial](https://go.tabbit.ai/blog/chrome-devtools-mcp-guide#can-it-connect-to-a-running-browser) walks through a failed fetch with the console, network log, and a performance trace, and links here for the shared-Chrome attach.

`list_pages` in Chrome MCP and Playwright's tab list are the same browser. Start the window before the first tool call — in attach mode, Chrome MCP does not launch it for you. Do not let both clients navigate at once. Playwright MCP reads the same accessibility tree as Chrome's snapshot; that is exactly what becomes `getByRole` in a committed test. Cross-browser matrix and CI still belong on the Playwright test runner, not on this shared Chrome instance.

## Inside the loop: three kinds of UI work

Once the loop is running, the tooling clusters into three questions. The lists below are not "every tool once" — they are what I reach for when the bug is primarily about structure, experience, or the wire.

**Structure and interaction.** "Can the agent find and operate the control, and is CSS lying?" Navigation and pacing: `list_pages`, `new_page`, `navigate_page`, `select_page`, `wait_for`. Then `take_snapshot`, then `click`, `fill`, `fill_form`, `hover`, `press_key`, `type_text`, `handle_dialog`, `upload_file` against the uid. For overrides and specificity, `get_css_styles` on that uid. `take_screenshot` with `filePath` when the question is visual; not for disabled state.

**Experience and environment.** "Does this break on a phone, offline, or with reduced motion?" One `emulate` call replaces previous emulation (except extra headers), so send the full set: viewport strings like `390x844x2,mobile,touch`, `prefersReducedMotion`, `colorScheme`, `forcedColors`, `prefersContrast`, and `networkConditions` (`Offline`, `Slow 3G`, etc.). `resize_page` when only window size matters. `lighthouse_audit` for accessibility gaps, not performance scores. Console: `list_console_messages` and `get_console_message` (source maps on by default). `performance_start_trace` / `performance_stop_trace` only when the question is LCP, INP, or CLS — and not while network mocks are active, because mocks disable the HTTP cache.

**The wire.** "Did the client send what we think, and what if the server misbehaves?" `list_network_requests` first, with `resourceTypes` such as `fetch` or `xhr` and `includePreservedRequests` when the last few navigations matter. `get_network_request` for headers (including cookies) and bodies; large payloads go to `requestFilePath` / `responseFilePath`. Set up `mock_network` **before** navigation — abort, local `body`, or `upstream` URL on a `route` pattern — and `remove_network_mock` when finished. Keep `--redactNetworkHeaders` off when the bug is auth; turn it on when the agent should not see cookies.

## What the session produces

Chrome MCP does not run in CI. The session's job is to establish facts; git's job is to lock them in.

Example: the snapshot shows a button named "Save changes" that enables only after the field validates. The network list shows the PUT on save. The Playwright test I commit does not mention uids. It uses `getByRole`, asserts enabled state after fill, clicks, and checks the request — with `page.route` if I need a 500 without standing up the API. The uid was for the afternoon. The role and accessible name are the contract.

If that split stays clear — Chrome MCP while the UI is still moving, Playwright once you know what "done" means — the agent stops guessing at selectors and starts doing the kind of UI work you would have done with DevTools open anyway, with specs that still mean something on Monday.