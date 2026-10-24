# Captures the interactive states used in docs/TEST-REPORT.md.
# Run from the project folder while a local server is on port 5180:
#   python -m http.server 5180 --bind 127.0.0.1
#   powershell -File tools/states.ps1
$base = "http://127.0.0.1:5180/"

$invalid = "const f=document.getElementById('register'); f.elements.name.value='Juan'; f.elements.email.value='juan@gmail'; f.elements.mobile.value='0900'; f.querySelector('[type=submit]').click();"
node tools/capture.mjs --url $base --out captures/state-invalid --width 1440 --height 900 --shots "claim" --settle 1800 --eval $invalid

$valid = "const f=document.getElementById('register'); f.elements.name.value='Juan Dela Cruz'; f.elements.email.value='juan@example.com'; f.elements.mobile.value='0900 000 0000'; f.elements.time.value='weekday-morning'; f.elements.consent.checked=true; f.querySelector('[type=submit]').click();"
node tools/capture.mjs --url $base --out captures/state-valid --width 1440 --height 900 --shots "claim" --settle 1800 --eval $valid

$quiz = "const q=document.getElementById('quiz'); const n=q.querySelector('[data-quiz-next]'); const p=(i,v)=>q.querySelector('input[name=q'+i+'][value='+v+']').click(); p(1,'Fe'); n.click(); p(2,'Fe'); n.click(); p(3,'O'); n.click(); p(4,'Fe'); q.querySelector('[data-quiz-submit]').click();"
node tools/capture.mjs --url $base --out captures/state-quiz --width 1440 --height 900 --shots "element" --settle 1800 --eval $quiz
