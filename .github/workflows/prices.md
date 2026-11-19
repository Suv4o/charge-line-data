---
description: Keeps charging networks and their typical prices current, and adds networks new to Australia.
on:
  schedule:
    - cron: "0 3 8 * *"             # monthly: the 8th, 3 am in Melbourne
      timezone: Australia/Melbourne
  workflow_dispatch:
    inputs:
      model:
        description: "Claude model for this run (scheduled runs use Opus 5.5)"
        type: choice
        options: [claude-opus-5-5, claude-sonnet-5-5]
        default: claude-opus-5-5
permissions:
  contents: read
  issues: read
  pull-requests: read
  id-token: write                   # Anthropic Workload Identity Federation: no API key stored anywhere
engine:
  id: claude
  model: ${{ inputs.model || 'claude-opus-5-5' }}
  args: ["--settings", "{\"skipWebFetchPreflight\": true}"]   # Claude's own domain check can't leave the sandbox; the firewall decides
  auth:
    type: github-oidc
    provider: anthropic
    federation-rule-id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
    organization-id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
    service-account-id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
    workspace-id: ${{ vars.ANTHROPIC_WORKSPACE_ID }}
timeout-minutes: 30
max-turns: 60
max-ai-credits: 450                 # US$4.50 hard stop per run (an Opus run measured US$2.23)
max-daily-ai-credits: 900
max-turn-cache-misses: 10          # gh-aw's default of 5 stopped an Opus run; the credit caps still bound the cost
imports:
  - shared/rules.md
steps:
  - name: Count fast sites by operator in Charge Line's public charger file
    env:
      CHARGER_FILE_URL: ${{ vars.CHARGER_FILE_URL }}
    run: |
      mkdir -p /tmp/gh-aw/agent/sources
      curl --fail --silent --show-error --max-time 120 "$CHARGER_FILE_URL" -o /tmp/charger-file.json
      node scripts/new-operators.mjs /tmp/charger-file.json 3 > /tmp/gh-aw/agent/sources/new-operators.json
      cat /tmp/gh-aw/agent/sources/new-operators.json
tools:
  edit:
  web-search:
  web-fetch:
  bash:
    - "echo"
    - "ls"
    - "cat"
    - "head"
    - "tail"
    - "grep"
    - "wc"
    - "sort"
    - "uniq"
    - "date"
    - "jq"
    - "git diff:*"
    - "git status"
    - "node scripts/format.mjs"
    - "node scripts/validate.mjs:*"
  repo-memory:
    - id: prices
      description: "Operators already looked into, and what was found"
      file-glob: ["*.json"]
      allowed-extensions: [".json"]
      format-json: true
      max-patch-size: 51200
network:
  allowed:
    - defaults
    - "*.com.au"
    - "*.gov.au"
    - "*.org.au"
    - "*.net.au"
    - thedriven.io
    - openchargemap.org
    - openchargemap.io
  blocked: [carexpert.com.au, carsguide.com.au, chasingcars.com.au, whichcar.com.au, drive.com.au, ancap.com.au, evcentral.com.au, ev-database.org, tesla.com, bp.com, chargefox.com, jolt.com.au, joltcharge.com, exploren.com.au]
  hosted-web:
    blocked: [carexpert.com.au, carsguide.com.au, chasingcars.com.au, whichcar.com.au, drive.com.au, ancap.com.au, evcentral.com.au, ev-database.org, tesla.com, bp.com, chargefox.com, jolt.com.au, joltcharge.com, exploren.com.au]
    max-uses: 30
safe-outputs:
  staged: true                      # preview: proposals appear in the run summary, nothing is written
  create-pull-request:
    title-prefix: "[prices] "
    labels: [agent, prices]
    reviewers: [Suv4o]
    draft: false
    allowed-files: [networks.json]
    if-no-changes: ignore
  create-issue:
    title-prefix: "[prices] "
    labels: [agent, prices]
    max: 3
---

# Keep charging networks and prices current

`networks.json` lists Australian fast-charging networks:

- **How to recognise their sites:** `match`, lower-case text found in a site's operator or name.
- **A typical price per kWh:** `typicalPerKWh`, with its `basis`, `source` and `checked` date.
- **Whether an agent may read the network's own website:** `siteReading`.

`schema/networks.schema.json` describes every field. Networks price each site differently, often by the time of
day, and only their apps show a site's price. So a typical price is a guide, and drivers can set their own in the
app. This run has two jobs: find networks new to Australia, and keep the typical prices honest.

## 1. Read your memory

Your memory folder is `/tmp/gh-aw/repo-memory/prices/`. Keep one file, `operators.json`, created if missing. It's
a list of `{ "operator", "fastSites", "firstSeen", "lastSeen", "decision", "notes" }`. `decision` is one of:

- `added`: you added it as a network;
- `alias`: it's another name for a listed network;
- `site-owner`: a business or council with its own chargers, not a network drivers join;
- `roaming`: its sites are run through another network's app;
- `pending`: not decided yet.

## 2. New networks

`/tmp/gh-aw/agent/sources/new-operators.json` lists operators in Charge Line's public charger file with three or
more fast sites (50 kW or more) that no network in `networks.json` matches. Work through **every** one not
already decided in your memory, largest first, in this run. Spend a few searches and fetches on each, not more.
For each one:

1. **Find out what it is,** from the operator's own website (when its terms allow automated reading), Open Charge
   Map, government pages or The Driven:
   - a network drivers pay through its own app or card;
   - another name for a listed network (for example a parent company);
   - a site owner;
   - sites run through another network's app.
2. **A real network:** add it to `networks.json`.
   - `id`: camelCase.
   - `name`: as drivers know it.
   - `match`: lower-case strings found in the operator names in the file, never one another network already uses.
   - `typicalPerKWh`: only from a source that states the price (`basis` `published` or `survey`). Otherwise
     `null`, with `basis` `none`.
   - `siteReading`: from its terms of use and robots.txt. Use `unchecked` if you couldn't tell.
   - `source`, `sourceUrl` and `checked` (today).
3. **Another name for a listed network,** or **sites run through another network's app:** add the operator's
   lower-case text to that network's `match`.
4. **A site owner:** record it in memory only.

**Deciding what an operator is** needs reasonable evidence, not a primary source: a government page, the
operator's or a network's own site, The Driven, or several search results that agree. Sites paid through
Chargefox's app, for example, mean the operator's text joins Chargefox's `match`. **A price** still needs a
source that states it.

**A network whose own site is blocked** (its terms forbid automated reading, like Exploren's) can still be added
from other sources, with `siteReading` `forbidden`.

## 3. Typical prices

For each network, look for evidence that its typical price has changed:

- **The network's own website:** only when its `siteReading` is `allowed`.
- **News of a price change:** The Driven, or the network's own announcements.
- **Recent Open Charge Map listings** that state a price (checked in the last year).

Change `typicalPerKWh` only when a source supports the new figure. Then update `basis`, `source`, `sourceUrl` and
`checked`, and give the old and new figure in the pull request. Keep `teslaPerKWh` and `freeKWhPerDay` up to date
the same way.

**When no source you may read gives a price,** and a network's `checked` date is more than six months old, open
an issue asking the owner to check the price in the network's app. One issue covering every such network.

## 4. Propose

- **Changes to `networks.json`:** follow "Editing the data" and "The pull request" in the shared rules. Title it
  `[prices] ` plus a short summary, such as "Add Yurika; Evie typical 0.69 → 0.72".
- **Things only the owner can check:** open an issue. Three at most.
- **Nothing found:** propose nothing. Your memory is still saved.
