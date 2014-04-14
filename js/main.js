paper.install(window);

window.onload = function(e) {
    paper.setup('island');
    
    var islandCanvas = document.getElementById('island');
    var perlinCanvas = document.getElementById('perlin');
    
    islandCanvas.onclick = function() {
        Island.toggleDebug();
        if (perlinCanvas.style.display == 'block') {
            perlinCanvas.style.display = 'none';
        } else {
            perlinCanvas.style.display = 'block';
        }
    };
    
    Island.bbox = {xl: 0, xr: view.viewSize.width, yt: 0, yb: view.viewSize.height};
    Island.init();
};