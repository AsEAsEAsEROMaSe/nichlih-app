import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Aerial } from '../components/Aerial';
import { KIND, Stars, hotelPath } from '../components/HotelCard';
import { Icon } from '../components/Icon';
import { RouteMap } from '../components/RouteMap';
import { fmtDate, fmtDuration } from '../lib/format';
import { priceParts } from '../lib/pricing';
import { useStore } from '../store';
import { usePlan } from '../usePlan';

const mult = (k: number) => (k === 1 ? 'без надбавки' : `×${k.toFixed(2).replace('.', ',')}`);

export function HotelPage() {
  const { day, type, osmId } = useParams();
  const plan = usePlan();
  const choose = useStore((s) => s.choose);
  const navigate = useNavigate();
  const d = plan?.days[Number(day)];
  const c = d?.candidates.find((x) => x.id === `${type}/${osmId}`);
  if (!plan || !d || !c) return <Navigate to="/plan" replace />;
  const on = d.chosen?.id === c.id;
  const rank = d.candidates.indexOf(c) + 1;
  const p = priceParts(c, d.date);
  const others = d.candidates.filter((x) => x.id !== c.id).slice(0, 3);

  const facts = [
    { icon: 'clock', label: 'У дорозі цього дня', value: fmtDuration(c.routeT - d.startT) },
    { icon: 'route', label: 'Від траси', value: `${c.offKm.toFixed(1).replace('.', ',')} км, гак ${c.detourMin} хв` },
    { icon: 'pin', label: 'Місце серед варіантів', value: `${rank} з ${d.candidates.length}` },
    ...(c.parking ? [{ icon: 'parking', label: 'Парковка', value: 'Є' }] : []),
    ...(c.phone ? [{ icon: 'call', label: 'Телефон', value: c.phone }] : []),
  ];

  return (
    <div className="hotel-page">
      <div className="cover">
        <Aerial lat={c.lat} lon={c.lon} width={1500} height={520} />
        <span className="cover-shade" />
        <span className="cover-pin"><Icon name="pin" size={34} /></span>
        <div className="cover-inner">
          <Link className="back glass" to={`/night/${d.index}`}><Icon name="back" size={18} /> Усі варіанти на ніч {d.index + 1}</Link>
          <div className="cover-title">
            <p className="eyebrow">{KIND[c.kind]} <Stars n={c.stars} /></p>
            <h1>{c.name}</h1>
          </div>
        </div>
        <span className="cover-note">Знімок з повітря: Esri</span>
      </div>

      <div className="page hotel-grid">
        <div className="hotel-info">
          <ul className="facts">
            {facts.map((f) => (
              <li key={f.label}>
                <span className="fact-icon"><Icon name={f.icon} /></span>
                <span><small>{f.label}</small><b>{f.value}</b></span>
              </li>
            ))}
          </ul>

          <section>
            <h2 className="h2">Місце згори</h2>
            <div className="gallery">
              <figure><Aerial lat={c.lat} lon={c.lon} width={420} height={260} zoom={18} /><figcaption>Зблизька</figcaption></figure>
              <figure><Aerial lat={c.lat} lon={c.lon} width={420} height={260} zoom={15} /><figcaption>Околиці</figcaption></figure>
              <figure className="spot"><RouteMap route={plan.route} days={[d]} spot={[c.lat, c.lon]} focus={{ ...d, candidates: [c], chosen: c }} /><figcaption>На маршруті</figcaption></figure>
            </div>
          </section>

          {others.length > 0 && (
            <section>
              <h2 className="h2">Інші варіанти на цю ніч</h2>
              <div className="others">
                {others.map((x) => (
                  <Link key={x.id} to={hotelPath(d.index, x.id)} className="other">
                    <Aerial lat={x.lat} lon={x.lon} width={260} height={120} />
                    <span><b>{x.name}</b><small>{x.price} € · гак {x.detourMin} хв</small></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <p className="fine">Дані про готель: © учасники OpenStreetMap. Фото готелю в цих даних нема, тому показуємо знімки місця з повітря.</p>
        </div>

        <aside className="book">
          <span className="price xl">{c.price} €<small>за ніч · ніч {d.index + 1}, {fmtDate(d.date)}</small></span>
          <button
            type="button"
            className="btn primary big"
            onClick={() => {
              choose(d.index, c.id);
              navigate('/plan');
            }}
          >
            {on ? <><Icon name="check" /> Обрано, до плану</> : `Обрати на ніч ${d.index + 1}`}
          </button>
          {c.website && (
            <a className="btn ghost" href={c.website} target="_blank" rel="noopener noreferrer">
              Сайт готелю <Icon name="external" size={16} />
            </a>
          )}
          <dl className="breakdown">
            <dt>З чого складається ціна</dt>
            <div><dt>{KIND[c.kind]}, базова</dt><dd>{p.base} €</dd></div>
            <div><dt>Клас закладу</dt><dd>{mult(p.stars)}</dd></div>
            <div><dt>Цей заклад</dt><dd>{mult(p.jitter)}</dd></div>
            <div><dt>Сезон</dt><dd>{mult(p.season)}</dd></div>
            <div><dt>День тижня</dt><dd>{mult(p.weekend)}</dd></div>
            <div className="total"><dt>Разом</dt><dd>{p.total} €</dd></div>
          </dl>
          <p className="fine">Ціна демонстраційна: її рахує модель, а не готель.</p>
        </aside>
      </div>
    </div>
  );
}
