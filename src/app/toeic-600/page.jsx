import ToeicCourse from '../../components/toeic-course';
import YentrShell from '../../components/yentr-shell';
import '../../styles/markdown.css';
import '../../styles/foundation.css';

export const metadata = { title: '600 từ vựng TOEIC — Kotoba Lab' };
export default function ToeicPage() {
  return (
    <YentrShell currentTab="toeic">
      <ToeicCourse embedded />
    </YentrShell>
  );
}
