//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonProfiler = Seadragon.Profiler = function() {
    
    // Fields
    
    var self = this;
    
    var midUpdate = false;
    var numUpdates = 0;
    
    var lastBeginTime = null;
    var lastEndTime = null;
    
    var minUpdateTime = Infinity;
    var avgUpdateTime = 0;
    var maxUpdateTime = 0;
    
    var minIdleTime = Infinity;
    var avgIdleTime = 0;
    var maxIdleTime = 0;
    
    // Methods -- UPDATE TIME ACCESSORS
    
    this.getAvgUpdateTime = function() {
        return avgUpdateTime;
    };
    
    this.getMinUpdateTime = function() {
        return minUpdateTime;
    };
    
    this.getMaxUpdateTime = function() {
        return maxUpdateTime;
    };
    
    // Methods -- IDLING TIME ACCESSORS
    
    this.getAvgIdleTime = function() {
        return avgIdleTime;
    };
    
    this.getMinIdleTime = function() {
        return minIdleTime;
    };
    
    this.getMaxIdleTime = function() {
        return maxIdleTime;
    };
    
    // Methods -- GENERAL ACCESSORS 
    
    this.isMidUpdate = function() {
        return midUpdate;
    };
    
    this.getNumUpdates = function() {
        return numUpdates;
    };
    
    // Methods -- MODIFIERS
    
    this.beginUpdate = function() {
        if (midUpdate) {
            self.endUpdate();
        }
        
        midUpdate = true;
        lastBeginTime = new Date().getTime();
        
        if (numUpdates <1) {
            return;     // this is the first update
        }
        
        var time = lastBeginTime - lastEndTime;
        
        avgIdleTime = (avgIdleTime * (numUpdates - 1) + time) / numUpdates;
        
        if (time < minIdleTime) {
            minIdleTime = time;
        }
        if (time > maxIdleTime) {
            maxIdleTime = time;
        }
    };
    
    this.endUpdate = function() {        if (!midUpdate) {
            return;
        }
        
        lastEndTime = new Date().getTime();
        midUpdate = false;
        
        var time = lastEndTime - lastBeginTime;
        
        numUpdates++;
        avgUpdateTime = (avgUpdateTime * (numUpdates - 1) + time) / numUpdates;
        
        if (time < minUpdateTime) {
            minUpdateTime = time;
        }
        if (time > maxUpdateTime) {
            maxUpdateTime = time;
        }
    };
    
    this.clearProfile = function() {
        midUpdate = false;
        numUpdates = 0;
        
        lastBeginTime = null;
        lastEndTime = null;
        
        minUpdateTime = Infinity;
        avgUpdateTime = 0;
        maxUpdateTime = 0;
        
        minIdleTime = Infinity;
        avgIdleTime = 0;
        maxIdleTime = 0;
    };
    
};
