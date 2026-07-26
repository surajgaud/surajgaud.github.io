# Distilling session data into figments

<div style="display:flex; flex-wrap:wrap; gap:8px; margin:0 0 34px;">
  <span style="font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); border:1px solid var(--border); border-radius:100px; padding:5px 12px;">Context Engineering</span>
  <span style="font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); border:1px solid var(--border); border-radius:100px; padding:5px 12px;">Session Memory</span>
  <span style="font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); border:1px solid var(--border); border-radius:100px; padding:5px 12px;">Claude Code Hooks</span>
  <span style="font-family:var(--font-mono); font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); border:1px solid var(--border); border-radius:100px; padding:5px 12px;">Small Models</span>
</div>

Every long session with a coding agent ends the same way: the code survives, the reasoning dies. Git records what changed. CLAUDE.md holds the standing rules. The transcript is the only artifact that records why: which decisions were made, which alternatives were rejected, what was left unverified when the window closed. And it sits in a JSONL file on a thirty-day cleanup timer.

The existing tools reach for this data at the wrong altitude. Claude Code's built-in /insights aggregates transcripts into a usage report; I ran it and it wasn't useful at all, because aggregation averages away the specifics. Built-in memory saves what seemed notable mid-task, and mid-task nobody knows which decisions will survive the session. Embedding search over conversation history optimizes retrieval when the bottleneck is capture.

The capture point that works is session end: the moment a decision is cheapest to record and most expensive to reconstruct later. The full conversation is on disk, nothing more will change, and distillation costs one call to a small model. A week later the same reconstruction is archaeology.

So, figment: a harvester that distills each Claude Code session into a small markdown file the moment it ends, and feeds recent ones back into the next session in the same project. A figment of the session: the session is gone, this is what remains.

## What a figment is

Five sections, under 45 lines, grounded only in the transcript:

- **Did**: what was accomplished, concretely
- **Decisions**: each one with the rejected alternative, and why
- **Standouts**: bugs with root causes, surprises, corrections I made to the agent
- **Dropped**: approaches explicitly abandoned
- **Open threads**: work left mid-flight or unverified

Decisions carry the weight: git shows the path taken, a figment also keeps the road not taken and why. From a real one, on an ESP32 display project: touch input is polled by apps rather than pushed to them, so apps that never use touch never pay for reading the touch controller. The commit shows the polling API; the figment is the only place the "why" survives.

Open threads matter because sessions rarely end clean. The same figment ends with: calibration values are a guess until pressed on the real panel, and colors may render byte-swapped on the device. That list is where the next session starts, and before this it lived nowhere.

## The architecture is a corollary

If session end is the capture point, the design falls out. Session end is also when laptops shut and APIs flake, so the SessionEnd hook does the one thing that can't fail: append a line to a queue file. The next session drains the queue in the background, with a retry counter and a dead-letter file after five failures. A figment shows up one session late, which costs nothing, because the next session is the consumer.

```
SessionEnd   -> enqueue   append the session to a queue file
SessionStart -> inject    last 3 figments for this project into context
             -> sweep     background: transcript -> Haiku -> figment file
```

Sessions under ten real messages are gated out. The summarizer is Haiku: grounded distillation is not judgment work, and a full harvest costs pennies. Subagent chatter is dropped, tool output truncated, and long sessions keep the tail, because the end of a session is where the decisions land.

## It paid for itself on this post

The session that wrote this article started with two figments of this site injected. The agent already knew that publishing here means registering the post in two META blocks and updating the journal file, and that last time the forgotten journal entry was the actual blocker. Nobody searched for that.

## What broke immediately

Backfilling old transcripts produced one instructive failure. On a 309-message session, Haiku joined the conversation instead of summarizing it, replying to the last message as if it were the assistant. Two causes: truncation kept the head of the transcript instead of the tail, so the model saw a conversation trailing into a live request, and nothing validated the output before writing it. Both fixed the boring way: keep the tail, reject output that doesn't start with `## Did`, let the retry machinery handle it. A summarizer is a system boundary, and its output is untrusted input.

## Boring on purpose

Figment is one Python file, standard library only. The hooks call `python3` directly, so nothing resolves a virtualenv at session start. No database, no embeddings, no vector store: figments are markdown on disk, greppable, and injection is a capped read of the three newest. A `backfill` command builds the corpus from existing transcripts, which is also how I validated the prompt before the hooks went live. Claude Code is the only source today; Codex stores sessions as JSONL too, so that's an adapter on the sweep, not a redesign.

The kill criterion: if figments don't visibly change what sessions do within a few weeks, starting from open threads instead of re-deriving context, I delete the harvester. Either way, the transcripts were the only place the reasoning lived. Now some of it survives the window closing.
