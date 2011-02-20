//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonViewer,
    SeadragonControlAnchor;

(function() {
    
    // Constants
    
    var SIGNAL = "----seadragon----";
    
    // Private static
    
    var browser = SeadragonUtils.getBrowser();
    
    // Controls
    
    SeadragonControlAnchor = Seadragon.ControlAnchor = {
        NONE: 0,
        TOP_LEFT: 1,
        TOP_RIGHT: 2,
        BOTTOM_RIGHT: 3,
        BOTTOM_LEFT: 4
    };
    
    /**
     * Adds the given element to the given container based on the given anchor,
     * such that all new elements anchored to a right edge are shown to the left
     * of existing elements anchored to the same edge.
     */
    function addToAnchor(elmt, anchor, container) {
        if (anchor == SeadragonControlAnchor.TOP_RIGHT || anchor == SeadragonControlAnchor.BOTTOM_RIGHT) {
            container.insertBefore(elmt, container.firstChild);
        } else {
            container.appendChild(elmt);
        }
    }
    
    function Control(elmt, anchor, container) {
        // Fields
        var wrapper = SeadragonUtils.makeNeutralElement("span");
        
        // Properties
        this.elmt = elmt;
        this.anchor = anchor;
        this.container = container;
        this.wrapper = wrapper;
        
        // Constructor
        wrapper.style.display = "inline-block";
        wrapper.appendChild(elmt);
        if (anchor == SeadragonControlAnchor.NONE) {
            wrapper.style.width = wrapper.style.height = "100%";    // IE6 fix
        }
        
        addToAnchor(wrapper, anchor, container);
    }
    
    Control.prototype.destroy = function() {
        this.wrapper.removeChild(this.elmt);
        this.container.removeChild(this.wrapper);
    };
    
    Control.prototype.isVisible = function() {
        // see note in setVisible() below about using "display: none"
        return this.wrapper.style.display != "none";
    };
    
    Control.prototype.setVisible = function(visible) {
        // using "display: none" instead of "visibility: hidden" so that mouse
        // events are no longer blocked by this invisible control.
        this.wrapper.style.display = visible ? "inline-block" : "none";
    };
    
    Control.prototype.setOpacity = function(opacity) {
        // like with setVisible() above, we really should be working with the
        // wrapper element and not the passed in element directly, so that we
        // don't conflict with the developer's own opacity settings. but this
        // doesn't work in IE always, so for our controls, use a hack for now...
        if (this.elmt[SIGNAL] && browser == SeadragonBrowser.IE) {
            SeadragonUtils.setElementOpacity(this.elmt, opacity, true);
        } else {
            SeadragonUtils.setElementOpacity(this.wrapper, opacity, true);
        }
    }
    
    // Navigation control
    
    var FULL_PAGE = "fullpage";
    var HOME = "home";
    var ZOOM_IN = "zoomin";
    var ZOOM_OUT = "zoomout";
    
    var REST = "_rest.png";
    var GROUP = "_grouphover.png";
    var HOVER = "_hover.png";
    var DOWN = "_pressed.png";
    
    function makeNavControl(viewer) {
        var group = null;
        var zooming = false;    // whether we should be continuously zooming
        var zoomFactor = null;  // how much we should be continuously zooming by
        var lastZoomTime = null;
        
        function onHome() {
            if (viewer.viewport) {
                viewer.viewport.goHome();
            }
        }
        
        function onFullPage() {
            viewer.setFullPage(!viewer.isFullPage());
            group.emulateExit();  // correct for no mouseout event on change
            
            if (viewer.viewport) {
                viewer.viewport.applyConstraints();
            }
        }
        
        function beginZoomingIn() {
            lastZoomTime = new Date().getTime();
            zoomFactor = SeadragonConfig.zoomPerSecond;
            zooming = true;
            scheduleZoom();
        }
        
        function beginZoomingOut() {
            lastZoomTime = new Date().getTime();
            zoomFactor = 1.0 / SeadragonConfig.zoomPerSecond;
            zooming = true;
            scheduleZoom();
        }
        
        function endZooming() {
            zooming = false;
        }
        
        function scheduleZoom() {
            window.setTimeout(doZoom, 10);
        }
        
        function doZoom() {
            if (zooming && viewer.viewport) {
                var currentTime = new Date().getTime();
                var deltaTime = currentTime - lastZoomTime;
                var adjustedFactor = Math.pow(zoomFactor, deltaTime / 1000);
                
                viewer.viewport.zoomBy(adjustedFactor);
                viewer.viewport.applyConstraints();
                lastZoomTime = currentTime;
                scheduleZoom();
            }
        }
        
        function doSingleZoomIn() {
            if (viewer.viewport) {
                zooming = false;
                viewer.viewport.zoomBy(SeadragonConfig.zoomPerClick / 1.0);
                viewer.viewport.applyConstraints();
            }
        }
        
        function doSingleZoomOut() {
            if (viewer.viewport) {
                zooming = false;
                viewer.viewport.zoomBy(1.0 / SeadragonConfig.zoomPerClick);
                viewer.viewport.applyConstraints();
            }
        }
        
        function lightUp() {
            group.emulateEnter();
            group.emulateExit();
        }
        
        function url(prefix, postfix) {
            return SeadragonConfig.imagePath + prefix + postfix; 
        }
        
        var zoomIn = new SeadragonButton(SeadragonStrings.getString("Tooltips.ZoomIn"),
                url(ZOOM_IN, REST), url(ZOOM_IN, GROUP), url(ZOOM_IN, HOVER),
                url(ZOOM_IN, DOWN), beginZoomingIn, endZooming, doSingleZoomIn,
                beginZoomingIn, endZooming);
        
        var zoomOut = new SeadragonButton(SeadragonStrings.getString("Tooltips.ZoomOut"),
                url(ZOOM_OUT, REST), url(ZOOM_OUT, GROUP), url(ZOOM_OUT, HOVER),
                url(ZOOM_OUT, DOWN), beginZoomingOut, endZooming, doSingleZoomOut,
                beginZoomingOut, endZooming);
        
        var goHome = new SeadragonButton(SeadragonStrings.getString("Tooltips.Home"),
                url(HOME, REST), url(HOME, GROUP), url(HOME, HOVER),
                url(HOME, DOWN), null, onHome, null, null, null);
        
        var fullPage = new SeadragonButton(SeadragonStrings.getString("Tooltips.FullPage"),
                url(FULL_PAGE, REST), url(FULL_PAGE, GROUP), url(FULL_PAGE, HOVER),
                url(FULL_PAGE, DOWN), null, onFullPage, null, null, null);
        
        group = new SeadragonButtonGroup([zoomIn, zoomOut, goHome, fullPage]);
        group.elmt[SIGNAL] = true;   // hack to get our controls to fade
        
        viewer.addEventListener("open", lightUp);
        
        return group.elmt;
    }
    
    // Viewer
    
    SeadragonViewer = Seadragon.Viewer = function(container) {
        
        // Fields
        
        var self = this;
        
        var parent = SeadragonUtils.getElement(container);
        var container = SeadragonUtils.makeNeutralElement("div");
        var canvas = SeadragonUtils.makeNeutralElement("div");
        
        var controlsTL = SeadragonUtils.makeNeutralElement("div");
        var controlsTR = SeadragonUtils.makeNeutralElement("div");
        var controlsBR = SeadragonUtils.makeNeutralElement("div");
        var controlsBL = SeadragonUtils.makeNeutralElement("div");
        
        var source = null;
        var drawer = null;
        var viewport = null;
        var profiler = null;
        
        var eventManager = new SeadragonEventManager();
        var innerTracker = new SeadragonMouseTracker(canvas);
        var outerTracker = new SeadragonMouseTracker(container);
        
        var controls = [];
        var controlsShouldFade = true;
        var controlsFadeBeginTime = null;
        var navControl = null;
        
        var controlsFadeDelay = 1000;   // begin fading after 1 second
        var controlsFadeLength = 2000;  // fade over 2 second period
        var controlsFadeBeginTime = null;
        var controlsShouldFade = false;
        
        var bodyWidth = document.body.style.width;
        var bodyHeight = document.body.style.height;
        var bodyOverflow = document.body.style.overflow;
        var docOverflow = document.documentElement.style.overflow;
        
        var fsBoundsDelta = new SeadragonPoint(1, 1);
        var prevContainerSize = null;
        
        var lastOpenStartTime = 0;
        var lastOpenEndTime = 0;
        
        var mouseDownPixel = null;
        var mouseDownCenter = null;
        
        var animating = false;
        var forceRedraw = false;
        var mouseInside = false;
        
        // Properties
        
        this.container = parent;
        this.elmt = container;
        
        this.source = null;
        this.drawer = null;
        this.viewport = null;
        this.profiler = null;
        
        this.tracker = innerTracker;
        
        // Helpers -- UI
        
        function initialize() {
            // copy style objects to improve perf
            var canvasStyle = canvas.style;
            var containerStyle = container.style;
            var controlsTLStyle = controlsTL.style;
            var controlsTRStyle = controlsTR.style;
            var controlsBRStyle = controlsBR.style;
            var controlsBLStyle = controlsBL.style;
            
            containerStyle.width = "100%";
            containerStyle.height = "100%";
            containerStyle.position = "relative";
            containerStyle.left = "0px";
            containerStyle.top = "0px";
            containerStyle.textAlign = "left";  // needed to protect against
                                                // incorrect centering
            
            canvasStyle.width = "100%";
            canvasStyle.height = "100%";
            canvasStyle.overflow = "hidden";
            canvasStyle.position = "absolute";
            canvasStyle.top = "0px";
            canvasStyle.left = "0px";
            
            controlsTLStyle.position = controlsTRStyle.position =
                    controlsBRStyle.position = controlsBLStyle.position =
                    "absolute";
            
            controlsTLStyle.top = controlsTRStyle.top = "0px";
            controlsTLStyle.left = controlsBLStyle.left = "0px";
            controlsTRStyle.right = controlsBRStyle.right = "0px";
            controlsBLStyle.bottom = controlsBRStyle.bottom = "0px";
            
            // mouse tracker handler for canvas (pan and zoom)
            innerTracker.clickHandler = onCanvasClick;
            innerTracker.pressHandler = onCanvasPress;
            innerTracker.dragHandler = onCanvasDrag;
            innerTracker.releaseHandler = onCanvasRelease;
            innerTracker.scrollHandler = onCanvasScroll;
            innerTracker.setTracking(true);     // default state
            
            // create default navigation control
            navControl = makeNavControl(self);
            navControl.style.marginRight = "4px";
            navControl.style.marginBottom = "4px";
            self.addControl(navControl, SeadragonControlAnchor.BOTTOM_RIGHT);
            
            // mouse tracker handler for container (controls fading)
            outerTracker.enterHandler = onContainerEnter;
            outerTracker.exitHandler = onContainerExit;
            outerTracker.releaseHandler = onContainerRelease;
            outerTracker.setTracking(true); // always tracking
            window.setTimeout(beginControlsAutoHide, 1);    // initial fade out
            
            //append to DOM only at end
            container.appendChild(canvas);
            container.appendChild(controlsTL);
            container.appendChild(controlsTR);
            container.appendChild(controlsBR);
            container.appendChild(controlsBL);
            parent.innerHTML = "";          // clear any existing content...
            parent.appendChild(container);  // ...then add the real container
        }
        
        function setMessage(message) {
            var textNode = document.createTextNode(message);
            
            canvas.innerHTML = "";
            canvas.appendChild(SeadragonUtils.makeCenteredNode(textNode));
            
            var textStyle = textNode.parentNode.style;
            
            // explicit styles for error message
            //textStyle.color = "white";    // TEMP uncommenting this; very obtrusive
            textStyle.fontFamily = "verdana";
            textStyle.fontSize = "13px";
            textStyle.fontSizeAdjust = "none";
            textStyle.fontStyle = "normal";
            textStyle.fontStretch = "normal";
            textStyle.fontVariant = "normal";
            textStyle.fontWeight = "normal";
            textStyle.lineHeight = "1em";
            textStyle.textAlign = "center";
            textStyle.textDecoration = "none";
        }
        
        // Helpers -- CORE
        
        function beforeOpen() {
            if (source) {
                onClose();
            }
            
            lastOpenStartTime = new Date().getTime();   // to ignore earlier opens
            
            // show loading message after a delay if it still hasn't loaded
            window.setTimeout(function() {
                if (lastOpenStartTime > lastOpenEndTime) {
                    setMessage(SeadragonStrings.getString("Messages.Loading"));
                }
            }, 2000);
            
            return lastOpenStartTime;
        }
        
        function onOpen(time, _source, error) {
            lastOpenEndTime = new Date().getTime();
            
            if (time < lastOpenStartTime) {
                SeadragonDebug.log("Ignoring out-of-date open.");
                eventManager.trigger("ignore", self);
                return;
            } else if (!_source) {
                setMessage(error);
                eventManager.trigger("error", self);
                return;
            }
            
            // clear any previous message
            canvas.innerHTML = "";
            prevContainerSize = SeadragonUtils.getElementSize(container);
            
            // UPDATE: if the container is collapsed, we should delay opening
            // since we don't know yet what the home zoom should be, so opening
            // when the container gets layout will allow us to gracefully and
            // correctly start at home. this also prevents viewport NaN values.
            // what timeout value should we use? it's arbitrary, but given that
            // this generally only occurs in embed scenarios where the image is
            // opened before the page has even finished loading, we'll use very
            // small timeout values to be crisp and responsive. note that this
            // polling is necessary; there is no good cross-browser event here.
            if (prevContainerSize.x === 0 || prevContainerSize.y === 0) {
                window.setTimeout(function () {
                    onOpen(time, _source, error);
                }, 10);
                return;
            }
            
            // assign fields
            source = _source;
            viewport = new SeadragonViewport(prevContainerSize, source.dimensions);
            drawer = new SeadragonDrawer(source, viewport, canvas);
            profiler = new SeadragonProfiler();
            
            // assign properties
            self.source = source;
            self.viewport = viewport;
            self.drawer = drawer;
            self.profiler = profiler;
            
            // begin updating
            animating = false;
            forceRedraw = true;
            scheduleUpdate(updateMulti);
            eventManager.trigger("open", self);
        }
        
        function onClose() {
            // TODO need destroy() methods to prevent leaks? check for null if so.
            
            // nullify fields and properties
            self.source = source = null;
            self.viewport = viewport = null;
            self.drawer = drawer = null;
            self.profiler = profiler = null;
            
            // clear all tiles and any message
            canvas.innerHTML = "";
        }
        
        function scheduleUpdate(updateFunc, prevUpdateTime) {
            // if we're animating, update as fast as possible to stay smooth
            if (animating) {
                return window.setTimeout(updateFunc, 1);
            }
            
            // if no previous update, consider this an update
            var currentTime = new Date().getTime();
            var prevUpdateTime = prevUpdateTime ? prevUpdateTime : currentTime;
            var targetTime = prevUpdateTime + 1000 / 60;    // 60 fps ideal
            
            // calculate delta time to be a positive number
            var deltaTime = Math.max(1, targetTime - currentTime);
            return window.setTimeout(updateFunc, deltaTime);
        }
        
        function updateOnce() {
            if (!source) {
                return;
            }
            
            profiler.beginUpdate();
            
            var containerSize = SeadragonUtils.getElementSize(container);
            
            // UPDATE: don't break if the viewer was collapsed or hidden!
            // in that case, go ahead still update normally as we were before,
            // but don't notify the viewport of the resize! prevents NaN bug.
            if (!containerSize.equals(prevContainerSize) &&
                    containerSize.x > 0 && containerSize.y > 0) {
                viewport.resize(containerSize, true); // maintain image position
                prevContainerSize = containerSize;
                eventManager.trigger("resize", self);
            }
            
            var animated = viewport.update();
            
            if (!animating && animated) {
                // we weren't animating, and now we did ==> animation start
                eventManager.trigger("animationstart", self);
                abortControlsAutoHide();
            }
            
            if (animated) {
                // viewport moved
                drawer.update();
                eventManager.trigger("animation", self);
            } else if (forceRedraw || drawer.needsUpdate()) {
                // need to load or blend images, etc.
                drawer.update();
                forceRedraw = false;
            } else {
                // no changes, so preload images, etc.
                drawer.idle();
            }
            
            if (animating && !animated) {
                // we were animating, and now we're not anymore ==> animation finish
                eventManager.trigger("animationfinish", self);
                
                // if the mouse has left the container, begin fading controls
                if (!mouseInside) {
                    beginControlsAutoHide();
                }
            }
            
            animating = animated;
            
            profiler.endUpdate();
        }
        
        function updateMulti() {
            if (!source) {
                return;
            }
            
            var beginTime = new Date().getTime();
            
            updateOnce();
            scheduleUpdate(arguments.callee, beginTime);
        }
        
        // Controls
        
        function getControlIndex(elmt) {
            for (var i = controls.length - 1; i >= 0; i--) {
                if (controls[i].elmt == elmt) {
                    return i;
                }
            }
            
            return -1;
        }
        
        function scheduleControlsFade() {
            window.setTimeout(updateControlsFade, 20);
        }
        
        function updateControlsFade() {
            if (controlsShouldFade) {
                var currentTime = new Date().getTime();
                var deltaTime = currentTime - controlsFadeBeginTime;
                var opacity = 1.0 - deltaTime / controlsFadeLength;
                
                opacity = Math.min(1.0, opacity);
                opacity = Math.max(0.0, opacity);
                
                for (var i = controls.length - 1; i >= 0; i--) {
                    controls[i].setOpacity(opacity);
                }
                
                if (opacity > 0) {
                    scheduleControlsFade();    // fade again
                }
            }
        }
        
        function abortControlsAutoHide() {
            controlsShouldFade = false;
            for (var i = controls.length - 1; i >= 0; i--) {
                controls[i].setOpacity(1.0);
            }
        }
        
        function beginControlsAutoHide() {
            if (!SeadragonConfig.autoHideControls) {
                return;
            }
            
            controlsShouldFade = true;
            controlsFadeBeginTime = new Date().getTime() + controlsFadeDelay;
            window.setTimeout(scheduleControlsFade, controlsFadeDelay);
        }
        
        // Mouse interaction with container
        
        function onContainerEnter(tracker, position, buttonDownElmt, buttonDownAny) {
            mouseInside = true;
            abortControlsAutoHide();
        }
        
        function onContainerExit(tracker, position, buttonDownElmt, buttonDownAny) {
            // fade controls out over time, only if the mouse isn't down from
            // within the container (e.g. panning, or using a control)
            if (!buttonDownElmt) {
                mouseInside = false;
                if (!animating) {
                    beginControlsAutoHide();
                }
            }
        }
        
        function onContainerRelease(tracker, position, insideElmtPress, insideElmtRelease) {
            // the mouse may have exited the container and we ignored it if the
            // mouse was down from within the container. now when the mouse is
            // released, we should fade the controls out now.
            if (!insideElmtRelease) {
                mouseInside = false;
                if (!animating) {
                    beginControlsAutoHide();
                }
            }
        }
        
        // Mouse interaction with canvas
        
        function onCanvasClick(tracker, position, quick, shift) {
            if (viewport && quick) {    // ignore clicks where mouse moved
                var zoomPerClick = SeadragonConfig.zoomPerClick;
                var factor = shift ? 1.0 / zoomPerClick : zoomPerClick;
                viewport.zoomBy(factor, viewport.pointFromPixel(position, true));
                viewport.applyConstraints();
            }
        }
        
        function onCanvasPress(tracker, position) {
            if (viewport) {
                mouseDownPixel = position;
                mouseDownCenter = viewport.getCenter();
            }
        }
        
        function onCanvasDrag(tracker, position, delta, shift) {
            if (viewport) {
                // note that in both cases, we're negating delta pixels since
                // dragging is opposite of panning. analogy is adobe viewer,
                // dragging up scrolls down.
                if (SeadragonConfig.constrainDuringPan) {
                    var deltaPixels = position.minus(mouseDownPixel);
                    var deltaPoints = viewport.deltaPointsFromPixels(deltaPixels.negate(), true);
                    viewport.panTo(mouseDownCenter.plus(deltaPoints));
                    viewport.applyConstraints();
                } else {
                    viewport.panBy(viewport.deltaPointsFromPixels(delta.negate(), true));
                }
            }
        }
        
        function onCanvasRelease(tracker, position, insideElmtPress, insideElmtRelease) {
            if (insideElmtPress && viewport) {
                viewport.applyConstraints();
            }
        }
        
        function onCanvasScroll(tracker, position, delta, shift) {
            if (viewport) {
                var factor = Math.pow(SeadragonConfig.zoomPerScroll, delta);
                viewport.zoomBy(factor, viewport.pointFromPixel(position, true));
                viewport.applyConstraints();
            }
        }
		
		// Keyboard interaction
		
		function onPageKeyDown(event) {
			event = SeadragonUtils.getEvent(event);
			if (event.keyCode === 27) {    // 27 means esc key
				self.setFullPage(false);
			}
		}
        
        // Methods -- IMAGE
        
        this.isOpen = function() {
            return !!source;
        };
        
        this.openDzi = function(xmlUrlOrJsonObj, xmlString) {
            var currentTime = beforeOpen();
            var callback = SeadragonUtils.createCallback(null, onOpen, currentTime);
            
            switch (typeof(xmlUrlOrJsonObj)) {
            case "string":
                SeadragonDziTileSource.createFromXml(xmlUrlOrJsonObj, xmlString, callback);
                break;
            default:
                SeadragonDziTileSource.createFromJson(xmlUrlOrJsonObj, callback);
                break;
            }
        };
        
        this.openTileSource = function(tileSource) {
            var currentTime = beforeOpen();
            window.setTimeout(function() {
                onOpen(currentTime, tileSource);
            }, 1);
        };        
        this.close = function() {
            if (!source) {
                return;
            }
            
            onClose();
        };
        
        // Methods -- CONTROLS
        
        this.addControl = function(elmt, anchor) {
            var elmt = SeadragonUtils.getElement(elmt);
            
            if (getControlIndex(elmt) >= 0) {
                return;     // they're trying to add a duplicate control
            }
            
            var div = null;
            
            switch (anchor) {
                case SeadragonControlAnchor.TOP_RIGHT:
                    div = controlsTR;
                    elmt.style.position = "relative";
                    break;
                case SeadragonControlAnchor.BOTTOM_RIGHT:
                    div = controlsBR;
                    elmt.style.position = "relative";
                    break;
                case SeadragonControlAnchor.BOTTOM_LEFT:
                    div = controlsBL;
                    elmt.style.position = "relative";
                    break;
                case SeadragonControlAnchor.TOP_LEFT:
                    div = controlsTL;
                    elmt.style.position = "relative";
                    break;
                case SeadragonControlAnchor.NONE:
                default:
                    div = container;
                    elmt.style.position = "absolute";
                    break;
            }
            
            controls.push(new Control(elmt, anchor, div));
        };
        
        this.removeControl = function(elmt) {
            var elmt = SeadragonUtils.getElement(elmt);
            var i = getControlIndex(elmt);
            
            if (i >= 0) {
                controls[i].destroy();
                controls.splice(i, 1);
            }
        };
        
        this.clearControls = function() {
            while (controls.length > 0) {
                controls.pop().destroy();
            }
        };
        
        this.getNavControl = function() {
            return navControl;
        };
        
        // Methods -- UI
        
        this.isDashboardEnabled = function() {
            for (var i = controls.length - 1; i >= 0; i--) {
                if (controls[i].isVisible()) {
                    return true;
                }
            }
            
            return false;
        };
        
        this.isFullPage = function() {
            return container.parentNode == document.body;
        };
        
        this.isMouseNavEnabled = function() {
            return innerTracker.isTracking();
        };
        
        this.isVisible = function() {
            return container.style.visibility != "hidden";
        };
        
        this.setDashboardEnabled = function(enabled) {
            for (var i = controls.length - 1; i >= 0; i--) {
                controls[i].setVisible(enabled);
            }
        };
        
        this.setFullPage = function(fullPage) {
            if (fullPage == self.isFullPage()) {
                return;
            }
            
            // copy locally to improve perf
            var body = document.body;
            var bodyStyle = body.style;
            var docStyle = document.documentElement.style;
            var containerStyle = container.style;
            var canvasStyle = canvas.style;
            
            if (fullPage) {
                // change overflow, but preserve what current values are
                bodyOverflow = bodyStyle.overflow;
                docOverflow = docStyle.overflow;
                bodyStyle.overflow = "hidden";
                docStyle.overflow = "hidden";
                
                // IE6 needs the body width/height to be 100% also
                bodyWidth = bodyStyle.width;
                bodyHeight = bodyStyle.height;
                bodyStyle.width = "100%";
                bodyStyle.height = "100%";
                
                // always show black background, etc., for fullpage
                canvasStyle.backgroundColor = "black";
                canvasStyle.color = "white";
                
                // make container attached to the window, immune to scrolling,
                // and above any other things with a z-index set.
                containerStyle.position = "fixed";
                containerStyle.zIndex = "99999999";
                
                body.appendChild(container);
                prevContainerSize = SeadragonUtils.getWindowSize();
				
				// add keyboard listener for esc key, to exit full page.
				// add it on document because browsers won't give an arbitrary
				// element (e.g. this viewer) keyboard focus, and adding it to
				// window doesn't work properly in IE.
				SeadragonUtils.addEvent(document, "keydown", onPageKeyDown);
                
                onContainerEnter();     // mouse will be inside container now
            } else {
                // restore previous values for overflow
                bodyStyle.overflow = bodyOverflow;
                docStyle.overflow = docOverflow;
                
                // IE6 needed to overwrite the body width/height also
                bodyStyle.width = bodyWidth;
                bodyStyle.height = bodyHeight;
                
                // return to inheriting style
                canvasStyle.backgroundColor = "";
                canvasStyle.color = "";
                
                // make container be inline on page again, and auto z-index
                containerStyle.position = "relative";
                containerStyle.zIndex = "";
                
                parent.appendChild(container);
                prevContainerSize = SeadragonUtils.getElementSize(parent);
				
				// remove keyboard listener for esc key
				SeadragonUtils.removeEvent(document, "keydown", onPageKeyDown);
                
                onContainerExit();      // mouse will likely be outside now
            }
            
            if (viewport) {
                var oldBounds = viewport.getBounds();
                viewport.resize(prevContainerSize);
                var newBounds = viewport.getBounds();
            
                if (fullPage) {
                    // going to fullpage, remember how much bounds changed by.
                    fsBoundsDelta = new SeadragonPoint(newBounds.width / oldBounds.width,
                        newBounds.height / oldBounds.height);
                } else {
                    // leaving fullpage, negate how much the fullpage zoomed by.
                    // note that we have to negate the bigger of the two changes.
                    // we have to zoom about the center of the new bounds, but
                    // that's NOT the zoom point. so we have to manually update
                    // first so that that center becomes the viewport center.
                    viewport.update();
                    viewport.zoomBy(Math.max(fsBoundsDelta.x, fsBoundsDelta.y),
                            null, true);
                }
                
                forceRedraw = true;
                eventManager.trigger("resize", self);
                updateOnce();
            }
        };
        
        this.setMouseNavEnabled = function(enabled) {
            innerTracker.setTracking(enabled);
        };
        
        this.setVisible = function(visible) {
            // important: don't explicitly say "visibility: visible", because
            // the W3C spec actually says children of hidden elements that have
            // "visibility: visible" should still be rendered. that's usually
            // not what we (or developers) want. browsers are inconsistent in
            // this regard, but IE seems to follow this spec.
            container.style.visibility = visible ? "" : "hidden";
        };
        
        this.showMessage = function(message, delay) {
            if (!delay) {
                setMessage(message);
                return;
            }
            
            window.setTimeout(function() {
                if (!self.isOpen()) {
                    setMessage(message);
                }
            }, delay);
        };
        
        // Methods -- EVENT HANDLING
        
        this.addEventListener = function(eventName, handler) {
            eventManager.addListener(eventName, handler);
        };
        
        this.removeEventListener = function(eventName, handler) {
            eventManager.removeListener(eventName, handler);
        };
        
        // Constructor
        
        initialize();
        
    };

})();
