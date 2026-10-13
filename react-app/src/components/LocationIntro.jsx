import { useEffect, useRef, useState } from 'react';
import { getGameAsset } from '../assets';
import { playSoundCue } from '../sound';

export default function LocationIntro({ onComplete, soundEnabled = true, soundStarted = false }) {
  const [phase, setPhase] = useState('drop');
  const audioRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    const finish = () => setPhase('fade');
    const audioUrl = soundEnabled ? getGameAsset('locationIntroAudio') : null;
    const dropTimer = window.setTimeout(() => {
      setPhase('audio');
      if (!audioUrl) {
        if (!soundStarted) playSoundCue('intro', soundEnabled);
        timersRef.current.push(window.setTimeout(finish, 1800));
        return;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.addEventListener('ended', finish, { once: true });
      audio.play().catch(() => {
        console.warn('[petgame] Could not play the location intro audio asset.');
        playSoundCue('intro', soundEnabled);
        timersRef.current.push(window.setTimeout(finish, 1800));
      });
      timersRef.current.push(window.setTimeout(finish, 7000));
    }, 1050);
    timersRef.current.push(dropTimer);

    return () => {
      timersRef.current.forEach(window.clearTimeout);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [soundEnabled, soundStarted]);

  useEffect(() => {
    if (phase !== 'fade') return undefined;
    const timer = window.setTimeout(onComplete, 520);
    return () => window.clearTimeout(timer);
  }, [onComplete, phase]);

  const logo = getGameAsset('locationIntroLogo');

  return (
    <div className={`petgame-location-intro is-${phase}`} role="status" aria-label="Welcome to the attendance board">
      <div className="petgame-location-intro-logo">
        {logo ? (
          <img src={logo} alt="Let's Play Attendance Board" />
        ) : (
          <div className="petgame-location-intro-placeholder" aria-label="Logo placeholder">
            <span>LET&apos;S PLAY</span>
            <strong>ATTENDANCE<br />BOARD</strong>
          </div>
        )}
      </div>
    </div>
  );
}