var NB_SITES = 15000;
var SITES_GRID = 'hexagon'; // random, square or hexagon
var SITES_RANDOMISATION = 50; //%
var CLIFF_THRESHOLD = 0.15;
var LAKE_THRESHOLD = 0.005;
var NB_RIVER = (NB_SITES / 200);
var NB_GRAPH_RELAX = 0;
var SHADE = 0.5;
var BLUR = 0;
var MAX_RIVER_SIZE = 4;

var displayColors = {
    OCEAN: new paper.Color('#82caff'),
    BEACH: new paper.Color('#ffe98d'),
    LAKE: new paper.Color('#2f9ceb'),
    RIVER: new paper.Color('#369eea'),
    SOURCE: new paper.Color('#00f'),
    MARSH: new paper.Color('#2ab2d3'),
    ICE: new paper.Color('#bde3ff'),
    ROCK: new paper.Color('#535353'),
    LAVA: new paper.Color('#e22222'),

    SNOW: new paper.Color('#f8f8f8'),
    TUNDRA: new paper.Color('#ddddbb'),
    BARE: new paper.Color('#bbbbbb'),
    SCORCHED: new paper.Color('#999999'),
    TAIGA: new paper.Color('#ccd4bb'),
    SHRUBLAND: new paper.Color('#c4ccbb'),
    TEMPERATE_DESERT: new paper.Color('#e4e8ca'),
    TEMPERATE_RAIN_FOREST: new paper.Color('#a4c4a8'),
    TEMPERATE_DECIDUOUS_FOREST: new paper.Color('#b4c9a9'),
    GRASSLAND: new paper.Color('#c4d4aa'),
    TROPICAL_RAIN_FOREST: new paper.Color('#9cbba9'),
    TROPICAL_SEASONAL_FOREST: new paper.Color('#a9cca4'),
    SUBTROPICAL_DESERT: new paper.Color('#e9ddc7')
};

var Map = {
    debug: false,
    voronoi: new Voronoi(),
    diagram: null,
    margin: 0.0,
    bbox: {
        xl: 0,
        xr: 800,
        yt: 0,
        yb: 600
    },
    sites: [],
    seed: -1,
    perlin: null,
    cellsLayer: null,
    riversLayer: null,
    debugLayer: null,

    init: function () {var t = new Date().getTime();
        this.cellsLayer = new paper.Layer({name: 'cell'});
        this.riversLayer = new paper.Layer({name: 'rivers'});
        this.debugLayer = new paper.Layer({name: 'debug', visible: false});
        
        this.seed = Math.random();
        this.perlinCanvas = document.getElementById('perlin');
        this.perlin = perlinNoise(this.perlinCanvas, 64, 64, this.seed);console.log(new Date().getTime() - t);  
        this.randomSites(NB_SITES);console.log(new Date().getTime() - t);
        
        this.assignOceanCoastAndLand();console.log(new Date().getTime() - t);
        this.assignRivers();console.log(new Date().getTime() - t);
        this.assignMoisture();console.log(new Date().getTime() - t);
        this.assignBiomes();console.log(new Date().getTime() - t);
        
        this.render();console.log(new Date().getTime() - t);
    },

    randomSites: function (n) {
        var sites = [];

        // create vertices
        if (SITES_GRID == 'random') {
            var xmargin = this.bbox.xr * this.margin,
                ymargin = this.bbox.yb * this.margin,
                xo = xmargin,
                dx = this.bbox.xr - xmargin * 2,
                yo = ymargin,
                dy = this.bbox.yb - ymargin * 2;
            for (var i = 0; i < n; i++) {
                sites.push({
                    x: self.Math.round((xo + self.Math.random() * dx) * 10) / 10,
                    y: self.Math.round((yo + self.Math.random() * dy) * 10) / 10
                });
            }
        } else if (SITES_GRID == 'square' || SITES_GRID == 'hexagon') {
            var delta = Math.sqrt(this.bbox.xr * this.bbox.yb / n);
            var rand = SITES_RANDOMISATION * delta / 100;
            var x = 0;
            var y = 0;
            for (var i = 0; i < n; i++) {
                sites.push({
                    x: self.Math.round(x * delta + (self.Math.random() * rand)),
                    y: self.Math.round(y * delta + (self.Math.random() * rand))
                });
                x = x + 1;
                if (x * delta > this.bbox.xr) {
                    x = (y % 2 == 1 || SITES_GRID == 'square' ? 0 : 0.5);
                    y = y + 1;
                }
            }
        }
        this.compute(sites);
        for (var i = 0; i < NB_GRAPH_RELAX; i++) {
            this.relaxSites();
        }
    },
    
    compute: function (sites) {
        this.sites = sites;
        this.voronoi.recycle(this.diagram);
        this.diagram = this.voronoi.compute(sites, this.bbox);
    },

    relaxSites: function () {
        if (!this.diagram) {
            return;
        }
        var cells = this.diagram.cells,
            iCell = cells.length,
            cell,
            site, sites = [],
            rn, dist;
        var p = 1 / iCell * 0.1;
        while (iCell--) {
            cell = cells[iCell];
            rn = Math.random();
            // probability of apoptosis
            if (rn < p) {
                continue;
            }
            site = this.cellCentroid(cell);
            dist = distance(site, cell.site);
            // don't relax too fast
            if (dist > 2) {
                site.x = (site.x + cell.site.x) / 2;
                site.y = (site.y + cell.site.y) / 2;
            }
            // probability of mytosis
            if (rn > (1 - p)) {
                dist /= 2;
                sites.push({
                    x: site.x + (site.x - cell.site.x) / dist,
                    y: site.y + (site.y - cell.site.y) / dist
                });
            }
            sites.push(site);
        }
        this.compute(sites);
    },

    cellArea: function (cell) {
        var area = 0,
            halfedges = cell.halfedges,
            iHalfedge = halfedges.length,
            halfedge,
            p1, p2;
        while (iHalfedge--) {
            halfedge = halfedges[iHalfedge];
            p1 = halfedge.getStartpoint();
            p2 = halfedge.getEndpoint();
            area += p1.x * p2.y;
            area -= p1.y * p2.x;
        }
        area /= 2;
        return area;
    },

    cellCentroid: function (cell) {
        var x = 0,
            y = 0,
            halfedges = cell.halfedges,
            iHalfedge = halfedges.length,
            halfedge,
            v, p1, p2;
        while (iHalfedge--) {
            halfedge = halfedges[iHalfedge];
            p1 = halfedge.getStartpoint();
            p2 = halfedge.getEndpoint();
            v = p1.x * p2.y - p2.x * p1.y;
            x += (p1.x + p2.x) * v;
            y += (p1.y + p2.y) * v;
        }
        v = this.cellArea(cell) * 6;
        return {
            x: x / v,
            y: y / v
        };
    },
    
    assignOceanCoastAndLand: function() {
        // water
        var queue = new Array();
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            cell.elevation = this.getElevation(cell.site);
            cell.water = (cell.elevation <= 0);
            var numWater = 0;
            for (var j = 0; j < cell.halfedges.length; j++) {
                var hedge = cell.halfedges[j];
                // border 
                if (hedge.edge.rSite == null) {
                    cell.border = true;
                    cell.ocean = true;
                    cell.water = true;
                    if (cell.elevation > 0) {
                        cell.elevation = 0;
                    }
                    queue.push(cell);
                }
            }
        }
        
        // ocean
        while (queue.length > 0) {
            var cell = queue.shift();
            var neighbors = cell.getNeighborIds();
            for (var i = 0; i < neighbors.length; i++) {
                var nId = neighbors[i];
                var neighbor = this.diagram.cells[nId];
                if (neighbor.water && !neighbor.ocean) {
                    neighbor.ocean = true;
                    queue.push(neighbor);
                }
            } 
        }
        
        // coast
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            var numOcean = 0;
            var neighbors = cell.getNeighborIds();
            for (var j = 0; j < neighbors.length; j++) {
                var nId = neighbors[j];
                var neighbor = this.diagram.cells[nId];
                if (neighbor.ocean) {
                   numOcean++;
                }
            } 
            cell.coast = (numOcean > 0) && (!cell.water);
            cell.beach = (cell.coast && cell.elevation < CLIFF_THRESHOLD);
        }
        
        // cliff
        for (var i = 0; i < this.diagram.edges.length; i++) {
            var edge = this.diagram.edges[i];
            if (edge.lSite != null && edge.rSite != null) {
                var lCell = this.diagram.cells[edge.lSite.voronoiId];
                var rCell = this.diagram.cells[edge.rSite.voronoiId];      
                edge.cliff = (!(lCell.water && rCell.water) && (Math.abs(this.getRealElevation(lCell) - this.getRealElevation(rCell)) >= CLIFF_THRESHOLD));
            }            
        }
    }, 
    
    assignRivers: function() {
        for (var i = 0; i < NB_RIVER; ) {
            var cell = this.diagram.cells[getRandomInt(0, this.diagram.cells.length - 1)];
            if (!cell.coast) {
                if (this.setAsRiver(cell, 1)) {
                    cell.source = true;
                    i++;
                }
            }
        }
    },
    
    setAsRiver: function(cell, size) {
        if (!cell.water && !cell.river) {
            cell.river = true;
            cell.riverSize = size;
            var lowerCell = null;
            var neighbors = cell.getNeighborIds();
            // on choisi la cellule voisine la plus basse :
            for (var j = 0; j < neighbors.length; j++) {
                var nId = neighbors[j];
                var neighbor = this.diagram.cells[nId];
                if (lowerCell == null || neighbor.elevation < lowerCell.elevation) {
                    lowerCell = neighbor;
                }
            } 
            if (lowerCell.elevation < cell.elevation) {
                // on continue la rivière :
                this.setAsRiver(lowerCell, size);
                cell.nextRiver = lowerCell; 
            } else {
                // création d'un lac :
                cell.water = true;
                this.fillLake(cell);
            }
        } else if (cell.water && !cell.ocean) {
            // arrivé dans un lac :
            cell.lakeElevation = this.getRealElevation(cell) + (LAKE_THRESHOLD * size);
            this.fillLake(cell);
        } else if (cell.river) {
            // arrivé dans une rivère :
            cell.riverSize ++;
            var nextRiver = cell.nextRiver;
            while (nextRiver) {
                nextRiver.riverSize ++;
                nextRiver = nextRiver.nextRiver;
            }
        }
        
        return cell.river;
    },
    
    fillLake: function(cell) {
        if (cell.exitRiver == null) { // si le lac a une rivière de sortie il ne peut plus se remplir
            var exitRiver = null;
            var exitSource = null;
            var lake = new Array();
            var queue = new Array();
            queue.push(cell);
            
            while (queue.length > 0) {
                var c = queue.shift();
                lake.push(c);
                var neighbors = c.getNeighborIds();
                for (var i = 0; i < neighbors.length; i++) {
                    var nId = neighbors[i];
                    var neighbor = this.diagram.cells[nId];
                    
                    if (neighbor.water && !neighbor.ocean) { // cell d'eau du même lac
                        if (neighbor.lakeElevation == null || neighbor.lakeElevation < c.lakeElevation) {
                            neighbor.lakeElevation = c.lakeElevation;
                            queue.push(neighbor);
                        }
                    } else { // cell de terrain ajacente au lac
                        if (c.elevation < neighbor.elevation) {
                            if (neighbor.elevation - c.lakeElevation < 0) {
                                // on noie le terrain
                                neighbor.water = true;
                                neighbor.lakeElevation = c.lakeElevation;
                                queue.push(neighbor);
                            }
                        } else {
                            //neighbor.source = true;
                            // on a trouvé une sortie pour le lac :
                            if (exitRiver == null) {
                                exitSource = c;
                                exitRiver = neighbor;
                            } else if (exitRiver.elevation > neighbor.elevation) {
                                exitSource = c;
                                exitRiver = neighbor;
                            }
                        }
                    }
                } 
            }
            
            if (exitRiver != null) {
                // rivière de sortie :
                exitSource.river = true;
                exitSource.nextRiver = exitRiver;
                this.setAsRiver(exitRiver, 2);
                while (lake.length > 0) {
                    var c = lake.shift();
                    c.exitRiver = exitRiver;
                }
            }
        }
    },
    
    // Calculate moisture. Freshwater sources spread moisture: rivers and lakes (not ocean). 
    assignMoisture: function() {
        var queue = new Array();
        // lake and river 
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            if ((cell.water || cell.river) && !cell.ocean) {
                cell.moisture = (cell.water ? 1 : 0.9);
                if (!cell.ocean) {
                    queue.push(cell);
                }
            }
        }
        
        while (queue.length > 0) {
            var cell = queue.shift();
            var neighbors = cell.getNeighborIds();
            for (var i = 0; i < neighbors.length; i++) {
                var nId = neighbors[i];
                var neighbor = this.diagram.cells[nId];
                var newMoisture = cell.moisture * 0.9;
                if (neighbor.moisture == null || newMoisture > neighbor.moisture) {
                    neighbor.moisture = newMoisture;
                    queue.push(neighbor);
                }
            } 
        }
        
        // ocean
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            if (cell.ocean) {
                cell.moisture = 1;
            }
        }
    },
    
    assignBiomes: function() {
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            cell.biome = this.getBiome(cell);
        }
    },
    
    getBiome: function (cell) {
        if (cell.ocean) {
            return 'OCEAN';
        } else if (cell.water) {
            if (cell.elevation < 0.05) return 'MARSH';
            if (cell.elevation > 0.4) return 'ICE';
            return 'LAKE';
        } else if (cell.beach) {
            return 'BEACH';
        } else if (cell.elevation > 0.4) {
            if (cell.moisture > 0.50) return 'SNOW';
            else if (cell.moisture > 0.33) return 'TUNDRA';
            else if (cell.moisture > 0.16) return 'BARE';
            else return 'SCORCHED';
        } else if (cell.elevation > 0.3) {
            if (cell.moisture > 0.66) return 'TAIGA';
            else if (cell.moisture > 0.33) return 'SHRUBLAND';
            else return 'TEMPERATE_DESERT';
        } else if (cell.elevation > 0.15) {
            if (cell.moisture > 0.83) return 'TEMPERATE_RAIN_FOREST';
            else if (cell.moisture > 0.50) return 'TEMPERATE_DECIDUOUS_FOREST';
            else if (cell.moisture > 0.16) return 'GRASSLAND';
            else return 'TEMPERATE_DESERT';
        } else {
            if (cell.moisture > 0.66) return 'TROPICAL_RAIN_FOREST';
            else if (cell.moisture > 0.33) return 'TROPICAL_SEASONAL_FOREST';
            else if (cell.moisture > 0.16) return 'GRASSLAND';
            else return 'SUBTROPICAL_DESERT';
        }
    },

    // The Perlin-based island combines perlin noise with the radius
    getElevation: function (point) {
        var x = 2 * (point.x / this.bbox.xr - 0.5);
        var y = 2 * (point.y / this.bbox.yb - 0.5);
        var length = Math.sqrt(x * x + y * y);
        var c = this.getPerlinValue(point); 

        return c - (length * length);
        //return c - (0.3 + 0.3 * length * length);
    },
    
    getPerlinValue: function(point) {
        var x = ((point.x / this.bbox.xr) * this.perlin.width) | 0;
        var y = ((point.y / this.bbox.yb) * this.perlin.height) | 0;        
        var pos = (x + y * this.perlin.width) * 4;
        var data = this.perlin.data;
        var val = data[pos + 0] << 16 | data[pos + 1] << 8 | data[pos + 2]; // rgb to hex
        
        return (val & 0xff) / 255.0;
    },
    
    getRealElevation: function(cell) {
        if (cell.water && cell.lakeElevation != null) {
            return cell.lakeElevation;
        } else if (cell.water && cell.elevation < 0) {
            return 0;
        } else {
            return cell.elevation;
        }
    },

    render: function () {
        if (!this.diagram) {
            return;
        }var t = new Date().getTime();
        
       this.renderCells();console.log('----');console.log(new Date().getTime()-t);
        if (BLUR > 0) {
            boxBlurCanvasRGB('voronoiCanvas', 0, 0, this.bbox.xr, this.bbox.yb, BLUR, 1);
        }        
        this.renderRivers();
        if (this.debug) {
            this.renderEdges();
            this.renderSites();
        }
    },
    
    renderCells: function() {
        this.cellsLayer.activate();
        for (var cellid in this.diagram.cells) {
            var cell = this.diagram.cells[cellid];
            var color = this.getCellColor(cell);
            
            var cellPath = new Path();
            cellPath.strokeWidth = 1;
            cellPath.strokeColor = color;
            cellPath.fillColor = color;             
            var start =  cell.halfedges[0].getStartpoint();
            cellPath.add(new Point(start.x, start.y));
            for (var iHalfedge = 0; iHalfedge < cell.halfedges.length; iHalfedge++) {
                var halfEdge = cell.halfedges[iHalfedge];
                var end = halfEdge.getEndpoint();
                cellPath.add(new Point(end.x, end.y));
            }
            cellPath.closed = true;          
        }
    },
    
    renderRivers: function() {
        for (var cellid in this.diagram.cells) {
            var cell = this.diagram.cells[cellid];
            if (cell.nextRiver) {
                this.riversLayer.activate();
                var riverPath = new Path();
                riverPath.strokeWidth = Math.min(cell.riverSize, MAX_RIVER_SIZE);
                riverPath.strokeWidth = Math.min(cell.riverSize, MAX_RIVER_SIZE);
                var riverColor = displayColors.RIVER;
                riverColor.brightness = this.getShade(cell);
                riverPath.strokeColor = riverColor;
                if (cell.water) {
                    riverPath.add(new Point(cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2, cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2));
                } else {
                    riverPath.add(new Point(cell.site.x, cell.site.y));
                }
                if (cell.nextRiver && !cell.nextRiver.water) {
                    riverPath.add(new Point(cell.nextRiver.site.x, cell.nextRiver.site.y));
                } else {
                    riverPath.add(new Point(cell.site.x + (cell.nextRiver.site.x - cell.site.x) / 2, cell.site.y + (cell.nextRiver.site.y - cell.site.y) / 2));
                }
            }
            // source :
            if (cell.source) {
                this.debugLayer.activate();
                var circle = new Path.Circle(new Point(cell.site.x, cell.site.y), 3);
                circle.fillColor = displayColors.SOURCE;
            }
        }
    },
    
    renderEdges: function() {
        this.debugLayer.activate();
        var edges = this.diagram.edges,
            iEdge = edges.length,
            edge, v;
        while (iEdge--) {
            edge = edges[iEdge];
            var edgePath = new Path();
            edgePath.strokeWidth = 1;

            if (edge.cliff) {
                edgePath.strokeWidth = 1;
                edgePath.strokeCap = 'round';
                edgePath.strokeColor = displayColors.ROCK;
            } else {
                edgePath.strokeWidth = 1;
                edgePath.strokeColor = '#000';
            }
            v = edge.va;
            edgePath.add(new Point(v.x, v.y));
            v = edge.vb;
            edgePath.add(new Point(v.x, v.y));
        }
    },
    
    renderSites: function() {
        this.debugLayer.activate();
        // sites
        var sites = this.sites,
            iSite = sites.length;
        while (iSite--) {
            v = sites[iSite];
            var circle = new Path.Circle(new Point(v.x, v.y), 2);
            circle.fillColor = '#0f0';
        }       

        // valeur
        for (var i = 0; i < this.diagram.cells.length; i++) {
            var cell = this.diagram.cells[i];
            var text = new PointText(new Point(cell.site.x, cell.site.y));
            text.fillColor = '#f00';
            text.fontSize = '8px';
            text.content = Math.ceil(this.getRealElevation(cell) * 100);
        }
    },
    
    getCellColor: function(cell) {
        var c = displayColors[cell.biome];
        if (cell.water) {
            c.brightness = 1 + cell.elevation;
            //return increaseBrightness(displayColors[cell.biome], cell.elevation * 100);
        } else {
            c.brightness = this.getShade(cell);
            //return decreaseBrightness(displayColors[cell.biome], this.getShade(cell));
        }
        return c;
    },
    
    getShade: function(cell) {
        if (cell.water) {
            return 0;
            
        } else {
            var lowerCell = null;
            var upperCell = null;
            var neighbors = cell.getNeighborIds();
            for (var j = 0; j < neighbors.length; j++) {
                var nId = neighbors[j];
                var neighbor = this.diagram.cells[nId];
                if (lowerCell == null || neighbor.elevation < lowerCell.elevation) {
                    lowerCell = neighbor;
                }
                if (upperCell == null || neighbor.elevation > upperCell.elevation) {
                    upperCell = neighbor;
                }
            }
            
            var angleRadian = Math.atan2(upperCell.site.x - lowerCell.site.x, upperCell.site.y - lowerCell.site.y);
            var angleDegree = angleRadian * (180 / Math.PI);
            var diffElevation = (this.getRealElevation(upperCell) - this.getRealElevation(lowerCell));
            
            if (diffElevation + SHADE < 1) {
                diffElevation = diffElevation + SHADE;
            }
            
            return 1 - ((Math.abs(angleDegree) / 180) * diffElevation);
        }
    },
        
    showDebug: function() {//TODO
        this.debug = !this.debug;
        this.debugLayer.visible = this.debug;
        view.draw();
    }

};