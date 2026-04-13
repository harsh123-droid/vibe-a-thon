const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const THEME_KEY = "harsh-portfolio-theme";
const SOUND_KEY = "harsh-portfolio-sound";
const SOUND_VOLUME_KEY = "harsh-portfolio-sfx-volume";
const SESSION_STARTED_KEY = "harsh-portfolio-session-started";

/** Web Audio UI + volume (respects reduced motion). */
const audio = {
  play() {},
  setVolumePct() {},
  getVolumePct() {
    return 70;
  },
  setEnabled() {},
  isEnabled() {
    return false;
  },
};

function particlePalette() {
  const light = document.documentElement.getAttribute("data-theme") === "light";
  return light
    ? { fill: "60, 95, 150", stroke: "90, 130, 195", fillDim: "60, 95, 150" }
    : { fill: "180, 210, 255", stroke: "140, 200, 255", fillDim: "180, 210, 255" };
}

/* --- Dark / light theme toggle --- */
function initTheme() {
  const btn = $("#themeToggle");
  const sync = () => {
    const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const darkOn = theme === "dark";
    btn?.setAttribute("aria-checked", darkOn ? "true" : "false");
    btn?.setAttribute("aria-label", darkOn ? "Dark mode on. Switch to light mode." : "Light mode on. Switch to dark mode.");
  };

  sync();

  btn?.addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_) {}
    sync();
    audio.play("toggle");
  });

  window.addEventListener("storage", (e) => {
    if (e.key !== THEME_KEY || (e.newValue !== "dark" && e.newValue !== "light")) return;
    document.documentElement.setAttribute("data-theme", e.newValue);
    sync();
  });
}

function initSounds() {
  const btn = $("#soundToggle");
  const volumeStack = $("#volumeStack");
  let ctx = null;
  let enabled = false;
  let volumePct = 70;

  try {
    enabled = localStorage.getItem(SOUND_KEY) === "on";
  } catch (_) {}
  try {
    const v = parseInt(localStorage.getItem(SOUND_VOLUME_KEY), 10);
    if (!Number.isNaN(v) && v >= 0 && v <= 100) volumePct = v;
  } catch (_) {}

  function gainMul() {
    if (!enabled || prefersReducedMotion()) return 0;
    return volumePct / 100;
  }

  function resume() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.resolve(null);
    if (!ctx) ctx = new AC();
    return ctx.state === "suspended" ? ctx.resume().then(() => ctx) : Promise.resolve(ctx);
  }

  function tone(c, freq, dur, vol = 0.065) {
    const gm = gainMul();
    if (gm <= 0.0001) return;
    const eff = vol * gm;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(eff, t0 + 0.012);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  function play(kind) {
    if (!enabled || prefersReducedMotion()) return;
    resume().then((c) => {
      if (!c) return;
      if (kind === "tap") {
        tone(c, 740, 0.045);
      } else if (kind === "toggle") {
        tone(c, 392, 0.055);
        setTimeout(() => {
          if (ctx) tone(ctx, 659, 0.048);
        }, 72);
      } else if (kind === "achievement") {
        tone(c, 523, 0.085, 0.072);
        setTimeout(() => {
          if (ctx) tone(ctx, 784, 0.095, 0.055);
        }, 88);
      } else if (kind === "level") {
        tone(c, 330, 0.11, 0.078);
        setTimeout(() => {
          if (ctx) tone(ctx, 440, 0.13, 0.068);
        }, 105);
        setTimeout(() => {
          if (ctx) tone(ctx, 554, 0.15, 0.052);
        }, 228);
      } else if (kind === "start") {
        tone(c, 392, 0.07, 0.09);
        setTimeout(() => {
          if (ctx) tone(ctx, 523, 0.08, 0.085);
        }, 95);
        setTimeout(() => {
          if (ctx) tone(ctx, 659, 0.1, 0.075);
        }, 195);
        setTimeout(() => {
          if (ctx) tone(ctx, 880, 0.14, 0.065);
        }, 310);
      } else {
        tone(c, 620, 0.048);
      }
    });
  }

  function syncVolumeSliders() {
    $$(".js-sfx-volume").forEach((el) => {
      el.value = String(volumePct);
      el.setAttribute("aria-valuenow", String(volumePct));
    });
    const sp = $("#startVolPct");
    const hp = $("#hudVolPct");
    if (sp) sp.textContent = `${volumePct}%`;
    if (hp) hp.textContent = String(volumePct);
  }

  function syncBtn() {
    btn?.classList.toggle("sound-toggle--on", enabled);
    btn?.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn?.setAttribute(
      "aria-label",
      enabled ? "Sound on. Mute UI sounds." : "Sound off. Enable UI sounds."
    );
    volumeStack?.classList.toggle("volume-stack--muted", !enabled);
  }

  audio.play = play;
  audio.getVolumePct = () => volumePct;
  audio.setVolumePct = (n) => {
    volumePct = Math.max(0, Math.min(100, Math.round(Number(n))));
    try {
      localStorage.setItem(SOUND_VOLUME_KEY, String(volumePct));
    } catch (_) {}
    syncVolumeSliders();
  };
  audio.isEnabled = () => enabled;
  audio.setEnabled = (v) => {
    enabled = !!v;
    try {
      localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    } catch (_) {}
    syncBtn();
  };

  syncBtn();
  syncVolumeSliders();

  $$(".js-sfx-volume").forEach((slider) => {
    slider.addEventListener("input", () => {
      audio.setVolumePct(slider.value);
    });
  });

  btn?.addEventListener("click", () => {
    audio.setEnabled(!audio.isEnabled());
    resume().then((c) => {
      if (audio.isEnabled() && c) play("tap");
    });
  });
}

function initGameStart() {
  const overlay = $("#gameStart");
  const startBtn = $("#gameStartBtn");
  const sfxCheck = $("#startSfxEnable");
  if (!overlay) return;

  let sessionOk = false;
  try {
    sessionOk = sessionStorage.getItem(SESSION_STARTED_KEY) === "1";
  } catch (_) {}

  if (prefersReducedMotion() || sessionOk) {
    overlay.classList.add("is-dismissed");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("game-start-open");
    return;
  }

  document.body.classList.add("game-start-open");
  if (sfxCheck) sfxCheck.checked = audio.isEnabled();
  requestAnimationFrame(() => startBtn?.focus());

  startBtn?.addEventListener("click", () => {
    if (sfxCheck) audio.setEnabled(sfxCheck.checked);
    try {
      sessionStorage.setItem(SESSION_STARTED_KEY, "1");
    } catch (_) {}
    document.body.classList.remove("game-start-open");
    overlay.classList.add("is-dismissed");
    overlay.setAttribute("aria-hidden", "true");
    audio.play("start");
    requestAnimationFrame(() => {
      $("#ctaQuestNew")?.focus({ preventScroll: true });
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}

/* --- Particle field (component: ambient motion) --- */
function initParticles() {
  const canvas = $("#particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let w = 0;
  let h = 0;
  const particles = [];
  const COUNT = 55;

  function resize() {
    w = canvas.width = window.innerWidth * window.devicePixelRatio;
    h = canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  }

  class P {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.z = Math.random() * 0.6 + 0.2;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = (Math.random() - 0.5) * 0.35;
      this.r = Math.random() * 1.8 + 0.3;
    }
    step() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > w) this.vx *= -1;
      if (this.y < 0 || this.y > h) this.vy *= -1;
    }
    draw(mouse, pal) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.hypot(dx, dy);
      let px = this.x;
      let py = this.y;
      if (dist < 140 && dist > 0) {
        const f = (140 - dist) / 140;
        px -= (dx / dist) * f * 22 * this.z;
        py -= (dy / dist) * f * 22 * this.z;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(${pal.fill}, ${0.12 + this.z * 0.35})`;
      ctx.arc(px, py, this.r * this.z * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const mouse = { x: 0, y: 0 };
  window.addEventListener(
    "mousemove",
    (e) => {
      mouse.x = e.clientX * window.devicePixelRatio;
      mouse.y = e.clientY * window.devicePixelRatio;
    },
    { passive: true }
  );

  function init() {
    resize();
    particles.length = 0;
    for (let i = 0; i < COUNT; i++) particles.push(new P());
  }

  let raf = 0;
  function loop() {
    const pal = particlePalette();
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.step();
      p.draw(mouse, pal);
    }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) {
          ctx.strokeStyle = `rgba(${pal.stroke}, ${(1 - d / 110) * 0.08})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", init);
  init();
  if (!prefersReducedMotion()) loop();
  else {
    const pal = particlePalette();
    ctx.fillStyle = `rgba(${pal.fillDim},0.06)`;
    for (const p of particles) {
      p.draw({ x: -9999, y: -9999 }, pal);
    }
  }
}

/* --- Home scroll transition: hero compacts as user scrolls --- */
function initHeroScroll() {
  const hero = $(".hero");
  if (!hero) return;

  const update = () => {
    const scrollY = window.scrollY;
    const vh = window.innerHeight;
    const t = Math.min(1, Math.max(0, scrollY / (vh * 0.85)));
    hero.style.setProperty("--hero-shrink", t.toFixed(4));
    document.body.classList.toggle("hero-scrolling", scrollY > 8);
    if (t > 0.02) hero.classList.add("hero--compact");
    else hero.classList.remove("hero--compact");
  };

  window.addEventListener("scroll", update, { passive: true });
  update();
}

function initHeroRingParallax() {
  const hero = $(".hero");
  const rings = $(".hero__rings");
  if (!hero || !rings || prefersReducedMotion()) return;

  let tx = 0;
  let ty = 0;
  let rx = 0;
  let ry = 0;

  hero.addEventListener(
    "mousemove",
    (e) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
    },
    { passive: true }
  );

  hero.addEventListener(
    "mouseleave",
    () => {
      tx = 0;
      ty = 0;
    },
    { passive: true }
  );

  const maxX = 38;
  const maxY = 30;

  function tick() {
    rx += (tx - rx) * 0.065;
    ry += (ty - ry) * 0.065;
    rings.style.setProperty("--px", `${rx * maxX * 2}px`);
    rings.style.setProperty("--py", `${ry * maxY * 2}px`);
    requestAnimationFrame(tick);
  }
  tick();
}

/* --- XP bar + level from scroll depth --- */
function initProgression() {
  const xpFill = $("#xpFill");
  const xpPct = $("#xpPct");
  const levelEl = $("#level");
  if (!xpFill || !xpPct || !levelEl) return;

  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  let lastLvl = 1;

  const onScroll = () => {
    const p = window.scrollY / maxScroll();
    const pct = Math.round(p * 100);
    xpFill.style.width = `${pct}%`;
    xpPct.textContent = String(pct);
    const lvl = Math.min(10, 1 + Math.floor(pct / 20));
    levelEl.textContent = String(lvl);
    document.querySelector(".xp-bar")?.setAttribute("aria-valuenow", String(pct));
    if (lvl > lastLvl) {
      lastLvl = lvl;
      audio.play("level");
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
}

/* --- Achievement toasts --- */
const unlocked = new Set();
function toast(html) {
  const stack = $("#toastStack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = html;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.4s";
    setTimeout(() => el.remove(), 450);
  }, 4200);
}

function initAchievements() {
  const milestones = [
    ["quests", "Side quest: opened the <strong>project board</strong>."],
    ["skills", "Skill tree: <strong>horizontal mastery</strong> discovered."],
    ["loot", "Loot: <strong>social links</strong> revealed."],
    ["contact", "Main quest: <strong>contact form</strong> in range."],
  ];

  milestones.forEach(([id, msg]) => {
    const el = document.querySelector(`[data-section="${id}"]`);
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || unlocked.has(id)) continue;
          unlocked.add(id);
          toast(`Achievement — ${msg}`);
          audio.play("achievement");
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
  });
}

/* --- Magnetic hover --- */
function initMagnetic() {
  $$(".magnetic").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.15;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.15;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  });
}

/* --- 3D tilt cards --- */
function initTilt() {
  $$("[data-tilt]").forEach((card) => {
    const glare = $(".tilt-card__glare", card);
    const max = 12;

    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -2 * max;
      const ry = (px - 0.5) * 2 * max;
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      if (glare) {
        glare.style.setProperty("--gx", `${px * 100}%`);
        glare.style.setProperty("--gy", `${py * 100}%`);
      }
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

/* --- Horizontal skill strip: drag to scroll --- */
function initHScroll() {
  const strip = $("#skillStrip");
  if (!strip) return;

  let isDown = false;
  let startX;
  let scrollLeft;
  
  let targetX = strip.scrollLeft;
  let currentX = strip.scrollLeft;
  let rafId = null;

  function lerp() {
    currentX += (targetX - currentX) * 0.08;
    if (Math.abs(targetX - currentX) < 0.5) {
      currentX = targetX;
      strip.scrollLeft = currentX;
      rafId = null;
      return;
    }
    strip.scrollLeft = currentX;
    rafId = requestAnimationFrame(lerp);
  }

  function triggerLerp() {
    if (!rafId) {
      currentX = strip.scrollLeft;
      rafId = requestAnimationFrame(lerp);
    }
  }

  strip.addEventListener("mousedown", (e) => {
    isDown = true;
    strip.classList.add("dragging");
    startX = e.pageX - strip.offsetLeft;
    scrollLeft = strip.scrollLeft;
    targetX = scrollLeft;
    strip.style.scrollSnapType = "none";
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  });

  strip.addEventListener("mouseleave", () => {
    isDown = false;
    strip.classList.remove("dragging");
    strip.style.scrollSnapType = "";
  });

  strip.addEventListener("mouseup", () => {
    isDown = false;
    strip.classList.remove("dragging");
    strip.style.scrollSnapType = "";
  });

  strip.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - strip.offsetLeft;
    const walk = (x - startX) * 1.5;
    targetX = scrollLeft - walk;
    currentX = targetX; 
    strip.scrollLeft = currentX;
  });

  let wheelTimeout;

  strip.addEventListener("wheel", (e) => {
    if (e.deltaY !== 0) {
      const isAtLeft = strip.scrollLeft <= 1;
      const isAtRight = Math.ceil(strip.scrollLeft + strip.clientWidth) >= strip.scrollWidth - 1;

      if ((isAtLeft && e.deltaY < 0) || (isAtRight && e.deltaY > 0)) {
        return; 
      }

      e.preventDefault();
      strip.style.scrollSnapType = "none";
      
      targetX = Math.max(0, Math.min(strip.scrollWidth - strip.clientWidth, targetX + e.deltaY * 2.5));
      triggerLerp();

      clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        strip.style.scrollSnapType = "";
      }, 250);
    }
  }, { passive: false });
  
  strip.addEventListener("scroll", () => {
    if (!rafId && !isDown) {
      targetX = strip.scrollLeft;
      currentX = strip.scrollLeft;
    }
  }, { passive: true });
}

/* --- Dock navigation --- */
function initDock() {
  $$(".dock__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.play("tap");
      const id = btn.getAttribute("data-scroll");
      const target = id ? $(`#${id}`) || $(`[data-section="${id}"]`) : null;
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  });

  $("#ctaQuestNew")?.addEventListener("click", (e) => {
    audio.play("tap");
    if (!prefersReducedMotion()) {
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      for (let i = 0; i < 14; i++) {
        const p = document.createElement("div");
        p.className = "btn-burst-particle";
        document.body.appendChild(p);
        const size = Math.random() * 6 + 3;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${centerX - size / 2}px`;
        p.style.top = `${centerY - size / 2 + window.scrollY}px`;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 70 + 30;
        p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
        p.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
        setTimeout(() => p.remove(), 650);
      }
    }
    $("#quests")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  });
}

const DOCK_SECTIONS = ["hero", "quests", "skills", "loot", "contact"];

function initDockSpy() {
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY + Math.min(140, window.innerHeight * 0.22);
    let active = "hero";
    for (const id of DOCK_SECTIONS) {
      const el = document.getElementById(id);
      if (el && y >= el.offsetTop - 4) active = id;
    }
    $$(".dock__btn").forEach((btn) => {
      btn.classList.toggle("dock__btn--active", btn.getAttribute("data-scroll") === active);
    });
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update);
  update();
}

function initScrollReveal() {
  const sections = $$(".section--rise");
  const footer = $(".footer--rise");
  if (prefersReducedMotion()) {
    sections.forEach((el) => el.classList.add("section--rise-visible"));
    footer?.classList.add("footer--rise-visible");
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (e.target.classList.contains("footer--rise")) {
          e.target.classList.add("footer--rise-visible");
        } else {
          e.target.classList.add("section--rise-visible");
        }
      }
    },
    { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
  );
  sections.forEach((el) => obs.observe(el));
  if (footer) obs.observe(footer);
}

/* --- Contact form --- */
function initForm() {
  $("#contactForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    audio.play("tap");
    toast("Transmission received — <strong>+50 XP</strong> (demo: wire to your backend).");
    e.target.reset();
  });

  $("#resumeOrb")?.addEventListener("click", (e) => {
    e.preventDefault();
    audio.play("tap");
    toast("Equip <strong>résumé.pdf</strong> — replace this handler with your file link.");
  });
}

function initPointerFollow() {
  const blob = $(".cursor-blob");
  const root = $("#cursorUi");
  const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
  const useCustom = mq.matches && !prefersReducedMotion();
  const dot = root ? $(".cursor-ui__dot", root) : null;
  const ring = root ? $(".cursor-ui__ring", root) : null;

  if (useCustom && root && dot && ring) {
    document.body.classList.add("has-fine-cursor");
  }

  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let mx = tx;
  let my = ty;
  let rx = tx;
  let ry = ty;

  window.addEventListener(
    "mousemove",
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (blob) {
        blob.style.left = `${tx}px`;
        blob.style.top = `${ty}px`;
      }
      if (!useCustom || !root || !dot || !ring) return;
      const typing = e.target.closest("input, textarea, select");
      const hit = e.target.closest(
        "a, button, [role='button'], .tilt-card, .dock__btn, .loot-orb, .magnetic"
      );
      root.classList.toggle("cursor-ui--hide", !!typing);
      root.classList.toggle("cursor-ui--hover", !!hit && !typing);
    },
    { passive: true }
  );

  if (!useCustom || !root || !dot || !ring) return;

  function loop() {
    mx += (tx - mx) * 0.38;
    my += (ty - my) * 0.38;
    rx += (tx - rx) * 0.14;
    ry += (ty - ry) * 0.14;
    dot.style.left = `${mx}px`;
    dot.style.top = `${my}px`;
    ring.style.left = `${rx}px`;
    ring.style.top = `${ry}px`;
    requestAnimationFrame(loop);
  }
  loop();
}

/* --- Global Loader --- */
function initLoader() {
  const loader = $("#loader");
  if (!loader) return;
  // Ensure a minimum display time for the cool ripple effect
  const minTime = 1200;
  const start = Date.now();
  
  const finishLoad = () => {
    const elapsed = Date.now() - start;
    const delay = Math.max(0, minTime - elapsed);
    setTimeout(() => {
      loader.classList.add("is-loaded");
    }, delay);
  };

  if (document.readyState === "complete") {
    finishLoad();
  } else {
    window.addEventListener("load", finishLoad);
  }
}

/* --- Continuous 3D Carousel --- */
function initCarousel() {
  const cards = $$(".carousel-card");
  const prevBtn = $(".carousel__btn--prev");
  const nextBtn = $(".carousel__btn--next");
  const track = $("#questCarousel");
  if (!cards.length || !track) return;

  const total = cards.length;
  let currentProgress = 0;
  let targetProgress = 0;
  let rafId = null;

  function lerp() {
    currentProgress += (targetProgress - currentProgress) * 0.08;
    
    if (Math.abs(targetProgress - currentProgress) < 0.005) {
      currentProgress = targetProgress;
      rafId = null;
    } else {
      rafId = requestAnimationFrame(lerp);
    }
    
    cards.forEach((card, i) => {
      let dist = (i - currentProgress) % total;
      if (dist > total / 2) dist -= total;
      if (dist < -total / 2) dist += total;
      
      const sign = Math.sign(dist);
      const absDist = Math.abs(dist);
      
      let scale = 1, tx = 0, tz = 0, ry = 0, opacity = 1, zIndex = 5;

      if (absDist <= 1) {
        scale = 1 - (0.3 * absDist); 
        tx = sign * 55 * absDist;    
        tz = -150 * absDist;         
        ry = -sign * 15 * absDist;   
        opacity = 1 - (0.55 * absDist);
        zIndex = absDist > 0.5 ? 4 : 5;
      } else if (absDist <= 2) {
        const d2 = absDist - 1;
        scale = 0.7 - (0.15 * d2);
        tx = sign * (55 + 30 * d2); 
        tz = -150 - 100 * d2;
        ry = -sign * (15 + 10 * d2);
        opacity = 0.45 * (1 - d2); 
        zIndex = 3;
      } else {
        opacity = 0;
        zIndex = 1;
        scale = 0.55;
        tx = sign * 85;
        tz = -250;
        ry = -sign * 25;
      }

      card.style.transform = `translateX(${tx}%) scale(${scale}) translateZ(${tz}px) rotateY(${ry}deg)`;
      card.style.opacity = opacity;
      card.style.zIndex = Math.round(zIndex);
      card.style.transition = "none";
      card.style.pointerEvents = absDist > 0.5 ? "none" : "auto";
      
      if (absDist < 0.1) card.classList.add("is-active");
      else card.classList.remove("is-active");
    });
  }

  function triggerLerp() {
    if (!rafId) rafId = requestAnimationFrame(lerp);
  }

  cards.forEach(c => c.className = "carousel-card");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      targetProgress -= 1;
      if(audio.play) audio.play("tap");
      triggerLerp();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      targetProgress += 1;
      if(audio.play) audio.play("tap");
      triggerLerp();
    });
  }

  let isDown = false;
  let startX = 0;
  
  const moveStart = (x) => {
    isDown = true;
    startX = x;
    track.style.cursor = "grabbing";
  };
  const moveUpdate = (x) => {
    if (!isDown) return;
    const diff = (x - startX);
    targetProgress -= diff / 350; 
    startX = x;
    triggerLerp();
  };
  const moveEnd = () => {
    if (!isDown) return;
    isDown = false;
    track.style.cursor = "";
    targetProgress = Math.round(targetProgress);
    triggerLerp();
  };

  track.addEventListener("mousedown", e => { e.preventDefault(); moveStart(e.pageX); });
  window.addEventListener("mousemove", e => moveUpdate(e.pageX));
  window.addEventListener("mouseup", moveEnd);

  track.addEventListener("touchstart", e => moveStart(e.changedTouches[0].screenX), {passive:true});
  track.addEventListener("touchmove", e => moveUpdate(e.changedTouches[0].screenX), {passive:true});
  track.addEventListener("touchend", moveEnd);

  let wheelTo = null;
  track.addEventListener("wheel", e => {
     e.preventDefault();
     targetProgress += e.deltaY > 0 ? 0.15 : -0.15;
     triggerLerp();
     
     clearTimeout(wheelTo);
     wheelTo = setTimeout(() => {
        targetProgress = Math.round(targetProgress);
        triggerLerp();
     }, 150);
  }, {passive: false});

  triggerLerp();
}

initLoader();
initSounds();
initTheme();
initParticles();
initHeroScroll();
initHeroRingParallax();
initPointerFollow();
initProgression();
initAchievements();
initMagnetic();
initTilt();
initHScroll();
initCarousel();
initDock();
initDockSpy();
initScrollReveal();
initForm();
initGameStart();
