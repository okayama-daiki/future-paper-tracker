import styles from "./Header.module.css";

export function Header() {
  return (
    <header class={styles.header}>
      <h1 class={styles.title}>Future Paper Tracker</h1>
      <p class={styles.subtitle}>Conference deadlines at a glance</p>
    </header>
  );
}
