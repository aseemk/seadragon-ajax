//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonButton,
    SeadragonButtonGroup;

(function() {
    
    // Enumerations
    
    var ButtonState = {
        REST: 0,
        GROUP: 1,
        HOVER: 2,
        DOWN: 3
    };
    
    // Button class
    
    SeadragonButton = Seadragon.Button = function(tooltip,
            srcRest, srcGroup, srcHover, srcDown,
            onPress, onRelease, onClick, onEnter, onExit) {
        
        // Fields
        
        var button = SeadragonUtils.makeNeutralElement("span");
        var currentState = ButtonState.GROUP;
        var tracker = new SeadragonMouseTracker(button);
        
        var imgRest = SeadragonUtils.makeTransparentImage(srcRest);
        var imgGroup = SeadragonUtils.makeTransparentImage(srcGroup);
        var imgHover = SeadragonUtils.makeTransparentImage(srcHover);
        var imgDown = SeadragonUtils.makeTransparentImage(srcDown);
        
        var onPress = typeof(onPress) == "function" ? onPress : null;
        var onRelease = typeof(onRelease) == "function" ? onRelease : null;
        var onClick = typeof(onClick) == "function" ? onClick : null;
        var onEnter = typeof(onEnter) == "function" ? onEnter : null;
        var onExit = typeof(onExit) == "function" ? onExit : null;
        
        var fadeDelay = 0;      // begin fading immediately
        var fadeLength = 2000;  // fade over a period of 2 seconds
        var fadeBeginTime = null;
        var shouldFade = false;
        
        // Properties
        
        this.elmt = button;
        
        // Fading helpers
        
        function scheduleFade() {
            window.setTimeout(updateFade, 20);
        }
        
        function updateFade() {
            if (shouldFade) {
                var currentTime = new Date().getTime();
                var deltaTime = currentTime - fadeBeginTime;
                var opacity = 1.0 - deltaTime / fadeLength;
                
                opacity = Math.min(1.0, opacity);
                opacity = Math.max(0.0, opacity);
                
                SeadragonUtils.setElementOpacity(imgGroup, opacity, true);
                if (opacity > 0) {
                    scheduleFade();    // fade again
                }
            }
        }
        
        function beginFading() {
            shouldFade = true;
            fadeBeginTime = new Date().getTime() + fadeDelay;
            window.setTimeout(scheduleFade, fadeDelay);
        }
        
        function stopFading() {
            shouldFade = false;
            SeadragonUtils.setElementOpacity(imgGroup, 1.0, true);
        }
        
        // State helpers
        
        function inTo(newState) {
            if (newState >= ButtonState.GROUP && currentState == ButtonState.REST) {
                stopFading();
                currentState = ButtonState.GROUP;
            }
            
            if (newState >= ButtonState.HOVER && currentState == ButtonState.GROUP) {
                // important: don't explicitly say "visibility: visible".
                // see note in Viewer.setVisible() for explanation.
                imgHover.style.visibility = "";
                currentState = ButtonState.HOVER;
            }
            
            if (newState >= ButtonState.DOWN && currentState == ButtonState.HOVER) {
                // important: don't explicitly say "visibility: visible".
                // see note in Viewer.setVisible() for explanation.
                imgDown.style.visibility = "";
                currentState = ButtonState.DOWN;
            }
        }
        
        function outTo(newState) {
            if (newState <= ButtonState.HOVER && currentState == ButtonState.DOWN) {
                imgDown.style.visibility = "hidden";
                currentState = ButtonState.HOVER;
            }
            
            if (newState <= ButtonState.GROUP && currentState == ButtonState.HOVER) {
                imgHover.style.visibility = "hidden";
                currentState = ButtonState.GROUP;
            }
            
            if (newState <= ButtonState.REST && currentState == ButtonState.GROUP) {
                beginFading();
                currentState = ButtonState.REST;
            }
        }
        
        // Tracker helpers
        
        function enterHandler(tracker, position, buttonDownElmt, buttonDownAny) {
            if (buttonDownElmt) {
                inTo(ButtonState.DOWN);
                if (onEnter) {
                    onEnter();
                }
            } else if (!buttonDownAny) {
                inTo(ButtonState.HOVER);
            }
        }
        
        function exitHandler(tracker, position, buttonDownElmt, buttonDownAny) {
            outTo(ButtonState.GROUP);
            if (buttonDownElmt && onExit) {
                onExit();
            }
        }
        
        function pressHandler(tracker, position) {
            inTo(ButtonState.DOWN);
            if (onPress) {
                onPress();
            }
        }
        
        function releaseHandler(tracker, position, insideElmtPress, insideElmtRelease) {
            if (insideElmtPress && insideElmtRelease) {
                outTo(ButtonState.HOVER);
                if (onRelease) {
                    onRelease();
                }
            } else if (insideElmtPress) {
                outTo(ButtonState.GROUP);
            } else {
                // pressed elsewhere, but released on it. if we ignored the
                // enter event because a button was down, activate hover now
                inTo(ButtonState.HOVER);
            }
        }
        
        function clickHandler(tracker, position, quick, shift) {
            if (onClick && quick) {
                onClick();
            }
        }
        
        // Methods
        
        this.notifyGroupEnter = function() {
            inTo(ButtonState.GROUP);
        };
        
        this.notifyGroupExit = function() {
            outTo(ButtonState.REST);
        };
        
        // Constructor
        
        (function() {
            button.style.display = "inline-block";
            button.style.position = "relative";
            button.title = tooltip;
            
            button.appendChild(imgRest);
            button.appendChild(imgGroup);
            button.appendChild(imgHover);
            button.appendChild(imgDown);
            
            var styleRest = imgRest.style;
            var styleGroup = imgGroup.style;
            var styleHover = imgHover.style;
            var styleDown = imgDown.style;
            
            // DON'T position imgRest absolutely -- let it be inline so it fills
            // up the div, sizing the div appropriately
            styleGroup.position = styleHover.position = styleDown.position = "absolute";
            styleGroup.top = styleHover.top = styleDown.top = "0px";
            styleGroup.left = styleHover.left = styleDown.left = "0px";
            styleHover.visibility = styleDown.visibility = "hidden";
                    // rest and group are always visible
            
            // FF2 is very buggy with inline-block. it squashes the button div,
            // making the group-pressed states' images lower than rest. but
            // apparently, clearing the "top" style fixes this. (note that this
            // breaks the buttons in every other browser, so we're not clearing
            // the "top" style by default...)
            if (SeadragonUtils.getBrowser() == SeadragonBrowser.FIREFOX &&
                    SeadragonUtils.getBrowserVersion() < 3) {
                styleGroup.top = styleHover.top = styleDown.top = ""; 
            }
            
            tracker.enterHandler = enterHandler;
            tracker.exitHandler = exitHandler;
            tracker.pressHandler = pressHandler;
            tracker.releaseHandler = releaseHandler;
            tracker.clickHandler = clickHandler;
            
            tracker.setTracking(true);
            outTo(ButtonState.REST);
        })();
        
    };
    
    // ButtonGroup class
    
    SeadragonButtonGroup = Seadragon.ButtonGroup = function(buttons) {
        
       // Fields
        
        var group = SeadragonUtils.makeNeutralElement("span");
        var buttons = buttons.concat([]);   // copy
        var tracker = new SeadragonMouseTracker(group);
        
        // Properties
        
        this.elmt = group;
        
        // Tracker helpers
        
        function enterHandler(tracker, position, buttonDownElmt, buttonDownAny) {
            // somewhat office ribbon style -- we do this regardless of whether
            // the mouse is down from elsewhere. it's a nice soft glow effect.
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].notifyGroupEnter();
            }
        }
        
        function exitHandler(tracker, position, buttonDownElmt, buttonDownAny) {
            if (!buttonDownElmt) {
                // only go to rest if the mouse isn't down from a button
                for (var i = 0; i < buttons.length; i++) {
                    buttons[i].notifyGroupExit();
                }
            }
        }
        
        function releaseHandler(tracker, position, insideElmtPress, insideElmtRelease) {
            if (!insideElmtRelease) {
                // this means was the mouse was inside the div during press, so
                // since it's no longer inside the div during release, it left
                // the div. but onDivExit() ignored it since the mouse was down
                // from the div, so we'll go out to rest state now.
                for (var i = 0; i < buttons.length; i++) {
                    buttons[i].notifyGroupExit();
                }
            }
        }
        
        // Methods
        
        this.emulateEnter = function() {
            enterHandler();
        };
        
        this.emulateExit = function() {
            exitHandler();
        };
        
        // Constructor
        
        (function() {
            group.style.display = "inline-block";
            
            for (var i = 0; i < buttons.length; i++) {
                group.appendChild(buttons[i].elmt);
            }
            
            tracker.enterHandler = enterHandler;
            tracker.exitHandler = exitHandler;
            tracker.releaseHandler = releaseHandler;
            
            tracker.setTracking(true);
        })();
        
    };
    
})();
