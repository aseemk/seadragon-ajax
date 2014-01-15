//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonBrowser = Seadragon.Browser = {
    UNKNOWN: 0,
    IE: 1,
    FIREFOX: 2,
    SAFARI: 3,
    CHROME: 4,
    OPERA: 5
};

var SeadragonUtils = function() {
    
    // Fields
    
    var self = this;
    
    var arrActiveX = ["Msxml2.XMLHTTP", "Msxml3.XMLHTTP", "Microsoft.XMLHTTP"];
    var supportedImageFormats = {
        "bmp": false,
        "jpeg": true,
        "jpg": true,
        "png": true,
        "tif": false,
        "wdp": false
    };
    
    var browser = SeadragonBrowser.UNKNOWN;
    var browserVersion = 0;
    var badAlphaBrowser = false;    // updated in constructor
    
    var urlParams = {};
    
    // Constructor
    
    (function() {
        
        // Browser detect
        
        var app = navigator.appName;
        var ver = navigator.appVersion;
        var ua = navigator.userAgent;
        
        if (app == "Microsoft Internet Explorer" &&
                !!window.attachEvent && !!window.ActiveXObject) {
            
            var ieOffset = ua.indexOf("MSIE");
            browser = SeadragonBrowser.IE;
            browserVersion = parseFloat(
                    ua.substring(ieOffset + 5, ua.indexOf(";", ieOffset)));
            
            // update: for intranet sites and compat view list sites, IE sends
            // an IE7 User-Agent to the server to be interoperable, and even if
            // the page requests a later IE version, IE will still report the
            // IE7 UA to JS. we should be robust to this.
            var docMode = document.documentMode;
            if (typeof docMode !== "undefined") {
                browserVersion = docMode;
            }
            
        } else if (app == "Netscape" && !!window.addEventListener) {
            
            var ffOffset = ua.indexOf("Firefox");
            var saOffset = ua.indexOf("Safari");
            var chOffset = ua.indexOf("Chrome");
            
            if (ffOffset >= 0) {
                browser = SeadragonBrowser.FIREFOX;
                browserVersion = parseFloat(ua.substring(ffOffset + 8));
            } else if (saOffset >= 0) {
                var slash = ua.substring(0, saOffset).lastIndexOf("/");
                browser = (chOffset >= 0) ? SeadragonBrowser.CHROME : SeadragonBrowser.SAFARI;
                browserVersion = parseFloat(ua.substring(slash + 1, saOffset));
            }
            
        } else if (app == "Opera" && !!window.opera && !!window.attachEvent) {
            
            browser = SeadragonBrowser.OPERA;
            browserVersion = parseFloat(ver);
            
        }
        
        // Url parameters
        
        var query = window.location.search.substring(1);    // ignore '?'
        var parts = query.split('&');
        
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            var sep = part.indexOf('=');
            
            if (sep > 0) {
                urlParams[part.substring(0, sep)] =
                        decodeURIComponent(part.substring(sep + 1));
            }
        }
        
        // Browser behaviors
        
        // update: chrome 2 no longer has this problem! and now same with IE9!
        badAlphaBrowser =
                (browser == SeadragonBrowser.IE && browserVersion < 9) ||
                (browser == SeadragonBrowser.CHROME && browserVersion < 2);
        
    })();
    
    // Helpers
    
    function getOffsetParent(elmt, isFixed) {
        // IE and Opera "fixed" position elements don't have offset parents.
        // regardless, if it's fixed, its offset parent is the body.
        if (isFixed && elmt != document.body) {
            return document.body;
        } else {
            return elmt.offsetParent;
        }
    }
    
    // Methods
    
    this.getBrowser = function() {
        return browser;
    };
    
    this.getBrowserVersion = function() {
        return browserVersion;
    };
    
    this.getElement = function(elmt) {
        if (typeof(elmt) == "string") {
            elmt = document.getElementById(elmt);
        }
        
        return elmt;
    };
    
    this.getElementPosition = function(elmt) {
        var elmt = self.getElement(elmt);
        var result = new SeadragonPoint();
        
        // technique from:
        // http://www.quirksmode.org/js/findpos.html
        // with special check for "fixed" elements.
        
        var isFixed = self.getElementStyle(elmt).position == "fixed";
        var offsetParent = getOffsetParent(elmt, isFixed);
        
        while (offsetParent) {
            result.x += elmt.offsetLeft;
            result.y += elmt.offsetTop;
            
            if (isFixed) {
                result = result.plus(self.getPageScroll());
            }
            
            elmt = offsetParent;
            isFixed = self.getElementStyle(elmt).position == "fixed";
            offsetParent = getOffsetParent(elmt, isFixed);
        }
        
        return result;
    };
    
    this.getElementSize = function(elmt) {
        var elmt = self.getElement(elmt);
        return new SeadragonPoint(elmt.clientWidth, elmt.clientHeight);
    };
    
    this.getElementStyle = function(elmt) {
        var elmt = self.getElement(elmt);
        
        if (elmt.currentStyle) {
            return elmt.currentStyle;
        } else if (window.getComputedStyle) {
            return window.getComputedStyle(elmt, "");
        } else {
            SeadragonDebug.fail("Unknown element style, no known technique.");
        }
    };
    
    this.getEvent = function(event) {
        return event ? event : window.event;
    };
    
    this.getMousePosition = function(event) {
        var event = self.getEvent(event);
        var result = new SeadragonPoint();
        
        // technique from:
        // http://www.quirksmode.org/js/events_properties.html
        
        if (event.type == "DOMMouseScroll" &&
                browser == SeadragonBrowser.FIREFOX && browserVersion < 3) {
            // hack for FF2 which reports incorrect position for mouse scroll
            result.x = event.screenX;
            result.y = event.screenY;
        } else if (typeof(event.pageX) == "number") {
           result.x = event.pageX;
            result.y = event.pageY;
        } else if (typeof(event.clientX) == "number") {
            result.x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            result.y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        } else {
            SeadragonDebug.fail("Unknown event mouse position, no known technique.");
        }
        
        return result;
    };
    
    this.getMouseScroll = function(event) {
        var event = self.getEvent(event);
        var delta = 0; // default value
        
        // technique from:
        // http://blog.paranoidferret.com/index.php/2007/10/31/javascript-tutorial-the-scroll-wheel/
        
        if (typeof(event.wheelDelta) == "number") {
            delta = event.wheelDelta;
        } else if (typeof(event.detail) == "number") {
            delta = event.detail * -1;
        } else {
            SeadragonDebug.fail("Unknown event mouse scroll, no known technique.");
        }
        
        // normalize value to [-1, 1]
        return delta ? delta / Math.abs(delta) : 0;
    };
    
    this.getPageScroll = function() {
        var result = new SeadragonPoint();
        var docElmt = document.documentElement || {};
        var body = document.body || {};
        
        // technique from:
        // http://www.howtocreate.co.uk/tutorials/javascript/browserwindow
        
        if (typeof(window.pageXOffset) == "number") {
            // most browsers
            result.x = window.pageXOffset;
            result.y = window.pageYOffset;
        } else if (body.scrollLeft || body.scrollTop) {
            // W3C spec, IE6+ in quirks mode
            result.x = body.scrollLeft;
            result.y = body.scrollTop;
        } else if (docElmt.scrollLeft || docElmt.scrollTop) {
            // IE6+ in standards mode
            result.x = docElmt.scrollLeft;
            result.y = docElmt.scrollTop;
        }
        
        // note: we specifically aren't testing for typeof here, because IE sets
        // the appropriate variables undefined instead of 0 under certain
        // conditions. this means we also shouldn't fail if none of the three
        // cases are hit; we'll just assume the page scroll is 0.
        
        return result;
    };
    
    this.getWindowSize = function() {
        var result = new SeadragonPoint();
        var docElmt = document.documentElement || {};
        var body = document.body || {};
        
        // technique from:
        // http://www.howtocreate.co.uk/tutorials/javascript/browserwindow
        
        // important: i originally cleaned up the second and third IE checks to
        // check if the typeof was number. but this fails for quirks mode,
        // because docElmt.clientWidth is indeed a number, but it's incorrectly
        // zero. so no longer checking typeof is number for those cases.
        
        if (typeof(window.innerWidth) == 'number') {
            // non-IE browsers
            result.x = window.innerWidth;
            result.y = window.innerHeight;
        } else if (docElmt.clientWidth || docElmt.clientHeight) {
            // IE6+ in standards mode
            result.x = docElmt.clientWidth;
            result.y = docElmt.clientHeight;
        } else if (body.clientWidth || body.clientHeight) {
            // IE6+ in quirks mode
            result.x = body.clientWidth;
            result.y = body.clientHeight;
        } else {
            SeadragonDebug.fail("Unknown window size, no known technique.");
        }
        
        return result;
    };
    
    this.imageFormatSupported = function(ext) {
        var ext = ext ? ext : "";
        return !!supportedImageFormats[ext.toLowerCase()];
    };
    
    this.makeCenteredNode = function(elmt) {
        var elmt = SeadragonUtils.getElement(elmt);
        var div = self.makeNeutralElement("div");
        var html = [];
        
        // technique for vertically centering (in IE!!!) from:
        // http://www.jakpsatweb.cz/css/css-vertical-center-solution.html
        // with explicit neutralizing of styles added by me.
        html.push('<div style="display:table; height:100%; width:100%;');
        html.push('border:none; margin:0px; padding:0px;'); // neutralizing
        html.push('#position:relative; overflow:hidden; text-align:left;">');
            // the text-align:left guards against incorrect centering in IE
        html.push('<div style="#position:absolute; #top:50%; width:100%; ');
        html.push('border:none; margin:0px; padding:0px;'); // neutralizing
        html.push('display:table-cell; vertical-align:middle;">');
        html.push('<div style="#position:relative; #top:-50%; width:100%; ');
        html.push('border:none; margin:0px; padding:0px;'); // neutralizing
        html.push('text-align:center;"></div></div></div>');
        
        div.innerHTML = html.join('');
        div = div.firstChild;
        
        // now add the element as a child to the inner-most div
        var innerDiv = div;
        var innerDivs = div.getElementsByTagName("div");
        while (innerDivs.length > 0) {
            innerDiv = innerDivs[0];
            innerDivs = innerDiv.getElementsByTagName("div");
        }
        
        innerDiv.appendChild(elmt);
        
        return div;
    };
    
    this.makeNeutralElement = function(tagName) {
        var elmt = document.createElement(tagName);
        var style = elmt.style;
        
        // TODO reset neutral element's style in a better way
        style.background = "transparent none";
        style.border = "none";
        style.margin = "0px";
        style.padding = "0px";
        style.position = "static";
        
        return elmt;
    };
    
    this.makeTransparentImage = function(src) {
        var img = self.makeNeutralElement("img");
        var elmt = null;
        
        if (browser == SeadragonBrowser.IE && browserVersion < 7) {
            elmt = self.makeNeutralElement("span");
            elmt.style.display = "inline-block";
            
            // to size span correctly, load image and get natural size,
            // but don't override any user-set CSS values
            img.onload = function() {
                elmt.style.width = elmt.style.width || img.width + "px";
                elmt.style.height = elmt.style.height || img.height + "px";
                
                img.onload = null;
                img = null;     // to prevent memory leaks in IE
            };
            
            img.src = src;
            elmt.style.filter =
                    "progid:DXImageTransform.Microsoft.AlphaImageLoader(src='" +
                    src + "', sizingMethod='scale')";
        } else {
            elmt = img;
            elmt.src = src;
        }
        
        return elmt;
    };
    
    this.setElementOpacity = function(elmt, opacity, usesAlpha) {
        var elmt = self.getElement(elmt);
        
        if (usesAlpha && badAlphaBrowser) {
            // images with alpha channels won't fade well, so round
            opacity = Math.round(opacity);
        }
        
        // for CSS opacity browsers, remove opacity value if it's unnecessary
        if (opacity < 1) {
            elmt.style.opacity = opacity;
        } else {
            elmt.style.opacity = "";
        }
        
        // for CSS filter browsers (IE), remove alpha filter if it's unnecessary.
        // update: doing this always since IE9 beta seems to have broken the
        // behavior if we rely on the programmatic filters collection.
        var prevFilter = elmt.style.filter || "";
        elmt.style.filter = prevFilter.replace(/[\s]*alpha\(.*?\)[\s]*/g, "");
                // important: note the lazy star! this protects against
                // multiple filters; we don't want to delete the other ones.
                // update: also trimming extra whitespace around filter.
        
        if (opacity >= 1) {
            return;
        }
        
        var ieOpacity = Math.round(100 * opacity);
        var ieFilter = " alpha(opacity=" + ieOpacity + ") ";
        
        elmt.style.filter += ieFilter;
        
        // old way -- seems to have broken in IE9's compatibiliy mode:
        // check if this element has filters associated with it (IE only),
        // but prevent bug where IE throws error "Member not found" sometimes.
        //try {
        //    if (elmt.filters && elmt.filters.alpha) {
        //        elmt.filters.alpha.opacity = ieOpacity;
        //    } else {
        //        elmt.style.filter += ieFilter;
        //    }
        //} catch (e) {
        //    elmt.style.filter += ieFilter;
        //}
    };
    
    this.addEvent = function(elmt, eventName, handler, useCapture) {
        var elmt = self.getElement(elmt);
        
        // technique from:
        // http://blog.paranoidferret.com/index.php/2007/08/10/javascript-working-with-events/
        
        if (elmt.addEventListener) {
            if (eventName == "mousewheel") {
                elmt.addEventListener("DOMMouseScroll", handler, useCapture);
            }
            // we are still going to add the mousewheel -- not a mistake!
            // this is for opera, since it uses onmousewheel but needs addEventListener.
            elmt.addEventListener(eventName, handler, useCapture);
        } else if (elmt.attachEvent) {
            elmt.attachEvent("on" + eventName, handler);
            if (useCapture && elmt.setCapture) {
                elmt.setCapture();
            }
        } else {
            SeadragonDebug.fail("Unable to attach event handler, no known technique.");
        }
    };
    
    this.removeEvent = function(elmt, eventName, handler, useCapture) {
        var elmt = self.getElement(elmt);
        
        // technique from:
        // http://blog.paranoidferret.com/index.php/2007/08/10/javascript-working-with-events/
        
        if (elmt.removeEventListener) {
            if (eventName == "mousewheel") {
                elmt.removeEventListener("DOMMouseScroll", handler, useCapture);
            }
            // we are still going to remove the mousewheel -- not a mistake!
            // this is for opera, since it uses onmousewheel but needs removeEventListener.
            elmt.removeEventListener(eventName, handler, useCapture);
        } else if (elmt.detachEvent) {
            elmt.detachEvent("on" + eventName, handler);
            if (useCapture && elmt.releaseCapture) {
                elmt.releaseCapture();
            }
        } else {
            SeadragonDebug.fail("Unable to detach event handler, no known technique.");
        }
    };
    
    this.cancelEvent = function(event) {
        var event = self.getEvent(event);
        
        // technique from:
        // http://blog.paranoidferret.com/index.php/2007/08/10/javascript-working-with-events/
        
        if (event.preventDefault) {
            event.preventDefault();     // W3C for preventing default
        }
        
        event.cancel = true;            // legacy for preventing default
        event.returnValue = false;      // IE for preventing default
    };
    
    this.stopEvent = function(event) {
        var event = self.getEvent(event);
        
        // technique from:
        // http://blog.paranoidferret.com/index.php/2007/08/10/javascript-working-with-events/
        
        if (event.stopPropagation) {
            event.stopPropagation();    // W3C for stopping propagation
        }
        
        event.cancelBubble = true;      // IE for stopping propagation
    };
    
    this.createCallback = function(object, method) {
        // create callback args
        var initialArgs = [];
        for (var i = 2; i < arguments.length; i++) {
            initialArgs.push(arguments[i]);
        }
        
        // create closure to apply method
        return function() {
            // concatenate new args, but make a copy of initialArgs first
            var args = initialArgs.concat([]);
            for (var i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }
            
            return method.apply(object, args);
        };
    };
    
    this.getUrlParameter = function(key) {
        var value = urlParams[key];
        return value ? value : null;
    };
    
    this.makeAjaxRequest = function(url, callback) {
        var async = typeof(callback) == "function";
        var req = null;
        
        if (async) {
            var actual = callback;
            var callback = function() {
                window.setTimeout(SeadragonUtils.createCallback(null, actual, req), 1);
            };
        }
        //This is for IE when doing cross domain
        if ('XDomainRequest' in window && window.XDomainRequest !== null) {
            req = new XDomainRequest();
            req.status = 0;
        }
        else if (window.ActiveXObject) {
            for (var i = 0; i < arrActiveX.length; i++) {
                try {
                    req = new ActiveXObject(arrActiveX[i]);
                    break;
                } catch (e) {
                    continue;
                }
            }
        } else if (window.XMLHttpRequest) {
            req = new XMLHttpRequest();
        }
        
        if (!req) {
            SeadragonDebug.fail("Browser doesn't support XMLHttpRequest.");
        }
        
        // Proxy support
        if (SeadragonConfig.proxyUrl) {
            url = SeadragonConfig.proxyUrl + url;
        }
        
        if (async) {
            req.onreadystatechange = function() {
                if (req.readyState == 4) {
                    // prevent memory leaks by breaking circular reference now
                    req.onreadystatechange = new Function();
                    callback();
                }
            };
        }
        
        try {
            req.open("GET", url, async);
            req.send(null);
        } catch (e) {
            SeadragonDebug.log(e.name + " while making AJAX request: " + e.message);
            
            req.onreadystatechange = null;
            req = null;
            
            if (async) {
                callback();
            }
        }
        
        return async ? null : req;
    };
    
    this.parseXml = function(string) {
        var xmlDoc = null;
        
        if (window.ActiveXObject) {
            try {
                xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
                xmlDoc.async = false;
                xmlDoc.loadXML(string);
            } catch (e) {
                SeadragonDebug.log(e.name + " while parsing XML (ActiveX): " + e.message);
            }
        } else if (window.DOMParser) {
            try {
                var parser = new DOMParser();
                xmlDoc = parser.parseFromString(string, "text/xml");
            } catch (e) {
                SeadragonDebug.log(e.name + " while parsing XML (DOMParser): " + e.message);
            }
        } else {
            SeadragonDebug.fail("Browser doesn't support XML DOM.");
        }
        
        return xmlDoc;
    };
    
};

// Seadragon.Utils is a static class, so make it singleton instance
SeadragonUtils = Seadragon.Utils = new SeadragonUtils();
