import YentrShell from '../../components/yentr-shell';
import ReadingPractice from '../../components/reading-practice';
import '../../styles/markdown.css';
import '../../styles/foundation.css';

export const metadata = { title: 'Reading Practice — Kotoba Lab' };
export default function ReadingPracticePage() {
  return (
    <YentrShell currentTab="reading">
      <ReadingPractice />
    </YentrShell>
  );
}
