
(function() {
    var PATH = "src/";      // the path to the scripts, relative to HTML page
    var SCRIPTS = [         // the script filenames, in dependency order
        "Seadragon.Core.js",
        "Seadragon.Config.js",
        "Seadragon.Strings.js",
        "Seadragon.Debug.js",
        "Seadragon.Profiler.js",
        "Seadragon.Point.js",
        "Seadragon.Rect.js",
        "Seadragon.Spring.js",
        "Seadragon.Utils.js",
        "Seadragon.MouseTracker.js",
        "Seadragon.EventManager.js",
        "Seadragon.ImageLoader.js",
        "Seadragon.Buttons.js",
        "Seadragon.TileSource.js",
        "Seadragon.DisplayRect.js",
        "Seadragon.DeepZoom.js",
        "Seadragon.Viewport.js",
        "Seadragon.Drawer.js",
        "Seadragon.Viewer.js"
    ];
    
    var html = [];
    
    for (var i = 0; i < SCRIPTS.length; i++) {
        html.push('<script type="text/javascript" src="');
        html.push(PATH);
        html.push(SCRIPTS[i]);
        html.push('"></script>\n');
    }
    
    // "defer" attr is needed here otherwise IE executes this too early
    html.push('<script type="text/javascript" defer="defer">\n');
    html.push('    Seadragon.Config.debugMode = true;\n');
    html.push('</script>\n');
    
    document.write(html.join(''));
})();
