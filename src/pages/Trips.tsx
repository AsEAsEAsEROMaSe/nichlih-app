import { Link, useNavigate } from 'react-router-dom';
import { RouteShape, RouteSketch } from '../components/HeroScene';
import { Icon } from '../components/Icon';
import { fmtDate, fmtDuration, plural } from '../lib/format';
import type { LatLon } from '../lib/types';
import { useStore, type SavedTrip } from '../store';
import { Empty } from './Plan';

export function Trips() {
  const trips = useStore((s) => s.trips);
  const { setParams, build, deleteTrip, bookTrip } = useStore();
  const navigate = useNavigate();

  async function open(t: SavedTrip) {
    setParams(t.params);
    navigate('/plan');
    await build({ routeIdx: t.routeIdx, choices: t.choices });
  }

  if (trips.length === 0) {
    return (
      <Empty title="Поїздок ще нема" text="Побудуйте маршрут, оберіть нічліг і збережіть план. Він з'явиться тут.">
        <Link className="btn primary" to="/">Спланувати першу <Icon name="arrow" /></Link>
      </Empty>
    );
  }

  const km = trips.reduce((s, t) => s + t.summary.distanceKm, 0);
  const nights = trips.reduce((s, t) => s + t.summary.nights, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Збережене</p>
          <h1>Мої поїздки</h1>
        </div>
        <ul className="head-stats">
          <li><b>{trips.length}</b>{plural(trips.length, ['поїздка', 'поїздки', 'поїздок'])}</li>
          <li><b>{km.toLocaleString('uk-UA')}</b>км у планах</li>
          <li><b>{nights}</b>{plural(nights, ['ніч', 'ночі', 'ночей'])}</li>
        </ul>
      </header>

      <div className="trip-grid">
        {trips.map((t, i) => (
          <article key={t.id} className="trip">
            <div className="trip-art">
              {t.line && t.line.length > 1 ? (
                <RouteShape line={t.line} stops={t.nights.filter((n) => n.lat !== undefined).map((n): LatLon => [n.lat!, n.lon!])} />
              ) : (
                <RouteSketch seed={i} />
              )}
              <span className={t.booked ? 'badge ok' : 'badge glass'}>{t.booked ? 'Заброньовано' : 'Чернетка'}</span>
            </div>
            <div className="trip-body">
              <h3>{t.params.from?.name.split(',')[0]} → {t.params.to?.name.split(',')[0]}</h3>
              <p className="muted">
                {fmtDate(t.params.date)} · {t.summary.distanceKm} км · {fmtDuration(t.summary.driveSec)} · {t.summary.nights} {plural(t.summary.nights, ['ніч', 'ночі', 'ночей'])}
              </p>
              {t.nights.length > 0 && (
                <ol className="nights">
                  {t.nights.map((n) => (
                    <li key={n.date}><Icon name="moon" size={14} /><span>{n.hotel}</span><b>{n.price} €</b></li>
                  ))}
                </ol>
              )}
              <div className="row">
                <button type="button" className="btn primary" onClick={() => open(t)}>Відкрити</button>
                {!t.booked && t.nights.length > 0 && (
                  <button type="button" className="btn ghost book-btn" onClick={() => bookTrip(t.id)}>Забронювати</button>
                )}
                <button type="button" className="icon-btn" aria-label="Видалити поїздку" onClick={() => confirm('Видалити цю поїздку?') && deleteTrip(t.id)}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="fine">Бронювання демонстраційне: справжні готелі запит не отримують.</p>
    </div>
  );
}
