import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useStore } from '../store';

export function Profile() {
  const profile = useStore((s) => s.profile);
  const params = useStore((s) => s.params);
  const setProfile = useStore((s) => s.setProfile);
  const setParams = useStore((s) => s.setParams);
  const trips = useStore((s) => s.trips);
  const initial = profile.name.trim().charAt(0).toUpperCase();
  const [confirm, setConfirm] = useState(false);

  // Усе, що знає застосунок про користувача, лежить лише в цьому браузері. Стираємо і починаємо з чистого.
  const wipe = () => {
    useStore.persist.clearStorage();
    window.location.replace(window.location.pathname);
  };

  return (
    <div className="page narrow">
      <header className="page-head profile-head">
        <span className="avatar">{initial || <Icon name="user" size={30} />}</span>
        <div>
          <p className="eyebrow">{profile.premium ? 'Мандрівник' : 'Базовий план'}</p>
          <h1>{profile.name.trim() ? `Вітаємо, ${profile.name.trim()}` : 'Ваш профіль'}</h1>
        </div>
        <ul className="head-stats mini-stats">
          <li><b>{trips.length}</b>поїздок</li>
          <li><b>{trips.filter((t) => t.booked).length}</b>заброньовано</li>
          <li><b>{trips.reduce((s, t) => s + t.summary.distanceKm, 0).toLocaleString('uk-UA')}</b>км у планах</li>
        </ul>
      </header>

      <section className="panel">
        <h3>Як до вас звертатись</h3>
        <label className="field">
          <span>Ім'я</span>
          <input value={profile.name} maxLength={40} placeholder="Наприклад, Віталій" onChange={(e) => setProfile({ name: e.target.value })} />
        </label>
      </section>

      <section className="panel">
        <h3>Звички в дорозі</h3>
        <label className="field">
          <span>За кермом на день <b>до {params.dayHours} год</b></span>
          <input type="range" min={3} max={10} value={params.dayHours} onChange={(e) => setParams({ dayHours: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Бюджет на ніч <b>до {params.budget} €</b></span>
          <input type="range" min={30} max={300} step={10} value={params.budget} onChange={(e) => setParams({ budget: Number(e.target.value) })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={params.guestHouses} onChange={(e) => setParams({ guestHouses: e.target.checked })} />
          Показувати гостьові будинки
        </label>
      </section>

      <Link to="/premium" className="teaser">
        <span className="teaser-icon"><Icon name="sparkles" size={28} /></span>
        <span>
          <b>{profile.premium ? 'Підписка «Мандрівник» активна' : 'Підписка «Мандрівник»'}</b>
          {profile.premium ? 'Вам доступні всі варіанти маршруту.' : 'Кілька варіантів маршруту і AI-помічник.'}
        </span>
        <Icon name="chevron" />
      </Link>

      <section className="panel">
        <h3>Ваші дані</h3>
        <p className="privacy-note">
          Акаунта нема: ім'я, налаштування й поїздки зберігаються лише в цьому браузері й нікуди не надсилаються.
          Сервісам маршрутів і пошуку місць іде тільки текст пошуку й координати точок.
        </p>
        {confirm ? (
          <div className="wipe-row">
            <button type="button" className="btn danger" onClick={wipe}>Так, стерти все</button>
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Скасувати</button>
          </div>
        ) : (
          <button type="button" className="btn ghost" onClick={() => setConfirm(true)}>Стерти мої дані з пристрою</button>
        )}
      </section>

      <p className="fine">Маршрути: OSRM. Готелі й карта: © учасники OpenStreetMap (ODbL). Пошук місць: Photon. Знімки з повітря: Esri. Ціни й бронювання демонстраційні.</p>
    </div>
  );
}
