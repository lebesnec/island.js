var DISPLAY_COLORS = {
    OCEAN: new paper.Color('#82caff'),
    BEACH: new paper.Color('#ffe98d'),
    LAKE: new paper.Color('#2f9ceb'),
    RIVER: new paper.Color('#369eea'),
    SOURCE: new paper.Color('#00f'),
    MARSH: new paper.Color('#2ac6d3'),
    ICE: new paper.Color('#b3deff'),
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

var Island = {
    config: {
        width: 500,
        height: 500,
        perlinWidth: 256,
        perlinHeight: 256,
        allowDebug: false, // if set to true, you can clic on the map to enter "debug" mode. Warning : debug mode is slow to initialize, set to false for faster rendering.
        nbSites: 10000, // nb of voronoi cell
        sitesDistribution: 'hexagon', // distribution of the site : random, square or hexagon
        sitesRandomisation: 80, // will move each site in a random way (in %), for the square or hexagon distribution to look more random
        nbGraphRelaxation: 0, // nb of time we apply the relaxation algo to the voronoi graph (slow !), for the random distribution to look less random
        cliffsThreshold: 0.15,
        lakesThreshold: 0.005, // lake elevation will increase by this value (* the river size) when a new river end inside
        nbRivers: (10000 / 200),
        maxRiversSize: 4,
        shading: 0.35,
        shadeOcean: true
    },
    debug: false, // true if "debug" mode is activated
    voronoi: new Voronoi(),
    diagram: null,
    sites: [],
    seed: -1,
    perlin: null,
    cellsLayer: null,
    riversLayer: null,
    debugLayer: null,

    init: function (userConfig) {        
        if (userConfig == undefined) {
            userConfig = {};
        }
        
        this.config.width               = (userConfig.width != undefined                ? userConfig.width              : view.viewSize.width);
        this.config.height              = (userConfig.height != undefined               ? userConfig.height             : view.viewSize.height);
        this.config.perlinWidth         = (userConfig.perlinWidth != undefined          ? userConfig.perlinWidth        : (this.config.width / 3));
        this.config.perlinHeight        = (userConfig.perlinHeight != undefined         ? userConfig.perlinHeight       : (this.config.height / 3));
        this.config.allowDebug          = (userConfig.allowDebug != undefined           ? userConfig.allowDebug         : false);
        this.config.nbSites             = (userConfig.nbSites != undefined              ? userConfig.nbSites            : ((this.config.width * this.config.height) / 100));
        this.config.sitesDistribution   = (userConfig.sitesDistribution != undefined    ? userConfig.sitesDistribution  : 'hexagon');
        this.config.sitesRandomisation  = (userConfig.sitesRandomisation != undefined   ? userConfig.sitesRandomisation : 80);
        this.config.nbGraphRelaxation   = (userConfig.nbGraphRelaxation != undefined    ? userConfig.nbGraphRelaxation  : 0);
        this.config.cliffsThreshold     = (userConfig.cliffsThreshold != undefined      ? userConfig.cliffsThreshold    : 0.15);
        this.config.lakesThreshold      = (userConfig.lakesThreshold != undefined       ? userConfig.lakesThreshold     : 0.005);
        this.config.nbRivers            = (userConfig.nbRivers != undefined             ? userConfig.nbRivers           : (this.config.nbSites / 200));
        this.config.maxRiversSize       = (userConfig.maxRiversSize != undefined        ? userConfig.maxRiversSize      : 4);
        this.config.shading             = (userConfig.shading != undefined              ? userConfig.shading            : 0.35);
        this.config.shadeOcean          = (userConfig.shadeOcean != undefined           ? userConfig.shadeOcean         : true);
        
        this.cellsLayer = new paper.Layer({name: 'cell'});
        this.riversLayer = new paper.Layer({name: 'rivers'});
        this.debugLayer = new paper.Layer({name: 'debug', visible: false});
        
        this.seed = Math.random();
        this.perlinCanvas = document.getElementById('perlin');
        this.perlinCanvas.width = this.config.perlinWidth;
        this.perlinCanvas.height = this.config.perlinHeight;
        this.perlin = perlinNoise(this.perlinCanvas, 64, 64, this.seed);
        this.randomSites();
        
        this.assignOceanCoastAndLand();
        this.assignRivers();
        this.assignMoisture();
        this.assignBiomes();
        
        this.render();
    },

    randomSites: function (n) {
        var sites = [];

        // create vertices
        if (this.config.sitesDistribution == 'random') {
            for (var i = 0; i < this.config.nbSites; i++) {
                sites.push({
                    x: Math.round(Math.random() * this.config.width),
                    y: Math.round(Math.random() * this.config.height)
                });
            }
        } else {
            var delta = Math.sqrt(this.config.width * this.config.height / this.config.nbSites);
            var rand = this.config.sitesRandomisation * delta / 100;
            var x = 0;
            var y = 0;
            for (var i = 0; i < this.config.nbSites; i++) {
                sites.push({
                    x: Math.max(Math.min(Math.round(x * delta + (Math.random() * rand)), this.config.width), 0),
                    y: Math.max(Math.min(Math.round(y * delta + (Math.random() * rand)), this.config.height), 0)
                });
                x = x + 1;
                if (x * delta > this.config.width) {
                    x = (y % 2 == 1 || this.config.sitesDistribution == 'square' ? 0 : 0.5);
                    y = y + 1;
                }
            }
        }
        this.compute(sites);
        for (var i = 0; i < this.config.nbGraphRelaxation; i++) {
            this.relaxSites();
        }
    },
    
    compute: function (sites) {
        this.sites = sites;
        this.voronoi.recycle(this.diagram);
        var bbox = {xl: 0, xr: this.config.width, yt: 0, yb: this.config.height};
        this.diagram = this.voronoi.compute(sites, bbox);
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
            dist = this.distance(site, cell.site);
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
            cell.beach = (cell.coast && cell.elevation < this.config.cliffsThreshold);
        }
        
        // cliff
        for (var i = 0; i < this.diagram.edges.length; i++) {
            var edge = this.diagram.edges[i];
            if (edge.lSite != null && edge.rSite != null) {
                var lCell = this.diagram.cells[edge.lSite.voronoiId];
                var rCell = this.diagram.cells[edge.rSite.voronoiId];      
                edge.cliff = (!(lCell.water && rCell.water) && (Math.abs(this.getRealElevation(lCell) - this.getRealElevation(rCell)) >= this.config.cliffsThreshold));
            }            
        }
    }, 
    
    assignRivers: function() {
        for (var i = 0; i < this.config.nbRivers;) {
            var cell = this.diagram.cells[this.getRandomInt(0, this.diagram.cells.length - 1)];
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
            // we choose the lowest neighbour cell :
            for (var j = 0; j < neighbors.length; j++) {
                var nId = neighbors[j];
                var neighbor = this.diagram.cells[nId];
                if (lowerCell == null || neighbor.elevation < lowerCell.elevation) {
                    lowerCell = neighbor;
                }
            } 
            if (lowerCell.elevation < cell.elevation) {
                // we continue the river to the next lowest cell :
                this.setAsRiver(lowerCell, size);
                cell.nextRiver = lowerCell; 
            } else {
                // we are in a hole, so we create a lake :
                cell.water = true;
                this.fillLake(cell);
            }
        } else if (cell.water && !cell.ocean) {
            // we ended in a lake, the water level rise :
            cell.lakeElevation = this.getRealElevation(cell) + (this.config.lakesThreshold * size);
            this.fillLake(cell);
        } else if (cell.river) {
            // we ended in another river, the river size increase :
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
        // if the lake has an exit river he can not longer be filled
        if (cell.exitRiver == null) { 
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
                    
                    if (neighbor.water && !neighbor.ocean) { // water cell from the same lake
                        if (neighbor.lakeElevation == null || neighbor.lakeElevation < c.lakeElevation) {
                            neighbor.lakeElevation = c.lakeElevation;
                            queue.push(neighbor);
                        }
                    } else { // ground cell adjacent to the lake
                        if (c.elevation < neighbor.elevation) {
                            if (neighbor.elevation - c.lakeElevation < 0) {
                                // we fill the ground with water
                                neighbor.water = true;
                                neighbor.lakeElevation = c.lakeElevation;
                                queue.push(neighbor);
                            }
                        } else {
                            //neighbor.source = true;
                            // we found an new exit for the lake :
                            if (exitRiver == null || exitRiver.elevation > neighbor.elevation) {
                                exitSource = c;
                                exitRiver = neighbor;
                            } 
                        }
                    }
                } 
            }
            
            if (exitRiver != null) {
                // we start the exit river :
                exitSource.river = true;
                exitSource.nextRiver = exitRiver;
                this.setAsRiver(exitRiver, 2);
                // we mark all the lake as having an exit river :
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
            if (this.getRealElevation(cell) < 0.05) return 'MARSH';
            if (this.getRealElevation(cell) > 0.4) return 'ICE';
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
        var x = 2 * (point.x / this.config.width - 0.5);
        var y = 2 * (point.y / this.config.height - 0.5);
        var distance = Math.sqrt(x * x + y * y);
        var c = this.getPerlinValue(point); 

        return c - distance;
        //return c - (0.3 + 0.3 * distance * distance);
    },
    
    getPerlinValue: function(point) {
        var x = ((point.x / this.config.width) * this.perlin.width) | 0;
        var y = ((point.y / this.config.height) * this.perlin.height) | 0;        
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
        }
        
        this.renderCells();
        this.renderRivers();
        this.renderEdges();
        this.renderSites();
        
        paper.view.draw();
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
                riverPath.strokeWidth = Math.min(cell.riverSize, this.config.maxRiversSize);
                var riverColor = DISPLAY_COLORS.RIVER.clone();
                riverColor.brightness = riverColor.brightness - this.getShade(cell);
                riverPath.strokeColor = riverColor;
                riverPath.strokeCap = 'round';
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
            if (this.config.allowDebug && cell.source) {
                this.debugLayer.activate();
                var circle = new Path.Circle(new Point(cell.site.x, cell.site.y), 3);
                circle.fillColor = DISPLAY_COLORS.SOURCE;
            }
        }
    },
    
    renderEdges: function() {
        if (this.config.allowDebug) {
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
                    edgePath.strokeColor = DISPLAY_COLORS.ROCK;
                } else {
                    edgePath.strokeWidth = 1;
                    edgePath.strokeColor = '#000';
                }
                v = edge.va;
                edgePath.add(new Point(v.x, v.y));
                v = edge.vb;
                edgePath.add(new Point(v.x, v.y));
            }
        }
    },
    
    renderSites: function() {
        if (this.config.allowDebug) {
            this.debugLayer.activate();
            // sites :
            var sites = this.sites,
                iSite = sites.length;
            while (iSite--) {
                v = sites[iSite];
                var circle = new Path.Circle(new Point(v.x, v.y), 1);
                circle.fillColor = '#0f0';
            }       

            // values :
            for (var i = 0; i < this.diagram.cells.length; i++) {
                var cell = this.diagram.cells[i];
                var text = new PointText(new Point(cell.site.x, cell.site.y));
                text.fillColor = '#f00';
                text.fontSize = '8px';
                text.content = Math.ceil(this.getRealElevation(cell) * 100);
            }
        }
    },
    
    getCellColor: function(cell) {
        var c = DISPLAY_COLORS[cell.biome].clone();
        c.brightness = c.brightness - this.getShade(cell);
        
        return c;
    },
    
    getShade: function(cell) {
        if (this.config.shading == 0) {
            return 0;
            
        } else if (cell.ocean) {
            return (this.config.shadeOcean ? - cell.elevation : 0);
            
        } else if (cell.water) {
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
            
            if (diffElevation + this.config.shading < 1) {
                diffElevation = diffElevation + this.config.shading;
            }
            
            return ((Math.abs(angleDegree) / 180) * diffElevation);
        }
    },
        
    toggleDebug: function() {
        this.debug = !this.debug;
        this.debugLayer.visible = this.debug;
    },
    
    getRandomInt: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    distance: function(a, b) {
        var dx = a.x - b.x,
            dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

};