<?php
/**
 * Plugin Name: Let's Play — Pet Game
 * Plugin URI:  https://example.com
 * Description: Gamified attendance companion — virtual pet, points, card draw, and shop.
 *              Lives inside the existing WordPress company site as a dedicated page.
 *              Receives attendance events from the separate Attendance Team's system
 *              via a webhook, and renders the game UI as an embedded React app.
 * Version:     0.1.0
 * Author:      Muhammad Rendi Kurniawan (REREN)
 * Text Domain: letsplay-pet-game
 *
 * ---------------------------------------------------------------------------
 * HOW THIS PROJECT IS ORGANIZED (read this first)
 * ---------------------------------------------------------------------------
 * This is a WordPress plugin, NOT a theme. It doesn't touch the existing
 * company site's design at all — it just adds:
 *   1. New database tables (pet state, points ledger, card draws)
 *   2. A REST API namespace at /wp-json/petgame/v1/...
 *      - used BY the Attendance Team to push check-in events to us (webhook)
 *      - used BY our own React app to read/write pet state
 *   3. A WordPress page template that mounts our React app via a shortcode
 *
 * The React app (react-app/) is a completely normal, separate React project.
 * It knows NOTHING about PHP or WordPress internals — it only ever talks to
 * the REST endpoints below, exactly like it would talk to any other backend.
 * You build/test it independently, then copy its production build output
 * into assets/build/, and THIS file loads those built files on the page.
 * ---------------------------------------------------------------------------
 */

// Prevent direct access to this file (standard WP security practice)
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PETGAME_VERSION', '0.2.0' );
define( 'PETGAME_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'PETGAME_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// --- Load the pieces of this plugin -----------------------------------
require_once PETGAME_PLUGIN_DIR . 'includes/class-petgame-db.php';
require_once PETGAME_PLUGIN_DIR . 'includes/class-petgame-rest-api.php';
require_once PETGAME_PLUGIN_DIR . 'includes/class-petgame-webhook.php';
require_once PETGAME_PLUGIN_DIR . 'includes/class-petgame-shortcode.php';
require_once PETGAME_PLUGIN_DIR . 'includes/petgame-formulas.php';

/**
 * Runs once, when the plugin is activated from the WP admin.
 * This is where we create our custom database tables.
 */
function petgame_activate() {
	Petgame_DB::create_tables();
	update_option( 'petgame_db_version', PETGAME_VERSION );
}
register_activation_hook( __FILE__, 'petgame_activate' );

/**
 * Keep existing installations up to date when additive plugin schema changes.
 */
function petgame_maybe_upgrade() {
	Petgame_DB::maybe_upgrade();
}
add_action( 'plugins_loaded', 'petgame_maybe_upgrade' );

/**
 * Boot the plugin's pieces once WordPress has finished loading.
 */
function petgame_init() {
	Petgame_REST_API::register_routes();   // our app's own API (read/write pet state)
	Petgame_Webhook::register_routes();    // the endpoint the Attendance Team calls
	Petgame_Shortcode::register();         // [petgame_app] shortcode that mounts React
}
add_action( 'init', 'petgame_init' );
