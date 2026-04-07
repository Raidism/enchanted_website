// Safety net: if GSAP or the IIFE below fails for any reason, show all hidden elements after 1.5s
(function revealFallback() {
  var timer = setTimeout(function () {
    var hidden = document.querySelectorAll(".reveal:not(.show)");
    for (var i = 0; i < hidden.length; i++) {
      hidden[i].classList.add("show");
    }
  }, 1500);
  // Cancel the fallback once the IIFE runs its own reveal logic
  window.__cancelRevealFallback = function () { clearTimeout(timer); };
})();

(function initEnchantedSummitAnimations() {
  if (typeof window.__cancelRevealFallback === "function") window.__cancelRevealFallback();

  const setupFaqCards = () => {
    const cards = Array.from(document.querySelectorAll(".faq-card"));
    if (!cards.length) return;

    let currentCard = null;

    const flipCard = (card) => {
      if (currentCard && currentCard !== card) {
        currentCard.classList.remove("flipped");
        currentCard.setAttribute("aria-pressed", "false");
      }
      card.classList.add("flipped");
      card.setAttribute("aria-pressed", "true");
      currentCard = card;
    };

    const unflipCard = (card) => {
      card.classList.remove("flipped");
      card.setAttribute("aria-pressed", "false");
      if (currentCard === card) currentCard = null;
    };

    cards.forEach((card) => {
      if (card.dataset.faqBound === "true") return;
      card.dataset.faqBound = "true";

      card.addEventListener("click", () => {
        card.classList.contains("flipped") ? unflipCard(card) : flipCard(card);
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          card.classList.contains("flipped") ? unflipCard(card) : flipCard(card);
        }
      });

      if (typeof IntersectionObserver !== "undefined") {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting) unflipCard(card);
          },
          { threshold: 0 }
        );
        observer.observe(card);
      }
    });
  };

  // FAQ flip must work even when GSAP is unavailable or animations are reduced.
  setupFaqCards();

  // ─── Typewriter hero headline ──────────────────────────────────────────────
  const initTypewriter = () => {
    const el = document.getElementById("heroTypewriter");
    if (!el) return;
    if (window.__enchantedTypewriterReady) return;
    window.__enchantedTypewriterReady = true;

    const phrases = [
      "The Enchanted Summit",
      "Where Passion Meets Debate",
      "Unite. Dream. Enchant.",
      "Fantasy MUN · Riyadh 2026",
      "Enchanting You Back Into Our World",
    ];

    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let tid = null;
    let running = true;

    const schedule = (delay) => {
      clearTimeout(tid);
      tid = setTimeout(tick, delay);
    };

    const tick = () => {
      if (!running) return;
      const phrase = phrases[phraseIdx];
      el.textContent = deleting
        ? phrase.substring(0, charIdx - 1)
        : phrase.substring(0, charIdx + 1);

      if (deleting) { charIdx--; } else { charIdx++; }

      let delay;
      if (!deleting && charIdx > phrase.length) {
        // Finished typing — pause, then delete
        deleting = true;
        delay = 2000;
      } else if (deleting && charIdx < 0) {
        // Finished deleting — move to next phrase
        deleting = false;
        charIdx = 0;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        delay = 380;
      } else {
        // Natural human-like rhythm
        delay = deleting ? 38 + Math.random() * 18 : 68 + Math.random() * 28;
      }

      schedule(delay);
    };

    // Start shortly after first paint so it feels responsive.
    el.textContent = "";
    schedule(280);

    // Pause when tab is hidden to save CPU
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        running = false;
        clearTimeout(tid);
      } else {
        running = true;
        schedule(300);
      }
    });
  };

  initTypewriter();

  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("show"));
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const userAgent = String(navigator.userAgent || "").toLowerCase();
  const isIOS = /iphone|ipod|ipad/.test(userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isInAppBrowser = /instagram|fbav|fban|line\//.test(userAgent)
    || /twitter|snapchat|pinterest|; wv\)|\bwv\b|webview/.test(userAgent);
  const isPhoneViewport = window.matchMedia("(max-width: 900px)").matches;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = String(connection && connection.effectiveType ? connection.effectiveType : "").toLowerCase();
  const isConstrainedNetwork = Boolean(connection && connection.saveData) || /(^|[^a-z])2g|3g([^a-z]|$)/.test(effectiveType);
  const shouldUseLiteMotion = isIOS && isInAppBrowser && isPhoneViewport;

  if (prefersReducedMotion || isConstrainedNetwork || shouldUseLiteMotion) {
    document.body.classList.add("mobile-reveal-lite");
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("show"));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power3.out", duration: 0.38, overwrite: "auto" });
  document.body.classList.add("gsap-enhanced");

  const scrollProgressEl = document.getElementById("scrollProgress");
  if (scrollProgressEl) {
    scrollProgressEl.style.opacity = "0";
    ScrollTrigger.create({
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        scrollProgressEl.style.width = `${(self.progress * 100).toFixed(2)}%`;
        scrollProgressEl.style.opacity = self.progress > 0.01 ? "1" : "0";
      },
    });
  }

  const siteHeader = document.querySelector(".site-header");
  if (siteHeader) {
    ScrollTrigger.create({
      start: "56px top",
      onEnter: () => siteHeader.classList.add("scrolled"),
      onLeaveBack: () => siteHeader.classList.remove("scrolled"),
    });
  }

  // Reveal section wrappers + non-pop-card elements with scroll trigger (CSS transition)
  // Elements already in the viewport on load are shown with a slight delay so GSAP hero can start first
  gsap.utils.toArray(".reveal:not(.pop-card)").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.96) {
      gsap.delayedCall(0.02, () => el.classList.add("show"));
    } else {
      ScrollTrigger.create({
        trigger: el,
        start: "top 95%",
        once: true,
        onEnter: () => el.classList.add("show"),
      });
    }
  });

  // Section heads: staggered label → h2 → p typography reveals
  document.querySelectorAll(".section-head").forEach((head) => {
    const label = head.querySelector(".section-label");
    const h2 = head.querySelector("h2");
    const p = head.querySelector("p, .lead");
    const targets = [label, h2, p].filter(Boolean);
    if (!targets.length) return;

    gsap.set(targets, { opacity: 0, y: 22 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: head, start: "top 90%", once: true },
    });
    if (label) tl.to(label, { opacity: 1, y: 0, duration: 0.32, ease: "power2.out" }, 0);
    if (h2) tl.to(h2, { opacity: 1, y: 0, duration: 0.42, ease: "power3.out" }, 0.06);
    if (p) tl.to(p, { opacity: 1, y: 0, duration: 0.34, ease: "power2.out" }, 0.14);
  });

  // About-stat strip: staggered reveal
  const aboutStats = document.querySelectorAll(".about-stat");
  if (aboutStats.length) {
    gsap.set(aboutStats, { opacity: 0, y: 28, scale: 0.96 });
    gsap.to(aboutStats, {
      scrollTrigger: { trigger: ".about-stat-strip", start: "top 94%", once: true },
      opacity: 1, y: 0, scale: 1, stagger: 0.05, duration: 0.36, ease: "expo.out",
    });
  }

  // Secretariat section should stay stable with no special motion effects.
  document.querySelectorAll(".team-card.reveal").forEach((el) => {
    el.classList.add("show");
    gsap.set(el, { clearProps: "all" });
  });

  const countdownCells = gsap.utils.toArray(".count-item");
  if (countdownCells.length) {
    gsap.set(countdownCells, { opacity: 0, y: 14 });
    gsap.to(countdownCells, {
      scrollTrigger: { trigger: "#join", start: "top 94%", once: true },
      opacity: 1,
      y: 0,
      stagger: 0.025,
      duration: 0.3,
      ease: "power2.out",
    });
  }

  const detailBlocks = gsap.utils.toArray(".share-panel, #contact .contact-card");
  detailBlocks.forEach((block, index) => {
    gsap.fromTo(
      block,
      { opacity: 0, y: 24, scale: 0.985 },
      {
        scrollTrigger: { trigger: block, start: "top 92%", once: true },
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.34,
        delay: index * 0.02,
        ease: "expo.out",
      }
    );
  });

  const footerLinks = gsap.utils.toArray(".site-footer .footer-links a");
  if (footerLinks.length) {
    gsap.set(footerLinks, { opacity: 0, y: 12 });
    gsap.to(footerLinks, {
      scrollTrigger: { trigger: ".site-footer", start: "top 96%", once: true },
      opacity: 1,
      y: 0,
      stagger: 0.03,
      duration: 0.28,
      ease: "power2.out",
    });
  }

  if (!isTouchDevice) {
    const heroTl = gsap.timeline({ defaults: { duration: 0.74, ease: "power3.out" } });
    const heroLogo = document.querySelector(".hero-logo-card");
    const eyebrow = document.querySelector(".hero .section-label") || document.querySelector(".hero .eyebrow");
    const heroTitle = document.querySelector(".hero-content h1");
    const heroText = document.querySelector(".hero .subheadline") || document.querySelector(".hero-text");
    const heroBadges = document.querySelectorAll(".hero-tags .hero-tag").length ? document.querySelectorAll(".hero-tags .hero-tag") : document.querySelectorAll(".hero-badges span");
    const heroActions = document.querySelectorAll(".hero-cta-row .cta");

    if (heroLogo) heroTl.fromTo(heroLogo, { opacity: 0, y: 36, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.92 }, 0);
    if (eyebrow) heroTl.from(eyebrow, { opacity: 0, y: 16 }, 0.12);
    if (heroTitle) heroTl.from(heroTitle, { opacity: 0, y: 24 }, 0.2);
    if (heroText) heroTl.from(heroText, { opacity: 0, y: 16, duration: 0.65 }, 0.3);
    if (heroBadges.length) heroTl.from(heroBadges, { opacity: 0, y: 14, stagger: 0.06, duration: 0.52 }, 0.38);
    if (heroActions.length) heroTl.from(heroActions, { opacity: 0, y: 16, stagger: 0.08, duration: 0.56 }, 0.46);
  }

  const staggerGroups = [
    ".team-roles-card.reveal.pop-card",
    ".value-card.reveal.pop-card",
    ".stat-card.reveal.pop-card",
    ".launch-card.reveal.pop-card",
    ".faq-card.reveal.pop-card",
    ".eb-leader-card.reveal.pop-card",
    ".eb-dept.reveal.pop-card",
  ];

  staggerGroups.forEach((selector) => {
    const targets = document.querySelectorAll(selector);
    if (!targets.length) return;

    gsap.set(targets, { opacity: 0, y: 28, scale: 0.97 });
    ScrollTrigger.batch(targets, {
      start: "top 95%",
      once: true,
      interval: 0.03,
      batchMax: 6,
      onEnter: (batch) => {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.045,
          duration: 0.34,
          ease: "expo.out",
          onComplete: function onBatchComplete() {
            this.targets().forEach((el) => {
              el.classList.add("show");
              gsap.set(el, { clearProps: "all" });
            });
          },
        });
      },
    });
  });

  const roadmapItems = document.querySelectorAll(".road-item");
  if (roadmapItems.length) {
    gsap.from(roadmapItems, {
      scrollTrigger: { trigger: ".roadmap-card", start: "top 94%", once: true },
      opacity: 0,
      x: -24,
      stagger: 0.05,
      duration: 0.34,
      ease: "power2.out",
    });
  }

  const featureSingles = document.querySelectorAll(".roadmap-card.reveal.pop-card, .share-panel.reveal.pop-card");
  featureSingles.forEach((el) => {
    gsap.fromTo(el, {
      opacity: 0,
      y: 24,
      scale: 0.98,
    }, {
      scrollTrigger: { trigger: el, start: "top 95%", once: true },
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.34,
      ease: "expo.out",
      onComplete: () => {
        el.classList.add("show");
        gsap.set(el, { clearProps: "all" });
      },
    });
  });

  const statNumbers = document.querySelectorAll(".stat-main");
  statNumbers.forEach((el) => {
    const rawText = (el.textContent || "").trim();
    if (!/^\d[\d,]*$/.test(rawText)) {
      return;
    }

    const numeric = Number(rawText.replace(/[^\d]/g, ""));
    if (!numeric || Number.isNaN(numeric)) return;

    const counter = { val: 0 };
    gsap.to(counter, {
      val: numeric,
      duration: 0.9,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
      onUpdate: () => {
        el.textContent = Math.round(counter.val).toLocaleString();
      },
    });
  });

  // Deliberately keep hover interactions subtle and CSS-only for stability.

  const navAnchors = Array.from(document.querySelectorAll(".nav-links a[href^='#']"));
  const navSections = navAnchors
    .map((anchor) => document.getElementById((anchor.getAttribute("href") || "").slice(1)))
    .filter(Boolean);

  const clearActiveNavSection = () => {
    navAnchors.forEach((anchor) => anchor.classList.remove("active-section"));
  };

  const setActiveNavSection = (index) => {
    clearActiveNavSection();
    if (index >= 0 && navAnchors[index]) {
      navAnchors[index].classList.add("active-section");
    }
  };

  const updateActiveNavSection = () => {
    if (!navAnchors.length || !navSections.length) return;

    const siteHeader = document.getElementById("siteHeader");
    const headerHeight = siteHeader ? siteHeader.offsetHeight : 0;
    const scrollTop = window.scrollY || window.pageYOffset || 0;

    if (scrollTop <= Math.max(16, headerHeight * 0.35)) {
      clearActiveNavSection();
      return;
    }

    const probeLine = headerHeight + Math.min(120, window.innerHeight * 0.22);
    let activeIndex = navSections.findIndex((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= probeLine && rect.bottom > probeLine;
    });

    if (activeIndex === -1) {
      navSections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probeLine) activeIndex = index;
      });
    }

    setActiveNavSection(activeIndex);
  };

  updateActiveNavSection();
  window.addEventListener("scroll", updateActiveNavSection, { passive: true });
  window.addEventListener("resize", updateActiveNavSection);
  ScrollTrigger.addEventListener("refresh", updateActiveNavSection);

  gsap.set(document.body, { opacity: 0 });
  gsap.to(document.body, { opacity: 1, duration: 0.38, ease: "power2.out", clearProps: "opacity" });

  let isPageTransitioning = false;
  document.querySelectorAll("a[href]").forEach((link) => {
    if (shouldUseLiteMotion) return;
    const href = link.getAttribute("href") || "";
    const target = (link.getAttribute("target") || "").toLowerCase();
    if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("//") || href.startsWith("mailto") || href.startsWith("tel") || href.startsWith("javascript:") || target === "_blank" || link.hasAttribute("download")) {
      return;
    }

    const destination = new URL(href, window.location.href);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const targetPath = `${destination.pathname}${destination.search}`;
    if (destination.origin !== window.location.origin || targetPath === currentPath) {
      return;
    }

    const isCreditLink = link.classList.contains("credit-link");
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (isPageTransitioning) return;
      isPageTransitioning = true;
      event.preventDefault();
      gsap.killTweensOf(document.body);
      gsap.set(document.body, { willChange: "opacity" });
      gsap.to(document.body, {
        opacity: 0,
        duration: isCreditLink ? 0.22 : 0.28,
        ease: "power2.inOut",
        overwrite: true,
        onComplete: () => { window.location.href = destination.pathname + destination.search + destination.hash; },
      });
    });
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  const resetInteractiveTransforms = () => {
    document.querySelectorAll(".team-card, .stat-card, .launch-card, .value-card, .cta, .share-btn, .waitlist-form button").forEach((el) => {
      gsap.set(el, { clearProps: "transform,filter" });
    });
    gsap.set(document.body, { clearProps: "opacity,filter" });
  };

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      resetInteractiveTransforms();
      ScrollTrigger.refresh();
    }
  });
})();
