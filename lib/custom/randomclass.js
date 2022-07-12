var classes = ['A', 'B', 'C', 'D', 'E'];

$(".rnd").each(function() {

  var range = Math.floor(Math.random() * 10 + 1);
  var classname = "rnd" + range;
  console.log(className);
  $(this).addClass(range);
});