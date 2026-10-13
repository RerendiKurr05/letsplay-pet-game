<?php
/**
 * The API the React app talks to. This is a NORMAL authenticated REST API —
 * the React app calls these routes the same way it would call any backend.
 * Auth here uses WordPress's own logged-in cookie + nonce, since the user
 * is already logged into the WordPress site (see react-app/src/api.js for
 * how the nonce gets passed from PHP to JS).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Petgame_REST_API {

	public static function register_routes() {
		add_action( 'rest_api_init', function () {

			register_rest_route( 'petgame/v1', '/pet', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_pet_state' ],
				'permission_callback' => [ __CLASS__, 'require_login' ],
			] );

			register_rest_route( 'petgame/v1', '/pet/customize', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'save_customization' ],
				'permission_callback' => [ __CLASS__, 'require_login' ],
			] );

			register_rest_route( 'petgame/v1', '/game/summary', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_game_summary' ],
				'permission_callback' => [ __CLASS__, 'require_login' ],
			] );

			register_rest_route( 'petgame/v1', '/leaderboard', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_leaderboard' ],
				'permission_callback' => [ __CLASS__, 'require_login' ],
			] );

			register_rest_route( 'petgame/v1', '/pet/care', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'do_care_action' ],
				'permission_callback' => [ __CLASS__, 'require_login' ],
				'args' => [
					'action' => [ 'required' => true, 'type' => 'string' ], // feed | play | clean
				],
			] );

			register_rest_route( 'petgame/v1', '/card/draw', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'draw_card' ],
				'permission_callback' => [ __CLASS__, 'require_login' ],
			] );
		} );
	}

	public static function require_login() {
		return is_user_logged_in();
	}

	/** GET /pet — everything the Pet screen needs in one call. */
	public static function get_pet_state( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		$pet     = Petgame_DB::get_or_create_pet( $user_id );
		$points  = Petgame_DB::get_lifetime_points( $user_id );
		$today_card = Petgame_DB::get_todays_card( $user_id );

		return new WP_REST_Response( [
			'pet_name'     => $pet->pet_name,
			'pet_type'     => $pet->pet_type,
			'mascot_id'    => $pet->mascot_id,
			'custom_parts' => $pet->custom_parts ? json_decode( $pet->custom_parts ) : null,
			'avatar_parts' => get_user_meta( $user_id, 'petgame_avatar_parts', true ) ?: null,
			'mood_meter'   => (int) $pet->mood_meter,
			'mood_state'   => Petgame_Formulas::mood_state( (int) $pet->mood_meter ),
			'streak_count' => (int) $pet->streak_count,
			'lifetime_points' => $points,
			'attendance_points' => Petgame_DB::get_attendance_points( $user_id ),
			'card_unlocked'   => (int) $pet->streak_count >= Petgame_Formulas::CARD_UNLOCK_STREAK,
			'card_drawn_today' => (bool) $today_card,
			'todays_card'      => $today_card,
		], 200 );
	}

	/** POST /pet/customize — save layered pet or player avatar selections. */
	public static function save_customization( WP_REST_Request $request ) {
		global $wpdb;

		$target = $request->get_param( 'target' );
		if ( null === $target || '' === $target ) {
			$target = 'pet';
		}
		if ( ! in_array( $target, [ 'pet', 'avatar' ], true ) ) {
			return new WP_Error( 'invalid_customization_target', 'Choose either the pet or avatar customization.', [ 'status' => 400 ] );
		}

		$parts = $request->get_param( 'custom_parts' );
		$options = [
			'body'      => [ 'cream', 'peach', 'mint', 'lavender' ],
			'outfit'    => [ 'berry', 'sky', 'sage', 'sunset' ],
			'eyes'      => [ 'round', 'spark', 'sleepy', 'starry' ],
			'hair'      => [ 'none', 'tuft', 'fringe', 'curl' ],
			'accessory' => [ 'none', 'glasses', 'flower', 'crown', 'bow' ],
		];

		if ( ! is_array( $parts ) ) {
			return new WP_Error( 'invalid_custom_parts', 'custom_parts must be an object of avatar layer choices.', [ 'status' => 400 ] );
		}

		$clean_parts = [];
		foreach ( $options as $layer => $allowed_values ) {
			if ( ! isset( $parts[ $layer ] ) || ! is_string( $parts[ $layer ] ) || ! in_array( $parts[ $layer ], $allowed_values, true ) ) {
				return new WP_Error( 'invalid_avatar_layer', 'Invalid selection for avatar layer: ' . $layer, [ 'status' => 400 ] );
			}
			$clean_parts[ $layer ] = $parts[ $layer ];
		}

		$user_id = get_current_user_id();
		if ( 'avatar' === $target ) {
			update_user_meta( $user_id, 'petgame_avatar_parts', $clean_parts );

			return new WP_REST_Response( [
				'avatar_parts' => $clean_parts,
			], 200 );
		}

		Petgame_DB::get_or_create_pet( $user_id );
		$saved = $wpdb->update(
			$wpdb->prefix . 'petgame_pets',
			[
				'pet_type'     => 'custom',
				'mascot_id'    => null,
				'custom_parts' => wp_json_encode( $clean_parts ),
			],
			[ 'user_id' => $user_id ],
			[ '%s', '%s', '%s' ],
			[ '%d' ]
		);

		if ( false === $saved ) {
			return new WP_Error( 'customization_save_failed', 'Unable to save your avatar customization.', [ 'status' => 500 ] );
		}

		return new WP_REST_Response( [
			'pet_type'     => 'custom',
			'mascot_id'    => null,
			'custom_parts' => $clean_parts,
		], 200 );
	}

	/** GET /game/summary — shared points, weekly trail, and today's event. */
	public static function get_game_summary( WP_REST_Request $request ) {
		$user_id = get_current_user_id();

		return new WP_REST_Response( [
			'lifetime_points' => Petgame_DB::get_lifetime_points( $user_id ),
			'weekly_steps'    => Petgame_DB::get_weekly_steps( $user_id ),
			'max_steps'       => 6,
			'today_checkin'   => Petgame_DB::get_todays_checkin( $user_id ),
			'locations'       => self::get_attendance_locations(),
		], 200 );
	}

	/** GET /leaderboard — lifetime point balances; current user is pinned. */
	public static function get_leaderboard( WP_REST_Request $request ) {
		$entries = Petgame_DB::get_leaderboard( get_current_user_id() );
		if ( is_wp_error( $entries ) ) {
			return $entries;
		}

		return new WP_REST_Response( [ 'entries' => $entries ], 200 );
	}

	/**
	 * Locations can be synchronized from the attendance service by the host
	 * site without coupling this plugin to that service's database.
	 */
	private static function get_attendance_locations() {
		$locations = apply_filters( 'petgame_locations', [] );
		if ( ! is_array( $locations ) ) {
			return [];
		}

		$clean_locations = [];
		foreach ( $locations as $location ) {
			if ( ! is_array( $location ) || ! isset( $location['id'], $location['name'] ) ) {
				continue;
			}

			$id   = sanitize_text_field( (string) $location['id'] );
			$name = sanitize_text_field( (string) $location['name'] );
			if ( '' !== $id && '' !== $name ) {
				$category = isset( $location['category'] ) ? sanitize_key( $location['category'] ) : '';
				if ( ! in_array( $category, [ 'wfo', 'wfh', 'offsite', 'leave' ], true ) ) {
					$category = self::infer_location_category( $name );
				}
				$clean_locations[] = [
					'id'       => $id,
					'name'     => $name,
					'category' => $category,
				];
			}
		}

		return $clean_locations;
	}

	private static function infer_location_category( $name ) {
		$normalized = strtolower( trim( $name ) );
		if ( in_array( $normalized, [ 'kolektiv space', 'mcc', 'wfo', 'work from office' ], true ) ) {
			return 'wfo';
		}
		if ( in_array( $normalized, [ 'wfh', 'work from home' ], true ) ) {
			return 'wfh';
		}
		if ( in_array( $normalized, [ 'off site', 'off-site', 'offsite' ], true ) ) {
			return 'offsite';
		}
		if ( in_array( $normalized, [ 'sick or other leave', 'leave' ], true ) ) {
			return 'leave';
		}

		return 'other';
	}

	/** POST /pet/care — Feed, Play, or Clean. Costs points, boosts mood. */
	public static function do_care_action( WP_REST_Request $request ) {
		global $wpdb;
		$user_id = get_current_user_id();
		$action  = sanitize_text_field( $request['action'] );

		$valid_actions = [ 'feed' => 15, 'play' => 10, 'clean' => 5 ]; // point cost per action
		if ( ! isset( $valid_actions[ $action ] ) ) {
			return new WP_Error( 'invalid_action', 'Unknown care action.', [ 'status' => 400 ] );
		}

		$cost   = $valid_actions[ $action ];
		if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
			return new WP_Error( 'care_transaction_failed', 'Unable to start the care action.', [ 'status' => 500 ] );
		}

		Petgame_DB::get_or_create_pet( $user_id );
		$pet = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}petgame_pets WHERE user_id = %d FOR UPDATE",
			$user_id
		) );
		if ( ! $pet ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'pet_unavailable', 'Unable to load the user game state.', [ 'status' => 500 ] );
		}

		$points = Petgame_DB::get_lifetime_points( $user_id );

		if ( $points < $cost ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'insufficient_points', 'Not enough points for this action.', [ 'status' => 402 ] );
		}

		$newMood = Petgame_Formulas::apply_care_action( (int) $pet->mood_meter );

		if ( false === $wpdb->update(
			$wpdb->prefix . 'petgame_pets',
			[ 'mood_meter' => $newMood ],
			[ 'user_id' => $user_id ]
		) ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'pet_update_failed', 'Unable to update the pet mood.', [ 'status' => 500 ] );
		}
		if ( false === $wpdb->insert( $wpdb->prefix . 'petgame_points_ledger', [
			'user_id' => $user_id,
			'amount'  => -$cost,
			'reason'  => 'care_action_' . $action,
		] ) ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'points_save_failed', 'Unable to deduct points for this care action.', [ 'status' => 500 ] );
		}
		if ( false === $wpdb->query( 'COMMIT' ) ) {
			return new WP_Error( 'care_commit_failed', 'The care action could not be confirmed as committed.', [ 'status' => 500 ] );
		}

		return new WP_REST_Response( [
			'mood_meter'       => $newMood,
			'mood_state'       => Petgame_Formulas::mood_state( $newMood ),
			'lifetime_points'  => Petgame_DB::get_lifetime_points( $user_id ),
		], 200 );
	}

	/** POST /card/draw — once-per-day draw, gated by shared streak_count. */
	public static function draw_card( WP_REST_Request $request ) {
		global $wpdb;
		$user_id = get_current_user_id();
		$today   = current_time( 'Y-m-d' );
		if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
			return new WP_Error( 'card_transaction_failed', 'Unable to start the card draw.', [ 'status' => 500 ] );
		}

		$table_cards = $wpdb->prefix . 'petgame_card_draws';
		$already_drawn = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM $table_cards WHERE user_id = %d AND draw_date = %s",
			$user_id, $today
		) );

		if ( $already_drawn ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'already_drawn', 'Come back tomorrow for your next draw.', [ 'status' => 409 ] );
		}

		Petgame_DB::get_or_create_pet( $user_id );
		$pet = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}petgame_pets WHERE user_id = %d FOR UPDATE",
			$user_id
		) );
		if ( ! $pet ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'pet_unavailable', 'Unable to load the user game state.', [ 'status' => 500 ] );
		}

		if ( (int) $pet->streak_count < Petgame_Formulas::CARD_UNLOCK_STREAK ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'card_locked', 'Keep your attendance streak going to unlock cards.', [ 'status' => 403 ] );
		}

		$result = Petgame_Formulas::draw_card( (int) $pet->streak_count );

		if ( false === $wpdb->insert( $table_cards, [
			'user_id'        => $user_id,
			'draw_date'      => $today,
			'card_type'      => $result['card_type'],
			'points_awarded' => $result['points'],
		] ) ) {
			$wpdb->query( 'ROLLBACK' );
			$already_drawn = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM $table_cards WHERE user_id = %d AND draw_date = %s",
				$user_id,
				$today
			) );
			if ( $already_drawn ) {
				return new WP_Error( 'already_drawn', 'Come back tomorrow for your next draw.', [ 'status' => 409 ] );
			}
			return new WP_Error( 'card_save_failed', 'Unable to save the card draw.', [ 'status' => 500 ] );
		}

		if ( $result['points'] > 0 ) {
			if ( false === $wpdb->insert( $wpdb->prefix . 'petgame_points_ledger', [
				'user_id' => $user_id,
				'amount'  => $result['points'],
				'reason'  => 'card_draw_bonus',
			] ) ) {
				$wpdb->query( 'ROLLBACK' );
				return new WP_Error( 'points_save_failed', 'Unable to add the card reward to the points balance.', [ 'status' => 500 ] );
			}
		}
		if ( false === $wpdb->query( 'COMMIT' ) ) {
			return new WP_Error( 'card_commit_failed', 'The card draw could not be confirmed as committed.', [ 'status' => 500 ] );
		}

		return new WP_REST_Response( [
			'card_type'       => $result['card_type'],
			'points_awarded'  => $result['points'],
			'lifetime_points' => Petgame_DB::get_lifetime_points( $user_id ),
		], 200 );
	}
}
