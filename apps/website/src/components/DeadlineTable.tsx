import type { DeadlineRow, MilestoneType, SortKey } from "../types.ts";
import {
  MILESTONE_LABELS,
  daysLabel,
  daysUntil,
  deadlineStatus,
  formatDate,
  formatDateRange,
} from "../utils.ts";
import styles from "./DeadlineTable.module.css";

interface Props {
  rows: DeadlineRow[];
  sort: SortKey;
  onSortChange: (key: SortKey) => void;
}

const SORTABLE_COLS: { key: SortKey; label: string; className: string }[] = [
  { key: "series", label: "学会", className: styles.colSeries },
  { key: "deadline", label: "締切", className: styles.colDate },
  { key: "conference", label: "開催日", className: styles.colConfDate },
];

function TypeBadge({ type }: { type: MilestoneType }) {
  return <span class={styles.typeBadge}>{MILESTONE_LABELS[type]}</span>;
}

function Row({ row }: { row: DeadlineRow }) {
  const days = daysUntil(row.milestone.at_utc);
  const status = deadlineStatus(days);

  return (
    <tr class={`${styles.row} ${styles[status] ?? ""}`}>
      <td class={styles.colSeries}>
        <a href={row.conference.url} target="_blank" rel="noopener">
          {row.seriesId} {row.conference.year}
          <span class="sr-only">（公式サイトを新しいタブで開く）</span>
        </a>
        {row.conference.name && (
          <div class={styles.seriesName} title={row.conference.name}>
            {row.conference.name}
          </div>
        )}
      </td>
      <td class={styles.colType}>
        <TypeBadge type={row.milestone.type} />
      </td>
      <td class={styles.colDate} data-label="締切">
        <div class={styles.dateDetails}>
          <time
            dateTime={row.milestone.at_utc}
            title={new Date(row.milestone.at_utc).toLocaleString("ja-JP")}
          >
            {formatDate(row.milestone.at_utc)}
          </time>
          {row.milestone.is_estimated && <span class={styles.estimated}>（予測）</span>}
          <span class={styles.daysRemaining}>{daysLabel(days)}</span>
        </div>
      </td>
      <td class={styles.colVenue} data-label="開催地" title={row.conference.venue ?? undefined}>
        <span>{row.conference.venue || "未定"}</span>
      </td>
      <td class={styles.colConfDate} data-label="開催日">
        <span>
          {row.conference.start_at_utc && row.conference.end_at_utc
            ? formatDateRange(row.conference.start_at_utc, row.conference.end_at_utc)
            : "未定"}
        </span>
      </td>
    </tr>
  );
}

export function DeadlineTable({ rows, sort, onSortChange }: Props) {
  if (rows.length === 0) {
    return (
      <p class={styles.empty} role="status">
        該当する締切はありません。
      </p>
    );
  }

  function sortHeader(key: SortKey) {
    const column = SORTABLE_COLS.find((col) => col.key === key)!;
    const selected = sort === key;

    return (
      <th class={column.className} scope="col" aria-sort={selected ? "ascending" : "none"}>
        <button
          type="button"
          class={`${styles.sortBtn} ${selected ? styles.sorted : ""}`}
          onClick={() => {
            onSortChange(key);
          }}
          aria-label={`${column.label}で並び替え`}
        >
          {column.label}
          <span class={styles.sortIcon} aria-hidden="true">
            {selected ? "↑" : ""}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div class={styles.wrap}>
      <table class={styles.table}>
        <caption class="sr-only">学会の締切・開催地・開催日の一覧</caption>
        <thead>
          <tr>
            {sortHeader("series")}
            <th class={styles.colType} scope="col">
              種別
            </th>
            {sortHeader("deadline")}
            <th class={styles.colVenue} scope="col">
              開催地
            </th>
            {sortHeader("conference")}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row
              key={`${row.conference.id}-${row.milestone.type}-${row.milestone.at_utc}`}
              row={row}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
