# Seadragon Ajax build script - concatenates the source files in dependency
# order and minifies the result into seadragon-min.js.

from jsmin import jsmin

if __name__ != "__main__":
    print "Error: this script should be executed directly, not included."
    exit(1)

HEADER = '''
/*!
 * Seadragon Ajax 0.8.9 (custom build from source)
 * http://gallery.expression.microsoft.com/SeadragonAjax
 * This code is distributed under the license agreement at:
 * http://go.microsoft.com/fwlink/?LinkId=164943
 */
'''

SRC_PATH = "../src/"
SRC_FILES = [
    "_intro.txt",
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
    "Seadragon.Viewer.js",
    "_outro.txt"
]

MIN_PATH = "seadragon-min.js"

def readfile(path):
    file = open(path, 'r')
    contents = file.read()
    file.close()
    return contents

def writefile(path, contents):
    file = open(path, 'w')
    file.write(contents)
    file.close()

src_raw = '\n'.join([readfile(SRC_PATH + src_file) for src_file in SRC_FILES])
src_min = HEADER.strip() + '\n' + jsmin(src_raw)

writefile(MIN_PATH, src_min)