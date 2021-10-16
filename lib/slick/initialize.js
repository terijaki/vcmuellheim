$('.sponsor-carousel').on('init', function(event, slick, currentSlide, nextSlide) {
    // Randomize the slides and then run slick slider
    $.fn.randomize = function(selector) {
        var $elems = selector ? $(this).find(selector) : $(this).children(),
        $parents = $elems.parent();

        $parents.each(function() {
            $(this).children(selector).sort(function(){
                return Math.round(Math.random()) - 0.5;
            }).detach().appendTo(this);
        });

        return this;
    };

    $('.sponsor-carousel').find('.slick-track').randomize('.slick-slide');
});


$('.sponsor-carousel').slick({
  autoplay: false,
  autoplaySpeed: 6000,
  arrows: false,
  dots: false,
  infinite: true,
  speed: 300,
  slidesToShow: 3,
  slidesToScroll: 1,
  responsive: [{
      breakpoint: 992,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 2
      }
    },
    {
      breakpoint: 576,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1
      }
    }
  ]
});
