import { useEffect, useRef } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Icon } from './components/Icon';
import { Home } from './pages/Home';
import { HotelPage } from './pages/HotelPage';
import { Night } from './pages/Night';
import { Plan } from './pages/Plan';
import { Premium } from './pages/Premium';
import { Profile } from './pages/Profile';
import { Trips } from './pages/Trips';
import { useStore } from './store';

const NAV = [
  { to: '/', label: 'Маршрут', icon: 'compass' },
  { to: '/plan', label: 'План', icon: 'map' },
  { to: '/trips', label: 'Поїздки', icon: 'bag' },
  { to: '/premium', label: 'Підписка', icon: 'sparkles', desktopOnly: true },
  { to: '/profile', label: 'Профіль', icon: 'user' },
];

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Нічліг, на головну">
      <span className="logo-mark"><Icon name="moon" size={16} /></span>
      Нічліг
    </Link>
  );
}

function ModeSwitch() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <div className="mode-switch" role="group" aria-label="Версія застосунку">
      <button type="button" className={mode === 'mobile' ? 'on' : ''} aria-pressed={mode === 'mobile'} onClick={() => setMode('mobile')}>
        <Icon name="phone" size={18} />
        Телефон
      </button>
      <button type="button" className={mode === 'desktop' ? 'on' : ''} aria-pressed={mode === 'desktop'} onClick={() => setMode('desktop')}>
        <Icon name="monitor" size={18} />
        Десктоп
      </button>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const scroll = useRef<HTMLDivElement>(null);
  const premium = useStore((s) => s.profile.premium);
  useEffect(() => {
    scroll.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="viewport">
      <header className="topbar">
        <Logo />
        <nav className="topnav" aria-label="Розділи">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/premium" className={premium ? 'pill gold' : 'pill'}>
          <Icon name="sparkles" size={14} />
          {premium ? 'Мандрівник' : 'Підписка'}
        </Link>
      </header>
      <div className="scroll" ref={scroll}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/night/:day" element={<Night />} />
          <Route path="/hotel/:day/:type/:osmId" element={<HotelPage />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <nav className="tabs" aria-label="Розділи">
        {NAV.filter((n) => !n.desktopOnly).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'tab on' : 'tab')}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  const mode = useStore((s) => s.mode);
  return (
    <HashRouter>
      <div className={`stage ${mode}`}>
        <ModeSwitch />
        <div className="device">
          <Shell />
        </div>
      </div>
    </HashRouter>
  );
}
