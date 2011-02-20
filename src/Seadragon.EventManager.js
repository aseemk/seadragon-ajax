//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

var SeadragonEventManager = Seadragon.EventManager = function() {
    
    // Fields
    
    var listeners = {}; // dictionary of eventName --> array of handlers
    
    // Methods
    
    this.addListener = function(eventName, handler) {
        if (typeof(handler) != "function") {
            return;
        }
        
        if (!listeners[eventName]) {
            listeners[eventName] = [];
        }
        
        listeners[eventName].push(handler);
    };
    
    this.removeListener = function(eventName, handler) {
        var handlers = listeners[eventName];
        
        if (typeof(handler) != "function") {
            return;
        } else if (!handlers) {
            return;
        }
        
        for (var i = 0; i < handlers.length; i++) {
            if (handler == handlers[i]) {
                handlers.splice(i, 1);
                return;
            }
        }
    };
    
    this.clearListeners = function(eventName) {
        if (listeners[eventName]) {
            delete listeners[eventName];
        }
    };
    
    this.trigger = function(eventName) {
        var handlers = listeners[eventName];
        var args = [];
        
        if (!handlers) {
            return;
        }
        
        for (var i = 1; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        
        for (var i = 0; i < handlers.length; i++) {
            try {
                handlers[i].apply(window, args);
            } catch (e) {
                // handler threw an error, ignore, go on to next one
                SeadragonDebug.error(e.name + " while executing " + eventName +
                        " handler: " + e.message, e);
            }
        }
    };
    
};
