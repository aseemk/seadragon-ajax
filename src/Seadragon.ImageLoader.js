//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonImageLoader;

(function() {
    
    var TIMEOUT = 15000;     // milliseconds after which an image times out
    
    function Job(src, callback) {
        
        // Fields
        
        var image = null;
        var timeout = null;     // IE8 fix: no finishing event raised sometimes
        
        // Helpers
        
        function finish(success) {
            image.onload = null;
            image.onabort = null;
            image.onerror = null;
            
            if (timeout) {
                window.clearTimeout(timeout);
            }
            
            // call on a timeout to ensure asynchronous behavior
            window.setTimeout(function() {
                callback(src, success ? image : null);
            }, 1);
        }
        
        // Methods
        
        this.start = function() {
            image = new Image();
            
            var successFunc = function() { finish(true); };
            var failureFunc = function() { finish(false); };
            var timeoutFunc = function() {
                SeadragonDebug.log("Image timed out: " + src);
                finish(false);
            };
            
            image.onload = successFunc;
            image.onabort = failureFunc;
            image.onerror = failureFunc;
            
            // consider it a failure if the image times out.
            timeout = window.setTimeout(timeoutFunc, TIMEOUT);
            
            image.src = src;
        };
        
    }
    
    SeadragonImageLoader = Seadragon.ImageLoader = function() {
        
        // Fields
        
        var downloading = 0;    // number of Jobs currently downloading
        
        // Helpers
        
        function onComplete(callback, src, image) {
            downloading--;
            if (typeof(callback) == "function") {
                try {
                    callback(image);
                } catch (e) {
                    SeadragonDebug.error(e.name +  " while executing " + src +
                            " callback: " + e.message, e);
                }
            }
        }
        
        // Methods
        
        this.loadImage = function(src, callback) {
            if (downloading >= SeadragonConfig.imageLoaderLimit) {
                return false;
            }
            
            var func = SeadragonUtils.createCallback(null, onComplete, callback);
            var job = new Job(src, func);
            
            downloading++;
            job.start();
            
            return true;
        };
        
    };

})();
