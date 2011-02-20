//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonDisplayRect = Seadragon.DisplayRect = function(x, y, width, height, minLevel, maxLevel) {
    
    // Inheritance
    
    SeadragonRect.apply(this, arguments);
    
    // Properties (extended)
    
    this.minLevel = minLevel;
    this.maxLevel = maxLevel;
    
};

SeadragonDisplayRect.prototype = new SeadragonRect();
