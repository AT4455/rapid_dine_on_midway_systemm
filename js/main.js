/* =========================================================
   Thanuj Guptha Alavala — Portfolio
   Vanilla JavaScript: theme, navigation, reveal animations,
   typing effect, project filters, and contact form validation.
   ========================================================= */
(function () {
  'use strict';

  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.getElementById('site-header');
  const nav = document.getElementById('primary-nav');
  const navToggle = document.getElementById('nav-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  const progressBar = document.getElementById('scroll-progress-bar');
  const toTop = document.getElementById('to-top');
  const navLinks = Array.from(document.querySelectorAll('.nav__link'));
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  /* ---------------------------------------------------------
     Theme
     --------------------------------------------------------- */
  const THEME_COLORS = { dark: '#070a13', light: '#f6f7fc' };

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', THEME_COLORS[theme]);
    if (themeToggle) {
      themeToggle.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );
    }
    if (persist) {
      try {
        localStorage.setItem('theme', theme);
      } catch (e) {
        /* localStorage may be unavailable — theme still applies for this visit */
      }
    }
  }

  if (themeToggle) {
    applyTheme(root.getAttribute('data-theme') || 'dark', false);
    themeToggle.addEventListener('click', function () {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  /* ---------------------------------------------------------
     Mobile navigation
     --------------------------------------------------------- */
  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('nav-open');
  }

  function openNav() {
    if (!nav || !navToggle) return;
    nav.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('nav-open');
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      if (nav.classList.contains('is-open')) {
        closeNav();
      } else {
        openNav();
      }
    });
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeNav();
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) closeNav();
  });

  /* ---------------------------------------------------------
     Header state, scroll progress, active nav, back-to-top
     --------------------------------------------------------- */
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle('is-scrolled', y > 12);
    if (toTop) toTop.classList.toggle('is-visible', y > 560);
    if (progressBar) {
      const ratio = docHeight > 0 ? (y / docHeight) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, ratio)) + '%';
    }

    if (sections.length && navLinks.length) {
      const marker = y + window.innerHeight * 0.32;
      let current = sections[0];

      for (let i = 0; i < sections.length; i += 1) {
        if (sections[i].offsetTop <= marker) current = sections[i];
      }

      // Snap to the last section when the page is scrolled to the bottom.
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) {
        current = sections[sections.length - 1];
      }

      navLinks.forEach(function (link) {
        const isActive = link.getAttribute('href') === '#' + current.id;
        link.classList.toggle('is-active', isActive);
        if (isActive) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    ticking = false;
  }

  function requestScrollUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('load', onScroll);
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
  }

  /* ---------------------------------------------------------
     Reveal-on-scroll animations
     --------------------------------------------------------- */
  const revealItems = Array.from(document.querySelectorAll('[data-reveal]'));

  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    revealItems.forEach(function (item) {
      revealObserver.observe(item);
    });
  } else {
    revealItems.forEach(function (item) {
      item.classList.add('is-visible');
    });
  }

  /* ---------------------------------------------------------
     Typing effect
     --------------------------------------------------------- */
  const typedElement = document.querySelector('.typed-text');
  const roleElement = typedElement ? typedElement.closest('.hero__role') : null;

  if (typedElement && roleElement) {
    const words = (typedElement.dataset.words || '')
      .split('|')
      .map(function (word) { return word.trim(); })
      .filter(Boolean);

    if (words.length) {
      // Keep the full list available to screen readers without live announcements.
      roleElement.setAttribute('aria-label', words.join(', '));
      typedElement.setAttribute('aria-hidden', 'true');

      if (!prefersReducedMotion) {
        typedElement.textContent = '';

        let wordIndex = 0;
        let charIndex = 0;
        let deleting = false;

        function type() {
          const word = words[wordIndex];
          typedElement.textContent = word.slice(0, charIndex);

          if (!deleting) {
            if (charIndex < word.length) {
              charIndex += 1;
              window.setTimeout(type, 70 + Math.random() * 45);
            } else {
              deleting = true;
              window.setTimeout(type, 1900);
            }
          } else if (charIndex > 0) {
            charIndex -= 1;
            window.setTimeout(type, 38);
          } else {
            deleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            window.setTimeout(type, 320);
          }
        }

        window.setTimeout(type, 650);
      }
    }
  }

  /* ---------------------------------------------------------
     Project filters
     --------------------------------------------------------- */
  const filterButtons = Array.from(document.querySelectorAll('.filter'));
  const projectCards = Array.from(document.querySelectorAll('.project'));

  if (filterButtons.length && projectCards.length) {
    filterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        const filter = button.dataset.filter || 'all';

        filterButtons.forEach(function (other) {
          const isActive = other === button;
          other.classList.toggle('is-active', isActive);
          other.setAttribute('aria-selected', isActive ? 'true' : 'false');
          other.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        projectCards.forEach(function (card) {
          const match = filter === 'all' || card.dataset.category === filter;
          card.classList.toggle('is-hidden', !match);
        });
      });

      // Arrow-key support for the tablist pattern.
      button.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const index = filterButtons.indexOf(button);
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const next = filterButtons[(index + direction + filterButtons.length) % filterButtons.length];
        next.focus();
        next.click();
      });
    });
  }

  /* ---------------------------------------------------------
     Contact form validation
     --------------------------------------------------------- */
  const form = document.getElementById('contact-form');
  const successMessage = document.getElementById('form-success');
  const submitButton = document.getElementById('submit-btn');

  if (form) {
    const validators = {
      name: function (value) {
        if (!value) return 'Please tell me your name.';
        if (value.length < 2) return 'Your name needs at least 2 characters.';
        return '';
      },
      email: function (value) {
        if (!value) return 'Please add an email address.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          return 'That email address doesn\u2019t look right.';
        }
        return '';
      },
      subject: function (value) {
        if (!value) return 'Please add a short subject.';
        if (value.length < 3) return 'The subject is a little too short.';
        return '';
      },
      message: function (value) {
        if (!value) return 'Please write a message.';
        if (value.length < 10) return 'Tell me a bit more — at least 10 characters.';
        return '';
      }
    };

    const fields = Array.from(form.querySelectorAll('input, textarea'));

    function setFieldState(input, message) {
      const wrapper = input.closest('.field');
      const error = document.getElementById(input.id + '-error');
      if (!wrapper || !error) return;

      if (message) {
        wrapper.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        error.textContent = message;
      } else {
        wrapper.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
        error.textContent = '';
      }
    }

    function validateField(input) {
      const validator = validators[input.name];
      if (!validator) return true;
      const message = validator(input.value.trim());
      setFieldState(input, message);
      return !message;
    }

    fields.forEach(function (input) {
      input.addEventListener('blur', function () {
        validateField(input);
      });

      input.addEventListener('input', function () {
        const wrapper = input.closest('.field');
        if (wrapper && wrapper.classList.contains('is-invalid')) {
          validateField(input);
        }
        if (successMessage) successMessage.hidden = true;
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      let firstInvalid = null;
      fields.forEach(function (input) {
        const valid = validateField(input);
        if (!valid && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        firstInvalid.focus({ preventScroll: true });
        firstInvalid.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'center'
        });
        return;
      }

      // No backend in this static demo — show a confirmation and reset.
      if (submitButton) {
        submitButton.disabled = true;
        const label = submitButton.querySelector('.btn__label');
        if (label) label.textContent = 'Message sent';
      }

      if (successMessage) {
        successMessage.hidden = false;
      }

      form.reset();
      fields.forEach(function (input) {
        setFieldState(input, '');
      });

      window.setTimeout(function () {
        if (submitButton) {
          submitButton.disabled = false;
          const label = submitButton.querySelector('.btn__label');
          if (label) label.textContent = 'Send message';
        }
      }, 2600);
    });
  }

  /* ---------------------------------------------------------
     Footer year
     --------------------------------------------------------- */
  const yearElement = document.getElementById('year');
  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }
})();
