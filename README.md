# Let's Play — Attendance Game

A WordPress plugin with a React game interface for the attendance board, pet
hub, points transition, and lifetime leaderboard. The attendance form remains
in the separate Laravel application; Laravel sends finalized attendance
outcomes to this plugin through a timestamped HMAC-authenticated webhook.

## Game flow

1. **Location selector:** on first load, the board shows a pending attendance
   status, this week's six-step trail, and the available locations. WFO has
   Kolektiv Space and MCC; WFH, Off Site, and Sick or Other Leave are separate
   choices.
2. **Location confirmation:** Continue becomes available after a location is
   selected. Positive opens the configured Laravel attendance form with the
   selected location ID, category, and a return URL. Go back closes the prompt
   without discarding the selected location.
3. **Attendance form and return:** after successful form submission, Laravel
   must send the finalized attendance to the WordPress webhook and redirect
   the browser to the supplied `return_url`. The game refreshes the WordPress
   summary while the record syncs, then opens the existing points screen once
   today's record is available. Leave records do not change the attendance
   streak or advance the weekly trail.
4. **Points transition:** shows the attendance points, shared lifetime
   balance, weekly steps, and pet mood. The square back button returns to the
   location selector, while the main actions open the pet screen or the
   configured Dashboard. The Dashboard action uses the
   `petgame_dashboard_url` filter.
5. **Pet:** feed, play, and clean spend from the same points ledger. The daily
   card remains in the Goodie Center and uses an animated pull-and-reveal.
6. **Leaderboard:** ranks the shared lifetime point balance. The signed-in
   player's row is kept visible if it falls outside the top 50.

WordPress is the source of truth for game points and state. The React app
refreshes the game summary and pet state every 15 seconds while their screens
are open, refreshes the leaderboard every 30 seconds, and reloads current data
when the player returns to the tab. This is near-real-time polling rather than
a persistent WebSocket connection.

The weekly trail is an animated, six-space isometric board. Configured
attendance locations appear as selectable landmarks; recorded on-time
attendance advances the weekly marker. The Pet and Avatar studios compose
separate layered vector placeholders from body, outfit, eyes, hair, and
accessory options. Replace either illustration with your supplied assets when
ready; no uploaded artwork or cosmetics inventory is implied by the current
editor.

### Attendance preview and location intro

Until `PETGAME_ATTENDANCE_FORM_URL` is configured, selecting Positive records
a local proof-of-concept check-in for the current date, awards 18 preview
points, and opens the existing points screen. This is stored in browser
local storage only; it is not sent to WordPress and is replaced by the real
attendance flow when the form URL is configured. The location intro also uses
browser local storage and plays once per local calendar day.

Provide the final intro logo and short audio clip through the existing
`petgame_assets` filter:

```php
add_filter( 'petgame_assets', function ( $assets ) {
    $assets['locationIntroLogo'] = get_stylesheet_directory_uri() . '/assets/attendance-board-logo.png';
    $assets['locationIntroAudio'] = get_stylesheet_directory_uri() . '/assets/attendance-intro.mp3';
    return $assets;
} );
```

The fallback logo is a styled placeholder. Browsers can block intro audio
until the visitor interacts with the page; the intro continues if playback is
blocked. Points animate inside this React experience. The destination
Dashboard is an existing host-owned page, so its own points animation must be
implemented by that page's team.

The current visual style is a replaceable default, not a hard dependency.
Point the `petgame_assets` and `petgame_theme` WordPress filters at media in
your child theme or media library to replace artwork, sound effects, and
background music without editing the React components. Omitted assets keep
the original illustration and synthesized sound cues. Audio still follows
the player's sound toggle, and the preference is stored in local storage.

Animations honor the operating system's reduced-motion preference.

For example, add this to a small site plugin or your child theme's
`functions.php`, then replace the example URLs with your own uploaded assets:

```php
add_filter( 'petgame_assets', function () {
	$media = 'https://example.test/wp-content/uploads/pet-game/';

	return [
		'logo' => $media . 'game-mark.png',
		'petBackground' => $media . 'pet-room.webp',
		'petLayers' => [
			'body' => [ 'cream' => $media . 'body-cream.png' ],
			'outfit' => [ 'berry' => $media . 'outfit-berry.png' ],
			'eyes' => [ 'round' => $media . 'eyes-round.png' ],
			'hair' => [ 'tuft' => $media . 'hair-tuft.png' ],
			'accessory' => [ 'crown' => $media . 'crown.png' ],
		],
		'avatarLayers' => [
			'body' => [ 'cream' => $media . 'avatar-body-cream.png' ],
			'outfit' => [ 'berry' => $media . 'avatar-outfit-berry.png' ],
			'eyes' => [ 'round' => $media . 'avatar-eyes-round.png' ],
			'hair' => [ 'tuft' => $media . 'avatar-hair-tuft.png' ],
			'accessory' => [ 'crown' => $media . 'avatar-crown.png' ],
		],
		'shopItems' => [
			$media . 'shop-item-1.png',
			$media . 'shop-item-2.png',
		],
		'leaderboardBanner' => $media . 'leaderboard-background.webp',
		'leaderboardMascot' => $media . 'leaderboard-mascot.png',
		'leaderboardPlayerAvatar' => $media . 'player-avatar.png',
		'icons' => [
			'accessory' => $media . 'customize-icon.svg',
			'care-feed' => $media . 'feed-icon.svg',
			'care-play' => $media . 'play-icon.svg',
			'care-clean' => $media . 'clean-icon.svg',
			'rank' => $media . 'rank-icon.svg',
		],
		'sounds' => [
			'care' => $media . 'care.wav',
			'select' => $media . 'select.wav',
			'toggle' => $media . 'toggle.wav',
			'save' => $media . 'save.wav',
			'card-start' => $media . 'card-pull.wav',
			'card-reveal' => $media . 'card-reveal.wav',
			'rank-pop' => $media . 'rank-pop.wav',
			'checkin-complete' => $media . 'checkin-complete.wav',
			'confirm' => $media . 'confirm.wav',
			'intro' => $media . 'intro.wav',
			'navigation' => $media . 'navigation.wav',
			'drawer' => $media . 'drawer.wav',
			'tab' => $media . 'tab.wav',
		],
		'backgroundMusic' => $media . 'game-loop.mp3',
	];
} );

add_filter( 'petgame_theme', function () {
	return [
		'primary' => '#c62a1c',
		'ink' => '#330602',
		'surface' => '#fefefe',
		'background' => '#fffaf5',
		'soft' => '#fff1e7',
		'accent' => '#fadbd3',
	];
} );
```

The pet and avatar editors remain enabled when artwork is replaced. Configure
transparent PNG or SVG files under `petLayers` and `avatarLayers`, aligned to
the same 180 × 180 view box; each image replaces only its matching selectable
layer. Pet and avatar selections are saved separately for each signed-in user.
The leaderboard background and mascot are independent so the text remains
readable and either can be replaced alone. Sound-effect keys include `care`,
`select`, `toggle`, `save`, `card-start`, `card-reveal`, `rank-pop`,
`checkin-complete`, `confirm`, `intro`, `navigation`, `drawer`, and `tab`.
The rank-pop cue plays once for each leaderboard position gained, including
each displayed place passed during the initial rise.
Clicking the header wordmark replays the daily intro for quick testing.
Background music is looped at a quiet default level and starts after the player
enables sound; all effects respect the sound toggle.
Any shared UI icon can be overridden by its `icons` key; care icons use
`care-feed`, `care-play`, and `care-clean`. All slots are optional. The full
list and extension points are in `react-app/src/assets.js`,
`react-app/src/sound.js`, `react-app/src/components/Icon.jsx`, and
`includes/class-petgame-shortcode.php`. The CSS variables cover the main
palette; detailed layout, board art, and animation styling stay centralized
in `react-app/src/style.css`.

Avatar selections are saved per signed-in WordPress user. The editor's
allowlisted values are:

| Layer | Choices |
| --- | --- |
| Body | `cream`, `peach`, `mint`, `lavender` |
| Outfit | `berry`, `sky`, `sage`, `sunset` |
| Eyes | `round`, `spark`, `sleepy`, `starry` |
| Hair | `none`, `tuft`, `fringe`, `curl` |
| Accessory | `none`, `glasses`, `flower`, `crown`, `bow` |

## Attendance integration

The WordPress endpoint is:

```text
POST /wp-json/petgame/v1/webhook/checkin
Content-Type: application/json
X-Petgame-Timestamp: <Unix timestamp in seconds>
X-Petgame-Signature: sha256=<HMAC-SHA256 hex digest>
```

Example payload:

```json
{
  "wp_user_id": 42,
  "source_event_id": "presensi:815",
  "checkin_date": "2026-10-08",
  "on_time": true,
  "attendance_type": "checkin",
  "points_awarded": 18,
  "location_id": "3",
  "location_name": "Main Office"
}
```

Field mapping for the attendance app:

| Webhook field | Laravel value |
| --- | --- |
| `wp_user_id` | `presensi.id_user` (the matching WordPress user ID) |
| `source_event_id` | `"presensi:"` plus `presensi.id_presensi` |
| `checkin_date` | `presensi.tanggal`, in `YYYY-MM-DD` |
| `on_time` | `presensi.status_presensi === "Tepat Waktu"` after final approval |
| `attendance_type` | `leave` for approved sick/other leave; otherwise `checkin` |
| `points_awarded` | Final `presensi.point_didapat` |
| `location_id` | `presensi.id_lokasi`, or omit for WFH |
| `location_name` | Related `lokasiKantor.nama_lokasi`, or omit for WFH |

Send the event only after its attendance status and `point_didapat` are final.
Pending or unapproved late-attendance records should not be sent as final
events. The endpoint records one event per WordPress user and date. Retrying
the same attendance event returns `already_processed` and never adds its
points a second time. Its response contains the game mood, streak, and updated
lifetime points. `points_awarded` accepts a signed integer from -10000 to
10000 so the attendance app can send a finalized point adjustment as well as
a positive award. For a finalized late or absent workday, send `on_time: false`
and its final point value so the game can reset the attendance streak.
Approved leave is the exception: send `attendance_type: "leave"` with
`on_time: false` so the existing streak is preserved. Do not send absence
events for non-working days.

The sender signs the exact JSON bytes sent in the request. The signature is
`HMAC-SHA256(secret, timestamp + "." + raw_json_body)`, with the timestamp
header formatted as Unix seconds. WordPress compares signatures in constant
time and rejects timestamps more than five minutes old. Send only over HTTPS.
Each request must include a stable `source_event_id`; retries must reuse that
event ID and produce a fresh timestamp/signature. The unique attendance date
and event ID constraints prevent retries from awarding points twice.
The earlier `X-Petgame-Secret` bearer-header format is no longer accepted;
deploy the Laravel sender and this receiver's HMAC change together.

Configure a random secret of at least 32 characters on both servers. Generate
one with `openssl rand -hex 32`. In `wp-config.php`:

```php
define( 'PETGAME_WEBHOOK_SECRET', 'put-a-generated-64-character-secret-here' );
define( 'PETGAME_ATTENDANCE_FORM_URL', 'https://attendance.example.test/presensi-test' );
```

Do not commit a real secret. Configure Laravel with server environment
variables, not values exposed to browser JavaScript.

In Laravel `config/services.php`, add:

```php
'petgame' => [
    'webhook_url' => env('PETGAME_WEBHOOK_URL'),
    'secret' => env('PETGAME_WEBHOOK_SECRET'),
],
```

Then configure its server-only `.env`:

```dotenv
PETGAME_WEBHOOK_URL=https://your-wordpress-site.example/wp-json/petgame/v1/webhook/checkin
PETGAME_WEBHOOK_SECRET=the-same-generated-64-character-secret
```

The React app passes the selected `location_id`, `location_category`, and the
logged-in WordPress page URL as `return_url`, with
`petgame_return=attendance` added. The Laravel app must validate that
destination against the configured WordPress origin before redirecting; do
not accept arbitrary `return_url` values as open redirects. Send the signed
attendance webhook before redirecting so the WordPress summary is available
when the game resumes. The current Laravel `PresensiController::store`
returns JSON, and the current `presensi-test` form does not read the location
query parameters or perform a return redirect. The attendance team will need
to map the selected location into its form, send the signed webhook, and then
redirect after a successful submission.

The optional Dashboard action on the points screen is supplied by the host
WordPress site once the team's route is ready:

```php
add_filter( 'petgame_dashboard_url', function () {
	return 'https://your-site.example/dashboard';
} );
```

Replace the example URL with the actual dashboard route. The game does not
create a dashboard page.

### Location list

The real Laravel locations should be surfaced by the host site with the
`petgame_locations` filter. IDs must match the attendance form's accepted
location values. Each choice also has a category; locations named Kolektiv
Space or MCC are recognized as `wfo`, WFH as `wfh`, Off Site as `offsite`,
and Sick or Other Leave as `leave`. Set categories explicitly when adding
locations:

```php
add_filter( 'petgame_locations', function () {
	return [
		[ 'id' => '1', 'name' => 'Kolektiv Space', 'category' => 'wfo' ],
		[ 'id' => '2', 'name' => 'MCC', 'category' => 'wfo' ],
		[ 'id' => 'wfh', 'name' => 'WFH', 'category' => 'wfh' ],
		[ 'id' => 'offsite', 'name' => 'Off Site', 'category' => 'offsite' ],
		[ 'id' => 'leave', 'name' => 'Sick or Other Leave', 'category' => 'leave' ],
	];
} );
```

Replace the examples with the active locations from the attendance app. The
office IDs must be replaced with the real IDs. The Laravel form must accept
the `location_category` query parameter. It should process `leave` separately
from check-ins and send `attendance_type: "leave"` plus `on_time: false` to
the webhook for a finalized leave event. The game persists the leave record
without changing mood, attendance streak, or weekly trail. If the form URL or
locations have not been configured, the screen explains that location choices
are unavailable.

### Laravel sender example

Call the WordPress endpoint from the server after the attendance transaction
commits. The request should be made from a queued job with retries; the
WordPress user ID must match the attendee's shared account ID.

```php
use Illuminate\Support\Facades\Http;

$payload = [
    'wp_user_id' => $presensi->id_user,
    'source_event_id' => 'presensi:' . $presensi->id_presensi,
    'checkin_date' => date('Y-m-d', strtotime($presensi->tanggal)),
    'on_time' => $presensi->attendance_type !== 'leave'
        && $presensi->status_presensi === 'Tepat Waktu',
    'attendance_type' => $presensi->attendance_type === 'leave' ? 'leave' : 'checkin',
    'points_awarded' => (int) $presensi->point_didapat,
    'location_id' => $presensi->id_lokasi,
    'location_name' => $presensi->lokasiKantor?->nama_lokasi,
];

$body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
$timestamp = (string) now()->timestamp;
$signature = hash_hmac(
    'sha256',
    $timestamp . '.' . $body,
    config('services.petgame.secret')
);

$response = Http::withHeaders([
    'X-Petgame-Timestamp' => $timestamp,
    'X-Petgame-Signature' => 'sha256=' . $signature,
])->withBody($body, 'application/json')
    ->post(config('services.petgame.webhook_url'));

$response->throw();
```

The supplied `attendance-letsplay` repository currently has the attendance
and points tables but no check-in submission route or delivery job. The
snippet above describes the sender contract; it must be added to the Laravel
application and adapted to its final approval/transaction flow before live
check-ins can reach WordPress.

## Local preview and production build

Run the standalone React preview using mock data:

```bash
cd react-app
npm install
npm run dev
```

Build the WordPress assets:

```bash
cd react-app
npm run build
```

Vite writes `assets/build/app.js` and `assets/build/app.css`, which the
`[petgame_app]` shortcode loads.

## Install in WordPress

1. Copy this plugin directory into `wp-content/plugins/`.
2. Configure `PETGAME_WEBHOOK_SECRET`, `PETGAME_ATTENDANCE_FORM_URL`, and
   the `petgame_locations` filter.
3. Activate the plugin. Existing installs create the attendance-event table
   automatically when the plugin version changes.
4. Add `[petgame_app]` to a page accessible to signed-in users.
5. Configure the Laravel sender and verify the webhook using a non-production
   attendee before enabling real rewards.

## Handoff checklist

The React interface and WordPress plugin are ready for visual asset
replacement and local preview. Before enabling real attendance rewards, the
site owner and Laravel team still need to:

1. Set `PETGAME_ATTENDANCE_FORM_URL`, `PETGAME_WEBHOOK_SECRET`, and the
   `petgame_locations` entries for the real deployment.
2. Implement the Laravel request to WordPress's check-in webhook only after
   the attendance record is finalized, using a stable `source_event_id` so
   retries cannot award points twice.
3. Confirm the WordPress user-ID mapping, attendance approval/leave rules,
   point-award policy, and test the end-to-end flow with a non-production
   account.
4. Upload artwork/audio to WordPress Media Library or the child theme, wire
   the URLs through `petgame_assets`, and check them on a phone-sized viewport.

Until those integration values and the Laravel sender are configured, the
development preview uses mock data and the attendance flow is not live. The
complete artwork keys are the quickest handoff for a static character image;
use the layer keys when the Pet/Avatar studios should remain customizable.

## REST routes

| Route | Purpose |
| --- | --- |
| `GET /wp-json/petgame/v1/pet` | Signed-in player's pet, mood, streak, and points |
| `POST /wp-json/petgame/v1/pet/customize` | Save the signed-in player's avatar layers |
| `GET /wp-json/petgame/v1/game/summary` | Weekly trail, configured locations, and today's attendance |
| `GET /wp-json/petgame/v1/leaderboard` | Lifetime-points rankings |
| `POST /wp-json/petgame/v1/pet/care` | Feed, play, or clean |
| `POST /wp-json/petgame/v1/card/draw` | Draw the daily card |
| `POST /wp-json/petgame/v1/webhook/checkin` | Receive finalized Laravel attendance |
