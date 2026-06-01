(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const idleFrameInterval = 1000 / 120;
  const scrollFrameInterval = 1000 / 60;
  const qualityScale = 0.42;
  const maxDpr = 1.2;
  const motionSpeed = 3.195;
  const baseBlobs = [
    { x: 0.18, y: 0.28, r: 0.34, vx: 0.018, vy: 0.012, color: [0, 88, 210], alpha: 0.34, phase: 0.3 },
    { x: 0.72, y: 0.28, r: 0.32, vx: -0.016, vy: 0.014, color: [20, 190, 114], alpha: 0.3, phase: 1.9 },
    { x: 0.48, y: 0.58, r: 0.42, vx: 0.012, vy: -0.018, color: [0, 42, 122], alpha: 0.36, phase: 3.2 },
    { x: 0.86, y: 0.74, r: 0.3, vx: -0.02, vy: -0.01, color: [0, 84, 58], alpha: 0.25, phase: 4.4 },
    { x: 0.32, y: 0.82, r: 0.28, vx: 0.014, vy: -0.016, color: [22, 156, 172], alpha: 0.18, phase: 5.5 },
    { x: 0.62, y: 0.48, r: 0.24, vx: -0.01, vy: 0.019, color: [72, 224, 138], alpha: 0.12, phase: 2.7 },
  ];
  const blobs = baseBlobs.map(randomizeBlob);

  let canvas;
  let ctx;
  let width = 0;
  let height = 0;
  let rafId = null;
  let resizeRaf = null;
  let lastFrame = 0;
  let lastTime = 0;
  let visible = true;
  let scrolling = false;
  let scrollTimer = null;
  let baseGradient = null;
  let shadeGradient = null;

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomDirection() {
    return Math.random() < 0.5 ? -1 : 1;
  }

  function randomizeBlob(blob) {
    const vx = Math.max(0.007, Math.abs(blob.vx) * random(0.78, 1.22)) * randomDirection();
    const vy = Math.max(0.007, Math.abs(blob.vy) * random(0.78, 1.22)) * randomDirection();

    return {
      ...blob,
      x: random(0.14, 0.86),
      y: random(0.16, 0.84),
      r: blob.r * random(0.92, 1.1),
      vx,
      vy,
      alpha: blob.alpha * random(0.9, 1.12),
      phase: random(0, Math.PI * 2),
    };
  }

  function ensureCanvas() {
    if (canvas) {
      return;
    }

    canvas = document.createElement("canvas");
    canvas.className = "kigex-motion-canvas";
    canvas.setAttribute("aria-hidden", "true");
    ctx = canvas.getContext("2d", { alpha: false });
    document.body.prepend(canvas);
  }

  function resizeCanvas() {
    ensureCanvas();

    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const nextWidth = Math.max(320, Math.round(window.innerWidth * qualityScale * dpr));
    const nextHeight = Math.max(320, Math.round(window.innerHeight * qualityScale * dpr));

    if (nextWidth === width && nextHeight === height) {
      return;
    }

    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    buildPaintCache();
  }

  function buildPaintCache() {
    baseGradient = ctx.createLinearGradient(0, 0, width, height);
    baseGradient.addColorStop(0, "#061426");
    baseGradient.addColorStop(0.48, "#081a21");
    baseGradient.addColorStop(1, "#031a16");

    shadeGradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      0,
      width * 0.5,
      height * 0.48,
      Math.max(width, height) * 0.72,
    );
    shadeGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    shadeGradient.addColorStop(0.68, "rgba(0, 0, 0, 0.1)");
    shadeGradient.addColorStop(1, "rgba(0, 0, 0, 0.48)");
  }

  function invisibleMargins(blob) {
    const maxSide = Math.max(width, height);

    return {
      x: Math.min(0.46, blob.r * (maxSide / width) * 0.58 + 0.12),
      y: Math.min(0.46, blob.r * (maxSide / height) * 0.58 + 0.12),
    };
  }

  function moveBlob(blob, delta) {
    const margin = invisibleMargins(blob);
    const minX = -margin.x;
    const maxX = 1 + margin.x;
    const minY = -margin.y;
    const maxY = 1 + margin.y;

    blob.x += blob.vx * delta * motionSpeed;
    blob.y += blob.vy * delta * motionSpeed;

    if (blob.x < minX || blob.x > maxX) {
      blob.x = Math.min(maxX, Math.max(minX, blob.x));
      blob.vx *= -1;
    }

    if (blob.y < minY || blob.y > maxY) {
      blob.y = Math.min(maxY, Math.max(minY, blob.y));
      blob.vy *= -1;
    }
  }

  function drawBlob(blob, time, multiplier) {
    const animatedTime = time * motionSpeed;
    const waveX = Math.sin(animatedTime * 0.00019 + blob.phase) * 0.055;
    const waveY = Math.cos(animatedTime * 0.00023 + blob.phase * 1.7) * 0.05;
    const pulse = 1 + Math.sin(animatedTime * 0.00031 + blob.phase) * 0.08;
    const x = (blob.x + waveX) * width;
    const y = (blob.y + waveY) * height;
    const radius = Math.max(width, height) * blob.r * pulse;
    const [red, green, blue] = blob.color;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${blob.alpha * multiplier})`);
    gradient.addColorStop(0.38, `rgba(${red}, ${green}, ${blue}, ${blob.alpha * 0.42 * multiplier})`);
    gradient.addColorStop(0.72, `rgba(${red}, ${green}, ${blue}, ${blob.alpha * 0.12 * multiplier})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function paint(time) {
    const breathe = 0.9 + Math.sin(time * 0.00022 * motionSpeed) * 0.1;

    if (!baseGradient || !shadeGradient) {
      buildPaintCache();
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "screen";
    blobs.forEach((blob) => drawBlob(blob, time, breathe));

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = shadeGradient;
    ctx.fillRect(0, 0, width, height);
  }

  function step(time) {
    if (!visible || reduceMotion.matches) {
      rafId = null;
      return;
    }

    if (!lastTime) {
      lastTime = time;
    }

    if (time - lastFrame >= (scrolling ? scrollFrameInterval : idleFrameInterval)) {
      const delta = Math.min(48, time - lastTime) / 1000;
      blobs.forEach((blob) => {
        moveBlob(blob, delta);
      });
      paint(time);
      lastFrame = time;
      lastTime = time;
    }

    rafId = window.requestAnimationFrame(step);
  }

  function startMotion() {
    ensureCanvas();
    resizeCanvas();
    root.classList.toggle("kigex-motion-run", !reduceMotion.matches);

    if (reduceMotion.matches) {
      paint(performance.now());
      return;
    }

    if (!rafId && visible) {
      lastFrame = 0;
      lastTime = 0;
      rafId = window.requestAnimationFrame(step);
    }
  }

  function stopMotion() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function noteScrollActivity() {
    scrolling = true;

    if (scrollTimer) {
      window.clearTimeout(scrollTimer);
    }

    scrollTimer = window.setTimeout(() => {
      scrolling = false;
    }, 140);
  }

  function requestMotionResize() {
    if (resizeRaf) {
      return;
    }

    resizeRaf = window.requestAnimationFrame(() => {
      resizeRaf = null;
      resizeCanvas();
      paint(performance.now());
    });
  }

  function initMotion() {
    startMotion();
    window.addEventListener("resize", requestMotionResize);
    window.addEventListener("scroll", noteScrollActivity, { passive: true });
    window.addEventListener("wheel", noteScrollActivity, { passive: true });
    window.addEventListener("touchmove", noteScrollActivity, { passive: true });
    document.addEventListener("visibilitychange", () => {
      visible = document.visibilityState !== "hidden";

      if (visible) {
        startMotion();
      } else {
        stopMotion();
      }
    });
  }

  function initMenu() {
    const menuButton = document.querySelector(".menu-toggle");

    if (!menuButton || menuButton.dataset.kigexReady === "true") {
      return;
    }

    menuButton.dataset.kigexReady = "true";
    menuButton.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("nav-open");
      document.body.classList.remove("nav-hidden");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.body.classList.remove("nav-open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initAutoHideNav() {
    const header = document.querySelector(".site-header");
    const menuButton = document.querySelector(".menu-toggle");
    const mobileNav = window.matchMedia("(max-width: 767px)");

    if (!header) {
      return;
    }

    let ticking = false;
    let isHidden = false;

    function closeMenuForScroll(scheduleUpdate = true) {
      if (!document.body.classList.contains("nav-open")) {
        return;
      }

      document.body.classList.remove("nav-open");
      if (menuButton) {
        menuButton.setAttribute("aria-expanded", "false");
      }

      if (scheduleUpdate) {
        window.setTimeout(updateNavVisibility, 80);
      }
    }

    function setHeaderOffset(progress) {
      const hideDistance = header.offsetHeight + 16;
      const shift = -hideDistance * progress;
      const opacity = Math.max(0, 1 - progress * 1.12);

      header.style.setProperty("--nav-shift", `${shift.toFixed(2)}px`);
      header.style.setProperty("--nav-opacity", opacity.toFixed(3));
      header.style.setProperty("--nav-pointer-events", progress > 0.98 ? "none" : "auto");
    }

    function updateNavVisibility() {
      ticking = false;

      if (mobileNav.matches) {
        const hideDistance = Math.max(84, header.offsetHeight + 36);
        const progress = Math.min(1, Math.max(0, window.scrollY / hideDistance));

        if (window.scrollY > 2) {
          closeMenuForScroll(false);
        }

        document.body.classList.add("nav-scroll-linked");
        document.body.classList.remove("nav-hidden");
        isHidden = progress > 0.98;
        setHeaderOffset(progress);
        return;
      }

      document.body.classList.remove("nav-scroll-linked");
      header.style.removeProperty("--nav-shift");
      header.style.removeProperty("--nav-opacity");
      header.style.removeProperty("--nav-pointer-events");
      isHidden = document.body.classList.contains("nav-hidden");

      const shouldHide = window.scrollY > 24;

      if (shouldHide) {
        closeMenuForScroll();
      }

      if (shouldHide === isHidden) {
        return;
      }

      isHidden = shouldHide;
      document.body.classList.toggle("nav-hidden", isHidden);
    }

    function requestNavVisibilityUpdate() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateNavVisibility);
    }

    updateNavVisibility();
    window.addEventListener("scroll", requestNavVisibilityUpdate, { passive: true });
    window.addEventListener("wheel", closeMenuForScroll, { passive: true });
    window.addEventListener("touchmove", closeMenuForScroll, { passive: true });
    window.addEventListener("resize", requestNavVisibilityUpdate);
  }

  function initHeroWordLift() {
    const headlines = Array.from(
      document.querySelectorAll(".home-hero .heading.h2, .word-lift-title"),
    );

    if (!headlines.length) {
      return;
    }

    let activeWord = null;
    let gradientFrame = 0;

    function syncGradientLines() {
      gradientFrame = 0;

      headlines.forEach((headline) => {
        const words = Array.from(headline.querySelectorAll(".hero-word"));

        if (!words.length) {
          return;
        }

        const headlineRect = headline.getBoundingClientRect();
        const lines = [];

        words.forEach((word) => {
          const rect = word.getBoundingClientRect();
          let line = lines.find((entry) => Math.abs(entry.top - rect.top) < 4);

          if (!line) {
            line = {
              top: rect.top,
              left: rect.left,
              right: rect.right,
              words: [],
            };
            lines.push(line);
          }

          line.left = Math.min(line.left, rect.left);
          line.right = Math.max(line.right, rect.right);
          line.words.push({ word, rect });
        });

        lines.forEach((line, index) => {
          const lineWidth = Math.max(1, line.right - line.left);
          const isShortFinalLine = index === lines.length - 1 && line.words.length === 1;
          const gradientWidth = isShortFinalLine
            ? Math.max(lineWidth, headlineRect.width)
            : lineWidth;

          line.words.forEach(({ word, rect }) => {
            word.style.setProperty("--hero-line-width", `${gradientWidth}px`);
            word.style.setProperty("--hero-word-x", `${line.left - rect.left}px`);
          });
        });
      });
    }

    function requestGradientSync() {
      if (gradientFrame) {
        return;
      }

      gradientFrame = window.requestAnimationFrame(syncGradientLines);
    }

    function setActiveWord(nextWord) {
      if (nextWord === activeWord) {
        return;
      }

      if (activeWord) {
        activeWord.classList.remove("is-raised");
      }

      activeWord = nextWord;

      if (activeWord) {
        activeWord.classList.add("is-raised");
      }
    }

    headlines.forEach((headline) => {
      const words = Array.from(headline.querySelectorAll(".hero-word"));

      words.forEach((word) => {
        word.addEventListener("pointerenter", () => {
          setActiveWord(word);
        });
        word.addEventListener("pointerleave", () => {
          setActiveWord(null);
        });
        word.addEventListener("mouseenter", () => {
          setActiveWord(word);
        });
        word.addEventListener("mouseleave", () => {
          setActiveWord(null);
        });
        word.addEventListener("touchstart", () => {
          setActiveWord(word);
          window.setTimeout(() => setActiveWord(null), 650);
        }, { passive: true });
      });

      headline.addEventListener("pointerleave", () => {
        setActiveWord(null);
      });

      headline.addEventListener("mouseleave", () => {
        setActiveWord(null);
      });
    });

    syncGradientLines();
    window.addEventListener("resize", requestGradientSync);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(requestGradientSync).catch(() => {});
    }
  }

  function init() {
    initMotion();
    initMenu();
    initAutoHideNav();
    initHeroWordLift();
  }

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", startMotion);
  } else if (reduceMotion.addListener) {
    reduceMotion.addListener(startMotion);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
