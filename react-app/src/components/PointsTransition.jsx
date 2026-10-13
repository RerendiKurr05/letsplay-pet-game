import { useEffect, useRef } from 'react';
import Icon from './Icon';
import AnimatedNumber from './AnimatedNumber';
import { playSoundCue } from '../sound';

export default function PointsTransition({
  checkin,
  summary,
  dashboardUrl,
  soundEnabled,
  onContinueToLocation,
  onContinueToPet,
}) {
  const hasPlayedArrivalSound = useRef(false);
  const attendanceDate = checkin?.checkin_date
    ? new Date(`${checkin.checkin_date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    : 'Today';
  const mood = Math.max(0, Math.min(100, Number(checkin?.mood_meter) || 0));
  const points = Number(checkin?.points_awarded || 0);
  const isLeave = checkin?.attendance_type === 'leave';

  useEffect(() => {
    if (hasPlayedArrivalSound.current) return;
    hasPlayedArrivalSound.current = true;
    playSoundCue('checkin-complete', soundEnabled);
  }, [soundEnabled]);

  return (
    <div className="petgame-transition-shell">
      <button
        className="petgame-transition-back"
        type="button"
        onClick={onContinueToLocation}
        aria-label="Back to location selector"
        title="Back to location selector"
      >
        <Icon name="back" size={19} />
      </button>
      <section className="petgame-transition" aria-labelledby="petgame-transition-title">
      <div className="petgame-transition-mark"><Icon name="check" size={28} /></div>
      <span className="petgame-eyebrow">ATTENDANCE UPDATE · {attendanceDate.toUpperCase()}</span>
      <h1 id="petgame-transition-title">
        {isLeave ? 'Leave recorded.' : checkin?.on_time ? 'Check-in complete.' : 'Attendance updated.'}
      </h1>
      <p className="petgame-transition-subtitle">
        {isLeave
          ? 'Your attendance streak and weekly trail are unchanged.'
          : checkin?.on_time
          ? 'Your progress is added to the same points pool.'
          : 'Your attendance status has been recorded.'}
      </p>

      <div className="petgame-reward-card">
        <div className="petgame-reward-heading">
          <span><Icon name="points" size={18} /> {points < 0 ? 'Points deducted' : 'Points earned'}</span>
          <span>{checkin?.location_name || 'Attendance'}</span>
        </div>
        <div className="petgame-reward-amount">
          {points > 0 ? '+' : ''}<AnimatedNumber value={points} />
          <span>points</span>
        </div>
        <div className="petgame-reward-divider" />
        <div className="petgame-reward-balance">
          <span>Lifetime balance</span>
          <strong><AnimatedNumber value={Number(summary?.lifetime_points || 0)} /> pts</strong>
        </div>
      </div>

      <div className="petgame-transition-details">
        <div>
          <span className="petgame-detail-icon"><Icon name="board" size={18} /></span>
          <span>Weekly trail</span>
          <strong>{summary?.weekly_steps || 0} / 6 steps</strong>
        </div>
        <div>
          <span className="petgame-detail-icon"><Icon name="pet" size={18} /></span>
          <span>Pet mood</span>
          <strong>{mood}%</strong>
        </div>
      </div>

      <div className="petgame-transition-actions">
        {dashboardUrl ? (
          <a className="petgame-transition-dashboard" href={dashboardUrl}>
            Go to dashboard
            <Icon name="arrow" size={17} />
          </a>
        ) : (
          <button
            className="petgame-transition-dashboard"
            type="button"
            disabled
            title="Configure the petgame_dashboard_url filter to enable this destination"
          >
            Go to dashboard
            <Icon name="arrow" size={17} />
          </button>
        )}
        <button className="petgame-transition-button" type="button" onClick={onContinueToPet}>
          Continue to your pet
          <Icon name="arrow" size={18} />
        </button>
      </div>
      <p className="petgame-transition-note">Points and progress are saved to your game account.</p>
      </section>
    </div>
  );
}
