/* Gym Neutron: page behaviour that must work with or without the 3D scene.
   1. Registration form validation with a simulated confirmation.
   2. Countdown to the fixed offer deadline, with an expired state.
   3. "Select your element" quiz.
   Nothing typed into the page is stored, logged or sent anywhere. */
(function () {
  "use strict";

  var logic = window.GymNeutronLogic;
  if (!logic) return;

  var TOPBAR_OFFSET = 80;
  var TIME_LABELS = {
    "weekday-morning": "a weekday morning",
    "weekday-afternoon": "a weekday afternoon",
    weekend: "the weekend"
  };
  var FIELD_LABELS = { name: "Full name", email: "Email", mobile: "Mobile number", time: "Orientation time", consent: "Consent" };

  /* ── in-page links: smooth scroll through Lenis when the 3D is running ── */
  function initAnchors() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute("href").slice(1);
      var target = id ? document.getElementById(id) : null;
      if (!target) return;

      var menu = link.closest("details.menu");
      if (menu) menu.removeAttribute("open");

      if (target.tagName === "DETAILS") target.open = true;

      var lenis = window.__gnLenis;
      if (lenis) {
        event.preventDefault();
        lenis.scrollTo(target, { offset: -TOPBAR_OFFSET });
        history.replaceState(null, "", "#" + id);
      }
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: Boolean(lenis) });
    });
  }

  /* ── countdown ────────────────────────────────────────────────────────── */
  function initCountdown() {
    var section = document.getElementById("claim");
    var box = document.querySelector("[data-countdown]");
    var expiredBox = document.querySelector("[data-expired]");
    if (!section || !box || !expiredBox) return;

    var cells = {};
    ["days", "hours", "minutes", "seconds"].forEach(function (unit) {
      cells[unit] = box.querySelector('[data-cd="' + unit + '"]');
    });

    // ?now=2026-12-01T00:00:00+08:00 previews the page at another moment.
    var offset = logic.parseNowOverride(window.location.search, Date.now());
    var timer = null;

    function pad(n) { return n < 10 ? "0" + n : String(n); }

    function showExpired() {
      section.classList.add("is-expired");
      document.documentElement.classList.add("offer-expired");
      box.hidden = true;
      expiredBox.hidden = false;
      var success = document.getElementById("register-success");
      if (success) success.hidden = true;
      var submit = document.querySelector("#register [type=submit]");
      if (submit) submit.disabled = true;
      Array.prototype.forEach.call(document.querySelectorAll("[data-claim-cta]"), function (cta) {
        cta.textContent = cta.getAttribute("data-expired-label");
      });
      if (timer) window.clearInterval(timer);
    }

    function update() {
      var c = logic.getCountdown(Date.now() + offset, logic.OFFER_END_MS);
      if (c.expired) {
        showExpired();
        return;
      }
      cells.days.textContent = pad(c.days);
      cells.hours.textContent = pad(c.hours);
      cells.minutes.textContent = pad(c.minutes);
      cells.seconds.textContent = pad(c.seconds);
    }

    update();
    if (!section.classList.contains("is-expired")) timer = window.setInterval(update, 1000);
  }

  /* ── registration form ────────────────────────────────────────────────── */
  function initRegistration() {
    var form = document.getElementById("register");
    var success = document.getElementById("register-success");
    if (!form || !success) return;
    var summary = form.querySelector("[data-error-summary]");
    var attempted = false;

    function values() {
      return {
        name: form.elements.name.value,
        email: form.elements.email.value,
        mobile: form.elements.mobile.value,
        time: form.elements.time.value,
        consent: form.elements.consent.checked,
        buddy: form.elements.buddy.checked
      };
    }

    function showErrors(errors) {
      Object.keys(FIELD_LABELS).forEach(function (field) {
        var control = form.elements[field];
        var message = document.getElementById("e-" + field);
        var error = errors[field] || "";
        message.textContent = error;
        if (error) control.setAttribute("aria-invalid", "true");
        else control.removeAttribute("aria-invalid");
      });
    }

    function showSummary(errors) {
      var fields = Object.keys(errors);
      if (fields.length === 0) {
        summary.hidden = true;
        summary.textContent = "";
        return;
      }
      var names = fields.map(function (f) { return FIELD_LABELS[f]; });
      summary.textContent = (fields.length === 1 ? "Please fix 1 field: " : "Please fix " + fields.length + " fields: ") + names.join(", ") + ".";
      summary.hidden = false;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (document.documentElement.classList.contains("offer-expired")) return;
      attempted = true;
      var result = logic.validateRegistration(values());
      showErrors(result.errors);
      showSummary(result.errors);
      if (!result.valid) {
        var first = Object.keys(FIELD_LABELS).filter(function (f) { return result.errors[f]; })[0];
        form.elements[first].focus();
        return;
      }
      confirm(result.clean);
    });

    // After the first attempt, fix messages as soon as the field is corrected.
    form.addEventListener("input", recheck);
    form.addEventListener("change", recheck);
    function recheck() {
      if (!attempted) return;
      var result = logic.validateRegistration(values());
      showErrors(result.errors);
      showSummary(result.errors);
    }

    function confirm(clean) {
      var firstName = clean.name.split(" ")[0];
      var element = form.elements.element.value;
      var elementInfo = element && logic.ELEMENTS[element];
      success.querySelector("[data-success-title]").textContent = "You're in, " + firstName + ".";
      success.querySelector("[data-success-body]").textContent =
        "Expect a call or text at " + clean.mobile + " within 5 minutes during staffed hours (6 AM to 10 PM) to book your orientation on " +
        TIME_LABELS[clean.time] + ". We'll also email the details to " + clean.email + "." +
        (clean.buddy ? " Bring your buddy's name to the call and we'll hold a spot for them too." : "") +
        (elementInfo ? " Your coach will start you on the " + elementInfo.name + " path." : "");
      form.hidden = true;
      success.hidden = false;
      success.focus();
      form.reset();
      form.elements.element.value = element;
      attempted = false;
    }

    success.querySelector("[data-register-reset]").addEventListener("click", function () {
      success.hidden = true;
      form.hidden = false;
      showErrors({});
      showSummary({});
      form.elements.name.focus();
    });
  }

  /* ── element quiz ─────────────────────────────────────────────────────── */
  function initQuiz() {
    var form = document.getElementById("quiz");
    var resultBox = document.getElementById("quiz-result");
    if (!form || !resultBox) return;
    var questions = Array.prototype.slice.call(form.querySelectorAll(".quiz-q"));
    var stepLabel = form.querySelector("[data-quiz-step]");
    var errorBox = form.querySelector("[data-quiz-error]");
    var back = form.querySelector("[data-quiz-back]");
    var next = form.querySelector("[data-quiz-next]");
    var submit = form.querySelector("[data-quiz-submit]");
    var current = 0;

    form.classList.add("quiz-ready");

    function answerFor(index) {
      var checked = questions[index].querySelector("input:checked");
      return checked ? checked.value : null;
    }

    function show(index) {
      current = index;
      questions.forEach(function (q, i) { q.classList.toggle("is-current", i === index); });
      stepLabel.textContent = "Question " + (index + 1);
      back.hidden = index === 0;
      next.hidden = index === questions.length - 1;
      submit.hidden = index !== questions.length - 1;
      errorBox.textContent = "";
    }

    function requireAnswer() {
      if (answerFor(current)) return true;
      errorBox.textContent = "Pick one answer to continue.";
      var firstOption = questions[current].querySelector("input");
      if (firstOption) firstOption.focus();
      return false;
    }

    next.addEventListener("click", function () {
      if (!requireAnswer()) return;
      show(current + 1);
      questions[current].querySelector("input").focus();
    });

    back.addEventListener("click", function () {
      show(current - 1);
      questions[current].querySelector("input").focus();
    });

    form.addEventListener("change", function () { errorBox.textContent = ""; });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!requireAnswer()) return;
      var answers = questions.map(function (_, i) { return answerFor(i); });
      var key = logic.scoreQuiz(answers);
      if (!key) return;
      render(logic.ELEMENTS[key]);
    });

    function render(info) {
      resultBox.querySelector("[data-result-number]").textContent = info.number;
      resultBox.querySelector("[data-result-symbol]").textContent = info.symbol;
      resultBox.querySelector("[data-result-name]").textContent = info.name;
      resultBox.querySelector("[data-result-title]").textContent = info.name + ": " + info.path;
      resultBox.querySelector("[data-result-summary]").textContent = info.summary;
      var plan = resultBox.querySelector("[data-result-plan]");
      plan.textContent = "";
      info.plan.forEach(function (line) {
        var li = document.createElement("li");
        li.textContent = line;
        plan.appendChild(li);
      });
      var hidden = document.querySelector('#register input[name="element"]');
      if (hidden) hidden.value = info.symbol;
      form.hidden = true;
      resultBox.hidden = false;
      resultBox.focus();
    }

    resultBox.querySelector("[data-quiz-restart]").addEventListener("click", function () {
      form.reset();
      resultBox.hidden = true;
      form.hidden = false;
      show(0);
      questions[0].querySelector("input").focus();
    });

    show(0);
  }

  function init() {
    initAnchors();
    initCountdown();
    initRegistration();
    initQuiz();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
