import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({ value, duration = 900 }) {
  const target = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    const from = previousValue.current;
    previousValue.current = target;

    if (from === target) {
      setDisplayValue(target);
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(target);
      return undefined;
    }

    let frameId = 0;
    const startedAt = performance.now();
    function animate(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayValue(Math.round(from + ((target - from) * eased)));
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    }

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [duration, target]);

  return <span aria-label={target.toLocaleString()}>{displayValue.toLocaleString()}</span>;
}