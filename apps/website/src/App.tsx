import { useEffect, useMemo, useState } from "preact/hooks";
import { Header } from "./components/Header.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { DeadlineTable } from "./components/DeadlineTable.tsx";
import type {
  ConferencesData,
  DeadlineRow,
  MilestoneFilter,
  SortKey,
  ViewFilter,
} from "./types.ts";
import { DEFAULT_MILESTONE_FILTER, buildRows, formatDate } from "./utils.ts";
import styles from "./App.module.css";

function filterByTime(rows: DeadlineRow[], filter: ViewFilter): DeadlineRow[] {
  const now = new Date();
  if (filter === "upcoming") return rows.filter((r) => new Date(r.milestone.at_utc) >= now);
  if (filter === "past") return rows.filter((r) => new Date(r.milestone.at_utc) < now);
  return rows;
}

function filterByMilestone(rows: DeadlineRow[], mf: MilestoneFilter): DeadlineRow[] {
  return rows.filter((r) => mf.has(r.milestone.type));
}

function sortRows(rows: DeadlineRow[], sort: SortKey): DeadlineRow[] {
  return [...rows].sort((a, b) => {
    switch (sort) {
      case "deadline":
        return new Date(a.milestone.at_utc).getTime() - new Date(b.milestone.at_utc).getTime();
      case "series":
        return a.seriesId.localeCompare(b.seriesId);
      case "conference": {
        const aTime = a.conference.start_at_utc
          ? new Date(a.conference.start_at_utc).getTime()
          : Infinity;
        const bTime = b.conference.start_at_utc
          ? new Date(b.conference.start_at_utc).getTime()
          : Infinity;
        return aTime - bTime;
      }
    }
  });
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: DeadlineRow[]; generatedAt: string };

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [timeFilter, setTimeFilter] = useState<ViewFilter>("upcoming");
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneFilter>(DEFAULT_MILESTONE_FILTER);
  const [sort, setSort] = useState<SortKey>("deadline");

  useEffect(() => {
    fetch("/conferences.json")
      .then((r) => r.json() as Promise<ConferencesData>)
      .then((data) => {
        setLoadState({ status: "ready", rows: buildRows(data), generatedAt: data.generated_at });
      })
      .catch(() => {
        setLoadState({ status: "error" });
      });
  }, []);

  const visibleRows = useMemo(() => {
    if (loadState.status !== "ready") return [];
    const byTime = filterByTime(loadState.rows, timeFilter);
    const byMilestone = filterByMilestone(byTime, milestoneFilter);
    return sortRows(byMilestone, sort);
  }, [loadState, timeFilter, milestoneFilter, sort]);

  return (
    <div class={styles.app}>
      <Header />
      <main class={styles.main}>
        {loadState.status === "loading" && <p class={styles.message}>Loading…</p>}
        {loadState.status === "error" && (
          <p class={styles.message}>Failed to load conference data.</p>
        )}
        {loadState.status === "ready" && (
          <>
            <Toolbar
              timeFilter={timeFilter}
              onTimeFilterChange={setTimeFilter}
              milestoneFilter={milestoneFilter}
              onMilestoneFilterChange={setMilestoneFilter}
            />
            <DeadlineTable rows={visibleRows} sort={sort} onSortChange={setSort} />
          </>
        )}
      </main>
      <footer class={styles.footer}>
        <p>
          {loadState.status === "ready"
            ? `Data updated: ${formatDate(loadState.generatedAt)}`
            : "\u00a0"}
        </p>
      </footer>
    </div>
  );
}
