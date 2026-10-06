import { useEffect, useRef, useState } from "preact/hooks";
import type { GenreFilter, GenreId, MilestoneFilter, MilestoneType, ViewFilter } from "../types.ts";
import { ALL_GENRES, GENRE_LABELS } from "../genres.ts";
import { MILESTONE_LABELS } from "../utils.ts";
import styles from "./Toolbar.module.css";

interface Props {
  timeFilter: ViewFilter;
  onTimeFilterChange: (f: ViewFilter) => void;
  milestoneFilter: MilestoneFilter;
  onMilestoneFilterChange: (f: MilestoneFilter) => void;
  genreOptions: readonly GenreId[];
  genreFilter: GenreFilter;
  onGenreFilterChange: (f: GenreFilter) => void;
}

const TIME_FILTERS: { value: ViewFilter; label: string }[] = [
  { value: "upcoming", label: "今後の締切" },
  { value: "all", label: "すべて" },
  { value: "past", label: "過去の締切" },
];

const ALL_TYPES = Object.keys(MILESTONE_LABELS) as MilestoneType[];

export function Toolbar({
  timeFilter,
  onTimeFilterChange,
  milestoneFilter,
  onMilestoneFilterChange,
  genreOptions,
  genreFilter,
  onGenreFilterChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

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

  function toggleGenre(genre: GenreId) {
    const next = new Set(genreFilter);
    if (next.has(genre)) {
      next.delete(genre);
    } else {
      next.add(genre);
    }
    onGenreFilterChange(next);
  }

  return (
    <div class={styles.toolbar}>
      <div>
        <div class={styles.filters} role="group" aria-label="締切の期間">
          {TIME_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              class={`${styles.filterBtn} ${timeFilter === value ? styles.active : ""}`}
              aria-pressed={timeFilter === value}
              onClick={() => {
                onTimeFilterChange(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div
          class={styles.dropdown}
          ref={dropdownRef}
          onKeyDown={(e) => {
            if (open && e.key === "Escape") {
              setOpen(false);
              dropdownButtonRef.current?.focus();
            }
          }}
        >
          <button
            ref={dropdownButtonRef}
            type="button"
            class={styles.dropdownBtn}
            aria-expanded={open}
            aria-controls="filter-options"
            onClick={() => {
              setOpen(!open);
            }}
          >
            フィルタ
            <svg
              class={`${styles.caret} ${open ? styles.caretOpen : ""}`}
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
          {open && (
            <div class={styles.dropdownMenu} id="filter-options">
              <fieldset class={styles.menuSection}>
                <legend class={styles.menuHeading}>ジャンル</legend>
                <div class={styles.menuActions}>
                  <button
                    type="button"
                    class={styles.menuLink}
                    onClick={() => {
                      onGenreFilterChange(new Set(ALL_GENRES));
                    }}
                  >
                    すべて選択
                  </button>
                  <button
                    type="button"
                    class={styles.menuLink}
                    onClick={() => {
                      onGenreFilterChange(new Set());
                    }}
                  >
                    すべて解除
                  </button>
                </div>
                {genreOptions.map((genre) => (
                  <label key={genre} class={styles.menuItem}>
                    <input
                      type="checkbox"
                      checked={genreFilter.has(genre)}
                      onChange={() => {
                        toggleGenre(genre);
                      }}
                    />
                    {GENRE_LABELS[genre]}
                  </label>
                ))}
              </fieldset>
              <div class={styles.menuDivider} />
              <fieldset class={styles.menuSection}>
                <legend class={styles.menuHeading}>種別</legend>
                <div class={styles.menuActions}>
                  <button type="button" class={styles.menuLink} onClick={selectAll}>
                    すべて選択
                  </button>
                  <button
                    type="button"
                    class={styles.menuLink}
                    onClick={() => {
                      onMilestoneFilterChange(new Set());
                    }}
                  >
                    すべて解除
                  </button>
                </div>
                {ALL_TYPES.map((type) => (
                  <label key={type} class={styles.menuItem}>
                    <input
                      type="checkbox"
                      checked={milestoneFilter.has(type)}
                      onChange={() => {
                        toggleType(type);
                      }}
                    />
                    {MILESTONE_LABELS[type]}
                  </label>
                ))}
              </fieldset>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
