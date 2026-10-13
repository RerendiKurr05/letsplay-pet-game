import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import IsoAttendanceBoard from './IsoAttendanceBoard';
import { playSoundCue } from '../sound';

const LOCATION_GROUPS = [
  { id: 'wfo', title: 'WFO', subtitle: 'Work from Office' },
  { id: 'wfh', title: 'WFH', subtitle: 'Work from Home' },
  { id: 'offsite', title: 'Off Site', subtitle: 'Other work locations' },
  { id: 'leave', title: 'Sick or Other Leave', subtitle: 'Leave request' },
  { id: 'other', title: 'Other locations', subtitle: '' },
];

export default function BoardScreen({
  summary,
  loading,
  error,
  formUrl,
  soundEnabled,
  onRefresh,
  onShowTransition,
  onDemoAttendance,
  attendanceReturnPending = false,
}) {
  const stepCount = Math.max(0, Math.min(summary?.max_steps || 6, summary?.weekly_steps || 0));
  const locations = summary?.locations || [];
  const todayCheckin = summary?.today_checkin;
  const [selectedId, setSelectedId] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationError, setConfirmationError] = useState('');
  const continueButtonRef = useRef(null);
  const positiveButtonRef = useRef(null);
  const backButtonRef = useRef(null);
  const selectedLocation = locations.find((location) => location.id === selectedId);
  const attendanceReady = Boolean(selectedLocation);
  const groupedLocations = LOCATION_GROUPS
    .map((group) => ({
      ...group,
      locations: locations.filter((location) => (location.category || 'other') === group.id),
    }))
    .filter((group) => group.locations.length > 0);

  useEffect(() => {
    if (!confirmationOpen) return undefined;

    positiveButtonRef.current?.focus();
    function handleDialogKeydown(event) {
      if (event.key === 'Escape') closeConfirmation();
      if (event.key !== 'Tab') return;

      const firstButton = positiveButtonRef.current;
      const lastButton = backButtonRef.current;
      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton?.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton?.focus();
      }
    }

    document.addEventListener('keydown', handleDialogKeydown);
    return () => document.removeEventListener('keydown', handleDialogKeydown);
  }, [confirmationOpen]);

  function closeConfirmation() {
    setConfirmationOpen(false);
    requestAnimationFrame(() => continueButtonRef.current?.focus());
  }

  function confirmLocation() {
    if (!selectedLocation) return;

    if (!formUrl) {
      playSoundCue('confirm', soundEnabled);
      setConfirmationOpen(false);
      onDemoAttendance?.(selectedLocation);
      return;
    }

    playSoundCue('confirm', soundEnabled);
    const destination = new URL(formUrl, window.location.origin);
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set('petgame_return', 'attendance');
    destination.searchParams.set('location_id', selectedLocation.id);
    destination.searchParams.set('location_category', selectedLocation.category || 'other');
    destination.searchParams.set('return_url', returnUrl.toString());
    window.location.assign(destination.toString());
  }

  function selectLocation(locationId) {
    setSelectedId(locationId);
    setConfirmationError('');
    playSoundCue('select', soundEnabled);
  }

  return (
    <section className="petgame-board-view" aria-labelledby="petgame-board-title">
      <div className="petgame-section-heading">
        <div>
          <span className="petgame-eyebrow">YOUR WEEKLY JOURNEY</span>
          <h1 id="petgame-board-title">Let&apos;s make today count.</h1>
        </div>
        <div className="petgame-board-week">WEEKLY TRAIL</div>
      </div>

      {error && (
        <div className="petgame-banner-error" role="alert">
          {error}
          <button type="button" onClick={onRefresh}>Try again</button>
        </div>
      )}
      {!todayCheckin && !loading && (
        <div className="petgame-today-checkin petgame-today-checkin-pending" role="status">
          <span className="petgame-checkin-mark"><Icon name="clock" size={18} /></span>
          <div>
            <strong>{attendanceReturnPending ? 'Attendance submitted' : 'Attendance pending'}</strong>
            <span>
              {attendanceReturnPending
                ? 'Your attendance record is syncing. This will update automatically.'
                : 'You haven&apos;t filled out your attendance record today.'}
            </span>
          </div>
        </div>
      )}

      {todayCheckin && (
        <div className={`petgame-today-checkin${todayCheckin?.is_demo ? ' petgame-today-checkin-demo' : ''}`}>
          <span className="petgame-checkin-mark"><Icon name="check" size={18} /></span>
          <div>
            <strong>{todayCheckin.attendance_type === 'leave' ? "Today's leave is recorded" : "Today's attendance is recorded"}</strong>
            <span>
              {todayCheckin.location_name || 'Attendance check-in'}
              {todayCheckin.attendance_type === 'leave'
                ? ' · Streak unchanged'
                : todayCheckin.on_time ? ' · On time' : ' · Late'}
            </span>
          </div>
          <button type="button" onClick={onShowTransition} aria-label="View today's points">
            <Icon name="arrow" size={18} />
          </button>
        </div>
      )}

      <div className="petgame-iso-board-card">
        <div className="petgame-iso-board-heading">
          <div>
            <span className="petgame-eyebrow">YOUR WEEKLY JOURNEY</span>
            <strong>One step at a time.</strong>
          </div>
          <span className="petgame-iso-step-count">{stepCount} <small>/ 6</small></span>
        </div>
        <IsoAttendanceBoard
          stepCount={stepCount}
          locations={locations}
          selectedId={selectedId}
          onSelectLocation={selectLocation}
        />
      </div>

      <div className="petgame-location-heading">
        <div>
          <span className="petgame-eyebrow">ATTENDANCE</span>
          <h2>Choose today&apos;s attendance type</h2>
        </div>
        <span className="petgame-location-hint">Choose the option that fits today</span>
      </div>

      {loading ? (
        <div className="petgame-inline-loading">Loading locations…</div>
      ) : locations.length > 0 ? (
        <div className="petgame-location-groups">
          {groupedLocations.map((group) => (
            <section className={`petgame-location-group${group.locations.length === 1 ? ' is-single' : ''}`} key={group.id} aria-label={group.title}>
              <h3>
                <strong>{group.title}</strong>
                {group.subtitle && <span>{group.subtitle}</span>}
              </h3>
              <div className="petgame-location-grid">
                {group.locations.map((location, index) => (
                  <button
                    className="petgame-location-card"
                    key={location.id}
                    type="button"
                    aria-pressed={selectedId === location.id}
                    onClick={() => selectLocation(location.id)}
                  >
                    <span className={`petgame-location-icon location-tone-${index % 5}`}>
                      <Icon name={group.id === 'leave' ? 'clock' : 'pin'} size={20} />
                    </span>
                    <span className="petgame-location-name">{location.name}</span>
                    <span className="petgame-location-arrow"><Icon name="arrow" size={16} /></span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="petgame-setup-note">
          <span className="petgame-setup-icon"><Icon name="pin" size={21} /></span>
          <div>
            <strong>Location choices will appear here</strong>
            <p>Connect the attendance locations to show the real check-in destinations.</p>
          </div>
        </div>
      )}

      {locations.length > 0 && (
        <button
          ref={continueButtonRef}
          className="petgame-attendance-continue"
          type="button"
          disabled={!attendanceReady}
          onClick={() => {
            setConfirmationError('');
            setConfirmationOpen(true);
          }}
        >
          <span className="petgame-attendance-continue-icon"><Icon name="pin" size={17} /></span>
          <span>
            <strong>{selectedLocation ? `Continue to ${selectedLocation.name}` : 'Choose a location to continue'}</strong>
            <small>
              {selectedLocation?.category === 'leave'
                ? 'Leave does not advance the trail or change your streak.'
                : 'Confirm your location before you continue.'}
            </small>
          </span>
          <Icon name="arrow" size={19} />
        </button>
      )}

      {confirmationOpen && selectedLocation && (
        <div
          className="petgame-location-confirmation-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeConfirmation();
          }}
        >
          <section
            className="petgame-location-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="petgame-location-confirmation-title"
            aria-describedby="petgame-location-confirmation-description"
          >
            <span className="petgame-location-confirmation-mark" aria-hidden="true">
              <Icon name="pin" size={22} />
            </span>
            <span className="petgame-eyebrow">LOCATION CHECK</span>
            <h2 id="petgame-location-confirmation-title">Will you be working here today?</h2>
            <p id="petgame-location-confirmation-description">
              You selected <strong>{selectedLocation.name}</strong>. Please confirm before continuing.
            </p>
            {confirmationError && <p className="petgame-confirmation-error" role="alert">{confirmationError}</p>}
            <div className="petgame-location-confirmation-actions">
              <button
                ref={positiveButtonRef}
                className="petgame-location-confirmation-positive"
                type="button"
                onClick={confirmLocation}
              >
                Positive
              </button>
              <button
                ref={backButtonRef}
                className="petgame-location-confirmation-back"
                type="button"
                onClick={closeConfirmation}
              >
                Go back
              </button>
            </div>
          </section>
        </div>
      )}

      {!formUrl && (
        <p className="petgame-connection-note">
          This is a React game interface designed to embed into your existing WordPress site. Set <code>PETGAME_ATTENDANCE_FORM_URL</code> when the Laravel form is ready.
        </p>
      )}
    </section>
  );
}
