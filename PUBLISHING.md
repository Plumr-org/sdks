# Publishing the SDKs

You only do steps 1–3 once per language. Steps 4–6 are the recurring
release workflow.

---

## TypeScript → npm (`@plumr/sdk`)

### 1 — Make sure the org `@plumr` exists on npm (one time)

1. Go to <https://www.npmjs.com/signup> and create an account if you
   don't have one.
2. Verify your email.
3. Visit <https://www.npmjs.com/org/create>.
4. Create the org **`plumr`** (free tier is fine; pick "Free, public
   packages only" if asked).
5. After it exists, anything published as `@plumr/<package>` belongs
   to that org.

### 2 — Mint an automation token (one time)

1. <https://www.npmjs.com/settings/your-username/tokens/new>.
2. Pick **Granular Access Token**:
   - Name: `plumr-org-publish`.
   - Expiration: 1 year (longer is fine).
   - **Permissions**: read + write.
   - **Scoped packages**: select the `plumr` org → **all packages**.
3. Click **Generate**, copy the value (starts `npm_…`). You won't see
   it again.

### 3 — Add the token to the GitHub repo (one time)

```bash
gh secret set NPM_TOKEN --repo Plumr-org/sdks
# paste the token at the prompt and hit enter
```

That's it. The workflow at
`.github/workflows/typescript-publish.yml` picks it up as
`secrets.NPM_TOKEN`.

### 4 — Cut a release (every time)

```bash
# 1. Bump typescript/package.json -> "version": "0.1.0"
cd typescript
# edit package.json
git add package.json
git commit -m "typescript: 0.1.0"

# 2. Tag and push
git tag typescript-v0.1.0
git push origin main typescript-v0.1.0
```

The workflow runs automatically on the tag. Watch it at
<https://github.com/Plumr-org/sdks/actions>. About 2 minutes later
`@plumr/sdk@0.1.0` is on npm.

If the workflow complains that `package.json` and the tag don't match,
you forgot step 4.1 — bump `version`, retag, and push again.

---

## Python → PyPI (`plumr`)

We use **Trusted Publishing** — PyPI lets a specific GitHub repo +
workflow publish on behalf of your account, no API token in the repo.

### 1 — Reserve the package name (one time)

1. Create a PyPI account if you don't have one:
   <https://pypi.org/account/register/>. Verify your email.
2. **Don't** publish anything yet. Skip to step 2.

> 💡 If `plumr` is already taken when you eventually publish, you'll
> need to rename the package — change `pyproject.toml` `[project] name`
> to e.g. `plumr-sdk` and update the README accordingly. Check now at
> <https://pypi.org/project/plumr/>.

### 2 — Configure the trusted publisher (one time)

1. While signed in to PyPI, open
   <https://pypi.org/manage/account/publishing/>.
2. Under **Add a new pending publisher**, fill in:
   - **PyPI Project Name**: `plumr`
   - **Owner**: `Plumr-org`
   - **Repository name**: `sdks`
   - **Workflow name**: `python-publish.yml`
   - **Environment name**: leave blank
3. Click **Add**.

That's it — no API token, no secret. The workflow's `id-token: write`
permission lets GitHub mint a one-time OIDC token that PyPI accepts.

### 3 — Cut a release (every time)

```bash
# 1. Bump python/pyproject.toml -> version = "0.1.0"
cd python
# edit pyproject.toml
git add pyproject.toml
git commit -m "python: 0.1.0"

# 2. Tag and push
git tag python-v0.1.0
git push origin main python-v0.1.0
```

The workflow at `.github/workflows/python-publish.yml` runs on the
tag, builds an sdist + wheel, and uploads via Trusted Publishing.
Once the first release lands, the "pending publisher" you set up
becomes a regular publisher tied to the project.

---

## Common pitfalls

| Symptom                                                 | Fix                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm publish` 403 "you do not have permission"          | Token isn't scoped to the `@plumr` org. Re-mint a granular token with read+write on all packages in the org.       |
| `npm publish` 402 "You must verify your email"          | Click the verify link in the welcome email npm sent.                                                               |
| PyPI workflow fails: "Trusted publishing exchange failed" | Workflow name in the publisher config must match exactly: `python-publish.yml`. Whitespace + casing matters.      |
| Workflow pre-flight: "package.json says X, tag is Y"    | You forgot to bump the version before tagging. Bump it, commit, retag, push.                                       |
| Tag pushed but no workflow ran                          | Did you push the tag? `git push origin <tag>`. Tags don't go up with a normal `git push origin main`.              |
| Need to re-publish the same version                     | npm + PyPI both reject re-uploads of the same version. Bump the patch (`0.1.0` → `0.1.1`) and tag again.           |

## Versioning rules of thumb

We follow [semver](https://semver.org/):

- **Patch** (`0.1.0` → `0.1.1`) — bug fix, no API change.
- **Minor** (`0.1.x` → `0.2.0`) — new features, backwards-compatible.
- **Major** (`0.x` → `1.0.0`) — breaking changes; bump major after
  warning on Discussions a few weeks ahead.

The two SDKs version independently. There's no need for `@plumr/sdk`
and `plumr` to share the same version number.
