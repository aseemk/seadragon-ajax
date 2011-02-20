//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonTileSource = Seadragon.TileSource = function(
        width, height, tileSize, tileOverlap, minLevel, maxLevel) {
    
    // Fields
    
    var self = this;
    var normHeight = height / width;
    
    // Properties
    
    this.width = width;
    this.height = height;
    this.aspectRatio = width / height;
    this.dimensions = new SeadragonPoint(width, height);
    this.minLevel = minLevel ? minLevel : 0;
    this.maxLevel = maxLevel ? maxLevel :
            Math.ceil(Math.log(Math.max(width, height)) / Math.log(2));
    this.tileSize = tileSize ? tileSize : 0;
    this.tileOverlap = tileOverlap ? tileOverlap : 0;
    
    // Methods
    
    this.getLevelScale = function(level) {
        // equivalent to Math.pow(0.5, numLevels - level);
        return 1 / (1 << (self.maxLevel - level));
    };
    
    this.getNumTiles = function(level) {
        var scale = self.getLevelScale(level);
        var x = Math.ceil(scale * width / self.tileSize);
        var y = Math.ceil(scale * height / self.tileSize);
        
        return new SeadragonPoint(x, y);
    };
    
    this.getPixelRatio = function(level) {
        var imageSizeScaled = self.dimensions.times(self.getLevelScale(level));
        var rx = 1.0 / imageSizeScaled.x;
        var ry = 1.0 / imageSizeScaled.y;
        
        return new SeadragonPoint(rx, ry);
    };
    
    this.getTileAtPoint = function(level, point) {
        // support wrapping by taking less-than-full tiles into account!
        // this is necessary in order to properly wrap low-res tiles.
        var scaledSize = self.dimensions.times(self.getLevelScale(level));
        var pixel = point.times(scaledSize.x);
        var tx, ty;
        
        // optimize for the non-wrapping case, but support wrapping
        if (point.x >= 0.0 && point.x <= 1.0) {
            tx = Math.floor(pixel.x / self.tileSize);
        } else {
            tx = Math.ceil(scaledSize.x / self.tileSize) * Math.floor(pixel.x / scaledSize.x) +
                    Math.floor(((scaledSize.x + (pixel.x % scaledSize.x)) % scaledSize.x) / self.tileSize);
        }
        
        // same thing vertically
        if (point.y >= 0.0 && point.y <= normHeight) {
            ty = Math.floor(pixel.y / self.tileSize);
        } else {
            ty = Math.ceil(scaledSize.y / self.tileSize) * Math.floor(pixel.y / scaledSize.y) +
                    Math.floor(((scaledSize.y + (pixel.y % scaledSize.y)) % scaledSize.y) / self.tileSize);
        }
        
        return new SeadragonPoint(tx, ty);
    };
    
    this.getTileBounds = function(level, x, y) {
        // work in scaled pixels for this level
        var dimensionsScaled = self.dimensions.times(self.getLevelScale(level));
        
        // find position, adjust for no overlap data on top and left edges
        var px = (x === 0) ? 0 : self.tileSize * x - self.tileOverlap;
        var py = (y === 0) ? 0 : self.tileSize * y - self.tileOverlap;
        
        // find size, adjust for no overlap data on top and left edges
        var sx = self.tileSize + (x === 0 ? 1 : 2) * self.tileOverlap;
        var sy = self.tileSize + (y === 0 ? 1 : 2) * self.tileOverlap;
        
        // adjust size for single-tile levels where the image size is smaller
        // than the regular tile size, and for tiles on the bottom and right
        // edges that would exceed the image bounds
        sx = Math.min(sx, dimensionsScaled.x - px);
        sy = Math.min(sy, dimensionsScaled.y - py);
        
        // finally, normalize...
        // note that isotropic coordinates ==> only dividing by scaled x!
        var scale = 1.0 / dimensionsScaled.x;
        return new SeadragonRect(px * scale, py * scale, sx * scale, sy * scale);
    };
    
    this.getTileUrl = function(level, x, y) {
        throw new Error("Method not implemented.");
    };
    
    this.tileExists = function(level, x, y) {
        var numTiles = self.getNumTiles(level);
        return level >= self.minLevel && level <= self.maxLevel &&
                x >= 0 && y >= 0 && x < numTiles.x && y < numTiles.y;
    };
    
};
