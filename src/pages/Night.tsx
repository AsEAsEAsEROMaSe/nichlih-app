import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { HotelCard } from '../components/HotelCard';
import { Icon } from '../components/Icon';
import { RouteMap } from '../components/RouteMap';
import { fmtDate, fmtDuration, plural } from '../lib/format';
import { sortCandidates, type SortMode } from '../lib/planner';
import { useStore } from '../store';
import { usePlan } from '../usePlan';

const PAGE = 12;
const SORTS: { mode: SortMode; label: string }[] = [
  { mode: 'best', label: 'Рекомендовані' },
  { mode: 'price', label: 'Дешевші' },
  { mode: 'near', label: 'Ближче до траси' },
];

export function Night() {
  const { day } = useParams();
  const plan = usePlan();
  const choose = useStore((s) => s.choose);
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState<SortMode>('best');
  const [hot, setHot] = useState<string>();
  const d = plan?.days[Number(day)];
  const list = useMemo(() => (d ? sortCandidates(d.candidates, sort) : []), [d, sort]);
  if (!plan || !d || d.last) return <Navigate to="/plan" replace />;
  const bestId = d.candidates[0]?.id;
  const n = d.candidates.length;

  return (
    <div className="split">
      <div className="mapwrap"><RouteMap route={plan.route} days={[d]} focus={d} hotId={hot} onPick={(c) => choose(d.index, c.id)} /></div>
      <div className="pane">
        <header className="pane-head">
          <Link className="back" to="/plan"><Icon name="back" size={18} /> До плану</Link>
          <p className="eyebrow">Ніч {d.index + 1} · {fmtDate(d.date)}</p>
          <h1 className="title">Де заночувати</h1>
          <p className="lead small">
            {n} {plural(n, ['варіант', 'варіанти', 'варіантів'])} на ділянці, куди ви доїдете за {fmtDuration(d.window!.from - d.startT)} … {fmtDuration(d.window!.to - d.startT)} від початку дня.
          </p>
          <div className="sorts" role="group" aria-label="Порядок списку">
            {SORTS.map((x) => (
              <button key={x.mode} type="button" className={sort === x.mode ? 'on' : ''} aria-pressed={sort === x.mode} onClick={() => setSort(x.mode)}>
                {x.label}
              </button>
            ))}
          </div>
        </header>

        <div className="pane-body">
          <div className="hlist">
            {list.slice(0, shown).map((c) => (
              <HotelCard key={c.id} c={c} day={d} best={c.id === bestId} on={c.id === d.chosen?.id} onPick={() => choose(d.index, c.id)} onHover={setHot} />
            ))}
          </div>
          {n > shown && (
            <button type="button" className="btn ghost" onClick={() => setShown(shown + PAGE)}>Показати ще ({n - shown})</button>
          )}
          <div className="actions sticky">
            <Link className="btn primary big" to="/plan">Готово, до плану <Icon name="arrow" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
