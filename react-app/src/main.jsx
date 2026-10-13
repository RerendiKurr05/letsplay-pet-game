import { createRoot } from 'react-dom/client';
import GameApp from './components/GameApp';
import './style.css';

// #petgame-root is the div printed by includes/class-petgame-shortcode.php
// via the [petgame_app] shortcode. If this script runs on any other page
// (it shouldn't, since we only enqueue it when the shortcode is present),
// this guard keeps it from throwing.
const mountPoint = document.getElementById('petgame-root');

if (mountPoint) {
  createRoot(mountPoint).render(<GameApp />);
} else {
  console.warn('[petgame] #petgame-root not found on this page — app not mounted.');
}
