import { useEffect, useRef, useState } from "preact/hooks";
import type { MilestoneFilter, MilestoneType, ViewFilter } from "../types.ts";
import { DEFAULT_MILESTONE_FILTER, MILESTONE_ABBR, MILESTONE_LABELS } from "../utils.ts";
import styles from "./Toolbar.module.css";

interface Props {
  timeFilter: ViewFilter;
  onTimeFilterChange: (f: ViewFilter) => void;
  milestoneFilter: MilestoneFilter;
  onMilestoneFilterChange: (f: MilestoneFilter) => void;
}

const TIME_FILTERS: { value: ViewFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
  { value: "past", label: "Past" },
];

const ALL_TYPES = Object.keys(MILESTONE_ABBR) as MilestoneType[];

function filterLabel(mf: MilestoneFilter): string {
  if (mf.size === 0) return "Type: None";
  if (mf.size === ALL_TYPES.length) return "Type: All";
  if (mf.size <= 2) {
    return [...mf].map((t) => MILESTONE_LABELS[t]).join(", ");
  }
  return `Type: ${mf.size} selected`;
}

export function Toolbar({
  timeFilter,
  onTimeFilterChange,
  milestoneFilter,
  onMilestoneFilterChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [open]);

  function toggleType(type: MilestoneType) {
    const next = new Set(milestoneFilter);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onMilestoneFilterChange(next);
  }

  function selectAll() {
    onMilestoneFilterChange(new Set(ALL_TYPES));
  }

  function selectDefault() {
    onMilestoneFilterChange(DEFAULT_MILESTONE_FILTER);
  }

  return (
    <div class={styles.toolbar}>
      <div class={styles.filters}>
        {TIME_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            class={`${styles.filterBtn} ${timeFilter === value ? styles.active : ""}`}
            onClick={() => {
              onTimeFilterChange(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div class={styles.dropdown} ref={dropdownRef}>
        <button
          class={styles.dropdownBtn}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {filterLabel(milestoneFilter)}
          <span class={styles.caret}>{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div class={styles.dropdownMenu}>
            <div class={styles.menuActions}>
              <button class={styles.menuLink} onClick={selectAll}>
                All
              </button>
              <button class={styles.menuLink} onClick={selectDefault}>
                Default
              </button>
            </div>
            <div class={styles.menuDivider} />
            {ALL_TYPES.map((type) => (
              <label key={type} class={styles.menuItem}>
                <input
                  type="checkbox"
                  checked={milestoneFilter.has(type)}
                  onChange={() => {
                    toggleType(type);
                  }}
                />
                <span class={styles.typeBadge}>{MILESTONE_ABBR[type]}</span>
                {MILESTONE_LABELS[type]}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
