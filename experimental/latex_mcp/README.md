# Latex Compile MCP (Isolated PoC)

This is an isolated, P0-ready MCP tool prototype for compiling TikZ/LaTeX, designed to avoid any integration changes to the main project. It exposes a single JSON-RPC method compatible with MCP `tools/call`:

- Tool name: `latex_compile`
- Args: `{ tikz: string, engine?: "lualatex"|"pdflatex", timeoutSec?: number, format?: "pdf"|"svg"|"both" }`
- Result: `{ status: "ok"|"error", errors: [...], warnings: [...], metrics: {latency_ms, returncode}, artifacts?: { pdfPath?: string, svgPath?: string } }`

Notes:
- The actual LaTeX invocation uses `subprocess.run` with safe flags (no `--shell-escape`).
- Unit tests mock the compiler subprocess, so no LaTeX toolchain is required to run tests.
- JSON-RPC FastAPI app is provided for future wiring; not used by the main app yet.
- SVG export attempts `pdf2svg` (preferred), then `inkscape`, then `dvisvgm`. If none is available, compile may still succeed (PDF) with a conversion warning.
