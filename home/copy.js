const tooltip = tippy('.card-email', {
  content: 'Copied!',
  placement: 'bottom',
  animateFill: true,
  trigger: 'manual',
})[0];

var clipboard = new ClipboardJS('.card-email');
clipboard.on('success', function(e) {
  tooltip.show();
  setTimeout(function() {
    tooltip.hide();
  }, 500);
});

clipboard.on('error', function(e) {
});



