const SPACES = [
  { x: 322, y: 58 },
  { x: 399, y: 102 },
  { x: 399, y: 191 },
  { x: 322, y: 235 },
  { x: 245, y: 191 },
  { x: 245, y: 102 },
];

function diamondPoints(x, y, raised = 0) {
  return `${x},${y - 25 - raised} ${x + 45},${y - raised} ${x},${y + 25 - raised} ${x - 45},${y - raised}`;
}

export default function IsoAttendanceBoard({ stepCount, locations, selectedId, onSelectLocation }) {
  const boundedStep = Math.max(0, Math.min(6, stepCount));
  const landmarks = locations.map((location, index) => {
    const spaceIndex = locations.length === 1
      ? 0
      : Math.round(index * (SPACES.length - 1) / Math.max(1, locations.length - 1));
    return { ...location, spaceIndex };
  });
  const selectedLandmark = landmarks.find((location) => location.id === selectedId);
  const tokenSpaceIndex = selectedLandmark?.spaceIndex ?? Math.min(boundedStep, SPACES.length - 1);
  const tokenPosition = SPACES[tokenSpaceIndex];

  return (
    <div className="petgame-iso-board-shell">
      <svg
        className="petgame-iso-board"
        viewBox="0 0 644 326"
        role="group"
        aria-label={`Isometric weekly attendance board. ${boundedStep} of 6 steps completed.`}
      >
        <defs>
          <linearGradient id="petgame-board-ground" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#fff7f1" />
            <stop offset="1" stopColor="#f6ded5" />
          </linearGradient>
          <filter id="petgame-board-shadow" x="-30%" y="-30%" width="160%" height="190%">
            <feDropShadow dx="0" dy="12" stdDeviation="8" floodColor="#61352d" floodOpacity="0.16" />
          </filter>
          <filter id="petgame-token-shadow" x="-60%" y="-60%" width="220%" height="240%">
            <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#4d1710" floodOpacity="0.25" />
          </filter>
        </defs>

        <ellipse className="petgame-board-ground-shadow" cx="322" cy="179" rx="276" ry="119" />
        <g filter="url(#petgame-board-shadow)">
          <polygon className="petgame-board-plinth-side" points="322,30 590,144 590,162 322,298 54,162 54,144" />
          <polygon className="petgame-board-plinth-top" points="322,12 590,144 322,280 54,144" />
        </g>
        <polygon className="petgame-board-inner" points="322,47 519,144 322,245 125,144" />
        <path className="petgame-board-route" d="M322 58 399 102V191L322 235 245 191V102L322 58Z" />

        {SPACES.map((space, index) => {
          const completed = index < boundedStep;
          const current = index === boundedStep && boundedStep < 6;
          const landmark = landmarks.find((item) => item.spaceIndex === index);
          const selected = landmark && landmark.id === selectedId;
          const spaceClass = `petgame-iso-space${completed ? ' is-complete' : ''}${current ? ' is-current' : ''}${landmark ? ' is-landmark' : ''}${selected ? ' is-selected' : ''}`;

          return (
            <g
              className={spaceClass}
              key={index}
              role={landmark ? 'button' : undefined}
              tabIndex={landmark ? 0 : undefined}
              aria-label={landmark ? `Choose ${landmark.name} for attendance` : `Trail space ${index + 1}${completed ? ', complete' : ''}`}
              aria-pressed={landmark ? Boolean(selected) : undefined}
              onClick={landmark ? () => onSelectLocation(landmark.id) : undefined}
              onKeyDown={landmark ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectLocation(landmark.id);
                }
              } : undefined}
            >
              <polygon className="petgame-iso-space-front" points={`${space.x - 45},${space.y} ${space.x},${space.y + 25} ${space.x + 45},${space.y} ${space.x + 45},${space.y + 12} ${space.x},${space.y + 38} ${space.x - 45},${space.y + 12}`} />
              <polygon className="petgame-iso-space-top" points={diamondPoints(space.x, space.y, 0)} />
              {index !== tokenSpaceIndex && (
                <text className="petgame-iso-space-number" x={space.x} y={space.y + 4}>{String(index + 1).padStart(2, '0')}</text>
              )}
              {landmark && index !== tokenSpaceIndex && (
                <g className="petgame-iso-landmark">
                  <circle cx={space.x} cy={space.y - 4} r="13" />
                  <g transform={`translate(${space.x - 8} ${space.y - 12})`}>
                    <path d="M13 7.5c0 4-5 9.5-5 9.5s-5-5.5-5-9.5a5 5 0 1 1 10 0Z" />
                    <circle cx="8" cy="7.5" r="1.5" />
                  </g>
                </g>
              )}
            </g>
          );
        })}

        <g
          className="petgame-iso-token"
          filter="url(#petgame-token-shadow)"
          style={{ transform: `translate(${tokenPosition.x}px, ${tokenPosition.y - 3}px)` }}
          aria-hidden="true"
        >
          <ellipse cx="0" cy="10" rx="21" ry="6" />
          <path className="petgame-iso-token-base" d="M-19 1C-23 2-23 7-19 9C-9 14 9 14 19 9C23 7 23 2 19 1L14-2H-14Z" />
          <path className="petgame-iso-token-base-top" d="M-15-2C-12-5 12-5 15-2C17 1 12 3 0 3S-17 1-15-2Z" />
          <path className="petgame-iso-token-body" d="M-10-1C-7-7-5-11-7-16C-10-23-6-29 0-30C6-29 10-23 7-16C5-11 7-7 10-1C4 2-4 2-10-1Z" />
          <path className="petgame-iso-token-face" d="M-9-27-12-41-4-36 0-48 4-36 12-41 9-27C14-23 15-17 13-12C11-6 6-4 0-4S-11-6-13-12C-15-17-14-23-9-27Z" />
          <path className="petgame-iso-token-face-detail" d="M-5-19v2m10-2v2m-5 4-2 2h4l-2-2m-4 5c2 2 6 2 8 0" />
        </g>
      </svg>
      <p className="petgame-iso-board-note">YOUR WEEKLY TRAIL · RESETS MONDAY</p>
      <div className="petgame-board-legend">
        <span><i className="petgame-legend-current" />Your token</span>
        <span><i className="petgame-legend-check" />On-time attendance moves one space</span>
      </div>
    </div>
  );
}
