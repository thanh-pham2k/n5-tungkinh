import YentrShell from '../../components/yentr-shell';
import BasePrompt from '../../components/base-prompt';
import '../../styles/markdown.css';
import '../../styles/visual-samples.css';

export const metadata = { title: 'Base Prompt — Kotoba Lab' };

export default function BasePromptPage() {
  return (
    <YentrShell currentTab="base-prompt" contextGroup="Visual DSL" contextLabel="Base Prompt">
      <BasePrompt />
    </YentrShell>
  );
}
