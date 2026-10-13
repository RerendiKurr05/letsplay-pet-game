import { getGameAsset } from '../assets';

const PATHS = {
  board: <><path d="m4 8 8-4 8 4-8 4-8-4Z" /><path d="m4 8 8 4 8-4M4 12l8 4 8-4M4 16l8 4 8-4" /></>,
  pet: <><path d="M7 12 5 5l7 4 7-4-2 7" /><path d="M6 12c0 6 2 9 6 9s6-3 6-9" /><path d="M9 14h.01M15 14h.01M10 18c1.2 1 2.8 1 4 0" /></>,
  rank: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v2a4 4 0 0 0 4 4m7-6h3v2a4 4 0 0 1-4 4M12 13v5m-4 2h8m-6-2h4" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  points: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5c-.6-.7-1.5-1-2.7-1-1.5 0-2.5.7-2.5 1.8 0 2.8 5.5 1.1 5.5 4.4 0 1.3-1.2 2.2-3 2.2-1.2 0-2.3-.4-3-1.2M12 5.5v13" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  card: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8m-8 4h5" /><path d="M7 3h12a2 2 0 0 1 2 2v12" /></>,
  star: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  body: <><circle cx="12" cy="7" r="3" /><path d="M6 20v-2a6 6 0 0 1 12 0v2" /></>,
  outfit: <><path d="m8 5-4 3 3 4 2-1v9h6v-9l2 1 3-4-4-3-2 2h-4L8 5Z" /></>,
  hanger: <><path d="M12 5a2 2 0 0 0-2 2" /><path d="M10 7a2 2 0 1 1 3.4 1.4L12 10l8 5.2a1 1 0 0 1-.5 1.8h-15a1 1 0 0 1-.5-1.8L12 10" /></>,
  eyes: <><path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2" /></>,
  hair: <><path d="M5 14V9a7 7 0 0 1 14 0v5m-14 0c2-1 3-3 3-5 2 2 4 3 7 3 2 0 4-1 5-2" /></>,
  accessory: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></>,
  sound: <><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="M17 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" /></>,
  mute: <><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="m17 9 5 6m0-6-5 6" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  back: <><path d="M19 12H5m7 7-7-7 7-7" /></>,
};

export default function Icon({ name, size = 20, className = '' }) {
  const asset = getGameAsset('icons', name);
  if (asset) {
    return (
      <img
        className={className}
        src={asset}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
      />
    );
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
