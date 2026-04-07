(function () {
  const STORAGE_PREFIX = "Enchanted Summit_onboarding_done_v1";
  const STORAGE_LAST_USER = "Enchanted Summit_last_login_user";
  const MAIN_ADMIN_USERNAME = "admin";

  const COMMON_STEPS = [
    {
      title: "Welcome to Enchanted Summit Portal",
      description: "This is your command center for analytics, applications, and team operations.",
      tip: "Tip: Use the top navigation to jump quickly between modules.",
    },
    {
      title: "Track Conference Activity",
      description: "View traffic, engagement trends, and key portal health metrics in real time.",
      tip: "Tip: Metrics refresh automatically while this tab stays active.",
    },
    {
      title: "Manage Candidate Pipelines",
      description: "Review early-access entries and application activity from one secure workspace.",
      tip: "Tip: Keep statuses updated so your team sees accurate progress.",
    },
    {
      title: "Secure Team Workflow",
      description: "Your session and role-based access are protected throughout the portal.",
      tip: "Tip: Always log out on shared devices.",
    },
  ];

  const ADMIN_EXTRA_STEP = {
    title: "Admin Controls",
    description: "You can manage users, maintenance mode, and live operational settings.",
    tip: "Tip: Use Settings for account controls and Ops Center for runtime monitoring.",
  };

  const buildStepsForUser = (user) => {
    const isAdmin = String(user && user.role || "").toLowerCase() === "admin";
    const name = String(user && (user.name || user.username) || "there").trim() || "there";
    const first = {
      title: `Hi ${name}`,
      description: "Let us walk you through the essentials in under a minute.",
      tip: "Tip: You can skip now and reopen this anytime from Settings.",
    };

    const steps = [first, ...COMMON_STEPS.slice(1)];
    if (isAdmin) {
      steps.splice(steps.length - 1, 0, ADMIN_EXTRA_STEP);
    }

    return steps.slice(0, 5);
  };

  const normalizeUsername = (user) => String(user && user.username || "").trim().toLowerCase();

  const completionKeyForUser = (user) => `${STORAGE_PREFIX}:${normalizeUsername(user)}`;

  const hasCompleted = (user) => {
    if (window.EnchantedAuth && typeof window.EnchantedAuth.getOnboardingStatus === "function") {
      const result = window.EnchantedAuth.getOnboardingStatus();
      if (result && result.success) {
        return Boolean(result.onboardingCompleted);
      }
    }

    if (user && typeof user.onboardingCompleted === "boolean") {
      return Boolean(user.onboardingCompleted);
    }

    const username = normalizeUsername(user);
    if (!username) return true;
    return localStorage.getItem(completionKeyForUser(user)) === "1";
  };

  const setCompleted = (user) => {
    if (window.EnchantedAuth && typeof window.EnchantedAuth.completeOnboarding === "function") {
      window.EnchantedAuth.completeOnboarding();
    }

    const username = normalizeUsername(user);
    if (!username) return;
    localStorage.setItem(completionKeyForUser(user), "1");
  };

  const setLastLoginUser = (user) => {
    const username = normalizeUsername(user);
    if (!username) return;
    localStorage.setItem(STORAGE_LAST_USER, username);
  };

  const ensureModalDom = () => {
    let overlay = document.getElementById("onboardingOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "onboardingOverlay";
    overlay.className = "onb-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="onb-backdrop" data-onb-close="overlay" aria-hidden="true"></div>
      <div class="onb-modal" role="dialog" aria-modal="true" aria-labelledby="onbTitle" aria-describedby="onbDescription">
        <div class="onb-head">
          <p class="onb-counter" id="onbCounter">1/4</p>
          <div class="onb-dots" id="onbDots" aria-hidden="true"></div>
        </div>

        <div class="onb-step-wrap" id="onbStepWrap">
          <h3 id="onbTitle" class="onb-title"></h3>
          <p id="onbDescription" class="onb-desc"></p>
          <p id="onbTip" class="onb-tip"></p>
        </div>

        <div class="onb-actions">
          <label class="onb-optout" for="onbDontShowAgain">
            <input id="onbDontShowAgain" type="checkbox" class="onb-optout-check" />
            <span>Don't show me this again</span>
          </label>
          <div class="onb-actions-right">
            <button type="button" class="onb-btn onb-btn-ghost" id="onbSkipBtn">Skip</button>
            <button type="button" class="onb-btn onb-btn-subtle" id="onbBackBtn">Back</button>
            <button type="button" class="onb-btn onb-btn-primary" id="onbNextBtn">Next</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  };

  const createController = (user, options = {}) => {
    const overlay = ensureModalDom();
    const stepWrap = overlay.querySelector("#onbStepWrap");
    const titleEl = overlay.querySelector("#onbTitle");
    const descEl = overlay.querySelector("#onbDescription");
    const tipEl = overlay.querySelector("#onbTip");
    const counterEl = overlay.querySelector("#onbCounter");
    const dotsEl = overlay.querySelector("#onbDots");
    const backBtn = overlay.querySelector("#onbBackBtn");
    const nextBtn = overlay.querySelector("#onbNextBtn");
    const skipBtn = overlay.querySelector("#onbSkipBtn");
    const dontShowAgainInput = overlay.querySelector("#onbDontShowAgain");

    const steps = buildStepsForUser(user);
    let index = 0;

    const renderDots = () => {
      dotsEl.innerHTML = "";
      steps.forEach((_, i) => {
        const dot = document.createElement("span");
        dot.className = `onb-dot${i === index ? " is-active" : ""}`;
        dotsEl.appendChild(dot);
      });
    };

    const render = () => {
      const step = steps[index];
      counterEl.textContent = `${index + 1}/${steps.length}`;

      stepWrap.classList.add("is-changing");
      setTimeout(() => {
        titleEl.textContent = step.title;
        descEl.textContent = step.description;
        tipEl.textContent = step.tip || "";
        tipEl.hidden = !step.tip;
        backBtn.disabled = index === 0;
        nextBtn.textContent = index === steps.length - 1 ? "Finish" : "Next";
        renderDots();
        stepWrap.classList.remove("is-changing");
      }, 120);
    };

    const close = ({ complete }) => {
      const shouldPersist = Boolean(complete && dontShowAgainInput && dontShowAgainInput.checked);
      if (shouldPersist) {
        setCompleted(user);
      }

      overlay.classList.remove("is-open");
      document.body.classList.remove("onb-lock-scroll");
      setTimeout(() => {
        overlay.hidden = true;
      }, 220);

      document.removeEventListener("keydown", onKeydown);
      if (typeof options.onClose === "function") {
        options.onClose({ complete: Boolean(complete), persisted: shouldPersist });
      }
    };

    const next = () => {
      if (index >= steps.length - 1) {
        close({ complete: true });
        return;
      }
      index += 1;
      render();
    };

    const back = () => {
      if (index <= 0) return;
      index -= 1;
      render();
    };

    const onKeydown = (event) => {
      if (overlay.hidden) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close({ complete: true });
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        next();
      }
    };

    backBtn.onclick = back;
    nextBtn.onclick = next;
    skipBtn.onclick = () => close({ complete: true });

    overlay.querySelectorAll("[data-onb-close='overlay']").forEach((node) => {
      node.onclick = () => close({ complete: true });
    });

    return {
      open: () => {
        setLastLoginUser(user);
        if (dontShowAgainInput) {
          dontShowAgainInput.checked = false;
        }
        overlay.hidden = false;
        requestAnimationFrame(() => {
          overlay.classList.add("is-open");
        });
        document.body.classList.add("onb-lock-scroll");
        render();
        document.addEventListener("keydown", onKeydown);
      },
    };
  };

  const open = (user, options = {}) => {
    if (!user) return;
    const controller = createController(user, options);
    controller.open();
  };

  const maybeShow = (user, options = {}) => {
    if (!user) return;
    const username = normalizeUsername(user);
    if (!options.force && username === MAIN_ADMIN_USERNAME) {
      return;
    }
    if (!options.force && hasCompleted(user)) return;
    open(user, options);
  };

  window.Enchanted SummitOnboarding = {
    open,
    maybeShow,
    hasCompleted,
    setCompleted,
  };
})();
