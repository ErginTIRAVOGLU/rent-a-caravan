# GitHub MCP Server Setup Guide (OpenCode V2)

Set up the GitHub MCP server in OpenCode to read repositories, issues, PRs, and GitHub Actions.

## Recommended: Docker (stdio) server

Requires [Docker](https://www.docker.com/). GitHub's official image is
`ghcr.io/github/github-mcp-server`.

### 1. Add the server

Run this from your project:

```sh
opencode mcp add github -- docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server
```

The part after `--` is the stdio command OpenCode launches. `-e
GITHUB_PERSONAL_ACCESS_TOKEN` (no value) makes the container inherit the token
from the parent environment.

### 2. Provide the token

The CLI writes the server to your project config but doesn't collect the token.
Edit `opencode.jsonc` so it looks like this:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "github": {
        "type": "local",
        "command": [
          "docker", "run", "-i", "--rm",
          "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
          "ghcr.io/github/github-mcp-server"
        ],
        "environment": {
          "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_PERSONAL_ACCESS_TOKEN}"
        }
      }
    }
  }
}
```

Create a fine-grained [personal access token](https://github.com/settings/tokens?type=beta)
with the repo read scopes you need, then either:

- export it before starting OpenCode:
  ```sh
  $env:GITHUB_PERSONAL_ACCESS_TOKEN = "github_pat_..."
  ```
- or paste it literally in place of `{env:GITHUB_PERSONAL_ACCESS_TOKEN}`
  (storage in the config file is less ideal).

## Alternative: OAuth (no token needed)

The official image ships with a registered GitHub OAuth app baked in, so on
github.com you can run the server with **no token** and it walks you through a
browser authorization flow on first use. Tokens are kept in memory only.

```sh
opencode mcp add github -- docker run -i --rm ghcr.io/github/github-mcp-server
```

## Alternative: Remote endpoint

If you have a GitHub Copilot subscription, GitHub hosts a remote MCP endpoint.
To use it via OpenCode's Streamable HTTP transport and a token header:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "github": {
        "type": "remote",
        "url": "https://api.githubcopilot.com/mcp/",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {env:GITHUB_PERSONAL_ACCESS_TOKEN}"
        }
      }
    }
  }
}
```

## Verify

- `opencode mcp list` (CLI) shows the server and its connection state.
- Inside OpenCode, `/mcps` lets you view, connect, or disconnect servers.
- If it shows `needs authentication`, run `/mcps` and follow the flow.
- Server is connected once the list shows `✓ github  connected`.

## Using the tools

MCP tools are named `<server>_<tool>` (e.g., `github_search_repositories`,
`github_get_issue`, `github_list_pull_requests`). Under Code Mode they are
grouped by server name. No `opencode github ...` CLI subcommand exists — the
agent calls the MCP tools during a session.

## Notes / troubleshooting

- A local server connects automatically when OpenCode starts; restart or
  `/mcps` re-connect to pick up config edits.
- Ensure Docker is running and the image is pullable
  (`docker pull ghcr.io/github/github-mcp-server`).
- The fine-grained PAT needs the "Contents" / "Issues" / "Pull requests" read
  permissions to expose the matching tools for your repos.
- For GitHub Enterprise Server, use the OAuth flow with
  `--oauth-client-id` instead of the public github.com app.

## References

- OpenCode MCP servers: https://opencode.ai/v2/docs/mcp-servers/
- GitHub MCP server: https://github.com/github/github-mcp-server
