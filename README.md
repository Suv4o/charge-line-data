# Charge Line data

Open data behind [Charge Line](https://chargeline.au), an iPhone app that plans electric-vehicle road trips across
Australia:

- **`vehicles.json`:** every EV sold new in Australia since 2019, with what a trip planner needs.
- **`networks.json`:** the fast-charging networks, how to recognise their sites, and a typical price per kWh.

**How it's kept current.** Two AI agents run on a schedule as
[GitHub Agentic Workflows](https://github.github.com/gh-aw/) with Claude. They read the web and propose changes as
pull requests. Nothing reaches `main` until a person reviews and merges it.

**How it reaches drivers.** Charge Line's server serves the latest `main` to the app. The app also ships with a copy
built in, so it never waits on the network.

## The files

| File | What's in it | Schema |
| --- | --- | --- |
| `vehicles.json` | Make, model, variant, model years, body, usable battery, WLTP range, peak DC and AC charging, plugs, the maker's fast-charge claim, US EPA road-load figures where published, and a `source` for every entry | [`schema/vehicles.schema.json`](schema/vehicles.schema.json) |
| `networks.json` | Each network's name, the operator names its sites appear under in OpenStreetMap and Open Charge Map, a typical A$ per kWh with its basis and source, and whether its website may be read automatically | [`schema/networks.schema.json`](schema/networks.schema.json) |

**Rules beyond the schema** (`scripts/validate.mjs` checks them on every pull request):

- **Ids never change.** Drivers' saved cars point to them. A car no longer sold new gets `untilYear`; nothing is
  deleted.
- **Order:** Tesla and BYD first, then makes A to Z, each make's cars together.
- **Format:** one entry per line, keys in the schema's order. Diffs stay small and easy to review.
- **`updated`:** set to the day of the change.

**Prices are a guide.** Networks price each site differently, often by the time of day, and only their apps show a
site's price. Charge Line uses a driver's own price first, then a recent Open Charge Map listing for the site, then
the typical price here.

## The agents

| Workflow | When | What it does | May change |
| --- | --- | --- | --- |
| [`catalogue.md`](.github/workflows/catalogue.md) | 1st of each month | Re-checks the 12 makes checked longest ago, and looks for EVs and brands new to Australia: The Driven's feed, BITRE's register entries, ROVER's type approvals, the Green Vehicle Guide, makers' sites | `vehicles.json` |
| [`prices.md`](.github/workflows/prices.md) | 8th of each month | Finds operators with three or more fast sites that no network matches, decides whether each is a new network, and checks typical prices against sources it may read | `networks.json` |
| [`validate.yml`](.github/workflows/validate.yml) | Every pull request | Plain GitHub Actions, no AI: tests and runs the validator | — |

Each agentic workflow is a Markdown file: YAML settings, then plain-English instructions. Their shared rules are
in [`shared/rules.md`](.github/workflows/shared/rules.md). `gh aw compile` turns each one into the `.lock.yml` that
GitHub Actions runs.

**The guard rails:**

- **The agent can't write.** It runs read-only. When it asks for a pull request, a separate job builds it, after a
  second AI pass checks the change for anything suspicious.
- **One file each.** `allowed-files` refuses any pull request that touches another file, so the scripts, schemas
  and workflows are out of reach.
- **Sites it may not read are blocked, not just discouraged:**
  - The agent's own downloads go through a firewall that allows only listed sites.
  - Claude's web search and fetch block sites whose terms forbid automated reading (CarExpert, CarsGuide, Chasing
    Cars, WhichCar, Drive, ANCAP, EV Central, EVDB, tesla.com, bp.com, Chargefox, Jolt, Exploren).
- **Polite downloads.** The Driven's feed and BITRE's spreadsheet are fetched by a plain script before the agent
  starts, 10 seconds apart as The Driven asks. They're not fetched by the AI.
- **Spending caps.** A hard limit per run and per day for each workflow (set in its frontmatter), plus a monthly
  limit on the Claude account.
- **No API key.** Claude signs in with GitHub's short-lived OIDC token (Anthropic Workload Identity Federation). It
  is trusted only for this repository's `main` branch.
- **Memory without noise.** What each agent has checked, and cars it has seen but not added yet, live on
  `memory/catalogue` and `memory/prices` branches. Only real data changes come to `main` as pull requests.

## Working on it

Requires Node 22 or later. No packages to install.

```bash
node scripts/format.mjs                         # rewrite both files in the canonical format
node scripts/validate.mjs --base-ref origin/main
node --test 'scripts/*.test.mjs'
node scripts/new-operators.mjs chargers.json 3  # operators no network matches, from a charger file
```

After editing a workflow's frontmatter, recompile with `gh aw compile` and commit the `.lock.yml` too. Changes to
the instructions alone take effect without recompiling.

**To run the agents in your own copy:**

- **Repository variables:**
  - `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID` and
    `ANTHROPIC_WORKSPACE_ID`, from your Claude Console's workload identity settings;
  - `CHARGER_FILE_URL`, a charger file in Charge Line's format.
- **Repository secret:** `GH_AW_CI_TRIGGER_TOKEN`, a fine-grained token with Contents read and write on the
  repository. It lets the agents' pull requests start the `validate` check.

Corrections are welcome as pull requests or issues. Please include a source.

## Licence

- **Data:** [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), contents under
  [DbCL 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).
- **Code:** MIT.

See [LICENSE](LICENSE).
