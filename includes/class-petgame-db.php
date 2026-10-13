<?php
/**
 * Database setup.
 *
 * We store game state in our OWN tables, separate from whatever tables
 * the Attendance Team's system uses. We never touch their tables directly —
 * the only contact between the two systems is the webhook in
 * class-petgame-webhook.php. This keeps the two teams' code fully decoupled:
 * if they change their schema, nothing here breaks, as long as the webhook
 * payload shape stays the same (and if IT changes, that's a one-file fix).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Petgame_DB {

	/**
	 * Creates all tables this plugin needs. Called once on plugin activation.
	 * Uses WordPress's dbDelta(), the standard safe way to create/update
	 * custom tables — it won't destroy existing data on reactivation.
	 */
	public static function create_tables() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();

		// --- pet state: one row per WordPress user -------------------
		$table_pets = $wpdb->prefix . 'petgame_pets';
		$sql_pets = "CREATE TABLE $table_pets (
			user_id BIGINT UNSIGNED NOT NULL,
			pet_type VARCHAR(20) NOT NULL DEFAULT 'mascot',
			mascot_id VARCHAR(50) DEFAULT NULL,
			custom_parts LONGTEXT DEFAULT NULL,
			pet_name VARCHAR(50) NOT NULL DEFAULT 'Momo',
			mood_meter SMALLINT NOT NULL DEFAULT 50,
			streak_count SMALLINT NOT NULL DEFAULT 0,
			last_checkin_date DATE DEFAULT NULL,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id)
		) $charset_collate;";

		// --- points ledger: append-only history of every point change -
		$table_ledger = $wpdb->prefix . 'petgame_points_ledger';
		$sql_ledger = "CREATE TABLE $table_ledger (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			amount INT NOT NULL,
			reason VARCHAR(100) NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY user_id (user_id)
		) $charset_collate;";

		// --- card draw log: one row per daily draw, enforces the 1/day rule
		$table_cards = $wpdb->prefix . 'petgame_card_draws';
		$sql_cards = "CREATE TABLE $table_cards (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			draw_date DATE NOT NULL,
			card_type VARCHAR(20) NOT NULL,
			points_awarded INT NOT NULL DEFAULT 0,
			PRIMARY KEY (id),
			UNIQUE KEY user_draw_date (user_id, draw_date)
		) $charset_collate;";

		// --- authoritative attendance events mirrored from Laravel -------
		$table_checkins = $wpdb->prefix . 'petgame_checkins';
		$sql_checkins = "CREATE TABLE $table_checkins (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			checkin_date DATE NOT NULL,
			on_time TINYINT(1) NOT NULL DEFAULT 0,
			attendance_type VARCHAR(20) NOT NULL DEFAULT 'checkin',
			points_awarded INT NOT NULL DEFAULT 0,
			source_event_id VARCHAR(100) DEFAULT NULL,
			location_id VARCHAR(100) DEFAULT NULL,
			location_name VARCHAR(150) DEFAULT NULL,
			mood_meter SMALLINT NOT NULL DEFAULT 0,
			streak_count SMALLINT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY user_checkin_date (user_id, checkin_date),
			UNIQUE KEY source_event_id (source_event_id),
			KEY checkin_date (checkin_date)
		) $charset_collate;";

		dbDelta( $sql_pets );
		dbDelta( $sql_ledger );
		dbDelta( $sql_cards );
		dbDelta( $sql_checkins );
	}

	/** Apply additive schema updates to already-active plugin installations. */
	public static function maybe_upgrade() {
		$installed_version = get_option( 'petgame_db_version', '0' );

		if ( version_compare( $installed_version, PETGAME_VERSION, '>=' ) ) {
			return;
		}

		self::create_tables();
		update_option( 'petgame_db_version', PETGAME_VERSION );
	}

	/** Fetch (or lazily create) a user's pet row. */
	public static function get_or_create_pet( $user_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'petgame_pets';

		$pet = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE user_id = %d", $user_id )
		);

		if ( ! $pet ) {
			$wpdb->insert( $table, [
				'user_id'     => $user_id,
				'pet_type'    => 'mascot',
				'mascot_id'   => 'default',
				'pet_name'    => 'Momo',
				'mood_meter'  => 50,
				'streak_count' => 0,
			] );
			$pet = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM $table WHERE user_id = %d", $user_id )
			);
		}

		return $pet;
	}

	/** Lifetime points = sum of every ledger entry for this user. */
	public static function get_lifetime_points( $user_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'petgame_points_ledger';
		$total = $wpdb->get_var(
			$wpdb->prepare( "SELECT SUM(amount) FROM $table WHERE user_id = %d", $user_id )
		);
		return $total ? (int) $total : 0;
	}

	/** Total points awarded by the attendance service. */
	public static function get_attendance_points( $user_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'petgame_points_ledger';
		$total = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT SUM(amount) FROM $table WHERE user_id = %d AND reason = %s",
				$user_id,
				'attendance_checkin'
			)
		);

		return $total ? (int) $total : 0;
	}

	/** Attendance steps earned this week; the decorative trail has six spaces. */
	public static function get_weekly_steps( $user_id ) {
		global $wpdb;
		$table      = $wpdb->prefix . 'petgame_checkins';
		$week_start = ( new DateTimeImmutable( 'monday this week', wp_timezone() ) )->format( 'Y-m-d' );
		$week_end   = current_time( 'Y-m-d' );

		$steps = $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM $table WHERE user_id = %d AND on_time = 1 AND checkin_date BETWEEN %s AND %s",
			$user_id,
			$week_start,
			$week_end
		) );

		return min( 6, (int) $steps );
	}

	/** Today's mirrored event drives the post-attendance points transition. */
	public static function get_todays_checkin( $user_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'petgame_checkins';
		$row   = $wpdb->get_row( $wpdb->prepare(
			"SELECT checkin_date, on_time, attendance_type, points_awarded, location_name, mood_meter, streak_count
			FROM $table WHERE user_id = %d AND checkin_date = %s LIMIT 1",
			$user_id,
			current_time( 'Y-m-d' )
		), ARRAY_A );

		if ( ! $row ) {
			return null;
		}

		return [
			'checkin_date'   => $row['checkin_date'],
			'on_time'        => (bool) $row['on_time'],
			'attendance_type' => $row['attendance_type'],
			'points_awarded' => (int) $row['points_awarded'],
			'location_name'  => $row['location_name'],
			'mood_meter'     => (int) $row['mood_meter'],
			'streak_count'   => (int) $row['streak_count'],
		];
	}

	/** Return a user's saved card result for today, if one has been drawn. */
	public static function get_todays_card( $user_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'petgame_card_draws';
		$row   = $wpdb->get_row( $wpdb->prepare(
			"SELECT card_type, points_awarded FROM $table WHERE user_id = %d AND draw_date = %s LIMIT 1",
			$user_id,
			current_time( 'Y-m-d' )
		), ARRAY_A );

		if ( ! $row ) {
			return null;
		}

		return [
			'card_type'      => $row['card_type'],
			'points_awarded' => (int) $row['points_awarded'],
		];
	}

	/** Ranked lifetime balances, with the signed-in player pinned if needed. */
	public static function get_leaderboard( $current_user_id, $limit = 50 ) {
		global $wpdb;
		$users_table  = $wpdb->users;
		$ledger_table = $wpdb->prefix . 'petgame_points_ledger';
		$limit        = max( 1, min( 100, (int) $limit ) );

		$rows = $wpdb->get_results(
			"SELECT u.ID AS user_id, u.display_name, SUM(l.amount) AS points
			FROM $ledger_table l
			INNER JOIN $users_table u ON u.ID = l.user_id
			GROUP BY u.ID, u.display_name
			HAVING SUM(l.amount) > 0
			ORDER BY points DESC, u.ID ASC
			LIMIT $limit",
			ARRAY_A
		);

		if ( null === $rows ) {
			return new WP_Error( 'leaderboard_unavailable', 'Unable to load the leaderboard.', [ 'status' => 500 ] );
		}

		$rank = 0;
		$entries = [];
		$current_user_in_list = false;
		foreach ( $rows as $row ) {
			$rank++;
			$is_current_user = (int) $row['user_id'] === (int) $current_user_id;
			$current_user_in_list = $current_user_in_list || $is_current_user;
			$entries[] = [
				'rank'            => $rank,
				'user_id'         => (int) $row['user_id'],
				'name'            => $is_current_user ? 'You' : $row['display_name'],
				'points'          => (int) $row['points'],
				'is_current_user' => $is_current_user,
			];
		}

		if ( ! $current_user_in_list ) {
			$current_points = self::get_lifetime_points( $current_user_id );
			if ( $current_points > 0 ) {
				$rank_ahead = $wpdb->get_var( $wpdb->prepare(
					"SELECT COUNT(*) FROM (
						SELECT l.user_id, SUM(l.amount) AS points
						FROM $ledger_table l
						INNER JOIN $users_table u ON u.ID = l.user_id
						GROUP BY l.user_id
						HAVING SUM(l.amount) > %d
							OR (SUM(l.amount) = %d AND l.user_id < %d)
					) ranked_users",
					$current_points,
					$current_points,
					$current_user_id
				) );

				$entries[] = [
					'rank'            => (int) $rank_ahead + 1,
					'user_id'         => (int) $current_user_id,
					'name'            => 'You',
					'points'          => $current_points,
					'is_current_user' => true,
				];
			}
		}

		return $entries;
	}
}
