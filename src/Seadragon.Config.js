//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonConfig = Seadragon.Config;

(function() {
    
    // DUPLICATION CHECK -- necessary to prevent overwriting user changes
    if (SeadragonConfig) {
        return;
    }

    SeadragonConfig = Seadragon.Config = {
        
        debugMode: false,
        
        animationTime: 1.5,
        
        blendTime: 0.5,
        
        alwaysBlend: false,
        
        autoHideControls: true,
        
        constrainDuringPan: true,
        
        immediateRender: false,
        
        logarithmicZoom: true,
        
        wrapHorizontal: false,
        
        wrapVertical: false,
        
        wrapOverlays: false,
        
        transformOverlays: false,
        
        // for backwards compatibility, keeping this around and defaulting to null.
        // if it ever has a non-null value, that means it was explicitly set.
        minZoomDimension: null,
        
        minZoomImageRatio: 0.8,
        
        maxZoomPixelRatio: 2,
        
        visibilityRatio: 0.8,
        
        springStiffness: 5.0,
        
        imageLoaderLimit: 2, 
        
        clickTimeThreshold: 200,
        
        clickDistThreshold: 5,
        
        zoomPerClick: 2.0,
        
        zoomPerScroll: Math.pow(2, 1/3),
        
        zoomPerSecond: 2.0,
        
        proxyUrl: null,
        
        imagePath: "img/"
        
    };

})();
