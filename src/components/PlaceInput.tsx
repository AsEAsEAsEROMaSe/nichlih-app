import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../lib/geocode';
import type { Place } from '../lib/types';

interface Props {
  label: string;
  value?: Place;
  onChange: (p: Place | undefined) => void;
}

/** Поле з підказками населених пунктів. Запит іде з паузою після вводу, щоб не навантажувати сервіс. */
export function PlaceInput({ label, value, onChange }: Props) {
  const [text, setText] = useState(value?.name ?? '');
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) setText(value?.name ?? '');
  }, [value]);

  useEffect(() => {
    if (!typed.current || text.trim().length < 3) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(text.trim(), ctrl.signal)
        .then((r) => {
          setItems(r);
          setOpen(true);
          setFailed(false);
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') setFailed(true);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text]);

  return (
    <label className="field place">
      <span>{label}</span>
      <input
        value={text}
        placeholder="Місто або село"
        autoComplete="off"
        onChange={(e) => {
          typed.current = true;
          setText(e.target.value);
          if (value) onChange(undefined);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {value && <span className="ok" aria-label="місце вибрано">✓</span>}
      {failed && <small className="warn">Пошук місць зараз недоступний, спробуйте ще раз.</small>}
      {open && items.length > 0 && (
        <ul className="suggest" role="listbox">
          {items.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  typed.current = false;
                  setText(p.name);
                  setOpen(false);
                  onChange(p);
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
