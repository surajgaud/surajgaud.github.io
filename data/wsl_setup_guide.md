# WSL on 32GB: A Quiet Setup That Just Works

My computer is a gaming machine. Windows, Ryzen, nothing special. But when I'm not gaming I write code, and I need that code to work everywhere. I switch between this PC and a Mac depending on where I am, so everything has to be platform agnostic. Push from one, pull from the other, keep going. Linux is the natural choice for that, and WSL2 means I don't need a separate machine or a dual boot to get it.

The other half of it is money. I use Claude Code for serious work, but most of the time I'm just iterating on ideas, testing things, sketching out approaches. Open source models running locally handle that fine. No API costs, no rate limits, just Ollama in a terminal. I only reach for the bigger models when the task actually calls for it. WSL is what makes all of this feel like one seamless environment instead of a bunch of workarounds duct taped together.

Here's how the setup came together.

## The Machine

Gigabyte B450 AM4 board, Ryzen CPU, 32GB DDR4. The RAM has a story.

I was running two kits, Corsair and TeamGroup, 4 sticks total. One day the system stopped booting. Turned out a Corsair stick had died. After the RMA I had two mismatched kits that needed to coexist on a board that doesn't love running 4 DIMMs at full speed.

The fix: pair by channel (Corsair in A2+B2, TeamGroup in A1+B1), enable XMP, back the frequency down to 2933 MHz instead of forcing 3200. Voltage at 1.35V, Command Rate 2T, timings on auto. The Ryzen memory controller on AM4 gets finicky with 4 populated slots. Dropping from 3200 to 2933 is barely noticeable, but it's the difference between random crashes and a system that just runs.

Could I have bought a matching 2x16GB kit? Sure. But this works, and the whole point was 32GB of stable capacity for LLM inference without spending more than I needed to.

## Telling WSL How Much to Eat

Without a `.wslconfig` file, WSL will consume all your RAM and not give it back. On a 32GB system running Ollama, this matters.

`C:\Users\suraj\.wslconfig`:

```ini
[wsl2]
memory=24GB
swap=8GB
processors=0

[experimental]
autoMemoryReclaim=gradual
sparseVhd=true
```

24GB for WSL, the rest for Windows. The `autoMemoryReclaim=gradual` setting slowly returns unused memory to Windows instead of holding onto it. Before this, the system would bog down after a few hours of model inference. Now it doesn't.

## Shell

Zsh, Oh My Zsh, Powerlevel10k. The trick is lazy loading. nvm, pyenv, brew, openclaw completions all load on first use instead of at startup. Shell opens in under 200ms.

```bash
nvm() {
  unset -f nvm
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm "$@"
}
```

Same pattern for everything heavy. Life's too short to wait for your shell.

## Filesystem

Active code lives in `~/dev/` on the native ext4 filesystem inside WSL. That's where builds are fast and git doesn't crawl.

I also symlink `~/documents` to a Windows NTFS drive so I can browse files without opening WSL. Handy for reviewing diffs in VS Code or Cursor, stuff where the CLI doesn't quite cut it. But I never build from there. NTFS mounts are noticeably slower and you feel it immediately.

The real payoff is portability. Everything lives in git. Push from WSL, walk over to my Mac, pull, keep working. Doesn't matter where I am or what machine I'm on.

## Running LLMs Locally

This is where the 32GB earns its keep. Ollama runs inside WSL and handles 7-8B parameter models on CPU. No GPU, no CUDA, just RAM. It's not instant, but for iterating on ideas and testing prompts without burning through API credits, it does the job.

```bash
ollama pull llama3.1:8b
ollama pull qwen2.5-coder:7b
```

The quantized 7-8B models are the sweet spot. You can squeeze a 13B in, but it eats most of your memory. A GPU would change things, and WSL2 supports CUDA passthrough, but that's a future upgrade.

## OpenClaw

I use OpenClaw as a local agent layer. It talks to Ollama or Claude depending on the task, and I've set up cron jobs, basic API calls, scraping, that sort of thing through it. It's pointed at `~/dev` as its workspace and handles the repetitive stuff so I don't have to.

## What Actually Matters

The things that made the biggest difference were the least exciting ones.

The `.wslconfig` memory settings. Without them, the system falls apart under load.

Keeping code on the native Linux filesystem. The NTFS penalty is real.

Lazy loading in the shell config. Every tool that adds 200ms to startup is a tool you resent opening a terminal for.

The rest is preference. These are the decisions that actually save you time.
