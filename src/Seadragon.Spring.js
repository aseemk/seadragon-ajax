//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonSpring = Seadragon.Spring = function(initialValue) {
    
    // Fields
    
    var currentValue = typeof(initialValue) == "number" ? initialValue : 0;
    var startValue = currentValue;
    var targetValue = currentValue;
    
    var currentTime = new Date().getTime(); // always work in milliseconds
    var startTime = currentTime;
    var targetTime = currentTime;
    
    // Helpers
    
    /**
     * Transform from linear [0,1] to spring [0,1].
     */
    function transform(x) {
        var s = SeadragonConfig.springStiffness;
        return (1.0 - Math.exp(-x * s)) / (1.0 - Math.exp(-s));
    }
    
    // Methods
    
    this.getCurrent = function() {
        return currentValue;
    };
    
    this.getTarget = function() {
        return targetValue;
    };
    
    this.resetTo = function(target) {
        targetValue = target;
        targetTime = currentTime;
        startValue = targetValue;
        startTime = targetTime;
    };
    
    this.springTo = function(target) {
        startValue = currentValue;
        startTime = currentTime;
        targetValue = target;
        targetTime = startTime + 1000 * SeadragonConfig.animationTime;
    };
    
    this.shiftBy = function(delta) {
        startValue += delta;
        targetValue += delta;
    };
    
    this.update = function() {
        currentTime = new Date().getTime();
        currentValue = (currentTime >= targetTime) ? targetValue :
                startValue + (targetValue - startValue) *
                transform((currentTime - startTime) / (targetTime - startTime));
    };
    
};
