<?php
/**
 * This is the "embed React inside WordPress" piece. We register a
 * shortcode — [petgame_app] — that any page or template can use. A site
 * admin creates a normal WordPress Page (e.g. at /pet), puts [petgame_app]
 * in its content, and that's the entire WordPress-side integration: one
 * shortcode on one page.
 *
 * What this actually does on that page:
 *   1. Prints an empty <div id="petgame-root"></div> — React mounts here
 *   2. Enqueues our built React bundle (assets/build/app.js + app.css)
 *   3. Passes the WP REST nonce + API root URL to that JS via
 *      wp_localize_script, so the React app can make authenticated calls
 *      without needing a second login system
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Petgame_Shortcode {

	public static function register() {
		add_shortcode( 'petgame_app', [ __CLASS__, 'render' ] );
	}

	public static function render() {
		if ( ! is_user_logged_in() ) {
			return '<p>Please log in to view your pet.</p>';
		}

		self::enqueue_assets();

		return '<div id="petgame-root"></div>';
	}

	private static function enqueue_assets() {
		$build_dir = PETGAME_PLUGIN_DIR . 'assets/build/';
		$build_url = PETGAME_PLUGIN_URL . 'assets/build/';

		// cache-bust using the file's own modified time during development;
		// swap for a real version string on deploy
		$js_version  = file_exists( $build_dir . 'app.js' ) ? filemtime( $build_dir . 'app.js' ) : PETGAME_VERSION;
		$css_version = file_exists( $build_dir . 'app.css' ) ? filemtime( $build_dir . 'app.css' ) : PETGAME_VERSION;

		wp_enqueue_script(
			'petgame-app',
			$build_url . 'app.js',
			[], // no wp-element dependency here since this build bundles its own React —
			    // see react-app/README for the alternative "use WP's own React" approach
			$js_version,
			true // load in the footer
		);

		wp_enqueue_style( 'petgame-app', $build_url . 'app.css', [], $css_version );

		// This is the PHP -> JS auth bridge. window.petgameConfig becomes
		// available to app.js before it runs.
		wp_localize_script( 'petgame-app', 'petgameConfig', [
			'apiRoot'    => esc_url_raw( rest_url( 'petgame/v1/' ) ),
			'nonce'      => wp_create_nonce( 'wp_rest' ),
			'attendanceFormUrl' => defined( 'PETGAME_ATTENDANCE_FORM_URL' ) ? esc_url_raw( PETGAME_ATTENDANCE_FORM_URL ) : '',
			'dashboardUrl' => esc_url_raw( apply_filters( 'petgame_dashboard_url', '' ) ),
			'assets'     => self::sanitize_asset_config( apply_filters( 'petgame_assets', [] ) ),
			'theme'      => self::sanitize_theme_config( apply_filters( 'petgame_theme', [] ) ),
			'currentUser' => [
				'id'   => get_current_user_id(),
				'name' => wp_get_current_user()->display_name,
			],
		] );
	}

	private static function sanitize_asset_config( $value ) {
		if ( ! is_array( $value ) ) {
			return [];
		}

		$assets = [];
		foreach ( $value as $key => $asset ) {
			$assets[ $key ] = is_array( $asset )
				? self::sanitize_asset_config( $asset )
				: ( is_string( $asset ) ? esc_url_raw( $asset ) : '' );
		}

		return $assets;
	}

	private static function sanitize_theme_config( $theme ) {
		if ( ! is_array( $theme ) ) {
			return [];
		}

		$colors = [];
		foreach ( [ 'primary', 'ink', 'surface', 'background', 'soft', 'accent' ] as $key ) {
			if ( isset( $theme[ $key ] ) && is_string( $theme[ $key ] ) ) {
				$color = sanitize_hex_color( $theme[ $key ] );
				if ( $color ) {
					$colors[ $key ] = $color;
				}
			}
		}

		return $colors;
	}
}
