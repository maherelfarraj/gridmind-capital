'use client'

// ─── Core types ──────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface EndpointParam {
  name: string
  type: string
  required: boolean
  description: string
  location: 'path' | 'query' | 'body'
}

export interface EndpointExample {
  language: 'curl' | 'javascript' | 'python' | 'go'
  code: string
}

export interface Endpoint {
  id: string
  method: HttpMethod
  path: string
  description: string
  summary: string
  params: EndpointParam[]
  requestBody?: string   // JSON string
  responseBody: string   // JSON string
  examples: EndpointExample[]
}

export interface DocSection {
  id: string
  label: string
  children?: DocSection[]
  endpoints?: Endpoint[]
  content?: string   // markdown-ish prose
}

export interface ApiKey {
  id: string
  name: string
  key: string
  created: string
  lastUsed: string
  scopes: string[]
}

// ─── Method colour mapping ────────────────────────────────────────────────────

export const METHOD_STYLES: Record<HttpMethod, { bg: string; text: string; border: string }> = {
  GET:    { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/30' },
  POST:   { bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-emerald-500/30' },
  PUT:    { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/30' },
  PATCH:  { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  DELETE: { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/30' },
}

// ─── API documentation data ───────────────────────────────────────────────────

export const PROJECTS_ENDPOINTS: Endpoint[] = [
  {
    id: 'list-projects',
    method: 'GET',
    path: '/v1/projects',
    description: 'Returns a paginated list of projects for the authenticated tenant.',
    summary: 'List all projects',
    params: [
      { name: 'page',     type: 'integer', required: false, description: 'Page number (default: 1)',           location: 'query' },
      { name: 'per_page', type: 'integer', required: false, description: 'Items per page (default: 20, max: 100)', location: 'query' },
      { name: 'status',   type: 'string',  required: false, description: 'Filter by status: active | archived | draft', location: 'query' },
      { name: 'phase',    type: 'string',  required: false, description: 'Filter by phase slug',               location: 'query' },
    ],
    responseBody: JSON.stringify({
      data: [
        { id: 'proj_01J2XABC', name: 'Sirius 400MW Solar', status: 'active', phase: 'engineering', health: 'green', capacity_mw: 400 },
        { id: 'proj_01J2XDEF', name: 'Vega BESS 200MWh',   status: 'active', phase: 'procurement', health: 'amber', capacity_mw: 200 },
      ],
      meta: { total: 47, page: 1, per_page: 20 },
    }, null, 2),
    examples: [
      { language: 'curl', code: `curl -X GET "https://api.gridmind.capital/v1/projects?status=active" \\
  -H "Authorization: Bearer gm_live_sk_1234567890abcdef" \\
  -H "Content-Type: application/json"` },
      { language: 'javascript', code: `const response = await fetch(
  'https://api.gridmind.capital/v1/projects?status=active',
  {
    headers: {
      'Authorization': 'Bearer gm_live_sk_1234567890abcdef',
      'Content-Type': 'application/json',
    },
  }
)
const { data, meta } = await response.json()` },
      { language: 'python', code: `import requests

response = requests.get(
    'https://api.gridmind.capital/v1/projects',
    params={'status': 'active'},
    headers={'Authorization': 'Bearer gm_live_sk_1234567890abcdef'},
)
data = response.json()` },
      { language: 'go', code: `req, _ := http.NewRequest("GET",
    "https://api.gridmind.capital/v1/projects?status=active", nil)
req.Header.Set("Authorization", "Bearer gm_live_sk_1234567890abcdef")
client := &http.Client{}
resp, _ := client.Do(req)` },
    ],
  },
  {
    id: 'create-project',
    method: 'POST',
    path: '/v1/projects',
    description: 'Creates a new project and initiates the G0 intake workflow.',
    summary: 'Create a project',
    params: [
      { name: 'name',        type: 'string',  required: true,  description: 'Project name',               location: 'body' },
      { name: 'type',        type: 'string',  required: true,  description: 'solar | wind | bess | grid',  location: 'body' },
      { name: 'capacity_mw', type: 'number',  required: false, description: 'Installed capacity in MW',   location: 'body' },
      { name: 'country',     type: 'string',  required: false, description: 'ISO 3166-1 alpha-2 country code', location: 'body' },
    ],
    requestBody: JSON.stringify({ name: 'Orion Wind 300MW', type: 'wind', capacity_mw: 300, country: 'SA' }, null, 2),
    responseBody: JSON.stringify({ id: 'proj_01J2XGHI', name: 'Orion Wind 300MW', status: 'draft', phase: 'intake', created_at: '2026-07-21T10:00:00Z' }, null, 2),
    examples: [
      { language: 'curl', code: `curl -X POST "https://api.gridmind.capital/v1/projects" \\
  -H "Authorization: Bearer gm_live_sk_1234567890abcdef" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Orion Wind 300MW","type":"wind","capacity_mw":300}'` },
      { language: 'javascript', code: `const response = await fetch(
  'https://api.gridmind.capital/v1/projects',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer gm_live_sk_1234567890abcdef',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Orion Wind 300MW',
      type: 'wind',
      capacity_mw: 300,
    }),
  }
)
const project = await response.json()` },
      { language: 'python', code: `import requests

response = requests.post(
    'https://api.gridmind.capital/v1/projects',
    json={'name': 'Orion Wind 300MW', 'type': 'wind', 'capacity_mw': 300},
    headers={'Authorization': 'Bearer gm_live_sk_1234567890abcdef'},
)
project = response.json()` },
      { language: 'go', code: `body := strings.NewReader(\`{"name":"Orion Wind 300MW","type":"wind"}\`)
req, _ := http.NewRequest("POST",
    "https://api.gridmind.capital/v1/projects", body)
req.Header.Set("Authorization", "Bearer gm_live_sk_1234567890abcdef")
req.Header.Set("Content-Type", "application/json")` },
    ],
  },
  {
    id: 'get-project',
    method: 'GET',
    path: '/v1/projects/{id}',
    description: 'Retrieve a single project by its ID.',
    summary: 'Get a project',
    params: [
      { name: 'id', type: 'string', required: true, description: 'Project ID', location: 'path' },
    ],
    responseBody: JSON.stringify({ id: 'proj_01J2XABC', name: 'Sirius 400MW Solar', status: 'active', phase: 'engineering', health: 'green', capacity_mw: 400, country: 'SA', created_at: '2025-03-01T09:00:00Z' }, null, 2),
    examples: [
      { language: 'curl', code: `curl -X GET "https://api.gridmind.capital/v1/projects/proj_01J2XABC" \\
  -H "Authorization: Bearer gm_live_sk_1234567890abcdef"` },
      { language: 'javascript', code: `const res = await fetch('/v1/projects/proj_01J2XABC', {
  headers: { 'Authorization': 'Bearer gm_live_sk_1234567890abcdef' }
})
const project = await res.json()` },
      { language: 'python', code: `r = requests.get('/v1/projects/proj_01J2XABC',
    headers={'Authorization': 'Bearer gm_live_sk_1234567890abcdef'})` },
      { language: 'go', code: `req, _ := http.NewRequest("GET", "/v1/projects/proj_01J2XABC", nil)
req.Header.Set("Authorization", "Bearer gm_live_sk_1234567890abcdef")` },
    ],
  },
]

export const GATES_ENDPOINTS: Endpoint[] = [
  {
    id: 'list-gates',
    method: 'GET',
    path: '/v1/projects/{project_id}/gates',
    description: 'Returns all stage-gates for a project, including current status and pending signatures.',
    summary: 'List stage gates',
    params: [
      { name: 'project_id', type: 'string', required: true, description: 'Project ID', location: 'path' },
    ],
    responseBody: JSON.stringify({
      data: [
        { id: 'gate_g3', code: 'G3', name: 'Financial Close', status: 'approved', approved_at: '2026-06-10T14:00:00Z' },
        { id: 'gate_g4', code: 'G4', name: 'Construction Ready', status: 'convened', pending_signatures: 2 },
      ],
    }, null, 2),
    examples: [
      { language: 'curl', code: `curl "https://api.gridmind.capital/v1/projects/proj_01J2XABC/gates" \\
  -H "Authorization: Bearer gm_live_sk_1234567890abcdef"` },
      { language: 'javascript', code: `const res = await fetch('/v1/projects/proj_01J2XABC/gates', {
  headers: { 'Authorization': 'Bearer gm_live_sk_1234567890abcdef' }
})
const { data } = await res.json()` },
      { language: 'python', code: `r = requests.get('/v1/projects/proj_01J2XABC/gates',
    headers={'Authorization': 'Bearer ...'})` },
      { language: 'go', code: `req, _ := http.NewRequest("GET",
    "/v1/projects/proj_01J2XABC/gates", nil)` },
    ],
  },
  {
    id: 'advance-gate',
    method: 'POST',
    path: '/v1/gates/{gate_id}/advance',
    description: 'Advances a gate through its workflow. Requires appropriate role and all preconditions to be met.',
    summary: 'Advance a gate',
    params: [
      { name: 'gate_id',  type: 'string', required: true, description: 'Gate ID',           location: 'path' },
      { name: 'decision', type: 'string', required: true, description: 'approve | reject | condition', location: 'body' },
      { name: 'rationale',type: 'string', required: true, description: 'Decision rationale (min 20 chars)', location: 'body' },
    ],
    requestBody: JSON.stringify({ decision: 'approve', rationale: 'All preconditions met. Punch list closed.' }, null, 2),
    responseBody: JSON.stringify({ id: 'gate_g4', status: 'approved', decided_by: 'usr_ABC', decided_at: '2026-07-21T10:00:00Z' }, null, 2),
    examples: [
      { language: 'curl', code: `curl -X POST "https://api.gridmind.capital/v1/gates/gate_g4/advance" \\
  -H "Authorization: Bearer gm_live_sk_1234567890abcdef" \\
  -d '{"decision":"approve","rationale":"All preconditions met."}'` },
      { language: 'javascript', code: `await fetch('/v1/gates/gate_g4/advance', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer gm_live_sk_1234567890abcdef', 'Content-Type': 'application/json' },
  body: JSON.stringify({ decision: 'approve', rationale: 'All preconditions met.' }),
})` },
      { language: 'python', code: `requests.post('/v1/gates/gate_g4/advance',
    json={'decision': 'approve', 'rationale': 'All preconditions met.'},
    headers={'Authorization': 'Bearer ...'})` },
      { language: 'go', code: `body := strings.NewReader(\`{"decision":"approve","rationale":"..."}\`)
req, _ := http.NewRequest("POST", "/v1/gates/gate_g4/advance", body)` },
    ],
  },
]

export const TASKS_ENDPOINTS: Endpoint[] = [
  {
    id: 'list-tasks',
    method: 'GET',
    path: '/v1/tasks',
    description: 'Returns tasks assigned to or created by the authenticated user, optionally scoped to a project.',
    summary: 'List tasks',
    params: [
      { name: 'project_id', type: 'string',  required: false, description: 'Scope to a project',  location: 'query' },
      { name: 'assignee',   type: 'string',  required: false, description: 'Filter by user ID',   location: 'query' },
      { name: 'status',     type: 'string',  required: false, description: 'open | completed | overdue', location: 'query' },
    ],
    responseBody: JSON.stringify({ data: [{ id: 'tsk_001', title: 'Review earthing design', status: 'open', due: '2026-07-28', priority: 'high' }], meta: { total: 12 } }, null, 2),
    examples: [
      { language: 'curl', code: `curl "https://api.gridmind.capital/v1/tasks?status=open" \\
  -H "Authorization: Bearer gm_live_sk_1234567890abcdef"` },
      { language: 'javascript', code: `const res = await fetch('/v1/tasks?status=open', {
  headers: { 'Authorization': 'Bearer gm_live_sk_...' }
})` },
      { language: 'python', code: `requests.get('/v1/tasks', params={'status': 'open'},
    headers={'Authorization': 'Bearer ...'})` },
      { language: 'go', code: `req, _ := http.NewRequest("GET", "/v1/tasks?status=open", nil)` },
    ],
  },
]

export const WEBHOOKS_CONTENT = `
## Webhooks

Receive real-time notifications when events occur in GridMind Capital. Register a webhook endpoint and we'll send HTTP POST requests to your URL.

### Registering a webhook

POST /v1/webhooks

### Event types

| Event | Description |
|-------|-------------|
| project.created | A new project was created |
| gate.advanced | A stage gate changed status |
| gate.approved | A gate was approved |
| document.approved | A document completed review |
| task.completed | A task was marked complete |
| budget.exceeded | Budget threshold breached |

### Webhook payload

All webhook payloads share a common envelope:

\`\`\`json
{
  "id": "evt_01J2XABC",
  "type": "gate.approved",
  "created_at": "2026-07-21T10:00:00Z",
  "data": { ... }
}
\`\`\`

### Verification

Verify webhook authenticity using the HMAC-SHA256 signature in the \`X-GridMind-Signature\` header.
`

export const DOC_NAV: DocSection[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    children: [
      { id: 'introduction',   label: 'Introduction' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'base-urls',      label: 'Base URLs' },
      { id: 'rate-limits',    label: 'Rate Limits' },
      { id: 'error-handling', label: 'Error Handling' },
    ],
  },
  {
    id: 'core-resources',
    label: 'Core Resources',
    children: [
      { id: 'projects',  label: 'Projects',  endpoints: PROJECTS_ENDPOINTS },
      { id: 'gates',     label: 'Gates',     endpoints: GATES_ENDPOINTS },
      { id: 'tasks',     label: 'Tasks',     endpoints: TASKS_ENDPOINTS },
      { id: 'documents', label: 'Documents' },
      { id: 'users',     label: 'Users' },
      { id: 'reports',   label: 'Reports' },
    ],
  },
  { id: 'webhooks',      label: 'Webhooks' },
  { id: 'sdks',          label: 'SDKs & Libraries' },
  { id: 'changelog',     label: 'Changelog' },
]

export const MOCK_API_KEYS: ApiKey[] = [
  { id: 'key_1', name: 'Production',    key: 'gm_live_sk_a1b2c3d4e5f6789012345678abcdef01', created: '2026-01-15', lastUsed: '2 hours ago',   scopes: ['read', 'write'] },
  { id: 'key_2', name: 'Staging',       key: 'gm_test_sk_9876543210fedcba0987654321abcd02', created: '2026-03-20', lastUsed: '5 days ago',    scopes: ['read'] },
  { id: 'key_3', name: 'CI/CD Pipeline',key: 'gm_test_sk_deadbeef1234567890abcdef12345603', created: '2026-05-01', lastUsed: '1 hour ago',    scopes: ['read', 'write', 'admin'] },
]
