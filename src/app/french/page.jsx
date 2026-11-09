import FrenchCourse from '../../components/french-course';
import YentrShell from '../../components/yentr-shell';
import '../../styles/markdown.css';
import '../../styles/foundation.css';

export const metadata = { title: 'Tiếng Pháp A1–A2 — Kotoba Lab' };
export default function FrenchPage() {
  return (
    <YentrShell currentTab="french">
      <FrenchCourse embedded />
    </YentrShell>
  );
}
