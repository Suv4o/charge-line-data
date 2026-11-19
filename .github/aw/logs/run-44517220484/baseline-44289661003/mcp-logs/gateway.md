<details>
<summary>MCP Gateway</summary>

- ✓ **startup** MCPG Gateway version: v0.5.6
- ✓ **startup** Starting MCPG with config: stdin, listen: 0.0.0.0:8080, log-dir: /tmp/gh-aw/mcp-logs/
- ✓ **startup** WASM compilation cache directory: /tmp/gh-aw/wazero-cache
- ✓ **startup** Environment validation passed
- ✓ **startup** Loaded 2 MCP server(s): [github safeoutputs]
- ✓ **startup** Guards sink server ID logging enrichment disabled (no sink server IDs configured)
- ✓ **startup** OpenTelemetry tracing disabled (no OTLP endpoint configured)
- ✓ **backend**
  ```
  Successfully connected to MCP backend server, command=docker
  ```
- 🔍 rpc **safeoutputs**→`tools/list`
- 🔍 rpc **safeoutputs**←`resp` `{"jsonrpc":"2.0","id":1,"result":{"ttlMs":0,"cacheScope":"","tools":[{"description":"WRITE-ONCE: do NOT call this tool with empty or placeholder arguments to probe or discover its schema — required fields (title, body) are listed in this schema; if you are not ready to open the real issue, call `noop` instead. Creates a new GitHub issue for tracking bugs, feature requests, or tasks. Use this for actionable work items that need assignment, labeling, and status tracking. For reports, announcements, or statu...`
- ✓ **backend**
  ```
  Successfully connected to MCP backend server, command=docker
  ```
- 🔍 rpc **github**→`tools/list`
- 🔍 rpc **github**←`resp` `{"jsonrpc":"2.0","id":1,"result":{"ttlMs":0,"cacheScope":"","tools":[{"annotations":{"idempotentHint":false,"readOnlyHint":true,"title":"Get commit details"},"description":"Get details for a commit from a GitHub repository","inputSchema":{"properties":{"detail":{"default":"stats","description":"Level of detail to include for changed files. \"none\" omits stats and files entirely. \"stats\" (default) includes per-file metadata: filename, status, and lines-of-code counts (additions, deletions, changes), with ...`
- 🔍 rpc **github**→`prompts/list`
- 🔍 rpc **github**←`resp` `{"jsonrpc":"2.0","id":1,"result":{"ttlMs":0,"cacheScope":"","prompts":[{"arguments":[{"name":"repo","description":"The repository to assign tasks in (owner/repo).","required":true}],"description":"Assign GitHub Coding Agent to multiple tasks in a GitHub repository.","name":"AssignCodingAgent","icons":[{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABmJLR0QA/wD/AP+gvaeTAAAC2UlEQVRIicWVMUyTaRjHf/+vVUpOJOdilOYoUvVreq2CDmLOwdlAS5xMbrrhBifjYG7QjYuJw108nZx1huLgYlw0QshxChUK2koxHHcuCmg...`
- ✓ **startup** Starting MCPG in ROUTED mode on 0.0.0.0:8080
- ✓ **startup** Routes: /mcp/<server> where <server> is one of: [github safeoutputs]
- ✓ **startup** TLS not configured — listening on http://0.0.0.0:8080 (set --tls-cert/--tls-key to enable)
- ✓ **backend**
  ```
  Successfully connected to MCP backend server, command=docker
  ```
- 🔍 rpc **safeoutputs**→`tools/call` `{"jsonrpc":"2.0","method":"tools/call","params":{"arguments":{"body":"Adds five entries for three EVs now sold in Australia and sets `updated` to 2026-11-18.\n\n| Change | Old → new | Source and exact figures |\n|---|---|---|\n| MG MGU9 EV (`mg-u9-ev-2026`) | none → added | MG Australia, mgmotor.com.au/vehicles/mgu9-ev: \"Available Now\", 102.2 kWh LFP, 430 km WLTP, 115 kW peak DC, 11 kW AC, 20-80% in 42 min. |\n| Leapmotor B05 Design LR and Style (`leapmotor-b05-design-2026`, `leapmotor-b05-style-2026`...`
- 🔍 rpc **safeoutputs**←`resp`
  
  ```json
  {"id":1,"result":{"content":[{"text":"{\"result\":\"success\",\"patch\":{\"path\":\"/tmp/gh-aw/aw-suv4o-charge-line-data-catalogue-add-u9-b05-x9-2026-11-18.patch\",\"size\":11088,\"lines\":53},\"bundle\":{\"path\":\"/tmp/gh-aw/aw-suv4o-charge-line-data-catalogue-add-u9-b05-x9-2026-11-18.bundle\",\"size\":1285},\"output_id\":\"so_tM_lq-7wQFW4\"}","type":"text"}]}}
  ```
- 🔍 rpc **safeoutputs**→`tools/call` `push_repo_memory`
  
  ```json
  {"params":{"arguments":{"memory_id":"catalogue"},"name":"push_repo_memory"}}
  ```
- 🔍 rpc **safeoutputs**←`resp`
  
  ```json
  {"id":1,"result":{"content":[{"text":"{\"result\":\"success\",\"message\":\"Storage validation passed: 2 file(s), 3 KB total content, 3 KB patch diff (2421 bytes) (limit: 60 KB / 61440 bytes).\",\"storage_validation\":{\"result\":\"success\",\"files\":2,\"total_size_kb\":3,\"patch_size_bytes\":2421,\"effective_patch_limit_bytes\":61440},\"validation_marker\":\"/tmp/gh-aw/memory-validation/repo-catalogue.ok\"}","type":"text"}]}}
  ```
- ✓ **shutdown** Shutting down gateway...

</details>
