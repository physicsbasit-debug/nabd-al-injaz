import { suggestEvidence, type EvidenceContext } from './evidence-suggestions';
import './evidence-suggestions.css';
export default function EvidenceSuggestions({ context, title = '' }: { context: EvidenceContext; title?: string }) {
  return <aside className="evidence-suggestions" aria-label="شواهد مقترحة">
    <strong>شواهد مقترحة لهذا العمل</strong>
    <p>أمثلة اختيارية؛ أرفق ما يناسب العمل ويثبت تنفيذه.</p>
    <ul>{suggestEvidence(context, title).map(item => <li key={item}>{item}</li>)}</ul>
  </aside>;
}
