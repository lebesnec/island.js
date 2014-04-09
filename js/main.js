paper.install(window);

$(document).ready(function () {
    paper.setup('voronoiCanvas');
    
    $('#voronoiCanvas').click(function() {
        Map.showDebug();
        $('#perlin').toggle();
    });
    
    view.onResize = function(event) {
        //TODO
        //Map.bbox = {xl: 0, xr: view.viewSize.width, yt: 0, yb: view.viewSize.height};
        //Map.init();
    };
    view.onFrame = function(event) {
    };
    
    Map.bbox = {xl: 0, xr: view.viewSize.width, yt: 0, yb: view.viewSize.height};
    Map.init();
});