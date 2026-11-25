import FrenchTaxiCourse from '../../components/french-taxi-course';
import YentrShell from '../../components/yentr-shell';
import '../../styles/markdown.css';
import '../../styles/foundation.css';

export const metadata = { title: 'Le Nouveau Taxi 1 · 24 bài — Kotoba Lab' };
export default function FrenchTaxiPage() {
  return (
    <YentrShell currentTab="french-taxi">
      <FrenchTaxiCourse embedded />
    </YentrShell>
  );
}
