const owner = 'dxawdc';
const repo = 'rov-skins';
const syncWorkflow = 'sync-data.yml';
const deployWorkflow = 'deploy.yml';
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

export type WorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  headSha: string;
  createdAt: string;
};

type RunsResponse = {
  workflow_runs?: Array<{
    id: number;
    status: string;
    conclusion: string | null;
    html_url: string;
    head_sha: string;
    created_at: string;
  }>;
};

function describeError(status: number): string {
  if (status === 401) return '令牌无效或已过期，请重新粘贴。';
  if (status === 403) return '令牌权限不足，需要本仓库的 Actions 读写权限。';
  if (status === 404) return '找不到仓库或同步流程，请确认令牌是否授权了 rov-skins 仓库。';
  if (status === 422) return '请求被拒绝，请确认同步流程仍然存在于 main 分支。';
  return `GitHub 接口返回错误（HTTP ${status}）。`;
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!response.ok) throw new Error(describeError(response.status));
  if (response.status === 204) return null;
  return (await response.json()) as T;
}

function toRun(raw: NonNullable<RunsResponse['workflow_runs']>[number]): WorkflowRun {
  return {
    id: raw.id,
    status: raw.status,
    conclusion: raw.conclusion,
    htmlUrl: raw.html_url,
    headSha: raw.head_sha,
    createdAt: raw.created_at,
  };
}

/** 触发一次同步。GitHub 成功时返回 204，没有响应体，因此拿不到 run id。 */
export async function dispatchSync(token: string, forceImages: boolean): Promise<void> {
  await request(`/actions/workflows/${syncWorkflow}/dispatches`, token, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs: { force_images: String(forceImages) } }),
  });
}

/** 派发后轮询找出刚创建的那次运行（早于派发时刻的历史运行会被排除）。 */
export async function findSyncRunAfter(token: string, since: number): Promise<WorkflowRun | null> {
  const data = await request<RunsResponse>(`/actions/workflows/${syncWorkflow}/runs?event=workflow_dispatch&per_page=10`, token);
  const candidates = (data?.workflow_runs ?? []).filter((run) => new Date(run.created_at).getTime() >= since);
  if (candidates.length === 0) return null;
  return toRun(candidates.reduce((latest, run) => (new Date(run.created_at) > new Date(latest.created_at) ? run : latest)));
}

export async function getRun(token: string, id: number): Promise<WorkflowRun | null> {
  const raw = await request<NonNullable<RunsResponse['workflow_runs']>[number]>(`/actions/runs/${id}`, token);
  return raw ? toRun(raw) : null;
}

/** 同步成功后由 workflow_run 触发部署，用 head_sha 找到对应的那次部署。 */
export async function findDeployRunForSha(token: string, headSha: string): Promise<WorkflowRun | null> {
  const data = await request<RunsResponse>(`/actions/workflows/${deployWorkflow}/runs?per_page=20`, token);
  const match = (data?.workflow_runs ?? []).find((run) => run.head_sha === headSha);
  return match ? toRun(match) : null;
}
