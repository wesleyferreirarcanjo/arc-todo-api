export interface McpToolRegistryEntry {
  key: string;
  group: string;
  displayName: string;
  description: string;
  defaultEnabled: boolean;
  sortOrder: number;
}

export const MCP_TOOL_REGISTRY: McpToolRegistryEntry[] = [
  {
    key: 'check_arc_todo_api_health',
    group: 'system',
    displayName: 'Check API health',
    description: 'Check whether the Arc Todo API is reachable and healthy.',
    defaultEnabled: true,
    sortOrder: 1,
  },
    {
    key: 'list_enabled_mcp_tools',
    group: 'system',
    displayName: 'List enabled MCP tools',
    description: 'List MCP tools registered by this server at startup.',
    defaultEnabled: true,
    sortOrder: 2,
  },
  {
    key: 'set_caller_auth',
    group: 'system',
    displayName: 'Set caller auth',
    description:
      'Prove an Arc Todo JWT via GET /auth/me. Grok/cloud HTTP connectors do not reuse MCP sessions, so this does not authenticate later tools. Pass arc_todo_token on every tenant tool call instead.',
    defaultEnabled: true,
    sortOrder: 3,
  },
  {
    key: 'list_organizations',
    group: 'context',
    displayName: 'List organizations',
    description: 'List organizations the authenticated user belongs to.',
    defaultEnabled: true,
    sortOrder: 10,
  },
  {
    key: 'get_organization',
    group: 'context',
    displayName: 'Get organization',
    description: 'Fetch one organization by ID.',
    defaultEnabled: true,
    sortOrder: 11,
  },
  {
    key: 'create_organization',
    group: 'context',
    displayName: 'Create organization',
    description:
      'Create an organization. If the caller already has one with the same trimmed name, return that row instead of inserting a duplicate.',
    defaultEnabled: true,
    sortOrder: 15,
  },
  {
    key: 'update_organization',
    group: 'context',
    displayName: 'Update organization',
    description: 'Update an organization name, slug, or color. Admin-only.',
    defaultEnabled: true,
    sortOrder: 15,
  },
  {
    key: 'delete_organization',
    group: 'context',
    displayName: 'Delete organization',
    description:
      'Delete an organization. This will remove the organization and its projects.',
    defaultEnabled: true,
    sortOrder: 15,
  },
  {
    key: 'list_organization_members',
    group: 'context',
    displayName: 'List organization members',
    description: 'List login members of an organization with roles.',
    defaultEnabled: true,
    sortOrder: 12,
  },
  {
    key: 'create_organization_user',
    group: 'context',
    displayName: 'Create organization user',
    description: 'Create a login user and add them to an organization.',
    defaultEnabled: true,
    sortOrder: 13,
  },
  {
    key: 'add_organization_member',
    group: 'context',
    displayName: 'Add organization member',
    description: 'Add an existing login user to an organization by username.',
    defaultEnabled: true,
    sortOrder: 14,
  },
  {
    key: 'list_projects',
    group: 'context',
    displayName: 'List projects',
    description: 'List projects in an organization.',
    defaultEnabled: true,
    sortOrder: 16,
  },
  {
    key: 'create_project',
    group: 'context',
    displayName: 'Create project',
    description: 'Create a project in an organization. If the caller already has one with the same trimmed name in that organization, return that row instead of inserting a duplicate.',
    defaultEnabled: true,
    sortOrder: 17,
  },
  {
    key: 'get_project',
    group: 'context',
    displayName: 'Get project',
    description: 'Fetch one project by organization and project ID.',
    defaultEnabled: true,
    sortOrder: 18,
  },
  {
    key: 'update_project',
    group: 'context',
    displayName: 'Update project',
    description: 'Update a project name, description, or color. Admin-only.',
    defaultEnabled: true,
    sortOrder: 19,
  },
  {
    key: 'delete_project',
    group: 'context',
    displayName: 'Delete project',
    description:
      'Delete a project from an organization. This will remove the project and its tasks.',
    defaultEnabled: true,
    sortOrder: 19,
  },
  {
    key: 'list_tasks',
    group: 'tasks',
    displayName: 'List tasks',
    description:
      'List tasks with optional filters. Default include=summary. Rows omit nested project/organization objects. Pass q, limit, and parents_only for duplicate checks. organization_id/project_id UUIDs are optional: use project=ski (acronym) or a friendly task id on another call in this session.',
    defaultEnabled: true,
    sortOrder: 20,
  },
  {
    key: 'list_project_tasks',
    group: 'tasks',
    displayName: 'List project tasks',
    description:
      'List tasks in one project. Leaner than list_tasks (no nested org/project). Pass project=ski (acronym) or slug; UUIDs optional. status, q, limit, and parents_only filter the board so duplicate checks do not pull every status.',
    defaultEnabled: true,
    sortOrder: 21,
  },
  {
    key: 'get_task',
    group: 'tasks',
    displayName: 'Get task',
    description:
      'Fetch one task. Default include=plan (business + plan/code, no QA essay). Friendly IDs like #arc-1 do not need organization_id/project_id. include: summary | plan | qa | full.',
    defaultEnabled: true,
    sortOrder: 22,
  },
  {
    key: 'create_task',
    group: 'tasks',
    displayName: 'Create task',
    description:
      'Create a task in a project. Pass project=ski (acronym) or skill (slug) instead of UUIDs. Optional parent_task_id creates a direct subtask.',
    defaultEnabled: true,
    sortOrder: 23,
  },
  {
    key: 'move_task',
    group: 'tasks',
    displayName: 'Move task',
    description:
      'Change only a task board status. Prefer this over update_task for column moves. Friendly IDs like #arc-1 do not need organization_id/project_id. Response is a short ack.',
    defaultEnabled: true,
    sortOrder: 24,
  },
  {
    key: 'update_task',
    group: 'tasks',
    displayName: 'Update task',
    description:
      'Update task fields (title, descriptions, bug flag, checklist). Do not use this only to change status — use move_task. Default response is ack (id/title/status), not the full card.',
    defaultEnabled: true,
    sortOrder: 25,
  },
  {
    key: 'delete_task',
    group: 'tasks',
    displayName: 'Delete task',
    description: 'Delete a task from a project.',
    defaultEnabled: true,
    sortOrder: 25,
  },
  {
    key: 'list_task_comments',
    group: 'tasks',
    displayName: 'List task comments',
    description:
      'List comments on a task. Use only when is_bug is true or the user asked. Supports friendly task IDs.',
    defaultEnabled: true,
    sortOrder: 26,
  },
  {
    key: 'add_task_comment',
    group: 'tasks',
    displayName: 'Add task comment',
    description: 'Post a comment on a task. Supports friendly task IDs.',
    defaultEnabled: true,
    sortOrder: 27,
  },
  {
    key: 'list_task_evidence',
    group: 'tasks',
    displayName: 'List task evidence',
    description:
      'List image/video evidence attachments on a task. Use only when is_bug is true or the user asked. Supports friendly task IDs.',
    defaultEnabled: true,
    sortOrder: 28,
  },
  {
    key: 'download_task_evidence',
    group: 'tasks',
    displayName: 'Download task evidence',
    description:
      'Download one task evidence file. Images return as MCP image content for vision; non-images include base64.',
    defaultEnabled: true,
    sortOrder: 29,
  },
  {
    key: 'list_task_logs',
    group: 'tasks',
    displayName: 'List task logs',
    description:
      'List QA session log JSON files on a task. Supports friendly task IDs. Pass arc_todo_token on Grok HTTP calls.',
    defaultEnabled: true,
    sortOrder: 30,
  },
  {
    key: 'download_task_logs',
    group: 'tasks',
    displayName: 'Download task logs',
    description:
      'Download one QA session log as JSON text. Supports friendly task IDs. Pass arc_todo_token on Grok HTTP calls.',
    defaultEnabled: true,
    sortOrder: 31,
  },
  {
    key: 'list_task_history',
    group: 'tasks',
    displayName: 'List task history',
    description:
      'List field-change history for a task (title, description, dueDate, isBug, bugReason). Use only when is_bug is true or the user asked. Supports friendly task IDs.',
    defaultEnabled: true,
    sortOrder: 32,
  },
  {
    key: 'get_task_bug_flag',
    group: 'tasks',
    displayName: 'Get task bug flag',
    description:
      'Check whether a Grok bug-flag dossier already exists for this task. Returns { flag: null } when none. Admin analytics only; never shown on the board. Friendly IDs like #arc-296 work. Pass arc_todo_token on Grok HTTP calls.',
    defaultEnabled: true,
    sortOrder: 33,
  },
  {
    key: 'create_task_bug_flag',
    group: 'tasks',
    displayName: 'Create task bug flag',
    description:
      'File a Grok bug-report dossier on a task (primary REAL_DEFECT | INSUFFICIENT_EVIDENCE; secondary regression, not_deployed, missing_evidence, missing_repro; motivo; evidence; task_score 1-10; flag_score 1-10). Stored for admin Analytics only. Friendly IDs like #arc-296. Pass arc_todo_token on Grok HTTP calls.',
    defaultEnabled: true,
    sortOrder: 34,
  },
  {
    key: 'list_organization_activity',
    group: 'activity',
    displayName: 'List organization activity',
    description: 'List recent user activity for an organization.',
    defaultEnabled: true,
    sortOrder: 30,
  },
  {
    key: 'list_project_diagrams',
    group: 'diagrams',
    displayName: 'List project diagrams',
    description:
      'List Excalidraw diagrams for a project (id, title, thumbnail, timestamps).',
    defaultEnabled: true,
    sortOrder: 50,
  },
  {
    key: 'get_project_diagram',
    group: 'diagrams',
    displayName: 'Get project diagram',
    description: 'Fetch one project diagram including Excalidraw scene_json.',
    defaultEnabled: true,
    sortOrder: 51,
  },
  {
    key: 'create_project_diagram',
    group: 'diagrams',
    displayName: 'Create project diagram',
    description:
      'Create a project Excalidraw diagram with a title and optional scene_json.',
    defaultEnabled: true,
    sortOrder: 52,
  },
  {
    key: 'update_project_diagram',
    group: 'diagrams',
    displayName: 'Update project diagram',
    description: 'Update a project diagram title and/or Excalidraw scene_json.',
    defaultEnabled: true,
    sortOrder: 53,
  },
  {
    key: 'delete_project_diagram',
    group: 'diagrams',
    displayName: 'Delete project diagram',
    description: 'Delete a project Excalidraw diagram.',
    defaultEnabled: true,
    sortOrder: 54,
  },
  {
    key: 'list_project_wireframes',
    group: 'wireframes',
    displayName: 'List project wireframes',
    description:
      'List HTML wireframe prototypes for a project (id, title, timestamps; omits html).',
    defaultEnabled: true,
    sortOrder: 60,
  },
  {
    key: 'get_project_wireframe',
    group: 'wireframes',
    displayName: 'Get project wireframe',
    description: 'Fetch one project wireframe including the HTML document.',
    defaultEnabled: true,
    sortOrder: 61,
  },
  {
    key: 'create_project_wireframe',
    group: 'wireframes',
    displayName: 'Create project wireframe',
    description:
      'Create a project HTML wireframe with a title and optional html document.',
    defaultEnabled: true,
    sortOrder: 62,
  },
  {
    key: 'update_project_wireframe',
    group: 'wireframes',
    displayName: 'Update project wireframe',
    description: 'Update a project wireframe title and/or HTML document.',
    defaultEnabled: true,
    sortOrder: 63,
  },
  {
    key: 'delete_project_wireframe',
    group: 'wireframes',
    displayName: 'Delete project wireframe',
    description: 'Delete a project HTML wireframe.',
    defaultEnabled: true,
    sortOrder: 64,
  },
  {
    key: 'list_project_name_sessions',
    group: 'names',
    displayName: 'List project name sessions',
    description:
      'List naming sessions (id, title, recommendedName, candidateCount, timestamps; omits bulky candidates). Not scoped to a project.',
    defaultEnabled: true,
    sortOrder: 70,
  },
  {
    key: 'get_name_session',
    group: 'names',
    displayName: 'Get name session',
    description:
      'Fetch one naming session including product description, lanes, candidates, evidence, and recommendation.',
    defaultEnabled: true,
    sortOrder: 71,
  },
  {
    key: 'update_name_session',
    group: 'names',
    displayName: 'Update name session',
    description: 'Update naming session title, goal, or product description.',
    defaultEnabled: true,
    sortOrder: 73,
  },
  {
    key: 'add_name_candidates',
    group: 'names',
    displayName: 'Add name candidates',
    description:
      'Add up to 20 name candidates to a session. Source is recorded as MCP.',
    defaultEnabled: true,
    sortOrder: 74,
  },
  {
    key: 'check_name_candidate',
    group: 'names',
    displayName: 'Check name candidate',
    description:
      'Run DNS/RDAP checks for a candidate. Does not register or buy a domain.',
    defaultEnabled: true,
    sortOrder: 75,
  },
  {
    key: 'recommend_name_candidate',
    group: 'names',
    displayName: 'Recommend name candidate',
    description:
      'Recommend a candidate with a decision note. Does not claim legal clearance.',
    defaultEnabled: true,
    sortOrder: 76,
  },
  {
    key: 'get_project_qa_info',
    group: 'qa',
    displayName: 'Get project QA info',
    description:
      'Fetch the project QA info profile (environments, test users, notes). Empty when none is saved yet.',
    defaultEnabled: true,
    sortOrder: 80,
  },
  {
    key: 'update_project_qa_info',
    group: 'qa',
    displayName: 'Update project QA info',
    description:
      'Create or replace the project QA info profile. Omit a field to keep the current value. No password field.',
    defaultEnabled: true,
    sortOrder: 81,
  },
  {
    key: 'list_project_seo_sites',
    group: 'seo',
    displayName: 'List project SEO sites',
    description:
      'List SEO sites for a project (hostname, title, gscConnected). Never returns Search Console tokens.',
    defaultEnabled: true,
    sortOrder: 90,
  },
  {
    key: 'get_seo_site',
    group: 'seo',
    displayName: 'Get SEO site',
    description:
      'Fetch one project SEO site. Never returns the Search Console refresh token.',
    defaultEnabled: true,
    sortOrder: 91,
  },
  {
    key: 'create_seo_site',
    group: 'seo',
    displayName: 'Create SEO site',
    description:
      'Create a project SEO site from a public hostname. Empty or private addresses are refused.',
    defaultEnabled: true,
    sortOrder: 92,
  },
  {
    key: 'run_seo_audit',
    group: 'seo',
    displayName: 'Run SEO audit',
    description:
      'Enqueue a same-host crawl plus homepage Lighthouse for a SEO site. Returns a run id to poll.',
    defaultEnabled: true,
    sortOrder: 93,
  },
  {
    key: 'list_seo_keywords',
    group: 'seo',
    displayName: 'List SEO keywords',
    description:
      'Fetch Search Console queries and pages for a connected site. Returns the not-connected error when disconnected.',
    defaultEnabled: true,
    sortOrder: 94,
  },
  {
    key: 'cloud_list_servers',
    group: 'cloud',
    displayName: 'List cloud servers',
    description:
      'List arc-cloud managed Docker servers with transport, status, Docker version, and panel detection.',
    defaultEnabled: true,
    sortOrder: 100,
  },
  {
    key: 'cloud_add_ssh_server',
    group: 'cloud',
    displayName: 'Add SSH server',
    description:
      'Register a Docker server managed over SSH. The private key is stored encrypted and never returned.',
    defaultEnabled: true,
    sortOrder: 101,
  },
  {
    key: 'cloud_add_agent_server',
    group: 'cloud',
    displayName: 'Add agent server',
    description:
      'Register a server controlled by an outbound arc-cloud agent. Returns a one-time agent token for the agent install command.',
    defaultEnabled: true,
    sortOrder: 102,
  },
  {
    key: 'cloud_list_containers',
    group: 'cloud',
    displayName: 'List server containers',
    description:
      'List Docker containers on one arc-cloud server (id, name, image, state, status).',
    defaultEnabled: true,
    sortOrder: 103,
  },
  {
    key: 'cloud_refresh_server',
    group: 'cloud',
    displayName: 'Refresh server',
    description:
      'Re-probe one arc-cloud server for Docker version, swarm state, and panel detection.',
    defaultEnabled: true,
    sortOrder: 104,
  },
  {
    key: 'cloud_remove_server',
    group: 'cloud',
    displayName: 'Remove server',
    description:
      'Remove a server from arc-cloud management. Destructive: requires confirm=true. Does not touch containers on the host.',
    defaultEnabled: false,
    sortOrder: 105,
  },
  {
    key: 'cloud_proxy_status',
    group: 'cloud',
    displayName: 'Cloud proxy status',
    description:
      'Show the arc-cloud Traefik proxy state on one server (not_installed, running, error) with version and last detail.',
    defaultEnabled: true,
    sortOrder: 106,
  },
  {
    key: 'cloud_install_proxy',
    group: 'cloud',
    displayName: 'Install cloud proxy',
    description:
      'Take over ports 80/443 with the arc-cloud Traefik proxy while preserving the detected panel routes (Coolify labels or Easypanel route files). Requires confirm=true. Refuses build machines and unsafe routing; auto-rolls-back on post-check failure.',
    defaultEnabled: false,
    sortOrder: 107,
  },
  {
    key: 'cloud_rollback_proxy',
    group: 'cloud',
    displayName: 'Rollback cloud proxy',
    description:
      'Remove arc-cloud-proxy and restore the panel proxy recorded at install, then re-check the routed hosts. Requires confirm=true.',
    defaultEnabled: false,
    sortOrder: 108,
  },
  {
    key: 'cloud_list_apps',
    group: 'cloud',
    displayName: 'List cloud apps',
    description:
      'List arc-cloud applications with source, server, domains, and status (running, deploying, stopped, failed).',
    defaultEnabled: true,
    sortOrder: 109,
  },
  {
    key: 'cloud_create_app',
    group: 'cloud',
    displayName: 'Create cloud app',
    description:
      'Create an arc-cloud application from a container image or a compose file, with port, health check path, and HTTPS domains. Build machines are refused as targets.',
    defaultEnabled: true,
    sortOrder: 110,
  },
  {
    key: 'cloud_update_app',
    group: 'cloud',
    displayName: 'Update cloud app',
    description:
      "Update an app's image, compose file, port, health check, domains, or target server. Omitted fields keep their current values.",
    defaultEnabled: true,
    sortOrder: 111,
  },
  {
    key: 'cloud_set_env',
    group: 'cloud',
    displayName: 'Set app environment',
    description:
      "Replace an app's environment variables. Stored AES-256-GCM encrypted; deploy logs mask every value.",
    defaultEnabled: true,
    sortOrder: 112,
  },
  {
    key: 'cloud_get_env',
    group: 'cloud',
    displayName: 'Get app environment',
    description:
      "Read an app's environment keys. Values are masked by default; reveal=true returns plaintext and is audited server-side.",
    defaultEnabled: true,
    sortOrder: 113,
  },
  {
    key: 'cloud_deploy',
    group: 'cloud',
    displayName: 'Deploy cloud app',
    description:
      'Deploy an app. The new container must pass its health check before the old one is removed — the running version stays up on failure. Returns a deploymentId for cloud_get_deployment.',
    defaultEnabled: true,
    sortOrder: 114,
  },
  {
    key: 'cloud_get_deployment',
    group: 'cloud',
    displayName: 'Get deployment',
    description:
      "Show one deployment's status, trigger, actor, and full masked deploy log.",
    defaultEnabled: true,
    sortOrder: 115,
  },
  {
    key: 'cloud_list_deployments',
    group: 'cloud',
    displayName: 'List app deployments',
    description: "List an app's deployment history, newest first.",
    defaultEnabled: true,
    sortOrder: 116,
  },
  {
    key: 'cloud_rollback',
    group: 'cloud',
    displayName: 'Rollback cloud app',
    description:
      'Deploy the image ref of the latest previous healthy deployment. Health-gated like a normal deploy: the current version stays up until the rollback target passes its check.',
    defaultEnabled: true,
    sortOrder: 117,
  },
  {
    key: 'cloud_restart_app',
    group: 'cloud',
    displayName: 'Restart cloud app',
    description: 'Restart the currently running app container or compose stack.',
    defaultEnabled: true,
    sortOrder: 118,
  },
  {
    key: 'cloud_start_app',
    group: 'cloud',
    displayName: 'Start cloud app',
    description: "Start a stopped app's container or compose stack.",
    defaultEnabled: true,
    sortOrder: 119,
  },
  {
    key: 'cloud_stop_app',
    group: 'cloud',
    displayName: 'Stop cloud app',
    description:
      "Stop a running app's container or compose stack. The app stops serving its domains. Requires confirm=true.",
    defaultEnabled: false,
    sortOrder: 120,
  },
  {
    key: 'cloud_delete_app',
    group: 'cloud',
    displayName: 'Delete cloud app',
    description:
      'Delete an app, its container/compose stack on the server, and its deployment history. Requires confirm=true.',
    defaultEnabled: false,
    sortOrder: 121,
  },
  {
    key: 'cloud_app_logs',
    group: 'cloud',
    displayName: 'App container logs',
    description:
      "Tail the running app container's output (1-1000 lines, masked). For compose apps this follows the first running service.",
    defaultEnabled: true,
    sortOrder: 122,
  },
  {
    key: 'cloud_build_and_deploy',
    group: 'cloud',
    displayName: 'Build and deploy from git',
    description:
      'Build an app\'s Docker image from its git source and deploy it. Builds run on a build machine when one is online (per build policy), else on the target server. The commit must be pushed — every deployment maps to a commit sha. Returns a deploymentId.',
    defaultEnabled: true,
    sortOrder: 123,
  },
  {
    key: 'cloud_set_app_source',
    group: 'cloud',
    displayName: 'Set app git source',
    description:
      'Configure an app to build from git: provider (github_app, deploy_key, or public repo), repo, branch, Dockerfile path, context, auto-deploy on push, and the registry the image is pushed to. Set git_provider to an empty string to revert to image/compose deploys.',
    defaultEnabled: true,
    sortOrder: 124,
  },
  {
    key: 'cloud_set_build_policy',
    group: 'cloud',
    displayName: 'Set app build policy',
    description:
      'Set where an app\'s builds run: local_preferred (build machine when online, target fallback), local_only (queues while no machine is online), or server_only (always the target). Optionally restrict which build machines may build the app.',
    defaultEnabled: true,
    sortOrder: 125,
  },
  {
    key: 'cloud_set_build_machine',
    group: 'cloud',
    displayName: 'Configure build machine',
    description:
      'Configure a build-role server: whether it accepts builds, its priority (higher wins), and max parallel builds. Build machines never run deployed applications.',
    defaultEnabled: true,
    sortOrder: 126,
  },
  {
    key: 'cloud_set_build_checkout',
    group: 'cloud',
    displayName: 'Map app checkout path',
    description:
      'Map an app to an existing git checkout on a build machine — the build fetches into it and uses a detached worktree, so the working tree is never touched. Empty path clears the mapping.',
    defaultEnabled: true,
    sortOrder: 127,
  },
  {
    key: 'cloud_github_app_status',
    group: 'cloud',
    displayName: 'GitHub App status',
    description:
      'Show whether the arc-cloud GitHub App is configured (app id, installation id, webhook secret present). Required for private repos, push webhooks, and ghcr pushes.',
    defaultEnabled: true,
    sortOrder: 128,
  },
  {
    key: 'cloud_create_deploy_key',
    group: 'cloud',
    displayName: 'Create app deploy key',
    description:
      'Generate an Ed25519 deploy key for an app\'s deploy_key git source. Returns the public key once — add it as a read-only deploy key on the GitHub repo. The private key is stored encrypted and never returned.',
    defaultEnabled: true,
    sortOrder: 129,
  },
  {
    key: 'cloud_list_coolify_apps',
    group: 'cloud',
    displayName: 'List Coolify apps',
    description:
      'List applications on the configured Coolify instance (uuid, name, domains, build pack, status). Read-only.',
    defaultEnabled: true,
    sortOrder: 130,
  },
  {
    key: 'cloud_import_coolify_app',
    group: 'cloud',
    displayName: 'Import Coolify app',
    description:
      'Read a Coolify application (source, env, domains, port, volumes) and create an arc-cloud draft app — nothing is deployed and no domains are claimed. Returns the side-by-side summary; then call cloud_confirm_import.',
    defaultEnabled: true,
    sortOrder: 131,
  },
  {
    key: 'cloud_list_easypanel_apps',
    group: 'cloud',
    displayName: 'List Easypanel apps',
    description:
      'List projects and their services on the configured Easypanel instance (project, service, type). Read-only.',
    defaultEnabled: true,
    sortOrder: 132,
  },
  {
    key: 'cloud_import_easypanel_app',
    group: 'cloud',
    displayName: 'Import Easypanel app',
    description:
      'Read an Easypanel app service (source, env, domains, port, mounts) and create an arc-cloud draft app — nothing is deployed and no domains are claimed. Returns the side-by-side summary; then call cloud_confirm_import.',
    defaultEnabled: true,
    sortOrder: 133,
  },
  {
    key: 'cloud_confirm_import',
    group: 'cloud',
    displayName: 'Confirm imported app',
    description:
      'Confirm a draft app created by a panel import — unlocks deploy and lifecycle actions. Refuses on apps that are not pending imports.',
    defaultEnabled: true,
    sortOrder: 134,
  },
  {
    key: 'observer_search',
    group: 'observer',
    displayName: 'Search logs',
    description:
      'Search collected container logs across servers. Filter by server (name or uuid), app, level (trace/debug/info/warn/error), free text (q), and epoch-millis bounds (from_ms/to_ms). Returns newest-first lines with has_more; pass the oldest line ts as before_ms to page back.',
    defaultEnabled: true,
    sortOrder: 140,
  },
  {
    key: 'observer_tail',
    group: 'observer',
    displayName: 'Tail logs',
    description:
      'Read the newest container log lines for a server/app, oldest first. Pass the newest returned line ts as after_ms to fetch only newer lines on the next call.',
    defaultEnabled: true,
    sortOrder: 141,
  },
  {
    key: 'observer_explain',
    group: 'observer',
    displayName: 'Explain error logs',
    description:
      'Ask the AI to explain recent error-level log lines (default: last 60 minutes, up to 24h). Optionally scope to a server/app and add a question. Powered by arc-todo-chatbot (DeepSeek).',
    defaultEnabled: true,
    sortOrder: 142,
  },
  {
    key: 'observer_list_tokens',
    group: 'observer',
    displayName: 'List observer agent tokens',
    description:
      'List observer ingest tokens (one per server). Returns id, server name, created/revoked/last-seen timestamps. Token values are never shown.',
    defaultEnabled: true,
    sortOrder: 143,
  },
  {
    key: 'observer_create_token',
    group: 'observer',
    displayName: 'Create observer agent token',
    description:
      'Create an ingest token for a server name. The aob_ token is returned exactly once — copy it into the agent OBSERVER_AGENT_TOKEN.',
    defaultEnabled: true,
    sortOrder: 144,
  },
  {
    key: 'observer_revoke_token',
    group: 'observer',
    displayName: 'Revoke observer agent token',
    description:
      'Revoke an observer ingest token by id. Requires confirm=true.',
    defaultEnabled: false,
    sortOrder: 145,
  },
  {
    key: 'observer_list_app_tokens',
    group: 'observer',
    displayName: 'List observer app tokens',
    description:
      'List observer app-ingest tokens (aap_, one per app key). Returns id, app, created/revoked/last-seen timestamps. Token values are never shown.',
    defaultEnabled: true,
    sortOrder: 146,
  },
  {
    key: 'observer_create_app_token',
    group: 'observer',
    displayName: 'Create observer app token',
    description:
      'Create an app-ingest token bound to an app key (e.g. arccloud:my-app or a free-form name). The aap_ token is returned exactly once — put it in the app\'s log SDK config.',
    defaultEnabled: true,
    sortOrder: 147,
  },
  {
    key: 'observer_revoke_app_token',
    group: 'observer',
    displayName: 'Revoke observer app token',
    description:
      'Revoke an observer app-ingest token by id. Requires confirm=true. The app stops being able to send logs.',
    defaultEnabled: false,
    sortOrder: 148,
  },
  {
    key: 'metrics_list_servers',
    group: 'metrics',
    displayName: 'List metrics servers',
    description:
      'List servers reporting to arc-todo-metrics with status (online/stale/revoked), hostname, and current host CPU/memory/disk.',
    defaultEnabled: true,
    sortOrder: 150,
  },
  {
    key: 'metrics_server_resources',
    group: 'metrics',
    displayName: 'List server app resources',
    description:
      'List the app/container resources on one metrics server with windowed CPU/memory averages and peaks. Same rows as the Metrics page app table.',
    defaultEnabled: true,
    sortOrder: 151,
  },
  {
    key: 'metrics_server_series',
    group: 'metrics',
    displayName: 'Server host series',
    description:
      'Time series for one server\'s host metrics (CPU, memory, disk, network, restarts) over the window, bucketed to at most 500 points.',
    defaultEnabled: true,
    sortOrder: 152,
  },
  {
    key: 'metrics_resource_series',
    group: 'metrics',
    displayName: 'App resource series',
    description:
      'Time series for one app/container resource (CPU, memory, network, disk, restarts, OOM kills) over the window.',
    defaultEnabled: true,
    sortOrder: 153,
  },
  {
    key: 'metrics_list_agent_tokens',
    group: 'metrics',
    displayName: 'List metrics agent tokens',
    description:
      'List metrics agent tokens (one per server). Returns id, server name, created/revoked/last-seen timestamps. Token values are never shown.',
    defaultEnabled: true,
    sortOrder: 154,
  },
  {
    key: 'metrics_create_agent_token',
    group: 'metrics',
    displayName: 'Create metrics agent token',
    description:
      'Create an ingest token for a server name. The amt_ token is returned exactly once — copy it into the agent METRICS_AGENT_TOKEN.',
    defaultEnabled: true,
    sortOrder: 155,
  },
  {
    key: 'metrics_revoke_agent_token',
    group: 'metrics',
    displayName: 'Revoke metrics agent token',
    description:
      'Revoke a metrics agent token by id. Requires confirm=true. The agent on that server stops reporting metrics.',
    defaultEnabled: false,
    sortOrder: 156,
  },
  {
    key: 'metrics_list_app_tokens',
    group: 'metrics',
    displayName: 'List metrics app tokens',
    description:
      'List metrics app-ingest tokens (aap_, one per app key). Returns id, app, created/revoked/last-seen timestamps. Token values are never shown.',
    defaultEnabled: true,
    sortOrder: 157,
  },
  {
    key: 'metrics_create_app_token',
    group: 'metrics',
    displayName: 'Create metrics app token',
    description:
      'Create an app-ingest token bound to an app key (e.g. arccloud:my-app or a free-form name). The aap_ token is returned exactly once — put it in the app\'s metrics SDK config.',
    defaultEnabled: true,
    sortOrder: 158,
  },
  {
    key: 'metrics_revoke_app_token',
    group: 'metrics',
    displayName: 'Revoke metrics app token',
    description:
      'Revoke a metrics app-ingest token by id. Requires confirm=true. The app stops being able to send metrics.',
    defaultEnabled: false,
    sortOrder: 159,
  },
  {
    key: 'metrics_app_metrics',
    group: 'metrics',
    displayName: 'List app custom metrics',
    description:
      'List custom app metrics ingested through the SDK (POST /v1/apps/ingest/metrics). Optionally filter by app key. Returns one row per (app, metric) with series count and last-seen timestamp.',
    defaultEnabled: true,
    sortOrder: 160,
  },
  {
    key: 'metrics_app_series',
    group: 'metrics',
    displayName: 'App custom metric series',
    description:
      'Time series for one custom app metric (SDK ingest) over the window, one line per label set, bucketed to at most 500 points.',
    defaultEnabled: true,
    sortOrder: 161,
  },
  {
    key: 'hub_list_devices',
    group: 'hub',
    displayName: 'List hub devices',
    description:
      'List devices known to arc-hub (id, name, last-seen). Includes sync clients and paired remote-control hosts.',
    defaultEnabled: true,
    sortOrder: 170,
  },
  {
    key: 'hub_devices_presence',
    group: 'hub',
    displayName: 'Hub device presence',
    description:
      'Presence for every hub device: state (online|stale|paused|offline), paired/revoked/remote-enabled flags, active session count, and live sessions.',
    defaultEnabled: true,
    sortOrder: 171,
  },
  {
    key: 'hub_list_releases',
    group: 'hub',
    displayName: 'List hub releases',
    description:
      'List published Arc IDE releases: version, platform, size, sha256, publish date, and yanked flag.',
    defaultEnabled: true,
    sortOrder: 172,
  },
  {
    key: 'hub_yank_release',
    group: 'hub',
    displayName: 'Yank hub release',
    description:
      'Yank a published release version so devices stop getting it as an update. Requires confirm=true.',
    defaultEnabled: false,
    sortOrder: 173,
  },
  {
    key: 'hub_revoke_device',
    group: 'hub',
    displayName: 'Revoke hub device',
    description:
      'Revoke a paired device: remote control is disabled and heartbeats are rejected until it pairs again. Requires confirm=true.',
    defaultEnabled: false,
    sortOrder: 174,
  },
  {
    key: 'hub_list_shares',
    group: 'hub',
    displayName: 'List hub shares',
    description:
      'List published session-share links for one sync session id: share id, URL, expiry, revocation, size, and content hash.',
    defaultEnabled: true,
    sortOrder: 175,
  },
  {
    key: 'hub_revoke_share',
    group: 'hub',
    displayName: 'Revoke hub share',
    description:
      'Revoke a published share link by share id — the public /s/ page immediately returns 410. Requires confirm=true.',
    defaultEnabled: false,
    sortOrder: 176,
  },
];

export const MCP_TOOL_GROUPS = [
  'system',
  'context',
  'tasks',
  'diagrams',
  'wireframes',
  'names',
  'qa',
  'seo',
  'cloud',
  'observer',
  'metrics',
  'hub',
] as const;

export type McpToolGroup = (typeof MCP_TOOL_GROUPS)[number];
