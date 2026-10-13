// Every call from the React app to WordPress goes through this file.
// Notice there's no "login" step here — the user is already logged into
// WordPress (that's how they reached this page at all), and the nonce
// WordPress handed us via window.petgameConfig is what proves that to
// the REST API on every request.

const MOCK_MODE = !window.petgameConfig || window.petgameConfig.apiRoot.includes('mock');
const MOCK_STORAGE_KEY = 'petgame-dev-state';
const MOCK_DEFAULT_STATE = {
  pet_name: 'Momo',
  pet_type: 'mascot',
  mascot_id: 'default',
  custom_parts: null,
  avatar_parts: null,
  mood_meter: 48,
  mood_state: 'neutral',
  streak_count: 3,
  lifetime_points: 1240,
  attendance_points: 426,
  card_unlocked: true,
  card_drawn_today: false,
  todays_card: null,
};

// --- Mock data, used only when running `npm run dev` without a real
// WordPress backend behind it. Mirrors the exact shape the real PHP
// endpoints return (see includes/class-petgame-rest-api.php).
let mockState = MOCK_MODE ? loadMockState() : { ...MOCK_DEFAULT_STATE };
const mockWeeklySteps = 3;
function loadMockState() {
  const stored = window.localStorage.getItem(MOCK_STORAGE_KEY);
  if (!stored) return { ...MOCK_DEFAULT_STATE };

  try {
    return {
      ...MOCK_DEFAULT_STATE,
      ...JSON.parse(stored),
      mood_meter: MOCK_DEFAULT_STATE.mood_meter,
      mood_state: MOCK_DEFAULT_STATE.mood_state,
      card_drawn_today: false,
      todays_card: null,
    };
  } catch (error) {
    console.warn('Ignoring invalid saved Pet Game preview state.', error);
    return { ...MOCK_DEFAULT_STATE };
  }
}

function persistMockState() {
  window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockState));
}

async function request(path, options = {}) {
  if (MOCK_MODE) {
    return mockRequest(path, options);
  }

  const res = await fetch(window.petgameConfig.apiRoot + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': window.petgameConfig.nonce, // <-- this is the auth
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Simulates the PHP logic client-side so the UI is fully clickable in
// local dev. This duplication is intentional and fine for a mock — it
// should NEVER be trusted as the real rules; includes/petgame-formulas.php
// is the single source of truth once this is wired to WordPress for real.
function mockRequest(path, options) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (path === 'pet' && (!options.method || options.method === 'GET')) {
        return resolve({ ...mockState });
      }

      if (path === 'game/summary') {
        return resolve({
          lifetime_points: mockState.lifetime_points,
          weekly_steps: mockWeeklySteps,
          max_steps: 6,
          today_checkin: null,
          locations: [
            { id: 'kolektiv-space', name: 'Kolektiv Space', category: 'wfo' },
            { id: 'mcc', name: 'MCC', category: 'wfo' },
            { id: 'wfh', name: 'WFH', category: 'wfh' },
            { id: 'off-site', name: 'Off Site', category: 'offsite' },
            { id: 'leave', name: 'Sick or Other Leave', category: 'leave' },
          ],
        });
      }

      if (path === 'leaderboard') {
        return resolve({
          entries: [
            { rank: 1, user_id: 7, name: 'Alya', points: 1560, is_current_user: false },
            { rank: 2, user_id: 9, name: 'Rafi', points: 1410, is_current_user: false },
            { rank: 3, user_id: 1, name: 'You', points: mockState.lifetime_points, is_current_user: true },
            { rank: 4, user_id: 4, name: 'Nadia', points: 990, is_current_user: false },
            { rank: 5, user_id: 6, name: 'Dimas', points: 840, is_current_user: false },
            { rank: 6, user_id: 3, name: 'Mira', points: 720, is_current_user: false },
            { rank: 7, user_id: 8, name: 'Bima', points: 640, is_current_user: false },
            { rank: 8, user_id: 5, name: 'Tara', points: 580, is_current_user: false },
          ],
        });
      }

      if (path === 'pet/customize') {
        const { target = 'pet', custom_parts } = JSON.parse(options.body);
        if (target === 'avatar') {
          mockState.avatar_parts = custom_parts;
          persistMockState();
          return resolve({ avatar_parts: custom_parts });
        }
        mockState.pet_type = 'custom';
        mockState.mascot_id = null;
        mockState.custom_parts = custom_parts;
        persistMockState();
        return resolve({
          pet_type: 'custom',
          mascot_id: null,
          custom_parts,
        });
      }

      if (path === 'pet/care') {
        const { action } = JSON.parse(options.body);
        const cost = { feed: 15, play: 10, clean: 5 }[action] ?? 0;
        mockState.mood_meter = Math.min(100, mockState.mood_meter + 12);
        mockState.lifetime_points -= cost;
        mockState.mood_state =
          mockState.mood_meter <= 33 ? 'sad' : mockState.mood_meter <= 66 ? 'neutral' : 'happy';
        persistMockState();
        return resolve({
          mood_meter: mockState.mood_meter,
          mood_state: mockState.mood_state,
          lifetime_points: mockState.lifetime_points,
        });
      }

      if (path === 'card/draw') {
        if (mockState.card_drawn_today) return reject(new Error('Come back tomorrow for your next draw.'));
        const unlocked = mockState.streak_count >= 3;
        const isBonus = unlocked && Math.random() < 0.15;
        const points = isBonus ? 20 : 0;
        mockState.lifetime_points += points;
        mockState.card_drawn_today = true;
        mockState.todays_card = {
          card_type: isBonus ? 'bonus' : 'quote',
          points_awarded: points,
        };
        persistMockState();
        return resolve({
          card_type: isBonus ? 'bonus' : 'quote',
          points_awarded: points,
          lifetime_points: mockState.lifetime_points,
        });
      }

      reject(new Error(`No mock handler for ${path}`));
    }, 300); // small delay so loading states are visible in dev too
  });
}

export const PetGameAPI = {
  getPetState: () => request('pet'),
  saveCustomization: (target, custom_parts) =>
    request('pet/customize', { method: 'POST', body: JSON.stringify({ target, custom_parts }) }),
  getGameSummary: () => request('game/summary'),
  getLeaderboard: () => request('leaderboard'),
  doCareAction: (action) =>
    request('pet/care', { method: 'POST', body: JSON.stringify({ action }) }),
  drawCard: () => request('card/draw', { method: 'POST' }),
};
