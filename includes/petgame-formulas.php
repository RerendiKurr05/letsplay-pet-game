<?php
/**
 * The actual game math, kept separate from database/API code on purpose.
 *
 * This is the file a designer/PM (you) would tune without needing to touch
 * any WordPress plumbing — every number here maps directly to the
 * tunable parameters from the design spec:
 *   - overnight decay rate
 *   - attendance-boost curve (caps at day 5-7 of a streak)
 *   - care-action flat boost
 *   - hard reset to "Sad" on a missed day
 *   - Card Draw unlock threshold (streak >= 3) and bonus-card odds (15%)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Petgame_Formulas {

	const MOOD_MAX = 100;
	const MOOD_MIN = 0;
	const SAD_THRESHOLD_ON_MISS = 15;   // where mood lands after a missed day
	const OVERNIGHT_DECAY       = 8;    // mood lost per day, before any boost
	const CARE_ACTION_BOOST     = 12;   // flat boost from Feed/Play/Clean
	const STREAK_BOOST_CAP_DAY  = 6;    // day at which the attendance boost maxes out
	const CARD_UNLOCK_STREAK    = 3;    // streak needed to unlock Bonus card odds
	const BONUS_CARD_CHANCE     = 0.15; // 15%, per the spec
	const BONUS_CARD_POINTS     = 20;   // flat reward if a Bonus card is drawn

	/**
	 * How much mood_meter increases from an on-time check-in, given the
	 * CURRENT streak (after incrementing it for today). Scales up day by
	 * day until STREAK_BOOST_CAP_DAY, then flattens — this is what makes
	 * "Happy" require less additional care the longer the streak runs.
	 */
	public static function attendance_boost( $streak_count ) {
		$capped_streak = min( $streak_count, self::STREAK_BOOST_CAP_DAY );
		// Day 1 streak -> +10, Day 6+ streak -> +35 (flat happy zone alone)
		$min_boost = 10;
		$max_boost = 35;
		$progress  = ( $capped_streak - 1 ) / max( 1, self::STREAK_BOOST_CAP_DAY - 1 );
		return (int) round( $min_boost + ( $max_boost - $min_boost ) * $progress );
	}

	/**
	 * Runs the full daily cycle for one user: decay, then either an
	 * attendance boost (on-time check-in) or a hard reset (missed day).
	 * Returns the new mood_meter and streak_count — caller is responsible
	 * for saving them back to the database.
	 */
	public static function apply_checkin( $current_mood, $current_streak, $on_time ) {
		// 1. overnight decay always happens first
		$mood = max( self::MOOD_MIN, $current_mood - self::OVERNIGHT_DECAY );

		if ( $on_time ) {
			// 2a. on-time: streak grows, mood gets the scaled boost
			$new_streak = $current_streak + 1;
			$mood = min( self::MOOD_MAX, $mood + self::attendance_boost( $new_streak ) );
			return [ 'mood_meter' => $mood, 'streak_count' => $new_streak ];
		}

		// 2b. missed day: hard reset, regardless of how long the streak was
		return [ 'mood_meter' => self::SAD_THRESHOLD_ON_MISS, 'streak_count' => 0 ];
	}

	/** Apply a care action (Feed/Play/Clean) — flat boost, always available. */
	public static function apply_care_action( $current_mood ) {
		return min( self::MOOD_MAX, $current_mood + self::CARE_ACTION_BOOST );
	}

	/** Maps a 0-100 mood_meter value to the 3 display states. */
	public static function mood_state( $mood_meter ) {
		if ( $mood_meter <= 33 ) return 'sad';
		if ( $mood_meter <= 66 ) return 'neutral';
		return 'happy';
	}

	/**
	 * Card Draw logic. Returns ['card_type' => 'quote'|'bonus', 'points' => int]
	 * Deck composition depends entirely on the shared streak_count — this
	 * function doesn't track any state of its own, by design (see spec:
	 * "reuses the same streak already driving the board trail").
	 */
	public static function draw_card( $streak_count ) {
		$unlocked = $streak_count >= self::CARD_UNLOCK_STREAK;

		if ( $unlocked && mt_rand() / mt_getrandmax() < self::BONUS_CARD_CHANCE ) {
			return [ 'card_type' => 'bonus', 'points' => self::BONUS_CARD_POINTS ];
		}

		return [ 'card_type' => 'quote', 'points' => 0 ];
	}
}
