//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonViewport = Seadragon.Viewport = function(containerSize, contentSize) {
    
    // Fields
    
    var self = this;
    
    var containerSize = new SeadragonPoint(containerSize.x, containerSize.y); // copy
    var contentAspect = contentSize.x / contentSize.y;
    var contentHeight = contentSize.y / contentSize.x;
    
    var centerSpringX = new SeadragonSpring(0);
    var centerSpringY = new SeadragonSpring(0);
    var zoomSpring = new SeadragonSpring(SeadragonConfig.logarithmicZoom ? 0 : 1);
    var zoomPoint = null;
    
    var homeBounds = new SeadragonRect(0, 0, 1, contentHeight);
    var homeCenter = homeBounds.getCenter();
    
    var LN2 = Math.LN2;
    
    // Helpers
    
    function init() {
        self.goHome(true);
        self.update();
    }
    
    function log2(x) {
        return Math.log(x) / LN2;
    }
    
    function pow2(x) {
        return Math.pow(2, x);
    }
    
    function clamp(x, min, max) {
        return Math.min(Math.max(x, min), max);
    }
    
    function clampPointToRect(point, rect) {
        var xOld = point.x,
            yOld = point.y,
            xNew = clamp(xOld, rect.x, rect.x + rect.width),
            yNew = clamp(yOld, rect.y, rect.y + rect.height);
        
        return (xOld === xNew && yOld === yNew) ? point :
                new SeadragonPoint(xNew, yNew);
    }
    
    function getCenterConstraintRect(current) {
        var zoom = self.getZoom(current),
            width = 1.0 / zoom,
            height = width / self.getAspectRatio(),
            visibilityRatio = SeadragonConfig.visibilityRatio,
            xMin = (visibilityRatio - 0.5) * width,
            yMin = (visibilityRatio - 0.5) * height,
            xDelta = 1.0 - 2 * xMin,
            yDelta = contentHeight - 2 * yMin;
        
        if (xDelta < 0) {
            xMin += (0.5 * xDelta);
            xDelta = 0;
        }
        
        if (yDelta < 0) {
            yMin += (0.5 * yDelta);
            yDelta = 0;
        }
        
        return new Seadragon.Rect(xMin, yMin, xDelta, yDelta);
    }
    
    // Methods -- CONSTRAINT HELPERS
    
    this.getHomeBounds = function () {
        // fit home bounds to viewport's aspect ratio, maintaining center.
        // this is the same logic as in fitBounds().
        
        var viewportAspect = self.getAspectRatio();
        var homeBoundsFit = new SeadragonRect(
            homeBounds.x, homeBounds.y, homeBounds.width, homeBounds.height);
        
        if (contentAspect >= viewportAspect) {
            // width is bigger relative to viewport, resize height
            homeBoundsFit.height = homeBounds.width / viewportAspect;
            homeBoundsFit.y = homeCenter.y - homeBoundsFit.height / 2;
        } else {
            // height is bigger relative to viewport, resize width
            homeBoundsFit.width = homeBounds.height * viewportAspect;
            homeBoundsFit.x = homeCenter.x - homeBoundsFit.width / 2;
        }
        
        return homeBoundsFit;
    };
    
    this.getHomeCenter = function () {
        return homeCenter;
    };

    this.getHomeZoom = function () {
        // if content is wider, we'll fit width, otherwise height
        var aspectFactor = contentAspect / self.getAspectRatio();
        return (aspectFactor >= 1) ? 1 : aspectFactor;
    };
    
    this.getMinCenter = function (current) {
        return getCenterConstraintRect(current).getTopLeft();
    };
    
    this.getMaxCenter = function (current) {
        return getCenterConstraintRect(current).getBottomRight();
    };

    this.getMinZoom = function () {
        var homeZoom = self.getHomeZoom();

        // for backwards compatibility, respect minZoomDimension if present
        if (SeadragonConfig.minZoomDimension) {
            var zoom = (contentSize.x <= contentSize.y) ?
                SeadragonConfig.minZoomDimension / containerSize.x :
                SeadragonConfig.minZoomDimension / (containerSize.x * contentHeight);
        } else {
            var zoom = SeadragonConfig.minZoomImageRatio * homeZoom;
        }

        return Math.min(zoom, homeZoom);
    };

    this.getMaxZoom = function () {
        var zoom = contentSize.x * SeadragonConfig.maxZoomPixelRatio / containerSize.x;
        return Math.max(zoom, self.getHomeZoom());
    };
        
    // Methods -- ACCESSORS

    this.getAspectRatio = function () {
        return containerSize.x / containerSize.y;
    };
    
    this.getContainerSize = function() {
        return new SeadragonPoint(containerSize.x, containerSize.y);
    };
    
    this.getBounds = function(current) {
        var center = self.getCenter(current);
        var width = 1.0 / self.getZoom(current);
        var height = width / self.getAspectRatio();
        
        return new SeadragonRect(center.x - width / 2.0, center.y - height / 2.0,
            width, height);
    };
    
    this.getCenter = function(current) {
        var centerCurrent = new SeadragonPoint(
            centerSpringX.getCurrent(), centerSpringY.getCurrent());
        var centerTarget = new SeadragonPoint(
            centerSpringX.getTarget(), centerSpringY.getTarget());
        
        if (current) {
            return centerCurrent;
        } else if (!zoomPoint) {
            // no adjustment necessary since we're not zooming
            return centerTarget;
        }
        
        // to get the target center, we need to adjust for the zoom point.
        // we'll do this in the same way as the update() method.
        
        // manually calculate bounds based on this unadjusted target center.
        // this is mostly a duplicate of getBounds() above. note that this is
        // based on the TARGET zoom but the CURRENT center.
        var zoom = self.getZoom();
        var width = 1.0 / zoom;
        var height = width / self.getAspectRatio();
        var bounds = new SeadragonRect(
            centerCurrent.x - width / 2.0,
            centerCurrent.y - height / 2.0,
            width,
            height
        );
        
        // the conversions here are identical to the pixelFromPoint() and
        // deltaPointsFromPixels() methods.
        var oldZoomPixel = self.pixelFromPoint(zoomPoint, true);
        var newZoomPixel = zoomPoint.minus(bounds.getTopLeft()).times(containerSize.x / bounds.width);
        var deltaZoomPixels = newZoomPixel.minus(oldZoomPixel);
        var deltaZoomPoints = deltaZoomPixels.divide(containerSize.x * zoom);
        
        // finally, shift center to negate the change.
        return centerTarget.plus(deltaZoomPoints);
    };
    
    this.getZoom = function(current) {
        var zoom;
        if (current) {
            zoom = zoomSpring.getCurrent();
            return SeadragonConfig.logarithmicZoom ? pow2(zoom) : zoom;
        } else {
            zoom = zoomSpring.getTarget();
            return SeadragonConfig.logarithmicZoom ? pow2(zoom) : zoom;
        }
    };
    
    // Methods -- MODIFIERS
    
    this.applyConstraints = function(immediately) {
        // first, apply zoom constraints
        var oldZoom = self.getZoom();
        var newZoom = clamp(oldZoom, self.getMinZoom(), self.getMaxZoom());
        if (oldZoom != newZoom) {
            self.zoomTo(newZoom, zoomPoint, immediately);
        }
        
        // then, apply pan constraints -- but do so via fitBounds() in order to
        // account for (and adjust) the zoom point! also ignore constraints if
        // content is being wrapped! but differentiate horizontal vs. vertical.
        var oldCenter = self.getCenter();
        var newCenter = clampPointToRect(oldCenter, getCenterConstraintRect());
        if (SeadragonConfig.wrapHorizontal) {
            newCenter.x = oldCenter.x;
        }
        if (SeadragonConfig.wrapVertical) {
            newCenter.y = oldCenter.y;
        }
        if (!oldCenter.equals(newCenter)) {
            var width = 1.0 / newZoom,
                height = width / self.getAspectRatio();
            self.fitBounds(new SeadragonRect(
                newCenter.x - 0.5 * width,
                newCenter.y - 0.5 * height,
                width,
                height
            ), immediately);
        }
    };
    
    this.ensureVisible = function(immediately) {
        // for backwards compatibility
        self.applyConstraints(immediately);
    };
    
    this.fitBounds = function(bounds, immediately) {
        var aspect = self.getAspectRatio();
        var center = bounds.getCenter();
        
        // resize bounds to match viewport's aspect ratio, maintaining center.
        // note that zoom = 1/width, and width = height*aspect.
        var newBounds = new SeadragonRect(bounds.x, bounds.y, bounds.width, bounds.height);
        if (newBounds.getAspectRatio() >= aspect) {
            // width is bigger relative to viewport, resize height
            newBounds.height = bounds.width / aspect;
            newBounds.y = center.y - newBounds.height / 2;
        } else {
            // height is bigger relative to viewport, resize width
            newBounds.width = bounds.height * aspect;
            newBounds.x = center.x - newBounds.width / 2;
        }
        
        // stop movement first! this prevents the operation from missing
        self.panTo(self.getCenter(true), true);
        self.zoomTo(self.getZoom(true), null, true);
        
        // capture old values for bounds and width. we need both, but we'll
        // also use both for redundancy, to protect against precision errors.
        // note: use target bounds, since update() hasn't been called yet!
        var oldBounds = self.getBounds();
        var oldZoom = self.getZoom();
        
        // if we're already at the correct zoom, just pan and we're done.
        // we'll check both zoom and bounds for redundancy, to protect against
        // precision errors (see note below).
        var newZoom = 1.0 / newBounds.width;
        if (newZoom == oldZoom || newBounds.width == oldBounds.width) {
            self.panTo(center, immediately);
            return;
        }
        
        // otherwise, we need to zoom about the only point whose pixel transform
        // is constant between the old and new bounds. this is just tricky math.
        var refPoint = oldBounds.getTopLeft().times(containerSize.x / oldBounds.width).minus(
                newBounds.getTopLeft().times(containerSize.x / newBounds.width)).divide(
                containerSize.x / oldBounds.width - containerSize.x / newBounds.width);
        
        // note: that last line (cS.x / oldB.w - cS.x / newB.w) was causing a
        // divide by 0 in the case that oldBounds.width == newBounds.width.
        // that should have been picked up by the zoom check, but in certain
        // cases, the math is slightly off and the zooms are different. so now,
        // the zoom check has an extra check added.
        
        self.zoomTo(newZoom, refPoint, immediately);
    };
   
    this.goHome = function(immediately) {
        // calculate center adjusted for zooming
        var center = self.getCenter();
        
        // if we're wrapping horizontally, "unwind" the horizontal spring
        if (SeadragonConfig.wrapHorizontal) {
            // this puts center.x into the range [0, 1) always
            center.x = (1 + (center.x % 1)) % 1;
            centerSpringX.resetTo(center.x);
            centerSpringX.update();
        }
        
        // if we're wrapping vertically, "unwind" the vertical spring
        if (SeadragonConfig.wrapVertical) {
            // this puts center.y into the range e.g. [0, 0.75) always
            center.y = (contentHeight + (center.y % contentHeight)) % contentHeight;
            centerSpringY.resetTo(center.y);
            centerSpringY.update();
        }
        
        self.fitBounds(homeBounds, immediately);
    };
    
    this.panBy = function(delta, immediately) {
        self.panTo(self.getCenter().plus(delta), immediately);
    };
    
    this.panTo = function(center, immediately) {
        // we have to account for zoomPoint here, i.e. if we're in the middle
        // of a zoom about some point and panTo() is called, we should be
        // spring to some center that will get us to the specified center.
        // the logic here is thus the exact inverse of the getCenter() method.
        
        if (immediately) {
            centerSpringX.resetTo(center.x);
            centerSpringY.resetTo(center.y);
            return;
        }
        
        if (!zoomPoint) {
            centerSpringX.springTo(center.x);
            centerSpringY.springTo(center.y);
            return;
        }
                
        // manually calculate bounds based on this unadjusted target center.
        // this is mostly a duplicate of getBounds() above. note that this is
        // based on the TARGET zoom but the CURRENT center.
        var zoom = self.getZoom();
        var width = 1.0 / zoom;
        var height = width / self.getAspectRatio();
        var bounds = new SeadragonRect(
            centerSpringX.getCurrent() - width / 2.0,
            centerSpringY.getCurrent() - height / 2.0,
            width,
            height
        );
        
        // the conversions here are identical to the pixelFromPoint() and
        // deltaPointsFromPixels() methods.
        var oldZoomPixel = self.pixelFromPoint(zoomPoint, true);
        var newZoomPixel = zoomPoint.minus(bounds.getTopLeft()).times(containerSize.x / bounds.width);
        var deltaZoomPixels = newZoomPixel.minus(oldZoomPixel);
        var deltaZoomPoints = deltaZoomPixels.divide(containerSize.x * zoom);
        
        // finally, shift center to negate the change.
        var centerTarget = center.minus(deltaZoomPoints);
        
        centerSpringX.springTo(centerTarget.x);
        centerSpringY.springTo(centerTarget.y);
    };
    
    this.zoomBy = function(factor, refPoint, immediately) {
        self.zoomTo(self.getZoom() * factor, refPoint, immediately);
    };
    
    this.zoomTo = function(zoom, refPoint, immediately) {
        // we used to constrain zoom automatically here; now it needs to be
        // explicitly constrained, via applyConstraints().
        //zoom = clamp(zoom, self.getMinZoom(), self.getMaxZoom());
        
        if (immediately) {
            zoomSpring.resetTo(SeadragonConfig.logarithmicZoom ? log2(zoom) : zoom);
        } else {
            zoomSpring.springTo(SeadragonConfig.logarithmicZoom ? log2(zoom) : zoom);
        }
        
        zoomPoint = refPoint instanceof SeadragonPoint ? refPoint : null;
    };
    
    this.resize = function(newContainerSize, maintain) {
        // default behavior: just ensure the visible content remains visible.
        // note that this keeps the center (relative to the content) constant.
        var oldBounds = self.getBounds();
        var newBounds = oldBounds;
        var widthDeltaFactor = newContainerSize.x / containerSize.x;
        
        // update container size, but make copy first
        containerSize = new SeadragonPoint(newContainerSize.x, newContainerSize.y);
        
        if (maintain) {
            // no resize relative to screen, resize relative to viewport.
            // keep origin constant, zoom out (increase bounds) by delta factor.
            newBounds.width = oldBounds.width * widthDeltaFactor;
            newBounds.height = newBounds.width / self.getAspectRatio(); 
        }
        
        self.fitBounds(newBounds, true);
    };
    
    this.update = function() {
        var oldCenterX = centerSpringX.getCurrent();
        var oldCenterY = centerSpringY.getCurrent();
        var oldZoom = zoomSpring.getCurrent();
        
        // remember position of zoom point
        if (zoomPoint) {
            var oldZoomPixel = self.pixelFromPoint(zoomPoint, true);
        }
        
        // now update zoom only, don't update pan yet
        zoomSpring.update();
        
        // adjust for change in position of zoom point, if we've zoomed
        if (zoomPoint && zoomSpring.getCurrent() != oldZoom) {
            var newZoomPixel = self.pixelFromPoint(zoomPoint, true);
            var deltaZoomPixels = newZoomPixel.minus(oldZoomPixel);
            var deltaZoomPoints = self.deltaPointsFromPixels(deltaZoomPixels, true);
            
            // shift pan to negate the change
            centerSpringX.shiftBy(deltaZoomPoints.x);
            centerSpringY.shiftBy(deltaZoomPoints.y);
        } else {
            // don't try to adjust next time; this improves performance
            zoomPoint = null;
        }
        
        // now after adjustment, update pan
        centerSpringX.update();
        centerSpringY.update();
        
        return centerSpringX.getCurrent() != oldCenterX ||
                centerSpringY.getCurrent() != oldCenterY ||
                zoomSpring.getCurrent() != oldZoom;
    };
    
    // Methods -- CONVERSION HELPERS
    
    this.deltaPixelsFromPoints = function(deltaPoints, current) {
        return deltaPoints.times(containerSize.x * self.getZoom(current));
    };
    
    this.deltaPointsFromPixels = function(deltaPixels, current) {
        return deltaPixels.divide(containerSize.x * self.getZoom(current));
    };
    
    this.pixelFromPoint = function(point, current) {
        var bounds = self.getBounds(current);
        return point.minus(bounds.getTopLeft()).times(containerSize.x / bounds.width);
    };
    
    this.pointFromPixel = function(pixel, current) {
        var bounds = self.getBounds(current);
        return pixel.divide(containerSize.x / bounds.width).plus(bounds.getTopLeft());
    };
    
    // Constructor
    
    init();
    
};
