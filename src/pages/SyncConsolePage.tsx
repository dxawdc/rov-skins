import { useEffect, useRef, useState } from 'react';
import { dispatchSync, findDeployRunForSha, findSyncRunAfter, getRun, type WorkflowRun } from '../data/github';

const tokenStorageKey = 'rov-sync-token';
const pollIntervalMs = 10000;
const maxPollMs = 30 * 60 * 1000;

type Stage = 'idle' | 'dispatching' | 'queued' | 'syncing' | 'deploying' | 'done' | 'failed';

const stageLabels: Record<Exclude<Stage, 'idle'>, string> = {
  dispatching: '正在提交任务',
  queued: '排队中',
  syncing: '同步飞书数据中',
  deploying: '部署到网站中',
  done: '已完成',
  failed: '未成功',
};

const stageOrder: Array<Exclude<Stage, 'idle' | 'failed'>> = ['dispatching', 'queued', 'syncing', 'deploying', 'done'];

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

export function SyncConsolePage() {
  const [token, setToken] = useState('');
  const [savedToken, setSavedToken] = useState('');
  const [forceImages, setForceImages] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState('');
  const [runUrl, setRunUrl] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(tokenStorageKey) ?? '';
    setSavedToken(stored);
    setToken(stored);
  }, []);

  useEffect(() => {
    if (startedAt === null || stage === 'done' || stage === 'failed') return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [stage, startedAt]);

  // 组件卸载时停止仍在进行的轮询，避免离开页面后继续请求
  useEffect(() => () => { cancelled.current = true; }, []);

  function saveToken() {
    const next = token.trim();
    localStorage.setItem(tokenStorageKey, next);
    setSavedToken(next);
    setMessage('令牌已保存到本机浏览器。');
  }

  function clearToken() {
    localStorage.removeItem(tokenStorageKey);
    setSavedToken('');
    setToken('');
    setMessage('令牌已从本机清除。');
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function runSync() {
    cancelled.current = false;
    const begin = Date.now();
    setStartedAt(begin);
    setElapsed(0);
    setRunUrl('');
    setStage('dispatching');
    setMessage(forceImages ? '已请求强制校验全部图片，整个过程约 15 分钟。' : '已请求增量同步，通常 1 分钟内完成。');

    try {
      await dispatchSync(savedToken, forceImages);

      let run: WorkflowRun | null = null;
      for (let attempt = 0; attempt < 12 && !run; attempt += 1) {
        await sleep(3000);
        if (cancelled.current) return;
        run = await findSyncRunAfter(savedToken, begin - 60000);
      }
      if (!run) {
        setStage('failed');
        setMessage('任务已提交，但没能读取到运行记录，请稍后在 GitHub 上确认。');
        return;
      }
      setRunUrl(run.htmlUrl);

      const deadline = Date.now() + maxPollMs;
      while (Date.now() < deadline) {
        if (cancelled.current) return;
        const current = await getRun(savedToken, run.id);
        if (!current) break;
        setRunUrl(current.htmlUrl);

        if (current.status === 'completed') {
          if (current.conclusion !== 'success') {
            setStage('failed');
            setMessage('同步未成功，可点击下方链接查看日志。');
            return;
          }
          setStage('deploying');
          setMessage('数据同步完成，正在部署到网站。');

          const deployDeadline = Date.now() + 10 * 60 * 1000;
          while (Date.now() < deployDeadline) {
            if (cancelled.current) return;
            await sleep(pollIntervalMs);
            const deploy = await findDeployRunForSha(savedToken, current.headSha);
            if (!deploy) continue;
            if (deploy.status === 'completed') {
              setStage(deploy.conclusion === 'success' ? 'done' : 'failed');
              setMessage(deploy.conclusion === 'success'
                ? '全部完成，网站已更新。如仍看到旧内容，请强制刷新页面（Ctrl+F5）。'
                : '数据已同步，但部署未成功，请联系维护同学。');
              setRunUrl(deploy.htmlUrl);
              return;
            }
          }
          setStage('done');
          setMessage('数据已同步完成；部署仍在进行，稍后刷新网站即可看到更新。');
          return;
        }

        setStage(current.status === 'queued' ? 'queued' : 'syncing');
        await sleep(pollIntervalMs);
      }

      setStage('failed');
      setMessage('等待超时，任务可能仍在运行，请点击下方链接查看。');
    } catch (error) {
      setStage('failed');
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const busy = stage !== 'idle' && stage !== 'done' && stage !== 'failed';
  const currentStageIndex = stageOrder.indexOf(stage as Exclude<Stage, 'idle' | 'failed'>);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-950">🔄 数据同步</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          飞书表格更新后，点击下面的按钮即可把最新数据同步到本网站，无需打开 GitHub。
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">访问令牌</h3>
        <p className="mt-1 text-sm text-slate-500">
          首次使用请粘贴管理员单独发给你的令牌。令牌只保存在你自己的浏览器里，不会上传，也不会分享给其他人。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="h-10 min-w-[280px] flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            onChange={(event) => setToken(event.target.value)}
            placeholder="粘贴令牌"
            type="password"
            value={token}
          />
          <button className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40" disabled={!token.trim() || token.trim() === savedToken} onClick={saveToken} type="button">
            保存
          </button>
          <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled={!savedToken} onClick={clearToken} type="button">
            清除令牌
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-400">{savedToken ? '已保存令牌，可直接开始同步。' : '尚未保存令牌，无法开始同步。'}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-950">开始同步</h3>
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input checked={forceImages} className="mt-1" disabled={busy} onChange={(event) => setForceImages(event.target.checked)} type="checkbox" />
          <span>
            强制重新校验全部图片
            <span className="mt-0.5 block text-xs text-slate-400">
              仅在飞书里换过图、但网站上还是旧图时勾选。会重新下载全部海报，约需 15 分钟；平时不用勾。
            </span>
          </span>
        </label>
        <button
          className="mt-4 h-10 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          disabled={!savedToken || busy}
          onClick={() => setShowConfirm(true)}
          type="button"
        >
          {busy ? '同步进行中…' : '开始同步'}
        </button>
      </section>

      {stage !== 'idle' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">运行状态</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {stageOrder.map((item, index) => {
              const reached = stage === 'failed' ? index < Math.max(currentStageIndex, 0) : index <= currentStageIndex;
              return (
                <span className={`rounded-full border px-3 py-1 text-sm ${reached ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-400'}`} key={item}>
                  {stageLabels[item]}
                </span>
              );
            })}
          </div>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <div>
              当前状态：
              <strong className={stage === 'failed' ? 'text-red-600' : 'text-slate-900'}>
                {stageLabels[stage as Exclude<Stage, 'idle'>]}
              </strong>
            </div>
            {startedAt !== null && <div>已用时：{formatElapsed(elapsed)}</div>}
            {message && <div className="text-slate-500">{message}</div>}
            {runUrl && (
              <a className="inline-block text-blue-600 hover:underline" href={runUrl} rel="noopener noreferrer" target="_blank">
                在 GitHub 查看运行详情
              </a>
            )}
          </div>
        </section>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={() => setShowConfirm(false)} role="presentation">
          <section aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
            <h2 className="text-lg font-bold text-slate-950">确认开始同步？</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              将从飞书拉取最新数据并更新本网站{forceImages ? '，并重新校验全部图片（约 15 分钟）' : '（通常 1 分钟内完成）'}。同一时间只需要一个人操作。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setShowConfirm(false)} type="button">取消</button>
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => { setShowConfirm(false); void runSync(); }} type="button">确认同步</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
