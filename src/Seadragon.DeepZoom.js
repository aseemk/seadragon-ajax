//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonDziTileSource = Seadragon.DziTileSource = function(
        width, height, tileSize, tileOverlap, tilesUrl, tileFormat, displayRects) {
    
    // Inheritance
    
    SeadragonTileSource.apply(this, [width, height, tileSize, tileOverlap]);
    
    // Fields
    
    var self = this;
    var levelRects = {};    // 1D dictionary [level] --> array of DisplayRects
    
    // Properties
    
    this.fileFormat = tileFormat;   // deprecated old property ("file" instead of "tile")
    this.tileFormat = tileFormat;
    this.displayRects = displayRects;
    
    // Constructor
    
    (function() {
        if (!displayRects) {
            return;
        }
        
        for (var i = displayRects.length - 1; i >= 0; i--) {
            var rect = displayRects[i];
            for (var level = rect.minLevel; level <= rect.maxLevel; level++) {
                if (!levelRects[level]) {
                    levelRects[level] = [];
                }
                levelRects[level].push(rect);
            }
        }
    })();
    
    // Methods -- OVERRIDDEN
    
    this.getTileUrl = function(level, x, y) {
        // using array join because it's faster than string concatenation
        return [tilesUrl, level, '/', x, '_', y, '.', tileFormat].join('');
    };
    
    this.tileExists = function(level, x, y) {
        var rects = levelRects[level];
        
        if (!rects || !rects.length) {
            return true;
        }
        
        var scale = self.getLevelScale(level);
        
        for (var i = rects.length - 1; i >= 0; i--) {
            var rect = rects[i];
            
            // check level
            if (level < rect.minLevel || level > rect.maxLevel) {
                continue;
            }
            
            // transform rectangle coordinates to this level
            var xMin = rect.x * scale;
            var yMin = rect.y * scale;
            var xMax = xMin + rect.width * scale;
            var yMax = yMin + rect.height * scale;
            
            // convert to rows and columns -- note that we're ignoring tile
            // overlap, but it's a reasonable approximation. it errs on the side
            // of false positives, which is much better than false negatives.
            xMin = Math.floor(xMin / tileSize);
            yMin = Math.floor(yMin / tileSize);
            xMax = Math.ceil(xMax / tileSize);
            yMax = Math.ceil(yMax / tileSize);
            
            if (xMin <= x && x < xMax && yMin <= y && y < yMax) {
                return true;
            }
        }
        
        return false;
    };
    
};

SeadragonDziTileSource.prototype = new SeadragonTileSource();



(function() {
    
    // Helpers -- Errors
    
    function DziError(message) {
        Error.apply(this, arguments);
        this.message = message;
    }
    
    DziError.prototype = new Error();
    
    function getError(e) {
        if (!(e instanceof DziError)) {
            // shouldn't happen, but if it does, fail fast or at least log it
            SeadragonDebug.error(e.name + " while creating DZI from XML: " + e.message);
            e = new DziError(SeadragonStrings.getString("Errors.Unknown"));
        }
        
        return e;
    }
    
    // Helpers -- URL
    
    function getTilesUrl(xmlUrl) {
        var urlParts = xmlUrl.split('/');
        var filename = urlParts[urlParts.length - 1];
        var lastDot = filename.lastIndexOf('.');
        
        if (lastDot > -1) {
            urlParts[urlParts.length - 1] = filename.slice(0, lastDot);
        }
        
        return urlParts.join('/') + "_files/";
    }
    
    // Helpers -- XML
    
    function processResponse(xhr, tilesUrl) {
        if (!xhr) {
            throw new DziError(SeadragonStrings.getString("Errors.Security"));
        } else if (xhr.status !== 200 && xhr.status !== 0) {
            // chrome has bug where it sends "OK" for 404
            var status = xhr.status;
            var statusText = (status == 404) ? "Not Found" : xhr.statusText;
            throw new DziError(SeadragonStrings.getString("Errors.Status", status, statusText));
        }
        
        var doc = null;
        
        if (xhr.responseXML && xhr.responseXML.documentElement) {
            doc = xhr.responseXML;
        } else if (xhr.responseText)  {
            doc = SeadragonUtils.parseXml(xhr.responseText);
        }
        
        return processXml(doc, tilesUrl);
    }
    
    function processXml(xmlDoc, tilesUrl) {
        if (!xmlDoc || !xmlDoc.documentElement) {
            throw new DziError(SeadragonStrings.getString("Errors.Xml"));
        }
        
        var root = xmlDoc.documentElement;
        var rootName = root.tagName;
        
        if (rootName == "Image") {
            try {
                return processDzi(root, tilesUrl);
            } catch (e) {
                var defMsg = SeadragonStrings.getString("Errors.Dzi");
                throw (e instanceof DziError) ? e : new DziError(defMsg);
            }
        } else if (rootName == "Collection") {
            throw new DziError(SeadragonStrings.getString("Errors.Dzc"));
        } else if (rootName == "Error") {
            return processError(root);
        }
        
        throw new DziError(SeadragonStrings.getString("Errors.Dzi"));
    }
    
    function processDzi(imageNode, tilesUrl) {
        var tileFormat = imageNode.getAttribute("Format");
        
        if (!SeadragonUtils.imageFormatSupported(tileFormat)) {
            throw new DziError(SeadragonStrings.getString("Errors.ImageFormat",
                    tileFormat.toUpperCase()));
        }
        
        var sizeNode = imageNode.getElementsByTagName("Size")[0];
        var dispRectNodes = imageNode.getElementsByTagName("DisplayRect");
        
        var width = parseInt(sizeNode.getAttribute("Width"), 10);
        var height = parseInt(sizeNode.getAttribute("Height"), 10);
        var tileSize = parseInt(imageNode.getAttribute("TileSize"));
        var tileOverlap = parseInt(imageNode.getAttribute("Overlap"));
        var dispRects = [];
        
        for (var i = 0; i < dispRectNodes.length; i++) {
            var dispRectNode = dispRectNodes[i];
            var rectNode = dispRectNode.getElementsByTagName("Rect")[0];
            
            dispRects.push(new SeadragonDisplayRect( 
                parseInt(rectNode.getAttribute("X"), 10),
                parseInt(rectNode.getAttribute("Y"), 10),
                parseInt(rectNode.getAttribute("Width"), 10),
                parseInt(rectNode.getAttribute("Height"), 10),
                // TEMP not sure why we did this -- seems like it's wrong.
                // commenting out the hardcoded 0 and using the XML's value.
                //0,  // ignore MinLevel attribute, bug in Deep Zoom Composer
                parseInt(dispRectNode.getAttribute("MinLevel"), 10),
                parseInt(dispRectNode.getAttribute("MaxLevel"), 10)
            ));
        }
        
        return new SeadragonDziTileSource(width, height, tileSize, tileOverlap,
                tilesUrl, tileFormat, dispRects);
    }
    
    function processError(errorNode) {
        var messageNode = errorNode.getElementsByTagName("Message")[0];
        var message = messageNode.firstChild.nodeValue;
        
        throw new DziError(message);
    }
    
    // Methods -- FACTORIES
    
    SeadragonDziTileSource.getTilesUrl = getTilesUrl;
        // expose this publicly because it's useful for multiple clients
    
    SeadragonDziTileSource.createFromJson = function(jsonObj, callback) {
        var async = typeof(callback) == "function";
        var source, error;
        var dzi = jsonObj;
        
        if (!dzi || (!dzi.url && !dzi.tilesUrl)) {
            error = new DziError(SeadragonStrings.getString("Errors.Empty"));
            
        } else {
            
            try {
                
                var displayRects = dzi.displayRects;
                if (displayRects && displayRects.length) {
                    for (var i = 0, n = displayRects.length; i < n; i++) {
                        var dr = displayRects[i];
                        displayRects[i] = new SeadragonDisplayRect(
                            dr.x || dr[0],
                            dr.y || dr[1],
                            dr.width || dr[2],
                            dr.height || dr[3],
                            dr.minLevel || dr[4],
                            dr.maxLevel || dr[5]
                        );
                    }
                }
                
                source = new SeadragonDziTileSource(
                    dzi.width,
                    dzi.height,
                    dzi.tileSize,
                    dzi.tileOverlap,
                    dzi.tilesUrl || getTilesUrl(dzi.url),
                    dzi.tileFormat,
                    dzi.displayRects
                );
                
                source.xmlUrl = dzi.url;
                
            } catch (e) {
                error = getError(e);
            }
            
        }
        
        if (async) {
            window.setTimeout(SeadragonUtils.createCallback(null, callback, source, error && error.message), 1);
        } else if (error) {
            throw error;
        } else {
            return source;
        }
    };
    
    SeadragonDziTileSource.createFromXml = function(xmlUrl, xmlString, callback) {
        var async = typeof(callback) == "function";
        var error = null;
        
        if (!xmlUrl) {
            error = SeadragonStrings.getString("Errors.Empty");
            if (async) {
                window.setTimeout(function() {
                    callback(null, error);
                }, 1);
                return null;
            }
            throw new DziError(error);
        }
        
        var tilesUrl = getTilesUrl(xmlUrl);
        
        function finish(func, obj) {
            try {
                var source = func(obj, tilesUrl);
                source.xmlUrl = xmlUrl;
                return source;
            } catch (e) {
                if (async) {
                    error = getError(e).message;
                    return null;
                } else {
                    throw getError(e);
                }
            }
        }
        
        if (async) {
            if (xmlString) {
                window.setTimeout(function() {
                    var source = finish(processXml, SeadragonUtils.parseXml(xmlString));
                    callback(source, error);    // call after finish sets error
                }, 1);
            } else {
                SeadragonUtils.makeAjaxRequest(xmlUrl, function(xhr) {
                    var source = finish(processResponse, xhr);
                    callback(source, error);    // call after finish sets error
                });
            }
            
            return null;
        }
        
        // synchronous version
        if (xmlString) {
            return finish(processXml, SeadragonUtils.parseXml(xmlString));
        } else {
            return finish(processResponse, SeadragonUtils.makeAjaxRequest(xmlUrl));
        }
    };
    
})();
