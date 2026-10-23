// Suggestions for the funding finder (22 Oct 2026). Two factors: a one-time
// code by email, then a code from an authenticator app (enrolled on first use).
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var ticket = null;
  var MSG = {
    sent: "We emailed you a 6-digit code. It expires in 10 minutes.",
    wait: "Too many codes asked for this email in the last hour. Please try again later.",
    bad: "That email code is not right. Check it and try again.",
    expired: "The code expired. Start again from the top.",
    bad_totp: "That authenticator code is not right. Use the current 6-digit code from your app.",
    stored: "Thank you, your suggestion is in. We review every one by hand.",
    error: "Something went wrong on our side. Nothing was stored; please try again later."
  };

  function api(path, body) {
    return fetch("/funding/api/" + path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), credentials: "omit", cache: "no-store"
    }).then(function (r) { return r.json(); }, function () { return { state: "error" }; });
  }

  function say(state) { $("sg-status").textContent = MSG[state] || MSG.error; }
  function show(id) { ["sg-s1", "sg-s2", "sg-s3"].forEach(function (s) { $(s).hidden = s !== id; }); }

  $("sg-s1").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!$("sg-text").value.trim()) return;
    api("start", { email: $("sg-email").value }).then(function (d) {
      say(d.state);
      if (d.state === "sent") { show("sg-s2"); $("sg-code").focus(); }
    });
  });

  $("sg-s2").addEventListener("submit", function (e) {
    e.preventDefault();
    api("verify", { email: $("sg-email").value, code: $("sg-code").value }).then(function (d) {
      if (d.state !== "ok") { say(d.state); if (d.state === "expired") show("sg-s1"); return; }
      ticket = d.ticket;
      $("sg-secret").textContent = d.secret.replace(/(.{4})/g, "$1 ").trim();
      $("sg-otpauth").href = d.otpauth;
      $("sg-status").textContent = "";
      show("sg-s3");
      $("sg-totp").focus();
    });
  });

  $("sg-s3").addEventListener("submit", function (e) {
    e.preventDefault();
    api("submit", { ticket: ticket, totp: $("sg-totp").value, suggestion: $("sg-text").value.trim() }).then(function (d) {
      say(d.state);
      if (d.state === "stored") { $("sg-text").value = ""; $("sg-totp").value = ""; show("sg-s1"); }
      if (d.state === "expired") show("sg-s1");
    });
  });
})();
