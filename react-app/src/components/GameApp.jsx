import { useCallback, useEffect, useRef, useState } from 'react';
import { PetGameAPI } from '../api';
import BoardScreen from './BoardScreen';
import Icon from './Icon';
import LeaderboardScreen from './LeaderboardScreen';
import LocationIntro from './LocationIntro';
import PetScreen from './PetScreen';
import PointsTransition from './PointsTransition';
import { getGameAsset, getGameThemeStyle } from '../assets';
import { playSoundCue, readSoundPreference, setBackgroundMusicEnabled } from '../sound';
import useLiveRefresh from '../hooks/useLiveRefresh';

const NAVIGATION = [
  { id: 'board', label: 'Board', icon: 'board' },
  { id: 'pet', label: 'Pet', icon: 'pet' },
  { id: 'rank', label: 'Rank', icon: 'rank' },
];

function getLocalDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getLocationIntroKey() {
  return `petgame-location-intro:${getLocalDateKey()}`;
}

function getDemoAttendance() {
  const stored = window.localStorage.getItem(`petgame-demo-attendance:${getLocalDateKey()}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Ignoring invalid saved attendance preview state.', error);
    return null;
  }
}

export default function GameApp() {
  const [activeView, setActiveView] = useState('board');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [showTransition, setShowTransition] = useState(false);
  const [attendanceReturnPending, setAttendanceReturnPending] = useState(false);
  const [demoAttendance, setDemoAttendance] = useState(getDemoAttendance);
  const [locationIntroActive, setLocationIntroActive] = useState(
    () => window.localStorage.getItem(getLocationIntroKey()) !== 'played',
  );
  const [locationIntroReplayKey, setLocationIntroReplayKey] = useState(0);
  const [locationIntroSoundStarted, setLocationIntroSoundStarted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference);
  const attendanceReturnRef = useRef(
    new URL(window.location.href).searchParams.get('petgame_return') === 'attendance',
  );

  function clearAttendanceReturnFlag() {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.delete('petgame_return');
    window.history.replaceState(
      window.history.state,
      '',
      `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`,
    );
    attendanceReturnRef.current = false;
  }

  async function refreshSummary({ quiet = false } = {}) {
    if (!quiet && !summary) setSummaryLoading(true);
    try {
      const nextSummary = await PetGameAPI.getGameSummary();
      setSummary(nextSummary);
      setSummaryError(null);
      if (attendanceReturnRef.current && nextSummary?.today_checkin) {
        setActiveView('board');
        setShowTransition(true);
        setAttendanceReturnPending(false);
        clearAttendanceReturnFlag();
      }
      return nextSummary;
    } catch (error) {
      setSummaryError(error.message);
      return null;
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    refreshSummary();
  }, []);

  useEffect(() => {
    if (!attendanceReturnRef.current) return undefined;

    let stopped = false;
    let attempts = 0;
    setAttendanceReturnPending(true);

    async function refreshUntilRecorded() {
      const nextSummary = await refreshSummary({ quiet: true });
      if (stopped) return;

      if (nextSummary?.today_checkin) {
        return;
      }

      attempts += 1;
      if (attempts >= 20) {
        setAttendanceReturnPending(false);
        setSummaryError('Your attendance record is still syncing. Refresh the page to check again.');
        return;
      }

      timer = window.setTimeout(refreshUntilRecorded, 1500);
    }

    let timer = window.setTimeout(refreshUntilRecorded, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  useLiveRefresh(refreshSummary);

  function navigateTo(view) {
    setShowTransition(false);
    setActiveView(view);
    if (view === 'board') {
      refreshSummary();
      if (window.localStorage.getItem(getLocationIntroKey()) !== 'played') {
        setLocationIntroActive(true);
      }
    }
  }

  function replayLocationIntro() {
    const hasIntroAudio = Boolean(getGameAsset('locationIntroAudio'));
    const playedSound = soundEnabled && !hasIntroAudio;
    if (playedSound) playSoundCue('intro', true);
    navigateTo('board');
    setLocationIntroActive(true);
    setLocationIntroReplayKey((key) => key + 1);
    setLocationIntroSoundStarted(playedSound);
  }

  function openAttendanceTransition() {
    setShowTransition(true);
  }

  function recordDemoAttendance(location) {
    const checkin = {
      checkin_date: getLocalDateKey(),
      on_time: true,
      attendance_type: location.category === 'leave' ? 'leave' : 'checkin',
      points_awarded: location.category === 'leave' ? 0 : 18,
      location_name: location.name,
      mood_meter: 48,
      streak_count: 3,
      is_demo: true,
    };
    const demo = {
      checkin,
      lifetime_points: Number(summary?.lifetime_points || 0) + checkin.points_awarded,
      weekly_steps: Math.min(
        6,
        Number(summary?.weekly_steps || 0) + (checkin.attendance_type === 'leave' ? 0 : 1),
      ),
    };
    window.localStorage.setItem(`petgame-demo-attendance:${getLocalDateKey()}`, JSON.stringify(demo));
    setDemoAttendance(demo);
    setShowTransition(true);
  }

  const completeLocationIntro = useCallback(() => {
    window.localStorage.setItem(getLocationIntroKey(), 'played');
    setLocationIntroActive(false);
    setLocationIntroSoundStarted(false);
  }, []);

  function toggleSound() {
    const nextEnabled = !soundEnabled;
    window.localStorage.setItem('petgame-sound', nextEnabled ? 'on' : 'off');
    setSoundEnabled(nextEnabled);
    setBackgroundMusicEnabled(nextEnabled);
    playSoundCue('toggle', nextEnabled);
  }

  const userName = window.petgameConfig?.currentUser?.name;
  const formUrl = window.petgameConfig?.attendanceFormUrl || '';
  const dashboardUrl = window.petgameConfig?.dashboardUrl || '';
  const logoAsset = getGameAsset('logo');
  const displaySummary = summary?.today_checkin || !demoAttendance
    ? summary
    : {
      ...summary,
      today_checkin: demoAttendance.checkin,
      lifetime_points: demoAttendance.lifetime_points,
      weekly_steps: demoAttendance.weekly_steps,
    };

  return (
    <div className="petgame-shell" style={getGameThemeStyle()}>
      <header className="petgame-header">
        <button
          className="petgame-wordmark"
          type="button"
          aria-label="Replay attendance board intro"
          title="Replay attendance board intro"
          onClick={replayLocationIntro}
        >
          <span className="petgame-wordmark-mark">
            {logoAsset ? <img src={logoAsset} alt="" /> : <Icon name="board" size={18} />}
          </span>
          <span>LET&apos;S PLAY <small>ATTENDANCE GAME</small></span>
        </button>
        <div className="petgame-account">
          <button
            className="petgame-sound-toggle"
            type="button"
            aria-label={soundEnabled ? 'Turn sound off' : 'Turn sound on'}
            aria-pressed={soundEnabled}
            title={soundEnabled ? 'Sound on' : 'Sound off'}
            onClick={toggleSound}
          >
            <Icon name={soundEnabled ? 'sound' : 'mute'} size={17} />
          </button>
          <span className="petgame-account-avatar"><Icon name="pet" size={17} /></span>
          <span>{userName || 'Player'}</span>
        </div>
      </header>

      <div className={`petgame-content${activeView === 'pet' && !showTransition ? ' petgame-content-pet' : ''}`}>
        {showTransition && displaySummary?.today_checkin ? (
          <PointsTransition
            checkin={displaySummary.today_checkin}
            summary={displaySummary}
            dashboardUrl={dashboardUrl}
            soundEnabled={soundEnabled}
            onContinueToLocation={() => navigateTo('board')}
            onContinueToPet={() => navigateTo('pet')}
          />
        ) : activeView === 'board' ? (
          <BoardScreen
            summary={displaySummary}
            loading={summaryLoading}
            error={summaryError}
            formUrl={formUrl}
            soundEnabled={soundEnabled}
            onRefresh={refreshSummary}
            onShowTransition={openAttendanceTransition}
            onDemoAttendance={recordDemoAttendance}
            attendanceReturnPending={attendanceReturnPending}
          />
        ) : activeView === 'pet' ? (
          <PetScreen soundEnabled={soundEnabled} />
        ) : (
          <LeaderboardScreen soundEnabled={soundEnabled} />
        )}
      </div>

      {locationIntroActive && activeView === 'board' && !showTransition && (
        <LocationIntro
          key={locationIntroReplayKey}
          onComplete={completeLocationIntro}
          soundEnabled={soundEnabled}
          soundStarted={locationIntroSoundStarted}
        />
      )}

      <nav className="petgame-bottom-nav" aria-label="Game navigation">
        {NAVIGATION.map(({ id, label, icon }) => (
          <button
            className={activeView === id && !showTransition ? 'active' : ''}
            key={id}
            type="button"
            aria-current={activeView === id && !showTransition ? 'page' : undefined}
            onClick={() => {
              if (activeView !== id || showTransition) playSoundCue('navigation', soundEnabled);
              navigateTo(id);
            }}
          >
            <Icon name={icon} size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
