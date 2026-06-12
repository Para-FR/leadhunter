// Client serveur pour l'API BrowserAct. La clé n'est JAMAIS exposée au navigateur :
// tout passe par les route handlers Next (app/api/browseract/*).

const BASE = process.env.BROWSERACT_API_BASE ?? "https://api.browseract.com";
const KEY = process.env.BROWSERACT_API_KEY;

export type TemplateSummary = {
  templateId: string;
  name: string;
  recommendDesc?: string;
  detailUrl?: string;
};

export type TemplateParam = {
  name: string;
  default_enabled?: boolean;
};

export type TemplateConfig = {
  id: string;
  name: string;
  recommendDesc?: string;
  detailUrl?: string;
  input_parameters: TemplateParam[];
};

export type TaskStep = {
  id?: string;
  step?: number;
  status?: string;
  step_goal?: string;
  evaluation_previous_goal?: string;
  screenshots_url?: string;
};

export type TaskStatus =
  | "created"
  | "running"
  | "finished"
  | "canceled"
  | "pausing"
  | "paused"
  | "failed"
  | "unknown";

export type Task = {
  id: string;
  status: TaskStatus;
  steps?: TaskStep[];
  output?: { string?: string; files?: string[] };
  workflow_id?: string;
  created_at?: string;
  finished_at?: string;
  credit?: number;
  download_files?: string[];
  log_detail_url?: string;
  task_failure_info?: unknown;
};

export const TERMINAL_STATUSES: TaskStatus[] = ["finished", "failed", "canceled"];

async function call<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  if (!KEY) throw new Error('Variable d\'environnement manquante : "BROWSERACT_API_KEY"');

  const url = new URL(`${BASE}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  // L'API renvoie soit la donnée directement, soit une enveloppe {code,msg,data}.
  if (!res.ok || (json && typeof json.code === "number" && json.code !== 200 && json.code !== 0)) {
    const msg = json?.msg ?? `HTTP ${res.status}`;
    throw new Error(`BrowserAct: ${msg}`);
  }
  // Certaines réponses enveloppent dans data, d'autres non.
  return (json?.data ?? json) as T;
}

export function listTemplates(keyword?: string, page = 1, limit = 100) {
  return call<{ items: TemplateSummary[]; total_count: number }>(
    "/v2/workflow/list-official-workflow-templates",
    { method: "GET", query: { keyword, page, limit } },
  );
}

export function getTemplate(templateId: string) {
  return call<TemplateConfig>("/v2/workflow/get-official-workflow-template", {
    method: "GET",
    query: { workflow_template_id: templateId },
  });
}

export function runByTemplate(
  templateId: string,
  inputParameters: { name: string; value: string }[],
  proxyRegion = "US",
) {
  return call<{ id: string; profile_id?: string }>("/v2/workflow/run-task-by-template", {
    method: "POST",
    body: JSON.stringify({
      workflow_template_id: templateId,
      input_parameters: inputParameters,
      proxyRegion,
    }),
  });
}

export function getTask(taskId: string) {
  return call<Task>("/v2/workflow/get-task", {
    method: "GET",
    query: { task_id: taskId },
  });
}
