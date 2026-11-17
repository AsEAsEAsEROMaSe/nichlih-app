import { Link } from 'react-router-dom';
import { fmtDuration } from '../lib/format';
import type { Candidate, Day } from '../lib/types';
import { Aerial } from './Aerial';
import { Icon } from './Icon';

export const KIND = { hotel: 'Готель', motel: 'Мотель', guest_house: 'Гостьовий будинок' } as const;

export function Stars({ n }: { n?: number | null }) {
  if (!n) return null;
  return (
    <span className="stars" aria-label={`${n} зірок`}>
      {Array.from({ length: n }, (_, i) => <Icon key={i} name="star" size={13} />)}
    </span>
  );
}

export const hotelPath = (day: number, id: string) => `/hotel/${day}/${id}`;

interface Props {
  c: Candidate;
  day: Day;
  best: boolean;
  on: boolean;
  onPick: () => void;
  onHover?: (id?: string) => void;
}

export function HotelCard({ c, day, best, on, onPick, onHover }: Props) {
  return (
    <article className={on ? 'hcard on' : 'hcard'} onMouseEnter={() => onHover?.(c.id)} onMouseLeave={() => onHover?.()}>
      <Link to={hotelPath(day.index, c.id)} className="hcard-main">
        <Aerial lat={c.lat} lon={c.lon} width={120} height={120} className="thumb lg" />
        <span className="hcard-text">
          {best && <span className="tag"><Icon name="sparkles" size={12} /> Найкращий вибір</span>}
          <b>{c.name}</b>
          <small>{KIND[c.kind]} <Stars n={c.stars} />{c.parking ? ' · парковка' : ''}</small>
          <small className="hcard-facts">
            <span><Icon name="clock" size={13} /> {fmtDuration(c.routeT - day.startT)}</span>
            <span><Icon name="route" size={13} /> гак {c.detourMin} хв</span>
          </small>
        </span>
      </Link>
      <div className="hcard-side">
        <span className="price">{c.price} €<small>за ніч</small></span>
        <button type="button" className={on ? 'btn pick on' : 'btn pick'} aria-pressed={on} onClick={onPick}>
          {on ? <><Icon name="check" size={16} /> Обрано</> : 'Обрати'}
        </button>
      </div>
    </article>
  );
}
