$(".sponsor-carousel").html($(".sponsor-carousel .sponsor-block").sort(function(){
    return Math.random()-0.5;
}));
