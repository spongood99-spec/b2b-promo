import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../../components/AppHeader';
import { useCalendarPromotions } from './useCalendarPromotions';
import './CalendarPage.css';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CANCELLED_STATUSES = ['cancelled', 'rejected'];
const MAX_VISIBLE_PER_DAY = 3;

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getRange(anchor, view) {
  if (view === 'day') {
    return { from: toISO(anchor), to: toISO(anchor), days: [anchor] };
  }
  if (view === 'week') {
    const start = addDays(anchor, -anchor.getDay());
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return { from: toISO(days[0]), to: toISO(days[6]), days };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridStart = addDays(first, -first.getDay());
  const gridEnd = addDays(last, 6 - last.getDay());
  const days = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  return { from: toISO(gridStart), to: toISO(gridEnd), days };
}

function shift(anchor, view, dir) {
  const d = new Date(anchor);
  if (view === 'month') d.setMonth(d.getMonth() + dir);
  else if (view === 'week') d.setDate(d.getDate() + dir * 7);
  else d.setDate(d.getDate() + dir);
  return d;
}

function formatLabel(anchor, view) {
  if (view === 'month') return `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`;
  if (view === 'day') return `${anchor.getFullYear()}.${anchor.getMonth() + 1}.${anchor.getDate()}(${WEEKDAY_LABELS[anchor.getDay()]})`;
  const { days } = getRange(anchor, 'week');
  return `${toISO(days[0])} ~ ${toISO(days[6])}`;
}

export function CalendarPage() {
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(new Date());

  const { from, to, days } = getRange(anchor, view);
  const query = useCalendarPromotions(from, to);

  const promotionsByDay = (day) => {
    const iso = toISO(day);
    return (query.data ?? []).filter(
      (p) => p.start_date <= iso && p.end_date >= iso && !CANCELLED_STATUSES.includes(p.status)
    );
  };

  return (
    <div className="calendar-page">
      <AppHeader activeNav="calendar" />

      <div className="calendar-toolbar">
        <div className="calendar-tabs">
          {['month', 'week', 'day'].map((v) => (
            <button
              key={v}
              type="button"
              className={v === view ? 'calendar-tab active' : 'calendar-tab'}
              onClick={() => setView(v)}
            >
              {v === 'month' ? '월' : v === 'week' ? '주' : '일'}
            </button>
          ))}
        </div>
        <div className="calendar-nav">
          <button type="button" onClick={() => setAnchor(shift(anchor, view, -1))}>{'<'}</button>
          <span>{formatLabel(anchor, view)}</span>
          <button type="button" onClick={() => setAnchor(shift(anchor, view, 1))}>{'>'}</button>
        </div>
      </div>

      {query.isLoading && <p>불러오는 중...</p>}
      {query.isError && <p>{query.error?.message}</p>}

      {query.isSuccess && (
        <div className={`calendar-grid calendar-grid-${view}`}>
          {view === 'month' && WEEKDAY_LABELS.map((w) => (
            <div key={w} className="calendar-weekday-label">{w}</div>
          ))}
          {days.map((day) => {
            const dayPromotions = promotionsByDay(day);
            const visible = dayPromotions.slice(0, MAX_VISIBLE_PER_DAY);
            const hiddenCount = dayPromotions.length - visible.length;
            return (
              <div key={toISO(day)} className="calendar-day">
                <div className="calendar-day-number">{day.getDate()}</div>
                {visible.map((p) => (
                  <Link key={p.id} className="calendar-promo-item" to={`/promotions/${p.id}`}>
                    {p.items?.[0]?.name ?? p.condition}
                  </Link>
                ))}
                {hiddenCount > 0 && <div className="calendar-promo-more">+{hiddenCount}건 더</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
