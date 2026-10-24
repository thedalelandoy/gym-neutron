// Unit tests for js/logic.js. Run with: npm test (or node --test tests/logic.test.js)
const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../js/logic.js");

const VALID = {
  name: "Juan Dela Cruz",
  email: "juan@example.com",
  mobile: "0900 000 0000", // 0900 is not an assigned PH mobile prefix
  time: "weekday-morning",
  consent: true
};

test("a fully valid registration passes and is tidied", () => {
  const result = logic.validateRegistration({ ...VALID, email: " Juan@Example.com ", buddy: true });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.clean.email, "juan@example.com");
  assert.equal(result.clean.mobile, "09000000000");
  assert.equal(result.clean.buddy, true);
});

test("an empty form reports every required field", () => {
  const result = logic.validateRegistration({});
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ["consent", "email", "mobile", "name", "time"]);
  assert.equal(result.clean, null);
});

test("names need a first and last name and letters only", () => {
  assert.match(logic.validateRegistration({ ...VALID, name: "Juan" }).errors.name, /last name/);
  assert.match(logic.validateRegistration({ ...VALID, name: "J" }).errors.name, /at least 2/);
  assert.match(logic.validateRegistration({ ...VALID, name: "Juan 123" }).errors.name, /letters only/);
  assert.equal(logic.validateRegistration({ ...VALID, name: "María-Luz O'Neil" }).valid, true);
});

test("bad emails are rejected with a hint", () => {
  for (const email of ["juan", "juan@", "juan@gmail", "juan gmail.com", "@gmail.com"]) {
    assert.ok(logic.validateRegistration({ ...VALID, email }).errors.email, email);
  }
});

test("PH mobile numbers are accepted in common formats", () => {
  assert.equal(logic.normalizeMobile("09000000000"), "09000000000");
  assert.equal(logic.normalizeMobile("+63 900 000 0000"), "09000000000");
  assert.equal(logic.normalizeMobile("63-900-000-0000"), "09000000000");
  assert.equal(logic.normalizeMobile("0900000000"), null);
  assert.equal(logic.normalizeMobile("02 8000 0000"), null);
});

test("consent must be ticked", () => {
  const result = logic.validateRegistration({ ...VALID, consent: false });
  assert.equal(result.valid, false);
  assert.match(result.errors.consent, /Tick this box/);
});

test("only off-peak time slots are allowed", () => {
  assert.ok(logic.validateRegistration({ ...VALID, time: "weekday-evening" }).errors.time);
  assert.ok(logic.validateRegistration({ ...VALID, time: "" }).errors.time);
});

test("countdown splits the remaining time into days, hours, minutes, seconds", () => {
  const end = Date.parse("2026-11-30T23:59:59+08:00");
  const now = end - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
  const c = logic.getCountdown(now, end);
  assert.deepEqual(
    { expired: c.expired, days: c.days, hours: c.hours, minutes: c.minutes, seconds: c.seconds },
    { expired: false, days: 2, hours: 3, minutes: 4, seconds: 5 }
  );
});

test("countdown is expired exactly at the deadline and stays at zero after", () => {
  const end = logic.OFFER_END_MS;
  assert.equal(logic.getCountdown(end - 1000, end).expired, false);
  assert.equal(logic.getCountdown(end, end).expired, true);
  const after = logic.getCountdown(Date.parse("2026-12-01T00:00:00+08:00"), end);
  assert.equal(after.expired, true);
  assert.equal(after.totalMs, 0);
  assert.equal(after.days + after.hours + after.minutes + after.seconds, 0);
});

test("the deadline is November 30, 2026, 11:59:59 PM Philippine time", () => {
  assert.equal(new Date(logic.OFFER_END_MS).toISOString(), "2026-11-30T15:59:59.000Z");
});

test("?now= override shifts the clock and ignores bad values", () => {
  const real = Date.parse("2026-10-24T12:00:00+08:00");
  const offset = logic.parseNowOverride("?now=2026-12-01T00:00:00%2B08:00", real);
  assert.equal(real + offset, Date.parse("2026-12-01T00:00:00+08:00"));
  assert.equal(logic.parseNowOverride("?now=banana", real), 0);
  assert.equal(logic.parseNowOverride("", real), 0);
});

test("quiz picks the most chosen element", () => {
  assert.equal(logic.scoreQuiz(["Fe", "Fe", "O", "Fe"]), "Fe");
  assert.equal(logic.scoreQuiz(["Ca", "O", "Ca", "Ca"]), "Ca");
});

test("quiz ties go to the first answer, which says what they want most", () => {
  assert.equal(logic.scoreQuiz(["O", "Fe", "Fe", "O"]), "O");
  assert.equal(logic.scoreQuiz(["Nu", "Fe", "O", "Ca"]), "Nu");
});

test("quiz ignores unknown answers and returns null for none", () => {
  assert.equal(logic.scoreQuiz([]), null);
  assert.equal(logic.scoreQuiz(["X", "Y"]), null);
  assert.equal(logic.scoreQuiz(["X", "Ca"]), "Ca");
});
