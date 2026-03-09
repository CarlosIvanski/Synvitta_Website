document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  const primaryNav = document.querySelector(".primary-nav");
  const yearEl = document.getElementById("year");
  const contactForm = document.getElementById("contact-form");
  const formFeedback = document.getElementById("form-feedback");

  // Header elevation on scroll
  const updateHeaderState = () => {
    if (!header) return;
    const elevated = window.scrollY > 12;
    header.setAttribute("data-elevated", elevated ? "true" : "false");
  };
  updateHeaderState();
  window.addEventListener("scroll", updateHeaderState, { passive: true });

  // Mobile navigation
  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.classList.toggle("is-open");
      primaryNav.classList.toggle("is-open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    primaryNav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.tagName === "A") {
        navToggle.classList.remove("is-open");
        primaryNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Smooth scroll refinement (beyond CSS scroll-behavior)
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLAnchorElement)) return;

      const id = target.getAttribute("href");
      if (!id || id === "#") return;

      const section = document.querySelector(id);
      if (!section) return;

      event.preventDefault();
      const rect = section.getBoundingClientRect();
      const offset = rect.top + window.scrollY - (header?.offsetHeight || 0) + 4;

      window.scrollTo({
        top: offset,
        behavior: "smooth",
      });
    });
  });

  // Scroll-based fade-in animations
  const observed = document.querySelectorAll(".observe-fade");
  if ("IntersectionObserver" in window && observed.length > 0) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.15,
      }
    );

    observed.forEach((el) => observer.observe(el));
  } else {
    observed.forEach((el) => el.classList.add("is-visible"));
  }

  // Footer year
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // Contact form (front-end only placeholder)
  if (contactForm && formFeedback) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const nameInput = contactForm.querySelector("#name");
      const emailInput = contactForm.querySelector("#email");
      const interestSelect = contactForm.querySelector("#interest");

      let hasError = false;

      [nameInput, emailInput, interestSelect].forEach((field) => {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
        if (!field.checkValidity()) {
          field.classList.add("is-invalid");
          hasError = true;
        } else {
          field.classList.remove("is-invalid");
        }
      });

      if (hasError) {
        formFeedback.textContent = "Please complete the required fields before submitting.";
        formFeedback.classList.remove("form-feedback--success");
        formFeedback.classList.add("form-feedback--error");
        return;
      }

      // Placeholder behavior – integrate with backend or form service
      formFeedback.textContent =
        "Thank you for contacting Synvitta Diagnostics. Our team will review your request and respond shortly.";
      formFeedback.classList.remove("form-feedback--error");
      formFeedback.classList.add("form-feedback--success");

      contactForm.reset();
    });
  }

  // Mission / Vision flip cards
  const flipCards = document.querySelectorAll("[data-flip-card]");
  flipCards.forEach((card) => {
    if (!(card instanceof HTMLElement)) return;

    const toggleFlip = () => {
      card.classList.toggle("is-flipped");
    };

    card.addEventListener("click", toggleFlip);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleFlip();
      }
    });

    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");

    const title = card.querySelector("h3");
    if (title && title.textContent) {
      card.setAttribute("aria-label", `${title.textContent.trim()} details`);
    }
  });

  // Hero text visibility based on video logo
  const heroVideo = document.querySelector(".hero-video");
  const heroContent = document.querySelector(".hero-content");

  if (heroVideo instanceof HTMLVideoElement && heroContent instanceof HTMLElement) {
    const HIDE_WINDOW_SECONDS = 3; // hide text during final seconds when logo is on screen

    const updateHeroVisibility = () => {
      const duration = heroVideo.duration;
      if (!duration || Number.isNaN(duration)) return;

      const current = heroVideo.currentTime;
      const shouldHide = current >= duration - HIDE_WINDOW_SECONDS;
      heroContent.classList.toggle("hero-content--hidden", shouldHide);
    };

    heroVideo.addEventListener("loadedmetadata", updateHeroVisibility);
    heroVideo.addEventListener("timeupdate", updateHeroVisibility);
  }
});

