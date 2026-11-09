import YentrShell from '../../components/yentr-shell';
import EnglishSkills from '../../components/english-skills';
import '../../styles/english-skills.css';

export const metadata = { title: 'English Skills — Kotoba Lab' };
export default function EnglishSkillsPage() {
  return (
    <YentrShell currentTab="skills">
      <EnglishSkills />
    </YentrShell>
  );
}
