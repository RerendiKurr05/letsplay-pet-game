import { useEffect, useRef } from 'react';

export default function useLiveRefresh(refresh, intervalMs = 15000) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let refreshing = false;

    async function refreshVisiblePage() {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        await refreshRef.current({ quiet: true });
      } finally {
        refreshing = false;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refreshVisiblePage();
    }

    const timer = window.setInterval(refreshVisiblePage, intervalMs);
    window.addEventListener('focus', refreshVisiblePage);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisiblePage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);
}
