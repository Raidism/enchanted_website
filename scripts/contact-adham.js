(function initContactPage() {
  if (typeof gsap === "undefined") return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const navigationEntry = performance.getEntriesByType("navigation")[0];
  const isStandardNavigation = navigationEntry ? navigationEntry.type === "navigate" : true;

  if (!prefersReduced && isStandardNavigation) {
    gsap.set(document.body, { opacity: 0, willChange: "opacity" });
    gsap.to(document.body, {
      opacity: 1,
      duration: 0.42,
      ease: "power1.out",
      clearProps: "opacity,willChange",
    });
  }

  if (prefersReduced) return;

  const header = document.querySelector(".contact-header");
  const hero = document.getElementById("contactHero");
  const card = document.getElementById("contactCard");
  const lines = document.querySelectorAll(".contact-line");
  const adhamBurstTarget = document.getElementById("adhamBurstTarget");
  const adhamFireLayer = document.getElementById("adhamFireLayer");

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  if (header) tl.from(header, { y: -18, opacity: 0, duration: 0.45 }, 0);
  if (hero) tl.from(hero, { y: 22, opacity: 0, duration: 0.58 }, 0.08);
  if (card) tl.from(card, { y: 24, opacity: 0, scale: 0.985, duration: 0.62 }, 0.18);
  if (lines.length) tl.from(lines, { y: 14, opacity: 0, stagger: 0.07, duration: 0.46 }, 0.28);

  if (adhamBurstTarget && adhamFireLayer) {
    let clickSpamLevel = 0;
    let clickSpamTimer = null;

    const spawnFireRing = (originXPercent, originYPercent) => {
      const ring = document.createElement("span");
      ring.className = "contact-fire-ring";

      const size = 68 + Math.random() * 74;
      ring.style.setProperty("--x", `${originXPercent}%`);
      ring.style.setProperty("--y", `${originYPercent}%`);
      ring.style.setProperty("--size", `${size}px`);
      ring.style.setProperty("--h1", "2");
      ring.style.setProperty("--h2", "10");
      ring.style.setProperty("--h3", "350");

      ring.addEventListener("animationend", () => {
        ring.remove();
      });

      adhamFireLayer.appendChild(ring);
    };

    const triggerFireSpam = (event) => {
      const rect = adhamBurstTarget.getBoundingClientRect();
      const relativeX = event.clientX ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
      const relativeY = event.clientY ? ((event.clientY - rect.top) / rect.height) * 100 : 50;

      clickSpamLevel = Math.min(clickSpamLevel + 1, 12);
      const burstCount = Math.min(2 + clickSpamLevel, 14);

      for (let index = 0; index < burstCount; index += 1) {
        const jitterX = Math.max(15, Math.min(85, relativeX + (Math.random() - 0.5) * 28));
        const jitterY = Math.max(15, Math.min(85, relativeY + (Math.random() - 0.5) * 28));
        setTimeout(() => spawnFireRing(jitterX, jitterY), index * 28);
      }

      if (clickSpamTimer) {
        clearTimeout(clickSpamTimer);
      }
      clickSpamTimer = setTimeout(() => {
        clickSpamLevel = 0;
      }, 1300);
    };

    adhamBurstTarget.addEventListener("click", triggerFireSpam);
    adhamBurstTarget.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        triggerFireSpam({ clientX: 0, clientY: 0 });
      }
    });
  }
})();
