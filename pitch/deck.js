/* Gym Neutron pitch deck: scaling, navigation, click-through builds,
   presenter view and the QR code to the live site.
   Keys: → Space PageDown next · ← PageUp back · Home End · F fullscreen · P presenter.
   URL: ?slide=3 opens a slide, &step=all shows every build, &static turns
   transitions off (used for the PDF export), ?presenter opens the notes view. */
(function () {
  "use strict";

  var LIVE_URL = "https://thedalelandoy.github.io/gym-neutron/";
  var root = document.documentElement;
  var params = new URLSearchParams(window.location.search);
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var total = slides.length;
  var state = { slide: 0, step: 0 };
  var channel = "BroadcastChannel" in window ? new BroadcastChannel("gym-neutron-deck") : null;
  var isPresenter = params.has("presenter");

  function stepsOf(index) { return Number(slides[index].getAttribute("data-steps") || 0); }

  /* ── scale the 1920×1080 stage to the window ────────────────────────── */
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    root.style.setProperty("--s", String(s));
  }

  /* ── render the current slide and build step ────────────────────────── */
  function render(broadcast) {
    slides.forEach(function (slide, i) {
      var active = i === state.slide;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
      Array.prototype.forEach.call(slide.querySelectorAll("[data-step]"), function (el) {
        var n = Number(el.getAttribute("data-step"));
        el.classList.toggle("is-shown", i < state.slide || (active && n <= state.step));
      });
    });

    var count = document.getElementById("deck-count");
    if (count) count.textContent = (state.slide + 1) + " / " + total;
    var bar = document.getElementById("deck-progress");
    if (bar) bar.style.width = (((state.slide + 1) / total) * 100) + "%";

    updateOfferTotal();
    renderPresenter();

    document.dispatchEvent(new CustomEvent("deck:change", {
      detail: { slide: state.slide, step: state.step, steps: stepsOf(state.slide), total: total }
    }));
    if (broadcast && channel) channel.postMessage({ type: "goto", slide: state.slide, step: state.step });
  }

  /* The offer total counts up as each bonus is revealed. */
  function updateOfferTotal() {
    var el = document.querySelector("[data-offer-total]");
    if (!el) return;
    var offer = el.closest(".slide");
    var sum = 0;
    Array.prototype.forEach.call(offer.querySelectorAll("[data-step].is-shown .val"), function (val) {
      sum += Number(val.textContent.replace(/[^\d]/g, ""));
    });
    el.textContent = "₱" + sum.toLocaleString("en-PH");
  }

  function go(slide, step, broadcast) {
    state.slide = Math.max(0, Math.min(total - 1, slide));
    state.step = Math.max(0, Math.min(stepsOf(state.slide), step));
    render(broadcast !== false);
  }

  function next() {
    if (state.step < stepsOf(state.slide)) go(state.slide, state.step + 1);
    else if (state.slide < total - 1) go(state.slide + 1, 0);
  }

  function prev() {
    if (state.step > 0) go(state.slide, state.step - 1);
    else if (state.slide > 0) go(state.slide - 1, stepsOf(state.slide - 1));
  }

  /* ── input ──────────────────────────────────────────────────────────── */
  document.addEventListener("keydown", function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var key = event.key;
    if (key === "ArrowRight" || key === " " || key === "PageDown" || key === "Enter") { event.preventDefault(); next(); }
    else if (key === "ArrowLeft" || key === "PageUp" || key === "Backspace") { event.preventDefault(); prev(); }
    else if (key === "Home") go(0, 0);
    else if (key === "End") go(total - 1, stepsOf(total - 1));
    else if (key === "f" || key === "F") toggleFullscreen();
    else if (key === "p" || key === "P") openPresenter();
    hideHelpSoon();
  });

  document.getElementById("deck").addEventListener("click", function (event) {
    if (event.target.closest("a, button")) return;
    if (event.clientX < window.innerWidth * 0.25) prev(); else next();
  });

  var touchX = null;
  document.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
    touchX = null;
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {});
    else document.exitFullscreen();
  }

  var helpTimer = null;
  function hideHelpSoon() {
    var help = document.getElementById("deck-help");
    if (!help) return;
    window.clearTimeout(helpTimer);
    helpTimer = window.setTimeout(function () { help.classList.add("is-hidden"); }, 2500);
  }

  /* ── presenter view ─────────────────────────────────────────────────── */
  function openPresenter() {
    var url = window.location.pathname + "?presenter&slide=" + (state.slide + 1);
    window.open(url, "gym-neutron-presenter", "width=900,height=700");
  }

  var timerStart = Date.now();
  function renderPresenter() {
    if (!isPresenter) return;
    var slide = slides[state.slide];
    var notes = slide.querySelector(".notes");
    document.getElementById("p-num").textContent = String(state.slide + 1);
    document.getElementById("p-title").textContent = slide.getAttribute("data-title") +
      (stepsOf(state.slide) ? "  (build " + state.step + " of " + stepsOf(state.slide) + ")" : "");
    document.getElementById("p-notes").innerHTML = notes ? notes.innerHTML : "";
    var upcoming = state.step < stepsOf(state.slide) ? "next build on this slide"
      : (state.slide < total - 1 ? slides[state.slide + 1].getAttribute("data-title") : "End");
    document.getElementById("p-next").textContent = upcoming;
  }

  function initPresenter() {
    root.classList.add("presenting");
    document.getElementById("presenter").hidden = false;
    document.getElementById("p-prev").addEventListener("click", prev);
    document.getElementById("p-forward").addEventListener("click", next);
    document.getElementById("p-reset").addEventListener("click", function () { timerStart = Date.now(); });
    window.setInterval(function () {
      var secs = Math.floor((Date.now() - timerStart) / 1000);
      var mm = String(Math.floor(secs / 60)).padStart(2, "0");
      var ss = String(secs % 60).padStart(2, "0");
      document.getElementById("p-timer").textContent = mm + ":" + ss;
    }, 500);
  }

  if (channel) {
    channel.onmessage = function (event) {
      var msg = event.data;
      if (msg && msg.type === "goto" && (msg.slide !== state.slide || msg.step !== state.step)) go(msg.slide, msg.step, false);
    };
  }

  /* ── QR code to the live site ───────────────────────────────────────── */
  function drawQr() {
    var box = document.getElementById("qr");
    if (!box || typeof window.qrcode !== "function") return;
    var qr = window.qrcode(0, "M");
    qr.addData(LIVE_URL);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  }

  /* ── start ──────────────────────────────────────────────────────────── */
  if (params.has("static")) root.classList.add("static");
  window.addEventListener("resize", fit);
  fit();
  drawQr();
  if (isPresenter) initPresenter();

  var startSlide = Math.max(1, Number(params.get("slide")) || 1) - 1;
  var startStep = params.get("step") === "all" ? stepsOf(Math.min(total - 1, startSlide)) : 0;
  go(startSlide, startStep, false);
  hideHelpSoon();
  window.__deck = { go: go, next: next, prev: prev, state: state };
})();
