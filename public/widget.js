// RentalFlow Support Widget loader.
// Tenants embed: <script src="https://getrentalflow.com/widget.js" defer></script>
//
// Creates a floating bubble bottom-right that opens the support iframe.

(function () {
  if (window.__rfSupportWidgetLoaded) return;
  window.__rfSupportWidgetLoaded = true;

  var origin = (function () {
    try { var u = new URL(document.currentScript.src); return u.origin; }
    catch (e) { return "https://getrentalflow.com"; }
  })();

  var css = ''
    + '.rf-bubble{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;'
    + 'background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;border:none;cursor:pointer;'
    + 'box-shadow:0 10px 25px rgba(124,58,237,0.4);z-index:2147483646;display:flex;'
    + 'align-items:center;justify-content:center;font-size:24px;transition:transform .2s}'
    + '.rf-bubble:hover{transform:scale(1.08)}'
    + '.rf-frame{position:fixed;bottom:90px;right:20px;width:360px;height:520px;border:none;'
    + 'border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.25);z-index:2147483647;'
    + 'background:white;display:none}'
    + '.rf-frame.rf-open{display:block}';
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var bubble = document.createElement("button");
  bubble.className = "rf-bubble";
  bubble.title = "Need help?";
  bubble.innerHTML = "💬";
  document.body.appendChild(bubble);

  var frame = document.createElement("iframe");
  frame.className = "rf-frame";
  frame.src = origin + "/widget/support";
  document.body.appendChild(frame);

  bubble.addEventListener("click", function () {
    frame.classList.toggle("rf-open");
    bubble.innerHTML = frame.classList.contains("rf-open") ? "×" : "💬";
  });
})();
