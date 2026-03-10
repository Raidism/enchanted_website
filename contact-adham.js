(function initContactPage() {
  if (typeof gsap === "undefined") return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    gsap.to(document.body, { opacity: 1, duration: 0.5, ease: "power2.out" });
  });

  if (prefersReduced) return;

  const header = document.querySelector(".contact-header");
  const hero = document.getElementById("contactHero");
  const card = document.getElementById("contactCard");
  const lines = document.querySelectorAll(".contact-line");

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  if (header) tl.from(header, { y: -18, opacity: 0, duration: 0.45 }, 0);
  if (hero) tl.from(hero, { y: 22, opacity: 0, duration: 0.58 }, 0.08);
  if (card) tl.from(card, { y: 24, opacity: 0, scale: 0.985, duration: 0.62 }, 0.18);
  if (lines.length) tl.from(lines, { y: 14, opacity: 0, stagger: 0.07, duration: 0.46 }, 0.28);
})();
