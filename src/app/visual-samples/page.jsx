import YentrShell from '../../components/yentr-shell';
import VisualSamples from '../../components/visual-samples';
import '../../styles/markdown.css';
import '../../styles/visual-samples.css';

export const metadata = { title: 'Visual Samples — Kotoba Lab' };

export default function VisualSamplesPage() {
  return (
    <YentrShell currentTab="visual-samples" contextGroup="Visual DSL" contextLabel="Visual Samples">
      <VisualSamples />
    </YentrShell>
  );
}
