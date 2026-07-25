/* ============================================================
   PineLeaf Estates — script.js
   Vanilla JS only. No frameworks/libraries.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------------------------------------------------------
     Preloader
  --------------------------------------------------------- */
  var preloader = document.getElementById('preloader');
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (preloader) preloader.classList.add('hidden');
    }, 350);
  });

  /* ---------------------------------------------------------
     Sticky header on scroll
  --------------------------------------------------------- */
  var header = document.querySelector('.site-header');
  function handleHeaderScroll () {
    if (!header) return;
    if (window.scrollY > 40) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  handleHeaderScroll();
  window.addEventListener('scroll', handleHeaderScroll);

  /* ---------------------------------------------------------
     Mobile navigation drawer
  --------------------------------------------------------- */
  var hamburger = document.querySelector('.hamburger');
  var mobileNav = document.querySelector('.mobile-nav');
  var mobileClose = document.querySelector('.mobile-close');
  var navScrim = document.querySelector('.nav-scrim');

  function openMobileNav () {
    if (mobileNav) mobileNav.classList.add('open');
    if (navScrim) navScrim.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileNav () {
    if (mobileNav) mobileNav.classList.remove('open');
    if (navScrim) navScrim.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (hamburger) hamburger.addEventListener('click', openMobileNav);
  if (mobileClose) mobileClose.addEventListener('click', closeMobileNav);
  if (navScrim) navScrim.addEventListener('click', closeMobileNav);
  document.querySelectorAll('.mobile-nav a').forEach(function (a) {
    a.addEventListener('click', closeMobileNav);
  });

  /* ---------------------------------------------------------
     Active nav link highlight (based on current page)
  --------------------------------------------------------- */
  var currentPage = (window.location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.main-nav a, .mobile-nav a').forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* ---------------------------------------------------------
     Smooth scroll for in-page anchor links
  --------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length > 1) {
        var target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          window.scrollTo({ top: target.offsetTop - 90, behavior: 'smooth' });
        }
      }
    });
  });

  /* ---------------------------------------------------------
     Hero slider (home page)
  --------------------------------------------------------- */
  var slides = document.querySelectorAll('.hero-slide');
  var dotsWrap = document.querySelector('.hero-dots');
  var slideIndex = 0;
  var slideTimer;

  function goToSlide (i) {
    if (!slides.length) return;
    slides[slideIndex].classList.remove('active');
    if (dotsWrap) dotsWrap.children[slideIndex].classList.remove('active');
    slideIndex = (i + slides.length) % slides.length;
    slides[slideIndex].classList.add('active');
    if (dotsWrap) dotsWrap.children[slideIndex].classList.add('active');
  }
  function nextSlide () { goToSlide(slideIndex + 1); }
  function prevSlide () { goToSlide(slideIndex - 1); }

  if (slides.length) {
    slides.forEach(function (s, i) {
      if (dotsWrap) {
        var dot = document.createElement('button');
        if (i === 0) dot.classList.add('active');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', function () { goToSlide(i); resetTimer(); });
        dotsWrap.appendChild(dot);
      }
    });
    var nextBtn = document.querySelector('.hero-arrows .next');
    var prevBtn = document.querySelector('.hero-arrows .prev');
    if (nextBtn) nextBtn.addEventListener('click', function () { nextSlide(); resetTimer(); });
    if (prevBtn) prevBtn.addEventListener('click', function () { prevSlide(); resetTimer(); });

    function resetTimer () {
      clearInterval(slideTimer);
      slideTimer = setInterval(nextSlide, 5500);
    }
    resetTimer();
  }

  /* ---------------------------------------------------------
     Hero headline typing effect
  --------------------------------------------------------- */
  var typeTarget = document.querySelector('[data-typing]');
  if (typeTarget) {
    var words = JSON.parse(typeTarget.getAttribute('data-typing'));
    var wIndex = 0, cIndex = 0, deleting = false;
    var cursor = document.createElement('span');
    cursor.className = 'type-cursor';
    typeTarget.after(cursor);

    function typeLoop () {
      var word = words[wIndex];
      if (!deleting) {
        cIndex++;
        typeTarget.textContent = word.slice(0, cIndex);
        if (cIndex === word.length) { deleting = true; setTimeout(typeLoop, 1600); return; }
      } else {
        cIndex--;
        typeTarget.textContent = word.slice(0, cIndex);
        if (cIndex === 0) { deleting = false; wIndex = (wIndex + 1) % words.length; }
      }
      setTimeout(typeLoop, deleting ? 40 : 80);
    }
    typeLoop();
  }

  /* ---------------------------------------------------------
     Animated stat counters
  --------------------------------------------------------- */
  var counters = document.querySelectorAll('[data-count]');
  var counted = new WeakSet();
  function runCounter (el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var current = 0;
    var step = Math.max(1, Math.ceil(target / 60));
    var iv = setInterval(function () {
      current += step;
      if (current >= target) { current = target; clearInterval(iv); }
      el.textContent = current + suffix;
    }, 24);
  }
  var counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !counted.has(entry.target)) {
        counted.add(entry.target);
        runCounter(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(function (c) { counterObserver.observe(c); });

  /* ---------------------------------------------------------
     Scroll reveal animation
  --------------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(function (el) { revealObserver.observe(el); });

  /* ---------------------------------------------------------
     Lazy loading images (native + fallback fade-in)
  --------------------------------------------------------- */
  document.querySelectorAll('img[data-src]').forEach(function (img) {
    img.setAttribute('loading', 'lazy');
    img.src = img.getAttribute('data-src');
    img.removeAttribute('data-src');
  });

  /* ---------------------------------------------------------
     Property search / filter (Properties page + home preview)
  --------------------------------------------------------- */
  var searchForm = document.querySelector('.search-panel');
  var propertyCards = document.querySelectorAll('[data-property]');
  var noResults = document.querySelector('.no-results');

  function applyFilters () {
    if (!searchForm) return;
    var loc = document.getElementById('filterLocation');
    var type = document.getElementById('filterType');
    var budget = document.getElementById('filterBudget');
    var size = document.getElementById('filterSize');
    var status = document.getElementById('filterStatus');

    var locVal = loc ? loc.value : '';
    var typeVal = type ? type.value : '';
    var budgetVal = budget ? budget.value : '';
    var sizeVal = size ? size.value : '';
    var statusVal = status ? status.value : '';

    var visibleCount = 0;

    propertyCards.forEach(function (card) {
      var price = parseInt(card.getAttribute('data-price'), 10);
      var matchesLoc = !locVal || card.getAttribute('data-location') === locVal;
      var matchesType = !typeVal || card.getAttribute('data-type') === typeVal;
      var matchesSize = !sizeVal || card.getAttribute('data-size') === sizeVal;
      var matchesStatus = !statusVal || card.getAttribute('data-status') === statusVal;
      var matchesBudget = true;

      if (budgetVal === 'under1') matchesBudget = price < 1000000;
      else if (budgetVal === '1to3') matchesBudget = price >= 1000000 && price <= 3000000;
      else if (budgetVal === '3to5') matchesBudget = price > 3000000 && price <= 5000000;
      else if (budgetVal === '5to10') matchesBudget = price > 5000000 && price <= 10000000;
      else if (budgetVal === '10plus') matchesBudget = price > 10000000;

      var show = matchesLoc && matchesType && matchesBudget && matchesSize && matchesStatus;
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    if (noResults) noResults.classList.toggle('show', visibleCount === 0);
  }

  var searchBtn = document.querySelector('.search-panel .btn-gold, .search-panel .btn-primary');
  if (searchBtn) searchBtn.addEventListener('click', function (e) { e.preventDefault(); applyFilters(); });

  /* ---------------------------------------------------------
     Favourite / share icons on property cards
  --------------------------------------------------------- */
  document.querySelectorAll('.pc-actions .fav').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      btn.classList.toggle('active');
    });
  });
  document.querySelectorAll('.pc-actions .share').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var card = btn.closest('[data-property]');
      var name = card ? card.getAttribute('data-name') : 'this property';
      if (navigator.share) {
        navigator.share({ title: name, text: 'Check out ' + name + ' on PineLeaf Estates', url: window.location.href });
      } else {
        alert('Share link copied: ' + window.location.href);
      }
    });
  });

  /* ---------------------------------------------------------
     Property details modal
  --------------------------------------------------------- */
  var pmodal = document.getElementById('propertyModal');
  if (pmodal) {
    var pmClose = pmodal.querySelector('.pmodal-close');
    document.querySelectorAll('.view-details').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var card = btn.closest('[data-property]');
        if (!card) return;
        pmodal.querySelector('.pmodal-media img').src = card.getAttribute('data-image');
        pmodal.querySelector('.pmodal-title').textContent = card.getAttribute('data-name');
        pmodal.querySelector('.pmodal-loc').textContent = card.getAttribute('data-location-label');
        pmodal.querySelector('.pmodal-price').textContent = card.getAttribute('data-price-label');
        pmodal.querySelector('.pmodal-size').textContent = card.getAttribute('data-size-label');
        pmodal.querySelector('.pmodal-type').textContent = card.getAttribute('data-type-label');
        pmodal.querySelector('.pmodal-status').textContent = card.getAttribute('data-status-label');
        pmodal.querySelector('.pmodal-desc').textContent = card.getAttribute('data-desc');
        pmodal.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });
    function closePmodal () { pmodal.classList.remove('open'); document.body.style.overflow = ''; }
    if (pmClose) pmClose.addEventListener('click', closePmodal);
    pmodal.addEventListener('click', function (e) { if (e.target === pmodal) closePmodal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePmodal(); });
  }

  /* ---------------------------------------------------------
     Commission calculator (Investment page)
  --------------------------------------------------------- */
  var priceInput = document.getElementById('sellingPrice');
  if (priceInput) {
    var outCommission = document.getElementById('outCommission');
    var outReferral = document.getElementById('outReferral');
    var outTotal = document.getElementById('outTotal');

    function formatNaira (n) {
      return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
    }
    function calcCommission () {
      var price = parseFloat(priceInput.value) || 0;
      var commission = price * 0.10;
      var referral = price * 0.04;
      outCommission.textContent = formatNaira(commission);
      outReferral.textContent = formatNaira(referral);
      outTotal.textContent = formatNaira(commission + referral);
    }
    priceInput.addEventListener('input', calcCommission);
    calcCommission();
  }

  /* ---------------------------------------------------------
     Gallery filter + masonry
  --------------------------------------------------------- */
  var gfilters = document.querySelectorAll('.gfilter');
  var gitems = document.querySelectorAll('.masonry-item');
  gfilters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      gfilters.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var cat = btn.getAttribute('data-filter');
      gitems.forEach(function (item) {
        var show = cat === 'all' || item.getAttribute('data-category') === cat;
        item.toggleAttribute('data-hide', !show);
      });
    });
  });

  /* ---------------------------------------------------------
     Lightbox
  --------------------------------------------------------- */
  var lightbox = document.getElementById('lightbox');
  if (lightbox) {
    var lbImg = lightbox.querySelector('img');
    var lbClose = lightbox.querySelector('.lightbox-close');
    var lbPrev = lightbox.querySelector('.lightbox-prev');
    var lbNext = lightbox.querySelector('.lightbox-next');
    var galleryImages = Array.prototype.map.call(gitems, function (item) { return item.querySelector('img').src; });
    var lbIndex = 0;

    function openLightbox (i) {
      lbIndex = i;
      lbImg.src = galleryImages[lbIndex];
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox () { lightbox.classList.remove('open'); document.body.style.overflow = ''; }
    function showLbOffset (offset) {
      lbIndex = (lbIndex + offset + galleryImages.length) % galleryImages.length;
      lbImg.src = galleryImages[lbIndex];
    }
    gitems.forEach(function (item, i) {
      item.addEventListener('click', function () { openLightbox(i); });
    });
    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    if (lbPrev) lbPrev.addEventListener('click', function () { showLbOffset(-1); });
    if (lbNext) lbNext.addEventListener('click', function () { showLbOffset(1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') showLbOffset(1);
      if (e.key === 'ArrowLeft') showLbOffset(-1);
    });
  }

  /* ---------------------------------------------------------
     Testimonials slider
  --------------------------------------------------------- */
  var testiTrack = document.querySelector('.testi-track');
  if (testiTrack) {
    var testiSlides = testiTrack.querySelectorAll('.testi-slide');
    var testiDotsWrap = document.querySelector('.testi-dots');
    var tIndex = 0;

    testiSlides.forEach(function (s, i) {
      var dot = document.createElement('button');
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', function () { goToTesti(i); });
      testiDotsWrap.appendChild(dot);
    });
    function goToTesti (i) {
      tIndex = (i + testiSlides.length) % testiSlides.length;
      testiTrack.style.transform = 'translateX(-' + (tIndex * 100) + '%)';
      testiDotsWrap.querySelectorAll('button').forEach(function (b, idx) {
        b.classList.toggle('active', idx === tIndex);
      });
    }
    setInterval(function () { goToTesti(tIndex + 1); }, 6000);
  }

  /* ---------------------------------------------------------
     FAQ accordion
  --------------------------------------------------------- */
  document.querySelectorAll('.faq-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.closest('.faq-item');
      var wasOpen = item.classList.contains('open');
      item.parentElement.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ---------------------------------------------------------
     Contact form validation
  --------------------------------------------------------- */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      var name = contactForm.querySelector('#cf-name');
      var email = contactForm.querySelector('#cf-email');
      var phone = contactForm.querySelector('#cf-phone');
      var message = contactForm.querySelector('#cf-message');

      [name, email, phone, message].forEach(function (f) { if (f) f.closest('.form-group').classList.remove('error'); });

      if (!name.value.trim()) { name.closest('.form-group').classList.add('error'); valid = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { email.closest('.form-group').classList.add('error'); valid = false; }
      if (!/^[0-9+\s-]{7,}$/.test(phone.value.trim())) { phone.closest('.form-group').classList.add('error'); valid = false; }
      if (!message.value.trim()) { message.closest('.form-group').classList.add('error'); valid = false; }

      var successMsg = document.getElementById('contactSuccess');
      if (valid) {
        successMsg.classList.add('show');
        successMsg.textContent = 'Thank you, ' + name.value.split(' ')[0] + '! Your message has been received — our team will reach out shortly.';
        contactForm.reset();
        setTimeout(function () { successMsg.classList.remove('show'); }, 6000);
      }
    });
  }

  /* ---------------------------------------------------------
     Newsletter validation
  --------------------------------------------------------- */
  var nlForm = document.querySelector('.newsletter-form');
  if (nlForm) {
    nlForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = nlForm.querySelector('input');
      var msg = nlForm.querySelector('.nl-msg');
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
        msg.textContent = 'You\'re subscribed — welcome to PineLeaf.';
        msg.classList.add('show');
        input.value = '';
      } else {
        msg.textContent = 'Please enter a valid email address.';
        msg.classList.add('show');
      }
      setTimeout(function () { msg.classList.remove('show'); }, 4500);
    });
  }

  /* ---------------------------------------------------------
     Back-to-top button
  --------------------------------------------------------- */
  var topBtn = document.querySelector('.fab.top');
  if (topBtn) {
    window.addEventListener('scroll', function () {
      topBtn.classList.toggle('show', window.scrollY > 500);
    });
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

});
