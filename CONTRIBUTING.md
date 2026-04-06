# Contributing to CodeRouter

First off, thank you for considering contributing to CodeRouter! It's people like you that make this tool such a great wrapper for the AI community.

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please use the **Bug Report** template in our Issues tab. Provide as much detail as possible, including:
- Your OS and Node/NPM version.
- The model you were trying to use.
- The expected behavior vs actual behavior.

### Suggesting Enhancements
Feature requests are highly encouraged! Use the **Feature Request** template. We love ideas that make the proxy smarter or the setup easier.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that requires `npm install`, make sure to update the documentation if necessary.
3. Keep your PR scope focused. If you are fixing a bug and adding a feature, please separate them into two PRs.
4. Update the `README.md` with details of changes to the interface, new environment variables, or new features.

## Local Development Workflow
CodeRouter operates as a Node proxy and a launcher script. 

1. Install dependencies: `npm install`
2. Duplicate `.env.example` to `.env` and add your OpenRouter key.
3. Modify `proxy.js` or the shell scripts.
4. Run locally: `.\run-claude.ps1` (Windows) or `./run-claude.sh` (Mac/Linux).
5. Verify that Claude Code successfully loads and routes appropriately via your updated proxy logic.

Thank you for contributing!
