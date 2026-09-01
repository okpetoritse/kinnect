import { getPublicUserCount } from "../public-stats/actions";
import styles from "./page.module.css";

function nextMilestone(count: number) {
  const milestones = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000];
  return milestones.find((m) => m > count) || count + 1000;
}

export const revalidate = 0;

export default async function CounterPage() {
  const count = await getPublicUserCount();

  return (
    <main className={styles.wrapper}>
      <div className={styles.label}>People Connected</div>
      <div className={styles.count}>{count}</div>
      <div className={styles.milestone}>Next milestone: {nextMilestone(count)}</div>
    </main>
  );
}