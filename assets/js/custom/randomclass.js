$(".random").each(function() {
  var range = Math.floor(Math.random() * 10 + 1);
  var classname = "rnd-" + range;
  $(this).addClass(classname);
});