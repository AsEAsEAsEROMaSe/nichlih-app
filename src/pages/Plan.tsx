import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Aerial } from '../components/Aerial';
import { Loader } from '../components/HeroScene';
import { Icon } from '../components/Icon';
import { RouteMap, dayColor } from '../components/RouteMap';
import { fmtDate, fmtDuration, fmtKm, plural } from '../lib/format';
import { thin } from '../lib/geo';
import { useStore } from '../store';
import { usePlan } from '../usePlan';

export function Plan() {
  const plan = usePlan();
  const s = useStore();
  const [saved, setSaved] = useState(false);
  const choiceKey = JSON.stringify(s.choices) + s.routeIdx;
  useEffect(() => setSaved(false), [choiceKey]);

  if (s.status === 'routing') return <Loader text="Прокладаємо маршрут трасами…" />;
  if (!plan) {
    return (
      <Empty title="Маршруту ще нема" text={s.error ?? 'Вкажіть, звідки й куди їдете, і ми поділимо дорогу на дні.'}>
        <Link className="btn primary" to="/">Новий маршрут <Icon name="arrow" /></Link>
      </Empty>
    );
  }

  const { route, days, summary } = plan;
  const loading = s.status === 'hotels';
  const routes = s.profile.premium ? s.routes : s.routes.slice(0, 1);
  const from = s.params.from?.name.split(',')[0];
  const to = s.params.to?.name.split(',')[0];

  function save() {
    const nights = days.filter((d) => d.chosen);
    s.saveTrip({
      params: s.params,
      routeIdx: s.routeIdx,
      choices: Object.fromEntries(nights.map((d) => [d.index, d.chosen!.id])),
      summary,
      nights: nights.map((d) => ({ date: d.date, hotel: d.chosen!.name, price: d.chosen!.price, lat: d.chosen!.lat, lon: d.chosen!.lon })),
      line: thin(route.coords, 70).map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)]),
    });
    setSaved(true);
  }

  return (
    <div className="split">
      <div className="mapwrap"><RouteMap route={route} days={days} /></div>
      <div className="pane">
        <header className="pane-head">
          <p className="eyebrow">Ваш план</p>
          <h1 className="title">{from} <Icon name="arrow" /> {to}</h1>
          <ul className="stats">
            <li><Icon name="calendar" /><b>{summary.days}</b><span>{plural(summary.days, ['день', 'дні', 'днів'])}</span></li>
            <li><Icon name="route" /><b>{summary.distanceKm}</b><span>км</span></li>
            <li><Icon name="clock" /><b>{fmtDuration(summary.driveSec)}</b><span>за кермом</span></li>
            <li><Icon name="euro" /><b>{summary.cost} €</b><span>за ночівлі</span></li>
          </ul>
        </header>

        <div className="pane-body">
          <div className="alts">
            {routes.map((r, i) => (
              <button key={i} type="button" className={i === s.routeIdx ? 'alt on' : 'alt'} onClick={() => i !== s.routeIdx && s.selectRoute(i)}>
                <b>{i === 0 ? 'Найшвидший' : `Варіант ${i + 1}`}<em>{Math.round(r.majorShare * 100)}% трасами</em></b>
                <span className="bar-line"><i style={{ width: `${Math.round(r.majorShare * 100)}%` }} /></span>
                <span>{fmtDuration(r.duration)} · {fmtKm(r.distance)}</span>
              </button>
            ))}
            {!s.profile.premium && s.routes.length > 1 && (
              <Link className="alt locked" to="/premium">
                <b><Icon name="lock" size={16} /> Інші маршрути: {s.routes.length - 1}</b>
                <span>Порівняння варіантів доступне в підписці</span>
              </Link>
            )}
          </div>

          {loading && <p className="note"><span className="dot-pulse" /> Шукаємо готелі біля контрольних точок…</p>}
          {s.hotelsError && (
            <p className="alert">
              {s.hotelsError} <button type="button" className="link" onClick={() => s.loadHotels(s.wide)}>Повторити</button>
            </p>
          )}

          <ol className="timeline">
            {days.map((d) => (
              <li key={d.index} className="day" style={{ '--day': dayColor(d.index) } as React.CSSProperties}>
                <div className="day-head">
                  <b className="day-pill">День {d.index + 1}</b>
                  <span>{fmtDate(d.date)}</span>
                </div>
                <p className="muted">{fmtDuration(d.stopT - d.startT)} за кермом · {fmtKm(d.stopM - d.startM)}</p>
                {d.last ? (
                  <p className="finish"><span><Icon name="flag" size={18} /></span> Фініш: {to}</p>
                ) : d.chosen ? (
                  <Link className="night" to={`/night/${d.index}`}>
                    <Aerial lat={d.chosen.lat} lon={d.chosen.lon} width={480} height={150} className="night-cover" />
                    <span className="night-shade" />
                    <span className="night-price">{d.chosen.price} €</span>
                    <span className="night-text">
                      <small>Ніч {d.index + 1} · гак {d.chosen.detourMin} хв</small>
                      <b>{d.chosen.name}</b>
                    </span>
                    <span className="night-more">Змінити, ще {d.candidates.length - 1} <Icon name="chevron" size={16} /></span>
                  </Link>
                ) : loading ? (
                  <div className="skeleton" />
                ) : (
                  <p className="warn">Готелів у межах бюджету біля цієї ділянки не знайдено.</p>
                )}
                {d.relaxed && <small className="warn">День коротший за ліміт: далі по маршруту ночувати ніде.</small>}
              </li>
            ))}
          </ol>

          {summary.missingNights > 0 && !loading && !s.wide && (
            <button type="button" className="btn ghost" onClick={() => s.loadHotels(true)}>Розширити пошук до 25 км від траси</button>
          )}
          {s.liveSections > 0 && <p className="note">Частину готелів знайдено живим запитом до OpenStreetMap.</p>}

          <div className="actions sticky">
            <button type="button" className="btn primary big" disabled={loading || saved} onClick={save}>
              {saved ? <><Icon name="check" /> Збережено в «Поїздки»</> : 'Зберегти поїздку'}
            </button>
          </div>
          <Link className="btn ghost" to="/">Змінити маршрут</Link>
          <p className="fine">Ціни демонстраційні, час у дорозі без заторів.</p>
        </div>
      </div>
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name="route" size={38} /></span>
      <h1>{title}</h1>
      <p>{text}</p>
      {children}
    </div>
  );
}
