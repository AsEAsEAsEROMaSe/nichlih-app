import { Icon } from '../components/Icon';
import { useStore } from '../store';

const ROWS: [string, boolean, boolean | string][] = [
  ['Найшвидший маршрут трасами', true, true],
  ['Готелі на кожну ніч з цінами', true, true],
  ['Збереження поїздок', true, true],
  ['Кілька варіантів маршруту з порівнянням', false, true],
  ['AI-помічник поїздки', false, 'скоро'],
];

const Mark = ({ v }: { v: boolean | string }) =>
  v === true ? <Icon name="check" size={18} /> : v === false ? <span className="dash" aria-label="нема" /> : <em>{v}</em>;

export function Premium() {
  const premium = useStore((s) => s.profile.premium);
  const setProfile = useStore((s) => s.setProfile);

  return (
    <div className="page">
      <section className="premium-hero">
        <div>
          <p className="eyebrow">Підписка «Мандрівник»</p>
          <h1>Їдьте <span className="hl">кращим</span> маршрутом, а не першим-ліпшим</h1>
          <p className="lead">Порівнюйте всі варіанти дороги: скільки часу, скільки кілометрів і яка частка йде трасами.</p>
        </div>
        <div className="plan pro">
          <h3><Icon name="sparkles" /> Мандрівник</h3>
          <p className="price xl">4 €<small>на місяць</small></p>
          <button type="button" className={premium ? 'btn ghost light' : 'btn gold big'} onClick={() => setProfile({ premium: !premium })}>
            {premium ? 'Скасувати підписку' : 'Оформити'}
          </button>
          <p className="fine">{premium ? 'Підписка активна.' : 'Демо: оплата не знімається, підписка вмикається одразу.'}</p>
        </div>
      </section>

      <section className="compare">
        <div className="compare-row head"><span /><b>Базовий<small>0 €</small></b><b className="gold">Мандрівник<small>4 € на місяць</small></b></div>
        {ROWS.map(([label, free, pro]) => (
          <div className="compare-row" key={label}><span>{label}</span><i><Mark v={free} /></i><i className="gold"><Mark v={pro} /></i></div>
        ))}
      </section>

      <section className="ai-preview">
        <div>
          <p className="eyebrow dark">Скоро</p>
          <h2 className="h2">AI-помічник, який дивиться на вашу дорогу</h2>
          <p className="muted">Він бачитиме маршрут, погоду і готелі та пропонуватиме зміни. Застосовуються вони лише після вашої згоди.</p>
        </div>
        <div className="chat" aria-label="Приклад розмови з помічником">
          <p className="bubble me">Чи варто завтра їхати довше?</p>
          <p className="bubble ai"><Icon name="sparkles" size={16} /> Так. Післязавтра на ділянці біля Варшави дощ, тож краще проїхати сім годин завтра і зупинитись за Любліном. Змінити план?</p>
          <p className="fine">Приклад того, як це виглядатиме.</p>
        </div>
      </section>
    </div>
  );
}
