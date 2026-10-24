/* Gym Neutron: pure logic for the three interactive features.
   No DOM access here, so the same file runs in the browser (as
   window.GymNeutronLogic) and in Node for the unit tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GymNeutronLogic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Registration closes 11:59:59 PM, November 30, 2026, Philippine time.
  var OFFER_END_ISO = "2026-11-30T23:59:59+08:00";
  var OFFER_END_MS = Date.parse(OFFER_END_ISO);

  var NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ][A-Za-zÀ-ÖØ-öø-ÿÑñ .'-]*$/;
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  var TIME_SLOTS = ["weekday-morning", "weekday-afternoon", "weekend"];

  /* Returns the mobile number as 09XXXXXXXXX, or null if it isn't a valid
     Philippine mobile number. Accepts spaces and dashes, and +63 / 63 forms. */
  function normalizeMobile(raw) {
    var digits = String(raw || "").replace(/[\s-]/g, "");
    if (/^\+639\d{9}$/.test(digits)) return "0" + digits.slice(3);
    if (/^639\d{9}$/.test(digits)) return "0" + digits.slice(2);
    if (/^09\d{9}$/.test(digits)) return digits;
    return null;
  }

  function validateName(raw) {
    var name = String(raw || "").trim().replace(/\s+/g, " ");
    if (!name) return "Enter your full name so your coach knows who to look for.";
    if (name.length < 2) return "Your name needs at least 2 letters.";
    if (name.length > 60) return "Keep your name under 60 characters.";
    if (!NAME_PATTERN.test(name)) return "Use letters only, plus spaces, hyphens or apostrophes.";
    if (name.indexOf(" ") === -1) return "Add your last name too.";
    return null;
  }

  function validateEmail(raw) {
    var email = String(raw || "").trim();
    if (!email) return "Enter your email so we can send your orientation details.";
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return "That email doesn't look right. Check for a missing @ or domain, like name@gmail.com.";
    }
    return null;
  }

  function validateMobile(raw) {
    if (!String(raw || "").trim()) return "Enter your mobile number so the front desk can call you.";
    if (!normalizeMobile(raw)) return "Use an 11-digit PH mobile number that starts with 09.";
    return null;
  }

  function validateTime(raw) {
    if (TIME_SLOTS.indexOf(raw) === -1) return "Pick a time for your orientation.";
    return null;
  }

  function validateConsent(checked) {
    if (checked !== true) return "Tick this box so we're allowed to contact you about your spot.";
    return null;
  }

  /* Validates the whole registration form. Returns { valid, errors, clean }
     where errors maps field name to a message and clean holds tidied values. */
  function validateRegistration(input) {
    var data = input || {};
    var checks = {
      name: validateName(data.name),
      email: validateEmail(data.email),
      mobile: validateMobile(data.mobile),
      time: validateTime(data.time),
      consent: validateConsent(data.consent)
    };
    var errors = {};
    Object.keys(checks).forEach(function (field) {
      if (checks[field]) errors[field] = checks[field];
    });
    var valid = Object.keys(errors).length === 0;
    return {
      valid: valid,
      errors: errors,
      clean: valid
        ? {
            name: String(data.name).trim().replace(/\s+/g, " "),
            email: String(data.email).trim().toLowerCase(),
            mobile: normalizeMobile(data.mobile),
            time: data.time,
            buddy: data.buddy === true
          }
        : null
    };
  }

  /* Time left until endMs. Never negative; expired is true from endMs on. */
  function getCountdown(nowMs, endMs) {
    var end = typeof endMs === "number" ? endMs : OFFER_END_MS;
    var remaining = Math.max(0, end - nowMs);
    var totalSeconds = Math.floor(remaining / 1000);
    return {
      expired: nowMs >= end,
      totalMs: remaining,
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  }

  /* Reads a ?now=<ISO date> override for demos and tests. Returns the
     offset in ms to add to the real clock, or 0 when absent or invalid. */
  function parseNowOverride(search, realNowMs) {
    var match = /[?&]now=([^&]+)/.exec(String(search || ""));
    if (!match) return 0;
    var parsed = Date.parse(decodeURIComponent(match[1]));
    if (isNaN(parsed)) return 0;
    return parsed - realNowMs;
  }

  var ELEMENTS = {
    Fe: {
      symbol: "Fe",
      number: 26,
      name: "Iron",
      path: "Strength starter",
      summary: "You want to feel strong. Your coach starts you on guided machines, then moves you to the five basic free-weight lifts once your form is solid.",
      plan: ["3 sessions a week, 45 to 60 minutes", "Full-body machine circuit in week 1", "Dumbbell basics from week 2"]
    },
    O: {
      symbol: "O",
      number: 8,
      name: "Oxygen",
      path: "Engine builder",
      summary: "You want more energy. Your coach builds your stamina with short intervals and light circuits you can finish without feeling wrecked.",
      plan: ["3 to 4 sessions a week, about 30 minutes", "Bike and rower intervals", "Light circuits to finish"]
    },
    Ca: {
      symbol: "Ca",
      number: 20,
      name: "Calcium",
      path: "Foundation first",
      summary: "You want to move without stiffness and start gently. Your coach builds your base with mobility, core work and machines that guide the movement.",
      plan: ["3 sessions a week, 20 to 30 minutes", "Mobility and core warm-up", "Guided machines at an easy pace"]
    },
    Nu: {
      symbol: "Nu",
      number: 0,
      name: "Neutron",
      path: "All-rounder",
      summary: "You want a bit of everything. Your coach mixes strength, cardio and mobility, and Rookie Hour gives you a group to train with.",
      plan: ["3 sessions a week, about 45 minutes", "Rotate strength, cardio and mobility", "Rookie Hour every week"]
    }
  };

  var ELEMENT_ORDER = ["Fe", "O", "Ca", "Nu"];

  /* answers: array of element keys, one per question. The most picked
     element wins; a tie goes to whatever the first question picked, since
     that question asks what the person wants most. */
  function scoreQuiz(answers) {
    var list = Array.isArray(answers) ? answers.filter(function (a) { return ELEMENTS[a]; }) : [];
    if (list.length === 0) return null;
    var counts = {};
    ELEMENT_ORDER.forEach(function (key) { counts[key] = 0; });
    list.forEach(function (key) { counts[key] += 1; });
    var best = Math.max.apply(null, ELEMENT_ORDER.map(function (key) { return counts[key]; }));
    var leaders = ELEMENT_ORDER.filter(function (key) { return counts[key] === best; });
    if (leaders.length === 1) return leaders[0];
    return leaders.indexOf(list[0]) !== -1 ? list[0] : leaders[0];
  }

  return {
    OFFER_END_ISO: OFFER_END_ISO,
    OFFER_END_MS: OFFER_END_MS,
    TIME_SLOTS: TIME_SLOTS,
    ELEMENTS: ELEMENTS,
    normalizeMobile: normalizeMobile,
    validateRegistration: validateRegistration,
    getCountdown: getCountdown,
    parseNowOverride: parseNowOverride,
    scoreQuiz: scoreQuiz
  };
});
