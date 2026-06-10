import {
  AlertTriangle,
  Copy,
  Home,
  ListChecks,
  MapPinned,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSeedIssueList,
  getSeedIssueSummary,
  type SeedIssueList,
  type SeedIssueListItem,
  type SeedIssueSummary,
} from "../api/gameApi";
import { copyTextToClipboard } from "../common/clipboard";

const ADMIN_TOKEN_STORAGE_KEY = "kr-geo-guess:seed-issue-admin-token:v1";

type LoadState = "idle" | "loading" | "ready" | "error";

export function SeedIssueAdminScreen({
  apiConfigured,
  onExit,
}: {
  apiConfigured: boolean;
  onExit: () => void;
}) {
  const [tokenInput, setTokenInput] = useState(() => loadAdminToken());
  const [summary, setSummary] = useState<SeedIssueSummary | null>(null);
  const [issueList, setIssueList] = useState<SeedIssueList | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<LoadState>("idle");
  const [issueStatus, setIssueStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyStatusTimeoutRef = useRef<number | null>(null);
  const excludedSeedCandidates = useMemo(
    () => getUniqueSeedIds(issueList?.issues ?? []),
    [issueList?.issues],
  );
  const sourceCounts = useMemo(
    () => countIssuesBySource(issueList?.issues ?? []),
    [issueList?.issues],
  );

  useEffect(() => {
    if (!apiConfigured) {
      return;
    }

    void refreshSummary();
  }, [apiConfigured]);

  useEffect(() => {
    return () => {
      if (copyStatusTimeoutRef.current !== null) {
        window.clearTimeout(copyStatusTimeoutRef.current);
      }
    };
  }, []);

  async function refreshSummary() {
    setSummaryStatus("loading");
    setError(null);

    try {
      setSummary(await getSeedIssueSummary());
      setSummaryStatus("ready");
    } catch (summaryError) {
      setSummaryStatus("error");
      setError(getAdminSummaryErrorMessage(summaryError));
    }
  }

  async function loadIssues() {
    const token = tokenInput.trim();
    if (!token) {
      setIssueStatus("error");
      setIssueList(null);
      setError("운영자 토큰이 필요합니다.");
      return;
    }

    setIssueStatus("loading");
    setIssueList(null);
    setError(null);

    try {
      const [nextSummary, nextIssueList] = await Promise.all([
        getSeedIssueSummary(),
        getSeedIssueList(token),
      ]);
      saveAdminToken(token);
      setSummary(nextSummary);
      setIssueList(nextIssueList);
      setSummaryStatus("ready");
      setIssueStatus("ready");
    } catch (issueError) {
      setIssueStatus("error");
      setIssueList(null);
      setError(getAdminIssueErrorMessage(issueError));
    }
  }

  async function copyExcludedSeeds() {
    const copied = await copyTextToClipboard(excludedSeedCandidates.join("\n"));
    setCopyStatus(copied ? "copied" : "failed");
    if (copyStatusTimeoutRef.current !== null) {
      window.clearTimeout(copyStatusTimeoutRef.current);
    }
    copyStatusTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyStatusTimeoutRef.current = null;
    }, 1400);
  }

  if (!apiConfigured) {
    return (
      <main className="admin-shell">
        <AdminHeader onExit={onExit} />
        <section className="admin-empty-state">
          <ShieldCheck size={28} aria-hidden="true" />
          <h2>운영 API 연결 필요</h2>
          <p>seed issue 운영 화면은 배포 API가 연결된 환경에서 열립니다.</p>
          <button className="secondary-button" onClick={onExit} type="button">
            <Home size={16} aria-hidden="true" />
            홈으로
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <AdminHeader onExit={onExit} />

      <section className="admin-grid">
        <div className="admin-primary">
          <section className="admin-panel" aria-label="seed issue 품질 현황">
            <div className="admin-panel-heading">
              <div>
                <span>품질 현황</span>
                <h2>Seed 신고 운영</h2>
              </div>
              <button
                className="admin-icon-button"
                disabled={summaryStatus === "loading"}
                onClick={refreshSummary}
                type="button"
                aria-label="집계 새로고침"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="admin-metric-grid">
              <AdminMetric
                label="전체 신고"
                value={summary ? summary.total.toLocaleString("ko-KR") : "-"}
              />
              <AdminMetric
                label="로드뷰 없음"
                value={getReasonCount(summary, "no_pano").toLocaleString("ko-KR")}
              />
              <AdminMetric
                label="지역 불일치"
                value={getReasonCount(summary, "region_mismatch").toLocaleString("ko-KR")}
              />
              <AdminMetric
                label="목록 출처"
                value={`${sourceCounts.solo} / ${sourceCounts.room}`}
                caption="싱글 / 친구방"
              />
            </div>
          </section>

          <section className="admin-panel" aria-label="seed issue 목록">
            <div className="admin-panel-heading">
              <div>
                <span>최근 100개</span>
                <h2>신고 목록</h2>
              </div>
              <ListChecks size={18} aria-hidden="true" />
            </div>

            <form
              className="admin-token-form"
              aria-label="운영자 토큰"
              onSubmit={(event) => {
                event.preventDefault();
                void loadIssues();
              }}
            >
              <input
                aria-label="운영자 토큰 입력"
                autoComplete="off"
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
              />
              <button
                className="secondary-button"
                disabled={issueStatus === "loading"}
                type="submit"
              >
                <ShieldCheck size={16} aria-hidden="true" />
                불러오기
              </button>
            </form>

            {error ? <p className="admin-error">{error}</p> : null}

            <div className="admin-issue-list">
              {(issueList?.issues ?? []).map((issue) => (
                <IssueRow issue={issue} key={`${issue.seedId}:${issue.reportedAt}`} />
              ))}
              {issueStatus === "ready" && issueList?.issues.length === 0 ? (
                <p className="admin-empty-list">신고 목록 없음</p>
              ) : null}
              {issueStatus !== "ready" ? (
                <p className="admin-empty-list">
                  {issueStatus === "loading" ? "불러오는 중" : "토큰 입력 후 목록 표시"}
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="admin-secondary">
          <section className="admin-panel" aria-label="지역별 seed 품질 현황">
            <div className="admin-panel-heading">
              <div>
                <span>지역별</span>
                <h2>품질 현황</h2>
              </div>
              <MapPinned size={18} aria-hidden="true" />
            </div>
            <div className="admin-map-list">
              {(summary?.byMap ?? []).slice(0, 8).map((mapIssue) => (
                <div className="admin-map-row" key={mapIssue.mapId}>
                  <span>{mapIssue.mapName}</span>
                  <strong>{mapIssue.count.toLocaleString("ko-KR")}</strong>
                  <em>{formatReasonBreakdown(mapIssue.byReason)}</em>
                </div>
              ))}
              {summaryStatus === "ready" && (summary?.byMap.length ?? 0) === 0 ? (
                <p className="admin-empty-list">지역별 신고 없음</p>
              ) : null}
            </div>
          </section>

          <section className="admin-panel" aria-label="문제 seed 제외 후보">
            <div className="admin-panel-heading">
              <div>
                <span>제외 후보</span>
                <h2>Seed ID</h2>
              </div>
              <button
                className="admin-icon-button"
                disabled={excludedSeedCandidates.length === 0}
                onClick={copyExcludedSeeds}
                type="button"
                aria-label="제외 후보 복사"
              >
                <Copy size={16} />
              </button>
            </div>
            <textarea
              readOnly
              value={excludedSeedCandidates.join("\n")}
              aria-label="제외 후보 seed id"
            />
            <div className="admin-copy-status" aria-live="polite">
              {copyStatus === "copied"
                ? "복사됨"
                : copyStatus === "failed"
                  ? "직접 복사"
                  : `${excludedSeedCandidates.length}개 후보`}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function AdminHeader({ onExit }: { onExit: () => void }) {
  return (
    <header className="admin-header">
      <div className="brand-block">
        <h1>어디길</h1>
      </div>
      <div className="admin-header-actions">
        <span>
          <AlertTriangle size={16} aria-hidden="true" />
          Seed 운영
        </span>
        <button className="icon-action" onClick={onExit} type="button" aria-label="홈으로">
          <Home size={16} />
        </button>
      </div>
    </header>
  );
}

function AdminMetric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="admin-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {caption ? <em>{caption}</em> : null}
    </div>
  );
}

function IssueRow({ issue }: { issue: SeedIssueListItem }) {
  return (
    <article className="admin-issue-row">
      <div>
        <strong>{issue.seedId}</strong>
        <span>{issue.region1} {issue.region2}</span>
      </div>
      <div>
        <b>{formatIssueReason(issue.reason)}</b>
        <em>{issue.mapName} · R{issue.roundNumber} · {issue.difficulty}</em>
      </div>
      <time dateTime={issue.reportedAt}>
        {formatReportedAt(issue.reportedAt)}
      </time>
    </article>
  );
}

function loadAdminToken() {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveAdminToken(token: string) {
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // Admin token is optional session convenience only.
  }
}

function getAdminIssueErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("token") || message.includes("403")) {
    return "운영자 토큰을 확인해 주세요.";
  }

  if (message.includes("not configured") || message.includes("404")) {
    return "운영 목록 API가 아직 설정되지 않았습니다.";
  }

  return message || "seed issue 목록을 불러오지 못했습니다.";
}

function getAdminSummaryErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("404")) {
    return "seed issue 집계 API가 아직 설정되지 않았습니다.";
  }

  return "seed issue 집계를 불러오지 못했습니다.";
}

function getReasonCount(
  summary: SeedIssueSummary | null,
  reason: SeedIssueListItem["reason"],
) {
  return summary?.byReason.find((item) => item.reason === reason)?.count ?? 0;
}

function getUniqueSeedIds(issues: readonly SeedIssueListItem[]) {
  return [...new Set(issues.map((issue) => issue.seedId))].sort();
}

function countIssuesBySource(issues: readonly SeedIssueListItem[]) {
  return issues.reduce(
    (counts, issue) => ({
      ...counts,
      [issue.source]: counts[issue.source] + 1,
    }),
    { solo: 0, room: 0 },
  );
}

function formatReasonBreakdown(
  reasons: SeedIssueSummary["byMap"][number]["byReason"],
) {
  return reasons
    .map((item) => `${formatIssueReason(item.reason)} ${item.count}`)
    .join(" · ");
}

function formatIssueReason(reason: SeedIssueListItem["reason"]) {
  return reason === "no_pano" ? "로드뷰 없음" : "지역 불일치";
}

function formatReportedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
