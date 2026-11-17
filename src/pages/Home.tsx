import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Aerial } from '../components/Aerial';
import { HeroMap, type HeroStop } from '../components/HeroMap';
import { RouteSketch } from '../components/HeroScene';
import { Icon } from '../components/Icon';
import { PlaceInput } from '../components/PlaceInput';
import { dayColor } from '../components/RouteMap';
import demo from '../data/hero.json';
import { fmtDuration, todayISO } from '../lib/format';
import { loadDataset } from '../lib/hotelSource';
import type { LatLon, Place } from '../lib/types';
import { useStore } from '../store';

const ODESA: Place = { name: 'Одеса', lat: 46.4825, lon: 30.7233 };
const GDANSK: Place = { name: 'Гданськ', lat: 54.352, lon: 18.6466 };
const ROUTES: { from: Place; to: Place; note: string }[] = [
  { from: { name: 'Львів', lat: 49.8397, lon: 24.0297 }, to: GDANSK, note: 'До Балтійського моря через Люблін і Варшаву' },
  { from: { name: 'Київ', lat: 50.4501, lon: 30.5234 }, to: { name: 'Краків', lat: 50.0647, lon: 19.945 }, note: 'Через Житомир, Рівне і Львів' },
  { from: ODESA, to: { name: 'Варшава', lat: 52.2297, lon: 21.0122 }, note: 'З півдня на північ через усю Україну' },
];

const STEPS = [
  { icon: 'route', title: 'Вкажіть початок і кінець', text: 'Прокладаємо найшвидший маршрут, переважно автомагістралями й трасами.' },
  { icon: 'clock', title: 'Ділимо дорогу на дні', text: 'Рахуємо час за кермом, а не кілометри, і ставимо контрольні точки в останню годину дня.' },
  { icon: 'bed', title: 'Підбираємо нічліг', text: 'Біля кожної точки показуємо готелі з ціною і тим, скільки хвилин доведеться звернути з траси.' },
];

/** Число, що набігає від нуля до цілі. Без анімації, якщо користувач просив менше руху. */
function useCountUp(target: number | undefined, ms = 1400): number | undefined {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!target) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setValue(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setValue(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function Home() {
  const params = useStore((s) => s.params);
  const setParams = useStore((s) => s.setParams);
  const build = useStore((s) => s.build);
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const navigate = useNavigate();
  const [count, setCount] = useState<number>();
  const shown = useCountUp(count);
  const busy = status === 'routing' || status === 'hotels';
  const ready = !!params.from && !!params.to && !busy;

  const line = demo.line as LatLon[];
  const nights = demo.days.filter((d) => d.hotel);
  const stops = useMemo<HeroStop[]>(
    () => nights.map((d) => ({ night: d.index + 1, name: d.hotel!.name, lat: d.hotel!.lat, lon: d.hotel!.lon, price: d.hotel!.price, frac: d.endFrac })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Заодно прогріваємо набір готелів, щоб план будувався миттєво.
  useEffect(() => {
    loadDataset().then((d) => d.length && setCount(d.length));
  }, []);

  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    navigate('/plan');
    await build();
  }
  function tryRoute(from: Place, to: Place, dayHours?: number) {
    setParams(dayHours ? { from, to, dayHours } : { from, to });
    void go();
  }

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-top">
          <HeroMap line={line} stops={stops} />
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow"><span className="live" /> Планувальник автоподорожей</p>
            <h1>Маршрут трасами. <span className="hl">Нічліг</span> на кожну ніч.</h1>
            <p className="lead">Скажіть, звідки й куди їдете. Ми поділимо дорогу на дні й знайдемо готель саме там, де ви захочете зупинитись.</p>
            <ul className="hero-facts">
              <li><b>{shown ? shown.toLocaleString('uk-UA') : '20 000+'}</b>готелів України й Польщі</li>
              <li><b>1 с</b>на готовий план</li>
              <li><b>0</b>реєстрацій для старту</li>
            </ul>
          </div>
        </div>

        <div className="hero-search">
          <form className="bar" onSubmit={go}>
            <div className="cell"><PlaceInput label="Звідки" value={params.from} onChange={(from) => setParams({ from })} /></div>
            <div className="cell"><PlaceInput label="Куди" value={params.to} onChange={(to) => setParams({ to })} /></div>
            <div className="cell">
              <label className="field">
                <span>Виїзд</span>
                <input type="date" value={params.date} min={todayISO()} required onChange={(e) => setParams({ date: e.target.value || todayISO() })} />
              </label>
            </div>
            <div className="cell">
              <label className="field">
                <span>За кермом на день</span>
                <select value={params.dayHours} onChange={(e) => setParams({ dayHours: Number(e.target.value) })}>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>до {h} год</option>)}
                </select>
              </label>
            </div>
            <button className="btn primary go" type="submit" disabled={!ready}>
              {busy ? 'Будуємо…' : 'Побудувати'}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="bar-extra">
            <div className="chips">
              {ROUTES.map((r) => (
                <button type="button" className="chip" key={r.from.name + r.to.name} onClick={() => setParams({ from: r.from, to: r.to })}>
                  {r.from.name} → {r.to.name}
                </button>
              ))}
            </div>
            <label className="field inline">
              <span>Бюджет на ніч <b>до {params.budget} €</b></span>
              <input type="range" min={30} max={300} step={10} value={params.budget} onChange={(e) => setParams({ budget: Number(e.target.value) })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={params.guestHouses} onChange={(e) => setParams({ guestHouses: e.target.checked })} />
              Гостьові будинки
            </label>
          </div>
          {error && <p className="alert">{error}</p>}
        </div>
      </section>

      <section className="band showcase">
        <div className="showcase-copy">
          <p className="eyebrow dark">Що ви отримаєте</p>
          <h2>Готовий план за секунду, а не вечір у вкладках</h2>
          <ul className="benefits">
            <li><span><Icon name="route" /></span><div><b>Дорога, поділена на дні</b>Жоден день не довший, ніж ви готові їхати.</div></li>
            <li><span><Icon name="bed" /></span><div><b>Готель біля траси на кожну ніч</b>Видно ціну і скільки хвилин займе гак.</div></li>
            <li><span><Icon name="euro" /></span><div><b>Бюджет наперед</b>Сума за всі ночівлі ще до виїзду.</div></li>
          </ul>
        </div>

        <article className="demo">
          <header>
            <span className="badge gold">Приклад плану</span>
            <h3>{demo.from} <Icon name="arrow" size={18} /> {demo.to}</h3>
            <ul className="demo-stats">
              <li><b>{demo.distanceKm}</b> км</li>
              <li><b>{demo.days.length}</b> дні</li>
              <li><b>{demo.majorShare}%</b> трасами</li>
              <li><b>{demo.cost} €</b> за ночівлі</li>
            </ul>
          </header>
          <ol className="timeline">
            {demo.days.map((d) => (
              <li key={d.index} className="day" style={{ '--day': dayColor(d.index) } as React.CSSProperties}>
                <div className="day-head"><b>День {d.index + 1}</b><span>{fmtDuration(d.driveSec)} · {d.km} км</span></div>
                {d.hotel ? (
                  <div className="demo-night">
                    <Aerial lat={d.hotel.lat} lon={d.hotel.lon} width={72} height={72} className="thumb" />
                    <span className="night-text">
                      <small>Ніч {d.index + 1} · варіантів: {d.options}</small>
                      <b>{d.hotel.name}</b>
                      <small>{d.hotel.price} € · гак {d.hotel.detourMin} хв</small>
                    </span>
                  </div>
                ) : (
                  <p className="finish"><Icon name="flag" size={18} /> Фініш: {demo.to}</p>
                )}
              </li>
            ))}
          </ol>
          <button type="button" className="btn primary big" onClick={() => tryRoute(ODESA, GDANSK, 7)}>
            Відкрити цей маршрут <Icon name="arrow" />
          </button>
        </article>
      </section>

      <section className="band">
        <h2>Як це працює</h2>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="step-num">{i + 1}</span>
              <span className="step-icon"><Icon name={s.icon} size={26} /></span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="band">
        <h2>Спробуйте готовий маршрут</h2>
        <div className="route-cards">
          {ROUTES.map((r, i) => (
            <button type="button" key={r.from.name + r.to.name} className="route-card" onClick={() => tryRoute(r.from, r.to)}>
              <RouteSketch seed={i} />
              <b>{r.from.name} → {r.to.name}</b>
              <span>{r.note}</span>
              <em>Побудувати <Icon name="arrow" size={16} /></em>
            </button>
          ))}
        </div>
      </section>

      <section className="band">
        <Link to="/premium" className="teaser">
          <span className="teaser-icon"><Icon name="sparkles" size={28} /></span>
          <span>
            <b>Підписка «Мандрівник»</b>
            Порівнюйте кілька варіантів маршруту і отримуйте поради AI-помічника в дорозі.
          </span>
          <Icon name="chevron" />
        </Link>
        <p className="fine">Маршрути: OSRM. Готелі й карта: © учасники OpenStreetMap. Знімки з повітря: Esri. Ціни демонстраційні.</p>
      </section>
    </div>
  );
}
