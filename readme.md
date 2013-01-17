**Seadragon Ajax** is a JavaScript library for viewing Deep Zoom Images.
Among other things, it's what powers the image viewer on [Zoom.it][] when your
browser doesn't have Microsoft Silverlight installed.

[Zoom.it]: http://zoom.it/

This is the same source code that's available for download on Microsoft's
Expression Gallery:

http://gallery.expression.microsoft.com/SeadragonAjax

Example:

http://aseemk.github.com/seadragon-ajax/sample.html

Documentation:

http://aseemk.github.com/seadragon-ajax/doc/

Please note that Seadragon Ajax is **no longer under active development or
maintenance**, and has not been since February 2011. It works fine in its
current form, but is lacking some potentially [useful features][], most
notably [touch support][] and [hardware acceleration][] on mobile devices.

[useful features]: https://github.com/aseemk/seadragon-ajax/issues
[touch support]: https://github.com/aseemk/seadragon-ajax/issues/4
[hardware acceleration]: https://github.com/aseemk/seadragon-ajax/issues/3

Unfortunately, this codebase was never fully open-sourced — it was released by
Microsoft under a [custom license][] — so continued development of this
codebase is unappealing and unlikely.

[custom license]: https://github.com/aseemk/seadragon-ajax/blob/master/license.txt

However, there is a fork of this library called **OpenSeadragon** that has
started gaining popularity, and this fork is under active development and
maintenance — including by [@iangilman][], author of the original Seadragon
Ajax prototypes! Check it out:

[@iangilman]: https://github.com/iangilman

http://thatcher.github.com/openseadragon/

If you still choose to use this version of Seadragon Ajax, you can find open
community support and discussion at:

https://getsatisfaction.com/livelabs
