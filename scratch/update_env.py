import os


def update(path, replaces):
    content = open(path, encoding="utf-8").read()
    orig = content
    for old, new in replaces.items():
        content = content.replace(old, new)
    if content != orig:
        open(path, "w", encoding="utf-8").write(content)
        print(f"SUCCESS: {path}")
    else:
        print(f"NO CHANGE: {path}")


# Update local env
update(
    r"d:\coderouter-ultra\.env",
    {'ANTHROPIC_AUTH_TOKEN="freecc"': 'ANTHROPIC_AUTH_TOKEN=""'},
)

# Update global env
update(
    r"c:\Users\mayur\.config\coderouter\.env",
    {"ANTHROPIC_AUTH_TOKEN=freecc": "ANTHROPIC_AUTH_TOKEN="},
)
