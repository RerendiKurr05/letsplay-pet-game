<?php
/**
 * Receives the final attendance outcome from the separate Laravel app.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Petgame_Webhook {

	public static function register_routes() {
		add_action( 'rest_api_init', function () {
			register_rest_route( 'petgame/v1', '/webhook/checkin', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'handle_checkin' ],
				'permission_callback' => [ __CLASS__, 'verify_webhook_secret' ],
			] );
		} );
	}

	/** Authenticate the Laravel service with a fresh HMAC of the raw request body. */
	public static function verify_webhook_secret( $request ) {
		$expected = defined( 'PETGAME_WEBHOOK_SECRET' ) ? PETGAME_WEBHOOK_SECRET : null;
		$timestamp = $request->get_header( 'x-petgame-timestamp' );
		$provided_signature = $request->get_header( 'x-petgame-signature' );

		if ( ! is_string( $expected ) || strlen( $expected ) < 32 ) {
			return new WP_Error(
				'petgame_webhook_unconfigured',
				'The attendance webhook is not configured.',
				[ 'status' => 503 ]
			);
		}

		if (
			! is_string( $timestamp ) ||
			! preg_match( '/^\d{10}$/', $timestamp ) ||
			abs( time() - (int) $timestamp ) > 300 ||
			! is_string( $provided_signature ) ||
			! preg_match( '/^sha256=[a-f0-9]{64}$/', $provided_signature )
		) {
			return new WP_Error(
				'petgame_unauthorized',
				'Missing, malformed, or expired webhook signature.',
				[ 'status' => 401 ]
			);
		}

		$signature = 'sha256=' . hash_hmac(
			'sha256',
			$timestamp . '.' . $request->get_body(),
			$expected
		);

		if ( ! hash_equals( $signature, $provided_signature ) ) {
			return new WP_Error(
				'petgame_unauthorized',
				'Invalid webhook signature.',
				[ 'status' => 401 ]
			);
		}

		return true;
	}

	/**
	 * Record one final attendance outcome. The unique user/date key makes
	 * Laravel retries safe and prevents duplicate points or streak changes.
	 */
	public static function handle_checkin( WP_REST_Request $request ) {
		global $wpdb;

		$user_id        = $request->get_param( 'wp_user_id' );
		$on_time        = $request->get_param( 'on_time' );
		$checkin_date   = $request->get_param( 'checkin_date' );
		$points_awarded = $request->get_param( 'points_awarded' );
		$source_event_id = $request->get_param( 'source_event_id' );
		$location_id    = $request->get_param( 'location_id' );
		$location_name  = $request->get_param( 'location_name' );
		$attendance_type = $request->get_param( 'attendance_type' );
		$attendance_type = null === $attendance_type ? 'checkin' : $attendance_type;

		if ( ! is_numeric( $user_id ) || (int) $user_id < 1 || (string) (int) $user_id !== (string) $user_id ) {
			return new WP_Error( 'invalid_user_id', 'wp_user_id must be a positive integer.', [ 'status' => 400 ] );
		}

		if ( ! is_bool( $on_time ) ) {
			return new WP_Error( 'invalid_on_time', 'on_time must be a JSON boolean.', [ 'status' => 400 ] );
		}
		if ( ! is_string( $attendance_type ) || ! in_array( $attendance_type, [ 'checkin', 'leave' ], true ) ) {
			return new WP_Error( 'invalid_attendance_type', 'attendance_type must be checkin or leave.', [ 'status' => 400 ] );
		}
		if ( 'leave' === $attendance_type && $on_time ) {
			return new WP_Error( 'invalid_leave_status', 'Leave events cannot be marked as on time.', [ 'status' => 400 ] );
		}

		if ( ! is_string( $checkin_date ) || ! self::is_valid_date( $checkin_date ) ) {
			return new WP_Error( 'invalid_checkin_date', 'checkin_date must use YYYY-MM-DD format.', [ 'status' => 400 ] );
		}

		if ( $checkin_date > current_time( 'Y-m-d' ) ) {
			return new WP_Error( 'future_checkin_date', 'checkin_date cannot be in the future.', [ 'status' => 400 ] );
		}

		if ( ! is_numeric( $points_awarded ) || (int) $points_awarded < -10000 || (int) $points_awarded > 10000 || (string) (int) $points_awarded !== (string) $points_awarded ) {
			return new WP_Error( 'invalid_points_awarded', 'points_awarded must be an integer from -10000 to 10000.', [ 'status' => 400 ] );
		}

		$user_id         = (int) $user_id;
		$points_awarded  = (int) $points_awarded;
		$source_event_id = self::optional_identifier( $source_event_id, 100, 'source_event_id' );
		if ( is_wp_error( $source_event_id ) ) {
			return $source_event_id;
		}
		if ( null === $source_event_id ) {
			return new WP_Error( 'missing_source_event_id', 'source_event_id is required for idempotent attendance delivery.', [ 'status' => 400 ] );
		}
		$location_id = self::optional_identifier( $location_id, 100, 'location_id' );
		if ( is_wp_error( $location_id ) ) {
			return $location_id;
		}
		if ( null !== $location_name && ( ! is_string( $location_name ) || strlen( $location_name ) > 150 ) ) {
			return new WP_Error( 'invalid_location_name', 'location_name must be a string no longer than 150 characters.', [ 'status' => 400 ] );
		}
		$location_name = null === $location_name ? null : sanitize_text_field( $location_name );

		if ( ! get_userdata( $user_id ) ) {
			return new WP_Error( 'unknown_user', 'No WordPress account matches wp_user_id.', [ 'status' => 404 ] );
		}

		$table_checkins = $wpdb->prefix . 'petgame_checkins';
		if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
			return new WP_Error( 'checkin_transaction_failed', 'Unable to start attendance processing.', [ 'status' => 500 ] );
		}

		if ( null === $source_event_id ) {
			$existing = $wpdb->get_row( $wpdb->prepare(
				"SELECT id, user_id, checkin_date FROM $table_checkins WHERE user_id = %d AND checkin_date = %s",
				$user_id,
				$checkin_date
			) );
		} else {
			$existing = $wpdb->get_row( $wpdb->prepare(
				"SELECT id, user_id, checkin_date FROM $table_checkins
				WHERE (user_id = %d AND checkin_date = %s) OR source_event_id = %s LIMIT 1",
				$user_id,
				$checkin_date,
				$source_event_id
			) );
		}
		if ( $existing ) {
			$wpdb->query( 'ROLLBACK' );
			if ( (int) $existing->user_id !== $user_id || $existing->checkin_date !== $checkin_date ) {
				return new WP_Error( 'duplicate_source_event', 'source_event_id has already been used for another attendance event.', [ 'status' => 409 ] );
			}

			return new WP_REST_Response( [
				'status'  => 'already_processed',
				'message' => 'This attendance date has already been processed.',
			], 200 );
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

		if ( $pet->last_checkin_date && $checkin_date === $pet->last_checkin_date ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_REST_Response( [
				'status'  => 'already_processed',
				'message' => 'This attendance date has already been processed.',
			], 200 );
		}

		if ( $pet->last_checkin_date && $checkin_date < $pet->last_checkin_date ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'stale_checkin', 'An older attendance date cannot replace a newer game state.', [ 'status' => 409 ] );
		}

		$result = 'leave' === $attendance_type
			? [
				'mood_meter'   => (int) $pet->mood_meter,
				'streak_count' => (int) $pet->streak_count,
			]
			: Petgame_Formulas::apply_checkin(
				(int) $pet->mood_meter,
				(int) $pet->streak_count,
				$on_time
			);

		$updated = $wpdb->update(
			$wpdb->prefix . 'petgame_pets',
			[
				'mood_meter'        => $result['mood_meter'],
				'streak_count'      => $result['streak_count'],
				'last_checkin_date' => $checkin_date,
			],
			[ 'user_id' => $user_id ]
		);
		if ( false === $updated ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'pet_update_failed', 'Unable to update the game state for this attendance event.', [ 'status' => 500 ] );
		}

		$event_saved = $wpdb->insert( $table_checkins, [
			'user_id'         => $user_id,
			'checkin_date'    => $checkin_date,
			'on_time'         => $on_time ? 1 : 0,
			'attendance_type' => $attendance_type,
			'points_awarded'  => $points_awarded,
			'source_event_id' => $source_event_id,
			'location_id'     => $location_id,
			'location_name'   => $location_name,
			'mood_meter'      => $result['mood_meter'],
			'streak_count'    => $result['streak_count'],
		] );
		if ( false === $event_saved ) {
			$wpdb->query( 'ROLLBACK' );
			$existing = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM $table_checkins WHERE user_id = %d AND checkin_date = %s",
				$user_id,
				$checkin_date
			) );

			if ( $existing ) {
				return new WP_REST_Response( [
					'status'  => 'already_processed',
					'message' => 'This attendance date has already been processed.',
				], 200 );
			}

			if ( null !== $source_event_id ) {
				$existing_source = $wpdb->get_var( $wpdb->prepare(
					"SELECT id FROM $table_checkins WHERE source_event_id = %s",
					$source_event_id
				) );
				if ( $existing_source ) {
					return new WP_Error( 'duplicate_source_event', 'source_event_id has already been used for another attendance event.', [ 'status' => 409 ] );
				}
			}

			return new WP_Error( 'checkin_save_failed', 'Unable to save the attendance event.', [ 'status' => 500 ] );
		}

		if ( 0 !== $points_awarded && false === $wpdb->insert( $wpdb->prefix . 'petgame_points_ledger', [
			'user_id' => $user_id,
			'amount'  => $points_awarded,
			'reason'  => 'attendance_checkin',
		] ) ) {
			$wpdb->query( 'ROLLBACK' );
			return new WP_Error( 'points_save_failed', 'Unable to add attendance points to the game balance.', [ 'status' => 500 ] );
		}

		if ( false === $wpdb->query( 'COMMIT' ) ) {
			return new WP_Error( 'checkin_commit_failed', 'Attendance was processed but could not be confirmed as committed.', [ 'status' => 500 ] );
		}

		return new WP_REST_Response( [
			'status'         => 'ok',
			'checkin_date'   => $checkin_date,
			'on_time'        => $on_time,
			'attendance_type' => $attendance_type,
			'points_awarded' => $points_awarded,
			'mood_meter'     => $result['mood_meter'],
			'streak_count'   => $result['streak_count'],
			'lifetime_points' => Petgame_DB::get_lifetime_points( $user_id ),
		], 200 );
	}

	private static function is_valid_date( $date ) {
		$parsed = DateTimeImmutable::createFromFormat( '!Y-m-d', $date );
		$errors = DateTimeImmutable::getLastErrors();

		return $parsed && $parsed->format( 'Y-m-d' ) === $date && ( false === $errors || ( 0 === $errors['warning_count'] && 0 === $errors['error_count'] ) );
	}

	private static function optional_identifier( $value, $max_length, $field_name ) {
		if ( null === $value || '' === $value ) {
			return null;
		}

		if ( ! is_string( $value ) && ! is_int( $value ) ) {
			return new WP_Error( 'invalid_' . $field_name, $field_name . ' must be a string or integer.', [ 'status' => 400 ] );
		}

		$value = sanitize_text_field( (string) $value );
		if ( '' === $value || strlen( $value ) > $max_length ) {
			return new WP_Error( 'invalid_' . $field_name, $field_name . ' is empty or too long.', [ 'status' => 400 ] );
		}

		return $value;
	}
}
