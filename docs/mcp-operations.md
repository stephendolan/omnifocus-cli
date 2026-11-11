# MCP operations

## Release

Use Bun to install, build, and test; ship the CLI under Node. Resolve dependency
updates with `bun update --latest --minimum-release-age=259200`. Commit `bun.lock`
with `package.json`. After upgrading Biome run `bunx biome migrate --write`.

Bump the package version for a release and run:

```sh
bun install --frozen-lockfile
bun run build
bun run typecheck
bun run lint
bun run format:check
bun test
```

Merge the reviewed change through a GitHub PR. Tag that main-branch commit with
`v<package-version>` and push the tag. `.github/workflows/release.yml` tests the
commit, publishes to npm with GitHub OIDC provenance, then creates the GitHub
release. Publishing uses npm trusted publishing; no local npm token or OTP is
needed for this path. Check the actual workflow outcome, registry version, and
installed artifact's `--version` before declaring currency.

## Capability and authentication boundaries

Full mode is the default (26 tools). `--mode read-only` registers 16 tools and
excludes all nine create/update/delete tools and `get_perspective_tasks`, which
changes the user's front window. The same allowlist filters `search_tools`.
Excluded tools are unregistered and direct calls fail. A listener owns its mode;
caller claims do not select a mode. Issue a credential for a separate read-only
listener when a principal needs fewer capabilities.

HTTP JWT enforcement is enabled by configuring both `--access-team-domain` and
`--access-audience` (or `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUDIENCE`). Partial
configuration fails startup. Authenticated HTTP requires the
`Cf-Access-Jwt-Assertion` header even on localhost; neither Host nor a service-token
identity header bypasses it. The origin verifies RS256 signature, exact issuer,
application audience, required expiry, and not-before when present. JOSE obtains
and caches rotating keys from the configured team's `/cdn-cgi/access/certs`.
Key-fetch and verification failures reject the request. Do not log assertion or
service-token values.

Service-token clients send `CF-Access-Client-Id` and `CF-Access-Client-Secret` to
Cloudflare. Access validates those credentials and supplies the signed assertion
to the origin. The origin never treats client-supplied identity as authorization.
Interactive clients use the Access application's Managed OAuth configuration.

HTTP request capacity and OmniFocus execution capacity are separate. Disconnects
free HTTP capacity; an OmniFocus execution retains its slot until its promise
settles. The limit applies across all requests to that listener.

## Mac Mini public deployment

The private fallback is independent: `com.stephendolan.omnifocus-mcp` listens on
127.0.0.1:3939. Preserve its plist, running process, and installed artifact. Preserve
Tailscale Serve 443 → 127.0.0.1:38886 and 8443 → 127.0.0.1:3939.

The public service is `com.stephendolan.omnifocus-mcp-public`, bound only to
127.0.0.1:3940, allowing Host `omnifocus.stephendolan.com`. Its configured issuer is
`https://dolanfamily.cloudflareaccess.com`. The application audience is configuration
supplied by the Access application owner and is recorded in the public LaunchAgent
template. Changing the audience does not require rebuilding the package.

Install a pinned npm artifact in:

```text
~/Library/Application Support/omnifocus-mcp-public/releases/2.8.0/
```

Use `npm install --prefix <release-directory> --ignore-scripts --save-exact
@stephendolan/omnifocus-cli@2.8.0`, then run its `dist/cli.js` with an absolute,
versioned Node path. The existing global installation remains the fallback's
artifact. Templates are in [deployment/](deployment/). Substitute `__NODE_PATH__`
and `__INSTALL_ROOT__`, render the public plist into `~/Library/LaunchAgents/`,
and use `launchctl bootstrap gui/$(id -u) <plist>`. Reload only this public service
when changing its audience or mode. Keep the installation directory mode 700.

Prepare `com.stephendolan.omnifocus-cloudflared` from the separate template,
substituting `__TOKEN_DIRECTORY__` with `~/.cloudflared` expanded to an absolute
path. Keep that directory mode 700 and the agent unloaded until the securely
transferred token is present at `~/.cloudflared/omnifocus-tunnel.token`, mode 600.
The template also waits for the token path before starting if launchd loads it
at login. Never put the token in a plist, command argument, repository, or chat.
Do not create a dummy token. The remotely managed tunnel routes the host to
`http://127.0.0.1:3940`, with a final 404 ingress. The external endpoint is
`https://omnifocus.stephendolan.com/mcp`.

For encrypted token handoff, generate a one-time RSA-4096 private key at
`~/.cloudflared/transfer-key.pem`, mode 600. Share only its public key. Use
RSA-OAEP with SHA-256 and MGF1-SHA-256, transfer the ciphertext as base64, and
decrypt directly into the mode-600 token file. Verify cloudflared can read the
token before removing the transfer private key.

## Health and macOS automation

An MCP initialize or tools/list response proves transport availability. A tool
response with HTTP 200 can still contain `result.isError: true`. Health requires
successful `list_perspectives` and a task read, with valid parsed tool content.
`get_inbox_count` traverses and serializes the inbox; it is not a cheap liveness
probe. Avoid `get_perspective_tasks` for health because it switches the user's view.

On a timeout, inspect the deployed LaunchAgent and its process identity. Compare
with a bounded direct `osascript` call evaluating `1+1` in OmniFocus. If that also
hangs, inspect native Apple Events delivery and TCC rather than increasing the
timeout or changing task filters. A working application version property does
not prove that protected automation events work.

macOS attributes child `osascript` calls to the responsible executable, which can
be the LaunchAgent's Node binary rather than a terminal. Identify that executable
from TCC logs before asking the user to approve Automation access. Do not edit the
TCC database, reset all grants, or re-sign runtimes to evade permission handling.
A stuck permission-dialog response in a TCC sample is evidence of queued native
permission work, not proof that any particular grant is missing.

Different versioned Node paths can require separate Automation approvals even
when both prompts say `node`. The public Node 26.13.0 runtime and the fallback's
Node 24.22.0 runtime each require access to OmniFocus. After consent, verify a
fresh MCP process can repeat the read without another prompt. A TCC grant-creation
event, a successful no-prompt Apple Events preflight, and successful fresh-process
reads establish that consent persisted; direct access to the protected TCC
database is not required.

A successful signal command does not prove a service restarted. Verify its PID
and launch time before calling a check post-restart. TCC enables
`EnablePressuredExit`; the Mac's `launchd.plist(5)` manual documents that these
jobs can handle SIGTERM without exiting. Preserve this distinction when a
permission-dialog wait survives the signal.

Validate the public origin locally with missing and forged assertions (401), then
with a real Access-issued assertion for the exact configured audience. Use a
private token file and a test client that never prints its contents. Repeat real
reads through Tailscale 8443 and compare the original plist and Serve configuration
with the saved inventory. Valid local test signatures prove verifier behavior;
they do not prove the real Access application or tunnel configuration.
