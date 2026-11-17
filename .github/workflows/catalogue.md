---
description: Keeps the EV catalogue current. Re-checks the makes checked longest ago, and looks for EVs and brands new to Australia.
on:
  schedule:
    - cron: "0 3 1,15 * *"          # fortnightly: the 1st and 15th, 3 am in Melbourne
      timezone: Australia/Melbourne
  workflow_dispatch:
permissions:
  contents: read
  issues: read
  pull-requests: read
  id-token: write                   # Anthropic Workload Identity Federation: no API key stored anywhere
engine:
  id: claude
  model: claude-sonnet-5-5
  auth:
    type: github-oidc
    provider: anthropic
    federation-rule-id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}
    organization-id: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
    service-account-id: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
    workspace-id: ${{ vars.ANTHROPIC_WORKSPACE_ID }}
timeout-minutes: 30
max-turns: 80
max-ai-credits: 300                 # US$3 hard stop per run
max-daily-ai-credits: 600
imports:
  - shared/rules.md
steps:
  - name: Download the agent's reading (The Driven's feed, BITRE's register entries)
    run: |
      pip install --quiet --disable-pip-version-check openpyxl==3.1.5
      python3 scripts/gather_sources.py /tmp/gh-aw/agent/sources
tools:
  edit:
  web-search:
  web-fetch:
  playwright:                       # ROVER's approvals list is drawn by JavaScript
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
    - id: catalogue
      description: "Which makes were checked when, and cars seen but not yet added"
      file-glob: ["*.json"]
      allowed-extensions: [".json"]
      format-json: true
      max-patch-size: 51200
network:
  allowed:
    - defaults
    - rover.infrastructure.gov.au
    - greenvehicleguide.gov.au
  hosted-web:
    blocked: [carexpert.com.au, carsguide.com.au, chasingcars.com.au, whichcar.com.au, drive.com.au, ancap.com.au, evcentral.com.au, ev-database.org, tesla.com, bp.com, chargefox.com, jolt.com.au, joltcharge.com, exploren.com.au]
    max-uses: 40
safe-outputs:
  staged: true                      # preview: proposals appear in the run summary, nothing is written
  create-pull-request:
    title-prefix: "[catalogue] "
    labels: [agent, catalogue]
    reviewers: [Suv4o]
    draft: false
    allowed-files: [vehicles.json]
    if-no-changes: ignore
  create-issue:
    title-prefix: "[catalogue] "
    labels: [agent, catalogue]
    max: 2
---

# Keep the EV catalogue current

`vehicles.json` lists every electric vehicle sold new in Australia since 2019, with what Charge Line's planner needs:
usable battery (`usableKWh`), WLTP range (`wltpKm`), fastest DC and AC charging (`maxDCkW`, `maxACkW`), plugs,
the maker's fast-charge claim and a `source`. `schema/vehicles.schema.json` describes every field. This run has two
jobs: re-check some makes, and find cars that are new to Australia.

## 1. Read your memory

Your memory folder is `/tmp/gh-aw/repo-memory-catalogue/`. It keeps two files between runs; create them if they
are missing:

- `checked-makes.json`: `{ "Make": "YYYY-MM-DD", … }`, the day each make was last re-checked.
- `candidates.json`: a list of cars and brands you've seen but not added yet, each
  `{ "make", "model", "firstSeen", "lastSeen", "status", "evidence": [{ "url", "date", "quote" }] }`, where
  `status` is `announced`, `approved` (on ROVER or the register), `on-sale`, `added` or `not-an-ev`, and each
  `quote` is the source's own words, 25 words at most.

## 2. Re-check up to 12 makes

Take the makes in `vehicles.json` whose date in `checked-makes.json` is oldest (a make with no date first), up to
12. For each one, on the maker's Australian website and the Green Vehicle Guide (greenvehicleguide.gov.au):

- **Missing cars:** a model or variant on sale in Australia now that isn't in the file.
- **Cars no longer sold new:** set `untilYear` to the last model year sold. Never delete the entry.
- **Changed figures** for cars still on sale: battery, WLTP range, DC or AC charging power, the fast-charge claim.
  Change a figure only when the maker or the Green Vehicle Guide states it for the Australian car.

Then set the make's date in `checked-makes.json` to today. Every make is re-checked about every two months.

## 3. Look for EVs and brands new to Australia

Read, in this order:

1. `/tmp/gh-aw/agent/sources/`, downloaded before you started. `README.txt` says what each file is:
   - The Driven's feed (three pages): reveals, launches, prices and monthly sales by brand.
   - BITRE's latest sheets of vehicles entered on the Register of Approved Vehicles, by make and model, with
     motive power by make. A make or model listed there and not in `vehicles.json` is a lead.
2. ROVER's published vehicle type approvals
   (https://www.rover.infrastructure.gov.au/PublishedApprovals/VTAApprovals/), the earliest signal, often weeks
   before sales. The list is drawn by JavaScript, so use `playwright-cli`, and look at the most recent approvals
   only.
3. The Green Vehicle Guide's newly added vehicles.
4. The maker's Australian website, for the figures.

Record every lead in `candidates.json`, updating `lastSeen`, `status` and the evidence. Hybrids, plug-in hybrids
and range extenders are not EVs: mark them `not-an-ev` and never add them.

**Add a car to `vehicles.json` only when all of these hold:**

- It's fully electric.
- The maker, or the maker's official announcement, gives an Australian price, or says it's on sale or available
  to order in Australia. An announcement or approval alone isn't enough: keep it as a candidate.
- A source gives its WLTP range and peak DC charging power for the Australian car. Usable battery and the
  fast-charge time may be estimated from the published gross battery and charging figures, marked "est." in
  `source`, as existing entries do.

**A new entry:**

- **Fields:** follows the existing entries.
- **`id`:** `make-model-variant-year` in lower case with hyphens, like the others.
- **Placement:**
  - A known make: next to its make's other cars (by model, cars on sale first, newest first).
  - A new make: in alphabetical order after Tesla and BYD.
- **`checked`:** today.

Leads from the owner's research on 14 November, to verify rather than trust:

- **Reported on sale:** Deepal E07, Xpeng X9, Leapmotor B05 and MG U9 EV.
- **Not in the file:** Chery sells an EV.
- **Expected in 2027:** HQ (Hongqi) and Avatr.

## 4. Propose

- **Changes to `vehicles.json`:** follow "Editing the data" and "The pull request" in the shared rules. Title it
  `[catalogue] ` plus a short summary, such as "Add the MG U9 EV and Deepal E07; Kia EV3 range".
- **Something for the owner to decide** (sources that disagree, a car you can't confirm): open an issue. Two at
  most.
- **Nothing found:** propose nothing. Your memory is still saved.
