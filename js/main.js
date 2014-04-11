paper.install(window);

window.onload = function(e) {
    paper.setup('voronoiCanvas');
    
    var voronoiCanvas = document.getElementById('voronoiCanvas');
    var perlinCanvas = document.getElementById('perlin');
    
    voronoiCanvas.onclick = function() {
        Island.showDebug();
        if (perlinCanvas.style.display == 'block') {
            perlinCanvas.style.display = 'none';
        } else {
            perlinCanvas.style.display = 'block';
        }
    };
    
    view.onResize = function(event) {
        //TODO
        //Island.bbox = {xl: 0, xr: view.viewSize.width, yt: 0, yb: view.viewSize.height};
        //Island.init();
    };
    view.onFrame = function(event) {
    };
    
    Island.bbox = {xl: 0, xr: view.viewSize.width, yt: 0, yb: view.viewSize.height};
    Island.init();
};