//  This code is distributed under the included license agreement, also
//  available here: http://go.microsoft.com/fwlink/?LinkId=164943

if (!window.Seadragon) {
    window.Seadragon = {};
}

// this line overwrites any previous window.Seadragon value in IE before this file
// executes! since this is a global variable, IE does a forward-reference check
// and deletes any global variables which are declared through var. so for now,
// every piece of code that references Seadragon will just have to implicitly
// refer to window.Seadragon and not this global variable Seadragon.
// UPDATE: re-adding this since we're now wrapping all the code in a function.
var Seadragon = window.Seadragon;
