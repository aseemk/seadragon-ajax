//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonDrawer,
    SeadragonOverlayPlacement;

(function() {
    
    // Constants
    
    var QUOTA = 100;    // the max number of images we should keep in memory
    var MIN_PIXEL_RATIO = 0.5;  // the most shrunk a tile should be
    
    // Method of drawing
    
    var browser = SeadragonUtils.getBrowser();
    var browserVer = SeadragonUtils.getBrowserVersion();
    var userAgent = navigator.userAgent;
    
    // check if browser supports <canvas>.
    // update: IE9 returns type "object" instead of "function"...
    var hasCanvas = !!(document.createElement("canvas").getContext);
    
    // we use this style for a lot of our checks, so caching it here:
    var docElmt = document.documentElement || {};
    var docElmtStyle = docElmt.style || {};
    
    // check if browser supports CSS transforms. using this technique:
    // http://www.zachstronaut.com/posts/2009/02/17/animate-css-transforms-firefox-webkit.html
    // also, the spec says translate values need to include units (e.g. "px"),
    // but webkit chokes on units. we need to check for this bug.
    var hasCssTransforms = false;
    var cssTransformProperties = ["msTransform", "WebkitTransform", "MozTransform"];
    var cssTransformProperty, cssTransformNoUnits;
    
    while (cssTransformProperty = cssTransformProperties.shift()) {
        if (typeof docElmtStyle[cssTransformProperty] !== "undefined") {
            hasCssTransforms = true;
            cssTransformNoUnits = /webkit/i.test(cssTransformProperty);
            break;
        }
    }
    
    // we'll use a similar technique to check for CSS transitions.
    // TEMP the value for CSS transition-property is the CSS name of the
    // property you want transitioned, e.g. "-webkit-transform", and NOT the
    // JavaScript name, e.g. "WebkitTransform". so for the time being, we're
    // hardcoding this stuff to just webkit instead of general checking.
    var cssTransformPropertyCssName = "-webkit-transform";
    var cssTransitionProperty = "WebkitTransition";
    var hasCssTransitions =
        typeof docElmtStyle[cssTransitionProperty] !== "undefined";
    
    // check if browser is IE, or supports IE's proprietary DirectX filters.
    // specifically, the matrix transform filter is similar to CSS transforms!
    // http://msdn.microsoft.com/en-us/library/ms533014(v=VS.85).aspx
    var IE_MATRIX_FILTER = "progid:DXImageTransform.Microsoft.Matrix";
    var IE_MATRIX_FILTER_REGEXP = new RegExp(
        IE_MATRIX_FILTER + "\\(.*?\\)", 'g');
    
    // TEMP checking for the presence of the "filters" property isn't really
    // strong feature detection, so added an explicit IE check. that's fine?
    // update: also trying catch this since IE9 throws an error here.
    var hasIeFilters = (function() {
        try {
            return (browser == SeadragonBrowser.IE) &&
                !!(document.documentElement.filters);
        } catch (e) {
            return false;
        }
    })();
    
    // in general, <canvas> is great because it's standardized and stable for
    // the functionality we need. plus, firefox, opera and safari 4 all have
    // subpixel precision inside <canvas>. CSS transforms also seem to get us
    // subpixel precision, and more broadly, across firefox, safari 4 and even
    // chrome, but it's less stable so far. both <canvas> and CSS transform
    // have potential to be hardware accelerated, so deciding between the two
    // comes down to subpixel precision and perf based on experimentation.
    // note that IE provides proprietary matrix transforms which also get us
    // subpixel precision!! for fallback, we use regular CSS position/size.
    // UPDATE: IE's matrix transforms are dog-slow, no good unfortunately.
    // but, we may still be able to use them somehow, maybe once per frame on
    // just the canvas and not multiple times per frame on each tile.
    // TODO investigate IE matrix transforms on canvas instead of per tile.
    // TEMP for now, turning off IE matrix transforms altogether.
    var badCanvas =     // due to no subpixel precision
            (browser == SeadragonBrowser.SAFARI && browserVer < 4) ||
            (browser == SeadragonBrowser.CHROME);
    var useCanvas = hasCanvas && !badCanvas;
    var useCssTransforms = !useCanvas && hasCssTransforms;
    var useIeFilters = false;
    
    // UPDATE: safari 4 on Mac OS X 10.6 (snow leopard) and safari mobile on
    // iPhone OS 3 hardware accelerate CSS transforms when combined with CSS
    // transitions, so use them there over <canvas>!
    // UPDATE: this causes flickers on the iPhone; removing support for now.
    //var acceleratedTransforms =
    //    browser == SeadragonBrowser.SAFARI && userAgent.match(/Mac OS X/) && (
    //        // case 1: safari 4 (desktop and iPad)
    //        browserVer >= 4 ||
    //        // case 2: safari mobile, might be 3
    //        userAgent.match(/Mobile\//));
    //if (hasCssTransforms && hasCssTransitions && acceleratedTransforms) {
    //    useCanvas = false;
    //    useCssTransforms = true;
    //}
    
    // regardless, in IE, we use <img> tags. unfortunately, in IE, <img> tags
    // use a crappy nearest-neighbor interpolation by default. IE7+ lets us
    // change this via a proprietary CSS property. unfortunately, changing it to
    // bicubic caused tile seams in IE7 -- but not IE8! even IE8 in compat mode
    // has no tile seams. so we need to detect IE8 regardless of mode; we do so
    // via document.documentMode, introduced in IE8 for all modes. finally, in
    // IE7, we'll explicitly say nearest-neighbor, otherwise if the user zooms
    // the page, IE7 would implicitly change it to bicubic, causing tile seams.
    var MS_INTERPOLATION_MODE = (typeof document.documentMode !== "undefined") ?
            "bicubic" : "nearest-neighbor";
    
    // Tiles
    
    function Tile(level, x, y, bounds, exists, url) {
        // Core
        this.level = level;
        this.x = x;
        this.y = y;
        this.bounds = bounds;   // where this tile fits, in normalized coordinates
        this.exists = exists;   // part of sparse image? tile hasn't failed to load?
        
        // Image
        this.url = url;         // the URL of this tile's image
        this.elmt = null;       // the HTML element for this tile
        this.image = null;      // the Image object for this tile
        this.loaded = false;    // is this tile loaded?
        this.loading = false;   // or is this tile loading?
        
        // Drawing
        this.style = null;      // alias of this.elmt.style
        this.position = null;   // this tile's position on screen, in pixels
        this.size = null;       // this tile's size on screen, in pixels
        this.blendStart = null; // the start time of this tile's blending
        this.opacity = null;    // the current opacity this tile should be
        this.distance = null;   // the distance of this tile to the viewport center
        this.visibility = null; // the visibility score of this tile
        
        // Caching
        this.beingDrawn = false;// whether this tile is currently being drawn
        this.lastDrawnTime = 0; // when the tile was last drawn
        this.lastTouchTime = 0; // the time that tile was last touched (though not necessarily drawn)
    }
    
    Tile.prototype.toString = function() {
        return this.level + "/" + this.x + "_" + this.y;
    };
    
    Tile.prototype.drawHTML = function(container) {
        if (!this.loaded) {
            SeadragonDebug.error("Attempting to draw tile " + this.toString() +
                    " when it's not yet loaded.");
            return;
        }
        
        // initialize if first time
        if (!this.elmt) {
            this.elmt = SeadragonUtils.makeNeutralElement("img");
            this.elmt.src = this.url; 
            this.style = this.elmt.style;
            this.style.position = "absolute";
            this.style.msInterpolationMode = MS_INTERPOLATION_MODE;
                // IE only property. see note above for explanation.
            
            if (useCssTransforms) {
                this.style[cssTransformProperty + "Origin"] = "0px 0px";
                // TEMP commenting out CSS transitions for now; not stable yet.
                //if (hasCssTransitions) {
                //    this.style[cssTransitionProperty + "Property"] = cssTransformPropertyCssName;
                //    this.style[cssTransitionProperty + "Duration"] = ".01666667s";   // TEMP 1/60th of a second
                //}
            }
        }
        
        var elmt = this.elmt;
        var image = this.image;
        var style = this.style;
        var position = this.position;
        var size = this.size;
        
        if (elmt.parentNode != container) {
            container.appendChild(elmt);
        }
        
        if (useCssTransforms) {
            
            // warning! sometimes chrome doesn't have this new <img> element
            // loaded yet, even though it's a clone of another <img> element
            // that is loaded. so we use the width and height properties of the
            // original <img> (the image variable instead of this one (elmt).
            style[cssTransformProperty] = [
                'matrix(',
                (size.x / image.width).toFixed(8),
                ',0,0,',
                (size.y / image.height).toFixed(8),
                ',',
                position.x.toFixed(8),
                cssTransformNoUnits ? ',' : 'px,',
                position.y.toFixed(8),
                cssTransformNoUnits ? ')' : 'px)'
            ].join('');
            
        } else if (useIeFilters) {
            
            var containerWidth = container.clientWidth,
                containerHeight = container.clientHeight;
            
            style.width = containerWidth + "px";
            style.height = containerHeight + "px";
            style.filter = [
                'progid:DXImageTransform.Microsoft.Matrix(',
                'M11=',
                (size.x / containerWidth).toFixed(8),
                ',M22=',
                (size.y / containerHeight).toFixed(8),
                ',Dx=',
                position.x.toFixed(8),
                ',Dy=',
                position.y.toFixed(8),
                ')'
            ].join('');
            
        } else {
            
            position = position.apply(Math.floor);
            size = size.apply(Math.ceil);
            
            style.left = position.x + "px";
            style.top = position.y + "px";
            style.width = size.x + "px";
            style.height = size.y + "px";
            
        }
        
        // TEMP because we know exactly whether we're using IE filters or not,
        // short-circuitting this utils call to optimize the logic.
        // UPDATE: we're no longer using IE filters, so reverting this logic.
        SeadragonUtils.setElementOpacity(elmt, this.opacity);
        //var opacity = this.opacity;
        //if (useIeFilters && opacity < 1) {
        //    style.filter += " alpha(opacity=" + Math.round(100 * opacity) + ")";
        //} else {
        //    style.opacity = (opacity < 1) ? opacity : '';
        //}
    };
    
    Tile.prototype.drawCanvas = function(context) {
        if (!this.loaded) {
            SeadragonDebug.error("Attempting to draw tile " + this.toString() +
                    " when it's not yet loaded.");
            return;
        }
        
        var position = this.position;
        var size = this.size;
            
        context.globalAlpha = this.opacity;
        context.drawImage(this.image, position.x, position.y, size.x, size.y);
    };
    
    Tile.prototype.unload = function() {
        if (this.elmt && this.elmt.parentNode) {
            this.elmt.parentNode.removeChild(this.elmt);
        }
        
        this.elmt = null;
        this.image = null;
        this.loaded = false;
        this.loading = false;
    }
    
    // Overlays
    
    SeadragonOverlayPlacement = Seadragon.OverlayPlacement = {
        CENTER: 0,
        TOP_LEFT: 1,
        TOP: 2,
        TOP_RIGHT: 3,
        RIGHT: 4,
        BOTTOM_RIGHT: 5,
        BOTTOM: 6,
        BOTTOM_LEFT: 7,
        LEFT: 8
    };
    
    /**
     * Creates an "adjustment" function for a given overlay placement that
     * adjusts an overlay's position depending on its size and placement. This
     * gives better perf during draw loop since we don't need to re-check and
     * re-calculate the adjustment every single iteration.
     */
    function createAdjustmentFunction(placement) {
        switch (placement) {
            case SeadragonOverlayPlacement.TOP_LEFT:
                return function(position, size) {
                    // no adjustment needed
                };
            case SeadragonOverlayPlacement.TOP:
                return function(position, size) {
                    position.x -= size.x / 2;
                    // no y adjustment needed
                };
            case SeadragonOverlayPlacement.TOP_RIGHT:
                return function(position, size) {
                    position.x -= size.x;
                    // no y adjustment needed
                };
            case SeadragonOverlayPlacement.RIGHT:
                return function(position, size) {
                    position.x -= size.x;
                    position.y -= size.y / 2;
                };
            case SeadragonOverlayPlacement.BOTTOM_RIGHT:
                return function(position, size) {
                    position.x -= size.x;
                    position.y -= size.y;
                };
            case SeadragonOverlayPlacement.BOTTOM:
                return function(position, size) {
                    position.x -= size.x / 2;
                    position.y -= size.y;
                };
            case SeadragonOverlayPlacement.BOTTOM_LEFT:
                return function(position, size) {
                    // no x adjustment needed
                    position.y -= size.y;
                };
            case SeadragonOverlayPlacement.LEFT:
                return function(position, size) {
                    // no x adjustment needed
                    position.y -= size.y / 2;
                };
            case SeadragonOverlayPlacement.CENTER:
            default:
                return function(position, size) {
                    position.x -= size.x / 2;
                    position.y -= size.y / 2;
                };
        }
    }
    
    function Overlay(elmt, loc, placement) {
        // Core
        this.elmt = elmt;
        this.scales = (loc instanceof SeadragonRect);
        this.bounds = new SeadragonRect(loc.x, loc.y, loc.width, loc.height);
        // Drawing
        this.adjust = createAdjustmentFunction(loc instanceof SeadragonPoint ?
                placement : SeadragonOverlayPlacement.TOP_LEFT);    // rects are always top-left
        this.position = new SeadragonPoint(loc.x, loc.y);
        this.size = new SeadragonPoint(loc.width, loc.height);
        this.style = elmt.style;
        this.naturalSize = new SeadragonPoint(elmt.clientWidth, elmt.clientHeight);
    }
    
    Overlay.prototype.destroy = function() {
        var elmt = this.elmt;
        var style = this.style;
        
        if (elmt.parentNode) {
            elmt.parentNode.removeChild(elmt);
        }
        
        style.top = "";
        style.left = "";
        style.position = "";
        
        if (this.scales) {
            style.width = "";
            style.height = "";
        }
    };
    
    Overlay.prototype.drawHTML = function(container) {
        var elmt = this.elmt;
        var style = this.style;
        var scales = this.scales;
        var naturalSize = this.naturalSize;
        
        if (elmt.parentNode != container) {
            container.appendChild(elmt);
            style.position = "absolute";
            naturalSize.x = elmt.clientWidth;
            naturalSize.y = elmt.clientHeight;
        }
        
        var position = this.position;
        var size = this.size;
        
        // override calculated size if this element doesn't scale with image
        if (!scales) {
            size.x = naturalSize.x = naturalSize.x || elmt.clientWidth;
            size.y = naturalSize.y = naturalSize.y || elmt.clientHeight;
        }
        
        // adjust position based on placement (default is center)
        this.adjust(position, size);
        
        if (SeadragonConfig.transformOverlays && hasCssTransforms) {
            
            style[cssTransformProperty + "Origin"] = "0px 0px";
            style[cssTransformProperty] = [
                'translate(',
                position.x.toFixed(8),
                'px,',  // webkit correctly accepts length units for translate() func
                position.y.toFixed(8),
                'px)'
            ].join('');
            
            if (scales) {
                
                if (!elmt.clientWidth) {
                    style.width = "100%";
                }
                if (!elmt.clientHeight) {
                    style.height = "100%";
                }
                
                style[cssTransformProperty] += [
                    ' scale(',
                    (size.x / elmt.clientWidth).toFixed(8),
                    ',',
                    (size.y / elmt.clientHeight).toFixed(8),
                    ')'
                ].join('');
                
            }
            
        } else if (SeadragonConfig.transformOverlays && useIeFilters) {
            
            var containerWidth = container.clientWidth,
                containerHeight = container.clientHeight;
            
            style.width = containerWidth + "px";
            style.height = containerHeight + "px";
            style.filter = [
                'progid:DXImageTransform.Microsoft.Matrix(',
                'M11=',
                (size.x / containerWidth).toFixed(8),
                ',M22=',
                (size.y / containerHeight).toFixed(8),
                ',Dx=',
                position.x.toFixed(8),
                ',Dy=',
                position.y.toFixed(8),
                ')'
            ].join('');
            
        } else {
            
            position = position.apply(Math.floor);
            size = size.apply(Math.ceil);
            
            style.left = position.x + "px";
            style.top = position.y + "px";
            
            if (scales) {
                style.width = size.x + "px";
                style.height = size.y + "px";
            }
            
        }
    };
    
    Overlay.prototype.update = function(loc, placement) {
        this.scales = (loc instanceof SeadragonRect);
        this.bounds = new SeadragonRect(loc.x, loc.y, loc.width, loc.height);
        this.adjust = createAdjustmentFunction(loc instanceof SeadragonPoint ?
                placement : SeadragonOverlayPlacement.TOP_LEFT);    // rects are always top-left
    };
    
    // Drawer
    
    SeadragonDrawer = Seadragon.Drawer = function(source, viewport, elmt) {
        
        // Implementation note:
        // 
        // This class draws two types of things: tiles and overlays. Currently,
        // only HTML elements are supported overlay types, so they will always
        // be inserted into the DOM. Tiles are images, which allows them to be
        // both inserted into the DOM or to be drawn onto a <canvas> element.
        // 
        // Higher-res (higher-level) tiles need to be drawn above lower-res
        // (lower-level) tiles. Overlays need to be drawn above all tiles. For
        // tiles drawn using <canvas>, this is easy. For tiles drawn as HTML,
        // and for overlays, we can use the CSS z-index property, but that has
        // issues in full page. So instead, we can achieve natural z-ordering
        // through the order of the elements in the container.
        // 
        // To do this, in the HTML mode, we add the tiles not to the container
        // directly, but to a div inside the container. This div is the first
        // child of the container. The overlays are added to the container
        // directly, after that div. This ensures that the overlays are always
        // drawn above the tiles.
        // 
        // In the below fields, the canvas field refers to the <canvas> element
        // if we're drawing with canvas, or the div that contains the tiles if
        // we're drawing with HTML.
        // 
        // Minor note: we remove and re-add tiles to the div every frame, but we
        // can't do this with overlays, as it breaks browser event behavior.
        
        // Fields
        
        var container = SeadragonUtils.getElement(elmt);
        var canvas = SeadragonUtils.makeNeutralElement(useCanvas ? "canvas" : "div");
        var context = useCanvas ? canvas.getContext("2d") : null;
        
        var imageLoader = new SeadragonImageLoader();
        var profiler = new SeadragonProfiler();
        
        var minLevel = source.minLevel;
        var maxLevel = source.maxLevel;
        var tileSize = source.tileSize;
        var tileOverlap = source.tileOverlap;
        var normHeight = source.height / source.width;
        
        var cacheNumTiles = {};     // 1d dictionary [level] --> Point
        var cachePixelRatios = {};  // 1d dictionary [level] --> Point
        var tilesMatrix = {};       // 3d dictionary [level][x][y] --> Tile
        var tilesLoaded = [];       // unordered list of Tiles with loaded images
        var coverage = {};          // 3d dictionary [level][x][y] --> Boolean
        
        var overlays = [];          // unordered list of Overlays added
        var lastDrawn = [];         // unordered list of Tiles drawn last frame
        var lastFrameTime = 0;      // the timestamp of the previous frame
        var lastResetTime = 0;
        var midUpdate = false;
        var updateAgain = true;
        
        // Properties
        
        this.elmt = container;
        this.profiler = profiler;
        
        // Constructor
        
        (function() {
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.position = "absolute";
            container.style.textAlign = "left";    // explicit left-align
            container.appendChild(canvas);
        })();
        
        // Helpers -- CACHES
        
        function getNumTiles(level) {
            if (!cacheNumTiles[level]) {
                cacheNumTiles[level] = source.getNumTiles(level);
            }
            
            return cacheNumTiles[level];
        }
        
        function getPixelRatio(level) {
            if (!cachePixelRatios[level]) {
                cachePixelRatios[level] = source.getPixelRatio(level);
            }
            
            return cachePixelRatios[level];
        }
        
        // Helpers -- TILES
        
        function getTile(level, x, y, time, numTilesX, numTilesY) {
            if (!tilesMatrix[level]) {
                tilesMatrix[level] = {};
            }
            if (!tilesMatrix[level][x]) {
                tilesMatrix[level][x] = {};
            }
            
            // initialize tile object if first time
            if (!tilesMatrix[level][x][y]) {
                // where applicable, adjust x and y to support wrapping.
                var xMod = (numTilesX + (x % numTilesX)) % numTilesX;
                var yMod = (numTilesY + (y % numTilesY)) % numTilesY;
                var bounds = source.getTileBounds(level, xMod, yMod);
                var exists = source.tileExists(level, xMod, yMod);
                var url = source.getTileUrl(level, xMod, yMod);
                
                // also adjust bounds to support wrapping.
                bounds.x += 1.0 * (x - xMod) / numTilesX;
                bounds.y += normHeight * (y - yMod) / numTilesY;
                
                tilesMatrix[level][x][y] = new Tile(level, x, y, bounds, exists, url);
            }
            
            var tile = tilesMatrix[level][x][y];
            
            // mark tile as touched so we don't reset it too soon
            tile.lastTouchTime = time;
            
            return tile;
        }
        
        function loadTile(tile, time) {
            tile.loading = imageLoader.loadImage(tile.url,
                    SeadragonUtils.createCallback(null, onTileLoad, tile, time));
        }
        
        function onTileLoad(tile, time, image) {
            tile.loading = false;
            
            if (midUpdate) {
                SeadragonDebug.error("Tile load callback in middle of drawing routine.");
                return;
            } else if (!image) {
                SeadragonDebug.log("Tile " + tile + " failed to load: " + tile.url);
                tile.exists = false;
                return;
            } else if (time < lastResetTime) {
                SeadragonDebug.log("Ignoring tile " + tile + " loaded before reset: " + tile.url);
                return;
            }
            
            tile.loaded = true;
            tile.image = image;
            
            var insertionIndex = tilesLoaded.length;
            
            if (tilesLoaded.length >= QUOTA) {
                var cutoff = Math.ceil(Math.log(tileSize) / Math.log(2));
                    // don't delete any single-tile levels. this takes priority.
                
                var worstTile = null;
                var worstTileIndex = -1;
                
                for (var i = tilesLoaded.length - 1; i >= 0; i--) {
                    var prevTile = tilesLoaded[i];
                    
                    if (prevTile.level <= cutoff || prevTile.beingDrawn) {
                        continue;
                    } else if (!worstTile) {
                        worstTile = prevTile;
                        worstTileIndex = i;
                        continue;
                    }
                    
                    var prevTime = prevTile.lastTouchTime;
                    var worstTime = worstTile.lastTouchTime;
                    var prevLevel = prevTile.level;
                    var worstLevel = worstTile.level;
                    
                    if (prevTime < worstTime ||
                            (prevTime == worstTime && prevLevel > worstLevel)) {
                        worstTile = prevTile;
                        worstTileIndex = i;
                    }
                }
                
                if (worstTile && worstTileIndex >= 0) {
                    worstTile.unload();
                    insertionIndex = worstTileIndex;
                    // note: we don't want or need to delete the actual Tile
                    // object from tilesMatrix; that's negligible memory.
                }
            }
            
            tilesLoaded[insertionIndex] = tile;
            updateAgain = true;
        }
        
        function clearTiles() {
            tilesMatrix = {};
            tilesLoaded = [];
        }
        
        // Helpers -- COVERAGE
        
        // Coverage scheme: it's required that in the draw routine, coverage for
        // every tile within the viewport is initially explicitly set to false.
        // This way, if a given level's coverage has been initialized, and a tile
        // isn't found, it means it's offscreen and thus provides coverage (since
        // there's no content needed to be covered). And if every tile that is found
        // does provide coverage, the entire visible level provides coverage.
        
        /**
         * Returns true if the given tile provides coverage to lower-level tiles of
         * lower resolution representing the same content. If neither x nor y is
         * given, returns true if the entire visible level provides coverage.
         * 
         * Note that out-of-bounds tiles provide coverage in this sense, since
         * there's no content that they would need to cover. Tiles at non-existent
         * levels that are within the image bounds, however, do not.
         */
        function providesCoverage(level, x, y) {
            if (!coverage[level]) {
                return false;
            }
            
            if (x === undefined || y === undefined) {
                // check that every visible tile provides coverage.
                // update: protecting against properties added to the Object
                // class's prototype, which can definitely (and does) happen.
                var rows = coverage[level];
                for (var i in rows) {
                    if (rows.hasOwnProperty(i)) {
                        var cols = rows[i];
                        for (var j in cols) {
                            if (cols.hasOwnProperty(j) && !cols[j]) {
                               return false;
                            }
                        }
                    }
                }
                
                return true;
            }
            
            return (coverage[level][x] === undefined ||
                    coverage[level][x][y] === undefined ||
                    coverage[level][x][y] === true);
        }
        
        /**
         * Returns true if the given tile is completely covered by higher-level
         * tiles of higher resolution representing the same content. If neither x
         * nor y is given, returns true if the entire visible level is covered.
         */
        function isCovered(level, x, y) {
            if (x === undefined || y === undefined) {
                return providesCoverage(level+1);
            } else {
                return (providesCoverage(level+1, 2*x, 2*y) &&
                        providesCoverage(level+1, 2*x, 2*y + 1) &&
                        providesCoverage(level+1, 2*x + 1, 2*y) &&
                        providesCoverage(level+1, 2*x + 1, 2*y + 1));
            }
        }
        
        /**
         * Sets whether the given tile provides coverage or not.
         */
        function setCoverage(level, x, y, covers) {
            if (!coverage[level]) {
                SeadragonDebug.error("Setting coverage for a tile before its " +
                        "level's coverage has been reset: " + level);
                return;
            }
            
            if (!coverage[level][x]) {
                coverage[level][x] = {};
            }
            
            coverage[level][x][y] = covers;
        }
        
        /**
         * Resets coverage information for the given level. This should be called
         * after every draw routine. Note that at the beginning of the next draw
         * routine, coverage for every visible tile should be explicitly set. 
         */
        function resetCoverage(level) {
            coverage[level] = {};
        }
        
        // Helpers -- SCORING
        
        function compareTiles(prevBest, tile) {
            // figure out if this tile is better than the previous best tile...
            // note that if there is no prevBest, this is automatically better.
            if (!prevBest) {
                return tile;
            }
            
            if (tile.visibility > prevBest.visibility) {
                return tile;
            } else if (tile.visibility == prevBest.visibility) {
                if (tile.distance < prevBest.distance) {
                    return tile;
                }
            }
            
            return prevBest;
        }
        
        // Helpers -- OVERLAYS
        
        function getOverlayIndex(elmt) {
            for (var i = overlays.length - 1; i >= 0; i--) {
                if (overlays[i].elmt == elmt) {
                    return i;
                }
            }
            
            return -1;
        }
        
        // Helpers -- CORE
        
        function updateActual() {
            // assume we won't need to update again after this update.
            // we'll set this if we find a reason to update again.
            updateAgain = false;
            
            // make local references to variables & functions referenced in
            // loops in order to improve perf
            var _canvas = canvas;
            var _context = context;
            var _container = container;
            var _useCanvas = useCanvas;
            var _lastDrawn = lastDrawn;
            
            // the tiles that were drawn last frame, but won't be this frame,
            // can be cleared from the cache, so they should be marked as such.
            while (_lastDrawn.length > 0) {
                var tile = _lastDrawn.pop();
                tile.beingDrawn = false;
            }
            
            // we need the size of the viewport (in pixels) in multiple places
            var viewportSize = viewport.getContainerSize();
            var viewportWidth = viewportSize.x;
            var viewportHeight = viewportSize.y;
            
            // clear canvas, whether in <canvas> mode or HTML mode.
            // this is important as scene may be empty this frame.
            if (_useCanvas) {
                _canvas.width = viewportWidth;
                _canvas.height = viewportHeight;
                _context.clearRect(0, 0, viewportWidth, viewportHeight);
                    // this last line shouldn't be needed. setting the width and
                    // height should clear <canvas>, but Firefox doesn't always.
            } else {
                _canvas.innerHTML = "";
            }
            
            // if viewport is off image entirely, don't bother drawing.
            // UPDATE: logic modified to support horizontal/vertical wrapping.
            var viewportBounds = viewport.getBounds(true);
            var viewportTL = viewportBounds.getTopLeft();
            var viewportBR = viewportBounds.getBottomRight();
            if (!SeadragonConfig.wrapHorizontal &&
                    (viewportBR.x < 0 || viewportTL.x > 1)) {
                // we're not wrapping horizontally, and viewport is off in x
                return;
            } else if (!SeadragonConfig.wrapVertical &&
                    (viewportBR.y < 0 || viewportTL.y > normHeight)) {
                // we're not wrapping vertically, and viewport is off in y
                return;
            }
            
            // the below section is commented out because it's more relevant to
            // collections, where you don't want 10 items to all load their xml
            // at the same time when 9 of them won't be in the viewport soon.
            
//            // but even if the viewport is currently on the image, don't force
//            // tiles to load if the viewport target is off the image
//            var viewportTargetBounds = getViewportBounds(false);
//            var viewportTargetTL = viewportTargetBounds.getTopLeft();
//            var viewportTargetBR = viewportTargetBounds.getBottomRight();
//            var willBeOff = viewportTargetBR.x < 0 || viewportTargetBR.y < 0 ||
//                    viewportTargetTL.x > 1 || viewportTargetTL.y > normHeight;
            
            // make local references to functions and variables used in loops to
            // improve perf
            var _getNumTiles = getNumTiles;
            var _getPixelRatio = getPixelRatio;
            var _getTile = getTile;
            var _isCovered = isCovered;
            var _setCoverage = setCoverage;
            var _resetCoverage = resetCoverage;
            var _providesCoverage = providesCoverage;
            var _tileOverlap = tileOverlap;
            var _lastFrameTime = lastFrameTime;
            var isChrome = (browser === SeadragonBrowser.CHROME);
            // same for Math functions
            var _abs = Math.abs;
            var _ceil = Math.ceil;
            var _floor = Math.floor;
            var _log = Math.log;
            var _max = Math.max;
            var _min = Math.min;
            // and Viewport functions
            var _deltaPixelsFromPoints = viewport.deltaPixelsFromPoints;
            var _pixelFromPoint = viewport.pixelFromPoint;
            // and TileSource functions
            var _getTileAtPoint = source.getTileAtPoint;
            // and Config properties
            var alwaysBlend = SeadragonConfig.alwaysBlend;
            var blendTimeMillis = 1000 * SeadragonConfig.blendTime;
            var immediateRender = SeadragonConfig.immediateRender;
            var minDimension = SeadragonConfig.minZoomDimension;   // for backwards compatibility
            var minImageRatio = SeadragonConfig.minImageRatio;
            var wrapHorizontal = SeadragonConfig.wrapHorizontal;
            var wrapVertical = SeadragonConfig.wrapVertical;
            var wrapOverlays = SeadragonConfig.wrapOverlays;
            
            // restrain bounds of viewport relative to image.
            // UPDATE: logic modified to support horizontal/vertical wrapping.
            if (!wrapHorizontal) {
                viewportTL.x = _max(viewportTL.x, 0);
                viewportBR.x = _min(viewportBR.x, 1);
            }
            if (!wrapVertical) {
                viewportTL.y = _max(viewportTL.y, 0);
                viewportBR.y = _min(viewportBR.y, normHeight);
            }
            
            var best = null;
            var haveDrawn = false;
            var currentTime = new Date().getTime();
            
            // calculate values for scoring -- this is based on TARGET values
            var viewportCenterPoint = viewport.getCenter();
            var viewportCenterPixel = _pixelFromPoint(viewportCenterPoint);
            var zeroRatioT = _deltaPixelsFromPoints(_getPixelRatio(0), false).x;
            var optimalPixelRatio = immediateRender ? 1 : zeroRatioT;
            
            // adjust levels to iterate over -- this is based on CURRENT values
            // TODO change this logic to use minImageRatio, but for backwards
            // compatibility, use minDimension if it's been explicitly set.
            // TEMP for now, original minDimension logic with default 64.
            minDimension = minDimension || 64;
            var lowestLevel = _max(minLevel, _floor(_log(minDimension) / _log(2)));
            var zeroRatioC = _deltaPixelsFromPoints(_getPixelRatio(0), true).x;
            var highestLevel = _min(maxLevel,
                    _floor(_log(zeroRatioC / MIN_PIXEL_RATIO) / _log(2)));
            
            // with very small images, this edge case can occur...
            lowestLevel = _min(lowestLevel, highestLevel);
            
            for (var level = highestLevel; level >= lowestLevel; level--) {
                var drawLevel = false;
                var renderPixelRatioC = _deltaPixelsFromPoints(
                        _getPixelRatio(level), true).x;     // note the .x!
                
                // if we haven't drawn yet, only draw level if tiles are big enough
                if ((!haveDrawn && renderPixelRatioC >= MIN_PIXEL_RATIO) ||
                        level == lowestLevel) {
                    drawLevel = true;
                    haveDrawn = true;
                } else if (!haveDrawn) {
                    continue;
                }
                
                _resetCoverage(level);
                
                // calculate scores applicable to all tiles on this level --
                // note that we're basing visibility on the TARGET pixel ratio
                var levelOpacity = _min(1, (renderPixelRatioC - 0.5) / 0.5);
                var renderPixelRatioT = _deltaPixelsFromPoints(
                        _getPixelRatio(level), false).x;
                var levelVisibility = optimalPixelRatio /
                        _abs(optimalPixelRatio - renderPixelRatioT);
                
                // only iterate over visible tiles
                var tileTL = _getTileAtPoint(level, viewportTL);
                var tileBR = _getTileAtPoint(level, viewportBR);
                var numTiles = _getNumTiles(level);
                var numTilesX = numTiles.x;
                var numTilesY = numTiles.y;
                if (!wrapHorizontal) {
                    tileBR.x = _min(tileBR.x, numTilesX - 1);
                }
                if (!wrapVertical) {
                    tileBR.y = _min(tileBR.y, numTilesY - 1);
                }
                
                for (var x = tileTL.x; x <= tileBR.x; x++) {
                    for (var y = tileTL.y; y <= tileBR.y; y++) {
                        var tile = _getTile(level, x, y, currentTime, numTilesX, numTilesY);
                        var drawTile = drawLevel;
                        
                        // assume this tile doesn't cover initially
                        _setCoverage(level, x, y, false);
                        
                        if (!tile.exists) {
                            // not part of sparse image, or failed to load
                            continue;
                        }
                    
                        // if we've drawn a higher-resolution level and we're not
                        // going to draw this level, then say this tile does cover
                        // if it's covered by higher-resolution tiles. if we're not
                        // covered, then we should draw this tile regardless.
                        if (haveDrawn && !drawTile) {
                            if (_isCovered(level, x, y)) {
                                _setCoverage(level, x, y, true);
                            } else {
                                drawTile = true;
                            }
                        }
                        
                        if (!drawTile) {
                            continue;
                        }
                        
                        // calculate tile's position and size in pixels
                        var boundsTL = tile.bounds.getTopLeft();
                        var boundsSize = tile.bounds.getSize();
                        var positionC = _pixelFromPoint(boundsTL, true);
                        var sizeC = _deltaPixelsFromPoints(boundsSize, true);
                        
                        // if there is no tile overlap, we need to oversize the
                        // tiles by 1px to prevent seams at imperfect zooms.
                        // fortunately, this is not an issue with regular dzi's
                        // created from Deep Zoom Composer, which uses overlap.
                        if (!_tileOverlap) { 
                            sizeC = sizeC.plus(new SeadragonPoint(1, 1));
                        }
                        
                        // calculate distance from center of viewport -- note
                        // that this is based on tile's TARGET position
                        var positionT = _pixelFromPoint(boundsTL, false);
                        var sizeT = _deltaPixelsFromPoints(boundsSize, false);
                        var tileCenter = positionT.plus(sizeT.divide(2));
                        var tileDistance = viewportCenterPixel.distanceTo(tileCenter);
                        
                        // update tile's scores and values
                        tile.position = positionC;
                        tile.size = sizeC;
                        tile.distance = tileDistance;
                        tile.visibility = levelVisibility;
                        
                        if (tile.loaded) {
                            if (!tile.blendStart) {
                                // image was just added, blend it
                                tile.blendStart = currentTime;
                            }
                            
                            var deltaTime = currentTime - tile.blendStart;
                            var opacity = (blendTimeMillis === 0) ? 1 :
                                _min(1, deltaTime / blendTimeMillis);
                            
                            if (alwaysBlend) {
                                opacity *= levelOpacity;
                            }
                            
                            tile.opacity = opacity;
                            
                            // queue tile for drawing in reverse order
                            _lastDrawn.push(tile);
                            
                            // if fully blended in, this tile now provides coverage,
                            // otherwise we need to update again to keep blending
                            if (opacity >= 1) {
                                _setCoverage(level, x, y, true);
                            
                                // workaround for chrome's weird flickering issue
                                if (isChrome && tile.lastDrawnTime !== _lastFrameTime) {
                                    _setCoverage(level, x, y, false);
                                }
                            } else if (deltaTime < blendTimeMillis) {
                                updateAgain = true;
                            }
                            
                            // new: remember that it was drawn this frame
                            tile.lastDrawnTime = currentTime;
                        } else if (tile.loading) {
                            // nothing to see here, move on
                        } else {
                            // means tile isn't loaded yet, so score it
                            best = compareTiles(best, tile);
                        }
                    }
                }
                
                // we may not need to draw any more lower-res levels
                if (_providesCoverage(level)) {
                    break;
                }
            }
            
            // now draw the tiles, but in reverse order since we want higher-res
            // tiles to be drawn on top of lower-res ones. also mark each tile
            // as being drawn so it won't get cleared from the cache.
            for (var i = _lastDrawn.length - 1; i >= 0; i--) {
                var tile = _lastDrawn[i];
                
                if (_useCanvas) {
                    tile.drawCanvas(_context);
                } else {
                    tile.drawHTML(_canvas);
                }
                
                tile.beingDrawn = true;
            }
            
            // draw the overlays -- TODO optimize based on viewport like tiles,
            // but this is tricky for non-scaling overlays like pins...
            var numOverlays = overlays.length;
            
            for (var i = 0; i < numOverlays; i++) {
                var overlay = overlays[i];
                var bounds = overlay.bounds;
                var overlayTL = bounds.getTopLeft();    // in normalized coords
                
                // wrap overlays if specified
                if (wrapOverlays && wrapHorizontal) {
                    // TEMP this isn't perfect, e.g. view center is at -2.1 and
                    // overlay is at 0.1, this will use -2.9 instead of -1.9.
                    overlayTL.x += _floor(viewportCenterPoint.x);
                }
                if (wrapOverlays && wrapVertical) {
                    // TODO wrap overlays vertically
                }
                
                overlay.position = _pixelFromPoint(overlayTL, true);
                overlay.size = _deltaPixelsFromPoints(bounds.getSize(), true);
                
                overlay.drawHTML(container);
            }
            
            // load next tile if there is one to load
            if (best) {
                loadTile(best, currentTime);
                updateAgain = true; // because we haven't finished drawing, so
                                    // we should be re-evaluating and re-scoring
            }
            
            // new: save this frame's timestamp to enable comparing times
            lastFrameTime = currentTime;
        }
        
        // Methods -- OVERLAYS
        
        this.addOverlay = function(elmt, loc, placement) {
            var elmt = SeadragonUtils.getElement(elmt);
            
            if (getOverlayIndex(elmt) >= 0) {
                return;     // they're trying to add a duplicate overlay
            }
            
            overlays.push(new Overlay(elmt, loc, placement));
            updateAgain = true;     // TODO do we really need this?
        };
        
        this.updateOverlay = function(elmt, loc, placement) {
            var elmt = SeadragonUtils.getElement(elmt);
            var i = getOverlayIndex(elmt);
            
            if (i >= 0) {
                overlays[i].update(loc, placement);
                updateAgain = true;     // TODO do we really need this?
            }
        };
       
        this.removeOverlay = function(elmt) {
            var elmt = SeadragonUtils.getElement(elmt);
            var i = getOverlayIndex(elmt);
            
            if (i >= 0) {
                overlays[i].destroy();
                overlays.splice(i, 1);
                updateAgain = true;     // TODO do we really need this?
            }
        };
        
        this.clearOverlays = function() {
            while (overlays.length > 0) {
                overlays.pop().destroy();
                updateAgain = true;     // TODO do we really need this?
                                        // TODO it also doesn't need to be in the loop.
            }
        };
        
        // Methods -- CORE
        
        this.needsUpdate = function() {
            return updateAgain;
        };
        
        this.numTilesLoaded = function() {
            return tilesLoaded.length;
        };
        
        this.reset = function() {
            clearTiles();
            lastResetTime = new Date().getTime();
            updateAgain = true;
        };
        
        this.update = function() {
            profiler.beginUpdate();
            midUpdate = true;
            updateActual();
            midUpdate = false;
            profiler.endUpdate();
        };
    
        this.idle = function() {
            // TODO idling function
        };
        
    };
    
})();
