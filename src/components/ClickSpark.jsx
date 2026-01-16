import { useRef, useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";

const ClickSpark = ({
  sparkColor = "rgba(145, 145, 145, 0.95)",
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = "ease-out",
  extraScale = 1.0,
  children
}) => {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const [mounted, setMounted] = useState(false);

  // --- 這部分程式碼完全保持不變 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement || document.body;
    if (!parent) return;
    let resizeTimeout;
    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scaledW = Math.max(1, Math.floor(width * dpr));
      const scaledH = Math.max(1, Math.floor(height * dpr));
      if (canvas.width !== scaledW || canvas.height !== scaledH) {
        canvas.width = scaledW;
        canvas.height = scaledH;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
      }
    };
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 100);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);
    resizeCanvas();
    return () => {
      ro.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, [mounted]);

  const easeFunc = useCallback(
    (t) => {
      switch (easing) {
        case "linear": return t;
        case "ease-in": return t * t;
        case "ease-in-out": return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default: return t * (2 - t);
      }
    },
    [easing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationId;
    const draw = (timestamp) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      try { ctx.globalCompositeOperation = 'lighter'; } catch(e) {}
      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;
        const progress = elapsed / duration;
        const eased = easeFunc(progress);
        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);
        const dpr = window.devicePixelRatio || 1;
        const x1 = (spark.x + distance * Math.cos(spark.angle)) * dpr;
        const y1 = (spark.y + distance * Math.sin(spark.angle)) * dpr;
        const x2 = (spark.x + (distance + lineLength) * Math.cos(spark.angle)) * dpr;
        const y2 = (spark.y + (distance + lineLength) * Math.sin(spark.angle)) * dpr;
        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2 * dpr;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return true;
      });
      animationId = requestAnimationFrame(draw);
    };
    animationId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, easeFunc, extraScale, mounted]);

  // --- 這部分是點擊特效的核心，必須保留 ---
  useEffect(() => {
    const onPointerEvent = (rawEvent) => {
      const e = rawEvent;
      const canvas = canvasRef.current;
      if (!canvas) return;
      let clientX, clientY;
      if (e.type === 'touchstart') {
        if (!e.touches || e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const targetElem = (e.target && e.target instanceof Element) ? e.target : (document.elementFromPoint(clientX, clientY) || document.body);
      const computedCursor = (targetElem && window.getComputedStyle) ? window.getComputedStyle(targetElem).cursor || '' : '';
      const allowed = ['default', 'auto', 'pointer'];
      const isAllowed = computedCursor === '' ? true : allowed.some((c) => computedCursor.includes(c));
      if (!isAllowed) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const now = performance.now();
      const newSparks = Array.from({ length: sparkCount }, (_, i) => ({
        x,
        y,
        angle: (2 * Math.PI * i) / sparkCount,
        startTime: now,
      }));
      sparksRef.current.push(...newSparks);
    };
    window.addEventListener('click', onPointerEvent, { passive: true, capture: true });
    window.addEventListener('touchstart', onPointerEvent, { passive: true, capture: true });
    return () => {
      window.removeEventListener('click', onPointerEvent, { capture: true });
      window.removeEventListener('touchstart', onPointerEvent, { capture: true });
    };
  }, [sparkCount, mounted]);

  // --- 這部分也需要保留 ---
  useEffect(() => {
    setMounted(true);
  }, []);

  // --- MODIFICATION START ---
  // 這是我們要移除的、產生初始動畫的程式碼塊。
  // 我們將其完全註解掉。
  /*
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const now = performance.now();
    const testSparks = Array.from({ length: Math.max(6, sparkCount) }, (_, i) => ({
      x: cx,
      y: cy,
      angle: (2 * Math.PI * i) / Math.max(6, sparkCount),
      startTime: now,
    }));
    sparksRef.current.push(...testSparks);
  }, [mounted, sparkCount]);
  */
  // --- MODIFICATION END ---

  return (
    <>
      {children}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div
            style={{
              position: 'fixed',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 99999,
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                userSelect: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                outline: '1px dashed rgba(255,0,0,0.04)',
              }}
            />
          </div>,
        document.body
      )}
    </>
  );
};

export default ClickSpark;
