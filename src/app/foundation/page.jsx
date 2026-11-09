import YentrShell from '../../components/yentr-shell';
import Foundation from '../../components/foundation';
import '../../styles/markdown.css';
import '../../styles/foundation.css';

export const metadata = { title: 'English Foundation — Kotoba Lab' };
export default function FoundationPage() {
  return (
    <YentrShell currentTab="foundation">
      <Foundation />
    </YentrShell>
  );
}
