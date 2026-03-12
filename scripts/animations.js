(function initImperiumAnimations() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("show"));
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  if (prefersReducedMotion) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("show"));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power3.out", duration: 0.72, overwrite: "auto" });
  document.body.classList.add("gsap-enhanced");

  const scrollProgressEl = document.getElementById("scrollProgress");
  if (scrollProgressEl) {
    ScrollTrigger.create({
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        scrollProgressEl.style.width = `${(self.progress * 100).toFixed(2)}%`;
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

  document.querySelectorAll(".section.reveal, .reveal:not(.pop-card)").forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
    el.classList.add("show");
  });

  if (!isTouchDevice) {
    const heroTl = gsap.timeline({ defaults: { duration: 0.74, ease: "power3.out" } });
    const heroLogo = document.querySelector(".hero-logo-card");
    const eyebrow = document.querySelector(".hero .eyebrow");
    const heroTitle = document.querySelector(".hero-content h1");
    const heroText = document.querySelector(".hero-text");
    const heroBadges = document.querySelectorAll(".hero-badges span");
    const heroActions = document.querySelectorAll(".hero-cta-row .cta");

    if (heroLogo) heroTl.from(heroLogo, { opacity: 0, y: 36, scale: 0.9, duration: 0.92 }, 0);
    if (eyebrow) heroTl.from(eyebrow, { opacity: 0, y: 16 }, 0.12);
    if (heroTitle) heroTl.from(heroTitle, { opacity: 0, y: 24 }, 0.2);
    if (heroText) heroTl.from(heroText, { opacity: 0, y: 16, duration: 0.65 }, 0.3);
    if (heroBadges.length) heroTl.from(heroBadges, { opacity: 0, y: 14, stagger: 0.06, duration: 0.52 }, 0.38);
    if (heroActions.length) heroTl.from(heroActions, { opacity: 0, y: 16, stagger: 0.08, duration: 0.56 }, 0.46);
  }

  const staggerGroups = [
    ".value-card.reveal.pop-card",
    ".team-card.reveal.pop-card",
    ".stat-card.reveal.pop-card",
    ".launch-card.reveal.pop-card",
    ".faq-card.reveal.pop-card",
  ];

  staggerGroups.forEach((selector) => {
    const targets = document.querySelectorAll(selector);
    if (!targets.length) return;

    gsap.set(targets, { opacity: 0, y: 28, scale: 0.97 });
    ScrollTrigger.batch(targets, {
      start: "top 86%",
      once: true,
      interval: 0.06,
      batchMax: 6,
      onEnter: (batch) => {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.08,
          duration: 0.78,
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
      scrollTrigger: { trigger: ".roadmap-card", start: "top 84%", once: true },
      opacity: 0,
      x: -24,
      stagger: 0.1,
      duration: 0.65,
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
      scrollTrigger: { trigger: el, start: "top 86%", once: true },
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.72,
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
      duration: 1.3,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
      onUpdate: () => {
        el.textContent = Math.round(counter.val).toLocaleString();
      },
    });
  });

  if (!isTouchDevice) {
    document.querySelectorAll(".team-card, .stat-card, .launch-card, .value-card").forEach((card) => {
      const qx = gsap.quickTo(card, "rotateY", { duration: 0.26, ease: "power2.out", overwrite: "auto" });
      const qy = gsap.quickTo(card, "rotateX", { duration: 0.26, ease: "power2.out", overwrite: "auto" });
      const qz = gsap.quickTo(card, "y", { duration: 0.26, ease: "power2.out", overwrite: "auto" });

      card.addEventListener("mousemove", (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        qx(px * 6);
        qy(-py * 4.5);
        qz(-4);
      });

      card.addEventListener("mouseleave", () => {
        qx(0);
        qy(0);
        qz(0);
      });
    });

    document.querySelectorAll(".cta, .share-btn, .waitlist-form button").forEach((btn) => {
      const quickX = gsap.quickTo(btn, "x", { duration: 0.22, ease: "power2.out", overwrite: "auto" });
      const quickY = gsap.quickTo(btn, "y", { duration: 0.22, ease: "power2.out", overwrite: "auto" });

      btn.addEventListener("mousemove", (event) => {
        const rect = btn.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.04;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.03;
        quickX(Math.max(-5, Math.min(5, x)));
        quickY(Math.max(-4, Math.min(4, y)));
      });

      btn.addEventListener("mouseleave", () => {
        quickX(0);
        quickY(0);
      });
    });
  }

  const navAnchors = Array.from(document.querySelectorAll(".nav-links a[href^='#']"));
  const navSections = navAnchors
    .map((anchor) => document.getElementById((anchor.getAttribute("href") || "").slice(1)))
    .filter(Boolean);

  navSections.forEach((section, index) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top center",
      end: "bottom center",
      onEnter: () => {
        navAnchors.forEach((a) => a.classList.remove("active-section"));
        if (navAnchors[index]) navAnchors[index].classList.add("active-section");
      },
      onEnterBack: () => {
        navAnchors.forEach((a) => a.classList.remove("active-section"));
        if (navAnchors[index]) navAnchors[index].classList.add("active-section");
      },
    });
  });

  gsap.set(document.body, { opacity: 0 });
  gsap.to(document.body, { opacity: 1, duration: 0.38, ease: "power2.out", clearProps: "opacity" });

  let isPageTransitioning = false;
  document.querySelectorAll("a[href]").forEach((link) => {
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

  const cards = Array.from(document.querySelectorAll(".faq-card"));
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
    card.addEventListener("click", () => {
      card.classList.contains("flipped") ? unflipCard(card) : flipCard(card);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        card.classList.contains("flipped") ? unflipCard(card) : flipCard(card);
      }
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) unflipCard(card);
      },
      { threshold: 0 }
    );
    observer.observe(card);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();
