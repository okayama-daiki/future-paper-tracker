import type { DeadlineRow, MilestoneType } from "../types.ts";
import type { SortKey } from "../types.ts";
import {
  MILESTONE_ABBR,
  MILESTONE_LABELS,
  daysLabel,
  daysUntil,
  deadlineStatus,
  formatDate,
  formatDateRange,
  formatVenueCompact,
} from "../utils.ts";
import styles from "./DeadlineTable.module.css";

interface Props {
  rows: DeadlineRow[];
  sort: SortKey;
  onSortChange: (key: SortKey) => void;
}

interface ColHeader {
  key: SortKey;
  label: string;
}

const SORTABLE_COLS: ColHeader[] = [{ key: "series", label: "Series" }];

function TypeBadge({ type }: { type: MilestoneType }) {
  return (
    <span class={styles.typeBadge} title={MILESTONE_LABELS[type]}>
      {MILESTONE_ABBR[type]}
    </span>
  );
}

function Row({ row }: { row: DeadlineRow }) {
  const days = daysUntil(row.milestone.at_utc);
  const status = deadlineStatus(days);
  const cfp = row.conference.call_for_paper;
  const seriesHref = cfp?.source_url ?? row.conference.url;

  return (
    <tr class={`${styles.row} ${styles[status]}`}>
      <td class={styles.colSeries}>
        <a href={seriesHref} target="_blank" rel="noopener">
          {row.seriesId}
        </a>
        {row.conference.name && <div class={styles.seriesName}>{row.conference.name}</div>}
      </td>
      <td class={styles.colType}>
        <TypeBadge type={row.milestone.type} />
        {row.milestone.is_estimated && <span class={styles.estimated}> est.</span>}
      </td>
      <td class={styles.colDate}>
        <span>{formatDate(row.milestone.at_utc)}</span>
        <span class={`${styles.daysBadge} ${styles[status]}`}>{daysLabel(days)}</span>
      </td>
      <td class={styles.colVenue}>{formatVenueCompact(row.conference.venue)}</td>
      <td class={styles.colConfDate}>
        {row.conference.start_at_utc && row.conference.end_at_utc
          ? formatDateRange(row.conference.start_at_utc, row.conference.end_at_utc)
          : "TBA"}
      </td>
    </tr>
  );
}

export function DeadlineTable({ rows, sort, onSortChange }: Props) {
  if (rows.length === 0) {
    return <p class={styles.empty}>No deadlines found.</p>;
  }

  return (
    <div class={styles.wrap}>
      <table class={styles.table}>
        <thead>
          <tr>
            {SORTABLE_COLS.map(({ key, label }) => (
              <th
                key={key}
                class={sort === key ? styles.sorted : ""}
                onClick={() => {
                  onSortChange(key);
                }}
              >
                {label}
              </th>
            ))}
            <th>Type</th>
            <th
              class={sort === "deadline" ? styles.sorted : ""}
              onClick={() => {
                onSortChange("deadline");
              }}
            >
              Deadline
            </th>
            <th class={styles.colVenue}>Venue</th>
            <th
              class={`${styles.colConfDate}${sort === "conference" ? ` ${styles.sorted}` : ""}`}
              onClick={() => {
                onSortChange("conference");
              }}
            >
              Dates
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={`${row.seriesId}-${row.milestone.type}-${row.milestone.at_utc}`} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
