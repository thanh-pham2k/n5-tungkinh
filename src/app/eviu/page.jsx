import YentrShell from '../../components/yentr-shell';
import Foundation from '../../components/foundation';
import '../../styles/markdown.css';
import '../../styles/foundation.css';

export const metadata = { title: 'EVIU — Kotoba Lab' };
export default function EviuPage() {
  return (
    <YentrShell currentTab="eviu">
      <Foundation eviu />
    </YentrShell>
  );
}
