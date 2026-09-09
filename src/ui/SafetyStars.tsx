interface Props {
  level: number;
  size?: 'sm' | 'md';
}

/** ★の目安（仕様 #15）。固定確率ではなく「否定できる待ちの多さ」の表現。 */
export default function SafetyStars({ level, size = 'md' }: Props) {
  const full = Math.max(0, Math.min(5, Math.round(level)));
  return (
    <span className={`stars stars-${size}`} aria-label={`安全度 ${full} / 5`}>
      {'★'.repeat(full)}
      <span className="stars-empty">{'☆'.repeat(5 - full)}</span>
    </span>
  );
}
