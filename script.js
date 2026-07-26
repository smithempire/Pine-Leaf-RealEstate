/* ============================================================
   PineLeaf Estates — script.js
   Vanilla JS only. No frameworks/libraries.

   Structure: every feature is an independent initialiser run
   through runComponent(). A failure in one component is logged
   and contained, so it can never stop the rest of the site.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     Shared helpers
  --------------------------------------------------------- */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var prefersReducedMotion = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  var supportsIO = typeof window.IntersectionObserver === 'function';

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  /* Focusing an element scrolls it into view, which is how an overlay that
     restores focus on close can yank the page back later. Always focus
     without scrolling. */
  function focusNoScroll(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); }
    catch (e) { el.focus(); }
  }

  /* Which input device drove the last interaction. Returning focus to the
     trigger matters for keyboard users; for touch/mouse it only leaves a
     stray focus ring on a control the visitor has already scrolled past. */
  var keyboardMode = false;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter' ||
        e.key === ' ' || e.key.indexOf('Arrow') === 0 || e.key === 'Home' || e.key === 'End') {
      keyboardMode = true;
    }
  }, true);
  ['pointerdown', 'mousedown', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, function () { keyboardMode = false; }, true);
  });

  /* Counter-based scroll lock.
     Overlays can legitimately stack (e.g. drawer open, then a modal).
     Releasing one must not unlock the page while another is still open,
     so locks are counted rather than toggled. */
  var ScrollLock = (function () {
    var depth = 0;
    var savedY = 0;
    return {
      lock: function () {
        if (depth === 0) {
          savedY = window.scrollY || window.pageYOffset || 0;
          document.body.style.top = '-' + savedY + 'px';
          document.body.classList.add('is-locked');
        }
        depth++;
      },
      unlock: function () {
        if (depth === 0) return;
        depth--;
        if (depth === 0) {
          document.body.classList.remove('is-locked');
          document.body.style.top = '';
          window.scrollTo(0, savedY);
        }
      },
      reset: function () {
        depth = 0;
        document.body.classList.remove('is-locked');
        document.body.style.top = '';
      }
    };
  })();

  /* Minimal focus trap for overlay dialogs. */
  function trapFocus(container, event) {
    var items = $$(FOCUSABLE, container).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  /* ---------------------------------------------------------
     Preloader
  --------------------------------------------------------- */
  function initPreloader() {
    var preloader = $('#preloader');
    if (!preloader) return;
    var hide = function () { preloader.classList.add('hidden'); };
    if (document.readyState === 'complete') {
      window.setTimeout(hide, 250);
    } else {
      window.addEventListener('load', function () { window.setTimeout(hide, 250); });
    }
    /* Never let a stalled asset leave the page behind a full-screen cover. */
    window.setTimeout(hide, 4000);
  }

  /* ---------------------------------------------------------
     Sticky header
  --------------------------------------------------------- */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;
    var ticking = false;
    var apply = function () {
      header.classList.toggle('scrolled', (window.scrollY || window.pageYOffset) > 40);
      ticking = false;
    };
    apply();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     Mobile navigation drawer
  --------------------------------------------------------- */
  function initMobileNavigation() {
    var hamburger = $('.hamburger');
    var nav = $('.mobile-nav');
    var scrim = $('.nav-scrim');
    if (!hamburger || !nav) return;

    var closeBtn = $('.mobile-close', nav);
    var isOpen = false;

    function open() {
      if (isOpen) return;
      isOpen = true;
      nav.classList.add('open');
      if (scrim) scrim.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      nav.removeAttribute('aria-hidden');
      ScrollLock.lock();
      var target = closeBtn || $(FOCUSABLE, nav);
      focusNoScroll(target);
    }

    function close(returnFocus) {
      if (!isOpen) return;
      isOpen = false;
      nav.classList.remove('open');
      if (scrim) scrim.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      nav.setAttribute('aria-hidden', 'true');
      ScrollLock.unlock();
      if (returnFocus !== false) focusNoScroll(hamburger);
    }

    hamburger.setAttribute('aria-expanded', 'false');
    nav.setAttribute('aria-hidden', 'true');

    hamburger.addEventListener('click', function () { isOpen ? close() : open(); });
    if (closeBtn) closeBtn.addEventListener('click', function () { close(); });
    if (scrim) scrim.addEventListener('click', function () { close(); });

    /* Links close the drawer; focus is not forced back to the burger
       because the browser is navigating away. */
    $$('a', nav).forEach(function (a) {
      a.addEventListener('click', function () { close(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') trapFocus(nav, e);
    });

    /* Resizing up to desktop must not leave a locked page behind a
       drawer that is no longer visible. */
    var mq = window.matchMedia('(min-width: 992px)');
    var onChange = function (e) { if (e.matches && isOpen) close(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------------------------------------------------------
     Active navigation state
  --------------------------------------------------------- */
  function initActiveNav() {
    var current = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (!current) current = 'index.html';
    $$('.main-nav a, .mobile-nav a').forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('#')[0].toLowerCase();
      if (!href) return;
      if (href === current) {
        link.classList.add('active');
        if (!link.classList.contains('btn')) link.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ---------------------------------------------------------
     Smooth in-page anchors
  --------------------------------------------------------- */
  function initAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id.length < 2) return;
        var target;
        try { target = document.querySelector(id); } catch (err) { return; }
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - 90;
        window.scrollTo({ top: top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        /* Move keyboard focus with the scroll, not just the viewport. */
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });
  }

  /* ---------------------------------------------------------
     Hero slider
  --------------------------------------------------------- */
  function initHeroSlider() {
    var slides = $$('.hero-slide');
    if (slides.length < 2) return;
    var dotsWrap = $('.hero-dots');
    var index = 0;
    var timer = null;
    var INTERVAL = 5500;

    function render() {
      slides.forEach(function (s, i) { s.classList.toggle('active', i === index); });
      if (dotsWrap) {
        $$('button', dotsWrap).forEach(function (b, i) {
          b.classList.toggle('active', i === index);
          b.setAttribute('aria-selected', i === index ? 'true' : 'false');
        });
      }
    }
    function go(i) { index = (i + slides.length) % slides.length; render(); }

    function stop() { if (timer) { window.clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (prefersReducedMotion()) return;
      timer = window.setInterval(function () { go(index + 1); }, INTERVAL);
    }
    function restart() { stop(); start(); }

    if (dotsWrap) {
      dotsWrap.setAttribute('role', 'tablist');
      slides.forEach(function (s, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', function () { go(i); restart(); });
        dotsWrap.appendChild(dot);
      });
    }
    var next = $('.hero-arrows .next');
    var prev = $('.hero-arrows .prev');
    if (next) next.addEventListener('click', function () { go(index + 1); restart(); });
    if (prev) prev.addEventListener('click', function () { go(index - 1); restart(); });

    /* One timer, and it never runs while the tab is hidden. */
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    render();
    start();
  }

  /* ---------------------------------------------------------
     Hero typing effect
  --------------------------------------------------------- */
  function initTypingEffect() {
    var target = $('[data-typing]');
    if (!target) return;

    var words;
    try { words = JSON.parse(target.getAttribute('data-typing')); }
    catch (err) { return; }
    if (!Array.isArray(words) || !words.length) return;

    /* Reserve the width of the longest phrase up front so the headline
       never reflows (and never shifts the page) while typing. */
    var sizer = document.createElement('span');
    sizer.setAttribute('aria-hidden', 'true');
    sizer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
    var cs = window.getComputedStyle(target);
    sizer.style.font = cs.font;
    sizer.style.fontSize = cs.fontSize;
    sizer.style.fontFamily = cs.fontFamily;
    sizer.style.fontWeight = cs.fontWeight;
    sizer.style.letterSpacing = cs.letterSpacing;
    document.body.appendChild(sizer);
    var widest = 0;
    words.forEach(function (w) {
      sizer.textContent = w;
      widest = Math.max(widest, sizer.getBoundingClientRect().width);
    });
    document.body.removeChild(sizer);
    if (widest) target.style.minWidth = Math.ceil(widest) + 'px';

    /* Screen readers get the stable headline, not per-keystroke churn. */
    target.setAttribute('aria-label', words[0]);

    if (prefersReducedMotion()) { target.textContent = words[0]; return; }

    var cursor = document.createElement('span');
    cursor.className = 'type-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    target.after(cursor);

    var wi = 0, ci = 0, deleting = false, tid = null;
    function loop() {
      var word = words[wi];
      if (!deleting) {
        ci++;
        target.textContent = word.slice(0, ci);
        if (ci === word.length) {
          deleting = true;
          tid = window.setTimeout(loop, 1600);
          return;
        }
      } else {
        ci--;
        target.textContent = word.slice(0, ci);
        if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; }
      }
      tid = window.setTimeout(loop, deleting ? 40 : 80);
    }
    function stop() { if (tid) { window.clearTimeout(tid); tid = null; } }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (!tid) loop();
    });
    loop();
  }

  /* ---------------------------------------------------------
     Animated statistic counters
  --------------------------------------------------------- */
  function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length) return;

    var nf = (typeof Intl !== 'undefined' && Intl.NumberFormat)
      ? new Intl.NumberFormat('en-NG')
      : { format: function (n) { return String(n); } };

    function finalise(el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      if (isNaN(target)) return;
      el.textContent = nf.format(target) + (el.getAttribute('data-suffix') || '');
    }

    function run(el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      if (isNaN(target)) return;
      var suffix = el.getAttribute('data-suffix') || '';
      if (prefersReducedMotion()) { finalise(el); return; }

      var DURATION = 1500;
      var startedAt = null;
      function frame(ts) {
        if (startedAt === null) startedAt = ts;
        var p = Math.min((ts - startedAt) / DURATION, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = nf.format(Math.round(target * eased)) + suffix;
        if (p < 1) window.requestAnimationFrame(frame);
        else el.textContent = nf.format(target) + suffix;  /* exact final value */
      }
      window.requestAnimationFrame(frame);
    }

    /* Announce the finished figure once, not every intermediate tick. */
    counters.forEach(function (el) {
      el.setAttribute('aria-live', 'off');
      var target = parseInt(el.getAttribute('data-count'), 10);
      if (!isNaN(target)) {
        el.setAttribute('aria-label', nf.format(target) + (el.getAttribute('data-suffix') || ''));
      }
    });

    if (!supportsIO) { counters.forEach(finalise); return; }

    var seen = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { io.observe(c); });

    /* Safety net: anything still at its placeholder after 6s is filled in,
       so a counter can never be left showing 0. */
    window.setTimeout(function () {
      counters.forEach(function (el) {
        if (!seen.has(el) && /^0/.test(el.textContent.trim())) finalise(el);
      });
    }, 6000);
  }

  /* ---------------------------------------------------------
     Scroll reveal
  --------------------------------------------------------- */
  function initReveals() {
    var els = $$('.reveal');
    if (!els.length) return;
    /* Opt in only when we can actually animate; CSS keeps content visible
       otherwise, so a missing IntersectionObserver never hides anything. */
    if (!supportsIO || prefersReducedMotion()) return;

    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });

    window.setTimeout(function () {
      els.forEach(function (el) { el.classList.add('in'); });
    }, 5000);
  }

  /* ---------------------------------------------------------
     Property filtering
     Homepage: collects criteria and hands off to properties.html.
     Properties page: filters the grid in place and reflects state
     in the URL. One behaviour per page, no inline onclick.
  --------------------------------------------------------- */
  var FILTER_IDS = ['filterLocation', 'filterType', 'filterBudget', 'filterSize', 'filterStatus'];
  var FILTER_KEYS = { filterLocation: 'location', filterType: 'type', filterBudget: 'budget', filterSize: 'size', filterStatus: 'status' };

  function initPropertyFilters() {
    var panel = $('.search-panel');
    if (!panel) return;
    var button = $('.btn', panel);
    if (!button) return;
    button.setAttribute('type', 'button');

    var grid = $('#listingsGrid');
    var cards = $$('[data-property]');
    var noResults = $('.no-results');

    function readCriteria() {
      var out = {};
      FILTER_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value) out[FILTER_KEYS[id]] = el.value;
      });
      return out;
    }

    /* Homepage has no listings grid — send the criteria to the real
       listings page instead of filtering three featured cards. */
    if (!grid) {
      button.addEventListener('click', function () {
        var c = readCriteria();
        var qs = Object.keys(c).map(function (k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(c[k]);
        }).join('&');
        window.location.href = 'properties.html' + (qs ? '?' + qs : '');
      });
      return;
    }

    function matches(card, c) {
      if (c.location && card.getAttribute('data-location') !== c.location) return false;
      if (c.type && card.getAttribute('data-type') !== c.type) return false;
      if (c.size && card.getAttribute('data-size') !== c.size) return false;
      if (c.status && card.getAttribute('data-status') !== c.status) return false;
      if (c.budget) {
        var p = parseInt(card.getAttribute('data-price'), 10);
        if (isNaN(p)) return false;
        if (c.budget === 'under1') return p < 1000000;
        if (c.budget === '1to3') return p >= 1000000 && p <= 3000000;
        if (c.budget === '3to5') return p > 3000000 && p <= 5000000;
        if (c.budget === '5to10') return p > 5000000 && p <= 10000000;
        if (c.budget === '10plus') return p > 10000000;
      }
      return true;
    }

    function apply(pushUrl) {
      var c = readCriteria();
      var visible = 0;
      cards.forEach(function (card) {
        var show = matches(card, c);
        card.hidden = !show;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (noResults) noResults.classList.toggle('show', visible === 0);

      if (pushUrl && window.history && window.history.replaceState) {
        var qs = Object.keys(c).map(function (k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(c[k]);
        }).join('&');
        window.history.replaceState({}, '', qs ? '?' + qs : window.location.pathname);
      }
      return visible;
    }

    /* Adopt any criteria handed over from the homepage search. */
    var params = new URLSearchParams(window.location.search);
    var seeded = false;
    FILTER_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      var val = params.get(FILTER_KEYS[id]);
      if (el && val) {
        var ok = $$('option', el).some(function (o) { return o.value === val; });
        if (ok) { el.value = val; seeded = true; }
      }
    });
    if (seeded) apply(false);

    button.addEventListener('click', function () { apply(true); });
    FILTER_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function () { apply(true); });
    });
  }

  /* ---------------------------------------------------------
     Custom select
     Enhances every native <select> with a styled listbox. The real
     <select> stays in the DOM and remains the single source of truth,
     so filters, form reads and form submission are unaffected — and
     if this component throws, the native control is still there.
  --------------------------------------------------------- */
  var openSelect = null;   /* only one panel open at a time */
  var selectScrim = null;
  var sheetMQ = null;

  function isSheetMode() { return !!(sheetMQ && sheetMQ.matches); }

  function initCustomSelects() {
    var selects = $$('select');
    if (!selects.length) return;

    sheetMQ = window.matchMedia('(max-width: 639px)');

    selectScrim = document.createElement('div');
    selectScrim.className = 'cselect-scrim';
    document.body.appendChild(selectScrim);
    selectScrim.addEventListener('click', function () {
      if (openSelect) openSelect.close();
    });

    selects.forEach(buildCustomSelect);

    /* One document-level listener for all instances. The panel is checked
       separately because in sheet mode it is portalled onto <body> and is
       therefore no longer a descendant of its own root. */
    document.addEventListener('click', function (e) {
      if (!openSelect) return;
      if (openSelect.root.contains(e.target)) return;
      if (openSelect.panel && openSelect.panel.contains(e.target)) return;
      openSelect.close();
    });
    window.addEventListener('resize', function () {
      if (openSelect) openSelect.close(false);
    });
  }

  function buildCustomSelect(select) {
    if (select.dataset.enhanced === 'true') return;
    if (select.multiple || select.size > 1) return;
    select.dataset.enhanced = 'true';

    var options = $$('option', select);
    if (!options.length) return;

    var root = document.createElement('div');
    root.className = 'cselect';
    select.parentNode.insertBefore(root, select);
    root.appendChild(select);

    var uid = select.id || ('sel-' + Math.abs(hashString(select.name || options[0].textContent)));
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cselect-btn';
    btn.id = uid + '-btn';
    btn.setAttribute('role', 'combobox');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', uid + '-panel');

    var valueEl = document.createElement('span');
    valueEl.className = 'cselect-value';
    var caret = document.createElement('i');
    caret.className = 'fa-solid fa-chevron-down cselect-caret';
    caret.setAttribute('aria-hidden', 'true');
    btn.appendChild(valueEl);
    btn.appendChild(caret);

    var panel = document.createElement('div');
    panel.className = 'cselect-panel';
    panel.id = uid + '-panel';
    panel.setAttribute('role', 'listbox');
    panel.tabIndex = -1;

    /* Reuse the existing <label for="..."> so the control keeps its name. */
    var label = select.id ? document.querySelector('label[for="' + CSS.escape(select.id) + '"]') : null;
    if (label) {
      if (!label.id) label.id = uid + '-label';
      btn.setAttribute('aria-labelledby', label.id + ' ' + btn.id);
      panel.setAttribute('aria-labelledby', label.id);
      label.addEventListener('click', function (e) { e.preventDefault(); focusNoScroll(btn); api.open(); });
    } else if (select.getAttribute('aria-label')) {
      btn.setAttribute('aria-label', select.getAttribute('aria-label'));
    }

    /* Sheet header (mobile only — CSS keeps it hidden on larger screens). */
    var head = document.createElement('div');
    head.className = 'cselect-head';
    var headTitle = document.createElement('b');
    headTitle.textContent = (label ? label.textContent : select.getAttribute('aria-label') || 'Select').trim();
    var headClose = document.createElement('button');
    headClose.type = 'button';
    headClose.setAttribute('aria-label', 'Close ' + headTitle.textContent + ' options');
    headClose.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    headClose.addEventListener('click', function () { close(); });
    head.appendChild(headTitle);
    head.appendChild(headClose);
    panel.appendChild(head);

    var optEls = options.map(function (opt, i) {
      var li = document.createElement('div');
      li.className = 'cselect-opt';
      li.id = uid + '-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;
      li.addEventListener('click', function () { choose(i, true); });
      li.addEventListener('mousemove', function () { setActive(i); });
      panel.appendChild(li);
      return li;
    });

    root.appendChild(btn);
    root.appendChild(panel);
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    var activeIndex = Math.max(0, select.selectedIndex);
    var isOpen = false;
    var typeBuffer = '';
    var typeTimer = null;

    function syncFromNative() {
      var i = Math.max(0, select.selectedIndex);
      activeIndex = i;
      var opt = options[i];
      valueEl.textContent = opt ? opt.textContent : '';
      /* Treat an empty value ("All Locations", "Any Budget") as placeholder. */
      btn.setAttribute('data-placeholder', opt && opt.value === '' ? 'true' : 'false');
      optEls.forEach(function (el, idx) {
        el.setAttribute('aria-selected', idx === i ? 'true' : 'false');
      });
    }

    function setActive(i) {
      activeIndex = (i + optEls.length) % optEls.length;
      optEls.forEach(function (el, idx) { el.classList.toggle('is-active', idx === activeIndex); });
      btn.setAttribute('aria-activedescendant', optEls[activeIndex].id);
      var el = optEls[activeIndex];
      var pt = panel.scrollTop, pb = pt + panel.clientHeight;
      if (el.offsetTop < pt) panel.scrollTop = el.offsetTop;
      else if (el.offsetTop + el.offsetHeight > pb) panel.scrollTop = el.offsetTop + el.offsetHeight - panel.clientHeight;
    }

    function choose(i, closeAfter) {
      if (select.selectedIndex !== i) {
        select.selectedIndex = i;
        /* Notify every existing listener exactly as a native pick would. */
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncFromNative();
      if (closeAfter) { close(); }
    }

    var lockedForSheet = false;
    var portalled = false;

    function open() {
      if (isOpen) return;
      if (openSelect && openSelect !== api) openSelect.close(false);
      isOpen = true;

      if (isSheetMode()) {
        /* Bottom sheet: anchoring is irrelevant, but the page behind it
           must not scroll and the scrim must catch outside taps.
           The panel is moved onto <body> because ancestors such as
           .search-panel establish a low stacking context that would
           otherwise pin the sheet underneath the full-screen scrim. */
        root.classList.remove('drop-up');
        panel.classList.remove('drop-up');
        document.body.appendChild(panel);
        portalled = true;
        if (selectScrim) selectScrim.classList.add('show');
        ScrollLock.lock();
        lockedForSheet = true;
      } else {
        /* Flip upward when the panel would run past the viewport bottom. */
        var rect = btn.getBoundingClientRect();
        var space = window.innerHeight - rect.bottom;
        var up = space < 240 && rect.top > space;
        root.classList.toggle('drop-up', up);
        panel.classList.toggle('drop-up', up);
      }

      root.classList.add('is-open');
      panel.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      setActive(Math.max(0, select.selectedIndex));
      openSelect = api;
    }

    function close(refocus) {
      if (!isOpen) return;
      isOpen = false;
      root.classList.remove('is-open');
      panel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('aria-activedescendant');
      optEls.forEach(function (el) { el.classList.remove('is-active'); });
      if (lockedForSheet) {
        if (selectScrim) selectScrim.classList.remove('show');
        ScrollLock.unlock();
        lockedForSheet = false;
      }
      if (portalled) {
        /* Return the panel to its own root once the sheet has slid away. */
        window.setTimeout(function () {
          if (!isOpen && portalled) { root.appendChild(panel); portalled = false; }
        }, 320);
      }
      if (openSelect === api) openSelect = null;
      /* Only hand focus back for keyboard users. On touch this would leave
         the trigger focused after the visitor scrolls away, so any later
         focus change (Tab, or the browser re-asserting it) would drag the
         page back down to this field. */
      if (refocus !== false && keyboardMode) focusNoScroll(btn);
    }

    btn.addEventListener('click', function () { isOpen ? close() : open(); });

    btn.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Escape') { if (isOpen) { e.preventDefault(); close(); } return; }
      if (k === 'Tab') { if (isOpen) close(false); return; }

      if (!isOpen) {
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); open(); return; }
      } else {
        if (k === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); return; }
        if (k === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); return; }
        if (k === 'Home') { e.preventDefault(); setActive(0); return; }
        if (k === 'End') { e.preventDefault(); setActive(optEls.length - 1); return; }
        if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(activeIndex, true); return; }
      }

      /* Type-ahead, matching native select behaviour. */
      if (k.length === 1 && /\S/.test(k)) {
        typeBuffer += k.toLowerCase();
        if (typeTimer) window.clearTimeout(typeTimer);
        typeTimer = window.setTimeout(function () { typeBuffer = ''; }, 600);
        var hit = options.findIndex(function (o) {
          return o.textContent.trim().toLowerCase().indexOf(typeBuffer) === 0;
        });
        if (hit !== -1) { isOpen ? setActive(hit) : choose(hit, false); }
      }
    });

    /* Reflect programmatic changes (URL seeding, form reset). */
    select.addEventListener('change', syncFromNative);

    var api = { root: root, panel: panel, close: close, open: open };
    syncFromNative();
  }

  function hashString(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return h;
  }

  /* ---------------------------------------------------------
     Property card actions — favourite / share
  --------------------------------------------------------- */
  function initPropertyCards() {
    $$('.pc-actions .fav').forEach(function (btn) {
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var on = btn.classList.toggle('active');
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        var icon = $('i', btn);
        if (icon) {
          icon.classList.toggle('fa-regular', !on);
          icon.classList.toggle('fa-solid', on);
        }
      });
    });

    $$('.pc-actions .share').forEach(function (btn) {
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var card = btn.closest('[data-property]');
        var name = card ? card.getAttribute('data-name') : 'this property';
        var url = window.location.href;
        var data = { title: name, text: 'Check out ' + name + ' on PineLeaf Estates', url: url };

        function flash(msg) {
          var note = document.createElement('span');
          note.className = 'share-toast';
          note.setAttribute('role', 'status');
          note.textContent = msg;
          note.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
            'background:#0E2A1C;color:#fff;padding:10px 18px;border-radius:999px;font-size:.85rem;' +
            'z-index:2500;box-shadow:0 8px 30px rgba(0,0,0,.3);max-width:90vw;text-align:center;';
          document.body.appendChild(note);
          window.setTimeout(function () { note.remove(); }, 2600);
        }

        if (navigator.share) {
          /* A dismissed share sheet rejects — that is a normal user
             action, not an error, so it must not surface as one. */
          navigator.share(data).catch(function (err) {
            if (err && err.name === 'AbortError') return;
            copyFallback();
          });
          return;
        }
        copyFallback();

        function copyFallback() {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(
              function () { flash('Link copied to clipboard'); },
              function () { legacyCopy(); }
            );
          } else {
            legacyCopy();
          }
        }
        function legacyCopy() {
          try {
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:absolute;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            flash(ok ? 'Link copied to clipboard' : 'Copy not supported on this device');
          } catch (err) {
            flash('Copy not supported on this device');
          }
        }
      });
    });
  }

  /* ---------------------------------------------------------
     Property details modal
  --------------------------------------------------------- */
  function initPropertyModal() {
    var modal = $('#propertyModal');
    if (!modal) return;
    var closeBtn = $('.pmodal-close', modal);
    var lastTrigger = null;
    var isOpen = false;

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    var title = $('.pmodal-title', modal);
    if (title) {
      if (!title.id) title.id = 'pmodalTitle';
      modal.setAttribute('aria-labelledby', title.id);
    }

    function setText(sel, value) {
      var el = $(sel, modal);
      if (el) el.textContent = value || '';
    }

    function open(card, trigger) {
      var img = $('.pmodal-media img', modal);
      if (img) {
        img.src = card.getAttribute('data-image') || '';
        img.alt = (card.getAttribute('data-name') || 'Property') + ' — property photograph';
      }
      setText('.pmodal-title', card.getAttribute('data-name'));
      setText('.pmodal-price', card.getAttribute('data-price-label'));
      setText('.pmodal-size', card.getAttribute('data-size-label'));
      setText('.pmodal-type', card.getAttribute('data-type-label'));
      setText('.pmodal-status', card.getAttribute('data-status-label'));
      setText('.pmodal-desc', card.getAttribute('data-desc'));

      /* Location keeps its icon, so replace only the trailing text node. */
      var loc = $('.pmodal-loc', modal);
      if (loc) {
        var icon = $('i', loc);
        loc.textContent = '';
        if (icon) loc.appendChild(icon);
        loc.appendChild(document.createTextNode(' ' + (card.getAttribute('data-location-label') || '')));
      }

      lastTrigger = trigger || null;
      isOpen = true;
      modal.classList.add('open');
      modal.removeAttribute('aria-hidden');
      ScrollLock.lock();
      /* The dialog is visibility:hidden until .open takes effect, and a
         hidden element silently refuses focus. Reading offsetHeight forces
         a synchronous style/layout flush so the button is focusable now —
         requestAnimationFrame is not enough, as its callbacks run before
         style recalculation. */
      void modal.offsetHeight;
      focusNoScroll(closeBtn);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      ScrollLock.unlock();
      if (lastTrigger && document.contains(lastTrigger)) focusNoScroll(lastTrigger);
      lastTrigger = null;
    }

    /* Delegated: one listener total, so repeated opens can never stack
       duplicate handlers. */
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest ? e.target.closest('.view-details') : null;
      if (!trigger) return;
      var card = trigger.closest('[data-property]');
      if (!card) return;
      e.preventDefault();
      open(card, trigger);
    });

    if (closeBtn) closeBtn.addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') trapFocus(modal, e);
    });
  }

  /* ---------------------------------------------------------
     Gallery filtering
  --------------------------------------------------------- */
  function initGallery() {
    var filters = $$('.gfilter');
    var items = $$('.masonry-item');
    if (!filters.length || !items.length) return;

    filters.forEach(function (btn) {
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
      btn.addEventListener('click', function () {
        filters.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        var cat = btn.getAttribute('data-filter');
        items.forEach(function (item) {
          var show = cat === 'all' || item.getAttribute('data-category') === cat;
          item.toggleAttribute('data-hide', !show);
        });
        /* Tell the lightbox its sequence changed. */
        document.dispatchEvent(new CustomEvent('gallery:filtered'));
      });
    });
  }

  /* ---------------------------------------------------------
     Lightbox
  --------------------------------------------------------- */
  function initLightbox() {
    var lightbox = $('#lightbox');
    if (!lightbox) return;
    var items = $$('.masonry-item');
    if (!items.length) return;

    var img = $('img', lightbox);
    var closeBtn = $('.lightbox-close', lightbox);
    var prevBtn = $('.lightbox-prev', lightbox);
    var nextBtn = $('.lightbox-next', lightbox);
    if (!img) return;

    var caption = $('.lightbox-caption', lightbox);
    if (!caption) {
      caption = document.createElement('p');
      caption.className = 'lightbox-caption';
      lightbox.appendChild(caption);
    }

    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Image viewer');
    lightbox.setAttribute('aria-hidden', 'true');

    var sequence = [];
    var pos = 0;
    var isOpen = false;
    var lastTrigger = null;

    /* Only currently-visible items belong in the navigation sequence —
       otherwise prev/next walk through images the filter hid. */
    function rebuild() {
      sequence = items.filter(function (it) { return !it.hasAttribute('data-hide'); });
    }
    document.addEventListener('gallery:filtered', rebuild);
    rebuild();

    function show(i) {
      if (!sequence.length) return;
      pos = (i + sequence.length) % sequence.length;
      var item = sequence[pos];
      var src = $('img', item);
      if (!src) return;
      img.src = src.src;
      img.alt = src.alt || 'Gallery image';
      var label = $('.masonry-overlay span', item);
      caption.textContent = label ? label.textContent : '';
      var multi = sequence.length > 1;
      if (prevBtn) prevBtn.style.display = multi ? '' : 'none';
      if (nextBtn) nextBtn.style.display = multi ? '' : 'none';
    }

    function open(item, trigger) {
      rebuild();
      var i = sequence.indexOf(item);
      if (i === -1) return;
      lastTrigger = trigger || null;
      isOpen = true;
      show(i);
      lightbox.classList.add('open');
      lightbox.removeAttribute('aria-hidden');
      ScrollLock.lock();
      /* Same visibility:hidden caveat as the property modal. */
      void lightbox.offsetHeight;
      focusNoScroll(closeBtn);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      ScrollLock.unlock();
      if (lastTrigger && document.contains(lastTrigger)) focusNoScroll(lastTrigger);
      lastTrigger = null;
    }

    /* A missing/broken file must not leave a blank dialog. */
    img.addEventListener('error', function () {
      caption.textContent = 'This image could not be loaded.';
    });

    items.forEach(function (item) {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      var label = $('.masonry-overlay span', item);
      item.setAttribute('aria-label', 'View image' + (label ? ': ' + label.textContent : ''));
      item.addEventListener('click', function () { open(item, item); });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(item, item); }
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (prevBtn) prevBtn.addEventListener('click', function () { show(pos - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { show(pos + 1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) close(); });

    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowRight') show(pos + 1);
      if (e.key === 'ArrowLeft') show(pos - 1);
      if (e.key === 'Tab') trapFocus(lightbox, e);
    });

    addSwipe(lightbox, function () { show(pos + 1); }, function () { show(pos - 1); });
  }

  /* Shared horizontal swipe helper. Ignores mostly-vertical gestures so
     it never fights the page scroll. */
  function addSwipe(el, onLeft, onRight) {
    var x0 = null, y0 = null;
    el.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      x0 = t.clientX; y0 = t.clientY;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0;
      var dy = t.clientY - y0;
      x0 = null; y0 = null;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
      dx < 0 ? onLeft() : onRight();
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     Testimonials slider
  --------------------------------------------------------- */
  function initTestimonials() {
    var track = $('.testi-track');
    if (!track) return;
    var slides = $$('.testi-slide', track);
    if (!slides.length) return;

    var wrap = track.closest('.testi-track-wrap') || track.parentElement;
    var dotsWrap = $('.testi-dots');
    var index = 0;
    var timer = null;
    var paused = false;
    var INTERVAL = 6000;

    /* Build the controls row if the page only supplied a dots container. */
    var controls = $('.testi-controls');
    if (!controls && dotsWrap) {
      controls = document.createElement('div');
      controls.className = 'testi-controls';
      dotsWrap.parentNode.insertBefore(controls, dotsWrap);
      var mkArrow = function (dir, label, icon) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'testi-arrow testi-' + dir;
        b.setAttribute('aria-label', label);
        b.innerHTML = '<i class="fa-solid fa-chevron-' + icon + '" aria-hidden="true"></i>';
        return b;
      };
      var prev = mkArrow('prev', 'Previous testimonial', 'left');
      var next = mkArrow('next', 'Next testimonial', 'right');
      controls.appendChild(prev);
      controls.appendChild(dotsWrap);
      controls.appendChild(next);
      prev.addEventListener('click', function () { go(index - 1); restart(); });
      next.addEventListener('click', function () { go(index + 1); restart(); });
    }

    if (dotsWrap) {
      slides.forEach(function (s, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Show testimonial ' + (i + 1) + ' of ' + slides.length);
        dot.addEventListener('click', function () { go(i); restart(); });
        dotsWrap.appendChild(dot);
      });
    }

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      if (dotsWrap) {
        $$('button', dotsWrap).forEach(function (b, bi) {
          b.classList.toggle('active', bi === index);
        });
      }
      slides.forEach(function (s, si) {
        s.setAttribute('aria-hidden', si === index ? 'false' : 'true');
      });
    }

    function stop() { if (timer) { window.clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (paused || document.hidden || prefersReducedMotion() || slides.length < 2) return;
      timer = window.setInterval(function () { go(index + 1); }, INTERVAL);
    }
    function restart() { stop(); start(); }

    /* Pause on hover, on keyboard focus, and while the tab is hidden —
       always exactly one timer. */
    if (wrap) {
      wrap.addEventListener('mouseenter', function () { paused = true; stop(); });
      wrap.addEventListener('mouseleave', function () { paused = false; start(); });
      wrap.addEventListener('focusin', function () { paused = true; stop(); });
      wrap.addEventListener('focusout', function () { paused = false; start(); });
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-roledescription', 'carousel');
      wrap.setAttribute('aria-label', 'Client testimonials');
      wrap.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); restart(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); restart(); }
      });
      addSwipe(wrap, function () { go(index + 1); restart(); }, function () { go(index - 1); restart(); });
    }
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    go(0);
    start();
  }

  /* ---------------------------------------------------------
     FAQ accordion
  --------------------------------------------------------- */
  function initFaq() {
    var rows = $$('.faq-q');
    if (!rows.length) return;

    rows.forEach(function (row, i) {
      var item = row.closest('.faq-item');
      if (!item) return;
      var answer = $('.faq-a', item);

      /* Upgrade the div row to a real button so the whole row is
         clickable, focusable and announced as expandable. */
      var btn = row;
      if (row.tagName !== 'BUTTON') {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = row.className;
        while (row.firstChild) btn.appendChild(row.firstChild);
        row.parentNode.replaceChild(btn, row);
      }

      if (answer) {
        if (!answer.id) answer.id = 'faq-answer-' + i;
        btn.setAttribute('aria-controls', answer.id);
        answer.setAttribute('role', 'region');
        if (!btn.id) btn.id = 'faq-q-' + i;
        answer.setAttribute('aria-labelledby', btn.id);
      }
      btn.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');

      btn.addEventListener('click', function () {
        var open = item.classList.contains('open');
        var siblings = item.parentElement ? $$('.faq-item', item.parentElement) : [item];
        siblings.forEach(function (other) {
          other.classList.remove('open');
          var ob = $('.faq-q', other);
          if (ob) ob.setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------------------------------------------------------
     PRRM commission calculator
     Formulas are unchanged: 10% direct, 4% referral.
  --------------------------------------------------------- */
  function initCalculator() {
    var input = $('#sellingPrice');
    if (!input) return;
    var outCommission = $('#outCommission');
    var outReferral = $('#outReferral');
    var outTotal = $('#outTotal');
    if (!outCommission || !outReferral || !outTotal) return;

    input.setAttribute('inputmode', 'numeric');

    var nf = (typeof Intl !== 'undefined' && Intl.NumberFormat)
      ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
      : null;

    function naira(n) {
      if (!isFinite(n) || n < 0) n = 0;
      if (nf) return nf.format(n);
      return '₦' + Math.round(n).toLocaleString('en-NG');
    }

    function calc() {
      var raw = parseFloat(input.value);
      /* Empty, non-numeric and negative input all resolve to zero rather
         than rendering NaN. */
      var price = (isNaN(raw) || !isFinite(raw) || raw < 0) ? 0 : raw;
      var commission = price * 0.10;
      var referral = price * 0.04;
      outCommission.textContent = naira(commission);
      outReferral.textContent = naira(referral);
      outTotal.textContent = naira(commission + referral);
    }

    input.addEventListener('input', calc);
    input.addEventListener('change', calc);
    calc();
  }

  /* ---------------------------------------------------------
     Forms
     There is no backend, so nothing here claims a message was
     delivered. Contact hands off to email/WhatsApp; newsletter
     validates locally and says so.
  --------------------------------------------------------- */
  function initForms() {
    initContactForm();
    initNewsletterForms();
  }

  function fieldGroup(el) { return el ? el.closest('.form-group') : null; }

  function initContactForm() {
    var form = $('#contactForm');
    if (!form) return;
    var status = $('#contactSuccess');
    var submitBtn = $('button[type="submit"]', form);
    var submitting = false;

    var name = $('#cf-name', form);
    var email = $('#cf-email', form);
    var phone = $('#cf-phone', form);
    var subject = $('#cf-subject', form);
    var message = $('#cf-message', form);

    if (phone) phone.setAttribute('inputmode', 'tel');

    function setError(el, on) {
      var g = fieldGroup(el);
      if (g) g.classList.toggle('error', on);
      if (el) el.setAttribute('aria-invalid', on ? 'true' : 'false');
    }

    function showStatus(text, isError) {
      if (!status) return;
      status.textContent = '';
      var icon = document.createElement('i');
      icon.className = isError ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
      icon.setAttribute('aria-hidden', 'true');
      var span = document.createElement('span');
      span.textContent = text;
      status.appendChild(icon);
      status.appendChild(span);
      status.classList.toggle('form-note', !!isError);
      status.classList.add('show');
      status.setAttribute('role', 'status');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return;

      var valid = true;
      var firstBad = null;

      [name, email, phone, message].forEach(function (f) { setError(f, false); });

      if (name && !name.value.trim()) { setError(name, true); valid = false; firstBad = firstBad || name; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setError(email, true); valid = false; firstBad = firstBad || email; }
      if (phone && !/^[0-9+\s()-]{7,}$/.test(phone.value.trim())) { setError(phone, true); valid = false; firstBad = firstBad || phone; }
      if (message && !message.value.trim()) { setError(message, true); valid = false; firstBad = firstBad || message; }

      if (!valid) {
        showStatus('Please correct the highlighted fields and try again.', true);
        if (firstBad) firstBad.focus();
        return;
      }

      /* Static site: compose a message the visitor actually sends
         themselves. Nothing is transmitted from this page. */
      submitting = true;
      if (submitBtn) submitBtn.setAttribute('aria-busy', 'true');

      var subjectText = subject && subject.value ? subject.value : 'Website enquiry';
      var body =
        'Name: ' + (name ? name.value.trim() : '') + '\n' +
        'Email: ' + (email ? email.value.trim() : '') + '\n' +
        'Phone: ' + (phone ? phone.value.trim() : '') + '\n' +
        'Subject: ' + subjectText + '\n\n' +
        (message ? message.value.trim() : '');

      var mailto = 'mailto:info@pineleafestates.com.ng' +
        '?subject=' + encodeURIComponent('PineLeaf enquiry — ' + subjectText) +
        '&body=' + encodeURIComponent(body);

      showStatus('Your email app is opening with this enquiry ready to send. Prefer WhatsApp? Use the chat button instead.', false);

      window.setTimeout(function () {
        window.location.href = mailto;
        submitting = false;
        if (submitBtn) submitBtn.removeAttribute('aria-busy');
      }, 400);
    });
  }

  function initNewsletterForms() {
    $$('.newsletter-form').forEach(function (form) {
      var input = $('input', form);
      var msg = form.parentElement ? $('.nl-msg', form.parentElement) : null;
      if (!msg) msg = $('.nl-msg', form);
      if (!input) return;
      var tid = null;

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var value = input.value.trim();
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (!msg) return;

        if (ok) {
          /* No mailing-list backend exists — say what actually happens. */
          msg.textContent = 'Thanks! Email info@pineleafestates.com.ng to confirm your subscription.';
          msg.classList.remove('is-error');
          input.value = '';
        } else {
          msg.textContent = 'Please enter a valid email address.';
          msg.classList.add('is-error');
        }
        msg.classList.add('show');
        msg.setAttribute('role', 'status');
        input.setAttribute('aria-invalid', ok ? 'false' : 'true');

        if (tid) window.clearTimeout(tid);
        tid = window.setTimeout(function () { msg.classList.remove('show'); tid = null; }, 6000);
      });
    });
  }

  /* ---------------------------------------------------------
     Floating action buttons
  --------------------------------------------------------- */
  function initFloatingActions() {
    var stack = $('.float-stack');
    var topBtn = $('.float-btn.top');
    if (!stack && !topBtn) return;

    var ticking = false;
    var lastY = window.scrollY || window.pageYOffset || 0;
    var idleTimer = null;

    function apply() {
      var y = window.scrollY || window.pageYOffset || 0;
      if (topBtn) topBtn.classList.toggle('show', y > 500);

      /* A corner action stack inevitably passes over page controls while
         scrolling. Tucking it away on downward scroll keeps it clear of
         whatever the reader is moving toward, and it returns as soon as
         they scroll up or stop. */
      if (stack) {
        var dy = y - lastY;
        if (dy > 6 && y > 220) stack.classList.add('tucked');
        else if (dy < -6) stack.classList.remove('tucked');

        if (idleTimer) window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(function () {
          stack.classList.remove('tucked');
        }, 700);
      }
      lastY = y;
      ticking = false;
    }

    apply();
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }, { passive: true });

    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    }
  }

  /* ---------------------------------------------------------
     Boot
  --------------------------------------------------------- */
  function runComponent(name, initializer) {
    try {
      initializer();
    } catch (error) {
      console.error('[' + name + '] failed', error);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    runComponent('preloader', initPreloader);
    runComponent('header', initHeader);
    runComponent('mobile navigation', initMobileNavigation);
    runComponent('active nav', initActiveNav);
    runComponent('anchors', initAnchors);
    runComponent('hero slider', initHeroSlider);
    runComponent('typing effect', initTypingEffect);
    runComponent('counters', initCounters);
    runComponent('reveals', initReveals);
    runComponent('property filters', initPropertyFilters);
    /* After the filters so any values seeded from the URL are picked up. */
    runComponent('custom selects', initCustomSelects);
    runComponent('property cards', initPropertyCards);
    runComponent('property modal', initPropertyModal);
    runComponent('gallery', initGallery);
    runComponent('lightbox', initLightbox);
    runComponent('testimonials', initTestimonials);
    runComponent('faq', initFaq);
    runComponent('calculator', initCalculator);
    runComponent('forms', initForms);
    runComponent('floating actions', initFloatingActions);
  });

  /* A restored bfcache page must never come back scroll-locked. */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) ScrollLock.reset();
  });
})();
