@echo off

echo /*! > seadragon-min.js
echo  * Seadragon Ajax 0.8.9 (custom build from source) >> seadragon-min.js
echo  * http://gallery.expression.microsoft.com/SeadragonAjax >> seadragon-min.js
echo  * This code is distributed under the license agreement at: >> seadragon-min.js
echo  * http://go.microsoft.com/fwlink/?LinkId=164943 >> seadragon-min.js
echo  */ >> seadragon-min.js

type ..\src\_intro.txt > seadragon.js

for %%f in (
  Seadragon.Core.js
  Seadragon.Config.js
  Seadragon.Strings.js
  Seadragon.Debug.js
  Seadragon.Profiler.js
  Seadragon.Point.js
  Seadragon.Rect.js
  Seadragon.Spring.js
  Seadragon.Utils.js
  Seadragon.MouseTracker.js
  Seadragon.EventManager.js
  Seadragon.ImageLoader.js
  Seadragon.Buttons.js
  Seadragon.TileSource.js
  Seadragon.DisplayRect.js
  Seadragon.DeepZoom.js
  Seadragon.Viewport.js
  Seadragon.Drawer.js
  Seadragon.Viewer.js
) do (
  echo.
  echo // %%f:
  echo.
  type ..\src\%%f
) >> seadragon.js

type ..\src\_outro.txt >> seadragon.js

ajaxmin.exe /Z /HC seadragon.js >> seadragon-min.js

del seadragon.js