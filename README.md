island.js
=========

Island map generator in JavaScript, using a Voronoi graph and perlin noise http://lebesnec.github.io/island.js

- Inspired by http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/
- Use paper.js for rendering : http://paperjs.org/
- Use Raymond Hill Voronoi implementation : https://github.com/gorhill/Javascript-Voronoi
- Use Sean McCullough perlin noise generator : https://gist.github.com/banksean/304522#file-perlin-noise-simplex-js

### Usage :

    <canvas id="island" resize="true"/></canvas>
    <canvas id="perlin" hidden="true"></canvas>
    <script type="application/javascript">
        paper.install(window);
        window.onload = function(e) {
            paper.setup('island');
            Island.init();
        };
    </script>

You can also set the following optionals parameters :

    Island.init({
        width: 500,
        height: 500,
        perlinWidth: 256,
        perlinHeight: 256,
        allowDebug: false, // if set to true, you can click on the map to enter "debug" mode. Warning : debug mode is slow to initialize, set to false for faster rendering.
        nbSites: 10000, // numbers of voronoi cell
        sitesDistribution: 'hexagon', // distribution of the site of the voronoi graph : random, square or hexagon
        sitesRandomisation: 80, // will move each site in a random way (in %), for the square or hexagon distribution to look more random
        nbGraphRelaxation: 0, // nb of time we apply the relaxation algo to the voronoi graph (slow !), for the random distribution to look less random
        cliffsThreshold: 0.15,
        lakesThreshold: 0.005, // lake elevation will increase by this value (* the river size) when a new river end inside
        nbRivers: (10000 / 200),
        maxRiversSize: 4,
        shading: 0.35,
        shadeOcean: true
    });

### Demo :
Here : http://lebesnec.github.io/island.js/

### Sample :

Rendering with 50000 polygons and 250 rivers :
![example of generated island](https://lh6.googleusercontent.com/-yCoR7YwRDl8/U0z-YgMLlPI/AAAAAAAAeHE/B3ifCidHoFs/s800/Sans%2520titre2.jpg)
![example of generated island](https://lh5.googleusercontent.com/-CuDWhc6AdZU/U0z-YpcKYNI/AAAAAAAAeHA/d5MhfItKg8g/s800/Sans%2520titre3.jpg)

With 10000 polygons, shading off :
![example of generated island](https://lh4.googleusercontent.com/-DM2rSu2o-XA/U00qgcjdX-I/AAAAAAAAeHk/9I-ip4UzcJ0/s800/Sans%2520titre.jpg)

Rendering using a "square" graph :
![example of generated island](https://lh3.googleusercontent.com/-7--_ofrPmOQ/U0z-YmFkbRI/AAAAAAAAeHI/ihuAj9lpy5w/s800/Sans%2520titre.jpg)
