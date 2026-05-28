IMPORTANT: Ensure you’ve thoroughly reviewed the [AGENTS.md](AGENTS.md) file before beginning any work.

## RUNNING THE APPLICATION

- To run Claude Code with the proxy, simply run: `uv run coderouter-claude`. This is the **only command you need**! It automatically sets all required environment variables and smartly starts the proxy server in the background if it isn't already running, shutting it down when Claude exits.
- To start the Coderouter proxy server manually, run: `uv run coderouter-server`