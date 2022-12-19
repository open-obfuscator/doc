new Typed('#typed', {
  stringsElement: '#typed-strings',
  typeSpeed: 80,
  showCursor: true,
});

anime.timeline({
  autoplay: true,
  loop: false
})
.add({
  targets: '#paths',
  duration: 16000,
  strokeDashoffset: [anime.setDashoffset, 0],
  easing: 'easeInOutSine',
});
anime({
  autoplay: true,
  loop: true,
  targets: '#bot-bar',
  opacity: "0",
  loop: true,
  direction: 'alternate',
  easing: 'easeInOutExpo'
});
anime({
  autoplay: true,
  loop: true,
  targets: '#top-bar',
  opacity: "0",
  loop: true,
  direction: 'alternate',
  easing: 'easeInOutExpo'
});

countdown.setLabels(
  ' ms| sec| min| h| day| week| month| year| | | ',
  ' ms| sec| min| h| days| weeks| months| years| | | ',
  ' and ',
  ' ', null);

const end_date = document.getElementById('starting-date').dataset.endDate;
const date     = document.getElementById('starting-date').innerHTML;
countdown(
  Date.parse(date),
  function(ts) {
    if (ts.end > Date.parse(end_date)) {
      document.getElementById('countdown-prefix').innerHTML = "in the time span of the challenge.";
    } else {
      document.getElementById('countdown').innerHTML = ts;
    }
  },
  countdown.YEARS | countdown.MONTHS  | countdown.WEEKS   | countdown.DAYS |
  countdown.HOURS | countdown.MINUTES | countdown.SECONDS);

countdown(
  function(ts) {
    document.getElementById('days-left').innerHTML = "(" + ts + " left since now)";
  },
  Date.parse(end_date),
  countdown.MONTHS | countdown.WEEKS | countdown.DAYS);
