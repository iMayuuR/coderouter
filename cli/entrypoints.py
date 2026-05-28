"""CLI entry points for the installed package."""

from __future__ import annotations

import contextlib
import os
import shutil
import subprocess
import sys
import time
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import uvicorn

from api.admin_urls import local_proxy_root_url
from api.app import GracefulLifespanApp, create_app
from cli.process_registry import (
    kill_all_best_effort,
    kill_pid_tree_best_effort,
    register_pid,
    unregister_pid,
)
from config.settings import Settings, get_settings

PROXY_PREFLIGHT_PATH = "/health"
PROXY_PREFLIGHT_TIMEOUT_SECONDS = 1.5
SERVER_GRACEFUL_SHUTDOWN_SECONDS = 5


def _load_env_template() -> str:
    """Load the canonical root env template from package resources or source."""
    import importlib.resources

    packaged = importlib.resources.files("cli").joinpath("env.example")
    if packaged.is_file():
        return packaged.read_text("utf-8")

    source_template = Path(__file__).resolve().parents[1] / ".env.example"
    if source_template.is_file():
        return source_template.read_text(encoding="utf-8")

    raise FileNotFoundError("Could not find bundled or source .env.example template.")


def serve() -> None:
    """Start the FastAPI server (registered as `coderouter-server` script)."""
    try:
        try:
            while True:
                settings = get_settings()
                if not _run_supervised_server(settings):
                    return
                get_settings.cache_clear()
        except KeyboardInterrupt:
            return
    finally:
        kill_all_best_effort()


def _run_supervised_server(settings: Settings) -> bool:
    """Run one uvicorn server instance; return whether admin requested restart."""

    restart_requested = False
    server_holder: dict[str, uvicorn.Server] = {}

    def request_restart() -> None:
        nonlocal restart_requested
        restart_requested = True
        if server := server_holder.get("server"):
            server.should_exit = True

    app = create_app(lifespan_enabled=False)
    app.state.admin_restart_callback = request_restart
    asgi_app = GracefulLifespanApp(app)
    config = uvicorn.Config(
        asgi_app,
        host=settings.host,
        port=settings.port,
        log_level="debug",
        timeout_graceful_shutdown=SERVER_GRACEFUL_SHUTDOWN_SECONDS,
    )
    server = uvicorn.Server(config)
    server_holder["server"] = server
    server.run()
    return restart_requested


def init() -> None:
    """Scaffold config at ~/.config/coderouter/.env (registered as `fcc-init`)."""
    config_dir = Path.home() / ".config" / "coderouter"
    env_file = config_dir / ".env"

    if env_file.exists():
        print(f"Config already exists at {env_file}")
        print("Delete it first if you want to reset to defaults.")
        return

    config_dir.mkdir(parents=True, exist_ok=True)
    template = _load_env_template()
    env_file.write_text(template, encoding="utf-8")
    print(f"Config created at {env_file}")
    print(
        "Edit it to set your API keys and model preferences, then run: coderouter-server"
    )


def _claude_child_env(
    settings: Settings, base_env: Mapping[str, str]
) -> dict[str, str]:
    """Return a Claude Code environment that targets this proxy."""

    env = {
        key: value
        for key, value in base_env.items()
        if not key.startswith("ANTHROPIC_")
    }
    env["ANTHROPIC_BASE_URL"] = local_proxy_root_url(settings)
    env["CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY"] = "1"

    token = settings.anthropic_auth_token.strip()
    env["ANTHROPIC_API_KEY"] = token if token else "sk-ant-dummy-coderouter"
    if token:
        env["ANTHROPIC_AUTH_TOKEN"] = token

    return env


def _preflight_proxy(proxy_root_url: str) -> str | None:
    """Return an error message when the local proxy health check is unreachable."""

    url = f"{proxy_root_url.rstrip('/')}{PROXY_PREFLIGHT_PATH}"
    request = Request(url, method="GET")
    try:
        with urlopen(request, timeout=PROXY_PREFLIGHT_TIMEOUT_SECONDS) as response:
            status_code = response.getcode()
    except HTTPError as exc:
        return f"returned HTTP {exc.code}"
    except URLError as exc:
        return str(exc.reason)
    except OSError as exc:
        return str(exc)

    if not 200 <= status_code < 300:
        return f"returned HTTP {status_code}"
    return None


def launch_claude(argv: Sequence[str] | None = None) -> None:
    """Launch Claude Code with Coderouter proxy environment variables."""

    settings = get_settings()
    proxy_root_url = local_proxy_root_url(settings)
    proxy_process: subprocess.Popen[Any] | None = None
    if _preflight_proxy(proxy_root_url):
        print(
            "Coderouter proxy not running. Starting it in the background...",
            file=sys.stderr,
        )
        kwargs = {}
        if os.name == "nt":
            # Avoid sending the main terminal's Ctrl+C to the background proxy process
            # so the proxy can be cleaned up intentionally.
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

        try:
            proxy_process = subprocess.Popen(
                [sys.executable, "-c", "from cli.entrypoints import serve; serve()"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                **kwargs,
            )
            if proxy_process.pid:
                register_pid(proxy_process.pid)

            # Wait for proxy to become available
            started = False
            for _ in range(50):
                if not _preflight_proxy(proxy_root_url):
                    started = True
                    break
                if proxy_process.poll() is not None:
                    break
                time.sleep(0.1)

            if not started:
                print(
                    f"Failed to start Coderouter proxy automatically on {proxy_root_url}.",
                    file=sys.stderr,
                )
                raise SystemExit(1)
        except SystemExit:
            raise
        except Exception as exc:
            print(f"Error starting proxy automatically: {exc}", file=sys.stderr)
            raise SystemExit(1) from exc

    args = list(sys.argv[1:] if argv is None else argv)
    claude_command = shutil.which(settings.claude_cli_bin)
    if claude_command is None:
        print(
            f"Could not find Claude Code command: {settings.claude_cli_bin}",
            file=sys.stderr,
        )
        print(
            "Install Claude Code with: npm install -g @anthropic-ai/claude-code",
            file=sys.stderr,
        )
        raise SystemExit(127)

    command = [claude_command, *args]
    env = _claude_child_env(settings, os.environ)
    process: subprocess.Popen[bytes] | None = None
    try:
        process = subprocess.Popen(command, env=env)
        if process.pid:
            register_pid(process.pid)
        return_code = process.wait()
    except FileNotFoundError:
        print(
            f"Could not find Claude Code command: {settings.claude_cli_bin}",
            file=sys.stderr,
        )
        print(
            "Install Claude Code with: npm install -g @anthropic-ai/claude-code",
            file=sys.stderr,
        )
        raise SystemExit(127) from None
    except KeyboardInterrupt:
        if process is not None and process.pid:
            kill_pid_tree_best_effort(process.pid)
            process.wait()
        raise
    finally:
        if process is not None and process.pid:
            unregister_pid(process.pid)
        if proxy_process is not None and proxy_process.pid:
            kill_pid_tree_best_effort(proxy_process.pid)
            with contextlib.suppress(subprocess.TimeoutExpired):
                proxy_process.wait(timeout=5)
            unregister_pid(proxy_process.pid)

    raise SystemExit(return_code)
