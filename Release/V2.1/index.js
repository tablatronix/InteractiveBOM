(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*! Split.js - v1.3.5 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Split = factory());
}(this, (function () { 'use strict';

// The programming goals of Split.js are to deliver readable, understandable and
// maintainable code, while at the same time manually optimizing for tiny minified file size,
// browser compatibility without additional requirements, graceful fallback (IE8 is supported)
// and very few assumptions about the user's page layout.
var global = window;
var document = global.document;

// Save a couple long function names that are used frequently.
// This optimization saves around 400 bytes.
var addEventListener = 'addEventListener';
var removeEventListener = 'removeEventListener';
var getBoundingClientRect = 'getBoundingClientRect';
var NOOP = function () { return false; };

// Figure out if we're in IE8 or not. IE8 will still render correctly,
// but will be static instead of draggable.
var isIE8 = global.attachEvent && !global[addEventListener];

// This library only needs two helper functions:
//
// The first determines which prefixes of CSS calc we need.
// We only need to do this once on startup, when this anonymous function is called.
//
// Tests -webkit, -moz and -o prefixes. Modified from StackOverflow:
// http://stackoverflow.com/questions/16625140/js-feature-detection-to-detect-the-usage-of-webkit-calc-over-calc/16625167#16625167
var calc = (['', '-webkit-', '-moz-', '-o-'].filter(function (prefix) {
    var el = document.createElement('div');
    el.style.cssText = "width:" + prefix + "calc(9px)";

    return (!!el.style.length)
}).shift()) + "calc";

// The second helper function allows elements and string selectors to be used
// interchangeably. In either case an element is returned. This allows us to
// do `Split([elem1, elem2])` as well as `Split(['#id1', '#id2'])`.
var elementOrSelector = function (el) {
    if (typeof el === 'string' || el instanceof String) {
        return document.querySelector(el)
    }

    return el
};

// The main function to initialize a split. Split.js thinks about each pair
// of elements as an independant pair. Dragging the gutter between two elements
// only changes the dimensions of elements in that pair. This is key to understanding
// how the following functions operate, since each function is bound to a pair.
//
// A pair object is shaped like this:
//
// {
//     a: DOM element,
//     b: DOM element,
//     aMin: Number,
//     bMin: Number,
//     dragging: Boolean,
//     parent: DOM element,
//     isFirst: Boolean,
//     isLast: Boolean,
//     direction: 'horizontal' | 'vertical'
// }
//
// The basic sequence:
//
// 1. Set defaults to something sane. `options` doesn't have to be passed at all.
// 2. Initialize a bunch of strings based on the direction we're splitting.
//    A lot of the behavior in the rest of the library is paramatized down to
//    rely on CSS strings and classes.
// 3. Define the dragging helper functions, and a few helpers to go with them.
// 4. Loop through the elements while pairing them off. Every pair gets an
//    `pair` object, a gutter, and special isFirst/isLast properties.
// 5. Actually size the pair elements, insert gutters and attach event listeners.
var Split = function (ids, options) {
    if ( options === void 0 ) options = {};

    var dimension;
    var clientDimension;
    var clientAxis;
    var position;
    var paddingA;
    var paddingB;
    var elements;

    // All DOM elements in the split should have a common parent. We can grab
    // the first elements parent and hope users read the docs because the
    // behavior will be whacky otherwise.
    var parent = elementOrSelector(ids[0]).parentNode;
    var parentFlexDirection = global.getComputedStyle(parent).flexDirection;

    // Set default options.sizes to equal percentages of the parent element.
    var sizes = options.sizes || ids.map(function () { return 100 / ids.length; });

    // Standardize minSize to an array if it isn't already. This allows minSize
    // to be passed as a number.
    var minSize = options.minSize !== undefined ? options.minSize : 100;
    var minSizes = Array.isArray(minSize) ? minSize : ids.map(function () { return minSize; });
    var gutterSize = options.gutterSize !== undefined ? options.gutterSize : 10;
    var snapOffset = options.snapOffset !== undefined ? options.snapOffset : 30;
    var direction = options.direction || 'horizontal';
    var cursor = options.cursor || (direction === 'horizontal' ? 'ew-resize' : 'ns-resize');
    var gutter = options.gutter || (function (i, gutterDirection) {
        var gut = document.createElement('div');
        gut.className = "gutter gutter-" + gutterDirection;
        return gut
    });
    var elementStyle = options.elementStyle || (function (dim, size, gutSize) {
        var style = {};

        if (typeof size !== 'string' && !(size instanceof String)) {
            if (!isIE8) {
                style[dim] = calc + "(" + size + "% - " + gutSize + "px)";
            } else {
                style[dim] = size + "%";
            }
        } else {
            style[dim] = size;
        }

        return style
    });
    var gutterStyle = options.gutterStyle || (function (dim, gutSize) { return (( obj = {}, obj[dim] = (gutSize + "px"), obj ))
        var obj; });

    // 2. Initialize a bunch of strings based on the direction we're splitting.
    // A lot of the behavior in the rest of the library is paramatized down to
    // rely on CSS strings and classes.
    if (direction === 'horizontal') {
        dimension = 'width';
        clientDimension = 'clientWidth';
        clientAxis = 'clientX';
        position = 'left';
        paddingA = 'paddingLeft';
        paddingB = 'paddingRight';
    } else if (direction === 'vertical') {
        dimension = 'height';
        clientDimension = 'clientHeight';
        clientAxis = 'clientY';
        position = 'top';
        paddingA = 'paddingTop';
        paddingB = 'paddingBottom';
    }

    // 3. Define the dragging helper functions, and a few helpers to go with them.
    // Each helper is bound to a pair object that contains it's metadata. This
    // also makes it easy to store references to listeners that that will be
    // added and removed.
    //
    // Even though there are no other functions contained in them, aliasing
    // this to self saves 50 bytes or so since it's used so frequently.
    //
    // The pair object saves metadata like dragging state, position and
    // event listener references.

    function setElementSize (el, size, gutSize) {
        // Split.js allows setting sizes via numbers (ideally), or if you must,
        // by string, like '300px'. This is less than ideal, because it breaks
        // the fluid layout that `calc(% - px)` provides. You're on your own if you do that,
        // make sure you calculate the gutter size by hand.
        var style = elementStyle(dimension, size, gutSize);

        // eslint-disable-next-line no-param-reassign
        Object.keys(style).forEach(function (prop) { return (el.style[prop] = style[prop]); });
    }

    function setGutterSize (gutterElement, gutSize) {
        var style = gutterStyle(dimension, gutSize);

        // eslint-disable-next-line no-param-reassign
        Object.keys(style).forEach(function (prop) { return (gutterElement.style[prop] = style[prop]); });
    }

    // Actually adjust the size of elements `a` and `b` to `offset` while dragging.
    // calc is used to allow calc(percentage + gutterpx) on the whole split instance,
    // which allows the viewport to be resized without additional logic.
    // Element a's size is the same as offset. b's size is total size - a size.
    // Both sizes are calculated from the initial parent percentage,
    // then the gutter size is subtracted.
    function adjust (offset) {
        var a = elements[this.a];
        var b = elements[this.b];
        var percentage = a.size + b.size;

        a.size = (offset / this.size) * percentage;
        b.size = (percentage - ((offset / this.size) * percentage));

        setElementSize(a.element, a.size, this.aGutterSize);
        setElementSize(b.element, b.size, this.bGutterSize);
    }

    // drag, where all the magic happens. The logic is really quite simple:
    //
    // 1. Ignore if the pair is not dragging.
    // 2. Get the offset of the event.
    // 3. Snap offset to min if within snappable range (within min + snapOffset).
    // 4. Actually adjust each element in the pair to offset.
    //
    // ---------------------------------------------------------------------
    // |    | <- a.minSize               ||              b.minSize -> |    |
    // |    |  | <- this.snapOffset      ||     this.snapOffset -> |  |    |
    // |    |  |                         ||                        |  |    |
    // |    |  |                         ||                        |  |    |
    // ---------------------------------------------------------------------
    // | <- this.start                                        this.size -> |
    function drag (e) {
        var offset;

        if (!this.dragging) { return }

        // Get the offset of the event from the first side of the
        // pair `this.start`. Supports touch events, but not multitouch, so only the first
        // finger `touches[0]` is counted.
        if ('touches' in e) {
            offset = e.touches[0][clientAxis] - this.start;
        } else {
            offset = e[clientAxis] - this.start;
        }

        // If within snapOffset of min or max, set offset to min or max.
        // snapOffset buffers a.minSize and b.minSize, so logic is opposite for both.
        // Include the appropriate gutter sizes to prevent overflows.
        if (offset <= elements[this.a].minSize + snapOffset + this.aGutterSize) {
            offset = elements[this.a].minSize + this.aGutterSize;
        } else if (offset >= this.size - (elements[this.b].minSize + snapOffset + this.bGutterSize)) {
            offset = this.size - (elements[this.b].minSize + this.bGutterSize);
        }

        // Actually adjust the size.
        adjust.call(this, offset);

        // Call the drag callback continously. Don't do anything too intensive
        // in this callback.
        if (options.onDrag) {
            options.onDrag();
        }
    }

    // Cache some important sizes when drag starts, so we don't have to do that
    // continously:
    //
    // `size`: The total size of the pair. First + second + first gutter + second gutter.
    // `start`: The leading side of the first element.
    //
    // ------------------------------------------------
    // |      aGutterSize -> |||                      |
    // |                     |||                      |
    // |                     |||                      |
    // |                     ||| <- bGutterSize       |
    // ------------------------------------------------
    // | <- start                             size -> |
    function calculateSizes () {
        // Figure out the parent size minus padding.
        var a = elements[this.a].element;
        var b = elements[this.b].element;

        this.size = a[getBoundingClientRect]()[dimension] + b[getBoundingClientRect]()[dimension] + this.aGutterSize + this.bGutterSize;
        this.start = a[getBoundingClientRect]()[position];
    }

    // stopDragging is very similar to startDragging in reverse.
    function stopDragging () {
        var self = this;
        var a = elements[self.a].element;
        var b = elements[self.b].element;

        if (self.dragging && options.onDragEnd) {
            options.onDragEnd();
        }

        self.dragging = false;

        // Remove the stored event listeners. This is why we store them.
        global[removeEventListener]('mouseup', self.stop);
        global[removeEventListener]('touchend', self.stop);
        global[removeEventListener]('touchcancel', self.stop);

        self.parent[removeEventListener]('mousemove', self.move);
        self.parent[removeEventListener]('touchmove', self.move);

        // Delete them once they are removed. I think this makes a difference
        // in memory usage with a lot of splits on one page. But I don't know for sure.
        delete self.stop;
        delete self.move;

        a[removeEventListener]('selectstart', NOOP);
        a[removeEventListener]('dragstart', NOOP);
        b[removeEventListener]('selectstart', NOOP);
        b[removeEventListener]('dragstart', NOOP);

        a.style.userSelect = '';
        a.style.webkitUserSelect = '';
        a.style.MozUserSelect = '';
        a.style.pointerEvents = '';

        b.style.userSelect = '';
        b.style.webkitUserSelect = '';
        b.style.MozUserSelect = '';
        b.style.pointerEvents = '';

        self.gutter.style.cursor = '';
        self.parent.style.cursor = '';
    }

    // startDragging calls `calculateSizes` to store the inital size in the pair object.
    // It also adds event listeners for mouse/touch events,
    // and prevents selection while dragging so avoid the selecting text.
    function startDragging (e) {
        // Alias frequently used variables to save space. 200 bytes.
        var self = this;
        var a = elements[self.a].element;
        var b = elements[self.b].element;

        // Call the onDragStart callback.
        if (!self.dragging && options.onDragStart) {
            options.onDragStart();
        }

        // Don't actually drag the element. We emulate that in the drag function.
        e.preventDefault();

        // Set the dragging property of the pair object.
        self.dragging = true;

        // Create two event listeners bound to the same pair object and store
        // them in the pair object.
        self.move = drag.bind(self);
        self.stop = stopDragging.bind(self);

        // All the binding. `window` gets the stop events in case we drag out of the elements.
        global[addEventListener]('mouseup', self.stop);
        global[addEventListener]('touchend', self.stop);
        global[addEventListener]('touchcancel', self.stop);

        self.parent[addEventListener]('mousemove', self.move);
        self.parent[addEventListener]('touchmove', self.move);

        // Disable selection. Disable!
        a[addEventListener]('selectstart', NOOP);
        a[addEventListener]('dragstart', NOOP);
        b[addEventListener]('selectstart', NOOP);
        b[addEventListener]('dragstart', NOOP);

        a.style.userSelect = 'none';
        a.style.webkitUserSelect = 'none';
        a.style.MozUserSelect = 'none';
        a.style.pointerEvents = 'none';

        b.style.userSelect = 'none';
        b.style.webkitUserSelect = 'none';
        b.style.MozUserSelect = 'none';
        b.style.pointerEvents = 'none';

        // Set the cursor, both on the gutter and the parent element.
        // Doing only a, b and gutter causes flickering.
        self.gutter.style.cursor = cursor;
        self.parent.style.cursor = cursor;

        // Cache the initial sizes of the pair.
        calculateSizes.call(self);
    }

    // 5. Create pair and element objects. Each pair has an index reference to
    // elements `a` and `b` of the pair (first and second elements).
    // Loop through the elements while pairing them off. Every pair gets a
    // `pair` object, a gutter, and isFirst/isLast properties.
    //
    // Basic logic:
    //
    // - Starting with the second element `i > 0`, create `pair` objects with
    //   `a = i - 1` and `b = i`
    // - Set gutter sizes based on the _pair_ being first/last. The first and last
    //   pair have gutterSize / 2, since they only have one half gutter, and not two.
    // - Create gutter elements and add event listeners.
    // - Set the size of the elements, minus the gutter sizes.
    //
    // -----------------------------------------------------------------------
    // |     i=0     |         i=1         |        i=2       |      i=3     |
    // |             |       isFirst       |                  |     isLast   |
    // |           pair 0                pair 1             pair 2           |
    // |             |                     |                  |              |
    // -----------------------------------------------------------------------
    var pairs = [];
    elements = ids.map(function (id, i) {
        // Create the element object.
        var element = {
            element: elementOrSelector(id),
            size: sizes[i],
            minSize: minSizes[i],
        };

        var pair;

        if (i > 0) {
            // Create the pair object with it's metadata.
            pair = {
                a: i - 1,
                b: i,
                dragging: false,
                isFirst: (i === 1),
                isLast: (i === ids.length - 1),
                direction: direction,
                parent: parent,
            };

            // For first and last pairs, first and last gutter width is half.
            pair.aGutterSize = gutterSize;
            pair.bGutterSize = gutterSize;

            if (pair.isFirst) {
                pair.aGutterSize = gutterSize / 2;
            }

            if (pair.isLast) {
                pair.bGutterSize = gutterSize / 2;
            }

            // if the parent has a reverse flex-direction, switch the pair elements.
            if (parentFlexDirection === 'row-reverse' || parentFlexDirection === 'column-reverse') {
                var temp = pair.a;
                pair.a = pair.b;
                pair.b = temp;
            }
        }

        // Determine the size of the current element. IE8 is supported by
        // staticly assigning sizes without draggable gutters. Assigns a string
        // to `size`.
        //
        // IE9 and above
        if (!isIE8) {
            // Create gutter elements for each pair.
            if (i > 0) {
                var gutterElement = gutter(i, direction);
                setGutterSize(gutterElement, gutterSize);

                gutterElement[addEventListener]('mousedown', startDragging.bind(pair));
                gutterElement[addEventListener]('touchstart', startDragging.bind(pair));

                parent.insertBefore(gutterElement, element.element);

                pair.gutter = gutterElement;
            }
        }

        // Set the element size to our determined size.
        // Half-size gutters for first and last elements.
        if (i === 0 || i === ids.length - 1) {
            setElementSize(element.element, element.size, gutterSize / 2);
        } else {
            setElementSize(element.element, element.size, gutterSize);
        }

        var computedSize = element.element[getBoundingClientRect]()[dimension];

        if (computedSize < element.minSize) {
            element.minSize = computedSize;
        }

        // After the first iteration, and we have a pair object, append it to the
        // list of pairs.
        if (i > 0) {
            pairs.push(pair);
        }

        return element
    });

    function setSizes (newSizes) {
        newSizes.forEach(function (newSize, i) {
            if (i > 0) {
                var pair = pairs[i - 1];
                var a = elements[pair.a];
                var b = elements[pair.b];

                a.size = newSizes[i - 1];
                b.size = newSize;

                setElementSize(a.element, a.size, pair.aGutterSize);
                setElementSize(b.element, b.size, pair.bGutterSize);
            }
        });
    }

    function destroy () {
        pairs.forEach(function (pair) {
            pair.parent.removeChild(pair.gutter);
            elements[pair.a].element.style[dimension] = '';
            elements[pair.b].element.style[dimension] = '';
        });
    }

    if (isIE8) {
        return {
            setSizes: setSizes,
            destroy: destroy,
        }
    }

    return {
        setSizes: setSizes,
        getSizes: function getSizes () {
            return elements.map(function (element) { return element.size; })
        },
        collapse: function collapse (i) {
            if (i === pairs.length) {
                var pair = pairs[i - 1];

                calculateSizes.call(pair);

                if (!isIE8) {
                    adjust.call(pair, pair.size - pair.bGutterSize);
                }
            } else {
                var pair$1 = pairs[i];

                calculateSizes.call(pair$1);

                if (!isIE8) {
                    adjust.call(pair$1, pair$1.aGutterSize);
                }
            }
        },
        destroy: destroy,
    }
};

return Split;

})));

},{}],2:[function(require,module,exports){
var globalData        = require("./global.js");

var traceColorMap = 
[ 
    // Light Mode, Dark Mode
    ["#C83232B4" , "#C83232B4"],
    ["#CC6600C8" , "#CC6600C8"],
    ["#CC9900C8" , "#CC9900C8"],
    ["#336600C8" , "#336600C8"],
    ["#666633C8" , "#666633C8"],
    ["#FFCC33C8" , "#FFCC33C8"],
    ["#669900C8" , "#669900C8"],
    ["#999966C8" , "#999966C8"],
    ["#99CC99C8" , "#99CC99C8"],
    ["#669999C8" , "#669999C8"],
    ["#33CC99C8" , "#33CC99C8"],
    ["#669966C8" , "#669966C8"],
    ["#336666C8" , "#336666C8"],
    ["#009966C8" , "#009966C8"],
    ["#006699C8" , "#006699C8"],
    ["#3232C8B4" , "#3232C8B4"],
];
//                         Light Mode, Dark Mode
var padColor_Default     = ["#878787", "#878787"]   ;
var padColor_Pin1        = ["#ffb629", "#ffb629"]   ;
var padColor_IsHighlited = ["#D04040", "#D04040"]   ;
var padColor_IsPlaced    = ["#40D040", "#40D040"];

//                               Light Mode, Dark Mode
var boundingBoxColor_Default   = ["#878787", "#878787"];
var boundingBoxColor_Placed    = ["#40D040", "#40D040"];
var boundingBoxColor_Highlited = ["#D04040", "#D04040"];
var boundingBoxColor_Debug     = ["#2977ff", "#2977ff"];



var drillColor    = ["#CCCCCC", "#CCCCCC"];
var viaColor      = ["#000000", "#000000"];

//                 Light Mode, Dark Mode
var pcbEdgeColor = ["#000000FF","#FFFFFFFF"];


/*
    Currently 2 supported color palette. 
    Palette 0 is for light mode, and palette 1 
    id for dark mode.
*/
function GetColorPalette()
{
    return (globalData.readStorage("darkmode") === "true") ? 1 : 0;
}

function GetTraceColor(traceLayer)
{
    return traceColorMap[traceLayer][GetColorPalette()];
}



function GetBoundingBoxColor(isHighlited, isPlaced)
{
    let result = boundingBoxColor_Default;

    // Order of color selection.
    if (isPlaced) 
    {
        result     = boundingBoxColor_Placed[GetColorPalette()];
    }
    // Highlighted and not placed
    else if(isHighlited)
    {
        result     = boundingBoxColor_Highlited[GetColorPalette()];
    }
    /* 
        If debug mode is enabled then force drawing a bounding box
      not highlighted,  not placed, and debug mode active
    */
    else if(globalData.getDebugMode())
    {
        result = boundingBoxColor_Debug[GetColorPalette()];
    }
    else
    {
        result = boundingBoxColor_Default[GetColorPalette()];
    }
    return result;
}


function GetPadColor(isPin1, isHighlited, isPlaced)
{
    let result = padColor_Default;

    if(isPin1)
    {
        result = padColor_Pin1[GetColorPalette()];
    }
    else if(isPlaced && isHighlited)
    {
        result = padColor_IsPlaced[GetColorPalette()];
    }
    else if(isHighlited)
    {
        result = padColor_IsHighlited[GetColorPalette()];
    }
    else
    {
        result = padColor_Default[GetColorPalette()];
    }
    return result;
}

function GetPCBEdgeColor()
{
    return pcbEdgeColor[GetColorPalette()];
}

function GetViaColor()
{
    return viaColor[GetColorPalette()];
}

function GetDrillColor()
{
    return drillColor[GetColorPalette()];
}

module.exports = {
    GetTraceColor, GetBoundingBoxColor, GetPadColor, GetPCBEdgeColor,
    GetViaColor, GetDrillColor
};

},{"./global.js":3}],3:[function(require,module,exports){
"use strict";

/*************************************************
              Board Rotation                    
*************************************************/
let storage = undefined;
const storagePrefix = "INTERACTIVE_PCB__" + pcbdata.metadata.title + "__" + pcbdata.metadata.revision + "__"

function initStorage ()
{
    try
    {
        window.localStorage.getItem("blank");
        storage = window.localStorage;
    }
    catch (e)
    {
        console.log("ERROR: Storage init error");
    }

    if (!storage)
    {
        try
        {
            window.sessionStorage.getItem("blank");
            storage = window.sessionStorage;
        }
        catch (e)
        {
            console.log("ERROR: Session storage not available");
            // sessionStorage also not available
        }
    }
}

function readStorage(key)
{
    if (storage)
    {
        return storage.getItem(storagePrefix + "#" + key);
    }
    else
    {
        return null;
    }
}

function writeStorage(key, value)
{
    if (storage)
    {
        storage.setItem(storagePrefix + "#" + key, value);
    }
}

/************************************************/

/*************************************************
              Highlighted Refs                    
*************************************************/
let highlightedRefs = [];

function setHighlightedRefs(refs)
{
    highlightedRefs = refs.split(",");
}

function getHighlightedRefs()
{
    return highlightedRefs;
}
/************************************************/

/*************************************************
              Redraw On Drag                      
*************************************************/
let redrawOnDrag = true;

function setRedrawOnDrag(value)
{
    redrawOnDrag = value;
    writeStorage("redrawOnDrag", value);
}

function getRedrawOnDrag()
{
    return redrawOnDrag;
}

/************************************************/


/*************************************************
                 Debug Mode                       
*************************************************/
let debugMode = false;

function setDebugMode(value)
{
    debugMode = value;
    writeStorage("debugMode", value);
}

function getDebugMode()
{
    return debugMode;
}

/************************************************/

/*************************************************
layer Split
*************************************************/
let layersplit;

function setLayerSplit(value)
{
    layersplit = value;
}

function getLayerSplit()
{
    return layersplit;
}

function destroyLayerSplit()
{
    layersplit.destroy();
}

/*************************************************
BOM Split
*************************************************/
let bomsplit;

function setBomSplit(value)
{
    bomsplit = value;
}

function getBomSplit()
{
    return bomsplit;
}

function destroyBomSplit()
{
    bomsplit.destroy();
}

/************************************************/

/*************************************************
Canvas Split
*************************************************/
let canvassplit;

function setCanvasSplit(value)
{
    canvassplit = value;
}

function getCanvasSplit()
{
    return canvassplit;
}

function destroyCanvasSplit()
{
    canvassplit.destroy();
}

function collapseCanvasSplit(value)
{
    canvassplit.collapse(value);
}

function setSizesCanvasSplit()
{
    canvassplit.setSizes([50, 50]);
}

/************************************************/

/*************************************************
Canvas Layout
*************************************************/
let canvaslayout = "FB";

/*XXX Found a bug at startup. Code assumes that canvas layout 
is in one of three states. then system fails. he bug was that the 
canvasLayout was being set to 'default' which is not a valid state. 
So no is check that if default is sent in then set the layout to FB mode.
*/
/* TODO: Make the default check below actually check that the item 
is in one of the three valid states. If not then set to FB, otherwise set to one of
the three valid states
*/
function setCanvasLayout(value)
{
    if(value == "default")
    {
        canvaslayout = "FB";
    }
    else
    {
        canvaslayout = value;
    }
}

function getCanvasLayout()
{
    return canvaslayout;
}

/************************************************/

/*************************************************
BOM Layout
*************************************************/
let bomlayout = "default";

function setBomLayout(value)
{
    bomlayout = value;
}

function getBomLayout()
{
    return bomlayout;
}

/************************************************/

/*************************************************
BOM Sort Function
*************************************************/
let bomSortFunction = null;

function setBomSortFunction(value)
{
    bomSortFunction = value;
}

function getBomSortFunction()
{
    return bomSortFunction;
}

/************************************************/

/*************************************************
Current Sort Column
*************************************************/
let currentSortColumn = null;

function setCurrentSortColumn(value)
{
    currentSortColumn = value;
}

function getCurrentSortColumn()
{
    return currentSortColumn;
}

/************************************************/

/*************************************************
Current Sort Order
*************************************************/
let currentSortOrder = null;

function setCurrentSortOrder(value)
{
    currentSortOrder = value;
}

function getCurrentSortOrder()
{
    return currentSortOrder;
}

/************************************************/

/*************************************************
Current Highlighted Row ID
*************************************************/
let currentHighlightedRowId;

function setCurrentHighlightedRowId(value)
{
    currentHighlightedRowId = value;
}

function getCurrentHighlightedRowId()
{
    return currentHighlightedRowId;
}

/************************************************/

/*************************************************
Highlight Handlers
*************************************************/
let highlightHandlers = [];

function setHighlightHandlers(values)
{
    highlightHandlers = values;
}

function getHighlightHandlers(){
    return highlightHandlers;
}

function pushHighlightHandlers(value)
{
    highlightHandlers.push(value);
}

/************************************************/

/*************************************************
Checkboxes
*************************************************/
let checkboxes = [];

function setCheckboxes(values)
{
    checkboxes = values;
}

function getCheckboxes()
{
    return checkboxes;
}

/************************************************/

/*************************************************
BOM Checkboxes
*************************************************/
let bomCheckboxes = "";

function setBomCheckboxes(values)
{
    bomCheckboxes = values;
}

function getBomCheckboxes()
{
    return bomCheckboxes;
}
/************************************************/

/*************************************************
Remove BOM Entries
*************************************************/
let removeBOMEntries = "";

function setRemoveBOMEntries(values)
{
    removeBOMEntries = values;
}

function getRemoveBOMEntries()
{
    return removeBOMEntries;
}
/************************************************/


/*************************************************
Remove BOM Entries
*************************************************/
let additionalAttributes = "";

function setAdditionalAttributes(values)
{
    additionalAttributes = values;
}

function getAdditionalAttributes(){
    return additionalAttributes;
}
/************************************************/


/*************************************************
Highlight Pin 1
*************************************************/
let highlightpin1 = false;

function setHighlightPin1(value)
{
    writeStorage("highlightpin1", value);
    highlightpin1 = value;
}

function getHighlightPin1(){
    return highlightpin1;
}

/************************************************/

/*************************************************
Last Clicked Ref
*************************************************/
let lastClickedRef;

function setLastClickedRef(value)
{
    lastClickedRef = value;
}

function getLastClickedRef()
{
    return lastClickedRef;
}

/************************************************/


/*************************************************
Combine Values
*************************************************/
let combineValues = false;

function setCombineValues(value)
{
    writeStorage("combineValues", value);
    combineValues = value;
}

function getCombineValues()
{
    return combineValues;
}
/************************************************/



/*************************************************
Combine Values
*************************************************/
let hidePlacedParts = false;

function setHidePlacedParts(value)
{
    writeStorage("hidePlacedParts", value);
    hidePlacedParts = value;
}

function getHidePlacedParts()
{
    return hidePlacedParts;
}
/************************************************/

let allcanvas =  undefined;

function SetAllCanvas(value)
{
    allcanvas = value;
}

function GetAllCanvas()
{
    return allcanvas;
}


let boardRotation = 0;
function SetBoardRotation(value)
{
    boardRotation = value;
}

function GetBoardRotation()
{
    return boardRotation;
}


module.exports = {
    initStorage                , readStorage                , writeStorage          ,
    setHighlightedRefs         , getHighlightedRefs         ,
    setRedrawOnDrag            , getRedrawOnDrag            ,
    setDebugMode               , getDebugMode               ,
    setBomSplit                , getBomSplit                , destroyBomSplit       ,
    setLayerSplit              , getLayerSplit              , destroyLayerSplit     ,
    setCanvasSplit             , getCanvasSplit             , destroyCanvasSplit    , collapseCanvasSplit , setSizesCanvasSplit ,
    setCanvasLayout            , getCanvasLayout            ,
    setBomLayout               , getBomLayout               ,
    setBomSortFunction         , getBomSortFunction         ,
    setCurrentSortColumn       , getCurrentSortColumn       ,
    setCurrentSortOrder        , getCurrentSortOrder        ,
    setCurrentHighlightedRowId , getCurrentHighlightedRowId ,
    setHighlightHandlers       , getHighlightHandlers       , pushHighlightHandlers ,
    setCheckboxes              , getCheckboxes              ,
    setBomCheckboxes           , getBomCheckboxes           ,
    setRemoveBOMEntries        , getRemoveBOMEntries        ,
    setAdditionalAttributes    , getAdditionalAttributes    ,
    setHighlightPin1           , getHighlightPin1           ,
    setLastClickedRef          , getLastClickedRef          ,
    setCombineValues           , getCombineValues           ,
    setHidePlacedParts         , getHidePlacedParts         ,
    SetAllCanvas               , GetAllCanvas               ,
    SetBoardRotation           , GetBoardRotation

};
},{}],4:[function(require,module,exports){
var globalData = require("./global.js");
var render     = require("./render.js");

function handleMouseDown(e, layerdict) 
{
    if (e.which != 1) 
    {
        return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    layerdict.transform.mousestartx = e.offsetX;
    layerdict.transform.mousestarty = e.offsetY;
    layerdict.transform.mousedownx = e.offsetX;
    layerdict.transform.mousedowny = e.offsetY;
    layerdict.transform.mousedown = true;
}

function smoothScrollToRow(rowid) 
{
    document.getElementById(rowid).scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
    });
}

function modulesClicked(references) 
{
    let lastClickedIndex = references.indexOf(globalData.getLastClickedRef());
    let ref = references[(lastClickedIndex + 1) % references.length];
    for (let handler of globalData.getHighlightHandlers()) 
    {
        if (handler.refs.indexOf(ref) >= 0) 
        {
            globalData.setLastClickedRef(ref);
            handler.handler();
            smoothScrollToRow(globalData.getCurrentHighlightedRowId());
            break;
        }
    }
}
function bboxScan(layer, x, y) 
{
    let result = [];
    for (let part of pcbdata.parts) 
    {
        if( part.location == layer)
        {
            let b = part.package.bounding_box;
            if (    (x > b.x0 )
                        && (x < b.x1 )
                        && (y > b.y0 )
                        && (y < b.y1 )
            )
            {
                result.push(part.name);
            }
        }
    }
    return result;
}


function handleMouseClick(e, layerdict) 
{
    let x = e.offsetX;
    let y = e.offsetY;
    let t = layerdict.transform;
    if (layerdict.layer != "B") 
    {
        x = (2 * x / t.zoom - t.panx + t.x) / -t.s;
    } 
    else 
    {
        x = (2 * x / t.zoom - t.panx - t.x) / t.s;
    }
    y = (2 * y / t.zoom - t.y - t.pany) / t.s;
    let v = render.RotateVector([x, y], -globalData.GetBoardRotation());
    let reflist = bboxScan(layerdict.layer, v[0], v[1], t);
    if (reflist.length > 0) 
    {
        modulesClicked(reflist);
        render.drawHighlights();
    }
}

function handleMouseUp(e, layerdict) 
{
    e.preventDefault();
    e.stopPropagation();
    if (    e.which == 1
         && layerdict.transform.mousedown
         && layerdict.transform.mousedownx == e.offsetX
         && layerdict.transform.mousedowny == e.offsetY
    ) 
    {
        // This is just a click
        handleMouseClick(e, layerdict);
        layerdict.transform.mousedown = false;
        return;
    }
    if (e.which == 3) 
    {
        // Reset pan and zoom on right click.
        layerdict.transform.panx = 0;
        layerdict.transform.pany = 0;
        layerdict.transform.zoom = 1;
        render.drawCanvas(layerdict);
    } 
    else if (!globalData.getRedrawOnDrag()) 
    {
        render.drawCanvas(layerdict);
    }
    layerdict.transform.mousedown = false;
}

function handleMouseMove(e, layerdict) 
{
    if (!layerdict.transform.mousedown) 
    {
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    let dx = e.offsetX - layerdict.transform.mousestartx;
    let dy = e.offsetY - layerdict.transform.mousestarty;
    layerdict.transform.panx += 2 * dx / layerdict.transform.zoom;
    layerdict.transform.pany += 2 * dy / layerdict.transform.zoom;
    layerdict.transform.mousestartx = e.offsetX;
    layerdict.transform.mousestarty = e.offsetY;
    
    if (globalData.getRedrawOnDrag()) 
    {
        render.drawCanvas(layerdict);
    }
}

function handleMouseWheel(e, layerdict) 
{
    e.preventDefault();
    e.stopPropagation();
    var t = layerdict.transform;
    var wheeldelta = e.deltaY;
    if (e.deltaMode == 1) 
    {
        // FF only, scroll by lines
        wheeldelta *= 30;
    } 
    else if (e.deltaMode == 2) 
    {
        wheeldelta *= 300;
    }
    
    var m = Math.pow(1.1, -wheeldelta / 40);
    // Limit amount of zoom per tick.
    if (m > 2) 
    {
        m = 2;
    } 
    else if (m < 0.5) 
    {
        m = 0.5;
    }
    
    t.zoom *= m;
    var zoomd = (1 - m) / t.zoom;
    t.panx += 2 * e.offsetX * zoomd;
    t.pany += 2 * e.offsetY * zoomd;
    render.drawCanvas(layerdict);
    render.drawHighlights();
}

function addMouseHandlers(div, layerdict) 
{
    div.onmouseclick = function(e)
    {
        handleMouseClick(e, layerdict);
    };

    div.onmousedown = function(e) 
    {
        handleMouseDown(e, layerdict);
    };
    
    div.onmousemove = function(e) 
    {
        handleMouseMove(e, layerdict);
    };
    
    div.onmouseup = function(e) 
    {
        handleMouseUp(e, layerdict);
    };
    
    div.onmouseout = function(e) 
    {
        handleMouseUp(e, layerdict);
    };

    div.onwheel = function(e) 
    {
        handleMouseWheel(e, layerdict);
    };
    
    
    for (var element of [div]) 
    {
        element.addEventListener("contextmenu", function(e) 
        {
            e.preventDefault();
        }, false);
    }
}

module.exports = {
    addMouseHandlers
};

},{"./global.js":3,"./render.js":8}],5:[function(require,module,exports){
var globalData = require("./global.js");
var render     = require("./render.js");
var ibom       = require("./ibom.js");

const boardRotation = document.getElementById("boardRotation");
boardRotation.oninput=function()
{
    render.SetBoardRotation(boardRotation.value);
};

const darkModeBox = document.getElementById("darkmodeCheckbox");
darkModeBox.onchange = function () 
{
    ibom.setDarkMode(darkModeBox.checked);
};

const silkscreenCheckbox = document.getElementById("silkscreenCheckbox");
silkscreenCheckbox.checked=function()
{
    ibom.silkscreenVisible(silkscreenCheckbox.checked);
};

silkscreenCheckbox.onchange=function()
{
    ibom.silkscreenVisible(silkscreenCheckbox.checked);
};

const highlightpin1Checkbox =document.getElementById("highlightpin1Checkbox");
highlightpin1Checkbox.onchange=function()
{
    globalData.setHighlightPin1(highlightpin1Checkbox.checked);
    render.drawCanvas(allcanvas.front);
    render.drawCanvas(allcanvas.back);
};

const dragCheckbox = document.getElementById("dragCheckbox");
dragCheckbox.checked=function()
{
    globalData.setRedrawOnDrag(dragCheckbox.checked);
};
dragCheckbox.onchange=function()
{
    globalData.setRedrawOnDrag(dragCheckbox.checked);
};


const combineValues = document.getElementById("combineValues");
combineValues.onchange=function()
{
    globalData.setCombineValues(combineValues.checked);
    ibom.populateBomTable();
};


const hidePlacedParts = document.getElementById("hidePlacedParts");
hidePlacedParts.onchange=function()
{
    globalData.setHidePlacedParts(hidePlacedParts.checked);
    ibom.populateBomTable();
};

const debugModeBox = document.getElementById("debugMode");
debugModeBox.onchange=function()
{
    globalData.setDebugMode(debugModeBox.checked);
    render.drawCanvas(allcanvas.front);
    render.drawCanvas(allcanvas.back);
};




const filterBOM = document.getElementById("bom-filter");
filterBOM.oninput=function()
{
    ibom.setFilterBOM(filterBOM.value);
};

const clearFilterBOM = document.getElementById("clearBOMSearch");
clearFilterBOM.onclick=function()
{
    filterBOM.value="";
    ibom.setFilterBOM(filterBOM.value);
};

const filterLayer = document.getElementById("layer-filter");
filterLayer.oninput=function()
{
    ibom.setFilterLayer(filterLayer.value);
};

const clearFilterLayer = document.getElementById("clearLayerSearch");
clearFilterLayer.onclick=function()
{
    filterLayer.value="";
    ibom.setFilterLayer(filterLayer.value);
};

const bomCheckboxes = document.getElementById("bomCheckboxes");
bomCheckboxes.oninput=function()
{
    ibom.setBomCheckboxes(bomCheckboxes.value);
};

const removeBOMEntries = document.getElementById("removeBOMEntries");
removeBOMEntries.oninput=function()
{
    ibom.setRemoveBOMEntries(removeBOMEntries.value);
};

const additionalAttributes = document.getElementById("additionalAttributes");
additionalAttributes.oninput=function()
{
    ibom.setAdditionalAttributes(additionalAttributes.value);
};

const fl_btn = document.getElementById("fl-btn");
fl_btn.onclick=function()
{
    ibom.changeCanvasLayout("F");
};

const fb_btn = document.getElementById("fb-btn");
fb_btn.onclick=function()
{
    ibom.changeCanvasLayout("FB");
};

const bl_btn = document.getElementById("bl-btn");
bl_btn.onclick=function()
{
    ibom.changeCanvasLayout("B");
};

const bom_btn = document.getElementById("bom-btn");
bom_btn.onclick=function()
{
    ibom.changeBomLayout("BOM");
};

const lr_btn = document.getElementById("bom-lr-btn");
lr_btn.onclick=function()
{
    ibom.changeBomLayout("LR");
};

const tb_btn = document.getElementById("bom-tb-btn");
tb_btn.onclick=function()
{
    ibom.changeBomLayout("TB");
};

const pcb_btn = document.getElementById("pcb-btn");
pcb_btn.onclick=function()
{
    ibom.changeBomLayout("PCB");
};
},{"./global.js":3,"./ibom.js":6,"./render.js":8}],6:[function(require,module,exports){
/* DOM manipulation and misc code */

"use strict";
var Split      = require("split.js");
var globalData = require("./global.js");
var render     = require("./render.js");
var pcb        = require("./pcb.js");
var handlers_mouse    = require("./handlers_mouse.js");



//TODO: GLOBAL VARIABLES
let layerBody = undefined;
let layerHead = undefined;
let bomhead   = undefined;
let topmostdiv = undefined;
let bom = undefined;
let bomtable = undefined;

//TODO:  GLOBAL VARIABLE REFACTOR
let filterBOM = "";
function getFilterBOM() 
{
    return filterBOM;
}

function setFilterBOM(input) 
{
    filterBOM = input.toLowerCase();
    populateBomTable();
}


let filterLayer = "";
function getFilterLayer() 
{
    return filterLayer;
}

function setFilterLayer(input) 
{
    filterLayer = input.toLowerCase();
    populateLayerTable();
}

function setDarkMode(value)
{
    if (value)
    {
        topmostdiv.classList.add("dark");
    }
    else
    {
        topmostdiv.classList.remove("dark");
    }
    globalData.writeStorage("darkmode", value);
    render.drawCanvas(globalData.GetAllCanvas().front);
    render.drawCanvas(globalData.GetAllCanvas().back);
}

function createCheckboxChangeHandler(checkbox, bomentry)
{
    return function() 
    {
        if(bomentry.checkboxes.get(checkbox))
        {
            bomentry.checkboxes.set(checkbox,false);
            globalData.writeStorage("checkbox" + "_" + checkbox.toLowerCase() + "_" + bomentry.reference, "false");
        }
        else
        {
            bomentry.checkboxes.set(checkbox,true);
            globalData.writeStorage("checkbox" + "_" + checkbox.toLowerCase() + "_" + bomentry.reference, "true");
        }
        // Save currently highlited row
        let rowid = globalData.getCurrentHighlightedRowId();
        // Redraw the canvas
        render.drawCanvas(globalData.GetAllCanvas().front);
        render.drawCanvas(globalData.GetAllCanvas().back);
        // Redraw the BOM table
        populateBomTable();
        // Render current row so its highlighted
        document.getElementById(rowid).classList.add("highlighted");
        // Set current selected row global variable
        globalData.setCurrentHighlightedRowId(rowid);
        // If highlighted then a special color will be used for the part.
        render.drawHighlights(IsCheckboxClicked(globalData.getCurrentHighlightedRowId(), "placed"));
    };
}

function createRowHighlightHandler(rowid, refs)
{
    return function()
    {
        if (globalData.getCurrentHighlightedRowId())
        {
            if (globalData.getCurrentHighlightedRowId() == rowid)
            {
                return;
            }
            document.getElementById(globalData.getCurrentHighlightedRowId()).classList.remove("highlighted");
        }

        document.getElementById(rowid).classList.add("highlighted");
        globalData.setCurrentHighlightedRowId(rowid);
        globalData.setHighlightedRefs(refs);
        // If highlighted then a special color will be used for the part.
        render.drawHighlights(IsCheckboxClicked(globalData.getCurrentHighlightedRowId(), "placed"));
    }
}

function entryMatches(part)
{
    // check refs
    if (part.reference.toLowerCase().indexOf(getFilterBOM()) >= 0)
    {
        return true;
    }
    // check value
    if (part.value.toLowerCase().indexOf(getFilterBOM())>= 0)
    {
        return true;
    } 
    // check footprint
    if (part.package.toLowerCase().indexOf(getFilterBOM())>= 0)
    {
        return true;
    }

    // Check the displayed attributes
    let additionalAttributes = globalData.getAdditionalAttributes().split(",");
    additionalAttributes     = additionalAttributes.filter(function(e){return e;});
    for (let x of additionalAttributes)
    {
        // remove beginning and trailing whitespace
        x = x.trim();
        if (part.attributes.has(x))
        {
            if(part.attributes.get(x).indexOf(getFilterBOM()) >= 0)
            {
                return true;
            }
        }
    }

    return false;
}

function entryMatchesLayer(layer) 
{
    // check refs
    if (layer.name.toLowerCase().indexOf(getFilterLayer()) >= 0) 
    {
        return true;
    }
    return false;
}
function highlightFilterLayer(s) 
{
    if (!getFilterLayer()) 
    {
        return s;
    }
    let parts = s.toLowerCase().split(getFilterLayer());
    if (parts.length == 1) 
    {
        return s;
    }
    let r = "";
    let pos = 0;
    for (let i in parts) 
    {
        if (i > 0) 
        {
            r += "<mark class=\"highlight\">" + s.substring(pos, pos + getFilterLayer().length) + "</mark>";
            pos += getFilterLayer().length;
        }
        r += s.substring(pos, pos + parts[i].length);
        pos += parts[i].length;
    }
    return r;
}


function highlightFilter(s)
{
    if (!getFilterBOM()) 
    {
        return s;
    }
    let parts = s.toLowerCase().split(getFilterBOM());
    if (parts.length == 1)
    {
        return s;
    }

    let r = "";
    let pos = 0;
    for (let i in parts)
    {
        if (i > 0)
        {
            r += "<mark class=\"highlight\">" + s.substring(pos, pos + getFilterBOM().length) + "</mark>";
            pos += getFilterBOM().length;
        }
        r += s.substring(pos, pos + parts[i].length);
        pos += parts[i].length;
    }
    return r;
}

function createColumnHeader(name, cls, comparator)
{
    let th = document.createElement("TH");
    th.innerHTML = name;
    th.classList.add(cls);
    th.style.cursor = "pointer";
    let span = document.createElement("SPAN");
    span.classList.add("sortmark");
    span.classList.add("none");
    th.appendChild(span);
    th.onclick = function()
    {
        if (globalData.getCurrentSortColumn() && this !== globalData.getCurrentSortColumn()) 
        {
            // Currently sorted by another column
            globalData.getCurrentSortColumn().childNodes[1].classList.remove(globalData.getCurrentSortOrder());
            globalData.getCurrentSortColumn().childNodes[1].classList.add("none");
            globalData.setCurrentSortColumn(null);
            globalData.setCurrentSortOrder(null);
        }

        if (globalData.getCurrentSortColumn() && this === globalData.getCurrentSortColumn()) 
        {
            // Already sorted by this column
            if (globalData.getCurrentSortOrder() == "asc") 
            {
                // Sort by this column, descending order
                globalData.setBomSortFunction(function(a, b) 
                {
                    return -comparator(a, b);
                });
                globalData.getCurrentSortColumn().childNodes[1].classList.remove("asc");
                globalData.getCurrentSortColumn().childNodes[1].classList.add("desc");
                globalData.setCurrentSortOrder("desc");
            } 
            else 
            {
                // Unsort
                globalData.setBomSortFunction(null);
                globalData.getCurrentSortColumn().childNodes[1].classList.remove("desc");
                globalData.getCurrentSortColumn().childNodes[1].classList.add("none");
                globalData.setCurrentSortColumn(null);
                globalData.setCurrentSortOrder(null);
            }
        }
        else
        {
            // Sort by this column, ascending order
            globalData.setBomSortFunction(comparator);
            globalData.setCurrentSortColumn(this);
            globalData.getCurrentSortColumn().childNodes[1].classList.remove("none");
            globalData.getCurrentSortColumn().childNodes[1].classList.add("asc");
            globalData.setCurrentSortOrder("asc");
        }
        populateBomBody();
    }
    return th;
}

// Describes how to sort checkboxes
function CheckboxCompare(stringName)
{
    return (partA, partB) => {
        if (partA.checkboxes.get(stringName) && !partB.checkboxes.get(stringName)) 
        {
            return  1;
        }
        else if (!partA.checkboxes.get(stringName) && partB.checkboxes.get(stringName)) 
        {
            return -1;
        } 
        else
        {
            return 0;
        }
    }
}

// Describes hoe to sort by attributes
function AttributeCompare(stringName)
{
    return (partA, partB) => {
        if (partA.attributes.get(stringName) != partB.attributes.get(stringName))
        {
            return  partA.attributes.get(stringName) > partB.attributes.get(stringName) ? 1 : -1;
        }
        else
        {
            return 0;
        }
    }
}

function populateLayerHeader()
{
    while (layerHead.firstChild) 
    {
        layerHead.removeChild(layerHead.firstChild);
    }

    // Header row
    let tr = document.createElement("TR");
    // Defines the
    let th = document.createElement("TH");

    th.classList.add("visiableCol");

    let tr2 = document.createElement("TR");
    let thf = document.createElement("TH");
    let thb = document.createElement("TH");

    thf.innerHTML = "Front"
    thb.innerHTML = "Back"
    tr2.appendChild(thf)
    tr2.appendChild(thb)

    th.innerHTML = "Visible";
    th.colSpan = 2
    let span = document.createElement("SPAN");
    span.classList.add("none");
    th.appendChild(span);
    tr.appendChild(th);

    th = document.createElement("TH");
    th.innerHTML = "Layer";
    th.rowSpan = 2;
    span = document.createElement("SPAN");
    span.classList.add("none");
    th.appendChild(span);
    tr.appendChild(th);

    layerHead.appendChild(tr);
    layerHead.appendChild(tr2);
}

function createLayerCheckboxChangeHandler(layerEntry, isFront) {
    return function() 
    {
        if(isFront)
        {
            if(layerEntry.visible_front)
            {
                pcb.SetLayerVisibility(layerEntry.name, isFront, false);
                globalData.writeStorage("checkbox_layer_front_" + layerEntry.name + "_visible", "false");
            }
            else
            {
                pcb.SetLayerVisibility(layerEntry.name, isFront, true);
                globalData.writeStorage("checkbox_layer_front_" + layerEntry.name + "_visible", "true");
            }
        }
        else
        {
            if(layerEntry.visible_back)
            {
                pcb.SetLayerVisibility(layerEntry.name, isFront, false);
                globalData.writeStorage("checkbox_layer_back_" + layerEntry.name + "_visible", "false");
            }
            else
            {
                pcb.SetLayerVisibility(layerEntry.name, isFront, true);
                globalData.writeStorage("checkbox_layer_back_" + layerEntry.name + "_visible", "true");
            }
        }
    }
}


function populateLayerBody() 
{
    while (layerBody.firstChild) 
    {
        layerBody.removeChild(layerBody.firstChild);
    }
    let layertable =  pcb.GetLayers();

    // remove entries that do not match filter
    for (let i of layertable) 
    {

        if (getFilterLayer() != "")
        {
            if(!entryMatchesLayer(i))
            {
                continue;
            }
        }

        let tr = document.createElement("TR");
        let td = document.createElement("TD");
        let input_front = document.createElement("input");
        let input_back = document.createElement("input");
        input_front.type = "checkbox";
        input_back.type = "checkbox";
        // Assumes that all layers are visible by default.
        if (    (globalData.readStorage( "checkbox_layer_front_" + i.name + "_visible" ) == "true")
             || (globalData.readStorage( "checkbox_layer_front_" + i.name + "_visible" ) == null)
        )
        {
            pcb.SetLayerVisibility(i.name, true, true);
            input_front.checked = true;
        }
        else
        {
            pcb.SetLayerVisibility(i.name, true, false);
            input_front.checked = false;
        }


        if (    (globalData.readStorage( "checkbox_layer_back_" + i.name + "_visible" ) == "true")
             || (globalData.readStorage( "checkbox_layer_back_" + i.name + "_visible" ) == null)
        )
        {
            pcb.SetLayerVisibility(i.name, false, true);
            input_back.checked = true;
        }
        else
        {
            pcb.SetLayerVisibility(i.name, false, false);
            input_back.checked = false;
        }

        
        input_front.onchange = createLayerCheckboxChangeHandler(i, true);
        input_back.onchange  = createLayerCheckboxChangeHandler(i, false);
        td.appendChild(input_front);
        tr.appendChild(td);

        td = document.createElement("TD");
        td.appendChild(input_back);
        tr.appendChild(td);

        // Layer
        td = document.createElement("TD");
        td.innerHTML =highlightFilterLayer(i.name);
        tr.appendChild(td);
        
        layerbody.appendChild(tr);
    }
}

function populateBomHeader() 
{
    while (bomhead.firstChild)
    {
        bomhead.removeChild(bomhead.firstChild);
    }
    
    let tr = document.createElement("TR");
    let th = document.createElement("TH");
    th.classList.add("numCol");
    tr.appendChild(th);


    let additionalCheckboxes = globalData.getBomCheckboxes().split(",");
    additionalCheckboxes     = additionalCheckboxes.filter(function(e){return e});
    globalData.setCheckboxes(additionalCheckboxes);
    for (let x2 of additionalCheckboxes)
    {
        // remove beginning and trailing whitespace
        x2 = x2.trim()
        if (x2) 
        {
            tr.appendChild(createColumnHeader(x2, "Checkboxes", CheckboxCompare(x2)));
        }
    }

    tr.appendChild(createColumnHeader("References", "References", (partA, partB) => {
        if (partA.reference != partB.reference)
        {
            return partA.reference > partB.reference ? 1 : -1;
        }
        else
        {
            return 0;
        }
    }));

    tr.appendChild(createColumnHeader("Value", "Value", (partA, partB) => {
        if (partA.value != partB.value)
        {
            return partA.value > partB.value ? 1 : -1;
        }
        else
        {
            return 0;
        }
    }));

    tr.appendChild(createColumnHeader("Footprint", "Footprint", (partA, partB) => {
        if (partA.package != partB.package)
        {
            return partA.package > partB.package ? 1 : -1;
        }
        else
        {
            return 0;
        }
    }));

    let additionalAttributes = globalData.getAdditionalAttributes().split(",");
    // Remove null, "", undefined, and 0 values
    additionalAttributes    =additionalAttributes.filter(function(e){return e});
    for (let x of additionalAttributes)
    {
        // remove beginning and trailing whitespace
        x = x.trim()
        if (x) 
        {
            tr.appendChild(createColumnHeader(x, "Attributes", AttributeCompare(x)));
        }
    }

    if(globalData.getCombineValues())
    {
            //XXX: This comparison function is using positive and negative implicit
            tr.appendChild(createColumnHeader("Quantity", "Quantity", (partA, partB) => {
            return partA.quantity - partB.quantity;
            }));
    }

    bomhead.appendChild(tr);

}



////////////////////////////////////////////////////////////////////////////////
// Filter functions are defined here. These let the application filter 
// elements out of the complete bom. 
//
// The filtering function should return true if the part should be filtered out
// otherwise it returns false
////////////////////////////////////////////////////////////////////////////////
function GetBOMForSideOfBoard(location)
{
    let result = pcb.GetBOM();
    switch (location)
    {
    case "F":
        result = pcb.filterBOMTable(result, filterBOM_Front);
        break;
    case "B":
        result = pcb.filterBOMTable(result, filterBOM_Back);
        break;
    default:
        break;
    }
    return result;
}

function filterBOM_Front(part)
{
    let result = true;
    if(part.location == "F")
    {
        result = false;
    }
    return result;
}

function filterBOM_Back(part)
{
    let result = true;
    if(part.location == "B")
    {
        result = false;
    }
    return result;
}

function filterBOM_ByAttribute(part)
{
    let result = false;
    let splitFilterString = globalData.getRemoveBOMEntries().split(",");
    // Remove null, "", undefined, and 0 values
    splitFilterString    = splitFilterString.filter(function(e){return e});

    if(splitFilterString.length > 0 )
    {
        for(let i of splitFilterString)
        {
            // removing beginning and trailing whitespace
            i = i.trim()
            if(part.attributes.has(i))
            {
                // Id the value is an empty string then dont filter out the entry. 
                // if the value is anything then filter out the bom entry
                if(part.attributes.get(i) != "")
                {
                    result = true;
                }
            }
        }
    }
    return result;
}
////////////////////////////////////////////////////////////////////////////////

function GenerateBOMTable()
{
    // Get bom table with elements for the side of board the user has selected
    let bomtableTemp = GetBOMForSideOfBoard(globalData.getCanvasLayout());

    // Apply attribute filter to board
    bomtableTemp = pcb.filterBOMTable(bomtableTemp, filterBOM_ByAttribute);

    // If the parts are displayed one per line (not combined values), then the the bom table needs to be flattened. 
    // By default the data in the json file is combined
    bomtable = globalData.getCombineValues() ? pcb.GetBOMCombinedValues(bomtableTemp) : bomtableTemp;

    return bomtable;
}

function populateBomBody()
{
    while (bom.firstChild)
    {
        bom.removeChild(bom.firstChild);
    }

    globalData.setHighlightHandlers([]);
    globalData.setCurrentHighlightedRowId(null);
    let first = true;

    bomtable = GenerateBOMTable();

    if (globalData.getBomSortFunction())
    {
        bomtable = bomtable.slice().sort(globalData.getBomSortFunction());
    }
    for (let i in bomtable)
    {
        let bomentry = bomtable[i];
        let references = bomentry.reference;

        // remove entries that do not match filter
        if (getFilterBOM() != "")
        {
            if(!entryMatches(bomentry))
            {
                continue;
            }
        }

        // Hide placed parts option is set
        if(globalData.getHidePlacedParts())
        {
            // Remove entries that have been placed. Check the placed parameter
            if(globalData.readStorage( "checkbox" + "_" + "placed" + "_" + bomentry.reference ) == "true")
            {
                continue;
            }
        }

        let tr = document.createElement("TR");
        let td = document.createElement("TD");
        let rownum = +i + 1;
        tr.id = "bomrow" + rownum;
        td.textContent = rownum;
        tr.appendChild(td);

        // Checkboxes
        let additionalCheckboxes = globalData.getBomCheckboxes().split(",");
        for (let checkbox of additionalCheckboxes) 
        {
            checkbox = checkbox.trim();
            if (checkbox) 
            {
                td = document.createElement("TD");
                let input = document.createElement("input");
                input.type = "checkbox";
                input.onchange = createCheckboxChangeHandler(checkbox, bomentry);
                // read the value in from local storage

                if(globalData.readStorage( "checkbox" + "_" + checkbox.toLowerCase() + "_" + bomentry.reference ) == "true")
                {
                    bomentry.checkboxes.set(checkbox,true)
                }
                else
                {
                    bomentry.checkboxes.set(checkbox,false)
                }

                if(bomentry.checkboxes.get(checkbox))
                {
                    input.checked = true;
                }
                else
                {
                    input.checked = false;
                }

                td.appendChild(input);
                tr.appendChild(td);
            }
        }



        //INFO: The lines below add the control the columns on the bom table
        // References
        td = document.createElement("TD");
        td.innerHTML = highlightFilter(references);
        tr.appendChild(td);
        // Value
        td = document.createElement("TD");
        td.innerHTML = highlightFilter(bomentry.value);
        tr.appendChild(td);
        // Footprint
        td = document.createElement("TD");
        td.innerHTML = highlightFilter(bomentry.package);
        tr.appendChild(td);
        
        // Attributes
        let additionalAttributes = globalData.getAdditionalAttributes().split(",");
        for (let x of additionalAttributes)
        {
            x = x.trim()
            if (x)
            {
                td = document.createElement("TD");
                td.innerHTML = highlightFilter(pcb.getAttributeValue(bomentry, x.toLowerCase()));
                tr.appendChild(td);
            }
        }

        if(globalData.getCombineValues())
        {
            td = document.createElement("TD");
            td.textContent = bomentry.quantity;
            tr.appendChild(td);
        }
        bom.appendChild(tr);


        bom.appendChild(tr);
        let handler = createRowHighlightHandler(tr.id, references);
        tr.onclick = handler;
        globalData.pushHighlightHandlers({
            id: tr.id,
            handler: handler,
            refs: references
        });

        if (getFilterBOM() && first)
        {
            handler();
            first = false;
        }
    }
}

function highlightPreviousRow()
{
    if (!globalData.getCurrentHighlightedRowId())
    {
        globalData.getHighlightHandlers()[globalData.getHighlightHandlers().length - 1].handler();
    }
    else
    {
        if (    (globalData.getHighlightHandlers().length > 1)
             && (globalData.getHighlightHandlers()[0].id == globalData.getCurrentHighlightedRowId())
        )
        {
            globalData.getHighlightHandlers()[globalData.getHighlightHandlers().length - 1].handler();
        }
        else
        {
            for (let i = 0; i < globalData.getHighlightHandlers().length - 1; i++)
            {
                if (globalData.getHighlightHandlers()[i + 1].id == globalData.getCurrentHighlightedRowId())
                {
                    globalData.getHighlightHandlers()[i].handler();
                    break;
                }
            }
        }
    }
    render.smoothScrollToRow(globalData.getCurrentHighlightedRowId());
}

function highlightNextRow()
{
    if (!globalData.getCurrentHighlightedRowId())
    {
        globalData.getHighlightHandlers()[0].handler();
    }
    else
    {
        if (    (globalData.getHighlightHandlers().length > 1)
             && (globalData.getHighlightHandlers()[globalData.getHighlightHandlers().length - 1].id == globalData.getCurrentHighlightedRowId())
        )
        {
            globalData.getHighlightHandlers()[0].handler();
        }
        else
        {
            for (let i = 1; i < globalData.getHighlightHandlers().length; i++)
            {
                if (globalData.getHighlightHandlers()[i - 1].id == globalData.getCurrentHighlightedRowId())
                {
                    globalData.getHighlightHandlers()[i].handler();
                    break;
                }
            }
        }
    }
    smoothScrollToRow(globalData.getCurrentHighlightedRowId());
}

function populateLayerTable()
{
    populateLayerHeader();
    populateLayerBody();
}

function populateBomTable()
{
    populateBomHeader();
    populateBomBody();
}

function modulesClicked(references)
{
    let lastClickedIndex = references.indexOf(globalData.getLastClickedRef());
    let ref = references[(lastClickedIndex + 1) % references.length];
    for (let handler of globalData.getHighlightHandlers()) 
    {
        if (handler.refs.indexOf(ref) >= 0)
        {
            globalData.setLastClickedRef(ref);
            handler.handler();
            smoothScrollToRow(globalData.getCurrentHighlightedRowId());
            break;
        }
    }
}

function silkscreenVisible(visible)
{
    if (visible)
    {
        globalData.GetAllCanvas().front.silk.style.display = "";
        globalData.GetAllCanvas().back.silk.style.display = "";
        globalData.writeStorage("silkscreenVisible", true);
    }
    else
    {
        globalData.GetAllCanvas().front.silk.style.display = "none";
        globalData.GetAllCanvas().back.silk.style.display = "none";
        globalData.writeStorage("silkscreenVisible", false);
    }
}

function changeCanvasLayout(layout) 
{
    document.getElementById("fl-btn").classList.remove("depressed");
    document.getElementById("fb-btn").classList.remove("depressed");
    document.getElementById("bl-btn").classList.remove("depressed");

    switch (layout) 
    {
    case "F":
        document.getElementById("fl-btn").classList.add("depressed");
        if (globalData.getBomLayout() != "BOM") 
        {
            globalData.collapseCanvasSplit(1);
        }
        break;
    case "B":
        document.getElementById("bl-btn").classList.add("depressed");
        if (globalData.getBomLayout() != "BOM") 
        {
            globalData.collapseCanvasSplit(0);
        }
        break;
    default:
        document.getElementById("fb-btn").classList.add("depressed");
        if (globalData.getBomLayout() != "BOM") 
        {
            globalData.setSizesCanvasSplit([50, 50]);
        }
        break;
    }

    globalData.setCanvasLayout(layout);
    globalData.writeStorage("canvaslayout", layout);
    render.resizeAll();
    populateBomTable();
}

function populateMetadata()
{
    let metadata  = pcb.GetMetadata();

    if(metadata.revision == "")
    {
        document.getElementById("title").innerHTML    = "";
        document.getElementById("revision").innerHTML = metadata.title;
    }
    else
    {
        document.getElementById("title").innerHTML    = metadata.title;
        document.getElementById("revision").innerHTML = "Revision: " + metadata.revision;
    }

    document.getElementById("company").innerHTML  = metadata.company;
    document.getElementById("filedate").innerHTML = metadata.date;
    if (metadata.title != "")
    {
        document.title = metadata.title + " BOM";
    }
}

function changeBomLayout(layout)
{
    document.getElementById("bom-btn").classList.remove("depressed");
    document.getElementById("bom-lr-btn").classList.remove("depressed");
    document.getElementById("bom-tb-btn").classList.remove("depressed");
    document.getElementById("pcb-btn").classList.remove("depressed");
    switch (layout) 
    {
    case "BOM":
        document.getElementById("bom-btn").classList.add("depressed");
        if (globalData.getBomSplit()) 
        {
            globalData.destroyLayerSplit();
            globalData.setLayerSplit(null);
            globalData.destroyBomSplit();
            globalData.setBomSplit(null);
            globalData.destroyCanvasSplit();
            globalData.setCanvasSplit(null);
        }
        document.getElementById("bomdiv").style.display = "";
        document.getElementById("frontcanvas").style.display = "none";
        document.getElementById("backcanvas").style.display = "none";
        document.getElementById("layerdiv").style.display = "none";
        document.getElementById("bot").style.height = "";
        break;
    case "PCB":
        document.getElementById("pcb-btn"     ).classList.add("depressed");
        document.getElementById("bomdiv").style.display = "none";
        document.getElementById("frontcanvas").style.display = "";
        document.getElementById("backcanvas" ).style.display = "";
        document.getElementById("layerdiv"   ).style.display = "";
        document.getElementById("bot"        ).style.height = "calc(100% - 80px)";
        
        document.getElementById("datadiv"   ).classList.add(   "split-horizontal");
        document.getElementById("bomdiv"     ).classList.remove(   "split-horizontal");
        document.getElementById("canvasdiv"  ).classList.remove(   "split-horizontal");
        document.getElementById("frontcanvas").classList.add(   "split-horizontal");
        document.getElementById("backcanvas" ).classList.add(   "split-horizontal");
        document.getElementById("layerdiv"   ).classList.add(   "split-horizontal");


        if (globalData.getBomSplit())
        {
            globalData.destroyLayerSplit();
            globalData.setLayerSplit(null);
            globalData.destroyBomSplit();
            globalData.setBomSplit(null);
            globalData.destroyCanvasSplit();
            globalData.setCanvasSplit(null);
        }

        globalData.setLayerSplit(Split(["#datadiv", "#layerdiv"], {
            sizes: [80, 20],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "col-resize"
        }));

        globalData.setBomSplit(Split(["#bomdiv", "#canvasdiv"], {
            direction: "vertical",
            sizes: [50, 50],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "row-resize"
        }));

        globalData.setCanvasSplit(Split(["#frontcanvas", "#backcanvas"], {
            sizes: [50, 50],
            gutterSize: 5,
            onDragEnd: render.resizeAll,
            cursor: "row-resize"
        }));

        document.getElementById("canvasdiv"  ).style.height = "calc(100% - 2.5px)";
        break;
    case "TB":
        document.getElementById("bom-tb-btn"     ).classList.add("depressed");
        document.getElementById("bomdiv").style.display = "";
        document.getElementById("frontcanvas").style.display = "";
        document.getElementById("backcanvas" ).style.display = "";
        document.getElementById("layerdiv"   ).style.display = "";
        document.getElementById("bot"        ).style.height = "calc(100% - 80px)";

        document.getElementById("datadiv"   ).classList.add(   "split-horizontal");
        document.getElementById("bomdiv"     ).classList.remove(   "split-horizontal");
        document.getElementById("canvasdiv"  ).classList.remove(   "split-horizontal");
        document.getElementById("frontcanvas").classList.add(   "split-horizontal");
        document.getElementById("backcanvas" ).classList.add(   "split-horizontal");
        document.getElementById("layerdiv"   ).classList.add(   "split-horizontal");


        if (globalData.getBomSplit())
        {
            globalData.destroyLayerSplit();
            globalData.setLayerSplit(null);
            globalData.destroyBomSplit();
            globalData.setBomSplit(null);
            globalData.destroyCanvasSplit();
            globalData.setCanvasSplit(null);
        }

        globalData.setLayerSplit(Split(["#datadiv", "#layerdiv"], {
            sizes: [80, 20],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "col-resize"
        }));

        globalData.setBomSplit(Split(["#bomdiv", "#canvasdiv"], {
            direction: "vertical",
            sizes: [50, 50],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "row-resize"
        }));

        globalData.setCanvasSplit(Split(["#frontcanvas", "#backcanvas"], {
            sizes: [50, 50],
            gutterSize: 5,
            onDragEnd: render.resizeAll,
            cursor: "row-resize"
        }));


        break;
    case "LR":
        document.getElementById("bom-lr-btn"     ).classList.add("depressed");
        document.getElementById("bomdiv").style.display = "";
        document.getElementById("frontcanvas").style.display = "";
        document.getElementById("backcanvas" ).style.display = "";
        document.getElementById("layerdiv"   ).style.display = "";
        document.getElementById("bot"        ).style.height = "calc(100% - 80px)";

        document.getElementById("datadiv"    ).classList.add(   "split-horizontal");
        document.getElementById("bomdiv"     ).classList.add(   "split-horizontal");
        document.getElementById("canvasdiv"  ).classList.add(   "split-horizontal");
        document.getElementById("frontcanvas").classList.remove(   "split-horizontal");
        document.getElementById("backcanvas" ).classList.remove(   "split-horizontal");
        document.getElementById("layerdiv"   ).classList.add(   "split-horizontal");

        if (globalData.getBomSplit())
        {
            globalData.destroyLayerSplit();
            globalData.setLayerSplit(null);
            globalData.destroyBomSplit();
            globalData.setBomSplit(null);
            globalData.destroyCanvasSplit();
            globalData.setCanvasSplit(null);
        }

        globalData.setLayerSplit(Split(["#datadiv", "#layerdiv"], {
            sizes: [80, 20],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "col-resize"
        }));

        globalData.setBomSplit(Split(["#bomdiv", "#canvasdiv"], {
            sizes: [50, 50],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "row-resize"
        }));

        globalData.setCanvasSplit(Split(["#frontcanvas", "#backcanvas"], {
            sizes: [50, 50],
            direction: "vertical",
            gutterSize: 5,
            onDragEnd: render.resizeAll,
            cursor: "row-resize"
        }));
        break;
    }
    globalData.setBomLayout(layout);
    globalData.writeStorage("bomlayout", layout);
    changeCanvasLayout(globalData.getCanvasLayout());
}

function focusInputField(input)
{
    input.scrollIntoView(false);
    input.focus();
    input.select();
}

function focusBOMFilterField()
{
    focusInputField(document.getElementById("bom-filter"));
}

function toggleBomCheckbox(bomrowid, checkboxnum)
{
    if (!bomrowid || checkboxnum > globalData.getCheckboxes().length)
    {
        return;
    }
    let bomrow = document.getElementById(bomrowid);
    let checkbox = bomrow.childNodes[checkboxnum].childNodes[0];
    checkbox.checked = !checkbox.checked;
    checkbox.indeterminate = false;
    checkbox.onchange();
}

function IsCheckboxClicked(bomrowid, checkboxname) 
{
    let checkboxnum = 0;
    while (checkboxnum < globalData.getCheckboxes().length && globalData.getCheckboxes()[checkboxnum].toLowerCase() != checkboxname.toLowerCase()) 
    {
        checkboxnum++;
    }
    if (!bomrowid || checkboxnum >= globalData.getCheckboxes().length) 
    {
        return;
    }
    let bomrow = document.getElementById(bomrowid);
    let checkbox = bomrow.childNodes[checkboxnum + 1].childNodes[0];
    return checkbox.checked;
}

function removeGutterNode(node)
{
    for (let i = 0; i < node.childNodes.length; i++)
    {
        if (    (node.childNodes[i].classList )
             && (node.childNodes[i].classList.contains("gutter")) 
        )
        {
            node.removeChild(node.childNodes[i]);
            break;
        }
    }
}

function cleanGutters()
{
    removeGutterNode(document.getElementById("bot"));
    removeGutterNode(document.getElementById("canvasdiv"));
}

function setBomCheckboxes(value)
{
    globalData.setBomCheckboxes(value);
    globalData.writeStorage("bomCheckboxes", value);
    populateBomTable();
}

function setRemoveBOMEntries(value)
{
    globalData.setRemoveBOMEntries(value);
    globalData.writeStorage("removeBOMEntries", value);
    populateBomTable();
}

function setAdditionalAttributes(value)
{
    globalData.setAdditionalAttributes(value);
    globalData.writeStorage("additionalAttributes", value);
    populateBomTable();
}

// XXX: None of this seems to be working. 
document.onkeydown = function(e)
{
    switch (e.key)
    {
    case "n":
        if (document.activeElement.type == "text")
        {
            return;
        }
        if (globalData.getCurrentHighlightedRowId() !== null)
        {
            // XXX: Why was the following line in the software
            //checkBomCheckbox(globalData.getCurrentHighlightedRowId(), "placed");
            highlightNextRow();
            e.preventDefault();
        }
        break;
    case "ArrowUp":
        highlightPreviousRow();
        e.preventDefault();
        break;
    case "ArrowDown":
        highlightNextRow();
        e.preventDefault();
        break;
    default:
        break;
    }

    if (e.altKey)
    {
        switch (e.key)
        {
        case "f":
            focusBOMFilterField();
            e.preventDefault();
            break;
        case "z":
            changeBomLayout("BOM");
            e.preventDefault();
            break;
        case "x":
            changeBomLayout("LR");
            e.preventDefault();
            break;
        case "c":
            changeBomLayout("TB");
            e.preventDefault();
            break;
        case "v":
            changeCanvasLayout("F");
            e.preventDefault();
            break;
        case "b":
            changeCanvasLayout("FB");
            e.preventDefault();
            break;
        case "n":
            changeCanvasLayout("B");
            e.preventDefault();
            break;
        default:
            break;
        }
    }
};

//XXX: I would like this to be in the html functions js file. But this function needs to be 
//     placed here, otherwise the application rendering becomes very very weird.
window.onload = function(e)
{
    console.time("on load");
    // This function makes so that the user data for the pcb is converted to our internal structure
    pcb.OpenPcbData(pcbdata)


    // Create canvas layers. One canvas per pcb layer

    globalData.initStorage();
    cleanGutters();
    // Must be called after loading PCB as rendering required the bounding box information for PCB
    render.initRender();

    // Set up mouse event handlers
    handlers_mouse.addMouseHandlers(document.getElementById("frontcanvas"), globalData.GetAllCanvas().front);
    handlers_mouse.addMouseHandlers(document.getElementById("backcanvas"), globalData.GetAllCanvas().back);


    bom = document.getElementById("bombody");
    layerBody = document.getElementById("layerbody");
    layerHead = document.getElementById("layerhead");
    bomhead = document.getElementById("bomhead");
    globalData.setBomLayout(globalData.readStorage("bomlayout"));
    if (!globalData.getBomLayout())
    {
        globalData.setBomLayout("LR");
    }
    globalData.setCanvasLayout(globalData.readStorage("canvaslayout"));
    if (!globalData.getCanvasLayout())
    {
        globalData.setCanvasLayout("FB");
    }

    populateLayerTable();

    populateMetadata();
    globalData.setBomCheckboxes(globalData.readStorage("bomCheckboxes"));
    if (globalData.getBomCheckboxes() === null)
    {
        globalData.setBomCheckboxes("Placed");
    }
    globalData.setRemoveBOMEntries(globalData.readStorage("removeBOMEntries"));
    if (globalData.getRemoveBOMEntries() === null)
    {
        globalData.setRemoveBOMEntries("");
    }
    globalData.setAdditionalAttributes(globalData.readStorage("additionalAttributes"));
    if (globalData.getAdditionalAttributes() === null)
    {
        globalData.setAdditionalAttributes("");
    }
    document.getElementById("bomCheckboxes").value = globalData.getBomCheckboxes();
    if (globalData.readStorage("silkscreenVisible") === "false")
    {
        document.getElementById("silkscreenCheckbox").checked = false;
        silkscreenVisible(false);
    }
    if (globalData.readStorage("redrawOnDrag") === "false")
    {
        document.getElementById("dragCheckbox").checked = false;
        globalData.setRedrawOnDrag(false);
    }
    if (globalData.readStorage("darkmode") === "true")
    {
        document.getElementById("darkmodeCheckbox").checked = true;
        setDarkMode(true);
    }
    if (globalData.readStorage("hidePlacedParts") === "true")
    {
        document.getElementById("hidePlacedParts").checked = true;
        globalData.setHidePlacedParts(true);
    }
    if (globalData.readStorage("highlightpin1") === "true")
    {
        document.getElementById("highlightpin1Checkbox").checked = true;
        globalData.setHighlightPin1(true);
        render.drawCanvas(globalData.GetAllCanvas().front);
        render.drawCanvas(globalData.GetAllCanvas().back);
    }
    // If this is true then combine parts and display quantity
    if (globalData.readStorage("combineValues") === "true")
    {
        document.getElementById("combineValues").checked = true;
        globalData.setCombineValues(true);
    }
    if (globalData.readStorage("debugMode") === "true")
    {
        document.getElementById("debugMode").checked = true;
        globalData.setDebugMode(true);
    }
    // Read the value of board rotation from local storage
    let boardRotation = globalData.readStorage("boardRotation");
    /*
      Adjusted to match how the update rotation angle is calculated.
    
        If null, then angle not in local storage, set to 180 degrees.
      */
    if (boardRotation === null)
    {
        boardRotation = 180;
    }
    else
    {
        boardRotation = parseInt(boardRotation);
    }
    // Set internal global variable for board rotation.
    globalData.SetBoardRotation(boardRotation);
    document.getElementById("boardRotation").value = (boardRotation-180) / 5;
    document.getElementById("rotationDegree").textContent = (boardRotation-180);

    // Triggers render
    changeBomLayout(globalData.getBomLayout());
    console.timeEnd("on load");
};

window.onresize = render.resizeAll;
window.matchMedia("print").addListener(render.resizeAll);

module.exports = {
    setDarkMode        , silkscreenVisible      , changeBomLayout, changeCanvasLayout,
    setBomCheckboxes   , populateBomTable       , setFilterBOM   , getFilterBOM      ,
    setFilterLayer     , getFilterLayer         , setRemoveBOMEntries, setAdditionalAttributes
};

},{"./global.js":3,"./handlers_mouse.js":4,"./pcb.js":7,"./render.js":8,"split.js":1}],7:[function(require,module,exports){
/*
    This file contains all of the definitions for working with pcbdata.json. 
    This file declares all of the access functions and interfaces for converting 
    the json file into an internal data structure. 
*/

"use strict";

/***************************************************************************************************
                                         PCB Part Interfaces
**************************************************************************************************/
// Read the ecad property. This property lets the application know what 
// ecad software generated the json file. 
function GetCADType(pcbdataStructure)
{
    if(pcbdataStructure.hasOwnProperty("ecad"))
    {
        return pcbdataStructure.ecad;
    }
}

// This will hold the part objects. There is one entry per part
// Format of a part is as follows
// [VALUE,PACKAGE,REFRENECE DESIGNATOR, ,LOCATION, ATTRIBUTE],
// where ATTRIBUTE is a dict of ATTRIBUTE NAME : ATTRIBUTE VALUE
let BOM = [];

// Constructor for creating a part.
function Part(value, footprint, reference, location, attributes, checkboxes)
{
    this.quantity   = 1;
    this.value      = value;
    this.foorptint  = footprint;
    this.reference  = reference;
    this.location   = location;
    this.attributes = attributes;
    this.checkboxes = checkboxes;
}

function CopyPart(inputPart)
{
    // XXX: This is not performing a deep copy, attributes is a map and this is being copied by 
    //      reference which is not quite what we want here. It should be a deep copy so once called
    //      this will result in a completely new object that will not reference one another
    return new Part(inputPart.value, inputPart.package, inputPart.reference, inputPart.location, inputPart.attributes, inputPart.checkboxes);
}

//TODO: There should be steps here for validating the data and putting it into a 
//      format that is valid for our application
function CreateBOM(pcbdataStructure)
{
    // For every part in the input file, convert it to our internal 
    // representation data structure.
    for(let part of pcbdataStructure.parts)
    {
        // extract the part data. This is here so I can iterate the design 
        // when I make changes to the underlying json file.
        let value     = part.value;
        let footprint = "";
        let reference = part.name;
        let location  = part.location;

        // AttributeName and AttributeValue are two strings that are deliminated by ';'. 
        // Split the strings by ';' and then zip them together
        let attributeNames  = part.attributes.name.split(";");
        let attributeValues = part.attributes.value.split(";");

        let checkboxes = new Map();

        //XXX: ASSUMTION that attributeNames is the same length as attributeValues
        let attributes = new Map(); // Create a empty dictionary
        for(let i in attributeNames)
        {
            attributes.set(attributeNames[i].toLowerCase(),attributeValues[i].toLowerCase());
        }
        // Add the par to the global part array
        BOM.push(new Part(value, footprint, reference, location, attributes, checkboxes));
    }
}

function GetBOM()
{
    return BOM;
}

// TAkes a BOM table and a filter function. The filter 
// function is used onthe provided table to remove 
// any part that satisfy the filter
function filterBOMTable(bomtable, filterFunction)
{
    let result = [];

    // Makes sure that thE filter function is defined. 
    // if not defined then nothing should be filtered. 
    if(filterFunction != null)
    {
        for(let i in bomtable)
        {
            // If the filter returns false -> do not remove part, it does not need to be filtered
            if(!filterFunction(bomtable[i]))
            {
                result.push(CopyPart(bomtable[i]));
            }
        }
    }
    else
    {
        result = bomtable;
    }
    return result;
}

// Takes a bom table and combines entries that are the same
function GetBOMCombinedValues(bomtableTemp)
{
    let result = [];

    // TODO: sort bomtableTemp. Assumption here is that the bomtableTemp is presorted

    if(bomtableTemp.length>0)
    {
        // XXX: Assuming that the input json data has bom entries presorted
        // TODO: Start at index 1, and compare the current to the last, this should simplify the logic
        // Need to create a new object by deep copy. this is because objects by default are passed by reference and i dont 
        // want to modify them.
        result.push(CopyPart(bomtableTemp[0]));
        let count = 0;
        for (let n = 1; n < bomtableTemp.length;n++)
        {
            if(result[count].value == bomtableTemp[n].value)
            {
                // For parts that are listed as combined, store the references as an array.
                // This is because the logic for highlighting needs to match strings and 
                // If an appended string is used it might not work right
                let refString = result[count].reference + "," + bomtableTemp[n].reference;
                result[count].quantity += 1;
                result[count].reference = refString;
            }
            else
            {
                result.push(CopyPart(bomtableTemp[n]));
                count++;
            }
        }
    }
    return result;
}

function getAttributeValue(part, attributeToLookup)
{
    let attributes = part.attributes;
    let result = "";

    if(attributeToLookup == "name")
    {
        result = part.reference;
    }
    else
    {
        result = (attributes.has(attributeToLookup) ? attributes.get(attributeToLookup) : "");
    }
    // Check that the attribute exists by looking up its name. If it exists
    // the return the value for the attribute, otherwise return an empty string. 
    return result;
}


/***************************************************************************************************
                                         PCB Metadata Interfaces
***************************************************************************************************/
let metadata;
// Constructor for creating a part.
function Metadata(title, revision, company, date) 
{
    this.title    = title;
    this.revision = revision;
    this.company  = company;
    this.date     = date;
}

function CreateMetadata(pcbdataStructure)
{
    metadata = new Metadata( 
        pcbdataStructure.metadata.title, pcbdataStructure.metadata.revision,
        pcbdataStructure.metadata.company, pcbdataStructure.metadata.date
    );
}

function GetMetadata()
{
    return metadata;
}

/***************************************************************************************************
                                         PCB Layers Interfaces
***************************************************************************************************/
let Layers = [];
let layer_Zindex = 0;

function GetLayers()
{
    return Layers;
}


function PCBLayer(name)
{
    this.name    = name;
    this.visible_front = true;
    this.visible_back = true;


    this.front_id = "layer_front_" + name;
    this.back_id  = "layer_rear_" + name;

    let canvas_front = document.getElementById("front-canvas-list");
    let layer_front = document.createElement("canvas");
    layer_front.id = this.front_id;
    layer_front.style.zIndex = layer_Zindex;
    layer_front.style.position = "absolute";
    layer_front.style.left = 0;
    layer_front.style.top = 0;
    canvas_front.appendChild(layer_front);


    let canvas_back = document.getElementById("back-canvas-list");
    let layer_back = document.createElement("canvas");
    layer_back.id = this.back_id;
    layer_back.style.zIndex = layer_Zindex;
    layer_back.style.position = "absolute";
    layer_back.style.left = 0;
    layer_back.style.top = 0;

    canvas_back.appendChild(layer_back);

    layer_Zindex = layer_Zindex + 1;
}

function SetLayerVisibility(layerName, isFront, visible)
{
    let layerIndex = Layers.findIndex(i => i.name === layerName);
    if(isFront)
    {
        // If item is not in the list 
        if( layerIndex !== -1)
        {
            // Layer exists. Check if visible
            Layers[layerIndex].visible_front = visible;

            // TODO: Refactor this. below is used to interface between the different layer 
            // setups that are currently being used but once switched to the new layer format
            // then the above will not be needed.
            let canvas = undefined; 
            if(visible)
            {
                canvas = document.getElementById(Layers[layerIndex].front_id);
                canvas.style.display="";
            }
            else
            {
                canvas = document.getElementById(Layers[layerIndex].front_id);
                canvas.style.display="none";
            }
        }
    }
    else
    {
        // If item is not in the list 
        if( layerIndex !== -1)
        {
            // Layer exists. Check if visible
            Layers[layerIndex].visible_back = visible;

            // TODO: Refactor this. below is used to interface between the different layer 
            // setups that are currently being used but once switched to the new layer format
            // then the above will not be needed.
            let canvas = undefined;
            if(visible)
            {
                canvas= document.getElementById(Layers[layerIndex].back_id);
                canvas.style.display="";
            }
            else
            {
                canvas= document.getElementById(Layers[layerIndex].back_id);
                canvas.style.display="none";
            }
        }
    }
}

function GetLayerCanvas(layerName, isFront)
{
    // Get the index of the PCB layer 
    // MAp used here to create a list of just the layer names, which indexOf can then  be used against.
    let index = Layers.map(function(e) { return e.name; }).indexOf(layerName);
    // Requested layer does not exist. Create new layer
    if(index === -1)
    {
        // Adds layer to layer stack
        Layers.push(new PCBLayer(layerName));
        index = Layers.length-1;
    }

    // Return the canvas instance
    if(isFront)
    {
        return document.getElementById(Layers[index].front_id);
    } 
    else
    {
        return document.getElementById(Layers[index].back_id);
    }
}

function CreateLayers(pcbdataStructure)
{
    // Extract layers from the trace section
    for( let trace of pcbdataStructure.board.traces)
    {
        for(let segment of trace.segments)
        {
            // Check that segment contains a layer definition
            if(segment.layer)
            {
                // If item is not in the list 
                if(Layers.findIndex(i => i.name === segment.layer) === -1)
                {
                    Layers.push(new PCBLayer(segment.layer));
                }
            }
        }
    }

    // Extract layers form the layers section
    for(let layer of pcbdataStructure.board.layers)
    {
        // If item is not in the list 
        if(Layers.findIndex(i => i.name === layer.name) === -1)
        {
            // Add the par to the global part array
            Layers.push(new PCBLayer(layer.name));
        }
    }

    // XXX: Need another way to extract all layers from input
    Layers.push(new PCBLayer("edges"));
    Layers.push(new PCBLayer("pads"));
    Layers.push(new PCBLayer("highlights"));
}


function IsLayerVisible(layerName, isFront)
{
    let result = true;
    let layerIndex = Layers.findIndex(i => i.name === layerName);

    // This means that the layer is always visible. 
    if(layerName == "all")
    {
        result = true;
    }
    else if(isFront)
    {
        // If item is not in the list 
        if( layerIndex === -1)
        {
            result = false;
        }
        else
        {
            // Layer exists. Check if visible
            result = Layers[layerIndex].visible_front;
        }
    }
    else
    {
        // If item is not in the list 
        if( layerIndex === -1)
        {
            result = false;
        }
        else
        {
            // Layer exists. Check if visible
            result = Layers[layerIndex].visible_back;
        }
    }

    return result;
}

function OpenPcbData(pcbdata)
{
    CreateBOM(pcbdata);
    CreateMetadata(pcbdata);
    CreateLayers(pcbdata);
}

module.exports = {
    OpenPcbData, GetBOM, getAttributeValue, GetBOMCombinedValues, filterBOMTable, GetMetadata, 
    GetLayers, IsLayerVisible, SetLayerVisibility, GetLayerCanvas, GetCADType
};
},{}],8:[function(require,module,exports){
/* PCB rendering code */

"use strict";

var globalData         = require("./global.js");
var render_pads        = require("./render/render_pad.js");
var render_via         = require("./render/render_via.js");
var render_trace       = require("./render/render_trace.js");
var render_boardedge   = require("./render/render_boardedge.js");
var render_silkscreen  = require("./render/render_silkscreen.js");
var render_canvas      = require("./render/render_canvas.js");
var render_boundingbox = require("./render/render_boundingbox.js");
var Point              = require("./render/point.js").Point;
var pcb                = require("./pcb.js");
var colorMap           = require("./colormap.js");


//REMOVE: Using to test alternate placed coloring
let isPlaced = false;



function DrawPad(ctx, pad, color) 
{
    if (pad.shape == "rect") 
    {
        render_pads.Rectangle(ctx, pad, color);
    } 
    else if (pad.shape == "oblong") 
    {
        render_pads.Oblong(ctx, pad, color);
    } 
    else if (pad.shape == "round") 
    {
        render_pads.Round(ctx, pad, color);
    } 
    else if (pad.shape == "octagon") 
    {
        render_pads.Octagon(ctx, pad, color);
    } 
    else
    {
        console.log("ERROR: Unsupported pad type ", pad.shape);
    }
}

function DrawPCBEdges(isViewFront, scalefactor) 
{
    let ctx = pcb.GetLayerCanvas("edges", isViewFront).getContext("2d");
    let color = colorMap.GetPCBEdgeColor();

    for (let edge of pcbdata.board.pcb_shape.edges) 
    {
        if(edge.pathtype == "line")
        {
            let lineWidth = Math.max(1 / scalefactor, edge.width);
            render_boardedge.Line(ctx, edge, lineWidth, color);
        }
        else if(edge.pathtype == "arc")
        {
            let lineWidth = Math.max(1 / scalefactor, edge.width);
            render_boardedge.Arc(ctx, edge, lineWidth, color);
        }
        else
        {
            console.log("unsupported board edge segment type", edge.pathtype);
        }
    }
}

function DrawTraces(isViewFront, scalefactor)
{
    // Iterate over all traces in the design
    for (let trace of pcbdata.board.traces)
    {
        // iterate over all segments in a trace 
        for (let segment of trace.segments)
        {
            let ctx = pcb.GetLayerCanvas(segment.layer, isViewFront).getContext("2d")

            if(segment.pathtype == "line")
            {
                let lineWidth = Math.max(1 / scalefactor, segment.width);
                render_trace.Line(ctx, segment, lineWidth, colorMap.GetTraceColor(segment.layerNumber-1));
            }
            else if(segment.pathtype == "arc")
            {
                let lineWidth = Math.max(1 / scalefactor, segment.width);
                render_trace.Arc(ctx, segment, lineWidth, colorMap.GetTraceColor(segment.layerNumber-1));
            }
            else if (segment.pathtype == "polygon")
            {
                let lineWidth = Math.max(1 / scalefactor, segment.width);
                // Need to specify a color at full transparency so that a negative polygon 
                // can be subtracted from a positive polygon.
                let color = (segment.positive == 1) ? colorMap.GetTraceColor(segment.layerNumber-1) : "#000000FF";
                render_trace.Polygon(ctx, segment.segments, lineWidth, color, segment.positive === "1");
            }
            else if( segment.pathtype == "via_round")
            {
                let centerPoint = new Point(segment.x, segment.y);
                render_via.Round(
                    ctx
                    , centerPoint
                    , segment.diameter
                    , segment.drill
                    , colorMap.GetViaColor()
                    , colorMap.GetDrillColor()
                );
            }
            else if( segment.pathtype == "via_octagon")
            {
                let centerPoint = new Point(segment.x, segment.y);
                render_via.Octagon(
                    ctx
                    , centerPoint
                    , segment.diameter
                    , segment.drill
                    , colorMap.GetViaColor()
                    , colorMap.GetDrillColor()
                );
            }
            else if( segment.pathtype == "via_square")
            {
                let centerPoint = new Point(segment.x, segment.y);
                render_via.Square(
                    ctx
                    , centerPoint
                    , segment.diameter
                    , segment.drill
                    , colorMap.GetViaColor()
                    , colorMap.GetDrillColor()
                );
            }
            else
            {
                console.log("unsupported trace segment type");
            }
        }
    }
}

function DrawSilkscreen(isViewFront, scalefactor)
{
    let color = "#aa4";

    for (let layer of pcbdata.board.layers)
    {
        let ctx = pcb.GetLayerCanvas(layer.name, isViewFront).getContext("2d");

       if(layer.layerNumber-1 < 16)
        {
            color = colorMap.GetTraceColor(layer.layerNumber-1);
        }
        else
        {
            color = "#aa4"
        }
        
        for (let path of layer.paths)
        {
            if(path.pathtype == "line")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Line(ctx, path, lineWidth, color);
            }
            else if(path.pathtype == "arc")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Arc(ctx, path, lineWidth, color);
            }
            else if(path.pathtype == "circle")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Circle(ctx, path, lineWidth, color);
            }
            else
            {
                console.log("unsupported silkscreen path segment type", path.pathtype);
            }
        }
    }
}

function DrawModule(isViewFront, layer, scalefactor, part, highlight) 
{
    if (highlight || globalData.getDebugMode())
    {
        let ctx = pcb.GetLayerCanvas("highlights", isViewFront).getContext("2d");
        // draw bounding box
        if (part.location == layer)
        {
            let color_BoundingBox = colorMap.GetBoundingBoxColor(highlight, isPlaced);
            render_boundingbox.Rectangle(ctx, part.package.bounding_box, color_BoundingBox);
        }
        // draw pads
        for (let pad of part.package.pads) 
        {
            /*
                Check that part on layer should be drawn. Will draw when requested layer 
                matches the parts layer.
            
              If the part is through hole it needs to be drawn on each layer
              otherwise the part is an smd and should only be drawn on a the layer it belongs to.
            */
            if (    (pad.pad_type == "tht")
                 || ((pad.pad_type == "smd") && (part.location == layer))
            )
            {
                let highlightPin1 = ((pad.pin1 == "yes")  && globalData.getHighlightPin1());
                let color_pad = colorMap.GetPadColor(highlightPin1, highlight, isPlaced);
                DrawPad(ctx, pad, color_pad);
            }
        }
    }

    // draw pads
    for (let pad of part.package.pads) 
    {
        /*
            Check that part on layer should be drawn. Will draw when requested layer 
            matches the parts layer.
        
          If the part is through hole it needs to be drawn on each layer
          otherwise the part is an smd and should only be drawn on a the layer it belongs to.
        */
        if (    (pad.pad_type == "tht")
             || ((pad.pad_type == "smd") && (part.location == layer))
        )
        {
            let highlightPin1 = ((pad.pin1 == "yes")  && globalData.getHighlightPin1());
            let color_pad = colorMap.GetPadColor(highlightPin1, false, isPlaced);
            let ctx = pcb.GetLayerCanvas("pads", isViewFront).getContext("2d");
            DrawPad(ctx, pad, color_pad);
        }
    }
}

function DrawModules(isViewFront, layer, scalefactor, highlightedRefs)
{
    for (let part of pcbdata.parts) 
    {
        let highlight = highlightedRefs.includes(part.name);
        if (highlightedRefs.length == 0 || highlight) 
        {
            DrawModule(isViewFront, layer, scalefactor, part, highlight);
        }
    }
}

function drawCanvas(canvasdict)
{
    render_canvas.RedrawCanvas(canvasdict);
    let isViewFront = (canvasdict.layer === "F");
    DrawPCBEdges  (isViewFront, canvasdict.transform.s);
    DrawModules   (isViewFront, canvasdict.layer, canvasdict.transform.s, []);
    DrawTraces    (isViewFront, canvasdict.transform.s);
    // Draw last so that text is not erased when drawing polygons.
    DrawSilkscreen(isViewFront, canvasdict.transform.s);
}

function RotateVector(v, angle)
{
    return render_canvas.rotateVector(v, angle);
}



function initRender()
{
    let allcanvas = {
        front: {
            transform: {
                x: 0,
                y: 0,
                s: 1,
                panx: 0,
                pany: 0,
                zoom: 1,
                mousestartx: 0,
                mousestarty: 0,
                mousedown: false,
            },
            layer: "F",
        },
        back: {
            transform: {
                x: 0,
                y: 0,
                s: 1,
                panx: 0,
                pany: 0,
                zoom: 1,
                mousestartx: 0,
                mousestarty: 0,
                mousedown: false,
            },
            layer: "B",
        }
    };
    // Sets the data strucure to a default value. 
    globalData.SetAllCanvas(allcanvas);
    // Set the scale so the PCB will be scaled and centered correctly.
    render_canvas.ResizeCanvas(globalData.GetAllCanvas().front);
    render_canvas.ResizeCanvas(globalData.GetAllCanvas().back);
    
}

function drawHighlightsOnLayer(canvasdict) 
{
    let isViewFront = (canvasdict.layer === "F");
    render_canvas.ClearHighlights(canvasdict);
    DrawModules   (isViewFront, canvasdict.layer, canvasdict.transform.s, globalData.getHighlightedRefs());
}

function drawHighlights(passed) 
{
    isPlaced=passed;
    drawHighlightsOnLayer(globalData.GetAllCanvas().front);
    drawHighlightsOnLayer(globalData.GetAllCanvas().back);
}

function resizeAll() 
{
    render_canvas.ResizeCanvas(globalData.GetAllCanvas().front);
    render_canvas.ResizeCanvas(globalData.GetAllCanvas().back);
    drawCanvas(globalData.GetAllCanvas().front);
    drawCanvas(globalData.GetAllCanvas().back);
}

function SetBoardRotation(value) 
{
    /*
        The board when drawn by default is show rotated -180 degrees. 
        The following will add 180 degrees to what the user calculates so that the PCB
        will be drawn in the correct orientation, i.e. displayed as shown in ECAD program. 
        Internally the range of degrees is stored as 0 -> 360
    */
    globalData.SetBoardRotation((value * 5)+180);
    globalData.writeStorage("boardRotation", globalData.GetBoardRotation());
    /*
        Display the correct range of degrees which is -180 -> 180. 
        The following just remaps 360 degrees to be in the range -180 -> 180.
    */
    document.getElementById("rotationDegree").textContent = (globalData.GetBoardRotation()-180);
    resizeAll();
}

module.exports = {
    initRender, resizeAll, drawCanvas, drawHighlights, RotateVector, SetBoardRotation
};
},{"./colormap.js":2,"./global.js":3,"./pcb.js":7,"./render/point.js":9,"./render/render_boardedge.js":10,"./render/render_boundingbox.js":11,"./render/render_canvas.js":12,"./render/render_pad.js":14,"./render/render_silkscreen.js":15,"./render/render_trace.js":16,"./render/render_via.js":17}],9:[function(require,module,exports){
"use strict";
/**
 * 
 * @param {*} x 
 * @param {*} y 
 */
function Point(x,y)
{
    this.x = x;
    this.y = y;
}



module.exports = {
    Point
};

},{}],10:[function(require,module,exports){
"use strict";
var render_lowlevel     = require("./render_lowlevel.js");
var Point               = require("./point.js").Point;

// Line width is not included as part of the trace as it will depend on the current gui scale factor.
function Arc(guiContext, trace, lineWidth, color)
{

    let centerPoint = new Point(trace.cx0, trace.cy0);


    let renderOptions = { 
        color: color,
        fill: false,
        lineWidth: lineWidth,
        lineCap: "round" 
    };

    render_lowlevel.Arc( 
        guiContext,
        centerPoint,
        trace.radius,
        trace.angle0,
        trace.angle1,
        renderOptions
    );
}

function Line(guiContext, trace, lineWidth, color)
{
    let startPoint = new Point(trace.x0, trace.y0);
    let endPoint   = new Point(trace.x1, trace.y1);

    let renderOptions = { 
        color: color,
        fill: false,
        lineWidth: lineWidth,
        lineCap: "round" 
    };

    render_lowlevel.Line( 
        guiContext,
        startPoint,
        endPoint,
        renderOptions
    );
}

module.exports = {
    Arc, Line
};

},{"./point.js":9,"./render_lowlevel.js":13}],11:[function(require,module,exports){
"use strict";
var render_lowlevel     = require("./render_lowlevel.js");
var Point               = require("./point.js").Point;

// Line width is not included as part of the trace as it will depend on the current gui scale factor.
function Rectangle(guiContext, boundingBox, color)
{
    let centerPoint = new Point(0, 0);
    /*
            The following derive the corner points for the
            rectangular pad. These are calculated using the center 
            point of the rectangle along with the width and height 
            of the rectangle. 
    */
    // Top left point
    let point0 = new Point(boundingBox.x0, boundingBox.y0);
    // Top right point
    let point1 = new Point(boundingBox.x1, boundingBox.y0);
    // Bottom right point
    let point2 = new Point(boundingBox.x1, boundingBox.y1);
    // Bottom left point
    let point3 = new Point(boundingBox.x0, boundingBox.y1);

    // First fill the box. 
    let renderOptions = {
        color: color,
        fill: true,
        globalAlpha: 0.2
    };

    render_lowlevel.RegularPolygon( 
        guiContext,
        centerPoint, 
        [point0, point1, point2, point3],
        0,
        renderOptions
    );

    // Now stoke the box
    renderOptions = {
        color: color,
        fill: false,
        globalAlpha: 1, 
        lineWidth: 0.33
    };

    render_lowlevel.RegularPolygon( 
        guiContext,
        centerPoint, 
        [point0, point1, point2, point3],
        0,
        renderOptions
    );
}

module.exports = {
    Rectangle
};

},{"./point.js":9,"./render_lowlevel.js":13}],12:[function(require,module,exports){
"use strict";
var pcb        = require("../pcb.js");
var globalData = require("../global.js");


function prepareCanvas(canvas, flip, transform) 
{
    let ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(transform.zoom, transform.zoom);
    ctx.translate(transform.panx, transform.pany);
    if (flip) 
    {
        ctx.scale(-1, 1);
    }
    ctx.translate(transform.x, transform.y);
    ctx.rotate(globalData.GetBoardRotation()*Math.PI/180);
    ctx.scale(transform.s, transform.s);
}

function rotateVector(v, angle) 
{
    angle = angle*Math.PI/180;
    return [
        v[0] * Math.cos(angle) - v[1] * Math.sin(angle),
        v[0] * Math.sin(angle) + v[1] * Math.cos(angle)
    ];
}

function recalcLayerScale(canvasdict, canvas) 
{
    let layerID = (canvasdict.layer === "F") ? "frontcanvas" : "backcanvas" ;
    let width   = document.getElementById(layerID).clientWidth * 2;
    let height  = document.getElementById(layerID).clientHeight * 2;
    let bbox    = applyRotation(pcbdata.board.pcb_shape.bounding_box);
    let scalefactor = 0.98 * Math.min( width / (bbox.maxx - bbox.minx), height / (bbox.maxy - bbox.miny));

    if (scalefactor < 0.1)
    {
        //scalefactor = 1;
    }

    canvasdict.transform.s = scalefactor;

    if ((canvasdict.layer != "B"))
    {
        canvasdict.transform.x = -((bbox.maxx + bbox.minx) * scalefactor + width) * 0.5;
    }
    else
    {
        canvasdict.transform.x = -((bbox.maxx + bbox.minx) * scalefactor - width) * 0.5;
    }
    canvasdict.transform.y = -((bbox.maxy + bbox.miny) * scalefactor - height) * 0.5;

    if(canvasdict.layer ==="F")
    {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = (width / 2) + "px";
        canvas.style.height = (height / 2) + "px";
    }
    else
    {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = (width / 2) + "px";
        canvas.style.height = (height / 2) + "px";
    }
}

function applyRotation(bbox) 
{
    let corners = [
        [bbox.minx, bbox.miny],
        [bbox.minx, bbox.maxy],
        [bbox.maxx, bbox.miny],
        [bbox.maxx, bbox.maxy],
    ];
    corners = corners.map((v) => rotateVector(v, globalData.GetBoardRotation()));
    return {
        minx: corners.reduce((a, v) => Math.min(a, v[0]), Infinity),
        miny: corners.reduce((a, v) => Math.min(a, v[1]), Infinity),
        maxx: corners.reduce((a, v) => Math.max(a, v[0]), -Infinity),
        maxy: corners.reduce((a, v) => Math.max(a, v[1]), -Infinity),
    };
}


function ClearHighlights(canvasdict)
{
    let canvas = pcb.GetLayerCanvas("highlights", (canvasdict.layer === "F"));
    ClearCanvas(canvas);
}

function ClearCanvas(canvas) 
{
    let ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function prepareLayer(canvasdict, canvas)
{
    let flip = (canvasdict.layer != "B");

    if(canvasdict.layer === "F")
    {
        prepareCanvas(canvas, flip, canvasdict.transform);
    }
    else
    {
        prepareCanvas(canvas, flip, canvasdict.transform);
    }
}

function RedrawCanvas(layerdict)
{
    let pcbLayers = pcb.GetLayers();

    if(layerdict.layer === "F")
    {
        let canvas = undefined;
        for (let i = 0; i < pcbLayers.length; i++) 
        {
            canvas = document.getElementById(pcbLayers[i].front_id);
            prepareLayer(layerdict, canvas);
            ClearCanvas(canvas);
        }
    }
    else
    {
        let canvas = undefined;
        for (let i = 0; i < pcbLayers.length; i++) 
        {
            canvas = document.getElementById(pcbLayers[i].back_id);
            prepareLayer(layerdict, canvas);
            ClearCanvas(canvas);
        }
    }
}

function ResizeCanvas(layerdict)
{
    let flip = (layerdict.layer != "B");
    let pcbLayers = pcb.GetLayers();
    
    if(layerdict.layer === "F")
    {
        let canvas = undefined;
        for (let i = 0; i < pcbLayers.length; i++) 
        {
            canvas = document.getElementById(pcbLayers[i].front_id);
            recalcLayerScale(layerdict, canvas);
            prepareCanvas(canvas, flip, layerdict.transform);
            ClearCanvas(canvas);
        }
    }
    else
    {
        let canvas = undefined;
        for (let i = 0; i < pcbLayers.length; i++) 
        {
            canvas = document.getElementById(pcbLayers[i].back_id);
            recalcLayerScale(layerdict, canvas);
            prepareCanvas(canvas, flip, layerdict.transform);
            ClearCanvas(canvas);
        }
    }
}


module.exports = {
    ResizeCanvas, RedrawCanvas, rotateVector, ClearHighlights
};



},{"../global.js":3,"../pcb.js":7}],13:[function(require,module,exports){
"use strict";

var Point = require("./point.js").Point;

function Arc(guiContext, centerPoint, radius, angleStart, angleEnd, renderOptions )
{
    guiContext.save();

    if( renderOptions.color)
    {
        guiContext.fillStyle  =  renderOptions.color;
        guiContext.strokeStyle =  renderOptions.color;        
    }

    // If overwriting line width, then update that here
    if(renderOptions.lineWidth)
    {
        guiContext.lineWidth = renderOptions.lineWidth;
    }

    if(renderOptions.lineCap)
    {
        guiContext.lineCap = renderOptions.lineCap;
    }


    // https://www.w3schools.com/tags/canvas_arc.asp
    guiContext.beginPath();
    guiContext.arc( centerPoint.x, centerPoint.y, radius, angleStart*Math.PI/180, angleEnd*Math.PI/180);

    // If fill is true, fill the box, otherwise just make an outline
    if(renderOptions.fill)
    {
        guiContext.fill();
    }
    else
    {
        guiContext.stroke();
    }

    guiContext.restore();

}

function Line(guiContext, startPoint, endPoint, renderOptions )
{
    guiContext.save();

    if( renderOptions.color)
    {
        guiContext.fillStyle   =  renderOptions.color;
        guiContext.strokeStyle =  renderOptions.color;        
    }

    // If overwriting line width, then update that here
    if(renderOptions.lineWidth)
    {
        guiContext.lineWidth = renderOptions.lineWidth;
    }

    if(renderOptions.lineCap)
    {
        guiContext.lineCap = renderOptions.lineCap;
    }

    guiContext.beginPath();
    guiContext.moveTo(startPoint.x, startPoint.y);
    guiContext.lineTo(endPoint.x, endPoint.y);

    // If fill is true, fill the box, otherwise just make an outline
    if(renderOptions.fill)
    {
        guiContext.fill();
    }
    else
    {
        guiContext.stroke();
    }

    guiContext.restore();

}

function RegularPolygon(guiContext, centerPoint, vertices, angle, renderOptions )
{

    guiContext.save();
    if( renderOptions.color)
    {
        guiContext.fillStyle  =  renderOptions.color;
        guiContext.strokeStyle =  renderOptions.color;        
    }
    // If overwriting line width, then update that here
    if(renderOptions.lineWidth)
    {
        guiContext.lineWidth = renderOptions.lineWidth;
    }

    if(renderOptions.globalAlpha)
    {
        guiContext.globalAlpha = renderOptions.globalAlpha;
    }

    guiContext.translate(centerPoint.x, centerPoint.y);
    /* 
       Rotate origin based on angle given
       NOTE: compared to oblong pads, no additional modification is required
             of angle to get the angle to rotate correctly.
    */
    guiContext.rotate(angle*Math.PI/180);

    /* 
       Rotate origin based on angle given
       NOTE: compared to oblong pads, no additional modification is required
             of angle to get the angle to rotate correctly.
    */
    //guiContext.rotate((angle)*Math.PI/180);

    guiContext.beginPath();
    guiContext.moveTo(vertices[0].x,vertices[0].y);

    for(var i = 1; i < vertices.length; i++)
    {
        guiContext.lineTo(vertices[i].x,vertices[i].y);
    }
    guiContext.closePath();
    
    // If fill is true, fill the box, otherwise just make an outline
    if(renderOptions.fill)
    {
        guiContext.fill();
    }
    else
    {
        guiContext.stroke();
    }

    guiContext.restore();

}


function IrregularPolygon(guiContext, vertices, renderOptions )
{

    guiContext.save();
    if( renderOptions.color)
    {
        guiContext.fillStyle  =  renderOptions.color;
        guiContext.strokeStyle =  renderOptions.color;        
    }
    // If overwriting line width, then update that here
    if(renderOptions.lineWidth)
    {
        guiContext.lineWidth = renderOptions.lineWidth;
    }

    if(renderOptions.globalAlpha)
    {
        guiContext.globalAlpha = renderOptions.globalAlpha;
    }

    if(renderOptions.compositionType)
    {
        guiContext.globalCompositeOperation  = renderOptions.compositionType;
    }

    guiContext.beginPath();
    guiContext.moveTo(vertices[0].x,vertices[0].y);

    for(var i = 1; i < vertices.length; i++)
    {
        guiContext.lineTo(vertices[i].x,vertices[i].y);
    }
    guiContext.closePath();

    // If fill is true, fill the box, otherwise just make an outline
    if(renderOptions.fill)
    {
        guiContext.fill();
    }
    else
    {
        guiContext.stroke();
    }

    guiContext.restore();

}


function Circle(guiContext, centerPoint, radius, renderOptions)
{
    guiContext.save();
    
    if( renderOptions.color)
    {
        guiContext.fillStyle  =  renderOptions.color;
        guiContext.strokeStyle =  renderOptions.color;        
    }

    if(renderOptions.lineWidth)
    {
        guiContext.lineWidth = renderOptions.lineWidth;
    }

    /* Draw the drill hole */
    guiContext.beginPath();
    guiContext.arc(centerPoint.x,centerPoint.y, radius, 0, 2*Math.PI);

    if(renderOptions.fill)
    {
        guiContext.fill();
    }
    else
    {
        guiContext.stroke();
    }

    guiContext.restore();
}


/*
    To render an oval some javascript trickery is used. To half circles are rendered, 
    and since by default when drawing shapes they will by default be connected by at 
    least one point if close path is not called. So by just calling the top and bottom 
    half circles, the rectangular center of the half circle will be filled.
*/
function Oval(guiContext, centerPoint, height, width, angle, renderOptions)
{

    // Center point of both circles.
    let centerPoint1 = new Point(0, -height/2);
    let centerPoint2 = new Point(0, height/2);
    let radius = width/2;

    guiContext.save();
    if( renderOptions.color)
    {
        guiContext.fillStyle  =  renderOptions.color;
        guiContext.strokeStyle =  renderOptions.color;
    }

    /*
        The following only really needs to draw two semicircles as internally the semicircles will 
        attach to each other to create the completed object.
     */

    guiContext.translate(centerPoint.x, centerPoint.y);
    /* 
       Rotate origin based on angle given
       NOTE: For some reason EagleCAD items are rotated by 90 degrees by default. 
             This corrects for that so items are displayed correctly.
             This seems to also only be required for oblong pads. This is most likely due to the 
             arc functions used.
    */
    guiContext.rotate((angle-90)*Math.PI/180);

    guiContext.beginPath();
    guiContext.arc(centerPoint1.x, centerPoint1.y, radius, Math.PI,0);
    guiContext.arc(centerPoint2.x, centerPoint2.y, radius, 0, Math.PI );
    guiContext.closePath();
    
    if(renderOptions.fill)
    {
        guiContext.fill();
    }
    else
    {
        guiContext.stroke();
    }

    // Restores context to state prior to this rendering function being called. 
    guiContext.restore();
}


module.exports = {
    Arc, Line, RegularPolygon, IrregularPolygon, Circle, Oval
};

},{"./point.js":9}],14:[function(require,module,exports){
"use strict";
var render_lowlevel     = require("./render_lowlevel.js");
var Point               = require("./point.js").Point;

function DrawDrillHole(guiContext, x, y, radius)
{

    let centerPoint = new Point(x, y);


    let renderOptions = {
        color: "#CCCCCC",
        fill: true,
    };

    render_lowlevel.Circle(
        guiContext,
        centerPoint,                         
        radius, 
        renderOptions
    );                     
}

function Rectangle(guiContext, pad, color)
{
    let centerPoint = new Point(pad.x, pad.y);

    /*
            The following derive the corner points for the
            rectangular pad. These are calculated using the center 
            point of the rectangle along with the width and height 
            of the rectangle. 
    */
    // Top left point
    let point0 = new Point(-pad.dx/2, pad.dy/2);
    // Top right point
    let point1 = new Point(pad.dx/2, pad.dy/2);
    // Bottom right point
    let point2 = new Point(pad.dx/2, -pad.dy/2);
    // Bottom left point
    let point3 = new Point(-pad.dx/2, -pad.dy/2);


    let renderOptions = {
        color: color,
        fill: true,
    };

    render_lowlevel.RegularPolygon( 
        guiContext,
        centerPoint, 
        [point0, point1, point2, point3],
        pad.angle,
        renderOptions
    );

    if(pad.pad_type == "tht")
    {
        DrawDrillHole(guiContext, pad.x, pad.y, pad.drill/2);
    }
}

/*
    An oblong pad can be thought of as having a rectangular middle with two semicircle ends. 

    EagleCAD provides provides three pieces of information for generating these pads. 
        1) Center point = Center of part
        2) Diameter = distance from center point to edge of semicircle
        3) Elongation =% ratio relating diameter to width

    The design also has 4 points of  interest, each representing the 
    corner of the rectangle. 

    To render the length and width are derived. This is divided in half to get the 
    values used to translate the central point to one of the verticies. 
*/
function Oblong(guiContext, pad, color)
{    
    // Diameter is the disnce from center of pad to tip of circle
    // elongation is a factor that related the diameter to the width
    // This is the total width
    let width   = pad.diameter*pad.elongation/100;
    
    // THe width of the rectangle is the diameter -half the radius.
    // See documentation on how these are calculated.
    let height  = (pad.diameter-width/2)*2;

    // assumes oval is centered at (0,0)
    let centerPoint = new Point(pad.x, pad.y);

    let renderOptions = { 
        color: color,
        fill: true,
    };

    render_lowlevel.Oval( 
        guiContext,
        centerPoint,
        height,
        width,
        pad.angle,
        renderOptions
    );

    /* Only draw drill hole if tht type pad */
    if(pad.pad_type == "tht")
    {
        DrawDrillHole(guiContext, pad.x, pad.y, pad.drill/2);
    }
}

function Round(guiContext, pad, color)
{
    let centerPoint = new Point(pad.x, pad.y);

    let renderOptions = {
        color: color,
        fill: true,
    };

    render_lowlevel.Circle( 
        guiContext,
        centerPoint,                         
        pad.drill, 
        renderOptions
    ); 

    if(pad.pad_type == "tht")
    {
        DrawDrillHole(guiContext, pad.x, pad.y, pad.drill/2);
    }
}

function Octagon(guiContext, pad, color)
{
    // Will store the verticies of the polygon.
    let polygonVerticies = [];

    
    let n = 8;
    let r = pad.diameter/2;
    // Assumes a polygon centered at (0,0)
    for (let i = 1; i <= n; i++) 
    {
        polygonVerticies.push(new Point(r * Math.cos(2 * Math.PI * i / n), r * Math.sin(2 * Math.PI * i / n)));
    }

    let angle = (pad.angle+45/2);
    let centerPoint = new Point(pad.x, pad.y);

    let renderOptions = { 
        color: color,
        fill: true,
    };

    render_lowlevel.RegularPolygon( 
        guiContext,
        centerPoint, 
        polygonVerticies,
        angle,
        renderOptions
    );

    /* Only draw drill hole if tht type pad */
    if(pad.pad_type == "tht")
    {
        DrawDrillHole(guiContext, pad.x, pad.y, pad.drill/2);
    }
}

module.exports = {
    Rectangle, Oblong, Round, Octagon
};

},{"./point.js":9,"./render_lowlevel.js":13}],15:[function(require,module,exports){
"use strict";
var render_lowlevel     = require("./render_lowlevel.js");
var Point               = require("./point.js").Point;

// Line width is not included as part of the trace as it will depend on the current gui scale factor.
function Arc(guiContext, trace, lineWidth, color)
{

    let centerPoint = new Point(trace.cx0, trace.cy0);


    let renderOptions = { 
        color: color,
        fill: false,
        lineWidth: lineWidth,
        lineCap: "round" 
    };

    render_lowlevel.Arc( 
        guiContext,
        centerPoint,
        trace.radius,
        trace.angle0,
        trace.angle1,
        renderOptions
    );
}

function Line(guiContext, trace, lineWidth, color)
{
    let startPoint = new Point(trace.x0, trace.y0);
    let endPoint   = new Point(trace.x1, trace.y1);

    let renderOptions = { 
        color: color,
        fill: false,
        lineWidth: lineWidth,
        lineCap: "round" 
    };

    render_lowlevel.Line( 
        guiContext,
        startPoint,
        endPoint,
        renderOptions
    );
}

// Line width is not included as part of the trace as it will depend on the current gui scale factor.
function Circle(guiContext, trace, lineWidth, color)
{

    let centerPoint = new Point(trace.cx0, trace.cy0);

    let renderOptions = { 
        color: color,
        fill: false,
        lineWidth: lineWidth,
        lineCap: "round" 
    };

    render_lowlevel.Arc( 
        guiContext,
        centerPoint,
        trace.radius,
        0, 
        2*Math.PI,
        renderOptions
    );
}

module.exports = {
    Arc, Line, Circle
};

},{"./point.js":9,"./render_lowlevel.js":13}],16:[function(require,module,exports){
"use strict";
var render_lowlevel     = require("./render_lowlevel.js");
var Point               = require("./point.js").Point;

// Line width is not included as part of the trace as it will depend on the current gui scale factor.
function Arc(guiContext, trace, lineWidth, color)
{

    let centerPoint = new Point(trace.cx0, trace.cy0);

    let renderOptions = { 
        color: color,
        fill: false,
        lineWidth: lineWidth,
        lineCap: "round" 
    };

    render_lowlevel.Arc( 
        guiContext,
        centerPoint,
        trace.radius,
        trace.angle0,
        trace.angle1,
        renderOptions
    );
}

function Line(guiContext, trace, lineWidth, color)
{
    let startPoint = new Point(trace.x0, trace.y0);
    let endPoint   = new Point(trace.x1, trace.y1);

    let renderOptions = { 
        color: color,
        fill: false,
        lineWidth: lineWidth,
        lineCap: "round" 
    };
    render_lowlevel.Line(
        guiContext,
        startPoint,
        endPoint,
        renderOptions
    );
}

function Polygon(guiContext, segments, lineWidth, color, isPositive)
{
    let vertices = [];
    for (let i of segments)
    {
        let point1 = new Point(i.x0, i.y0);
        vertices.push(point1);
    }
    let compositionType = (isPositive) ? "source-over" : "destination-out";

    let renderOptions = { color: color,
        fill: true,
        compositionType: compositionType
    };

    render_lowlevel.IrregularPolygon( 
        guiContext,
        vertices,
        renderOptions
    );
}

module.exports = {
    Arc, Line, Polygon
};

},{"./point.js":9,"./render_lowlevel.js":13}],17:[function(require,module,exports){
"use strict";
var render_lowlevel     = require("./render_lowlevel.js");
var Point               = require("./point.js").Point;


function GetPolygonVerticies(radius, numberSized)
{
    // Will store the verticies of the polygon.
    let polygonVerticies = [];
    // Assumes a polygon centered at (0,0)
    // Assumes that a circumscribed polygon. The formulas used belo are for a inscribed polygon. 
    // To convert between a circumscribed to an inscribed polygon, the radius for the outer polygon needs to be calculated.
    // Some of the theory for below comes from 
    // https://www.maa.org/external_archive/joma/Volume7/Aktumen/Polygon.html
    // // Its is some basic trig and geometry
    let alpha = (2*Math.PI / (2*numberSized));
    let inscribed_radius = radius /Math.cos(alpha);
    for (let i = 1; i <= numberSized; i++) 
    {

        polygonVerticies.push(new Point(inscribed_radius * Math.cos(2 * Math.PI * i / numberSized), inscribed_radius * Math.sin(2 * Math.PI * i / numberSized)));
    }

    return polygonVerticies;
}

function Square(guiContext, centerPoint, diameter, drillDiameter, colorVia, colorDrill)
{
    let polygonVerticies = GetPolygonVerticies(diameter/2, 4);

    // This is needed in order so that the shape is rendered with correct orientation, ie top of 
    // shape is parallel to top and bottom of the display.
    let angle = 45;

    let renderOptions = {
        color: colorVia,
        fill: true,
    };

    render_lowlevel.RegularPolygon( 
        guiContext,
        centerPoint, 
        polygonVerticies,
        angle,
        renderOptions
    );

    // Draw drill hole
    renderOptions = {
        color: colorDrill,
        fill: true,
    };

    render_lowlevel.Circle( 
        guiContext,
        centerPoint,
        drillDiameter/2, 
        renderOptions
    ); 
}

function Octagon(guiContext, centerPoint, diameter, drillDiameter, colorVia, colorDrill)
{
    // Will store the verticies of the polygon.
    let polygonVerticies = GetPolygonVerticies(diameter/2, 8);
    let angle = (45/2);

    let renderOptions = { 
        color: colorVia,
        fill: true,
    };

    render_lowlevel.RegularPolygon( 
        guiContext,
        centerPoint, 
        polygonVerticies,
        angle,
        renderOptions
    );

    // Draw drill hole
    renderOptions = {
        color: colorDrill,
        fill: true,
    };

    render_lowlevel.Circle( 
        guiContext,
        centerPoint,
        drillDiameter/2, 
        renderOptions
    ); 
}

function Round(guiContext, centerPoint, diameter, drillDiameter, colorVia, colorDrill)
{

    let renderOptions = {
        color: colorVia,
        fill: true,
    };

    render_lowlevel.Circle( 
        guiContext,
        centerPoint,
        diameter/2, 
        renderOptions
    ); 
    
    // Draw drill hole
    renderOptions = {
        color: colorDrill,
        fill: true,
    };

    render_lowlevel.Circle( 
        guiContext,
        centerPoint,
        drillDiameter/2, 
        renderOptions
    ); 

    // Restores context to state prior to this rendering function being called. 
    guiContext.restore();
}

module.exports = {
    Square, Octagon, Round,
};

},{"./point.js":9,"./render_lowlevel.js":13}]},{},[6,8,5,7,2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvc3BsaXQuanMvc3BsaXQuanMiLCJzcmMvY29sb3JtYXAuanMiLCJzcmMvZ2xvYmFsLmpzIiwic3JjL2hhbmRsZXJzX21vdXNlLmpzIiwic3JjL2h0bWxGdW5jdGlvbnMuanMiLCJzcmMvaWJvbS5qcyIsInNyYy9wY2IuanMiLCJzcmMvcmVuZGVyLmpzIiwic3JjL3JlbmRlci9wb2ludC5qcyIsInNyYy9yZW5kZXIvcmVuZGVyX2JvYXJkZWRnZS5qcyIsInNyYy9yZW5kZXIvcmVuZGVyX2JvdW5kaW5nYm94LmpzIiwic3JjL3JlbmRlci9yZW5kZXJfY2FudmFzLmpzIiwic3JjL3JlbmRlci9yZW5kZXJfbG93bGV2ZWwuanMiLCJzcmMvcmVuZGVyL3JlbmRlcl9wYWQuanMiLCJzcmMvcmVuZGVyL3JlbmRlcl9zaWxrc2NyZWVuLmpzIiwic3JjL3JlbmRlci9yZW5kZXJfdHJhY2UuanMiLCJzcmMvcmVuZGVyL3JlbmRlcl92aWEuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeGhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3AyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8qISBTcGxpdC5qcyAtIHYxLjMuNSAqL1xuXG4oZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG5cdHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG5cdChnbG9iYWwuU3BsaXQgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cbi8vIFRoZSBwcm9ncmFtbWluZyBnb2FscyBvZiBTcGxpdC5qcyBhcmUgdG8gZGVsaXZlciByZWFkYWJsZSwgdW5kZXJzdGFuZGFibGUgYW5kXG4vLyBtYWludGFpbmFibGUgY29kZSwgd2hpbGUgYXQgdGhlIHNhbWUgdGltZSBtYW51YWxseSBvcHRpbWl6aW5nIGZvciB0aW55IG1pbmlmaWVkIGZpbGUgc2l6ZSxcbi8vIGJyb3dzZXIgY29tcGF0aWJpbGl0eSB3aXRob3V0IGFkZGl0aW9uYWwgcmVxdWlyZW1lbnRzLCBncmFjZWZ1bCBmYWxsYmFjayAoSUU4IGlzIHN1cHBvcnRlZClcbi8vIGFuZCB2ZXJ5IGZldyBhc3N1bXB0aW9ucyBhYm91dCB0aGUgdXNlcidzIHBhZ2UgbGF5b3V0LlxudmFyIGdsb2JhbCA9IHdpbmRvdztcbnZhciBkb2N1bWVudCA9IGdsb2JhbC5kb2N1bWVudDtcblxuLy8gU2F2ZSBhIGNvdXBsZSBsb25nIGZ1bmN0aW9uIG5hbWVzIHRoYXQgYXJlIHVzZWQgZnJlcXVlbnRseS5cbi8vIFRoaXMgb3B0aW1pemF0aW9uIHNhdmVzIGFyb3VuZCA0MDAgYnl0ZXMuXG52YXIgYWRkRXZlbnRMaXN0ZW5lciA9ICdhZGRFdmVudExpc3RlbmVyJztcbnZhciByZW1vdmVFdmVudExpc3RlbmVyID0gJ3JlbW92ZUV2ZW50TGlzdGVuZXInO1xudmFyIGdldEJvdW5kaW5nQ2xpZW50UmVjdCA9ICdnZXRCb3VuZGluZ0NsaWVudFJlY3QnO1xudmFyIE5PT1AgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBmYWxzZTsgfTtcblxuLy8gRmlndXJlIG91dCBpZiB3ZSdyZSBpbiBJRTggb3Igbm90LiBJRTggd2lsbCBzdGlsbCByZW5kZXIgY29ycmVjdGx5LFxuLy8gYnV0IHdpbGwgYmUgc3RhdGljIGluc3RlYWQgb2YgZHJhZ2dhYmxlLlxudmFyIGlzSUU4ID0gZ2xvYmFsLmF0dGFjaEV2ZW50ICYmICFnbG9iYWxbYWRkRXZlbnRMaXN0ZW5lcl07XG5cbi8vIFRoaXMgbGlicmFyeSBvbmx5IG5lZWRzIHR3byBoZWxwZXIgZnVuY3Rpb25zOlxuLy9cbi8vIFRoZSBmaXJzdCBkZXRlcm1pbmVzIHdoaWNoIHByZWZpeGVzIG9mIENTUyBjYWxjIHdlIG5lZWQuXG4vLyBXZSBvbmx5IG5lZWQgdG8gZG8gdGhpcyBvbmNlIG9uIHN0YXJ0dXAsIHdoZW4gdGhpcyBhbm9ueW1vdXMgZnVuY3Rpb24gaXMgY2FsbGVkLlxuLy9cbi8vIFRlc3RzIC13ZWJraXQsIC1tb3ogYW5kIC1vIHByZWZpeGVzLiBNb2RpZmllZCBmcm9tIFN0YWNrT3ZlcmZsb3c6XG4vLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE2NjI1MTQwL2pzLWZlYXR1cmUtZGV0ZWN0aW9uLXRvLWRldGVjdC10aGUtdXNhZ2Utb2Ytd2Via2l0LWNhbGMtb3Zlci1jYWxjLzE2NjI1MTY3IzE2NjI1MTY3XG52YXIgY2FsYyA9IChbJycsICctd2Via2l0LScsICctbW96LScsICctby0nXS5maWx0ZXIoZnVuY3Rpb24gKHByZWZpeCkge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGVsLnN0eWxlLmNzc1RleHQgPSBcIndpZHRoOlwiICsgcHJlZml4ICsgXCJjYWxjKDlweClcIjtcblxuICAgIHJldHVybiAoISFlbC5zdHlsZS5sZW5ndGgpXG59KS5zaGlmdCgpKSArIFwiY2FsY1wiO1xuXG4vLyBUaGUgc2Vjb25kIGhlbHBlciBmdW5jdGlvbiBhbGxvd3MgZWxlbWVudHMgYW5kIHN0cmluZyBzZWxlY3RvcnMgdG8gYmUgdXNlZFxuLy8gaW50ZXJjaGFuZ2VhYmx5LiBJbiBlaXRoZXIgY2FzZSBhbiBlbGVtZW50IGlzIHJldHVybmVkLiBUaGlzIGFsbG93cyB1cyB0b1xuLy8gZG8gYFNwbGl0KFtlbGVtMSwgZWxlbTJdKWAgYXMgd2VsbCBhcyBgU3BsaXQoWycjaWQxJywgJyNpZDInXSlgLlxudmFyIGVsZW1lbnRPclNlbGVjdG9yID0gZnVuY3Rpb24gKGVsKSB7XG4gICAgaWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgfHwgZWwgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpXG4gICAgfVxuXG4gICAgcmV0dXJuIGVsXG59O1xuXG4vLyBUaGUgbWFpbiBmdW5jdGlvbiB0byBpbml0aWFsaXplIGEgc3BsaXQuIFNwbGl0LmpzIHRoaW5rcyBhYm91dCBlYWNoIHBhaXJcbi8vIG9mIGVsZW1lbnRzIGFzIGFuIGluZGVwZW5kYW50IHBhaXIuIERyYWdnaW5nIHRoZSBndXR0ZXIgYmV0d2VlbiB0d28gZWxlbWVudHNcbi8vIG9ubHkgY2hhbmdlcyB0aGUgZGltZW5zaW9ucyBvZiBlbGVtZW50cyBpbiB0aGF0IHBhaXIuIFRoaXMgaXMga2V5IHRvIHVuZGVyc3RhbmRpbmdcbi8vIGhvdyB0aGUgZm9sbG93aW5nIGZ1bmN0aW9ucyBvcGVyYXRlLCBzaW5jZSBlYWNoIGZ1bmN0aW9uIGlzIGJvdW5kIHRvIGEgcGFpci5cbi8vXG4vLyBBIHBhaXIgb2JqZWN0IGlzIHNoYXBlZCBsaWtlIHRoaXM6XG4vL1xuLy8ge1xuLy8gICAgIGE6IERPTSBlbGVtZW50LFxuLy8gICAgIGI6IERPTSBlbGVtZW50LFxuLy8gICAgIGFNaW46IE51bWJlcixcbi8vICAgICBiTWluOiBOdW1iZXIsXG4vLyAgICAgZHJhZ2dpbmc6IEJvb2xlYW4sXG4vLyAgICAgcGFyZW50OiBET00gZWxlbWVudCxcbi8vICAgICBpc0ZpcnN0OiBCb29sZWFuLFxuLy8gICAgIGlzTGFzdDogQm9vbGVhbixcbi8vICAgICBkaXJlY3Rpb246ICdob3Jpem9udGFsJyB8ICd2ZXJ0aWNhbCdcbi8vIH1cbi8vXG4vLyBUaGUgYmFzaWMgc2VxdWVuY2U6XG4vL1xuLy8gMS4gU2V0IGRlZmF1bHRzIHRvIHNvbWV0aGluZyBzYW5lLiBgb3B0aW9uc2AgZG9lc24ndCBoYXZlIHRvIGJlIHBhc3NlZCBhdCBhbGwuXG4vLyAyLiBJbml0aWFsaXplIGEgYnVuY2ggb2Ygc3RyaW5ncyBiYXNlZCBvbiB0aGUgZGlyZWN0aW9uIHdlJ3JlIHNwbGl0dGluZy5cbi8vICAgIEEgbG90IG9mIHRoZSBiZWhhdmlvciBpbiB0aGUgcmVzdCBvZiB0aGUgbGlicmFyeSBpcyBwYXJhbWF0aXplZCBkb3duIHRvXG4vLyAgICByZWx5IG9uIENTUyBzdHJpbmdzIGFuZCBjbGFzc2VzLlxuLy8gMy4gRGVmaW5lIHRoZSBkcmFnZ2luZyBoZWxwZXIgZnVuY3Rpb25zLCBhbmQgYSBmZXcgaGVscGVycyB0byBnbyB3aXRoIHRoZW0uXG4vLyA0LiBMb29wIHRocm91Z2ggdGhlIGVsZW1lbnRzIHdoaWxlIHBhaXJpbmcgdGhlbSBvZmYuIEV2ZXJ5IHBhaXIgZ2V0cyBhblxuLy8gICAgYHBhaXJgIG9iamVjdCwgYSBndXR0ZXIsIGFuZCBzcGVjaWFsIGlzRmlyc3QvaXNMYXN0IHByb3BlcnRpZXMuXG4vLyA1LiBBY3R1YWxseSBzaXplIHRoZSBwYWlyIGVsZW1lbnRzLCBpbnNlcnQgZ3V0dGVycyBhbmQgYXR0YWNoIGV2ZW50IGxpc3RlbmVycy5cbnZhciBTcGxpdCA9IGZ1bmN0aW9uIChpZHMsIG9wdGlvbnMpIHtcbiAgICBpZiAoIG9wdGlvbnMgPT09IHZvaWQgMCApIG9wdGlvbnMgPSB7fTtcblxuICAgIHZhciBkaW1lbnNpb247XG4gICAgdmFyIGNsaWVudERpbWVuc2lvbjtcbiAgICB2YXIgY2xpZW50QXhpcztcbiAgICB2YXIgcG9zaXRpb247XG4gICAgdmFyIHBhZGRpbmdBO1xuICAgIHZhciBwYWRkaW5nQjtcbiAgICB2YXIgZWxlbWVudHM7XG5cbiAgICAvLyBBbGwgRE9NIGVsZW1lbnRzIGluIHRoZSBzcGxpdCBzaG91bGQgaGF2ZSBhIGNvbW1vbiBwYXJlbnQuIFdlIGNhbiBncmFiXG4gICAgLy8gdGhlIGZpcnN0IGVsZW1lbnRzIHBhcmVudCBhbmQgaG9wZSB1c2VycyByZWFkIHRoZSBkb2NzIGJlY2F1c2UgdGhlXG4gICAgLy8gYmVoYXZpb3Igd2lsbCBiZSB3aGFja3kgb3RoZXJ3aXNlLlxuICAgIHZhciBwYXJlbnQgPSBlbGVtZW50T3JTZWxlY3RvcihpZHNbMF0pLnBhcmVudE5vZGU7XG4gICAgdmFyIHBhcmVudEZsZXhEaXJlY3Rpb24gPSBnbG9iYWwuZ2V0Q29tcHV0ZWRTdHlsZShwYXJlbnQpLmZsZXhEaXJlY3Rpb247XG5cbiAgICAvLyBTZXQgZGVmYXVsdCBvcHRpb25zLnNpemVzIHRvIGVxdWFsIHBlcmNlbnRhZ2VzIG9mIHRoZSBwYXJlbnQgZWxlbWVudC5cbiAgICB2YXIgc2l6ZXMgPSBvcHRpb25zLnNpemVzIHx8IGlkcy5tYXAoZnVuY3Rpb24gKCkgeyByZXR1cm4gMTAwIC8gaWRzLmxlbmd0aDsgfSk7XG5cbiAgICAvLyBTdGFuZGFyZGl6ZSBtaW5TaXplIHRvIGFuIGFycmF5IGlmIGl0IGlzbid0IGFscmVhZHkuIFRoaXMgYWxsb3dzIG1pblNpemVcbiAgICAvLyB0byBiZSBwYXNzZWQgYXMgYSBudW1iZXIuXG4gICAgdmFyIG1pblNpemUgPSBvcHRpb25zLm1pblNpemUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubWluU2l6ZSA6IDEwMDtcbiAgICB2YXIgbWluU2l6ZXMgPSBBcnJheS5pc0FycmF5KG1pblNpemUpID8gbWluU2l6ZSA6IGlkcy5tYXAoZnVuY3Rpb24gKCkgeyByZXR1cm4gbWluU2l6ZTsgfSk7XG4gICAgdmFyIGd1dHRlclNpemUgPSBvcHRpb25zLmd1dHRlclNpemUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3V0dGVyU2l6ZSA6IDEwO1xuICAgIHZhciBzbmFwT2Zmc2V0ID0gb3B0aW9ucy5zbmFwT2Zmc2V0ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNuYXBPZmZzZXQgOiAzMDtcbiAgICB2YXIgZGlyZWN0aW9uID0gb3B0aW9ucy5kaXJlY3Rpb24gfHwgJ2hvcml6b250YWwnO1xuICAgIHZhciBjdXJzb3IgPSBvcHRpb25zLmN1cnNvciB8fCAoZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCcgPyAnZXctcmVzaXplJyA6ICducy1yZXNpemUnKTtcbiAgICB2YXIgZ3V0dGVyID0gb3B0aW9ucy5ndXR0ZXIgfHwgKGZ1bmN0aW9uIChpLCBndXR0ZXJEaXJlY3Rpb24pIHtcbiAgICAgICAgdmFyIGd1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBndXQuY2xhc3NOYW1lID0gXCJndXR0ZXIgZ3V0dGVyLVwiICsgZ3V0dGVyRGlyZWN0aW9uO1xuICAgICAgICByZXR1cm4gZ3V0XG4gICAgfSk7XG4gICAgdmFyIGVsZW1lbnRTdHlsZSA9IG9wdGlvbnMuZWxlbWVudFN0eWxlIHx8IChmdW5jdGlvbiAoZGltLCBzaXplLCBndXRTaXplKSB7XG4gICAgICAgIHZhciBzdHlsZSA9IHt9O1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ3N0cmluZycgJiYgIShzaXplIGluc3RhbmNlb2YgU3RyaW5nKSkge1xuICAgICAgICAgICAgaWYgKCFpc0lFOCkge1xuICAgICAgICAgICAgICAgIHN0eWxlW2RpbV0gPSBjYWxjICsgXCIoXCIgKyBzaXplICsgXCIlIC0gXCIgKyBndXRTaXplICsgXCJweClcIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3R5bGVbZGltXSA9IHNpemUgKyBcIiVcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0eWxlW2RpbV0gPSBzaXplO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0eWxlXG4gICAgfSk7XG4gICAgdmFyIGd1dHRlclN0eWxlID0gb3B0aW9ucy5ndXR0ZXJTdHlsZSB8fCAoZnVuY3Rpb24gKGRpbSwgZ3V0U2l6ZSkgeyByZXR1cm4gKCggb2JqID0ge30sIG9ialtkaW1dID0gKGd1dFNpemUgKyBcInB4XCIpLCBvYmogKSlcbiAgICAgICAgdmFyIG9iajsgfSk7XG5cbiAgICAvLyAyLiBJbml0aWFsaXplIGEgYnVuY2ggb2Ygc3RyaW5ncyBiYXNlZCBvbiB0aGUgZGlyZWN0aW9uIHdlJ3JlIHNwbGl0dGluZy5cbiAgICAvLyBBIGxvdCBvZiB0aGUgYmVoYXZpb3IgaW4gdGhlIHJlc3Qgb2YgdGhlIGxpYnJhcnkgaXMgcGFyYW1hdGl6ZWQgZG93biB0b1xuICAgIC8vIHJlbHkgb24gQ1NTIHN0cmluZ3MgYW5kIGNsYXNzZXMuXG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ2hvcml6b250YWwnKSB7XG4gICAgICAgIGRpbWVuc2lvbiA9ICd3aWR0aCc7XG4gICAgICAgIGNsaWVudERpbWVuc2lvbiA9ICdjbGllbnRXaWR0aCc7XG4gICAgICAgIGNsaWVudEF4aXMgPSAnY2xpZW50WCc7XG4gICAgICAgIHBvc2l0aW9uID0gJ2xlZnQnO1xuICAgICAgICBwYWRkaW5nQSA9ICdwYWRkaW5nTGVmdCc7XG4gICAgICAgIHBhZGRpbmdCID0gJ3BhZGRpbmdSaWdodCc7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgZGltZW5zaW9uID0gJ2hlaWdodCc7XG4gICAgICAgIGNsaWVudERpbWVuc2lvbiA9ICdjbGllbnRIZWlnaHQnO1xuICAgICAgICBjbGllbnRBeGlzID0gJ2NsaWVudFknO1xuICAgICAgICBwb3NpdGlvbiA9ICd0b3AnO1xuICAgICAgICBwYWRkaW5nQSA9ICdwYWRkaW5nVG9wJztcbiAgICAgICAgcGFkZGluZ0IgPSAncGFkZGluZ0JvdHRvbSc7XG4gICAgfVxuXG4gICAgLy8gMy4gRGVmaW5lIHRoZSBkcmFnZ2luZyBoZWxwZXIgZnVuY3Rpb25zLCBhbmQgYSBmZXcgaGVscGVycyB0byBnbyB3aXRoIHRoZW0uXG4gICAgLy8gRWFjaCBoZWxwZXIgaXMgYm91bmQgdG8gYSBwYWlyIG9iamVjdCB0aGF0IGNvbnRhaW5zIGl0J3MgbWV0YWRhdGEuIFRoaXNcbiAgICAvLyBhbHNvIG1ha2VzIGl0IGVhc3kgdG8gc3RvcmUgcmVmZXJlbmNlcyB0byBsaXN0ZW5lcnMgdGhhdCB0aGF0IHdpbGwgYmVcbiAgICAvLyBhZGRlZCBhbmQgcmVtb3ZlZC5cbiAgICAvL1xuICAgIC8vIEV2ZW4gdGhvdWdoIHRoZXJlIGFyZSBubyBvdGhlciBmdW5jdGlvbnMgY29udGFpbmVkIGluIHRoZW0sIGFsaWFzaW5nXG4gICAgLy8gdGhpcyB0byBzZWxmIHNhdmVzIDUwIGJ5dGVzIG9yIHNvIHNpbmNlIGl0J3MgdXNlZCBzbyBmcmVxdWVudGx5LlxuICAgIC8vXG4gICAgLy8gVGhlIHBhaXIgb2JqZWN0IHNhdmVzIG1ldGFkYXRhIGxpa2UgZHJhZ2dpbmcgc3RhdGUsIHBvc2l0aW9uIGFuZFxuICAgIC8vIGV2ZW50IGxpc3RlbmVyIHJlZmVyZW5jZXMuXG5cbiAgICBmdW5jdGlvbiBzZXRFbGVtZW50U2l6ZSAoZWwsIHNpemUsIGd1dFNpemUpIHtcbiAgICAgICAgLy8gU3BsaXQuanMgYWxsb3dzIHNldHRpbmcgc2l6ZXMgdmlhIG51bWJlcnMgKGlkZWFsbHkpLCBvciBpZiB5b3UgbXVzdCxcbiAgICAgICAgLy8gYnkgc3RyaW5nLCBsaWtlICczMDBweCcuIFRoaXMgaXMgbGVzcyB0aGFuIGlkZWFsLCBiZWNhdXNlIGl0IGJyZWFrc1xuICAgICAgICAvLyB0aGUgZmx1aWQgbGF5b3V0IHRoYXQgYGNhbGMoJSAtIHB4KWAgcHJvdmlkZXMuIFlvdSdyZSBvbiB5b3VyIG93biBpZiB5b3UgZG8gdGhhdCxcbiAgICAgICAgLy8gbWFrZSBzdXJlIHlvdSBjYWxjdWxhdGUgdGhlIGd1dHRlciBzaXplIGJ5IGhhbmQuXG4gICAgICAgIHZhciBzdHlsZSA9IGVsZW1lbnRTdHlsZShkaW1lbnNpb24sIHNpemUsIGd1dFNpemUpO1xuXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1wYXJhbS1yZWFzc2lnblxuICAgICAgICBPYmplY3Qua2V5cyhzdHlsZSkuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkgeyByZXR1cm4gKGVsLnN0eWxlW3Byb3BdID0gc3R5bGVbcHJvcF0pOyB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRHdXR0ZXJTaXplIChndXR0ZXJFbGVtZW50LCBndXRTaXplKSB7XG4gICAgICAgIHZhciBzdHlsZSA9IGd1dHRlclN0eWxlKGRpbWVuc2lvbiwgZ3V0U2l6ZSk7XG5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXBhcmFtLXJlYXNzaWduXG4gICAgICAgIE9iamVjdC5rZXlzKHN0eWxlKS5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7IHJldHVybiAoZ3V0dGVyRWxlbWVudC5zdHlsZVtwcm9wXSA9IHN0eWxlW3Byb3BdKTsgfSk7XG4gICAgfVxuXG4gICAgLy8gQWN0dWFsbHkgYWRqdXN0IHRoZSBzaXplIG9mIGVsZW1lbnRzIGBhYCBhbmQgYGJgIHRvIGBvZmZzZXRgIHdoaWxlIGRyYWdnaW5nLlxuICAgIC8vIGNhbGMgaXMgdXNlZCB0byBhbGxvdyBjYWxjKHBlcmNlbnRhZ2UgKyBndXR0ZXJweCkgb24gdGhlIHdob2xlIHNwbGl0IGluc3RhbmNlLFxuICAgIC8vIHdoaWNoIGFsbG93cyB0aGUgdmlld3BvcnQgdG8gYmUgcmVzaXplZCB3aXRob3V0IGFkZGl0aW9uYWwgbG9naWMuXG4gICAgLy8gRWxlbWVudCBhJ3Mgc2l6ZSBpcyB0aGUgc2FtZSBhcyBvZmZzZXQuIGIncyBzaXplIGlzIHRvdGFsIHNpemUgLSBhIHNpemUuXG4gICAgLy8gQm90aCBzaXplcyBhcmUgY2FsY3VsYXRlZCBmcm9tIHRoZSBpbml0aWFsIHBhcmVudCBwZXJjZW50YWdlLFxuICAgIC8vIHRoZW4gdGhlIGd1dHRlciBzaXplIGlzIHN1YnRyYWN0ZWQuXG4gICAgZnVuY3Rpb24gYWRqdXN0IChvZmZzZXQpIHtcbiAgICAgICAgdmFyIGEgPSBlbGVtZW50c1t0aGlzLmFdO1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3RoaXMuYl07XG4gICAgICAgIHZhciBwZXJjZW50YWdlID0gYS5zaXplICsgYi5zaXplO1xuXG4gICAgICAgIGEuc2l6ZSA9IChvZmZzZXQgLyB0aGlzLnNpemUpICogcGVyY2VudGFnZTtcbiAgICAgICAgYi5zaXplID0gKHBlcmNlbnRhZ2UgLSAoKG9mZnNldCAvIHRoaXMuc2l6ZSkgKiBwZXJjZW50YWdlKSk7XG5cbiAgICAgICAgc2V0RWxlbWVudFNpemUoYS5lbGVtZW50LCBhLnNpemUsIHRoaXMuYUd1dHRlclNpemUpO1xuICAgICAgICBzZXRFbGVtZW50U2l6ZShiLmVsZW1lbnQsIGIuc2l6ZSwgdGhpcy5iR3V0dGVyU2l6ZSk7XG4gICAgfVxuXG4gICAgLy8gZHJhZywgd2hlcmUgYWxsIHRoZSBtYWdpYyBoYXBwZW5zLiBUaGUgbG9naWMgaXMgcmVhbGx5IHF1aXRlIHNpbXBsZTpcbiAgICAvL1xuICAgIC8vIDEuIElnbm9yZSBpZiB0aGUgcGFpciBpcyBub3QgZHJhZ2dpbmcuXG4gICAgLy8gMi4gR2V0IHRoZSBvZmZzZXQgb2YgdGhlIGV2ZW50LlxuICAgIC8vIDMuIFNuYXAgb2Zmc2V0IHRvIG1pbiBpZiB3aXRoaW4gc25hcHBhYmxlIHJhbmdlICh3aXRoaW4gbWluICsgc25hcE9mZnNldCkuXG4gICAgLy8gNC4gQWN0dWFsbHkgYWRqdXN0IGVhY2ggZWxlbWVudCBpbiB0aGUgcGFpciB0byBvZmZzZXQuXG4gICAgLy9cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8ICAgIHwgPC0gYS5taW5TaXplICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgIGIubWluU2l6ZSAtPiB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgPC0gdGhpcy5zbmFwT2Zmc2V0ICAgICAgfHwgICAgIHRoaXMuc25hcE9mZnNldCAtPiB8ICB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgICAgICAgICAgICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgICAgICAgICAgICB8ICB8ICAgIHxcbiAgICAvLyB8ICAgIHwgIHwgICAgICAgICAgICAgICAgICAgICAgICAgfHwgICAgICAgICAgICAgICAgICAgICAgICB8ICB8ICAgIHxcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8IDwtIHRoaXMuc3RhcnQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zaXplIC0+IHxcbiAgICBmdW5jdGlvbiBkcmFnIChlKSB7XG4gICAgICAgIHZhciBvZmZzZXQ7XG5cbiAgICAgICAgaWYgKCF0aGlzLmRyYWdnaW5nKSB7IHJldHVybiB9XG5cbiAgICAgICAgLy8gR2V0IHRoZSBvZmZzZXQgb2YgdGhlIGV2ZW50IGZyb20gdGhlIGZpcnN0IHNpZGUgb2YgdGhlXG4gICAgICAgIC8vIHBhaXIgYHRoaXMuc3RhcnRgLiBTdXBwb3J0cyB0b3VjaCBldmVudHMsIGJ1dCBub3QgbXVsdGl0b3VjaCwgc28gb25seSB0aGUgZmlyc3RcbiAgICAgICAgLy8gZmluZ2VyIGB0b3VjaGVzWzBdYCBpcyBjb3VudGVkLlxuICAgICAgICBpZiAoJ3RvdWNoZXMnIGluIGUpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IGUudG91Y2hlc1swXVtjbGllbnRBeGlzXSAtIHRoaXMuc3RhcnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBlW2NsaWVudEF4aXNdIC0gdGhpcy5zdGFydDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHdpdGhpbiBzbmFwT2Zmc2V0IG9mIG1pbiBvciBtYXgsIHNldCBvZmZzZXQgdG8gbWluIG9yIG1heC5cbiAgICAgICAgLy8gc25hcE9mZnNldCBidWZmZXJzIGEubWluU2l6ZSBhbmQgYi5taW5TaXplLCBzbyBsb2dpYyBpcyBvcHBvc2l0ZSBmb3IgYm90aC5cbiAgICAgICAgLy8gSW5jbHVkZSB0aGUgYXBwcm9wcmlhdGUgZ3V0dGVyIHNpemVzIHRvIHByZXZlbnQgb3ZlcmZsb3dzLlxuICAgICAgICBpZiAob2Zmc2V0IDw9IGVsZW1lbnRzW3RoaXMuYV0ubWluU2l6ZSArIHNuYXBPZmZzZXQgKyB0aGlzLmFHdXR0ZXJTaXplKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBlbGVtZW50c1t0aGlzLmFdLm1pblNpemUgKyB0aGlzLmFHdXR0ZXJTaXplO1xuICAgICAgICB9IGVsc2UgaWYgKG9mZnNldCA+PSB0aGlzLnNpemUgLSAoZWxlbWVudHNbdGhpcy5iXS5taW5TaXplICsgc25hcE9mZnNldCArIHRoaXMuYkd1dHRlclNpemUpKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSB0aGlzLnNpemUgLSAoZWxlbWVudHNbdGhpcy5iXS5taW5TaXplICsgdGhpcy5iR3V0dGVyU2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBY3R1YWxseSBhZGp1c3QgdGhlIHNpemUuXG4gICAgICAgIGFkanVzdC5jYWxsKHRoaXMsIG9mZnNldCk7XG5cbiAgICAgICAgLy8gQ2FsbCB0aGUgZHJhZyBjYWxsYmFjayBjb250aW5vdXNseS4gRG9uJ3QgZG8gYW55dGhpbmcgdG9vIGludGVuc2l2ZVxuICAgICAgICAvLyBpbiB0aGlzIGNhbGxiYWNrLlxuICAgICAgICBpZiAob3B0aW9ucy5vbkRyYWcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMub25EcmFnKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWNoZSBzb21lIGltcG9ydGFudCBzaXplcyB3aGVuIGRyYWcgc3RhcnRzLCBzbyB3ZSBkb24ndCBoYXZlIHRvIGRvIHRoYXRcbiAgICAvLyBjb250aW5vdXNseTpcbiAgICAvL1xuICAgIC8vIGBzaXplYDogVGhlIHRvdGFsIHNpemUgb2YgdGhlIHBhaXIuIEZpcnN0ICsgc2Vjb25kICsgZmlyc3QgZ3V0dGVyICsgc2Vjb25kIGd1dHRlci5cbiAgICAvLyBgc3RhcnRgOiBUaGUgbGVhZGluZyBzaWRlIG9mIHRoZSBmaXJzdCBlbGVtZW50LlxuICAgIC8vXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCAgICAgIGFHdXR0ZXJTaXplIC0+IHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCAgICAgICAgICAgICAgICAgICAgICB8XG4gICAgLy8gfCAgICAgICAgICAgICAgICAgICAgIHx8fCA8LSBiR3V0dGVyU2l6ZSAgICAgICB8XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gfCA8LSBzdGFydCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZSAtPiB8XG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlU2l6ZXMgKCkge1xuICAgICAgICAvLyBGaWd1cmUgb3V0IHRoZSBwYXJlbnQgc2l6ZSBtaW51cyBwYWRkaW5nLlxuICAgICAgICB2YXIgYSA9IGVsZW1lbnRzW3RoaXMuYV0uZWxlbWVudDtcbiAgICAgICAgdmFyIGIgPSBlbGVtZW50c1t0aGlzLmJdLmVsZW1lbnQ7XG5cbiAgICAgICAgdGhpcy5zaXplID0gYVtnZXRCb3VuZGluZ0NsaWVudFJlY3RdKClbZGltZW5zaW9uXSArIGJbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW2RpbWVuc2lvbl0gKyB0aGlzLmFHdXR0ZXJTaXplICsgdGhpcy5iR3V0dGVyU2l6ZTtcbiAgICAgICAgdGhpcy5zdGFydCA9IGFbZ2V0Qm91bmRpbmdDbGllbnRSZWN0XSgpW3Bvc2l0aW9uXTtcbiAgICB9XG5cbiAgICAvLyBzdG9wRHJhZ2dpbmcgaXMgdmVyeSBzaW1pbGFyIHRvIHN0YXJ0RHJhZ2dpbmcgaW4gcmV2ZXJzZS5cbiAgICBmdW5jdGlvbiBzdG9wRHJhZ2dpbmcgKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBhID0gZWxlbWVudHNbc2VsZi5hXS5lbGVtZW50O1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3NlbGYuYl0uZWxlbWVudDtcblxuICAgICAgICBpZiAoc2VsZi5kcmFnZ2luZyAmJiBvcHRpb25zLm9uRHJhZ0VuZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5vbkRyYWdFbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuZHJhZ2dpbmcgPSBmYWxzZTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHN0b3JlZCBldmVudCBsaXN0ZW5lcnMuIFRoaXMgaXMgd2h5IHdlIHN0b3JlIHRoZW0uXG4gICAgICAgIGdsb2JhbFtyZW1vdmVFdmVudExpc3RlbmVyXSgnbW91c2V1cCcsIHNlbGYuc3RvcCk7XG4gICAgICAgIGdsb2JhbFtyZW1vdmVFdmVudExpc3RlbmVyXSgndG91Y2hlbmQnLCBzZWxmLnN0b3ApO1xuICAgICAgICBnbG9iYWxbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3RvdWNoY2FuY2VsJywgc2VsZi5zdG9wKTtcblxuICAgICAgICBzZWxmLnBhcmVudFtyZW1vdmVFdmVudExpc3RlbmVyXSgnbW91c2Vtb3ZlJywgc2VsZi5tb3ZlKTtcbiAgICAgICAgc2VsZi5wYXJlbnRbcmVtb3ZlRXZlbnRMaXN0ZW5lcl0oJ3RvdWNobW92ZScsIHNlbGYubW92ZSk7XG5cbiAgICAgICAgLy8gRGVsZXRlIHRoZW0gb25jZSB0aGV5IGFyZSByZW1vdmVkLiBJIHRoaW5rIHRoaXMgbWFrZXMgYSBkaWZmZXJlbmNlXG4gICAgICAgIC8vIGluIG1lbW9yeSB1c2FnZSB3aXRoIGEgbG90IG9mIHNwbGl0cyBvbiBvbmUgcGFnZS4gQnV0IEkgZG9uJ3Qga25vdyBmb3Igc3VyZS5cbiAgICAgICAgZGVsZXRlIHNlbGYuc3RvcDtcbiAgICAgICAgZGVsZXRlIHNlbGYubW92ZTtcblxuICAgICAgICBhW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdzZWxlY3RzdGFydCcsIE5PT1ApO1xuICAgICAgICBhW3JlbW92ZUV2ZW50TGlzdGVuZXJdKCdkcmFnc3RhcnQnLCBOT09QKTtcbiAgICAgICAgYltyZW1vdmVFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcbiAgICAgICAgYltyZW1vdmVFdmVudExpc3RlbmVyXSgnZHJhZ3N0YXJ0JywgTk9PUCk7XG5cbiAgICAgICAgYS5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgICAgIGEuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICcnO1xuICAgICAgICBhLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnJztcbiAgICAgICAgYS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cbiAgICAgICAgYi5zdHlsZS51c2VyU2VsZWN0ID0gJyc7XG4gICAgICAgIGIuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICcnO1xuICAgICAgICBiLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnJztcbiAgICAgICAgYi5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cbiAgICAgICAgc2VsZi5ndXR0ZXIuc3R5bGUuY3Vyc29yID0gJyc7XG4gICAgICAgIHNlbGYucGFyZW50LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgIH1cblxuICAgIC8vIHN0YXJ0RHJhZ2dpbmcgY2FsbHMgYGNhbGN1bGF0ZVNpemVzYCB0byBzdG9yZSB0aGUgaW5pdGFsIHNpemUgaW4gdGhlIHBhaXIgb2JqZWN0LlxuICAgIC8vIEl0IGFsc28gYWRkcyBldmVudCBsaXN0ZW5lcnMgZm9yIG1vdXNlL3RvdWNoIGV2ZW50cyxcbiAgICAvLyBhbmQgcHJldmVudHMgc2VsZWN0aW9uIHdoaWxlIGRyYWdnaW5nIHNvIGF2b2lkIHRoZSBzZWxlY3RpbmcgdGV4dC5cbiAgICBmdW5jdGlvbiBzdGFydERyYWdnaW5nIChlKSB7XG4gICAgICAgIC8vIEFsaWFzIGZyZXF1ZW50bHkgdXNlZCB2YXJpYWJsZXMgdG8gc2F2ZSBzcGFjZS4gMjAwIGJ5dGVzLlxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBhID0gZWxlbWVudHNbc2VsZi5hXS5lbGVtZW50O1xuICAgICAgICB2YXIgYiA9IGVsZW1lbnRzW3NlbGYuYl0uZWxlbWVudDtcblxuICAgICAgICAvLyBDYWxsIHRoZSBvbkRyYWdTdGFydCBjYWxsYmFjay5cbiAgICAgICAgaWYgKCFzZWxmLmRyYWdnaW5nICYmIG9wdGlvbnMub25EcmFnU3RhcnQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMub25EcmFnU3RhcnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERvbid0IGFjdHVhbGx5IGRyYWcgdGhlIGVsZW1lbnQuIFdlIGVtdWxhdGUgdGhhdCBpbiB0aGUgZHJhZyBmdW5jdGlvbi5cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIC8vIFNldCB0aGUgZHJhZ2dpbmcgcHJvcGVydHkgb2YgdGhlIHBhaXIgb2JqZWN0LlxuICAgICAgICBzZWxmLmRyYWdnaW5nID0gdHJ1ZTtcblxuICAgICAgICAvLyBDcmVhdGUgdHdvIGV2ZW50IGxpc3RlbmVycyBib3VuZCB0byB0aGUgc2FtZSBwYWlyIG9iamVjdCBhbmQgc3RvcmVcbiAgICAgICAgLy8gdGhlbSBpbiB0aGUgcGFpciBvYmplY3QuXG4gICAgICAgIHNlbGYubW92ZSA9IGRyYWcuYmluZChzZWxmKTtcbiAgICAgICAgc2VsZi5zdG9wID0gc3RvcERyYWdnaW5nLmJpbmQoc2VsZik7XG5cbiAgICAgICAgLy8gQWxsIHRoZSBiaW5kaW5nLiBgd2luZG93YCBnZXRzIHRoZSBzdG9wIGV2ZW50cyBpbiBjYXNlIHdlIGRyYWcgb3V0IG9mIHRoZSBlbGVtZW50cy5cbiAgICAgICAgZ2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZXVwJywgc2VsZi5zdG9wKTtcbiAgICAgICAgZ2xvYmFsW2FkZEV2ZW50TGlzdGVuZXJdKCd0b3VjaGVuZCcsIHNlbGYuc3RvcCk7XG4gICAgICAgIGdsb2JhbFthZGRFdmVudExpc3RlbmVyXSgndG91Y2hjYW5jZWwnLCBzZWxmLnN0b3ApO1xuXG4gICAgICAgIHNlbGYucGFyZW50W2FkZEV2ZW50TGlzdGVuZXJdKCdtb3VzZW1vdmUnLCBzZWxmLm1vdmUpO1xuICAgICAgICBzZWxmLnBhcmVudFthZGRFdmVudExpc3RlbmVyXSgndG91Y2htb3ZlJywgc2VsZi5tb3ZlKTtcblxuICAgICAgICAvLyBEaXNhYmxlIHNlbGVjdGlvbi4gRGlzYWJsZSFcbiAgICAgICAgYVthZGRFdmVudExpc3RlbmVyXSgnc2VsZWN0c3RhcnQnLCBOT09QKTtcbiAgICAgICAgYVthZGRFdmVudExpc3RlbmVyXSgnZHJhZ3N0YXJ0JywgTk9PUCk7XG4gICAgICAgIGJbYWRkRXZlbnRMaXN0ZW5lcl0oJ3NlbGVjdHN0YXJ0JywgTk9PUCk7XG4gICAgICAgIGJbYWRkRXZlbnRMaXN0ZW5lcl0oJ2RyYWdzdGFydCcsIE5PT1ApO1xuXG4gICAgICAgIGEuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcbiAgICAgICAgYS5zdHlsZS53ZWJraXRVc2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICBhLnN0eWxlLk1velVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgICAgIGEuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcblxuICAgICAgICBiLnN0eWxlLnVzZXJTZWxlY3QgPSAnbm9uZSc7XG4gICAgICAgIGIuc3R5bGUud2Via2l0VXNlclNlbGVjdCA9ICdub25lJztcbiAgICAgICAgYi5zdHlsZS5Nb3pVc2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICBiLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cbiAgICAgICAgLy8gU2V0IHRoZSBjdXJzb3IsIGJvdGggb24gdGhlIGd1dHRlciBhbmQgdGhlIHBhcmVudCBlbGVtZW50LlxuICAgICAgICAvLyBEb2luZyBvbmx5IGEsIGIgYW5kIGd1dHRlciBjYXVzZXMgZmxpY2tlcmluZy5cbiAgICAgICAgc2VsZi5ndXR0ZXIuc3R5bGUuY3Vyc29yID0gY3Vyc29yO1xuICAgICAgICBzZWxmLnBhcmVudC5zdHlsZS5jdXJzb3IgPSBjdXJzb3I7XG5cbiAgICAgICAgLy8gQ2FjaGUgdGhlIGluaXRpYWwgc2l6ZXMgb2YgdGhlIHBhaXIuXG4gICAgICAgIGNhbGN1bGF0ZVNpemVzLmNhbGwoc2VsZik7XG4gICAgfVxuXG4gICAgLy8gNS4gQ3JlYXRlIHBhaXIgYW5kIGVsZW1lbnQgb2JqZWN0cy4gRWFjaCBwYWlyIGhhcyBhbiBpbmRleCByZWZlcmVuY2UgdG9cbiAgICAvLyBlbGVtZW50cyBgYWAgYW5kIGBiYCBvZiB0aGUgcGFpciAoZmlyc3QgYW5kIHNlY29uZCBlbGVtZW50cykuXG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBlbGVtZW50cyB3aGlsZSBwYWlyaW5nIHRoZW0gb2ZmLiBFdmVyeSBwYWlyIGdldHMgYVxuICAgIC8vIGBwYWlyYCBvYmplY3QsIGEgZ3V0dGVyLCBhbmQgaXNGaXJzdC9pc0xhc3QgcHJvcGVydGllcy5cbiAgICAvL1xuICAgIC8vIEJhc2ljIGxvZ2ljOlxuICAgIC8vXG4gICAgLy8gLSBTdGFydGluZyB3aXRoIHRoZSBzZWNvbmQgZWxlbWVudCBgaSA+IDBgLCBjcmVhdGUgYHBhaXJgIG9iamVjdHMgd2l0aFxuICAgIC8vICAgYGEgPSBpIC0gMWAgYW5kIGBiID0gaWBcbiAgICAvLyAtIFNldCBndXR0ZXIgc2l6ZXMgYmFzZWQgb24gdGhlIF9wYWlyXyBiZWluZyBmaXJzdC9sYXN0LiBUaGUgZmlyc3QgYW5kIGxhc3RcbiAgICAvLyAgIHBhaXIgaGF2ZSBndXR0ZXJTaXplIC8gMiwgc2luY2UgdGhleSBvbmx5IGhhdmUgb25lIGhhbGYgZ3V0dGVyLCBhbmQgbm90IHR3by5cbiAgICAvLyAtIENyZWF0ZSBndXR0ZXIgZWxlbWVudHMgYW5kIGFkZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgLy8gLSBTZXQgdGhlIHNpemUgb2YgdGhlIGVsZW1lbnRzLCBtaW51cyB0aGUgZ3V0dGVyIHNpemVzLlxuICAgIC8vXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB8ICAgICBpPTAgICAgIHwgICAgICAgICBpPTEgICAgICAgICB8ICAgICAgICBpPTIgICAgICAgfCAgICAgIGk9MyAgICAgfFxuICAgIC8vIHwgICAgICAgICAgICAgfCAgICAgICBpc0ZpcnN0ICAgICAgIHwgICAgICAgICAgICAgICAgICB8ICAgICBpc0xhc3QgICB8XG4gICAgLy8gfCAgICAgICAgICAgcGFpciAwICAgICAgICAgICAgICAgIHBhaXIgMSAgICAgICAgICAgICBwYWlyIDIgICAgICAgICAgIHxcbiAgICAvLyB8ICAgICAgICAgICAgIHwgICAgICAgICAgICAgICAgICAgICB8ICAgICAgICAgICAgICAgICAgfCAgICAgICAgICAgICAgfFxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgdmFyIHBhaXJzID0gW107XG4gICAgZWxlbWVudHMgPSBpZHMubWFwKGZ1bmN0aW9uIChpZCwgaSkge1xuICAgICAgICAvLyBDcmVhdGUgdGhlIGVsZW1lbnQgb2JqZWN0LlxuICAgICAgICB2YXIgZWxlbWVudCA9IHtcbiAgICAgICAgICAgIGVsZW1lbnQ6IGVsZW1lbnRPclNlbGVjdG9yKGlkKSxcbiAgICAgICAgICAgIHNpemU6IHNpemVzW2ldLFxuICAgICAgICAgICAgbWluU2l6ZTogbWluU2l6ZXNbaV0sXG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHBhaXI7XG5cbiAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIHBhaXIgb2JqZWN0IHdpdGggaXQncyBtZXRhZGF0YS5cbiAgICAgICAgICAgIHBhaXIgPSB7XG4gICAgICAgICAgICAgICAgYTogaSAtIDEsXG4gICAgICAgICAgICAgICAgYjogaSxcbiAgICAgICAgICAgICAgICBkcmFnZ2luZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgaXNGaXJzdDogKGkgPT09IDEpLFxuICAgICAgICAgICAgICAgIGlzTGFzdDogKGkgPT09IGlkcy5sZW5ndGggLSAxKSxcbiAgICAgICAgICAgICAgICBkaXJlY3Rpb246IGRpcmVjdGlvbixcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IHBhcmVudCxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEZvciBmaXJzdCBhbmQgbGFzdCBwYWlycywgZmlyc3QgYW5kIGxhc3QgZ3V0dGVyIHdpZHRoIGlzIGhhbGYuXG4gICAgICAgICAgICBwYWlyLmFHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZTtcbiAgICAgICAgICAgIHBhaXIuYkd1dHRlclNpemUgPSBndXR0ZXJTaXplO1xuXG4gICAgICAgICAgICBpZiAocGFpci5pc0ZpcnN0KSB7XG4gICAgICAgICAgICAgICAgcGFpci5hR3V0dGVyU2l6ZSA9IGd1dHRlclNpemUgLyAyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocGFpci5pc0xhc3QpIHtcbiAgICAgICAgICAgICAgICBwYWlyLmJHdXR0ZXJTaXplID0gZ3V0dGVyU2l6ZSAvIDI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBwYXJlbnQgaGFzIGEgcmV2ZXJzZSBmbGV4LWRpcmVjdGlvbiwgc3dpdGNoIHRoZSBwYWlyIGVsZW1lbnRzLlxuICAgICAgICAgICAgaWYgKHBhcmVudEZsZXhEaXJlY3Rpb24gPT09ICdyb3ctcmV2ZXJzZScgfHwgcGFyZW50RmxleERpcmVjdGlvbiA9PT0gJ2NvbHVtbi1yZXZlcnNlJykge1xuICAgICAgICAgICAgICAgIHZhciB0ZW1wID0gcGFpci5hO1xuICAgICAgICAgICAgICAgIHBhaXIuYSA9IHBhaXIuYjtcbiAgICAgICAgICAgICAgICBwYWlyLmIgPSB0ZW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBzaXplIG9mIHRoZSBjdXJyZW50IGVsZW1lbnQuIElFOCBpcyBzdXBwb3J0ZWQgYnlcbiAgICAgICAgLy8gc3RhdGljbHkgYXNzaWduaW5nIHNpemVzIHdpdGhvdXQgZHJhZ2dhYmxlIGd1dHRlcnMuIEFzc2lnbnMgYSBzdHJpbmdcbiAgICAgICAgLy8gdG8gYHNpemVgLlxuICAgICAgICAvL1xuICAgICAgICAvLyBJRTkgYW5kIGFib3ZlXG4gICAgICAgIGlmICghaXNJRTgpIHtcbiAgICAgICAgICAgIC8vIENyZWF0ZSBndXR0ZXIgZWxlbWVudHMgZm9yIGVhY2ggcGFpci5cbiAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgIHZhciBndXR0ZXJFbGVtZW50ID0gZ3V0dGVyKGksIGRpcmVjdGlvbik7XG4gICAgICAgICAgICAgICAgc2V0R3V0dGVyU2l6ZShndXR0ZXJFbGVtZW50LCBndXR0ZXJTaXplKTtcblxuICAgICAgICAgICAgICAgIGd1dHRlckVsZW1lbnRbYWRkRXZlbnRMaXN0ZW5lcl0oJ21vdXNlZG93bicsIHN0YXJ0RHJhZ2dpbmcuYmluZChwYWlyKSk7XG4gICAgICAgICAgICAgICAgZ3V0dGVyRWxlbWVudFthZGRFdmVudExpc3RlbmVyXSgndG91Y2hzdGFydCcsIHN0YXJ0RHJhZ2dpbmcuYmluZChwYWlyKSk7XG5cbiAgICAgICAgICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGd1dHRlckVsZW1lbnQsIGVsZW1lbnQuZWxlbWVudCk7XG5cbiAgICAgICAgICAgICAgICBwYWlyLmd1dHRlciA9IGd1dHRlckVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgdGhlIGVsZW1lbnQgc2l6ZSB0byBvdXIgZGV0ZXJtaW5lZCBzaXplLlxuICAgICAgICAvLyBIYWxmLXNpemUgZ3V0dGVycyBmb3IgZmlyc3QgYW5kIGxhc3QgZWxlbWVudHMuXG4gICAgICAgIGlmIChpID09PSAwIHx8IGkgPT09IGlkcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICBzZXRFbGVtZW50U2l6ZShlbGVtZW50LmVsZW1lbnQsIGVsZW1lbnQuc2l6ZSwgZ3V0dGVyU2l6ZSAvIDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0RWxlbWVudFNpemUoZWxlbWVudC5lbGVtZW50LCBlbGVtZW50LnNpemUsIGd1dHRlclNpemUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbXB1dGVkU2l6ZSA9IGVsZW1lbnQuZWxlbWVudFtnZXRCb3VuZGluZ0NsaWVudFJlY3RdKClbZGltZW5zaW9uXTtcblxuICAgICAgICBpZiAoY29tcHV0ZWRTaXplIDwgZWxlbWVudC5taW5TaXplKSB7XG4gICAgICAgICAgICBlbGVtZW50Lm1pblNpemUgPSBjb21wdXRlZFNpemU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZnRlciB0aGUgZmlyc3QgaXRlcmF0aW9uLCBhbmQgd2UgaGF2ZSBhIHBhaXIgb2JqZWN0LCBhcHBlbmQgaXQgdG8gdGhlXG4gICAgICAgIC8vIGxpc3Qgb2YgcGFpcnMuXG4gICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgcGFpcnMucHVzaChwYWlyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlbGVtZW50XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBzZXRTaXplcyAobmV3U2l6ZXMpIHtcbiAgICAgICAgbmV3U2l6ZXMuZm9yRWFjaChmdW5jdGlvbiAobmV3U2l6ZSwgaSkge1xuICAgICAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhaXIgPSBwYWlyc1tpIC0gMV07XG4gICAgICAgICAgICAgICAgdmFyIGEgPSBlbGVtZW50c1twYWlyLmFdO1xuICAgICAgICAgICAgICAgIHZhciBiID0gZWxlbWVudHNbcGFpci5iXTtcblxuICAgICAgICAgICAgICAgIGEuc2l6ZSA9IG5ld1NpemVzW2kgLSAxXTtcbiAgICAgICAgICAgICAgICBiLnNpemUgPSBuZXdTaXplO1xuXG4gICAgICAgICAgICAgICAgc2V0RWxlbWVudFNpemUoYS5lbGVtZW50LCBhLnNpemUsIHBhaXIuYUd1dHRlclNpemUpO1xuICAgICAgICAgICAgICAgIHNldEVsZW1lbnRTaXplKGIuZWxlbWVudCwgYi5zaXplLCBwYWlyLmJHdXR0ZXJTaXplKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgICAgIHBhaXJzLmZvckVhY2goZnVuY3Rpb24gKHBhaXIpIHtcbiAgICAgICAgICAgIHBhaXIucGFyZW50LnJlbW92ZUNoaWxkKHBhaXIuZ3V0dGVyKTtcbiAgICAgICAgICAgIGVsZW1lbnRzW3BhaXIuYV0uZWxlbWVudC5zdHlsZVtkaW1lbnNpb25dID0gJyc7XG4gICAgICAgICAgICBlbGVtZW50c1twYWlyLmJdLmVsZW1lbnQuc3R5bGVbZGltZW5zaW9uXSA9ICcnO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoaXNJRTgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNldFNpemVzOiBzZXRTaXplcyxcbiAgICAgICAgICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBzZXRTaXplczogc2V0U2l6ZXMsXG4gICAgICAgIGdldFNpemVzOiBmdW5jdGlvbiBnZXRTaXplcyAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudHMubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7IHJldHVybiBlbGVtZW50LnNpemU7IH0pXG4gICAgICAgIH0sXG4gICAgICAgIGNvbGxhcHNlOiBmdW5jdGlvbiBjb2xsYXBzZSAoaSkge1xuICAgICAgICAgICAgaWYgKGkgPT09IHBhaXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBwYWlyID0gcGFpcnNbaSAtIDFdO1xuXG4gICAgICAgICAgICAgICAgY2FsY3VsYXRlU2l6ZXMuY2FsbChwYWlyKTtcblxuICAgICAgICAgICAgICAgIGlmICghaXNJRTgpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRqdXN0LmNhbGwocGFpciwgcGFpci5zaXplIC0gcGFpci5iR3V0dGVyU2l6ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFpciQxID0gcGFpcnNbaV07XG5cbiAgICAgICAgICAgICAgICBjYWxjdWxhdGVTaXplcy5jYWxsKHBhaXIkMSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWlzSUU4KSB7XG4gICAgICAgICAgICAgICAgICAgIGFkanVzdC5jYWxsKHBhaXIkMSwgcGFpciQxLmFHdXR0ZXJTaXplKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgfVxufTtcblxucmV0dXJuIFNwbGl0O1xuXG59KSkpO1xuIiwidmFyIGdsb2JhbERhdGEgICAgICAgID0gcmVxdWlyZShcIi4vZ2xvYmFsLmpzXCIpO1xyXG5cclxudmFyIHRyYWNlQ29sb3JNYXAgPSBcclxuWyBcclxuICAgIC8vIExpZ2h0IE1vZGUsIERhcmsgTW9kZVxyXG4gICAgW1wiI0M4MzIzMkI0XCIgLCBcIiNDODMyMzJCNFwiXSxcclxuICAgIFtcIiNDQzY2MDBDOFwiICwgXCIjQ0M2NjAwQzhcIl0sXHJcbiAgICBbXCIjQ0M5OTAwQzhcIiAsIFwiI0NDOTkwMEM4XCJdLFxyXG4gICAgW1wiIzMzNjYwMEM4XCIgLCBcIiMzMzY2MDBDOFwiXSxcclxuICAgIFtcIiM2NjY2MzNDOFwiICwgXCIjNjY2NjMzQzhcIl0sXHJcbiAgICBbXCIjRkZDQzMzQzhcIiAsIFwiI0ZGQ0MzM0M4XCJdLFxyXG4gICAgW1wiIzY2OTkwMEM4XCIgLCBcIiM2Njk5MDBDOFwiXSxcclxuICAgIFtcIiM5OTk5NjZDOFwiICwgXCIjOTk5OTY2QzhcIl0sXHJcbiAgICBbXCIjOTlDQzk5QzhcIiAsIFwiIzk5Q0M5OUM4XCJdLFxyXG4gICAgW1wiIzY2OTk5OUM4XCIgLCBcIiM2Njk5OTlDOFwiXSxcclxuICAgIFtcIiMzM0NDOTlDOFwiICwgXCIjMzNDQzk5QzhcIl0sXHJcbiAgICBbXCIjNjY5OTY2QzhcIiAsIFwiIzY2OTk2NkM4XCJdLFxyXG4gICAgW1wiIzMzNjY2NkM4XCIgLCBcIiMzMzY2NjZDOFwiXSxcclxuICAgIFtcIiMwMDk5NjZDOFwiICwgXCIjMDA5OTY2QzhcIl0sXHJcbiAgICBbXCIjMDA2Njk5QzhcIiAsIFwiIzAwNjY5OUM4XCJdLFxyXG4gICAgW1wiIzMyMzJDOEI0XCIgLCBcIiMzMjMyQzhCNFwiXSxcclxuXTtcclxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgTGlnaHQgTW9kZSwgRGFyayBNb2RlXHJcbnZhciBwYWRDb2xvcl9EZWZhdWx0ICAgICA9IFtcIiM4Nzg3ODdcIiwgXCIjODc4Nzg3XCJdICAgO1xyXG52YXIgcGFkQ29sb3JfUGluMSAgICAgICAgPSBbXCIjZmZiNjI5XCIsIFwiI2ZmYjYyOVwiXSAgIDtcclxudmFyIHBhZENvbG9yX0lzSGlnaGxpdGVkID0gW1wiI0QwNDA0MFwiLCBcIiNEMDQwNDBcIl0gICA7XHJcbnZhciBwYWRDb2xvcl9Jc1BsYWNlZCAgICA9IFtcIiM0MEQwNDBcIiwgXCIjNDBEMDQwXCJdO1xyXG5cclxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTGlnaHQgTW9kZSwgRGFyayBNb2RlXHJcbnZhciBib3VuZGluZ0JveENvbG9yX0RlZmF1bHQgICA9IFtcIiM4Nzg3ODdcIiwgXCIjODc4Nzg3XCJdO1xyXG52YXIgYm91bmRpbmdCb3hDb2xvcl9QbGFjZWQgICAgPSBbXCIjNDBEMDQwXCIsIFwiIzQwRDA0MFwiXTtcclxudmFyIGJvdW5kaW5nQm94Q29sb3JfSGlnaGxpdGVkID0gW1wiI0QwNDA0MFwiLCBcIiNEMDQwNDBcIl07XHJcbnZhciBib3VuZGluZ0JveENvbG9yX0RlYnVnICAgICA9IFtcIiMyOTc3ZmZcIiwgXCIjMjk3N2ZmXCJdO1xyXG5cclxuXHJcblxyXG52YXIgZHJpbGxDb2xvciAgICA9IFtcIiNDQ0NDQ0NcIiwgXCIjQ0NDQ0NDXCJdO1xyXG52YXIgdmlhQ29sb3IgICAgICA9IFtcIiMwMDAwMDBcIiwgXCIjMDAwMDAwXCJdO1xyXG5cclxuLy8gICAgICAgICAgICAgICAgIExpZ2h0IE1vZGUsIERhcmsgTW9kZVxyXG52YXIgcGNiRWRnZUNvbG9yID0gW1wiIzAwMDAwMEZGXCIsXCIjRkZGRkZGRkZcIl07XHJcblxyXG5cclxuLypcclxuICAgIEN1cnJlbnRseSAyIHN1cHBvcnRlZCBjb2xvciBwYWxldHRlLiBcclxuICAgIFBhbGV0dGUgMCBpcyBmb3IgbGlnaHQgbW9kZSwgYW5kIHBhbGV0dGUgMSBcclxuICAgIGlkIGZvciBkYXJrIG1vZGUuXHJcbiovXHJcbmZ1bmN0aW9uIEdldENvbG9yUGFsZXR0ZSgpXHJcbntcclxuICAgIHJldHVybiAoZ2xvYmFsRGF0YS5yZWFkU3RvcmFnZShcImRhcmttb2RlXCIpID09PSBcInRydWVcIikgPyAxIDogMDtcclxufVxyXG5cclxuZnVuY3Rpb24gR2V0VHJhY2VDb2xvcih0cmFjZUxheWVyKVxyXG57XHJcbiAgICByZXR1cm4gdHJhY2VDb2xvck1hcFt0cmFjZUxheWVyXVtHZXRDb2xvclBhbGV0dGUoKV07XHJcbn1cclxuXHJcblxyXG5cclxuZnVuY3Rpb24gR2V0Qm91bmRpbmdCb3hDb2xvcihpc0hpZ2hsaXRlZCwgaXNQbGFjZWQpXHJcbntcclxuICAgIGxldCByZXN1bHQgPSBib3VuZGluZ0JveENvbG9yX0RlZmF1bHQ7XHJcblxyXG4gICAgLy8gT3JkZXIgb2YgY29sb3Igc2VsZWN0aW9uLlxyXG4gICAgaWYgKGlzUGxhY2VkKSBcclxuICAgIHtcclxuICAgICAgICByZXN1bHQgICAgID0gYm91bmRpbmdCb3hDb2xvcl9QbGFjZWRbR2V0Q29sb3JQYWxldHRlKCldO1xyXG4gICAgfVxyXG4gICAgLy8gSGlnaGxpZ2h0ZWQgYW5kIG5vdCBwbGFjZWRcclxuICAgIGVsc2UgaWYoaXNIaWdobGl0ZWQpXHJcbiAgICB7XHJcbiAgICAgICAgcmVzdWx0ICAgICA9IGJvdW5kaW5nQm94Q29sb3JfSGlnaGxpdGVkW0dldENvbG9yUGFsZXR0ZSgpXTtcclxuICAgIH1cclxuICAgIC8qIFxyXG4gICAgICAgIElmIGRlYnVnIG1vZGUgaXMgZW5hYmxlZCB0aGVuIGZvcmNlIGRyYXdpbmcgYSBib3VuZGluZyBib3hcclxuICAgICAgbm90IGhpZ2hsaWdodGVkLCAgbm90IHBsYWNlZCwgYW5kIGRlYnVnIG1vZGUgYWN0aXZlXHJcbiAgICAqL1xyXG4gICAgZWxzZSBpZihnbG9iYWxEYXRhLmdldERlYnVnTW9kZSgpKVxyXG4gICAge1xyXG4gICAgICAgIHJlc3VsdCA9IGJvdW5kaW5nQm94Q29sb3JfRGVidWdbR2V0Q29sb3JQYWxldHRlKCldO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIHJlc3VsdCA9IGJvdW5kaW5nQm94Q29sb3JfRGVmYXVsdFtHZXRDb2xvclBhbGV0dGUoKV07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gR2V0UGFkQ29sb3IoaXNQaW4xLCBpc0hpZ2hsaXRlZCwgaXNQbGFjZWQpXHJcbntcclxuICAgIGxldCByZXN1bHQgPSBwYWRDb2xvcl9EZWZhdWx0O1xyXG5cclxuICAgIGlmKGlzUGluMSlcclxuICAgIHtcclxuICAgICAgICByZXN1bHQgPSBwYWRDb2xvcl9QaW4xW0dldENvbG9yUGFsZXR0ZSgpXTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYoaXNQbGFjZWQgJiYgaXNIaWdobGl0ZWQpXHJcbiAgICB7XHJcbiAgICAgICAgcmVzdWx0ID0gcGFkQ29sb3JfSXNQbGFjZWRbR2V0Q29sb3JQYWxldHRlKCldO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZihpc0hpZ2hsaXRlZClcclxuICAgIHtcclxuICAgICAgICByZXN1bHQgPSBwYWRDb2xvcl9Jc0hpZ2hsaXRlZFtHZXRDb2xvclBhbGV0dGUoKV07XHJcbiAgICB9XHJcbiAgICBlbHNlXHJcbiAgICB7XHJcbiAgICAgICAgcmVzdWx0ID0gcGFkQ29sb3JfRGVmYXVsdFtHZXRDb2xvclBhbGV0dGUoKV07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBHZXRQQ0JFZGdlQ29sb3IoKVxyXG57XHJcbiAgICByZXR1cm4gcGNiRWRnZUNvbG9yW0dldENvbG9yUGFsZXR0ZSgpXTtcclxufVxyXG5cclxuZnVuY3Rpb24gR2V0VmlhQ29sb3IoKVxyXG57XHJcbiAgICByZXR1cm4gdmlhQ29sb3JbR2V0Q29sb3JQYWxldHRlKCldO1xyXG59XHJcblxyXG5mdW5jdGlvbiBHZXREcmlsbENvbG9yKClcclxue1xyXG4gICAgcmV0dXJuIGRyaWxsQ29sb3JbR2V0Q29sb3JQYWxldHRlKCldO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIEdldFRyYWNlQ29sb3IsIEdldEJvdW5kaW5nQm94Q29sb3IsIEdldFBhZENvbG9yLCBHZXRQQ0JFZGdlQ29sb3IsXHJcbiAgICBHZXRWaWFDb2xvciwgR2V0RHJpbGxDb2xvclxyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgICAgICAgICAgQm9hcmQgUm90YXRpb24gICAgICAgICAgICAgICAgICAgIFxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgc3RvcmFnZSA9IHVuZGVmaW5lZDtcclxuY29uc3Qgc3RvcmFnZVByZWZpeCA9IFwiSU5URVJBQ1RJVkVfUENCX19cIiArIHBjYmRhdGEubWV0YWRhdGEudGl0bGUgKyBcIl9fXCIgKyBwY2JkYXRhLm1ldGFkYXRhLnJldmlzaW9uICsgXCJfX1wiXHJcblxyXG5mdW5jdGlvbiBpbml0U3RvcmFnZSAoKVxyXG57XHJcbiAgICB0cnlcclxuICAgIHtcclxuICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJibGFua1wiKTtcclxuICAgICAgICBzdG9yYWdlID0gd2luZG93LmxvY2FsU3RvcmFnZTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlKVxyXG4gICAge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiRVJST1I6IFN0b3JhZ2UgaW5pdCBlcnJvclwiKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXN0b3JhZ2UpXHJcbiAgICB7XHJcbiAgICAgICAgdHJ5XHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbShcImJsYW5rXCIpO1xyXG4gICAgICAgICAgICBzdG9yYWdlID0gd2luZG93LnNlc3Npb25TdG9yYWdlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYXRjaCAoZSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRVJST1I6IFNlc3Npb24gc3RvcmFnZSBub3QgYXZhaWxhYmxlXCIpO1xyXG4gICAgICAgICAgICAvLyBzZXNzaW9uU3RvcmFnZSBhbHNvIG5vdCBhdmFpbGFibGVcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRTdG9yYWdlKGtleSlcclxue1xyXG4gICAgaWYgKHN0b3JhZ2UpXHJcbiAgICB7XHJcbiAgICAgICAgcmV0dXJuIHN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlUHJlZml4ICsgXCIjXCIgKyBrZXkpO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZVN0b3JhZ2Uoa2V5LCB2YWx1ZSlcclxue1xyXG4gICAgaWYgKHN0b3JhZ2UpXHJcbiAgICB7XHJcbiAgICAgICAgc3RvcmFnZS5zZXRJdGVtKHN0b3JhZ2VQcmVmaXggKyBcIiNcIiArIGtleSwgdmFsdWUpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgICAgICAgICAgICBIaWdobGlnaHRlZCBSZWZzICAgICAgICAgICAgICAgICAgICBcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxubGV0IGhpZ2hsaWdodGVkUmVmcyA9IFtdO1xyXG5cclxuZnVuY3Rpb24gc2V0SGlnaGxpZ2h0ZWRSZWZzKHJlZnMpXHJcbntcclxuICAgIGhpZ2hsaWdodGVkUmVmcyA9IHJlZnMuc3BsaXQoXCIsXCIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRIaWdobGlnaHRlZFJlZnMoKVxyXG57XHJcbiAgICByZXR1cm4gaGlnaGxpZ2h0ZWRSZWZzO1xyXG59XHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgICAgICAgICAgIFJlZHJhdyBPbiBEcmFnICAgICAgICAgICAgICAgICAgICAgIFxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgcmVkcmF3T25EcmFnID0gdHJ1ZTtcclxuXHJcbmZ1bmN0aW9uIHNldFJlZHJhd09uRHJhZyh2YWx1ZSlcclxue1xyXG4gICAgcmVkcmF3T25EcmFnID0gdmFsdWU7XHJcbiAgICB3cml0ZVN0b3JhZ2UoXCJyZWRyYXdPbkRyYWdcIiwgdmFsdWUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRSZWRyYXdPbkRyYWcoKVxyXG57XHJcbiAgICByZXR1cm4gcmVkcmF3T25EcmFnO1xyXG59XHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgICAgICAgICAgICAgRGVidWcgTW9kZSAgICAgICAgICAgICAgICAgICAgICAgXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBkZWJ1Z01vZGUgPSBmYWxzZTtcclxuXHJcbmZ1bmN0aW9uIHNldERlYnVnTW9kZSh2YWx1ZSlcclxue1xyXG4gICAgZGVidWdNb2RlID0gdmFsdWU7XHJcbiAgICB3cml0ZVN0b3JhZ2UoXCJkZWJ1Z01vZGVcIiwgdmFsdWUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXREZWJ1Z01vZGUoKVxyXG57XHJcbiAgICByZXR1cm4gZGVidWdNb2RlO1xyXG59XHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxubGF5ZXIgU3BsaXRcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxubGV0IGxheWVyc3BsaXQ7XHJcblxyXG5mdW5jdGlvbiBzZXRMYXllclNwbGl0KHZhbHVlKVxyXG57XHJcbiAgICBsYXllcnNwbGl0ID0gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExheWVyU3BsaXQoKVxyXG57XHJcbiAgICByZXR1cm4gbGF5ZXJzcGxpdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVzdHJveUxheWVyU3BsaXQoKVxyXG57XHJcbiAgICBsYXllcnNwbGl0LmRlc3Ryb3koKTtcclxufVxyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQk9NIFNwbGl0XHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBib21zcGxpdDtcclxuXHJcbmZ1bmN0aW9uIHNldEJvbVNwbGl0KHZhbHVlKVxyXG57XHJcbiAgICBib21zcGxpdCA9IHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRCb21TcGxpdCgpXHJcbntcclxuICAgIHJldHVybiBib21zcGxpdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVzdHJveUJvbVNwbGl0KClcclxue1xyXG4gICAgYm9tc3BsaXQuZGVzdHJveSgpO1xyXG59XHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ2FudmFzIFNwbGl0XHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBjYW52YXNzcGxpdDtcclxuXHJcbmZ1bmN0aW9uIHNldENhbnZhc1NwbGl0KHZhbHVlKVxyXG57XHJcbiAgICBjYW52YXNzcGxpdCA9IHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDYW52YXNTcGxpdCgpXHJcbntcclxuICAgIHJldHVybiBjYW52YXNzcGxpdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVzdHJveUNhbnZhc1NwbGl0KClcclxue1xyXG4gICAgY2FudmFzc3BsaXQuZGVzdHJveSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjb2xsYXBzZUNhbnZhc1NwbGl0KHZhbHVlKVxyXG57XHJcbiAgICBjYW52YXNzcGxpdC5jb2xsYXBzZSh2YWx1ZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldFNpemVzQ2FudmFzU3BsaXQoKVxyXG57XHJcbiAgICBjYW52YXNzcGxpdC5zZXRTaXplcyhbNTAsIDUwXSk7XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5DYW52YXMgTGF5b3V0XHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBjYW52YXNsYXlvdXQgPSBcIkZCXCI7XHJcblxyXG4vKlhYWCBGb3VuZCBhIGJ1ZyBhdCBzdGFydHVwLiBDb2RlIGFzc3VtZXMgdGhhdCBjYW52YXMgbGF5b3V0IFxyXG5pcyBpbiBvbmUgb2YgdGhyZWUgc3RhdGVzLiB0aGVuIHN5c3RlbSBmYWlscy4gaGUgYnVnIHdhcyB0aGF0IHRoZSBcclxuY2FudmFzTGF5b3V0IHdhcyBiZWluZyBzZXQgdG8gJ2RlZmF1bHQnIHdoaWNoIGlzIG5vdCBhIHZhbGlkIHN0YXRlLiBcclxuU28gbm8gaXMgY2hlY2sgdGhhdCBpZiBkZWZhdWx0IGlzIHNlbnQgaW4gdGhlbiBzZXQgdGhlIGxheW91dCB0byBGQiBtb2RlLlxyXG4qL1xyXG4vKiBUT0RPOiBNYWtlIHRoZSBkZWZhdWx0IGNoZWNrIGJlbG93IGFjdHVhbGx5IGNoZWNrIHRoYXQgdGhlIGl0ZW0gXHJcbmlzIGluIG9uZSBvZiB0aGUgdGhyZWUgdmFsaWQgc3RhdGVzLiBJZiBub3QgdGhlbiBzZXQgdG8gRkIsIG90aGVyd2lzZSBzZXQgdG8gb25lIG9mXHJcbnRoZSB0aHJlZSB2YWxpZCBzdGF0ZXNcclxuKi9cclxuZnVuY3Rpb24gc2V0Q2FudmFzTGF5b3V0KHZhbHVlKVxyXG57XHJcbiAgICBpZih2YWx1ZSA9PSBcImRlZmF1bHRcIilcclxuICAgIHtcclxuICAgICAgICBjYW52YXNsYXlvdXQgPSBcIkZCXCI7XHJcbiAgICB9XHJcbiAgICBlbHNlXHJcbiAgICB7XHJcbiAgICAgICAgY2FudmFzbGF5b3V0ID0gdmFsdWU7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENhbnZhc0xheW91dCgpXHJcbntcclxuICAgIHJldHVybiBjYW52YXNsYXlvdXQ7XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5CT00gTGF5b3V0XHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBib21sYXlvdXQgPSBcImRlZmF1bHRcIjtcclxuXHJcbmZ1bmN0aW9uIHNldEJvbUxheW91dCh2YWx1ZSlcclxue1xyXG4gICAgYm9tbGF5b3V0ID0gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEJvbUxheW91dCgpXHJcbntcclxuICAgIHJldHVybiBib21sYXlvdXQ7XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5CT00gU29ydCBGdW5jdGlvblxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgYm9tU29ydEZ1bmN0aW9uID0gbnVsbDtcclxuXHJcbmZ1bmN0aW9uIHNldEJvbVNvcnRGdW5jdGlvbih2YWx1ZSlcclxue1xyXG4gICAgYm9tU29ydEZ1bmN0aW9uID0gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEJvbVNvcnRGdW5jdGlvbigpXHJcbntcclxuICAgIHJldHVybiBib21Tb3J0RnVuY3Rpb247XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5DdXJyZW50IFNvcnQgQ29sdW1uXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBjdXJyZW50U29ydENvbHVtbiA9IG51bGw7XHJcblxyXG5mdW5jdGlvbiBzZXRDdXJyZW50U29ydENvbHVtbih2YWx1ZSlcclxue1xyXG4gICAgY3VycmVudFNvcnRDb2x1bW4gPSB2YWx1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0Q3VycmVudFNvcnRDb2x1bW4oKVxyXG57XHJcbiAgICByZXR1cm4gY3VycmVudFNvcnRDb2x1bW47XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5DdXJyZW50IFNvcnQgT3JkZXJcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxubGV0IGN1cnJlbnRTb3J0T3JkZXIgPSBudWxsO1xyXG5cclxuZnVuY3Rpb24gc2V0Q3VycmVudFNvcnRPcmRlcih2YWx1ZSlcclxue1xyXG4gICAgY3VycmVudFNvcnRPcmRlciA9IHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDdXJyZW50U29ydE9yZGVyKClcclxue1xyXG4gICAgcmV0dXJuIGN1cnJlbnRTb3J0T3JkZXI7XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5DdXJyZW50IEhpZ2hsaWdodGVkIFJvdyBJRFxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgY3VycmVudEhpZ2hsaWdodGVkUm93SWQ7XHJcblxyXG5mdW5jdGlvbiBzZXRDdXJyZW50SGlnaGxpZ2h0ZWRSb3dJZCh2YWx1ZSlcclxue1xyXG4gICAgY3VycmVudEhpZ2hsaWdodGVkUm93SWQgPSB2YWx1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKVxyXG57XHJcbiAgICByZXR1cm4gY3VycmVudEhpZ2hsaWdodGVkUm93SWQ7XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5IaWdobGlnaHQgSGFuZGxlcnNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxubGV0IGhpZ2hsaWdodEhhbmRsZXJzID0gW107XHJcblxyXG5mdW5jdGlvbiBzZXRIaWdobGlnaHRIYW5kbGVycyh2YWx1ZXMpXHJcbntcclxuICAgIGhpZ2hsaWdodEhhbmRsZXJzID0gdmFsdWVzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRIaWdobGlnaHRIYW5kbGVycygpe1xyXG4gICAgcmV0dXJuIGhpZ2hsaWdodEhhbmRsZXJzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwdXNoSGlnaGxpZ2h0SGFuZGxlcnModmFsdWUpXHJcbntcclxuICAgIGhpZ2hsaWdodEhhbmRsZXJzLnB1c2godmFsdWUpO1xyXG59XHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ2hlY2tib3hlc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgY2hlY2tib3hlcyA9IFtdO1xyXG5cclxuZnVuY3Rpb24gc2V0Q2hlY2tib3hlcyh2YWx1ZXMpXHJcbntcclxuICAgIGNoZWNrYm94ZXMgPSB2YWx1ZXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENoZWNrYm94ZXMoKVxyXG57XHJcbiAgICByZXR1cm4gY2hlY2tib3hlcztcclxufVxyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkJPTSBDaGVja2JveGVzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBib21DaGVja2JveGVzID0gXCJcIjtcclxuXHJcbmZ1bmN0aW9uIHNldEJvbUNoZWNrYm94ZXModmFsdWVzKVxyXG57XHJcbiAgICBib21DaGVja2JveGVzID0gdmFsdWVzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRCb21DaGVja2JveGVzKClcclxue1xyXG4gICAgcmV0dXJuIGJvbUNoZWNrYm94ZXM7XHJcbn1cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcblJlbW92ZSBCT00gRW50cmllc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgcmVtb3ZlQk9NRW50cmllcyA9IFwiXCI7XHJcblxyXG5mdW5jdGlvbiBzZXRSZW1vdmVCT01FbnRyaWVzKHZhbHVlcylcclxue1xyXG4gICAgcmVtb3ZlQk9NRW50cmllcyA9IHZhbHVlcztcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UmVtb3ZlQk9NRW50cmllcygpXHJcbntcclxuICAgIHJldHVybiByZW1vdmVCT01FbnRyaWVzO1xyXG59XHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuUmVtb3ZlIEJPTSBFbnRyaWVzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBhZGRpdGlvbmFsQXR0cmlidXRlcyA9IFwiXCI7XHJcblxyXG5mdW5jdGlvbiBzZXRBZGRpdGlvbmFsQXR0cmlidXRlcyh2YWx1ZXMpXHJcbntcclxuICAgIGFkZGl0aW9uYWxBdHRyaWJ1dGVzID0gdmFsdWVzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRBZGRpdGlvbmFsQXR0cmlidXRlcygpe1xyXG4gICAgcmV0dXJuIGFkZGl0aW9uYWxBdHRyaWJ1dGVzO1xyXG59XHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuSGlnaGxpZ2h0IFBpbiAxXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBoaWdobGlnaHRwaW4xID0gZmFsc2U7XHJcblxyXG5mdW5jdGlvbiBzZXRIaWdobGlnaHRQaW4xKHZhbHVlKVxyXG57XHJcbiAgICB3cml0ZVN0b3JhZ2UoXCJoaWdobGlnaHRwaW4xXCIsIHZhbHVlKTtcclxuICAgIGhpZ2hsaWdodHBpbjEgPSB2YWx1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0SGlnaGxpZ2h0UGluMSgpe1xyXG4gICAgcmV0dXJuIGhpZ2hsaWdodHBpbjE7XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5MYXN0IENsaWNrZWQgUmVmXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbmxldCBsYXN0Q2xpY2tlZFJlZjtcclxuXHJcbmZ1bmN0aW9uIHNldExhc3RDbGlja2VkUmVmKHZhbHVlKVxyXG57XHJcbiAgICBsYXN0Q2xpY2tlZFJlZiA9IHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRMYXN0Q2xpY2tlZFJlZigpXHJcbntcclxuICAgIHJldHVybiBsYXN0Q2xpY2tlZFJlZjtcclxufVxyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db21iaW5lIFZhbHVlc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgY29tYmluZVZhbHVlcyA9IGZhbHNlO1xyXG5cclxuZnVuY3Rpb24gc2V0Q29tYmluZVZhbHVlcyh2YWx1ZSlcclxue1xyXG4gICAgd3JpdGVTdG9yYWdlKFwiY29tYmluZVZhbHVlc1wiLCB2YWx1ZSk7XHJcbiAgICBjb21iaW5lVmFsdWVzID0gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENvbWJpbmVWYWx1ZXMoKVxyXG57XHJcbiAgICByZXR1cm4gY29tYmluZVZhbHVlcztcclxufVxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxuXHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db21iaW5lIFZhbHVlc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgaGlkZVBsYWNlZFBhcnRzID0gZmFsc2U7XHJcblxyXG5mdW5jdGlvbiBzZXRIaWRlUGxhY2VkUGFydHModmFsdWUpXHJcbntcclxuICAgIHdyaXRlU3RvcmFnZShcImhpZGVQbGFjZWRQYXJ0c1wiLCB2YWx1ZSk7XHJcbiAgICBoaWRlUGxhY2VkUGFydHMgPSB2YWx1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0SGlkZVBsYWNlZFBhcnRzKClcclxue1xyXG4gICAgcmV0dXJuIGhpZGVQbGFjZWRQYXJ0cztcclxufVxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5cclxubGV0IGFsbGNhbnZhcyA9ICB1bmRlZmluZWQ7XHJcblxyXG5mdW5jdGlvbiBTZXRBbGxDYW52YXModmFsdWUpXHJcbntcclxuICAgIGFsbGNhbnZhcyA9IHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBHZXRBbGxDYW52YXMoKVxyXG57XHJcbiAgICByZXR1cm4gYWxsY2FudmFzO1xyXG59XHJcblxyXG5cclxubGV0IGJvYXJkUm90YXRpb24gPSAwO1xyXG5mdW5jdGlvbiBTZXRCb2FyZFJvdGF0aW9uKHZhbHVlKVxyXG57XHJcbiAgICBib2FyZFJvdGF0aW9uID0gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIEdldEJvYXJkUm90YXRpb24oKVxyXG57XHJcbiAgICByZXR1cm4gYm9hcmRSb3RhdGlvbjtcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgaW5pdFN0b3JhZ2UgICAgICAgICAgICAgICAgLCByZWFkU3RvcmFnZSAgICAgICAgICAgICAgICAsIHdyaXRlU3RvcmFnZSAgICAgICAgICAsXHJcbiAgICBzZXRIaWdobGlnaHRlZFJlZnMgICAgICAgICAsIGdldEhpZ2hsaWdodGVkUmVmcyAgICAgICAgICxcclxuICAgIHNldFJlZHJhd09uRHJhZyAgICAgICAgICAgICwgZ2V0UmVkcmF3T25EcmFnICAgICAgICAgICAgLFxyXG4gICAgc2V0RGVidWdNb2RlICAgICAgICAgICAgICAgLCBnZXREZWJ1Z01vZGUgICAgICAgICAgICAgICAsXHJcbiAgICBzZXRCb21TcGxpdCAgICAgICAgICAgICAgICAsIGdldEJvbVNwbGl0ICAgICAgICAgICAgICAgICwgZGVzdHJveUJvbVNwbGl0ICAgICAgICxcclxuICAgIHNldExheWVyU3BsaXQgICAgICAgICAgICAgICwgZ2V0TGF5ZXJTcGxpdCAgICAgICAgICAgICAgLCBkZXN0cm95TGF5ZXJTcGxpdCAgICAgLFxyXG4gICAgc2V0Q2FudmFzU3BsaXQgICAgICAgICAgICAgLCBnZXRDYW52YXNTcGxpdCAgICAgICAgICAgICAsIGRlc3Ryb3lDYW52YXNTcGxpdCAgICAsIGNvbGxhcHNlQ2FudmFzU3BsaXQgLCBzZXRTaXplc0NhbnZhc1NwbGl0ICxcclxuICAgIHNldENhbnZhc0xheW91dCAgICAgICAgICAgICwgZ2V0Q2FudmFzTGF5b3V0ICAgICAgICAgICAgLFxyXG4gICAgc2V0Qm9tTGF5b3V0ICAgICAgICAgICAgICAgLCBnZXRCb21MYXlvdXQgICAgICAgICAgICAgICAsXHJcbiAgICBzZXRCb21Tb3J0RnVuY3Rpb24gICAgICAgICAsIGdldEJvbVNvcnRGdW5jdGlvbiAgICAgICAgICxcclxuICAgIHNldEN1cnJlbnRTb3J0Q29sdW1uICAgICAgICwgZ2V0Q3VycmVudFNvcnRDb2x1bW4gICAgICAgLFxyXG4gICAgc2V0Q3VycmVudFNvcnRPcmRlciAgICAgICAgLCBnZXRDdXJyZW50U29ydE9yZGVyICAgICAgICAsXHJcbiAgICBzZXRDdXJyZW50SGlnaGxpZ2h0ZWRSb3dJZCAsIGdldEN1cnJlbnRIaWdobGlnaHRlZFJvd0lkICxcclxuICAgIHNldEhpZ2hsaWdodEhhbmRsZXJzICAgICAgICwgZ2V0SGlnaGxpZ2h0SGFuZGxlcnMgICAgICAgLCBwdXNoSGlnaGxpZ2h0SGFuZGxlcnMgLFxyXG4gICAgc2V0Q2hlY2tib3hlcyAgICAgICAgICAgICAgLCBnZXRDaGVja2JveGVzICAgICAgICAgICAgICAsXHJcbiAgICBzZXRCb21DaGVja2JveGVzICAgICAgICAgICAsIGdldEJvbUNoZWNrYm94ZXMgICAgICAgICAgICxcclxuICAgIHNldFJlbW92ZUJPTUVudHJpZXMgICAgICAgICwgZ2V0UmVtb3ZlQk9NRW50cmllcyAgICAgICAgLFxyXG4gICAgc2V0QWRkaXRpb25hbEF0dHJpYnV0ZXMgICAgLCBnZXRBZGRpdGlvbmFsQXR0cmlidXRlcyAgICAsXHJcbiAgICBzZXRIaWdobGlnaHRQaW4xICAgICAgICAgICAsIGdldEhpZ2hsaWdodFBpbjEgICAgICAgICAgICxcclxuICAgIHNldExhc3RDbGlja2VkUmVmICAgICAgICAgICwgZ2V0TGFzdENsaWNrZWRSZWYgICAgICAgICAgLFxyXG4gICAgc2V0Q29tYmluZVZhbHVlcyAgICAgICAgICAgLCBnZXRDb21iaW5lVmFsdWVzICAgICAgICAgICAsXHJcbiAgICBzZXRIaWRlUGxhY2VkUGFydHMgICAgICAgICAsIGdldEhpZGVQbGFjZWRQYXJ0cyAgICAgICAgICxcclxuICAgIFNldEFsbENhbnZhcyAgICAgICAgICAgICAgICwgR2V0QWxsQ2FudmFzICAgICAgICAgICAgICAgLFxyXG4gICAgU2V0Qm9hcmRSb3RhdGlvbiAgICAgICAgICAgLCBHZXRCb2FyZFJvdGF0aW9uXHJcblxyXG59OyIsInZhciBnbG9iYWxEYXRhID0gcmVxdWlyZShcIi4vZ2xvYmFsLmpzXCIpO1xyXG52YXIgcmVuZGVyICAgICA9IHJlcXVpcmUoXCIuL3JlbmRlci5qc1wiKTtcclxuXHJcbmZ1bmN0aW9uIGhhbmRsZU1vdXNlRG93bihlLCBsYXllcmRpY3QpIFxyXG57XHJcbiAgICBpZiAoZS53aGljaCAhPSAxKSBcclxuICAgIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBcclxuICAgIGxheWVyZGljdC50cmFuc2Zvcm0ubW91c2VzdGFydHggPSBlLm9mZnNldFg7XHJcbiAgICBsYXllcmRpY3QudHJhbnNmb3JtLm1vdXNlc3RhcnR5ID0gZS5vZmZzZXRZO1xyXG4gICAgbGF5ZXJkaWN0LnRyYW5zZm9ybS5tb3VzZWRvd254ID0gZS5vZmZzZXRYO1xyXG4gICAgbGF5ZXJkaWN0LnRyYW5zZm9ybS5tb3VzZWRvd255ID0gZS5vZmZzZXRZO1xyXG4gICAgbGF5ZXJkaWN0LnRyYW5zZm9ybS5tb3VzZWRvd24gPSB0cnVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzbW9vdGhTY3JvbGxUb1Jvdyhyb3dpZCkgXHJcbntcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJvd2lkKS5zY3JvbGxJbnRvVmlldyh7XHJcbiAgICAgICAgYmVoYXZpb3I6IFwic21vb3RoXCIsXHJcbiAgICAgICAgYmxvY2s6IFwiY2VudGVyXCIsXHJcbiAgICAgICAgaW5saW5lOiBcIm5lYXJlc3RcIlxyXG4gICAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vZHVsZXNDbGlja2VkKHJlZmVyZW5jZXMpIFxyXG57XHJcbiAgICBsZXQgbGFzdENsaWNrZWRJbmRleCA9IHJlZmVyZW5jZXMuaW5kZXhPZihnbG9iYWxEYXRhLmdldExhc3RDbGlja2VkUmVmKCkpO1xyXG4gICAgbGV0IHJlZiA9IHJlZmVyZW5jZXNbKGxhc3RDbGlja2VkSW5kZXggKyAxKSAlIHJlZmVyZW5jZXMubGVuZ3RoXTtcclxuICAgIGZvciAobGV0IGhhbmRsZXIgb2YgZ2xvYmFsRGF0YS5nZXRIaWdobGlnaHRIYW5kbGVycygpKSBcclxuICAgIHtcclxuICAgICAgICBpZiAoaGFuZGxlci5yZWZzLmluZGV4T2YocmVmKSA+PSAwKSBcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuc2V0TGFzdENsaWNrZWRSZWYocmVmKTtcclxuICAgICAgICAgICAgaGFuZGxlci5oYW5kbGVyKCk7XHJcbiAgICAgICAgICAgIHNtb290aFNjcm9sbFRvUm93KGdsb2JhbERhdGEuZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiBiYm94U2NhbihsYXllciwgeCwgeSkgXHJcbntcclxuICAgIGxldCByZXN1bHQgPSBbXTtcclxuICAgIGZvciAobGV0IHBhcnQgb2YgcGNiZGF0YS5wYXJ0cykgXHJcbiAgICB7XHJcbiAgICAgICAgaWYoIHBhcnQubG9jYXRpb24gPT0gbGF5ZXIpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBsZXQgYiA9IHBhcnQucGFja2FnZS5ib3VuZGluZ19ib3g7XHJcbiAgICAgICAgICAgIGlmICggICAgKHggPiBiLngwIClcclxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHggPCBiLngxIClcclxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHkgPiBiLnkwIClcclxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHkgPCBiLnkxIClcclxuICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChwYXJ0Lm5hbWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZU1vdXNlQ2xpY2soZSwgbGF5ZXJkaWN0KSBcclxue1xyXG4gICAgbGV0IHggPSBlLm9mZnNldFg7XHJcbiAgICBsZXQgeSA9IGUub2Zmc2V0WTtcclxuICAgIGxldCB0ID0gbGF5ZXJkaWN0LnRyYW5zZm9ybTtcclxuICAgIGlmIChsYXllcmRpY3QubGF5ZXIgIT0gXCJCXCIpIFxyXG4gICAge1xyXG4gICAgICAgIHggPSAoMiAqIHggLyB0Lnpvb20gLSB0LnBhbnggKyB0LngpIC8gLXQucztcclxuICAgIH0gXHJcbiAgICBlbHNlIFxyXG4gICAge1xyXG4gICAgICAgIHggPSAoMiAqIHggLyB0Lnpvb20gLSB0LnBhbnggLSB0LngpIC8gdC5zO1xyXG4gICAgfVxyXG4gICAgeSA9ICgyICogeSAvIHQuem9vbSAtIHQueSAtIHQucGFueSkgLyB0LnM7XHJcbiAgICBsZXQgdiA9IHJlbmRlci5Sb3RhdGVWZWN0b3IoW3gsIHldLCAtZ2xvYmFsRGF0YS5HZXRCb2FyZFJvdGF0aW9uKCkpO1xyXG4gICAgbGV0IHJlZmxpc3QgPSBiYm94U2NhbihsYXllcmRpY3QubGF5ZXIsIHZbMF0sIHZbMV0sIHQpO1xyXG4gICAgaWYgKHJlZmxpc3QubGVuZ3RoID4gMCkgXHJcbiAgICB7XHJcbiAgICAgICAgbW9kdWxlc0NsaWNrZWQocmVmbGlzdCk7XHJcbiAgICAgICAgcmVuZGVyLmRyYXdIaWdobGlnaHRzKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZU1vdXNlVXAoZSwgbGF5ZXJkaWN0KSBcclxue1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGlmICggICAgZS53aGljaCA9PSAxXHJcbiAgICAgICAgICYmIGxheWVyZGljdC50cmFuc2Zvcm0ubW91c2Vkb3duXHJcbiAgICAgICAgICYmIGxheWVyZGljdC50cmFuc2Zvcm0ubW91c2Vkb3dueCA9PSBlLm9mZnNldFhcclxuICAgICAgICAgJiYgbGF5ZXJkaWN0LnRyYW5zZm9ybS5tb3VzZWRvd255ID09IGUub2Zmc2V0WVxyXG4gICAgKSBcclxuICAgIHtcclxuICAgICAgICAvLyBUaGlzIGlzIGp1c3QgYSBjbGlja1xyXG4gICAgICAgIGhhbmRsZU1vdXNlQ2xpY2soZSwgbGF5ZXJkaWN0KTtcclxuICAgICAgICBsYXllcmRpY3QudHJhbnNmb3JtLm1vdXNlZG93biA9IGZhbHNlO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChlLndoaWNoID09IDMpIFxyXG4gICAge1xyXG4gICAgICAgIC8vIFJlc2V0IHBhbiBhbmQgem9vbSBvbiByaWdodCBjbGljay5cclxuICAgICAgICBsYXllcmRpY3QudHJhbnNmb3JtLnBhbnggPSAwO1xyXG4gICAgICAgIGxheWVyZGljdC50cmFuc2Zvcm0ucGFueSA9IDA7XHJcbiAgICAgICAgbGF5ZXJkaWN0LnRyYW5zZm9ybS56b29tID0gMTtcclxuICAgICAgICByZW5kZXIuZHJhd0NhbnZhcyhsYXllcmRpY3QpO1xyXG4gICAgfSBcclxuICAgIGVsc2UgaWYgKCFnbG9iYWxEYXRhLmdldFJlZHJhd09uRHJhZygpKSBcclxuICAgIHtcclxuICAgICAgICByZW5kZXIuZHJhd0NhbnZhcyhsYXllcmRpY3QpO1xyXG4gICAgfVxyXG4gICAgbGF5ZXJkaWN0LnRyYW5zZm9ybS5tb3VzZWRvd24gPSBmYWxzZTtcclxufVxyXG5cclxuZnVuY3Rpb24gaGFuZGxlTW91c2VNb3ZlKGUsIGxheWVyZGljdCkgXHJcbntcclxuICAgIGlmICghbGF5ZXJkaWN0LnRyYW5zZm9ybS5tb3VzZWRvd24pIFxyXG4gICAge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICBsZXQgZHggPSBlLm9mZnNldFggLSBsYXllcmRpY3QudHJhbnNmb3JtLm1vdXNlc3RhcnR4O1xyXG4gICAgbGV0IGR5ID0gZS5vZmZzZXRZIC0gbGF5ZXJkaWN0LnRyYW5zZm9ybS5tb3VzZXN0YXJ0eTtcclxuICAgIGxheWVyZGljdC50cmFuc2Zvcm0ucGFueCArPSAyICogZHggLyBsYXllcmRpY3QudHJhbnNmb3JtLnpvb207XHJcbiAgICBsYXllcmRpY3QudHJhbnNmb3JtLnBhbnkgKz0gMiAqIGR5IC8gbGF5ZXJkaWN0LnRyYW5zZm9ybS56b29tO1xyXG4gICAgbGF5ZXJkaWN0LnRyYW5zZm9ybS5tb3VzZXN0YXJ0eCA9IGUub2Zmc2V0WDtcclxuICAgIGxheWVyZGljdC50cmFuc2Zvcm0ubW91c2VzdGFydHkgPSBlLm9mZnNldFk7XHJcbiAgICBcclxuICAgIGlmIChnbG9iYWxEYXRhLmdldFJlZHJhd09uRHJhZygpKSBcclxuICAgIHtcclxuICAgICAgICByZW5kZXIuZHJhd0NhbnZhcyhsYXllcmRpY3QpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBoYW5kbGVNb3VzZVdoZWVsKGUsIGxheWVyZGljdCkgXHJcbntcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB2YXIgdCA9IGxheWVyZGljdC50cmFuc2Zvcm07XHJcbiAgICB2YXIgd2hlZWxkZWx0YSA9IGUuZGVsdGFZO1xyXG4gICAgaWYgKGUuZGVsdGFNb2RlID09IDEpIFxyXG4gICAge1xyXG4gICAgICAgIC8vIEZGIG9ubHksIHNjcm9sbCBieSBsaW5lc1xyXG4gICAgICAgIHdoZWVsZGVsdGEgKj0gMzA7XHJcbiAgICB9IFxyXG4gICAgZWxzZSBpZiAoZS5kZWx0YU1vZGUgPT0gMikgXHJcbiAgICB7XHJcbiAgICAgICAgd2hlZWxkZWx0YSAqPSAzMDA7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBtID0gTWF0aC5wb3coMS4xLCAtd2hlZWxkZWx0YSAvIDQwKTtcclxuICAgIC8vIExpbWl0IGFtb3VudCBvZiB6b29tIHBlciB0aWNrLlxyXG4gICAgaWYgKG0gPiAyKSBcclxuICAgIHtcclxuICAgICAgICBtID0gMjtcclxuICAgIH0gXHJcbiAgICBlbHNlIGlmIChtIDwgMC41KSBcclxuICAgIHtcclxuICAgICAgICBtID0gMC41O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0Lnpvb20gKj0gbTtcclxuICAgIHZhciB6b29tZCA9ICgxIC0gbSkgLyB0Lnpvb207XHJcbiAgICB0LnBhbnggKz0gMiAqIGUub2Zmc2V0WCAqIHpvb21kO1xyXG4gICAgdC5wYW55ICs9IDIgKiBlLm9mZnNldFkgKiB6b29tZDtcclxuICAgIHJlbmRlci5kcmF3Q2FudmFzKGxheWVyZGljdCk7XHJcbiAgICByZW5kZXIuZHJhd0hpZ2hsaWdodHMoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gYWRkTW91c2VIYW5kbGVycyhkaXYsIGxheWVyZGljdCkgXHJcbntcclxuICAgIGRpdi5vbm1vdXNlY2xpY2sgPSBmdW5jdGlvbihlKVxyXG4gICAge1xyXG4gICAgICAgIGhhbmRsZU1vdXNlQ2xpY2soZSwgbGF5ZXJkaWN0KTtcclxuICAgIH07XHJcblxyXG4gICAgZGl2Lm9ubW91c2Vkb3duID0gZnVuY3Rpb24oZSkgXHJcbiAgICB7XHJcbiAgICAgICAgaGFuZGxlTW91c2VEb3duKGUsIGxheWVyZGljdCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBkaXYub25tb3VzZW1vdmUgPSBmdW5jdGlvbihlKSBcclxuICAgIHtcclxuICAgICAgICBoYW5kbGVNb3VzZU1vdmUoZSwgbGF5ZXJkaWN0KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGRpdi5vbm1vdXNldXAgPSBmdW5jdGlvbihlKSBcclxuICAgIHtcclxuICAgICAgICBoYW5kbGVNb3VzZVVwKGUsIGxheWVyZGljdCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBkaXYub25tb3VzZW91dCA9IGZ1bmN0aW9uKGUpIFxyXG4gICAge1xyXG4gICAgICAgIGhhbmRsZU1vdXNlVXAoZSwgbGF5ZXJkaWN0KTtcclxuICAgIH07XHJcblxyXG4gICAgZGl2Lm9ud2hlZWwgPSBmdW5jdGlvbihlKSBcclxuICAgIHtcclxuICAgICAgICBoYW5kbGVNb3VzZVdoZWVsKGUsIGxheWVyZGljdCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBcclxuICAgIGZvciAodmFyIGVsZW1lbnQgb2YgW2Rpdl0pIFxyXG4gICAge1xyXG4gICAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNvbnRleHRtZW51XCIsIGZ1bmN0aW9uKGUpIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIH0sIGZhbHNlKTtcclxuICAgIH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBhZGRNb3VzZUhhbmRsZXJzXHJcbn07XHJcbiIsInZhciBnbG9iYWxEYXRhID0gcmVxdWlyZShcIi4vZ2xvYmFsLmpzXCIpO1xyXG52YXIgcmVuZGVyICAgICA9IHJlcXVpcmUoXCIuL3JlbmRlci5qc1wiKTtcclxudmFyIGlib20gICAgICAgPSByZXF1aXJlKFwiLi9pYm9tLmpzXCIpO1xyXG5cclxuY29uc3QgYm9hcmRSb3RhdGlvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9hcmRSb3RhdGlvblwiKTtcclxuYm9hcmRSb3RhdGlvbi5vbmlucHV0PWZ1bmN0aW9uKClcclxue1xyXG4gICAgcmVuZGVyLlNldEJvYXJkUm90YXRpb24oYm9hcmRSb3RhdGlvbi52YWx1ZSk7XHJcbn07XHJcblxyXG5jb25zdCBkYXJrTW9kZUJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZGFya21vZGVDaGVja2JveFwiKTtcclxuZGFya01vZGVCb3gub25jaGFuZ2UgPSBmdW5jdGlvbiAoKSBcclxue1xyXG4gICAgaWJvbS5zZXREYXJrTW9kZShkYXJrTW9kZUJveC5jaGVja2VkKTtcclxufTtcclxuXHJcbmNvbnN0IHNpbGtzY3JlZW5DaGVja2JveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2lsa3NjcmVlbkNoZWNrYm94XCIpO1xyXG5zaWxrc2NyZWVuQ2hlY2tib3guY2hlY2tlZD1mdW5jdGlvbigpXHJcbntcclxuICAgIGlib20uc2lsa3NjcmVlblZpc2libGUoc2lsa3NjcmVlbkNoZWNrYm94LmNoZWNrZWQpO1xyXG59O1xyXG5cclxuc2lsa3NjcmVlbkNoZWNrYm94Lm9uY2hhbmdlPWZ1bmN0aW9uKClcclxue1xyXG4gICAgaWJvbS5zaWxrc2NyZWVuVmlzaWJsZShzaWxrc2NyZWVuQ2hlY2tib3guY2hlY2tlZCk7XHJcbn07XHJcblxyXG5jb25zdCBoaWdobGlnaHRwaW4xQ2hlY2tib3ggPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaGlnaGxpZ2h0cGluMUNoZWNrYm94XCIpO1xyXG5oaWdobGlnaHRwaW4xQ2hlY2tib3gub25jaGFuZ2U9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBnbG9iYWxEYXRhLnNldEhpZ2hsaWdodFBpbjEoaGlnaGxpZ2h0cGluMUNoZWNrYm94LmNoZWNrZWQpO1xyXG4gICAgcmVuZGVyLmRyYXdDYW52YXMoYWxsY2FudmFzLmZyb250KTtcclxuICAgIHJlbmRlci5kcmF3Q2FudmFzKGFsbGNhbnZhcy5iYWNrKTtcclxufTtcclxuXHJcbmNvbnN0IGRyYWdDaGVja2JveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZHJhZ0NoZWNrYm94XCIpO1xyXG5kcmFnQ2hlY2tib3guY2hlY2tlZD1mdW5jdGlvbigpXHJcbntcclxuICAgIGdsb2JhbERhdGEuc2V0UmVkcmF3T25EcmFnKGRyYWdDaGVja2JveC5jaGVja2VkKTtcclxufTtcclxuZHJhZ0NoZWNrYm94Lm9uY2hhbmdlPWZ1bmN0aW9uKClcclxue1xyXG4gICAgZ2xvYmFsRGF0YS5zZXRSZWRyYXdPbkRyYWcoZHJhZ0NoZWNrYm94LmNoZWNrZWQpO1xyXG59O1xyXG5cclxuXHJcbmNvbnN0IGNvbWJpbmVWYWx1ZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNvbWJpbmVWYWx1ZXNcIik7XHJcbmNvbWJpbmVWYWx1ZXMub25jaGFuZ2U9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBnbG9iYWxEYXRhLnNldENvbWJpbmVWYWx1ZXMoY29tYmluZVZhbHVlcy5jaGVja2VkKTtcclxuICAgIGlib20ucG9wdWxhdGVCb21UYWJsZSgpO1xyXG59O1xyXG5cclxuXHJcbmNvbnN0IGhpZGVQbGFjZWRQYXJ0cyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaGlkZVBsYWNlZFBhcnRzXCIpO1xyXG5oaWRlUGxhY2VkUGFydHMub25jaGFuZ2U9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBnbG9iYWxEYXRhLnNldEhpZGVQbGFjZWRQYXJ0cyhoaWRlUGxhY2VkUGFydHMuY2hlY2tlZCk7XHJcbiAgICBpYm9tLnBvcHVsYXRlQm9tVGFibGUoKTtcclxufTtcclxuXHJcbmNvbnN0IGRlYnVnTW9kZUJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZGVidWdNb2RlXCIpO1xyXG5kZWJ1Z01vZGVCb3gub25jaGFuZ2U9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBnbG9iYWxEYXRhLnNldERlYnVnTW9kZShkZWJ1Z01vZGVCb3guY2hlY2tlZCk7XHJcbiAgICByZW5kZXIuZHJhd0NhbnZhcyhhbGxjYW52YXMuZnJvbnQpO1xyXG4gICAgcmVuZGVyLmRyYXdDYW52YXMoYWxsY2FudmFzLmJhY2spO1xyXG59O1xyXG5cclxuXHJcblxyXG5cclxuY29uc3QgZmlsdGVyQk9NID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib20tZmlsdGVyXCIpO1xyXG5maWx0ZXJCT00ub25pbnB1dD1mdW5jdGlvbigpXHJcbntcclxuICAgIGlib20uc2V0RmlsdGVyQk9NKGZpbHRlckJPTS52YWx1ZSk7XHJcbn07XHJcblxyXG5jb25zdCBjbGVhckZpbHRlckJPTSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiY2xlYXJCT01TZWFyY2hcIik7XHJcbmNsZWFyRmlsdGVyQk9NLm9uY2xpY2s9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBmaWx0ZXJCT00udmFsdWU9XCJcIjtcclxuICAgIGlib20uc2V0RmlsdGVyQk9NKGZpbHRlckJPTS52YWx1ZSk7XHJcbn07XHJcblxyXG5jb25zdCBmaWx0ZXJMYXllciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibGF5ZXItZmlsdGVyXCIpO1xyXG5maWx0ZXJMYXllci5vbmlucHV0PWZ1bmN0aW9uKClcclxue1xyXG4gICAgaWJvbS5zZXRGaWx0ZXJMYXllcihmaWx0ZXJMYXllci52YWx1ZSk7XHJcbn07XHJcblxyXG5jb25zdCBjbGVhckZpbHRlckxheWVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjbGVhckxheWVyU2VhcmNoXCIpO1xyXG5jbGVhckZpbHRlckxheWVyLm9uY2xpY2s9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBmaWx0ZXJMYXllci52YWx1ZT1cIlwiO1xyXG4gICAgaWJvbS5zZXRGaWx0ZXJMYXllcihmaWx0ZXJMYXllci52YWx1ZSk7XHJcbn07XHJcblxyXG5jb25zdCBib21DaGVja2JveGVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib21DaGVja2JveGVzXCIpO1xyXG5ib21DaGVja2JveGVzLm9uaW5wdXQ9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBpYm9tLnNldEJvbUNoZWNrYm94ZXMoYm9tQ2hlY2tib3hlcy52YWx1ZSk7XHJcbn07XHJcblxyXG5jb25zdCByZW1vdmVCT01FbnRyaWVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJyZW1vdmVCT01FbnRyaWVzXCIpO1xyXG5yZW1vdmVCT01FbnRyaWVzLm9uaW5wdXQ9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBpYm9tLnNldFJlbW92ZUJPTUVudHJpZXMocmVtb3ZlQk9NRW50cmllcy52YWx1ZSk7XHJcbn07XHJcblxyXG5jb25zdCBhZGRpdGlvbmFsQXR0cmlidXRlcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYWRkaXRpb25hbEF0dHJpYnV0ZXNcIik7XHJcbmFkZGl0aW9uYWxBdHRyaWJ1dGVzLm9uaW5wdXQ9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBpYm9tLnNldEFkZGl0aW9uYWxBdHRyaWJ1dGVzKGFkZGl0aW9uYWxBdHRyaWJ1dGVzLnZhbHVlKTtcclxufTtcclxuXHJcbmNvbnN0IGZsX2J0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZmwtYnRuXCIpO1xyXG5mbF9idG4ub25jbGljaz1mdW5jdGlvbigpXHJcbntcclxuICAgIGlib20uY2hhbmdlQ2FudmFzTGF5b3V0KFwiRlwiKTtcclxufTtcclxuXHJcbmNvbnN0IGZiX2J0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZmItYnRuXCIpO1xyXG5mYl9idG4ub25jbGljaz1mdW5jdGlvbigpXHJcbntcclxuICAgIGlib20uY2hhbmdlQ2FudmFzTGF5b3V0KFwiRkJcIik7XHJcbn07XHJcblxyXG5jb25zdCBibF9idG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJsLWJ0blwiKTtcclxuYmxfYnRuLm9uY2xpY2s9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBpYm9tLmNoYW5nZUNhbnZhc0xheW91dChcIkJcIik7XHJcbn07XHJcblxyXG5jb25zdCBib21fYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib20tYnRuXCIpO1xyXG5ib21fYnRuLm9uY2xpY2s9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBpYm9tLmNoYW5nZUJvbUxheW91dChcIkJPTVwiKTtcclxufTtcclxuXHJcbmNvbnN0IGxyX2J0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9tLWxyLWJ0blwiKTtcclxubHJfYnRuLm9uY2xpY2s9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBpYm9tLmNoYW5nZUJvbUxheW91dChcIkxSXCIpO1xyXG59O1xyXG5cclxuY29uc3QgdGJfYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib20tdGItYnRuXCIpO1xyXG50Yl9idG4ub25jbGljaz1mdW5jdGlvbigpXHJcbntcclxuICAgIGlib20uY2hhbmdlQm9tTGF5b3V0KFwiVEJcIik7XHJcbn07XHJcblxyXG5jb25zdCBwY2JfYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwY2ItYnRuXCIpO1xyXG5wY2JfYnRuLm9uY2xpY2s9ZnVuY3Rpb24oKVxyXG57XHJcbiAgICBpYm9tLmNoYW5nZUJvbUxheW91dChcIlBDQlwiKTtcclxufTsiLCIvKiBET00gbWFuaXB1bGF0aW9uIGFuZCBtaXNjIGNvZGUgKi9cclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG52YXIgU3BsaXQgICAgICA9IHJlcXVpcmUoXCJzcGxpdC5qc1wiKTtcclxudmFyIGdsb2JhbERhdGEgPSByZXF1aXJlKFwiLi9nbG9iYWwuanNcIik7XHJcbnZhciByZW5kZXIgICAgID0gcmVxdWlyZShcIi4vcmVuZGVyLmpzXCIpO1xyXG52YXIgcGNiICAgICAgICA9IHJlcXVpcmUoXCIuL3BjYi5qc1wiKTtcclxudmFyIGhhbmRsZXJzX21vdXNlICAgID0gcmVxdWlyZShcIi4vaGFuZGxlcnNfbW91c2UuanNcIik7XHJcblxyXG5cclxuXHJcbi8vVE9ETzogR0xPQkFMIFZBUklBQkxFU1xyXG5sZXQgbGF5ZXJCb2R5ID0gdW5kZWZpbmVkO1xyXG5sZXQgbGF5ZXJIZWFkID0gdW5kZWZpbmVkO1xyXG5sZXQgYm9taGVhZCAgID0gdW5kZWZpbmVkO1xyXG5sZXQgdG9wbW9zdGRpdiA9IHVuZGVmaW5lZDtcclxubGV0IGJvbSA9IHVuZGVmaW5lZDtcclxubGV0IGJvbXRhYmxlID0gdW5kZWZpbmVkO1xyXG5cclxuLy9UT0RPOiAgR0xPQkFMIFZBUklBQkxFIFJFRkFDVE9SXHJcbmxldCBmaWx0ZXJCT00gPSBcIlwiO1xyXG5mdW5jdGlvbiBnZXRGaWx0ZXJCT00oKSBcclxue1xyXG4gICAgcmV0dXJuIGZpbHRlckJPTTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2V0RmlsdGVyQk9NKGlucHV0KSBcclxue1xyXG4gICAgZmlsdGVyQk9NID0gaW5wdXQudG9Mb3dlckNhc2UoKTtcclxuICAgIHBvcHVsYXRlQm9tVGFibGUoKTtcclxufVxyXG5cclxuXHJcbmxldCBmaWx0ZXJMYXllciA9IFwiXCI7XHJcbmZ1bmN0aW9uIGdldEZpbHRlckxheWVyKCkgXHJcbntcclxuICAgIHJldHVybiBmaWx0ZXJMYXllcjtcclxufVxyXG5cclxuZnVuY3Rpb24gc2V0RmlsdGVyTGF5ZXIoaW5wdXQpIFxyXG57XHJcbiAgICBmaWx0ZXJMYXllciA9IGlucHV0LnRvTG93ZXJDYXNlKCk7XHJcbiAgICBwb3B1bGF0ZUxheWVyVGFibGUoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2V0RGFya01vZGUodmFsdWUpXHJcbntcclxuICAgIGlmICh2YWx1ZSlcclxuICAgIHtcclxuICAgICAgICB0b3Btb3N0ZGl2LmNsYXNzTGlzdC5hZGQoXCJkYXJrXCIpO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIHRvcG1vc3RkaXYuY2xhc3NMaXN0LnJlbW92ZShcImRhcmtcIik7XHJcbiAgICB9XHJcbiAgICBnbG9iYWxEYXRhLndyaXRlU3RvcmFnZShcImRhcmttb2RlXCIsIHZhbHVlKTtcclxuICAgIHJlbmRlci5kcmF3Q2FudmFzKGdsb2JhbERhdGEuR2V0QWxsQ2FudmFzKCkuZnJvbnQpO1xyXG4gICAgcmVuZGVyLmRyYXdDYW52YXMoZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5iYWNrKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlQ2hlY2tib3hDaGFuZ2VIYW5kbGVyKGNoZWNrYm94LCBib21lbnRyeSlcclxue1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkgXHJcbiAgICB7XHJcbiAgICAgICAgaWYoYm9tZW50cnkuY2hlY2tib3hlcy5nZXQoY2hlY2tib3gpKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgYm9tZW50cnkuY2hlY2tib3hlcy5zZXQoY2hlY2tib3gsZmFsc2UpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLndyaXRlU3RvcmFnZShcImNoZWNrYm94XCIgKyBcIl9cIiArIGNoZWNrYm94LnRvTG93ZXJDYXNlKCkgKyBcIl9cIiArIGJvbWVudHJ5LnJlZmVyZW5jZSwgXCJmYWxzZVwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgYm9tZW50cnkuY2hlY2tib3hlcy5zZXQoY2hlY2tib3gsdHJ1ZSk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEud3JpdGVTdG9yYWdlKFwiY2hlY2tib3hcIiArIFwiX1wiICsgY2hlY2tib3gudG9Mb3dlckNhc2UoKSArIFwiX1wiICsgYm9tZW50cnkucmVmZXJlbmNlLCBcInRydWVcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFNhdmUgY3VycmVudGx5IGhpZ2hsaXRlZCByb3dcclxuICAgICAgICBsZXQgcm93aWQgPSBnbG9iYWxEYXRhLmdldEN1cnJlbnRIaWdobGlnaHRlZFJvd0lkKCk7XHJcbiAgICAgICAgLy8gUmVkcmF3IHRoZSBjYW52YXNcclxuICAgICAgICByZW5kZXIuZHJhd0NhbnZhcyhnbG9iYWxEYXRhLkdldEFsbENhbnZhcygpLmZyb250KTtcclxuICAgICAgICByZW5kZXIuZHJhd0NhbnZhcyhnbG9iYWxEYXRhLkdldEFsbENhbnZhcygpLmJhY2spO1xyXG4gICAgICAgIC8vIFJlZHJhdyB0aGUgQk9NIHRhYmxlXHJcbiAgICAgICAgcG9wdWxhdGVCb21UYWJsZSgpO1xyXG4gICAgICAgIC8vIFJlbmRlciBjdXJyZW50IHJvdyBzbyBpdHMgaGlnaGxpZ2h0ZWRcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChyb3dpZCkuY2xhc3NMaXN0LmFkZChcImhpZ2hsaWdodGVkXCIpO1xyXG4gICAgICAgIC8vIFNldCBjdXJyZW50IHNlbGVjdGVkIHJvdyBnbG9iYWwgdmFyaWFibGVcclxuICAgICAgICBnbG9iYWxEYXRhLnNldEN1cnJlbnRIaWdobGlnaHRlZFJvd0lkKHJvd2lkKTtcclxuICAgICAgICAvLyBJZiBoaWdobGlnaHRlZCB0aGVuIGEgc3BlY2lhbCBjb2xvciB3aWxsIGJlIHVzZWQgZm9yIHRoZSBwYXJ0LlxyXG4gICAgICAgIHJlbmRlci5kcmF3SGlnaGxpZ2h0cyhJc0NoZWNrYm94Q2xpY2tlZChnbG9iYWxEYXRhLmdldEN1cnJlbnRIaWdobGlnaHRlZFJvd0lkKCksIFwicGxhY2VkXCIpKTtcclxuICAgIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVJvd0hpZ2hsaWdodEhhbmRsZXIocm93aWQsIHJlZnMpXHJcbntcclxuICAgIHJldHVybiBmdW5jdGlvbigpXHJcbiAgICB7XHJcbiAgICAgICAgaWYgKGdsb2JhbERhdGEuZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGlmIChnbG9iYWxEYXRhLmdldEN1cnJlbnRIaWdobGlnaHRlZFJvd0lkKCkgPT0gcm93aWQpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChnbG9iYWxEYXRhLmdldEN1cnJlbnRIaWdobGlnaHRlZFJvd0lkKCkpLmNsYXNzTGlzdC5yZW1vdmUoXCJoaWdobGlnaHRlZFwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHJvd2lkKS5jbGFzc0xpc3QuYWRkKFwiaGlnaGxpZ2h0ZWRcIik7XHJcbiAgICAgICAgZ2xvYmFsRGF0YS5zZXRDdXJyZW50SGlnaGxpZ2h0ZWRSb3dJZChyb3dpZCk7XHJcbiAgICAgICAgZ2xvYmFsRGF0YS5zZXRIaWdobGlnaHRlZFJlZnMocmVmcyk7XHJcbiAgICAgICAgLy8gSWYgaGlnaGxpZ2h0ZWQgdGhlbiBhIHNwZWNpYWwgY29sb3Igd2lsbCBiZSB1c2VkIGZvciB0aGUgcGFydC5cclxuICAgICAgICByZW5kZXIuZHJhd0hpZ2hsaWdodHMoSXNDaGVja2JveENsaWNrZWQoZ2xvYmFsRGF0YS5nZXRDdXJyZW50SGlnaGxpZ2h0ZWRSb3dJZCgpLCBcInBsYWNlZFwiKSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVudHJ5TWF0Y2hlcyhwYXJ0KVxyXG57XHJcbiAgICAvLyBjaGVjayByZWZzXHJcbiAgICBpZiAocGFydC5yZWZlcmVuY2UudG9Mb3dlckNhc2UoKS5pbmRleE9mKGdldEZpbHRlckJPTSgpKSA+PSAwKVxyXG4gICAge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgLy8gY2hlY2sgdmFsdWVcclxuICAgIGlmIChwYXJ0LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihnZXRGaWx0ZXJCT00oKSk+PSAwKVxyXG4gICAge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSBcclxuICAgIC8vIGNoZWNrIGZvb3RwcmludFxyXG4gICAgaWYgKHBhcnQucGFja2FnZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoZ2V0RmlsdGVyQk9NKCkpPj0gMClcclxuICAgIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDaGVjayB0aGUgZGlzcGxheWVkIGF0dHJpYnV0ZXNcclxuICAgIGxldCBhZGRpdGlvbmFsQXR0cmlidXRlcyA9IGdsb2JhbERhdGEuZ2V0QWRkaXRpb25hbEF0dHJpYnV0ZXMoKS5zcGxpdChcIixcIik7XHJcbiAgICBhZGRpdGlvbmFsQXR0cmlidXRlcyAgICAgPSBhZGRpdGlvbmFsQXR0cmlidXRlcy5maWx0ZXIoZnVuY3Rpb24oZSl7cmV0dXJuIGU7fSk7XHJcbiAgICBmb3IgKGxldCB4IG9mIGFkZGl0aW9uYWxBdHRyaWJ1dGVzKVxyXG4gICAge1xyXG4gICAgICAgIC8vIHJlbW92ZSBiZWdpbm5pbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2VcclxuICAgICAgICB4ID0geC50cmltKCk7XHJcbiAgICAgICAgaWYgKHBhcnQuYXR0cmlidXRlcy5oYXMoeCkpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBpZihwYXJ0LmF0dHJpYnV0ZXMuZ2V0KHgpLmluZGV4T2YoZ2V0RmlsdGVyQk9NKCkpID49IDApXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZW50cnlNYXRjaGVzTGF5ZXIobGF5ZXIpIFxyXG57XHJcbiAgICAvLyBjaGVjayByZWZzXHJcbiAgICBpZiAobGF5ZXIubmFtZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoZ2V0RmlsdGVyTGF5ZXIoKSkgPj0gMCkgXHJcbiAgICB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuZnVuY3Rpb24gaGlnaGxpZ2h0RmlsdGVyTGF5ZXIocykgXHJcbntcclxuICAgIGlmICghZ2V0RmlsdGVyTGF5ZXIoKSkgXHJcbiAgICB7XHJcbiAgICAgICAgcmV0dXJuIHM7XHJcbiAgICB9XHJcbiAgICBsZXQgcGFydHMgPSBzLnRvTG93ZXJDYXNlKCkuc3BsaXQoZ2V0RmlsdGVyTGF5ZXIoKSk7XHJcbiAgICBpZiAocGFydHMubGVuZ3RoID09IDEpIFxyXG4gICAge1xyXG4gICAgICAgIHJldHVybiBzO1xyXG4gICAgfVxyXG4gICAgbGV0IHIgPSBcIlwiO1xyXG4gICAgbGV0IHBvcyA9IDA7XHJcbiAgICBmb3IgKGxldCBpIGluIHBhcnRzKSBcclxuICAgIHtcclxuICAgICAgICBpZiAoaSA+IDApIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgciArPSBcIjxtYXJrIGNsYXNzPVxcXCJoaWdobGlnaHRcXFwiPlwiICsgcy5zdWJzdHJpbmcocG9zLCBwb3MgKyBnZXRGaWx0ZXJMYXllcigpLmxlbmd0aCkgKyBcIjwvbWFyaz5cIjtcclxuICAgICAgICAgICAgcG9zICs9IGdldEZpbHRlckxheWVyKCkubGVuZ3RoO1xyXG4gICAgICAgIH1cclxuICAgICAgICByICs9IHMuc3Vic3RyaW5nKHBvcywgcG9zICsgcGFydHNbaV0ubGVuZ3RoKTtcclxuICAgICAgICBwb3MgKz0gcGFydHNbaV0ubGVuZ3RoO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBoaWdobGlnaHRGaWx0ZXIocylcclxue1xyXG4gICAgaWYgKCFnZXRGaWx0ZXJCT00oKSkgXHJcbiAgICB7XHJcbiAgICAgICAgcmV0dXJuIHM7XHJcbiAgICB9XHJcbiAgICBsZXQgcGFydHMgPSBzLnRvTG93ZXJDYXNlKCkuc3BsaXQoZ2V0RmlsdGVyQk9NKCkpO1xyXG4gICAgaWYgKHBhcnRzLmxlbmd0aCA9PSAxKVxyXG4gICAge1xyXG4gICAgICAgIHJldHVybiBzO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCByID0gXCJcIjtcclxuICAgIGxldCBwb3MgPSAwO1xyXG4gICAgZm9yIChsZXQgaSBpbiBwYXJ0cylcclxuICAgIHtcclxuICAgICAgICBpZiAoaSA+IDApXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICByICs9IFwiPG1hcmsgY2xhc3M9XFxcImhpZ2hsaWdodFxcXCI+XCIgKyBzLnN1YnN0cmluZyhwb3MsIHBvcyArIGdldEZpbHRlckJPTSgpLmxlbmd0aCkgKyBcIjwvbWFyaz5cIjtcclxuICAgICAgICAgICAgcG9zICs9IGdldEZpbHRlckJPTSgpLmxlbmd0aDtcclxuICAgICAgICB9XHJcbiAgICAgICAgciArPSBzLnN1YnN0cmluZyhwb3MsIHBvcyArIHBhcnRzW2ldLmxlbmd0aCk7XHJcbiAgICAgICAgcG9zICs9IHBhcnRzW2ldLmxlbmd0aDtcclxuICAgIH1cclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVDb2x1bW5IZWFkZXIobmFtZSwgY2xzLCBjb21wYXJhdG9yKVxyXG57XHJcbiAgICBsZXQgdGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVEhcIik7XHJcbiAgICB0aC5pbm5lckhUTUwgPSBuYW1lO1xyXG4gICAgdGguY2xhc3NMaXN0LmFkZChjbHMpO1xyXG4gICAgdGguc3R5bGUuY3Vyc29yID0gXCJwb2ludGVyXCI7XHJcbiAgICBsZXQgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJTUEFOXCIpO1xyXG4gICAgc3Bhbi5jbGFzc0xpc3QuYWRkKFwic29ydG1hcmtcIik7XHJcbiAgICBzcGFuLmNsYXNzTGlzdC5hZGQoXCJub25lXCIpO1xyXG4gICAgdGguYXBwZW5kQ2hpbGQoc3Bhbik7XHJcbiAgICB0aC5vbmNsaWNrID0gZnVuY3Rpb24oKVxyXG4gICAge1xyXG4gICAgICAgIGlmIChnbG9iYWxEYXRhLmdldEN1cnJlbnRTb3J0Q29sdW1uKCkgJiYgdGhpcyAhPT0gZ2xvYmFsRGF0YS5nZXRDdXJyZW50U29ydENvbHVtbigpKSBcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIC8vIEN1cnJlbnRseSBzb3J0ZWQgYnkgYW5vdGhlciBjb2x1bW5cclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5nZXRDdXJyZW50U29ydENvbHVtbigpLmNoaWxkTm9kZXNbMV0uY2xhc3NMaXN0LnJlbW92ZShnbG9iYWxEYXRhLmdldEN1cnJlbnRTb3J0T3JkZXIoKSk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZ2V0Q3VycmVudFNvcnRDb2x1bW4oKS5jaGlsZE5vZGVzWzFdLmNsYXNzTGlzdC5hZGQoXCJub25lXCIpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLnNldEN1cnJlbnRTb3J0Q29sdW1uKG51bGwpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLnNldEN1cnJlbnRTb3J0T3JkZXIobnVsbCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZ2xvYmFsRGF0YS5nZXRDdXJyZW50U29ydENvbHVtbigpICYmIHRoaXMgPT09IGdsb2JhbERhdGEuZ2V0Q3VycmVudFNvcnRDb2x1bW4oKSkgXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBBbHJlYWR5IHNvcnRlZCBieSB0aGlzIGNvbHVtblxyXG4gICAgICAgICAgICBpZiAoZ2xvYmFsRGF0YS5nZXRDdXJyZW50U29ydE9yZGVyKCkgPT0gXCJhc2NcIikgXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIC8vIFNvcnQgYnkgdGhpcyBjb2x1bW4sIGRlc2NlbmRpbmcgb3JkZXJcclxuICAgICAgICAgICAgICAgIGdsb2JhbERhdGEuc2V0Qm9tU29ydEZ1bmN0aW9uKGZ1bmN0aW9uKGEsIGIpIFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAtY29tcGFyYXRvcihhLCBiKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgZ2xvYmFsRGF0YS5nZXRDdXJyZW50U29ydENvbHVtbigpLmNoaWxkTm9kZXNbMV0uY2xhc3NMaXN0LnJlbW92ZShcImFzY1wiKTtcclxuICAgICAgICAgICAgICAgIGdsb2JhbERhdGEuZ2V0Q3VycmVudFNvcnRDb2x1bW4oKS5jaGlsZE5vZGVzWzFdLmNsYXNzTGlzdC5hZGQoXCJkZXNjXCIpO1xyXG4gICAgICAgICAgICAgICAgZ2xvYmFsRGF0YS5zZXRDdXJyZW50U29ydE9yZGVyKFwiZGVzY1wiKTtcclxuICAgICAgICAgICAgfSBcclxuICAgICAgICAgICAgZWxzZSBcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgLy8gVW5zb3J0XHJcbiAgICAgICAgICAgICAgICBnbG9iYWxEYXRhLnNldEJvbVNvcnRGdW5jdGlvbihudWxsKTtcclxuICAgICAgICAgICAgICAgIGdsb2JhbERhdGEuZ2V0Q3VycmVudFNvcnRDb2x1bW4oKS5jaGlsZE5vZGVzWzFdLmNsYXNzTGlzdC5yZW1vdmUoXCJkZXNjXCIpO1xyXG4gICAgICAgICAgICAgICAgZ2xvYmFsRGF0YS5nZXRDdXJyZW50U29ydENvbHVtbigpLmNoaWxkTm9kZXNbMV0uY2xhc3NMaXN0LmFkZChcIm5vbmVcIik7XHJcbiAgICAgICAgICAgICAgICBnbG9iYWxEYXRhLnNldEN1cnJlbnRTb3J0Q29sdW1uKG51bGwpO1xyXG4gICAgICAgICAgICAgICAgZ2xvYmFsRGF0YS5zZXRDdXJyZW50U29ydE9yZGVyKG51bGwpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIC8vIFNvcnQgYnkgdGhpcyBjb2x1bW4sIGFzY2VuZGluZyBvcmRlclxyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLnNldEJvbVNvcnRGdW5jdGlvbihjb21wYXJhdG9yKTtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5zZXRDdXJyZW50U29ydENvbHVtbih0aGlzKTtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5nZXRDdXJyZW50U29ydENvbHVtbigpLmNoaWxkTm9kZXNbMV0uY2xhc3NMaXN0LnJlbW92ZShcIm5vbmVcIik7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZ2V0Q3VycmVudFNvcnRDb2x1bW4oKS5jaGlsZE5vZGVzWzFdLmNsYXNzTGlzdC5hZGQoXCJhc2NcIik7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuc2V0Q3VycmVudFNvcnRPcmRlcihcImFzY1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcG9wdWxhdGVCb21Cb2R5KCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGg7XHJcbn1cclxuXHJcbi8vIERlc2NyaWJlcyBob3cgdG8gc29ydCBjaGVja2JveGVzXHJcbmZ1bmN0aW9uIENoZWNrYm94Q29tcGFyZShzdHJpbmdOYW1lKVxyXG57XHJcbiAgICByZXR1cm4gKHBhcnRBLCBwYXJ0QikgPT4ge1xyXG4gICAgICAgIGlmIChwYXJ0QS5jaGVja2JveGVzLmdldChzdHJpbmdOYW1lKSAmJiAhcGFydEIuY2hlY2tib3hlcy5nZXQoc3RyaW5nTmFtZSkpIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcmV0dXJuICAxO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICghcGFydEEuY2hlY2tib3hlcy5nZXQoc3RyaW5nTmFtZSkgJiYgcGFydEIuY2hlY2tib3hlcy5nZXQoc3RyaW5nTmFtZSkpIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgICAgIH0gXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vLyBEZXNjcmliZXMgaG9lIHRvIHNvcnQgYnkgYXR0cmlidXRlc1xyXG5mdW5jdGlvbiBBdHRyaWJ1dGVDb21wYXJlKHN0cmluZ05hbWUpXHJcbntcclxuICAgIHJldHVybiAocGFydEEsIHBhcnRCKSA9PiB7XHJcbiAgICAgICAgaWYgKHBhcnRBLmF0dHJpYnV0ZXMuZ2V0KHN0cmluZ05hbWUpICE9IHBhcnRCLmF0dHJpYnV0ZXMuZ2V0KHN0cmluZ05hbWUpKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcmV0dXJuICBwYXJ0QS5hdHRyaWJ1dGVzLmdldChzdHJpbmdOYW1lKSA+IHBhcnRCLmF0dHJpYnV0ZXMuZ2V0KHN0cmluZ05hbWUpID8gMSA6IC0xO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICByZXR1cm4gMDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBvcHVsYXRlTGF5ZXJIZWFkZXIoKVxyXG57XHJcbiAgICB3aGlsZSAobGF5ZXJIZWFkLmZpcnN0Q2hpbGQpIFxyXG4gICAge1xyXG4gICAgICAgIGxheWVySGVhZC5yZW1vdmVDaGlsZChsYXllckhlYWQuZmlyc3RDaGlsZCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSGVhZGVyIHJvd1xyXG4gICAgbGV0IHRyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIlRSXCIpO1xyXG4gICAgLy8gRGVmaW5lcyB0aGVcclxuICAgIGxldCB0aCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJUSFwiKTtcclxuXHJcbiAgICB0aC5jbGFzc0xpc3QuYWRkKFwidmlzaWFibGVDb2xcIik7XHJcblxyXG4gICAgbGV0IHRyMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJUUlwiKTtcclxuICAgIGxldCB0aGYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVEhcIik7XHJcbiAgICBsZXQgdGhiID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIlRIXCIpO1xyXG5cclxuICAgIHRoZi5pbm5lckhUTUwgPSBcIkZyb250XCJcclxuICAgIHRoYi5pbm5lckhUTUwgPSBcIkJhY2tcIlxyXG4gICAgdHIyLmFwcGVuZENoaWxkKHRoZilcclxuICAgIHRyMi5hcHBlbmRDaGlsZCh0aGIpXHJcblxyXG4gICAgdGguaW5uZXJIVE1MID0gXCJWaXNpYmxlXCI7XHJcbiAgICB0aC5jb2xTcGFuID0gMlxyXG4gICAgbGV0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiU1BBTlwiKTtcclxuICAgIHNwYW4uY2xhc3NMaXN0LmFkZChcIm5vbmVcIik7XHJcbiAgICB0aC5hcHBlbmRDaGlsZChzcGFuKTtcclxuICAgIHRyLmFwcGVuZENoaWxkKHRoKTtcclxuXHJcbiAgICB0aCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJUSFwiKTtcclxuICAgIHRoLmlubmVySFRNTCA9IFwiTGF5ZXJcIjtcclxuICAgIHRoLnJvd1NwYW4gPSAyO1xyXG4gICAgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJTUEFOXCIpO1xyXG4gICAgc3Bhbi5jbGFzc0xpc3QuYWRkKFwibm9uZVwiKTtcclxuICAgIHRoLmFwcGVuZENoaWxkKHNwYW4pO1xyXG4gICAgdHIuYXBwZW5kQ2hpbGQodGgpO1xyXG5cclxuICAgIGxheWVySGVhZC5hcHBlbmRDaGlsZCh0cik7XHJcbiAgICBsYXllckhlYWQuYXBwZW5kQ2hpbGQodHIyKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlTGF5ZXJDaGVja2JveENoYW5nZUhhbmRsZXIobGF5ZXJFbnRyeSwgaXNGcm9udCkge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkgXHJcbiAgICB7XHJcbiAgICAgICAgaWYoaXNGcm9udClcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGlmKGxheWVyRW50cnkudmlzaWJsZV9mcm9udClcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcGNiLlNldExheWVyVmlzaWJpbGl0eShsYXllckVudHJ5Lm5hbWUsIGlzRnJvbnQsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIGdsb2JhbERhdGEud3JpdGVTdG9yYWdlKFwiY2hlY2tib3hfbGF5ZXJfZnJvbnRfXCIgKyBsYXllckVudHJ5Lm5hbWUgKyBcIl92aXNpYmxlXCIsIFwiZmFsc2VcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBwY2IuU2V0TGF5ZXJWaXNpYmlsaXR5KGxheWVyRW50cnkubmFtZSwgaXNGcm9udCwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICBnbG9iYWxEYXRhLndyaXRlU3RvcmFnZShcImNoZWNrYm94X2xheWVyX2Zyb250X1wiICsgbGF5ZXJFbnRyeS5uYW1lICsgXCJfdmlzaWJsZVwiLCBcInRydWVcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaWYobGF5ZXJFbnRyeS52aXNpYmxlX2JhY2spXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHBjYi5TZXRMYXllclZpc2liaWxpdHkobGF5ZXJFbnRyeS5uYW1lLCBpc0Zyb250LCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICBnbG9iYWxEYXRhLndyaXRlU3RvcmFnZShcImNoZWNrYm94X2xheWVyX2JhY2tfXCIgKyBsYXllckVudHJ5Lm5hbWUgKyBcIl92aXNpYmxlXCIsIFwiZmFsc2VcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBwY2IuU2V0TGF5ZXJWaXNpYmlsaXR5KGxheWVyRW50cnkubmFtZSwgaXNGcm9udCwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICBnbG9iYWxEYXRhLndyaXRlU3RvcmFnZShcImNoZWNrYm94X2xheWVyX2JhY2tfXCIgKyBsYXllckVudHJ5Lm5hbWUgKyBcIl92aXNpYmxlXCIsIFwidHJ1ZVwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHBvcHVsYXRlTGF5ZXJCb2R5KCkgXHJcbntcclxuICAgIHdoaWxlIChsYXllckJvZHkuZmlyc3RDaGlsZCkgXHJcbiAgICB7XHJcbiAgICAgICAgbGF5ZXJCb2R5LnJlbW92ZUNoaWxkKGxheWVyQm9keS5maXJzdENoaWxkKTtcclxuICAgIH1cclxuICAgIGxldCBsYXllcnRhYmxlID0gIHBjYi5HZXRMYXllcnMoKTtcclxuXHJcbiAgICAvLyByZW1vdmUgZW50cmllcyB0aGF0IGRvIG5vdCBtYXRjaCBmaWx0ZXJcclxuICAgIGZvciAobGV0IGkgb2YgbGF5ZXJ0YWJsZSkgXHJcbiAgICB7XHJcblxyXG4gICAgICAgIGlmIChnZXRGaWx0ZXJMYXllcigpICE9IFwiXCIpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBpZighZW50cnlNYXRjaGVzTGF5ZXIoaSkpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgdHIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVFJcIik7XHJcbiAgICAgICAgbGV0IHRkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIlREXCIpO1xyXG4gICAgICAgIGxldCBpbnB1dF9mcm9udCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKTtcclxuICAgICAgICBsZXQgaW5wdXRfYmFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKTtcclxuICAgICAgICBpbnB1dF9mcm9udC50eXBlID0gXCJjaGVja2JveFwiO1xyXG4gICAgICAgIGlucHV0X2JhY2sudHlwZSA9IFwiY2hlY2tib3hcIjtcclxuICAgICAgICAvLyBBc3N1bWVzIHRoYXQgYWxsIGxheWVycyBhcmUgdmlzaWJsZSBieSBkZWZhdWx0LlxyXG4gICAgICAgIGlmICggICAgKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoIFwiY2hlY2tib3hfbGF5ZXJfZnJvbnRfXCIgKyBpLm5hbWUgKyBcIl92aXNpYmxlXCIgKSA9PSBcInRydWVcIilcclxuICAgICAgICAgICAgIHx8IChnbG9iYWxEYXRhLnJlYWRTdG9yYWdlKCBcImNoZWNrYm94X2xheWVyX2Zyb250X1wiICsgaS5uYW1lICsgXCJfdmlzaWJsZVwiICkgPT0gbnVsbClcclxuICAgICAgICApXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwY2IuU2V0TGF5ZXJWaXNpYmlsaXR5KGkubmFtZSwgdHJ1ZSwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIGlucHV0X2Zyb250LmNoZWNrZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwY2IuU2V0TGF5ZXJWaXNpYmlsaXR5KGkubmFtZSwgdHJ1ZSwgZmFsc2UpO1xyXG4gICAgICAgICAgICBpbnB1dF9mcm9udC5jaGVja2VkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgaWYgKCAgICAoZ2xvYmFsRGF0YS5yZWFkU3RvcmFnZSggXCJjaGVja2JveF9sYXllcl9iYWNrX1wiICsgaS5uYW1lICsgXCJfdmlzaWJsZVwiICkgPT0gXCJ0cnVlXCIpXHJcbiAgICAgICAgICAgICB8fCAoZ2xvYmFsRGF0YS5yZWFkU3RvcmFnZSggXCJjaGVja2JveF9sYXllcl9iYWNrX1wiICsgaS5uYW1lICsgXCJfdmlzaWJsZVwiICkgPT0gbnVsbClcclxuICAgICAgICApXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwY2IuU2V0TGF5ZXJWaXNpYmlsaXR5KGkubmFtZSwgZmFsc2UsIHRydWUpO1xyXG4gICAgICAgICAgICBpbnB1dF9iYWNrLmNoZWNrZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwY2IuU2V0TGF5ZXJWaXNpYmlsaXR5KGkubmFtZSwgZmFsc2UsIGZhbHNlKTtcclxuICAgICAgICAgICAgaW5wdXRfYmFjay5jaGVja2VkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBcclxuICAgICAgICBpbnB1dF9mcm9udC5vbmNoYW5nZSA9IGNyZWF0ZUxheWVyQ2hlY2tib3hDaGFuZ2VIYW5kbGVyKGksIHRydWUpO1xyXG4gICAgICAgIGlucHV0X2JhY2sub25jaGFuZ2UgID0gY3JlYXRlTGF5ZXJDaGVja2JveENoYW5nZUhhbmRsZXIoaSwgZmFsc2UpO1xyXG4gICAgICAgIHRkLmFwcGVuZENoaWxkKGlucHV0X2Zyb250KTtcclxuICAgICAgICB0ci5hcHBlbmRDaGlsZCh0ZCk7XHJcblxyXG4gICAgICAgIHRkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIlREXCIpO1xyXG4gICAgICAgIHRkLmFwcGVuZENoaWxkKGlucHV0X2JhY2spO1xyXG4gICAgICAgIHRyLmFwcGVuZENoaWxkKHRkKTtcclxuXHJcbiAgICAgICAgLy8gTGF5ZXJcclxuICAgICAgICB0ZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJURFwiKTtcclxuICAgICAgICB0ZC5pbm5lckhUTUwgPWhpZ2hsaWdodEZpbHRlckxheWVyKGkubmFtZSk7XHJcbiAgICAgICAgdHIuYXBwZW5kQ2hpbGQodGQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxheWVyYm9keS5hcHBlbmRDaGlsZCh0cik7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBvcHVsYXRlQm9tSGVhZGVyKCkgXHJcbntcclxuICAgIHdoaWxlIChib21oZWFkLmZpcnN0Q2hpbGQpXHJcbiAgICB7XHJcbiAgICAgICAgYm9taGVhZC5yZW1vdmVDaGlsZChib21oZWFkLmZpcnN0Q2hpbGQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBsZXQgdHIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVFJcIik7XHJcbiAgICBsZXQgdGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVEhcIik7XHJcbiAgICB0aC5jbGFzc0xpc3QuYWRkKFwibnVtQ29sXCIpO1xyXG4gICAgdHIuYXBwZW5kQ2hpbGQodGgpO1xyXG5cclxuXHJcbiAgICBsZXQgYWRkaXRpb25hbENoZWNrYm94ZXMgPSBnbG9iYWxEYXRhLmdldEJvbUNoZWNrYm94ZXMoKS5zcGxpdChcIixcIik7XHJcbiAgICBhZGRpdGlvbmFsQ2hlY2tib3hlcyAgICAgPSBhZGRpdGlvbmFsQ2hlY2tib3hlcy5maWx0ZXIoZnVuY3Rpb24oZSl7cmV0dXJuIGV9KTtcclxuICAgIGdsb2JhbERhdGEuc2V0Q2hlY2tib3hlcyhhZGRpdGlvbmFsQ2hlY2tib3hlcyk7XHJcbiAgICBmb3IgKGxldCB4MiBvZiBhZGRpdGlvbmFsQ2hlY2tib3hlcylcclxuICAgIHtcclxuICAgICAgICAvLyByZW1vdmUgYmVnaW5uaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlXHJcbiAgICAgICAgeDIgPSB4Mi50cmltKClcclxuICAgICAgICBpZiAoeDIpIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHIuYXBwZW5kQ2hpbGQoY3JlYXRlQ29sdW1uSGVhZGVyKHgyLCBcIkNoZWNrYm94ZXNcIiwgQ2hlY2tib3hDb21wYXJlKHgyKSkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0ci5hcHBlbmRDaGlsZChjcmVhdGVDb2x1bW5IZWFkZXIoXCJSZWZlcmVuY2VzXCIsIFwiUmVmZXJlbmNlc1wiLCAocGFydEEsIHBhcnRCKSA9PiB7XHJcbiAgICAgICAgaWYgKHBhcnRBLnJlZmVyZW5jZSAhPSBwYXJ0Qi5yZWZlcmVuY2UpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFydEEucmVmZXJlbmNlID4gcGFydEIucmVmZXJlbmNlID8gMSA6IC0xO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICByZXR1cm4gMDtcclxuICAgICAgICB9XHJcbiAgICB9KSk7XHJcblxyXG4gICAgdHIuYXBwZW5kQ2hpbGQoY3JlYXRlQ29sdW1uSGVhZGVyKFwiVmFsdWVcIiwgXCJWYWx1ZVwiLCAocGFydEEsIHBhcnRCKSA9PiB7XHJcbiAgICAgICAgaWYgKHBhcnRBLnZhbHVlICE9IHBhcnRCLnZhbHVlKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnRBLnZhbHVlID4gcGFydEIudmFsdWUgPyAxIDogLTE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgIH1cclxuICAgIH0pKTtcclxuXHJcbiAgICB0ci5hcHBlbmRDaGlsZChjcmVhdGVDb2x1bW5IZWFkZXIoXCJGb290cHJpbnRcIiwgXCJGb290cHJpbnRcIiwgKHBhcnRBLCBwYXJ0QikgPT4ge1xyXG4gICAgICAgIGlmIChwYXJ0QS5wYWNrYWdlICE9IHBhcnRCLnBhY2thZ2UpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFydEEucGFja2FnZSA+IHBhcnRCLnBhY2thZ2UgPyAxIDogLTE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgIH1cclxuICAgIH0pKTtcclxuXHJcbiAgICBsZXQgYWRkaXRpb25hbEF0dHJpYnV0ZXMgPSBnbG9iYWxEYXRhLmdldEFkZGl0aW9uYWxBdHRyaWJ1dGVzKCkuc3BsaXQoXCIsXCIpO1xyXG4gICAgLy8gUmVtb3ZlIG51bGwsIFwiXCIsIHVuZGVmaW5lZCwgYW5kIDAgdmFsdWVzXHJcbiAgICBhZGRpdGlvbmFsQXR0cmlidXRlcyAgICA9YWRkaXRpb25hbEF0dHJpYnV0ZXMuZmlsdGVyKGZ1bmN0aW9uKGUpe3JldHVybiBlfSk7XHJcbiAgICBmb3IgKGxldCB4IG9mIGFkZGl0aW9uYWxBdHRyaWJ1dGVzKVxyXG4gICAge1xyXG4gICAgICAgIC8vIHJlbW92ZSBiZWdpbm5pbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2VcclxuICAgICAgICB4ID0geC50cmltKClcclxuICAgICAgICBpZiAoeCkgXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB0ci5hcHBlbmRDaGlsZChjcmVhdGVDb2x1bW5IZWFkZXIoeCwgXCJBdHRyaWJ1dGVzXCIsIEF0dHJpYnV0ZUNvbXBhcmUoeCkpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYoZ2xvYmFsRGF0YS5nZXRDb21iaW5lVmFsdWVzKCkpXHJcbiAgICB7XHJcbiAgICAgICAgICAgIC8vWFhYOiBUaGlzIGNvbXBhcmlzb24gZnVuY3Rpb24gaXMgdXNpbmcgcG9zaXRpdmUgYW5kIG5lZ2F0aXZlIGltcGxpY2l0XHJcbiAgICAgICAgICAgIHRyLmFwcGVuZENoaWxkKGNyZWF0ZUNvbHVtbkhlYWRlcihcIlF1YW50aXR5XCIsIFwiUXVhbnRpdHlcIiwgKHBhcnRBLCBwYXJ0QikgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFydEEucXVhbnRpdHkgLSBwYXJ0Qi5xdWFudGl0eTtcclxuICAgICAgICAgICAgfSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGJvbWhlYWQuYXBwZW5kQ2hpbGQodHIpO1xyXG5cclxufVxyXG5cclxuXHJcblxyXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG4vLyBGaWx0ZXIgZnVuY3Rpb25zIGFyZSBkZWZpbmVkIGhlcmUuIFRoZXNlIGxldCB0aGUgYXBwbGljYXRpb24gZmlsdGVyIFxyXG4vLyBlbGVtZW50cyBvdXQgb2YgdGhlIGNvbXBsZXRlIGJvbS4gXHJcbi8vXHJcbi8vIFRoZSBmaWx0ZXJpbmcgZnVuY3Rpb24gc2hvdWxkIHJldHVybiB0cnVlIGlmIHRoZSBwYXJ0IHNob3VsZCBiZSBmaWx0ZXJlZCBvdXRcclxuLy8gb3RoZXJ3aXNlIGl0IHJldHVybnMgZmFsc2VcclxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuZnVuY3Rpb24gR2V0Qk9NRm9yU2lkZU9mQm9hcmQobG9jYXRpb24pXHJcbntcclxuICAgIGxldCByZXN1bHQgPSBwY2IuR2V0Qk9NKCk7XHJcbiAgICBzd2l0Y2ggKGxvY2F0aW9uKVxyXG4gICAge1xyXG4gICAgY2FzZSBcIkZcIjpcclxuICAgICAgICByZXN1bHQgPSBwY2IuZmlsdGVyQk9NVGFibGUocmVzdWx0LCBmaWx0ZXJCT01fRnJvbnQpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcIkJcIjpcclxuICAgICAgICByZXN1bHQgPSBwY2IuZmlsdGVyQk9NVGFibGUocmVzdWx0LCBmaWx0ZXJCT01fQmFjayk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZmlsdGVyQk9NX0Zyb250KHBhcnQpXHJcbntcclxuICAgIGxldCByZXN1bHQgPSB0cnVlO1xyXG4gICAgaWYocGFydC5sb2NhdGlvbiA9PSBcIkZcIilcclxuICAgIHtcclxuICAgICAgICByZXN1bHQgPSBmYWxzZTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbHRlckJPTV9CYWNrKHBhcnQpXHJcbntcclxuICAgIGxldCByZXN1bHQgPSB0cnVlO1xyXG4gICAgaWYocGFydC5sb2NhdGlvbiA9PSBcIkJcIilcclxuICAgIHtcclxuICAgICAgICByZXN1bHQgPSBmYWxzZTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbHRlckJPTV9CeUF0dHJpYnV0ZShwYXJ0KVxyXG57XHJcbiAgICBsZXQgcmVzdWx0ID0gZmFsc2U7XHJcbiAgICBsZXQgc3BsaXRGaWx0ZXJTdHJpbmcgPSBnbG9iYWxEYXRhLmdldFJlbW92ZUJPTUVudHJpZXMoKS5zcGxpdChcIixcIik7XHJcbiAgICAvLyBSZW1vdmUgbnVsbCwgXCJcIiwgdW5kZWZpbmVkLCBhbmQgMCB2YWx1ZXNcclxuICAgIHNwbGl0RmlsdGVyU3RyaW5nICAgID0gc3BsaXRGaWx0ZXJTdHJpbmcuZmlsdGVyKGZ1bmN0aW9uKGUpe3JldHVybiBlfSk7XHJcblxyXG4gICAgaWYoc3BsaXRGaWx0ZXJTdHJpbmcubGVuZ3RoID4gMCApXHJcbiAgICB7XHJcbiAgICAgICAgZm9yKGxldCBpIG9mIHNwbGl0RmlsdGVyU3RyaW5nKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgLy8gcmVtb3ZpbmcgYmVnaW5uaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlXHJcbiAgICAgICAgICAgIGkgPSBpLnRyaW0oKVxyXG4gICAgICAgICAgICBpZihwYXJ0LmF0dHJpYnV0ZXMuaGFzKGkpKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAvLyBJZCB0aGUgdmFsdWUgaXMgYW4gZW1wdHkgc3RyaW5nIHRoZW4gZG9udCBmaWx0ZXIgb3V0IHRoZSBlbnRyeS4gXHJcbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgdmFsdWUgaXMgYW55dGhpbmcgdGhlbiBmaWx0ZXIgb3V0IHRoZSBib20gZW50cnlcclxuICAgICAgICAgICAgICAgIGlmKHBhcnQuYXR0cmlidXRlcy5nZXQoaSkgIT0gXCJcIilcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG5cclxuZnVuY3Rpb24gR2VuZXJhdGVCT01UYWJsZSgpXHJcbntcclxuICAgIC8vIEdldCBib20gdGFibGUgd2l0aCBlbGVtZW50cyBmb3IgdGhlIHNpZGUgb2YgYm9hcmQgdGhlIHVzZXIgaGFzIHNlbGVjdGVkXHJcbiAgICBsZXQgYm9tdGFibGVUZW1wID0gR2V0Qk9NRm9yU2lkZU9mQm9hcmQoZ2xvYmFsRGF0YS5nZXRDYW52YXNMYXlvdXQoKSk7XHJcblxyXG4gICAgLy8gQXBwbHkgYXR0cmlidXRlIGZpbHRlciB0byBib2FyZFxyXG4gICAgYm9tdGFibGVUZW1wID0gcGNiLmZpbHRlckJPTVRhYmxlKGJvbXRhYmxlVGVtcCwgZmlsdGVyQk9NX0J5QXR0cmlidXRlKTtcclxuXHJcbiAgICAvLyBJZiB0aGUgcGFydHMgYXJlIGRpc3BsYXllZCBvbmUgcGVyIGxpbmUgKG5vdCBjb21iaW5lZCB2YWx1ZXMpLCB0aGVuIHRoZSB0aGUgYm9tIHRhYmxlIG5lZWRzIHRvIGJlIGZsYXR0ZW5lZC4gXHJcbiAgICAvLyBCeSBkZWZhdWx0IHRoZSBkYXRhIGluIHRoZSBqc29uIGZpbGUgaXMgY29tYmluZWRcclxuICAgIGJvbXRhYmxlID0gZ2xvYmFsRGF0YS5nZXRDb21iaW5lVmFsdWVzKCkgPyBwY2IuR2V0Qk9NQ29tYmluZWRWYWx1ZXMoYm9tdGFibGVUZW1wKSA6IGJvbXRhYmxlVGVtcDtcclxuXHJcbiAgICByZXR1cm4gYm9tdGFibGU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBvcHVsYXRlQm9tQm9keSgpXHJcbntcclxuICAgIHdoaWxlIChib20uZmlyc3RDaGlsZClcclxuICAgIHtcclxuICAgICAgICBib20ucmVtb3ZlQ2hpbGQoYm9tLmZpcnN0Q2hpbGQpO1xyXG4gICAgfVxyXG5cclxuICAgIGdsb2JhbERhdGEuc2V0SGlnaGxpZ2h0SGFuZGxlcnMoW10pO1xyXG4gICAgZ2xvYmFsRGF0YS5zZXRDdXJyZW50SGlnaGxpZ2h0ZWRSb3dJZChudWxsKTtcclxuICAgIGxldCBmaXJzdCA9IHRydWU7XHJcblxyXG4gICAgYm9tdGFibGUgPSBHZW5lcmF0ZUJPTVRhYmxlKCk7XHJcblxyXG4gICAgaWYgKGdsb2JhbERhdGEuZ2V0Qm9tU29ydEZ1bmN0aW9uKCkpXHJcbiAgICB7XHJcbiAgICAgICAgYm9tdGFibGUgPSBib210YWJsZS5zbGljZSgpLnNvcnQoZ2xvYmFsRGF0YS5nZXRCb21Tb3J0RnVuY3Rpb24oKSk7XHJcbiAgICB9XHJcbiAgICBmb3IgKGxldCBpIGluIGJvbXRhYmxlKVxyXG4gICAge1xyXG4gICAgICAgIGxldCBib21lbnRyeSA9IGJvbXRhYmxlW2ldO1xyXG4gICAgICAgIGxldCByZWZlcmVuY2VzID0gYm9tZW50cnkucmVmZXJlbmNlO1xyXG5cclxuICAgICAgICAvLyByZW1vdmUgZW50cmllcyB0aGF0IGRvIG5vdCBtYXRjaCBmaWx0ZXJcclxuICAgICAgICBpZiAoZ2V0RmlsdGVyQk9NKCkgIT0gXCJcIilcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGlmKCFlbnRyeU1hdGNoZXMoYm9tZW50cnkpKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gSGlkZSBwbGFjZWQgcGFydHMgb3B0aW9uIGlzIHNldFxyXG4gICAgICAgIGlmKGdsb2JhbERhdGEuZ2V0SGlkZVBsYWNlZFBhcnRzKCkpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBSZW1vdmUgZW50cmllcyB0aGF0IGhhdmUgYmVlbiBwbGFjZWQuIENoZWNrIHRoZSBwbGFjZWQgcGFyYW1ldGVyXHJcbiAgICAgICAgICAgIGlmKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoIFwiY2hlY2tib3hcIiArIFwiX1wiICsgXCJwbGFjZWRcIiArIFwiX1wiICsgYm9tZW50cnkucmVmZXJlbmNlICkgPT0gXCJ0cnVlXCIpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgdHIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVFJcIik7XHJcbiAgICAgICAgbGV0IHRkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIlREXCIpO1xyXG4gICAgICAgIGxldCByb3dudW0gPSAraSArIDE7XHJcbiAgICAgICAgdHIuaWQgPSBcImJvbXJvd1wiICsgcm93bnVtO1xyXG4gICAgICAgIHRkLnRleHRDb250ZW50ID0gcm93bnVtO1xyXG4gICAgICAgIHRyLmFwcGVuZENoaWxkKHRkKTtcclxuXHJcbiAgICAgICAgLy8gQ2hlY2tib3hlc1xyXG4gICAgICAgIGxldCBhZGRpdGlvbmFsQ2hlY2tib3hlcyA9IGdsb2JhbERhdGEuZ2V0Qm9tQ2hlY2tib3hlcygpLnNwbGl0KFwiLFwiKTtcclxuICAgICAgICBmb3IgKGxldCBjaGVja2JveCBvZiBhZGRpdGlvbmFsQ2hlY2tib3hlcykgXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjaGVja2JveCA9IGNoZWNrYm94LnRyaW0oKTtcclxuICAgICAgICAgICAgaWYgKGNoZWNrYm94KSBcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVERcIik7XHJcbiAgICAgICAgICAgICAgICBsZXQgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIik7XHJcbiAgICAgICAgICAgICAgICBpbnB1dC50eXBlID0gXCJjaGVja2JveFwiO1xyXG4gICAgICAgICAgICAgICAgaW5wdXQub25jaGFuZ2UgPSBjcmVhdGVDaGVja2JveENoYW5nZUhhbmRsZXIoY2hlY2tib3gsIGJvbWVudHJ5KTtcclxuICAgICAgICAgICAgICAgIC8vIHJlYWQgdGhlIHZhbHVlIGluIGZyb20gbG9jYWwgc3RvcmFnZVxyXG5cclxuICAgICAgICAgICAgICAgIGlmKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoIFwiY2hlY2tib3hcIiArIFwiX1wiICsgY2hlY2tib3gudG9Mb3dlckNhc2UoKSArIFwiX1wiICsgYm9tZW50cnkucmVmZXJlbmNlICkgPT0gXCJ0cnVlXCIpXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgYm9tZW50cnkuY2hlY2tib3hlcy5zZXQoY2hlY2tib3gsdHJ1ZSlcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBib21lbnRyeS5jaGVja2JveGVzLnNldChjaGVja2JveCxmYWxzZSlcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZihib21lbnRyeS5jaGVja2JveGVzLmdldChjaGVja2JveCkpXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQuY2hlY2tlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQuY2hlY2tlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRkLmFwcGVuZENoaWxkKGlucHV0KTtcclxuICAgICAgICAgICAgICAgIHRyLmFwcGVuZENoaWxkKHRkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcblxyXG5cclxuICAgICAgICAvL0lORk86IFRoZSBsaW5lcyBiZWxvdyBhZGQgdGhlIGNvbnRyb2wgdGhlIGNvbHVtbnMgb24gdGhlIGJvbSB0YWJsZVxyXG4gICAgICAgIC8vIFJlZmVyZW5jZXNcclxuICAgICAgICB0ZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJURFwiKTtcclxuICAgICAgICB0ZC5pbm5lckhUTUwgPSBoaWdobGlnaHRGaWx0ZXIocmVmZXJlbmNlcyk7XHJcbiAgICAgICAgdHIuYXBwZW5kQ2hpbGQodGQpO1xyXG4gICAgICAgIC8vIFZhbHVlXHJcbiAgICAgICAgdGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVERcIik7XHJcbiAgICAgICAgdGQuaW5uZXJIVE1MID0gaGlnaGxpZ2h0RmlsdGVyKGJvbWVudHJ5LnZhbHVlKTtcclxuICAgICAgICB0ci5hcHBlbmRDaGlsZCh0ZCk7XHJcbiAgICAgICAgLy8gRm9vdHByaW50XHJcbiAgICAgICAgdGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiVERcIik7XHJcbiAgICAgICAgdGQuaW5uZXJIVE1MID0gaGlnaGxpZ2h0RmlsdGVyKGJvbWVudHJ5LnBhY2thZ2UpO1xyXG4gICAgICAgIHRyLmFwcGVuZENoaWxkKHRkKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBBdHRyaWJ1dGVzXHJcbiAgICAgICAgbGV0IGFkZGl0aW9uYWxBdHRyaWJ1dGVzID0gZ2xvYmFsRGF0YS5nZXRBZGRpdGlvbmFsQXR0cmlidXRlcygpLnNwbGl0KFwiLFwiKTtcclxuICAgICAgICBmb3IgKGxldCB4IG9mIGFkZGl0aW9uYWxBdHRyaWJ1dGVzKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgeCA9IHgudHJpbSgpXHJcbiAgICAgICAgICAgIGlmICh4KVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0ZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJURFwiKTtcclxuICAgICAgICAgICAgICAgIHRkLmlubmVySFRNTCA9IGhpZ2hsaWdodEZpbHRlcihwY2IuZ2V0QXR0cmlidXRlVmFsdWUoYm9tZW50cnksIHgudG9Mb3dlckNhc2UoKSkpO1xyXG4gICAgICAgICAgICAgICAgdHIuYXBwZW5kQ2hpbGQodGQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZihnbG9iYWxEYXRhLmdldENvbWJpbmVWYWx1ZXMoKSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHRkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIlREXCIpO1xyXG4gICAgICAgICAgICB0ZC50ZXh0Q29udGVudCA9IGJvbWVudHJ5LnF1YW50aXR5O1xyXG4gICAgICAgICAgICB0ci5hcHBlbmRDaGlsZCh0ZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJvbS5hcHBlbmRDaGlsZCh0cik7XHJcblxyXG5cclxuICAgICAgICBib20uYXBwZW5kQ2hpbGQodHIpO1xyXG4gICAgICAgIGxldCBoYW5kbGVyID0gY3JlYXRlUm93SGlnaGxpZ2h0SGFuZGxlcih0ci5pZCwgcmVmZXJlbmNlcyk7XHJcbiAgICAgICAgdHIub25jbGljayA9IGhhbmRsZXI7XHJcbiAgICAgICAgZ2xvYmFsRGF0YS5wdXNoSGlnaGxpZ2h0SGFuZGxlcnMoe1xyXG4gICAgICAgICAgICBpZDogdHIuaWQsXHJcbiAgICAgICAgICAgIGhhbmRsZXI6IGhhbmRsZXIsXHJcbiAgICAgICAgICAgIHJlZnM6IHJlZmVyZW5jZXNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKGdldEZpbHRlckJPTSgpICYmIGZpcnN0KVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaGFuZGxlcigpO1xyXG4gICAgICAgICAgICBmaXJzdCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gaGlnaGxpZ2h0UHJldmlvdXNSb3coKVxyXG57XHJcbiAgICBpZiAoIWdsb2JhbERhdGEuZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKSlcclxuICAgIHtcclxuICAgICAgICBnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKClbZ2xvYmFsRGF0YS5nZXRIaWdobGlnaHRIYW5kbGVycygpLmxlbmd0aCAtIDFdLmhhbmRsZXIoKTtcclxuICAgIH1cclxuICAgIGVsc2VcclxuICAgIHtcclxuICAgICAgICBpZiAoICAgIChnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKCkubGVuZ3RoID4gMSlcclxuICAgICAgICAgICAgICYmIChnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKClbMF0uaWQgPT0gZ2xvYmFsRGF0YS5nZXRDdXJyZW50SGlnaGxpZ2h0ZWRSb3dJZCgpKVxyXG4gICAgICAgIClcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZ2V0SGlnaGxpZ2h0SGFuZGxlcnMoKVtnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKCkubGVuZ3RoIC0gMV0uaGFuZGxlcigpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsb2JhbERhdGEuZ2V0SGlnaGxpZ2h0SGFuZGxlcnMoKS5sZW5ndGggLSAxOyBpKyspXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGlmIChnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKClbaSArIDFdLmlkID09IGdsb2JhbERhdGEuZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKSlcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKClbaV0uaGFuZGxlcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmVuZGVyLnNtb290aFNjcm9sbFRvUm93KGdsb2JhbERhdGEuZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhpZ2hsaWdodE5leHRSb3coKVxyXG57XHJcbiAgICBpZiAoIWdsb2JhbERhdGEuZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKSlcclxuICAgIHtcclxuICAgICAgICBnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKClbMF0uaGFuZGxlcigpO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIGlmICggICAgKGdsb2JhbERhdGEuZ2V0SGlnaGxpZ2h0SGFuZGxlcnMoKS5sZW5ndGggPiAxKVxyXG4gICAgICAgICAgICAgJiYgKGdsb2JhbERhdGEuZ2V0SGlnaGxpZ2h0SGFuZGxlcnMoKVtnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKCkubGVuZ3RoIC0gMV0uaWQgPT0gZ2xvYmFsRGF0YS5nZXRDdXJyZW50SGlnaGxpZ2h0ZWRSb3dJZCgpKVxyXG4gICAgICAgIClcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZ2V0SGlnaGxpZ2h0SGFuZGxlcnMoKVswXS5oYW5kbGVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgZ2xvYmFsRGF0YS5nZXRIaWdobGlnaHRIYW5kbGVycygpLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZ2xvYmFsRGF0YS5nZXRIaWdobGlnaHRIYW5kbGVycygpW2kgLSAxXS5pZCA9PSBnbG9iYWxEYXRhLmdldEN1cnJlbnRIaWdobGlnaHRlZFJvd0lkKCkpXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsRGF0YS5nZXRIaWdobGlnaHRIYW5kbGVycygpW2ldLmhhbmRsZXIoKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHNtb290aFNjcm9sbFRvUm93KGdsb2JhbERhdGEuZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBvcHVsYXRlTGF5ZXJUYWJsZSgpXHJcbntcclxuICAgIHBvcHVsYXRlTGF5ZXJIZWFkZXIoKTtcclxuICAgIHBvcHVsYXRlTGF5ZXJCb2R5KCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBvcHVsYXRlQm9tVGFibGUoKVxyXG57XHJcbiAgICBwb3B1bGF0ZUJvbUhlYWRlcigpO1xyXG4gICAgcG9wdWxhdGVCb21Cb2R5KCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vZHVsZXNDbGlja2VkKHJlZmVyZW5jZXMpXHJcbntcclxuICAgIGxldCBsYXN0Q2xpY2tlZEluZGV4ID0gcmVmZXJlbmNlcy5pbmRleE9mKGdsb2JhbERhdGEuZ2V0TGFzdENsaWNrZWRSZWYoKSk7XHJcbiAgICBsZXQgcmVmID0gcmVmZXJlbmNlc1sobGFzdENsaWNrZWRJbmRleCArIDEpICUgcmVmZXJlbmNlcy5sZW5ndGhdO1xyXG4gICAgZm9yIChsZXQgaGFuZGxlciBvZiBnbG9iYWxEYXRhLmdldEhpZ2hsaWdodEhhbmRsZXJzKCkpIFxyXG4gICAge1xyXG4gICAgICAgIGlmIChoYW5kbGVyLnJlZnMuaW5kZXhPZihyZWYpID49IDApXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLnNldExhc3RDbGlja2VkUmVmKHJlZik7XHJcbiAgICAgICAgICAgIGhhbmRsZXIuaGFuZGxlcigpO1xyXG4gICAgICAgICAgICBzbW9vdGhTY3JvbGxUb1JvdyhnbG9iYWxEYXRhLmdldEN1cnJlbnRIaWdobGlnaHRlZFJvd0lkKCkpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNpbGtzY3JlZW5WaXNpYmxlKHZpc2libGUpXHJcbntcclxuICAgIGlmICh2aXNpYmxlKVxyXG4gICAge1xyXG4gICAgICAgIGdsb2JhbERhdGEuR2V0QWxsQ2FudmFzKCkuZnJvbnQuc2lsay5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcclxuICAgICAgICBnbG9iYWxEYXRhLkdldEFsbENhbnZhcygpLmJhY2suc2lsay5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcclxuICAgICAgICBnbG9iYWxEYXRhLndyaXRlU3RvcmFnZShcInNpbGtzY3JlZW5WaXNpYmxlXCIsIHRydWUpO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIGdsb2JhbERhdGEuR2V0QWxsQ2FudmFzKCkuZnJvbnQuc2lsay5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgICAgICAgZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5iYWNrLnNpbGsuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gICAgICAgIGdsb2JhbERhdGEud3JpdGVTdG9yYWdlKFwic2lsa3NjcmVlblZpc2libGVcIiwgZmFsc2UpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBjaGFuZ2VDYW52YXNMYXlvdXQobGF5b3V0KSBcclxue1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJmbC1idG5cIikuY2xhc3NMaXN0LnJlbW92ZShcImRlcHJlc3NlZFwiKTtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZmItYnRuXCIpLmNsYXNzTGlzdC5yZW1vdmUoXCJkZXByZXNzZWRcIik7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJsLWJ0blwiKS5jbGFzc0xpc3QucmVtb3ZlKFwiZGVwcmVzc2VkXCIpO1xyXG5cclxuICAgIHN3aXRjaCAobGF5b3V0KSBcclxuICAgIHtcclxuICAgIGNhc2UgXCJGXCI6XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJmbC1idG5cIikuY2xhc3NMaXN0LmFkZChcImRlcHJlc3NlZFwiKTtcclxuICAgICAgICBpZiAoZ2xvYmFsRGF0YS5nZXRCb21MYXlvdXQoKSAhPSBcIkJPTVwiKSBcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuY29sbGFwc2VDYW52YXNTcGxpdCgxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiQlwiOlxyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmwtYnRuXCIpLmNsYXNzTGlzdC5hZGQoXCJkZXByZXNzZWRcIik7XHJcbiAgICAgICAgaWYgKGdsb2JhbERhdGEuZ2V0Qm9tTGF5b3V0KCkgIT0gXCJCT01cIikgXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLmNvbGxhcHNlQ2FudmFzU3BsaXQoMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImZiLWJ0blwiKS5jbGFzc0xpc3QuYWRkKFwiZGVwcmVzc2VkXCIpO1xyXG4gICAgICAgIGlmIChnbG9iYWxEYXRhLmdldEJvbUxheW91dCgpICE9IFwiQk9NXCIpIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5zZXRTaXplc0NhbnZhc1NwbGl0KFs1MCwgNTBdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgZ2xvYmFsRGF0YS5zZXRDYW52YXNMYXlvdXQobGF5b3V0KTtcclxuICAgIGdsb2JhbERhdGEud3JpdGVTdG9yYWdlKFwiY2FudmFzbGF5b3V0XCIsIGxheW91dCk7XHJcbiAgICByZW5kZXIucmVzaXplQWxsKCk7XHJcbiAgICBwb3B1bGF0ZUJvbVRhYmxlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBvcHVsYXRlTWV0YWRhdGEoKVxyXG57XHJcbiAgICBsZXQgbWV0YWRhdGEgID0gcGNiLkdldE1ldGFkYXRhKCk7XHJcblxyXG4gICAgaWYobWV0YWRhdGEucmV2aXNpb24gPT0gXCJcIilcclxuICAgIHtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRpdGxlXCIpLmlubmVySFRNTCAgICA9IFwiXCI7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJyZXZpc2lvblwiKS5pbm5lckhUTUwgPSBtZXRhZGF0YS50aXRsZTtcclxuICAgIH1cclxuICAgIGVsc2VcclxuICAgIHtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRpdGxlXCIpLmlubmVySFRNTCAgICA9IG1ldGFkYXRhLnRpdGxlO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicmV2aXNpb25cIikuaW5uZXJIVE1MID0gXCJSZXZpc2lvbjogXCIgKyBtZXRhZGF0YS5yZXZpc2lvbjtcclxuICAgIH1cclxuXHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNvbXBhbnlcIikuaW5uZXJIVE1MICA9IG1ldGFkYXRhLmNvbXBhbnk7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImZpbGVkYXRlXCIpLmlubmVySFRNTCA9IG1ldGFkYXRhLmRhdGU7XHJcbiAgICBpZiAobWV0YWRhdGEudGl0bGUgIT0gXCJcIilcclxuICAgIHtcclxuICAgICAgICBkb2N1bWVudC50aXRsZSA9IG1ldGFkYXRhLnRpdGxlICsgXCIgQk9NXCI7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNoYW5nZUJvbUxheW91dChsYXlvdXQpXHJcbntcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9tLWJ0blwiKS5jbGFzc0xpc3QucmVtb3ZlKFwiZGVwcmVzc2VkXCIpO1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib20tbHItYnRuXCIpLmNsYXNzTGlzdC5yZW1vdmUoXCJkZXByZXNzZWRcIik7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJvbS10Yi1idG5cIikuY2xhc3NMaXN0LnJlbW92ZShcImRlcHJlc3NlZFwiKTtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicGNiLWJ0blwiKS5jbGFzc0xpc3QucmVtb3ZlKFwiZGVwcmVzc2VkXCIpO1xyXG4gICAgc3dpdGNoIChsYXlvdXQpIFxyXG4gICAge1xyXG4gICAgY2FzZSBcIkJPTVwiOlxyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9tLWJ0blwiKS5jbGFzc0xpc3QuYWRkKFwiZGVwcmVzc2VkXCIpO1xyXG4gICAgICAgIGlmIChnbG9iYWxEYXRhLmdldEJvbVNwbGl0KCkpIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5kZXN0cm95TGF5ZXJTcGxpdCgpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLnNldExheWVyU3BsaXQobnVsbCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZGVzdHJveUJvbVNwbGl0KCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuc2V0Qm9tU3BsaXQobnVsbCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZGVzdHJveUNhbnZhc1NwbGl0KCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuc2V0Q2FudmFzU3BsaXQobnVsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9tZGl2XCIpLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZnJvbnRjYW52YXNcIikuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmFja2NhbnZhc1wiKS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsYXllcmRpdlwiKS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib3RcIikuc3R5bGUuaGVpZ2h0ID0gXCJcIjtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJQQ0JcIjpcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInBjYi1idG5cIiAgICAgKS5jbGFzc0xpc3QuYWRkKFwiZGVwcmVzc2VkXCIpO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9tZGl2XCIpLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImZyb250Y2FudmFzXCIpLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmFja2NhbnZhc1wiICkuc3R5bGUuZGlzcGxheSA9IFwiXCI7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsYXllcmRpdlwiICAgKS5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJvdFwiICAgICAgICApLnN0eWxlLmhlaWdodCA9IFwiY2FsYygxMDAlIC0gODBweClcIjtcclxuICAgICAgICBcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImRhdGFkaXZcIiAgICkuY2xhc3NMaXN0LmFkZCggICBcInNwbGl0LWhvcml6b250YWxcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib21kaXZcIiAgICAgKS5jbGFzc0xpc3QucmVtb3ZlKCAgIFwic3BsaXQtaG9yaXpvbnRhbFwiKTtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNhbnZhc2RpdlwiICApLmNsYXNzTGlzdC5yZW1vdmUoICAgXCJzcGxpdC1ob3Jpem9udGFsXCIpO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZnJvbnRjYW52YXNcIikuY2xhc3NMaXN0LmFkZCggICBcInNwbGl0LWhvcml6b250YWxcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJiYWNrY2FudmFzXCIgKS5jbGFzc0xpc3QuYWRkKCAgIFwic3BsaXQtaG9yaXpvbnRhbFwiKTtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxheWVyZGl2XCIgICApLmNsYXNzTGlzdC5hZGQoICAgXCJzcGxpdC1ob3Jpem9udGFsXCIpO1xyXG5cclxuXHJcbiAgICAgICAgaWYgKGdsb2JhbERhdGEuZ2V0Qm9tU3BsaXQoKSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZGVzdHJveUxheWVyU3BsaXQoKTtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5zZXRMYXllclNwbGl0KG51bGwpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLmRlc3Ryb3lCb21TcGxpdCgpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLnNldEJvbVNwbGl0KG51bGwpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLmRlc3Ryb3lDYW52YXNTcGxpdCgpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLnNldENhbnZhc1NwbGl0KG51bGwpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ2xvYmFsRGF0YS5zZXRMYXllclNwbGl0KFNwbGl0KFtcIiNkYXRhZGl2XCIsIFwiI2xheWVyZGl2XCJdLCB7XHJcbiAgICAgICAgICAgIHNpemVzOiBbODAsIDIwXSxcclxuICAgICAgICAgICAgb25EcmFnRW5kOiByZW5kZXIucmVzaXplQWxsLFxyXG4gICAgICAgICAgICBndXR0ZXJTaXplOiA1LFxyXG4gICAgICAgICAgICBjdXJzb3I6IFwiY29sLXJlc2l6ZVwiXHJcbiAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICBnbG9iYWxEYXRhLnNldEJvbVNwbGl0KFNwbGl0KFtcIiNib21kaXZcIiwgXCIjY2FudmFzZGl2XCJdLCB7XHJcbiAgICAgICAgICAgIGRpcmVjdGlvbjogXCJ2ZXJ0aWNhbFwiLFxyXG4gICAgICAgICAgICBzaXplczogWzUwLCA1MF0sXHJcbiAgICAgICAgICAgIG9uRHJhZ0VuZDogcmVuZGVyLnJlc2l6ZUFsbCxcclxuICAgICAgICAgICAgZ3V0dGVyU2l6ZTogNSxcclxuICAgICAgICAgICAgY3Vyc29yOiBcInJvdy1yZXNpemVcIlxyXG4gICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgZ2xvYmFsRGF0YS5zZXRDYW52YXNTcGxpdChTcGxpdChbXCIjZnJvbnRjYW52YXNcIiwgXCIjYmFja2NhbnZhc1wiXSwge1xyXG4gICAgICAgICAgICBzaXplczogWzUwLCA1MF0sXHJcbiAgICAgICAgICAgIGd1dHRlclNpemU6IDUsXHJcbiAgICAgICAgICAgIG9uRHJhZ0VuZDogcmVuZGVyLnJlc2l6ZUFsbCxcclxuICAgICAgICAgICAgY3Vyc29yOiBcInJvdy1yZXNpemVcIlxyXG4gICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjYW52YXNkaXZcIiAgKS5zdHlsZS5oZWlnaHQgPSBcImNhbGMoMTAwJSAtIDIuNXB4KVwiO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcIlRCXCI6XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib20tdGItYnRuXCIgICAgICkuY2xhc3NMaXN0LmFkZChcImRlcHJlc3NlZFwiKTtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJvbWRpdlwiKS5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImZyb250Y2FudmFzXCIpLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmFja2NhbnZhc1wiICkuc3R5bGUuZGlzcGxheSA9IFwiXCI7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsYXllcmRpdlwiICAgKS5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJvdFwiICAgICAgICApLnN0eWxlLmhlaWdodCA9IFwiY2FsYygxMDAlIC0gODBweClcIjtcclxuXHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkYXRhZGl2XCIgICApLmNsYXNzTGlzdC5hZGQoICAgXCJzcGxpdC1ob3Jpem9udGFsXCIpO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9tZGl2XCIgICAgICkuY2xhc3NMaXN0LnJlbW92ZSggICBcInNwbGl0LWhvcml6b250YWxcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjYW52YXNkaXZcIiAgKS5jbGFzc0xpc3QucmVtb3ZlKCAgIFwic3BsaXQtaG9yaXpvbnRhbFwiKTtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImZyb250Y2FudmFzXCIpLmNsYXNzTGlzdC5hZGQoICAgXCJzcGxpdC1ob3Jpem9udGFsXCIpO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmFja2NhbnZhc1wiICkuY2xhc3NMaXN0LmFkZCggICBcInNwbGl0LWhvcml6b250YWxcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsYXllcmRpdlwiICAgKS5jbGFzc0xpc3QuYWRkKCAgIFwic3BsaXQtaG9yaXpvbnRhbFwiKTtcclxuXHJcblxyXG4gICAgICAgIGlmIChnbG9iYWxEYXRhLmdldEJvbVNwbGl0KCkpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLmRlc3Ryb3lMYXllclNwbGl0KCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuc2V0TGF5ZXJTcGxpdChudWxsKTtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5kZXN0cm95Qm9tU3BsaXQoKTtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5zZXRCb21TcGxpdChudWxsKTtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5kZXN0cm95Q2FudmFzU3BsaXQoKTtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5zZXRDYW52YXNTcGxpdChudWxsKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGdsb2JhbERhdGEuc2V0TGF5ZXJTcGxpdChTcGxpdChbXCIjZGF0YWRpdlwiLCBcIiNsYXllcmRpdlwiXSwge1xyXG4gICAgICAgICAgICBzaXplczogWzgwLCAyMF0sXHJcbiAgICAgICAgICAgIG9uRHJhZ0VuZDogcmVuZGVyLnJlc2l6ZUFsbCxcclxuICAgICAgICAgICAgZ3V0dGVyU2l6ZTogNSxcclxuICAgICAgICAgICAgY3Vyc29yOiBcImNvbC1yZXNpemVcIlxyXG4gICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgZ2xvYmFsRGF0YS5zZXRCb21TcGxpdChTcGxpdChbXCIjYm9tZGl2XCIsIFwiI2NhbnZhc2RpdlwiXSwge1xyXG4gICAgICAgICAgICBkaXJlY3Rpb246IFwidmVydGljYWxcIixcclxuICAgICAgICAgICAgc2l6ZXM6IFs1MCwgNTBdLFxyXG4gICAgICAgICAgICBvbkRyYWdFbmQ6IHJlbmRlci5yZXNpemVBbGwsXHJcbiAgICAgICAgICAgIGd1dHRlclNpemU6IDUsXHJcbiAgICAgICAgICAgIGN1cnNvcjogXCJyb3ctcmVzaXplXCJcclxuICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIGdsb2JhbERhdGEuc2V0Q2FudmFzU3BsaXQoU3BsaXQoW1wiI2Zyb250Y2FudmFzXCIsIFwiI2JhY2tjYW52YXNcIl0sIHtcclxuICAgICAgICAgICAgc2l6ZXM6IFs1MCwgNTBdLFxyXG4gICAgICAgICAgICBndXR0ZXJTaXplOiA1LFxyXG4gICAgICAgICAgICBvbkRyYWdFbmQ6IHJlbmRlci5yZXNpemVBbGwsXHJcbiAgICAgICAgICAgIGN1cnNvcjogXCJyb3ctcmVzaXplXCJcclxuICAgICAgICB9KSk7XHJcblxyXG5cclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJMUlwiOlxyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9tLWxyLWJ0blwiICAgICApLmNsYXNzTGlzdC5hZGQoXCJkZXByZXNzZWRcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib21kaXZcIikuc3R5bGUuZGlzcGxheSA9IFwiXCI7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJmcm9udGNhbnZhc1wiKS5zdHlsZS5kaXNwbGF5ID0gXCJcIjtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJhY2tjYW52YXNcIiApLnN0eWxlLmRpc3BsYXkgPSBcIlwiO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibGF5ZXJkaXZcIiAgICkuc3R5bGUuZGlzcGxheSA9IFwiXCI7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib3RcIiAgICAgICAgKS5zdHlsZS5oZWlnaHQgPSBcImNhbGMoMTAwJSAtIDgwcHgpXCI7XHJcblxyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZGF0YWRpdlwiICAgICkuY2xhc3NMaXN0LmFkZCggICBcInNwbGl0LWhvcml6b250YWxcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib21kaXZcIiAgICAgKS5jbGFzc0xpc3QuYWRkKCAgIFwic3BsaXQtaG9yaXpvbnRhbFwiKTtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNhbnZhc2RpdlwiICApLmNsYXNzTGlzdC5hZGQoICAgXCJzcGxpdC1ob3Jpem9udGFsXCIpO1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZnJvbnRjYW52YXNcIikuY2xhc3NMaXN0LnJlbW92ZSggICBcInNwbGl0LWhvcml6b250YWxcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJiYWNrY2FudmFzXCIgKS5jbGFzc0xpc3QucmVtb3ZlKCAgIFwic3BsaXQtaG9yaXpvbnRhbFwiKTtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxheWVyZGl2XCIgICApLmNsYXNzTGlzdC5hZGQoICAgXCJzcGxpdC1ob3Jpem9udGFsXCIpO1xyXG5cclxuICAgICAgICBpZiAoZ2xvYmFsRGF0YS5nZXRCb21TcGxpdCgpKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgZ2xvYmFsRGF0YS5kZXN0cm95TGF5ZXJTcGxpdCgpO1xyXG4gICAgICAgICAgICBnbG9iYWxEYXRhLnNldExheWVyU3BsaXQobnVsbCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZGVzdHJveUJvbVNwbGl0KCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuc2V0Qm9tU3BsaXQobnVsbCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuZGVzdHJveUNhbnZhc1NwbGl0KCk7XHJcbiAgICAgICAgICAgIGdsb2JhbERhdGEuc2V0Q2FudmFzU3BsaXQobnVsbCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBnbG9iYWxEYXRhLnNldExheWVyU3BsaXQoU3BsaXQoW1wiI2RhdGFkaXZcIiwgXCIjbGF5ZXJkaXZcIl0sIHtcclxuICAgICAgICAgICAgc2l6ZXM6IFs4MCwgMjBdLFxyXG4gICAgICAgICAgICBvbkRyYWdFbmQ6IHJlbmRlci5yZXNpemVBbGwsXHJcbiAgICAgICAgICAgIGd1dHRlclNpemU6IDUsXHJcbiAgICAgICAgICAgIGN1cnNvcjogXCJjb2wtcmVzaXplXCJcclxuICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIGdsb2JhbERhdGEuc2V0Qm9tU3BsaXQoU3BsaXQoW1wiI2JvbWRpdlwiLCBcIiNjYW52YXNkaXZcIl0sIHtcclxuICAgICAgICAgICAgc2l6ZXM6IFs1MCwgNTBdLFxyXG4gICAgICAgICAgICBvbkRyYWdFbmQ6IHJlbmRlci5yZXNpemVBbGwsXHJcbiAgICAgICAgICAgIGd1dHRlclNpemU6IDUsXHJcbiAgICAgICAgICAgIGN1cnNvcjogXCJyb3ctcmVzaXplXCJcclxuICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIGdsb2JhbERhdGEuc2V0Q2FudmFzU3BsaXQoU3BsaXQoW1wiI2Zyb250Y2FudmFzXCIsIFwiI2JhY2tjYW52YXNcIl0sIHtcclxuICAgICAgICAgICAgc2l6ZXM6IFs1MCwgNTBdLFxyXG4gICAgICAgICAgICBkaXJlY3Rpb246IFwidmVydGljYWxcIixcclxuICAgICAgICAgICAgZ3V0dGVyU2l6ZTogNSxcclxuICAgICAgICAgICAgb25EcmFnRW5kOiByZW5kZXIucmVzaXplQWxsLFxyXG4gICAgICAgICAgICBjdXJzb3I6IFwicm93LXJlc2l6ZVwiXHJcbiAgICAgICAgfSkpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgZ2xvYmFsRGF0YS5zZXRCb21MYXlvdXQobGF5b3V0KTtcclxuICAgIGdsb2JhbERhdGEud3JpdGVTdG9yYWdlKFwiYm9tbGF5b3V0XCIsIGxheW91dCk7XHJcbiAgICBjaGFuZ2VDYW52YXNMYXlvdXQoZ2xvYmFsRGF0YS5nZXRDYW52YXNMYXlvdXQoKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZvY3VzSW5wdXRGaWVsZChpbnB1dClcclxue1xyXG4gICAgaW5wdXQuc2Nyb2xsSW50b1ZpZXcoZmFsc2UpO1xyXG4gICAgaW5wdXQuZm9jdXMoKTtcclxuICAgIGlucHV0LnNlbGVjdCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb2N1c0JPTUZpbHRlckZpZWxkKClcclxue1xyXG4gICAgZm9jdXNJbnB1dEZpZWxkKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9tLWZpbHRlclwiKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRvZ2dsZUJvbUNoZWNrYm94KGJvbXJvd2lkLCBjaGVja2JveG51bSlcclxue1xyXG4gICAgaWYgKCFib21yb3dpZCB8fCBjaGVja2JveG51bSA+IGdsb2JhbERhdGEuZ2V0Q2hlY2tib3hlcygpLmxlbmd0aClcclxuICAgIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBsZXQgYm9tcm93ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYm9tcm93aWQpO1xyXG4gICAgbGV0IGNoZWNrYm94ID0gYm9tcm93LmNoaWxkTm9kZXNbY2hlY2tib3hudW1dLmNoaWxkTm9kZXNbMF07XHJcbiAgICBjaGVja2JveC5jaGVja2VkID0gIWNoZWNrYm94LmNoZWNrZWQ7XHJcbiAgICBjaGVja2JveC5pbmRldGVybWluYXRlID0gZmFsc2U7XHJcbiAgICBjaGVja2JveC5vbmNoYW5nZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBJc0NoZWNrYm94Q2xpY2tlZChib21yb3dpZCwgY2hlY2tib3huYW1lKSBcclxue1xyXG4gICAgbGV0IGNoZWNrYm94bnVtID0gMDtcclxuICAgIHdoaWxlIChjaGVja2JveG51bSA8IGdsb2JhbERhdGEuZ2V0Q2hlY2tib3hlcygpLmxlbmd0aCAmJiBnbG9iYWxEYXRhLmdldENoZWNrYm94ZXMoKVtjaGVja2JveG51bV0udG9Mb3dlckNhc2UoKSAhPSBjaGVja2JveG5hbWUudG9Mb3dlckNhc2UoKSkgXHJcbiAgICB7XHJcbiAgICAgICAgY2hlY2tib3hudW0rKztcclxuICAgIH1cclxuICAgIGlmICghYm9tcm93aWQgfHwgY2hlY2tib3hudW0gPj0gZ2xvYmFsRGF0YS5nZXRDaGVja2JveGVzKCkubGVuZ3RoKSBcclxuICAgIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBsZXQgYm9tcm93ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYm9tcm93aWQpO1xyXG4gICAgbGV0IGNoZWNrYm94ID0gYm9tcm93LmNoaWxkTm9kZXNbY2hlY2tib3hudW0gKyAxXS5jaGlsZE5vZGVzWzBdO1xyXG4gICAgcmV0dXJuIGNoZWNrYm94LmNoZWNrZWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbW92ZUd1dHRlck5vZGUobm9kZSlcclxue1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspXHJcbiAgICB7XHJcbiAgICAgICAgaWYgKCAgICAobm9kZS5jaGlsZE5vZGVzW2ldLmNsYXNzTGlzdCApXHJcbiAgICAgICAgICAgICAmJiAobm9kZS5jaGlsZE5vZGVzW2ldLmNsYXNzTGlzdC5jb250YWlucyhcImd1dHRlclwiKSkgXHJcbiAgICAgICAgKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgbm9kZS5yZW1vdmVDaGlsZChub2RlLmNoaWxkTm9kZXNbaV0pO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNsZWFuR3V0dGVycygpXHJcbntcclxuICAgIHJlbW92ZUd1dHRlck5vZGUoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib3RcIikpO1xyXG4gICAgcmVtb3ZlR3V0dGVyTm9kZShkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImNhbnZhc2RpdlwiKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldEJvbUNoZWNrYm94ZXModmFsdWUpXHJcbntcclxuICAgIGdsb2JhbERhdGEuc2V0Qm9tQ2hlY2tib3hlcyh2YWx1ZSk7XHJcbiAgICBnbG9iYWxEYXRhLndyaXRlU3RvcmFnZShcImJvbUNoZWNrYm94ZXNcIiwgdmFsdWUpO1xyXG4gICAgcG9wdWxhdGVCb21UYWJsZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRSZW1vdmVCT01FbnRyaWVzKHZhbHVlKVxyXG57XHJcbiAgICBnbG9iYWxEYXRhLnNldFJlbW92ZUJPTUVudHJpZXModmFsdWUpO1xyXG4gICAgZ2xvYmFsRGF0YS53cml0ZVN0b3JhZ2UoXCJyZW1vdmVCT01FbnRyaWVzXCIsIHZhbHVlKTtcclxuICAgIHBvcHVsYXRlQm9tVGFibGUoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2V0QWRkaXRpb25hbEF0dHJpYnV0ZXModmFsdWUpXHJcbntcclxuICAgIGdsb2JhbERhdGEuc2V0QWRkaXRpb25hbEF0dHJpYnV0ZXModmFsdWUpO1xyXG4gICAgZ2xvYmFsRGF0YS53cml0ZVN0b3JhZ2UoXCJhZGRpdGlvbmFsQXR0cmlidXRlc1wiLCB2YWx1ZSk7XHJcbiAgICBwb3B1bGF0ZUJvbVRhYmxlKCk7XHJcbn1cclxuXHJcbi8vIFhYWDogTm9uZSBvZiB0aGlzIHNlZW1zIHRvIGJlIHdvcmtpbmcuIFxyXG5kb2N1bWVudC5vbmtleWRvd24gPSBmdW5jdGlvbihlKVxyXG57XHJcbiAgICBzd2l0Y2ggKGUua2V5KVxyXG4gICAge1xyXG4gICAgY2FzZSBcIm5cIjpcclxuICAgICAgICBpZiAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudC50eXBlID09IFwidGV4dFwiKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZ2xvYmFsRGF0YS5nZXRDdXJyZW50SGlnaGxpZ2h0ZWRSb3dJZCgpICE9PSBudWxsKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgLy8gWFhYOiBXaHkgd2FzIHRoZSBmb2xsb3dpbmcgbGluZSBpbiB0aGUgc29mdHdhcmVcclxuICAgICAgICAgICAgLy9jaGVja0JvbUNoZWNrYm94KGdsb2JhbERhdGEuZ2V0Q3VycmVudEhpZ2hsaWdodGVkUm93SWQoKSwgXCJwbGFjZWRcIik7XHJcbiAgICAgICAgICAgIGhpZ2hsaWdodE5leHRSb3coKTtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgXCJBcnJvd1VwXCI6XHJcbiAgICAgICAgaGlnaGxpZ2h0UHJldmlvdXNSb3coKTtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlIFwiQXJyb3dEb3duXCI6XHJcbiAgICAgICAgaGlnaGxpZ2h0TmV4dFJvdygpO1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBicmVhaztcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGUuYWx0S2V5KVxyXG4gICAge1xyXG4gICAgICAgIHN3aXRjaCAoZS5rZXkpXHJcbiAgICAgICAge1xyXG4gICAgICAgIGNhc2UgXCJmXCI6XHJcbiAgICAgICAgICAgIGZvY3VzQk9NRmlsdGVyRmllbGQoKTtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFwielwiOlxyXG4gICAgICAgICAgICBjaGFuZ2VCb21MYXlvdXQoXCJCT01cIik7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcInhcIjpcclxuICAgICAgICAgICAgY2hhbmdlQm9tTGF5b3V0KFwiTFJcIik7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcImNcIjpcclxuICAgICAgICAgICAgY2hhbmdlQm9tTGF5b3V0KFwiVEJcIik7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBcInZcIjpcclxuICAgICAgICAgICAgY2hhbmdlQ2FudmFzTGF5b3V0KFwiRlwiKTtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFwiYlwiOlxyXG4gICAgICAgICAgICBjaGFuZ2VDYW52YXNMYXlvdXQoXCJGQlwiKTtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFwiblwiOlxyXG4gICAgICAgICAgICBjaGFuZ2VDYW52YXNMYXlvdXQoXCJCXCIpO1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbi8vWFhYOiBJIHdvdWxkIGxpa2UgdGhpcyB0byBiZSBpbiB0aGUgaHRtbCBmdW5jdGlvbnMganMgZmlsZS4gQnV0IHRoaXMgZnVuY3Rpb24gbmVlZHMgdG8gYmUgXHJcbi8vICAgICBwbGFjZWQgaGVyZSwgb3RoZXJ3aXNlIHRoZSBhcHBsaWNhdGlvbiByZW5kZXJpbmcgYmVjb21lcyB2ZXJ5IHZlcnkgd2VpcmQuXHJcbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbihlKVxyXG57XHJcbiAgICBjb25zb2xlLnRpbWUoXCJvbiBsb2FkXCIpO1xyXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBtYWtlcyBzbyB0aGF0IHRoZSB1c2VyIGRhdGEgZm9yIHRoZSBwY2IgaXMgY29udmVydGVkIHRvIG91ciBpbnRlcm5hbCBzdHJ1Y3R1cmVcclxuICAgIHBjYi5PcGVuUGNiRGF0YShwY2JkYXRhKVxyXG5cclxuXHJcbiAgICAvLyBDcmVhdGUgY2FudmFzIGxheWVycy4gT25lIGNhbnZhcyBwZXIgcGNiIGxheWVyXHJcblxyXG4gICAgZ2xvYmFsRGF0YS5pbml0U3RvcmFnZSgpO1xyXG4gICAgY2xlYW5HdXR0ZXJzKCk7XHJcbiAgICAvLyBNdXN0IGJlIGNhbGxlZCBhZnRlciBsb2FkaW5nIFBDQiBhcyByZW5kZXJpbmcgcmVxdWlyZWQgdGhlIGJvdW5kaW5nIGJveCBpbmZvcm1hdGlvbiBmb3IgUENCXHJcbiAgICByZW5kZXIuaW5pdFJlbmRlcigpO1xyXG5cclxuICAgIC8vIFNldCB1cCBtb3VzZSBldmVudCBoYW5kbGVyc1xyXG4gICAgaGFuZGxlcnNfbW91c2UuYWRkTW91c2VIYW5kbGVycyhkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImZyb250Y2FudmFzXCIpLCBnbG9iYWxEYXRhLkdldEFsbENhbnZhcygpLmZyb250KTtcclxuICAgIGhhbmRsZXJzX21vdXNlLmFkZE1vdXNlSGFuZGxlcnMoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJiYWNrY2FudmFzXCIpLCBnbG9iYWxEYXRhLkdldEFsbENhbnZhcygpLmJhY2spO1xyXG5cclxuXHJcbiAgICBib20gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJvbWJvZHlcIik7XHJcbiAgICBsYXllckJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxheWVyYm9keVwiKTtcclxuICAgIGxheWVySGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibGF5ZXJoZWFkXCIpO1xyXG4gICAgYm9taGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9taGVhZFwiKTtcclxuICAgIGdsb2JhbERhdGEuc2V0Qm9tTGF5b3V0KGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoXCJib21sYXlvdXRcIikpO1xyXG4gICAgaWYgKCFnbG9iYWxEYXRhLmdldEJvbUxheW91dCgpKVxyXG4gICAge1xyXG4gICAgICAgIGdsb2JhbERhdGEuc2V0Qm9tTGF5b3V0KFwiTFJcIik7XHJcbiAgICB9XHJcbiAgICBnbG9iYWxEYXRhLnNldENhbnZhc0xheW91dChnbG9iYWxEYXRhLnJlYWRTdG9yYWdlKFwiY2FudmFzbGF5b3V0XCIpKTtcclxuICAgIGlmICghZ2xvYmFsRGF0YS5nZXRDYW52YXNMYXlvdXQoKSlcclxuICAgIHtcclxuICAgICAgICBnbG9iYWxEYXRhLnNldENhbnZhc0xheW91dChcIkZCXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHBvcHVsYXRlTGF5ZXJUYWJsZSgpO1xyXG5cclxuICAgIHBvcHVsYXRlTWV0YWRhdGEoKTtcclxuICAgIGdsb2JhbERhdGEuc2V0Qm9tQ2hlY2tib3hlcyhnbG9iYWxEYXRhLnJlYWRTdG9yYWdlKFwiYm9tQ2hlY2tib3hlc1wiKSk7XHJcbiAgICBpZiAoZ2xvYmFsRGF0YS5nZXRCb21DaGVja2JveGVzKCkgPT09IG51bGwpXHJcbiAgICB7XHJcbiAgICAgICAgZ2xvYmFsRGF0YS5zZXRCb21DaGVja2JveGVzKFwiUGxhY2VkXCIpO1xyXG4gICAgfVxyXG4gICAgZ2xvYmFsRGF0YS5zZXRSZW1vdmVCT01FbnRyaWVzKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoXCJyZW1vdmVCT01FbnRyaWVzXCIpKTtcclxuICAgIGlmIChnbG9iYWxEYXRhLmdldFJlbW92ZUJPTUVudHJpZXMoKSA9PT0gbnVsbClcclxuICAgIHtcclxuICAgICAgICBnbG9iYWxEYXRhLnNldFJlbW92ZUJPTUVudHJpZXMoXCJcIik7XHJcbiAgICB9XHJcbiAgICBnbG9iYWxEYXRhLnNldEFkZGl0aW9uYWxBdHRyaWJ1dGVzKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoXCJhZGRpdGlvbmFsQXR0cmlidXRlc1wiKSk7XHJcbiAgICBpZiAoZ2xvYmFsRGF0YS5nZXRBZGRpdGlvbmFsQXR0cmlidXRlcygpID09PSBudWxsKVxyXG4gICAge1xyXG4gICAgICAgIGdsb2JhbERhdGEuc2V0QWRkaXRpb25hbEF0dHJpYnV0ZXMoXCJcIik7XHJcbiAgICB9XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJvbUNoZWNrYm94ZXNcIikudmFsdWUgPSBnbG9iYWxEYXRhLmdldEJvbUNoZWNrYm94ZXMoKTtcclxuICAgIGlmIChnbG9iYWxEYXRhLnJlYWRTdG9yYWdlKFwic2lsa3NjcmVlblZpc2libGVcIikgPT09IFwiZmFsc2VcIilcclxuICAgIHtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNpbGtzY3JlZW5DaGVja2JveFwiKS5jaGVja2VkID0gZmFsc2U7XHJcbiAgICAgICAgc2lsa3NjcmVlblZpc2libGUoZmFsc2UpO1xyXG4gICAgfVxyXG4gICAgaWYgKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoXCJyZWRyYXdPbkRyYWdcIikgPT09IFwiZmFsc2VcIilcclxuICAgIHtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImRyYWdDaGVja2JveFwiKS5jaGVja2VkID0gZmFsc2U7XHJcbiAgICAgICAgZ2xvYmFsRGF0YS5zZXRSZWRyYXdPbkRyYWcoZmFsc2UpO1xyXG4gICAgfVxyXG4gICAgaWYgKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoXCJkYXJrbW9kZVwiKSA9PT0gXCJ0cnVlXCIpXHJcbiAgICB7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkYXJrbW9kZUNoZWNrYm94XCIpLmNoZWNrZWQgPSB0cnVlO1xyXG4gICAgICAgIHNldERhcmtNb2RlKHRydWUpO1xyXG4gICAgfVxyXG4gICAgaWYgKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoXCJoaWRlUGxhY2VkUGFydHNcIikgPT09IFwidHJ1ZVwiKVxyXG4gICAge1xyXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaGlkZVBsYWNlZFBhcnRzXCIpLmNoZWNrZWQgPSB0cnVlO1xyXG4gICAgICAgIGdsb2JhbERhdGEuc2V0SGlkZVBsYWNlZFBhcnRzKHRydWUpO1xyXG4gICAgfVxyXG4gICAgaWYgKGdsb2JhbERhdGEucmVhZFN0b3JhZ2UoXCJoaWdobGlnaHRwaW4xXCIpID09PSBcInRydWVcIilcclxuICAgIHtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImhpZ2hsaWdodHBpbjFDaGVja2JveFwiKS5jaGVja2VkID0gdHJ1ZTtcclxuICAgICAgICBnbG9iYWxEYXRhLnNldEhpZ2hsaWdodFBpbjEodHJ1ZSk7XHJcbiAgICAgICAgcmVuZGVyLmRyYXdDYW52YXMoZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5mcm9udCk7XHJcbiAgICAgICAgcmVuZGVyLmRyYXdDYW52YXMoZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5iYWNrKTtcclxuICAgIH1cclxuICAgIC8vIElmIHRoaXMgaXMgdHJ1ZSB0aGVuIGNvbWJpbmUgcGFydHMgYW5kIGRpc3BsYXkgcXVhbnRpdHlcclxuICAgIGlmIChnbG9iYWxEYXRhLnJlYWRTdG9yYWdlKFwiY29tYmluZVZhbHVlc1wiKSA9PT0gXCJ0cnVlXCIpXHJcbiAgICB7XHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjb21iaW5lVmFsdWVzXCIpLmNoZWNrZWQgPSB0cnVlO1xyXG4gICAgICAgIGdsb2JhbERhdGEuc2V0Q29tYmluZVZhbHVlcyh0cnVlKTtcclxuICAgIH1cclxuICAgIGlmIChnbG9iYWxEYXRhLnJlYWRTdG9yYWdlKFwiZGVidWdNb2RlXCIpID09PSBcInRydWVcIilcclxuICAgIHtcclxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImRlYnVnTW9kZVwiKS5jaGVja2VkID0gdHJ1ZTtcclxuICAgICAgICBnbG9iYWxEYXRhLnNldERlYnVnTW9kZSh0cnVlKTtcclxuICAgIH1cclxuICAgIC8vIFJlYWQgdGhlIHZhbHVlIG9mIGJvYXJkIHJvdGF0aW9uIGZyb20gbG9jYWwgc3RvcmFnZVxyXG4gICAgbGV0IGJvYXJkUm90YXRpb24gPSBnbG9iYWxEYXRhLnJlYWRTdG9yYWdlKFwiYm9hcmRSb3RhdGlvblwiKTtcclxuICAgIC8qXHJcbiAgICAgIEFkanVzdGVkIHRvIG1hdGNoIGhvdyB0aGUgdXBkYXRlIHJvdGF0aW9uIGFuZ2xlIGlzIGNhbGN1bGF0ZWQuXHJcbiAgICBcclxuICAgICAgICBJZiBudWxsLCB0aGVuIGFuZ2xlIG5vdCBpbiBsb2NhbCBzdG9yYWdlLCBzZXQgdG8gMTgwIGRlZ3JlZXMuXHJcbiAgICAgICovXHJcbiAgICBpZiAoYm9hcmRSb3RhdGlvbiA9PT0gbnVsbClcclxuICAgIHtcclxuICAgICAgICBib2FyZFJvdGF0aW9uID0gMTgwO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIGJvYXJkUm90YXRpb24gPSBwYXJzZUludChib2FyZFJvdGF0aW9uKTtcclxuICAgIH1cclxuICAgIC8vIFNldCBpbnRlcm5hbCBnbG9iYWwgdmFyaWFibGUgZm9yIGJvYXJkIHJvdGF0aW9uLlxyXG4gICAgZ2xvYmFsRGF0YS5TZXRCb2FyZFJvdGF0aW9uKGJvYXJkUm90YXRpb24pO1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJib2FyZFJvdGF0aW9uXCIpLnZhbHVlID0gKGJvYXJkUm90YXRpb24tMTgwKSAvIDU7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInJvdGF0aW9uRGVncmVlXCIpLnRleHRDb250ZW50ID0gKGJvYXJkUm90YXRpb24tMTgwKTtcclxuXHJcbiAgICAvLyBUcmlnZ2VycyByZW5kZXJcclxuICAgIGNoYW5nZUJvbUxheW91dChnbG9iYWxEYXRhLmdldEJvbUxheW91dCgpKTtcclxuICAgIGNvbnNvbGUudGltZUVuZChcIm9uIGxvYWRcIik7XHJcbn07XHJcblxyXG53aW5kb3cub25yZXNpemUgPSByZW5kZXIucmVzaXplQWxsO1xyXG53aW5kb3cubWF0Y2hNZWRpYShcInByaW50XCIpLmFkZExpc3RlbmVyKHJlbmRlci5yZXNpemVBbGwpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBzZXREYXJrTW9kZSAgICAgICAgLCBzaWxrc2NyZWVuVmlzaWJsZSAgICAgICwgY2hhbmdlQm9tTGF5b3V0LCBjaGFuZ2VDYW52YXNMYXlvdXQsXHJcbiAgICBzZXRCb21DaGVja2JveGVzICAgLCBwb3B1bGF0ZUJvbVRhYmxlICAgICAgICwgc2V0RmlsdGVyQk9NICAgLCBnZXRGaWx0ZXJCT00gICAgICAsXHJcbiAgICBzZXRGaWx0ZXJMYXllciAgICAgLCBnZXRGaWx0ZXJMYXllciAgICAgICAgICwgc2V0UmVtb3ZlQk9NRW50cmllcywgc2V0QWRkaXRpb25hbEF0dHJpYnV0ZXNcclxufTtcclxuIiwiLypcclxuICAgIFRoaXMgZmlsZSBjb250YWlucyBhbGwgb2YgdGhlIGRlZmluaXRpb25zIGZvciB3b3JraW5nIHdpdGggcGNiZGF0YS5qc29uLiBcclxuICAgIFRoaXMgZmlsZSBkZWNsYXJlcyBhbGwgb2YgdGhlIGFjY2VzcyBmdW5jdGlvbnMgYW5kIGludGVyZmFjZXMgZm9yIGNvbnZlcnRpbmcgXHJcbiAgICB0aGUganNvbiBmaWxlIGludG8gYW4gaW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmUuIFxyXG4qL1xyXG5cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUENCIFBhcnQgSW50ZXJmYWNlc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuLy8gUmVhZCB0aGUgZWNhZCBwcm9wZXJ0eS4gVGhpcyBwcm9wZXJ0eSBsZXRzIHRoZSBhcHBsaWNhdGlvbiBrbm93IHdoYXQgXHJcbi8vIGVjYWQgc29mdHdhcmUgZ2VuZXJhdGVkIHRoZSBqc29uIGZpbGUuIFxyXG5mdW5jdGlvbiBHZXRDQURUeXBlKHBjYmRhdGFTdHJ1Y3R1cmUpXHJcbntcclxuICAgIGlmKHBjYmRhdGFTdHJ1Y3R1cmUuaGFzT3duUHJvcGVydHkoXCJlY2FkXCIpKVxyXG4gICAge1xyXG4gICAgICAgIHJldHVybiBwY2JkYXRhU3RydWN0dXJlLmVjYWQ7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIFRoaXMgd2lsbCBob2xkIHRoZSBwYXJ0IG9iamVjdHMuIFRoZXJlIGlzIG9uZSBlbnRyeSBwZXIgcGFydFxyXG4vLyBGb3JtYXQgb2YgYSBwYXJ0IGlzIGFzIGZvbGxvd3NcclxuLy8gW1ZBTFVFLFBBQ0tBR0UsUkVGUkVORUNFIERFU0lHTkFUT1IsICxMT0NBVElPTiwgQVRUUklCVVRFXSxcclxuLy8gd2hlcmUgQVRUUklCVVRFIGlzIGEgZGljdCBvZiBBVFRSSUJVVEUgTkFNRSA6IEFUVFJJQlVURSBWQUxVRVxyXG5sZXQgQk9NID0gW107XHJcblxyXG4vLyBDb25zdHJ1Y3RvciBmb3IgY3JlYXRpbmcgYSBwYXJ0LlxyXG5mdW5jdGlvbiBQYXJ0KHZhbHVlLCBmb290cHJpbnQsIHJlZmVyZW5jZSwgbG9jYXRpb24sIGF0dHJpYnV0ZXMsIGNoZWNrYm94ZXMpXHJcbntcclxuICAgIHRoaXMucXVhbnRpdHkgICA9IDE7XHJcbiAgICB0aGlzLnZhbHVlICAgICAgPSB2YWx1ZTtcclxuICAgIHRoaXMuZm9vcnB0aW50ICA9IGZvb3RwcmludDtcclxuICAgIHRoaXMucmVmZXJlbmNlICA9IHJlZmVyZW5jZTtcclxuICAgIHRoaXMubG9jYXRpb24gICA9IGxvY2F0aW9uO1xyXG4gICAgdGhpcy5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcclxuICAgIHRoaXMuY2hlY2tib3hlcyA9IGNoZWNrYm94ZXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIENvcHlQYXJ0KGlucHV0UGFydClcclxue1xyXG4gICAgLy8gWFhYOiBUaGlzIGlzIG5vdCBwZXJmb3JtaW5nIGEgZGVlcCBjb3B5LCBhdHRyaWJ1dGVzIGlzIGEgbWFwIGFuZCB0aGlzIGlzIGJlaW5nIGNvcGllZCBieSBcclxuICAgIC8vICAgICAgcmVmZXJlbmNlIHdoaWNoIGlzIG5vdCBxdWl0ZSB3aGF0IHdlIHdhbnQgaGVyZS4gSXQgc2hvdWxkIGJlIGEgZGVlcCBjb3B5IHNvIG9uY2UgY2FsbGVkXHJcbiAgICAvLyAgICAgIHRoaXMgd2lsbCByZXN1bHQgaW4gYSBjb21wbGV0ZWx5IG5ldyBvYmplY3QgdGhhdCB3aWxsIG5vdCByZWZlcmVuY2Ugb25lIGFub3RoZXJcclxuICAgIHJldHVybiBuZXcgUGFydChpbnB1dFBhcnQudmFsdWUsIGlucHV0UGFydC5wYWNrYWdlLCBpbnB1dFBhcnQucmVmZXJlbmNlLCBpbnB1dFBhcnQubG9jYXRpb24sIGlucHV0UGFydC5hdHRyaWJ1dGVzLCBpbnB1dFBhcnQuY2hlY2tib3hlcyk7XHJcbn1cclxuXHJcbi8vVE9ETzogVGhlcmUgc2hvdWxkIGJlIHN0ZXBzIGhlcmUgZm9yIHZhbGlkYXRpbmcgdGhlIGRhdGEgYW5kIHB1dHRpbmcgaXQgaW50byBhIFxyXG4vLyAgICAgIGZvcm1hdCB0aGF0IGlzIHZhbGlkIGZvciBvdXIgYXBwbGljYXRpb25cclxuZnVuY3Rpb24gQ3JlYXRlQk9NKHBjYmRhdGFTdHJ1Y3R1cmUpXHJcbntcclxuICAgIC8vIEZvciBldmVyeSBwYXJ0IGluIHRoZSBpbnB1dCBmaWxlLCBjb252ZXJ0IGl0IHRvIG91ciBpbnRlcm5hbCBcclxuICAgIC8vIHJlcHJlc2VudGF0aW9uIGRhdGEgc3RydWN0dXJlLlxyXG4gICAgZm9yKGxldCBwYXJ0IG9mIHBjYmRhdGFTdHJ1Y3R1cmUucGFydHMpXHJcbiAgICB7XHJcbiAgICAgICAgLy8gZXh0cmFjdCB0aGUgcGFydCBkYXRhLiBUaGlzIGlzIGhlcmUgc28gSSBjYW4gaXRlcmF0ZSB0aGUgZGVzaWduIFxyXG4gICAgICAgIC8vIHdoZW4gSSBtYWtlIGNoYW5nZXMgdG8gdGhlIHVuZGVybHlpbmcganNvbiBmaWxlLlxyXG4gICAgICAgIGxldCB2YWx1ZSAgICAgPSBwYXJ0LnZhbHVlO1xyXG4gICAgICAgIGxldCBmb290cHJpbnQgPSBcIlwiO1xyXG4gICAgICAgIGxldCByZWZlcmVuY2UgPSBwYXJ0Lm5hbWU7XHJcbiAgICAgICAgbGV0IGxvY2F0aW9uICA9IHBhcnQubG9jYXRpb247XHJcblxyXG4gICAgICAgIC8vIEF0dHJpYnV0ZU5hbWUgYW5kIEF0dHJpYnV0ZVZhbHVlIGFyZSB0d28gc3RyaW5ncyB0aGF0IGFyZSBkZWxpbWluYXRlZCBieSAnOycuIFxyXG4gICAgICAgIC8vIFNwbGl0IHRoZSBzdHJpbmdzIGJ5ICc7JyBhbmQgdGhlbiB6aXAgdGhlbSB0b2dldGhlclxyXG4gICAgICAgIGxldCBhdHRyaWJ1dGVOYW1lcyAgPSBwYXJ0LmF0dHJpYnV0ZXMubmFtZS5zcGxpdChcIjtcIik7XHJcbiAgICAgICAgbGV0IGF0dHJpYnV0ZVZhbHVlcyA9IHBhcnQuYXR0cmlidXRlcy52YWx1ZS5zcGxpdChcIjtcIik7XHJcblxyXG4gICAgICAgIGxldCBjaGVja2JveGVzID0gbmV3IE1hcCgpO1xyXG5cclxuICAgICAgICAvL1hYWDogQVNTVU1USU9OIHRoYXQgYXR0cmlidXRlTmFtZXMgaXMgdGhlIHNhbWUgbGVuZ3RoIGFzIGF0dHJpYnV0ZVZhbHVlc1xyXG4gICAgICAgIGxldCBhdHRyaWJ1dGVzID0gbmV3IE1hcCgpOyAvLyBDcmVhdGUgYSBlbXB0eSBkaWN0aW9uYXJ5XHJcbiAgICAgICAgZm9yKGxldCBpIGluIGF0dHJpYnV0ZU5hbWVzKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgYXR0cmlidXRlcy5zZXQoYXR0cmlidXRlTmFtZXNbaV0udG9Mb3dlckNhc2UoKSxhdHRyaWJ1dGVWYWx1ZXNbaV0udG9Mb3dlckNhc2UoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIEFkZCB0aGUgcGFyIHRvIHRoZSBnbG9iYWwgcGFydCBhcnJheVxyXG4gICAgICAgIEJPTS5wdXNoKG5ldyBQYXJ0KHZhbHVlLCBmb290cHJpbnQsIHJlZmVyZW5jZSwgbG9jYXRpb24sIGF0dHJpYnV0ZXMsIGNoZWNrYm94ZXMpKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gR2V0Qk9NKClcclxue1xyXG4gICAgcmV0dXJuIEJPTTtcclxufVxyXG5cclxuLy8gVEFrZXMgYSBCT00gdGFibGUgYW5kIGEgZmlsdGVyIGZ1bmN0aW9uLiBUaGUgZmlsdGVyIFxyXG4vLyBmdW5jdGlvbiBpcyB1c2VkIG9udGhlIHByb3ZpZGVkIHRhYmxlIHRvIHJlbW92ZSBcclxuLy8gYW55IHBhcnQgdGhhdCBzYXRpc2Z5IHRoZSBmaWx0ZXJcclxuZnVuY3Rpb24gZmlsdGVyQk9NVGFibGUoYm9tdGFibGUsIGZpbHRlckZ1bmN0aW9uKVxyXG57XHJcbiAgICBsZXQgcmVzdWx0ID0gW107XHJcblxyXG4gICAgLy8gTWFrZXMgc3VyZSB0aGF0IHRoRSBmaWx0ZXIgZnVuY3Rpb24gaXMgZGVmaW5lZC4gXHJcbiAgICAvLyBpZiBub3QgZGVmaW5lZCB0aGVuIG5vdGhpbmcgc2hvdWxkIGJlIGZpbHRlcmVkLiBcclxuICAgIGlmKGZpbHRlckZ1bmN0aW9uICE9IG51bGwpXHJcbiAgICB7XHJcbiAgICAgICAgZm9yKGxldCBpIGluIGJvbXRhYmxlKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgLy8gSWYgdGhlIGZpbHRlciByZXR1cm5zIGZhbHNlIC0+IGRvIG5vdCByZW1vdmUgcGFydCwgaXQgZG9lcyBub3QgbmVlZCB0byBiZSBmaWx0ZXJlZFxyXG4gICAgICAgICAgICBpZighZmlsdGVyRnVuY3Rpb24oYm9tdGFibGVbaV0pKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChDb3B5UGFydChib210YWJsZVtpXSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIHJlc3VsdCA9IGJvbXRhYmxlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuLy8gVGFrZXMgYSBib20gdGFibGUgYW5kIGNvbWJpbmVzIGVudHJpZXMgdGhhdCBhcmUgdGhlIHNhbWVcclxuZnVuY3Rpb24gR2V0Qk9NQ29tYmluZWRWYWx1ZXMoYm9tdGFibGVUZW1wKVxyXG57XHJcbiAgICBsZXQgcmVzdWx0ID0gW107XHJcblxyXG4gICAgLy8gVE9ETzogc29ydCBib210YWJsZVRlbXAuIEFzc3VtcHRpb24gaGVyZSBpcyB0aGF0IHRoZSBib210YWJsZVRlbXAgaXMgcHJlc29ydGVkXHJcblxyXG4gICAgaWYoYm9tdGFibGVUZW1wLmxlbmd0aD4wKVxyXG4gICAge1xyXG4gICAgICAgIC8vIFhYWDogQXNzdW1pbmcgdGhhdCB0aGUgaW5wdXQganNvbiBkYXRhIGhhcyBib20gZW50cmllcyBwcmVzb3J0ZWRcclxuICAgICAgICAvLyBUT0RPOiBTdGFydCBhdCBpbmRleCAxLCBhbmQgY29tcGFyZSB0aGUgY3VycmVudCB0byB0aGUgbGFzdCwgdGhpcyBzaG91bGQgc2ltcGxpZnkgdGhlIGxvZ2ljXHJcbiAgICAgICAgLy8gTmVlZCB0byBjcmVhdGUgYSBuZXcgb2JqZWN0IGJ5IGRlZXAgY29weS4gdGhpcyBpcyBiZWNhdXNlIG9iamVjdHMgYnkgZGVmYXVsdCBhcmUgcGFzc2VkIGJ5IHJlZmVyZW5jZSBhbmQgaSBkb250IFxyXG4gICAgICAgIC8vIHdhbnQgdG8gbW9kaWZ5IHRoZW0uXHJcbiAgICAgICAgcmVzdWx0LnB1c2goQ29weVBhcnQoYm9tdGFibGVUZW1wWzBdKSk7XHJcbiAgICAgICAgbGV0IGNvdW50ID0gMDtcclxuICAgICAgICBmb3IgKGxldCBuID0gMTsgbiA8IGJvbXRhYmxlVGVtcC5sZW5ndGg7bisrKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaWYocmVzdWx0W2NvdW50XS52YWx1ZSA9PSBib210YWJsZVRlbXBbbl0udmFsdWUpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIC8vIEZvciBwYXJ0cyB0aGF0IGFyZSBsaXN0ZWQgYXMgY29tYmluZWQsIHN0b3JlIHRoZSByZWZlcmVuY2VzIGFzIGFuIGFycmF5LlxyXG4gICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBiZWNhdXNlIHRoZSBsb2dpYyBmb3IgaGlnaGxpZ2h0aW5nIG5lZWRzIHRvIG1hdGNoIHN0cmluZ3MgYW5kIFxyXG4gICAgICAgICAgICAgICAgLy8gSWYgYW4gYXBwZW5kZWQgc3RyaW5nIGlzIHVzZWQgaXQgbWlnaHQgbm90IHdvcmsgcmlnaHRcclxuICAgICAgICAgICAgICAgIGxldCByZWZTdHJpbmcgPSByZXN1bHRbY291bnRdLnJlZmVyZW5jZSArIFwiLFwiICsgYm9tdGFibGVUZW1wW25dLnJlZmVyZW5jZTtcclxuICAgICAgICAgICAgICAgIHJlc3VsdFtjb3VudF0ucXVhbnRpdHkgKz0gMTtcclxuICAgICAgICAgICAgICAgIHJlc3VsdFtjb3VudF0ucmVmZXJlbmNlID0gcmVmU3RyaW5nO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goQ29weVBhcnQoYm9tdGFibGVUZW1wW25dKSk7XHJcbiAgICAgICAgICAgICAgICBjb3VudCsrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0QXR0cmlidXRlVmFsdWUocGFydCwgYXR0cmlidXRlVG9Mb29rdXApXHJcbntcclxuICAgIGxldCBhdHRyaWJ1dGVzID0gcGFydC5hdHRyaWJ1dGVzO1xyXG4gICAgbGV0IHJlc3VsdCA9IFwiXCI7XHJcblxyXG4gICAgaWYoYXR0cmlidXRlVG9Mb29rdXAgPT0gXCJuYW1lXCIpXHJcbiAgICB7XHJcbiAgICAgICAgcmVzdWx0ID0gcGFydC5yZWZlcmVuY2U7XHJcbiAgICB9XHJcbiAgICBlbHNlXHJcbiAgICB7XHJcbiAgICAgICAgcmVzdWx0ID0gKGF0dHJpYnV0ZXMuaGFzKGF0dHJpYnV0ZVRvTG9va3VwKSA/IGF0dHJpYnV0ZXMuZ2V0KGF0dHJpYnV0ZVRvTG9va3VwKSA6IFwiXCIpO1xyXG4gICAgfVxyXG4gICAgLy8gQ2hlY2sgdGhhdCB0aGUgYXR0cmlidXRlIGV4aXN0cyBieSBsb29raW5nIHVwIGl0cyBuYW1lLiBJZiBpdCBleGlzdHNcclxuICAgIC8vIHRoZSByZXR1cm4gdGhlIHZhbHVlIGZvciB0aGUgYXR0cmlidXRlLCBvdGhlcndpc2UgcmV0dXJuIGFuIGVtcHR5IHN0cmluZy4gXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5cclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFBDQiBNZXRhZGF0YSBJbnRlcmZhY2VzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxubGV0IG1ldGFkYXRhO1xyXG4vLyBDb25zdHJ1Y3RvciBmb3IgY3JlYXRpbmcgYSBwYXJ0LlxyXG5mdW5jdGlvbiBNZXRhZGF0YSh0aXRsZSwgcmV2aXNpb24sIGNvbXBhbnksIGRhdGUpIFxyXG57XHJcbiAgICB0aGlzLnRpdGxlICAgID0gdGl0bGU7XHJcbiAgICB0aGlzLnJldmlzaW9uID0gcmV2aXNpb247XHJcbiAgICB0aGlzLmNvbXBhbnkgID0gY29tcGFueTtcclxuICAgIHRoaXMuZGF0ZSAgICAgPSBkYXRlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBDcmVhdGVNZXRhZGF0YShwY2JkYXRhU3RydWN0dXJlKVxyXG57XHJcbiAgICBtZXRhZGF0YSA9IG5ldyBNZXRhZGF0YSggXHJcbiAgICAgICAgcGNiZGF0YVN0cnVjdHVyZS5tZXRhZGF0YS50aXRsZSwgcGNiZGF0YVN0cnVjdHVyZS5tZXRhZGF0YS5yZXZpc2lvbixcclxuICAgICAgICBwY2JkYXRhU3RydWN0dXJlLm1ldGFkYXRhLmNvbXBhbnksIHBjYmRhdGFTdHJ1Y3R1cmUubWV0YWRhdGEuZGF0ZVxyXG4gICAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gR2V0TWV0YWRhdGEoKVxyXG57XHJcbiAgICByZXR1cm4gbWV0YWRhdGE7XHJcbn1cclxuXHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBQQ0IgTGF5ZXJzIEludGVyZmFjZXNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xyXG5sZXQgTGF5ZXJzID0gW107XHJcbmxldCBsYXllcl9aaW5kZXggPSAwO1xyXG5cclxuZnVuY3Rpb24gR2V0TGF5ZXJzKClcclxue1xyXG4gICAgcmV0dXJuIExheWVycztcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIFBDQkxheWVyKG5hbWUpXHJcbntcclxuICAgIHRoaXMubmFtZSAgICA9IG5hbWU7XHJcbiAgICB0aGlzLnZpc2libGVfZnJvbnQgPSB0cnVlO1xyXG4gICAgdGhpcy52aXNpYmxlX2JhY2sgPSB0cnVlO1xyXG5cclxuXHJcbiAgICB0aGlzLmZyb250X2lkID0gXCJsYXllcl9mcm9udF9cIiArIG5hbWU7XHJcbiAgICB0aGlzLmJhY2tfaWQgID0gXCJsYXllcl9yZWFyX1wiICsgbmFtZTtcclxuXHJcbiAgICBsZXQgY2FudmFzX2Zyb250ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJmcm9udC1jYW52YXMtbGlzdFwiKTtcclxuICAgIGxldCBsYXllcl9mcm9udCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcbiAgICBsYXllcl9mcm9udC5pZCA9IHRoaXMuZnJvbnRfaWQ7XHJcbiAgICBsYXllcl9mcm9udC5zdHlsZS56SW5kZXggPSBsYXllcl9aaW5kZXg7XHJcbiAgICBsYXllcl9mcm9udC5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcclxuICAgIGxheWVyX2Zyb250LnN0eWxlLmxlZnQgPSAwO1xyXG4gICAgbGF5ZXJfZnJvbnQuc3R5bGUudG9wID0gMDtcclxuICAgIGNhbnZhc19mcm9udC5hcHBlbmRDaGlsZChsYXllcl9mcm9udCk7XHJcblxyXG5cclxuICAgIGxldCBjYW52YXNfYmFjayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYmFjay1jYW52YXMtbGlzdFwiKTtcclxuICAgIGxldCBsYXllcl9iYWNrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcclxuICAgIGxheWVyX2JhY2suaWQgPSB0aGlzLmJhY2tfaWQ7XHJcbiAgICBsYXllcl9iYWNrLnN0eWxlLnpJbmRleCA9IGxheWVyX1ppbmRleDtcclxuICAgIGxheWVyX2JhY2suc3R5bGUucG9zaXRpb24gPSBcImFic29sdXRlXCI7XHJcbiAgICBsYXllcl9iYWNrLnN0eWxlLmxlZnQgPSAwO1xyXG4gICAgbGF5ZXJfYmFjay5zdHlsZS50b3AgPSAwO1xyXG5cclxuICAgIGNhbnZhc19iYWNrLmFwcGVuZENoaWxkKGxheWVyX2JhY2spO1xyXG5cclxuICAgIGxheWVyX1ppbmRleCA9IGxheWVyX1ppbmRleCArIDE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIFNldExheWVyVmlzaWJpbGl0eShsYXllck5hbWUsIGlzRnJvbnQsIHZpc2libGUpXHJcbntcclxuICAgIGxldCBsYXllckluZGV4ID0gTGF5ZXJzLmZpbmRJbmRleChpID0+IGkubmFtZSA9PT0gbGF5ZXJOYW1lKTtcclxuICAgIGlmKGlzRnJvbnQpXHJcbiAgICB7XHJcbiAgICAgICAgLy8gSWYgaXRlbSBpcyBub3QgaW4gdGhlIGxpc3QgXHJcbiAgICAgICAgaWYoIGxheWVySW5kZXggIT09IC0xKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgLy8gTGF5ZXIgZXhpc3RzLiBDaGVjayBpZiB2aXNpYmxlXHJcbiAgICAgICAgICAgIExheWVyc1tsYXllckluZGV4XS52aXNpYmxlX2Zyb250ID0gdmlzaWJsZTtcclxuXHJcbiAgICAgICAgICAgIC8vIFRPRE86IFJlZmFjdG9yIHRoaXMuIGJlbG93IGlzIHVzZWQgdG8gaW50ZXJmYWNlIGJldHdlZW4gdGhlIGRpZmZlcmVudCBsYXllciBcclxuICAgICAgICAgICAgLy8gc2V0dXBzIHRoYXQgYXJlIGN1cnJlbnRseSBiZWluZyB1c2VkIGJ1dCBvbmNlIHN3aXRjaGVkIHRvIHRoZSBuZXcgbGF5ZXIgZm9ybWF0XHJcbiAgICAgICAgICAgIC8vIHRoZW4gdGhlIGFib3ZlIHdpbGwgbm90IGJlIG5lZWRlZC5cclxuICAgICAgICAgICAgbGV0IGNhbnZhcyA9IHVuZGVmaW5lZDsgXHJcbiAgICAgICAgICAgIGlmKHZpc2libGUpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKExheWVyc1tsYXllckluZGV4XS5mcm9udF9pZCk7XHJcbiAgICAgICAgICAgICAgICBjYW52YXMuc3R5bGUuZGlzcGxheT1cIlwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoTGF5ZXJzW2xheWVySW5kZXhdLmZyb250X2lkKTtcclxuICAgICAgICAgICAgICAgIGNhbnZhcy5zdHlsZS5kaXNwbGF5PVwibm9uZVwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIC8vIElmIGl0ZW0gaXMgbm90IGluIHRoZSBsaXN0IFxyXG4gICAgICAgIGlmKCBsYXllckluZGV4ICE9PSAtMSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIC8vIExheWVyIGV4aXN0cy4gQ2hlY2sgaWYgdmlzaWJsZVxyXG4gICAgICAgICAgICBMYXllcnNbbGF5ZXJJbmRleF0udmlzaWJsZV9iYWNrID0gdmlzaWJsZTtcclxuXHJcbiAgICAgICAgICAgIC8vIFRPRE86IFJlZmFjdG9yIHRoaXMuIGJlbG93IGlzIHVzZWQgdG8gaW50ZXJmYWNlIGJldHdlZW4gdGhlIGRpZmZlcmVudCBsYXllciBcclxuICAgICAgICAgICAgLy8gc2V0dXBzIHRoYXQgYXJlIGN1cnJlbnRseSBiZWluZyB1c2VkIGJ1dCBvbmNlIHN3aXRjaGVkIHRvIHRoZSBuZXcgbGF5ZXIgZm9ybWF0XHJcbiAgICAgICAgICAgIC8vIHRoZW4gdGhlIGFib3ZlIHdpbGwgbm90IGJlIG5lZWRlZC5cclxuICAgICAgICAgICAgbGV0IGNhbnZhcyA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYodmlzaWJsZSlcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgY2FudmFzPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChMYXllcnNbbGF5ZXJJbmRleF0uYmFja19pZCk7XHJcbiAgICAgICAgICAgICAgICBjYW52YXMuc3R5bGUuZGlzcGxheT1cIlwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgY2FudmFzPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChMYXllcnNbbGF5ZXJJbmRleF0uYmFja19pZCk7XHJcbiAgICAgICAgICAgICAgICBjYW52YXMuc3R5bGUuZGlzcGxheT1cIm5vbmVcIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gR2V0TGF5ZXJDYW52YXMobGF5ZXJOYW1lLCBpc0Zyb250KVxyXG57XHJcbiAgICAvLyBHZXQgdGhlIGluZGV4IG9mIHRoZSBQQ0IgbGF5ZXIgXHJcbiAgICAvLyBNQXAgdXNlZCBoZXJlIHRvIGNyZWF0ZSBhIGxpc3Qgb2YganVzdCB0aGUgbGF5ZXIgbmFtZXMsIHdoaWNoIGluZGV4T2YgY2FuIHRoZW4gIGJlIHVzZWQgYWdhaW5zdC5cclxuICAgIGxldCBpbmRleCA9IExheWVycy5tYXAoZnVuY3Rpb24oZSkgeyByZXR1cm4gZS5uYW1lOyB9KS5pbmRleE9mKGxheWVyTmFtZSk7XHJcbiAgICAvLyBSZXF1ZXN0ZWQgbGF5ZXIgZG9lcyBub3QgZXhpc3QuIENyZWF0ZSBuZXcgbGF5ZXJcclxuICAgIGlmKGluZGV4ID09PSAtMSlcclxuICAgIHtcclxuICAgICAgICAvLyBBZGRzIGxheWVyIHRvIGxheWVyIHN0YWNrXHJcbiAgICAgICAgTGF5ZXJzLnB1c2gobmV3IFBDQkxheWVyKGxheWVyTmFtZSkpO1xyXG4gICAgICAgIGluZGV4ID0gTGF5ZXJzLmxlbmd0aC0xO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFJldHVybiB0aGUgY2FudmFzIGluc3RhbmNlXHJcbiAgICBpZihpc0Zyb250KVxyXG4gICAge1xyXG4gICAgICAgIHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChMYXllcnNbaW5kZXhdLmZyb250X2lkKTtcclxuICAgIH0gXHJcbiAgICBlbHNlXHJcbiAgICB7XHJcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKExheWVyc1tpbmRleF0uYmFja19pZCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIENyZWF0ZUxheWVycyhwY2JkYXRhU3RydWN0dXJlKVxyXG57XHJcbiAgICAvLyBFeHRyYWN0IGxheWVycyBmcm9tIHRoZSB0cmFjZSBzZWN0aW9uXHJcbiAgICBmb3IoIGxldCB0cmFjZSBvZiBwY2JkYXRhU3RydWN0dXJlLmJvYXJkLnRyYWNlcylcclxuICAgIHtcclxuICAgICAgICBmb3IobGV0IHNlZ21lbnQgb2YgdHJhY2Uuc2VnbWVudHMpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBDaGVjayB0aGF0IHNlZ21lbnQgY29udGFpbnMgYSBsYXllciBkZWZpbml0aW9uXHJcbiAgICAgICAgICAgIGlmKHNlZ21lbnQubGF5ZXIpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIC8vIElmIGl0ZW0gaXMgbm90IGluIHRoZSBsaXN0IFxyXG4gICAgICAgICAgICAgICAgaWYoTGF5ZXJzLmZpbmRJbmRleChpID0+IGkubmFtZSA9PT0gc2VnbWVudC5sYXllcikgPT09IC0xKVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIExheWVycy5wdXNoKG5ldyBQQ0JMYXllcihzZWdtZW50LmxheWVyKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRXh0cmFjdCBsYXllcnMgZm9ybSB0aGUgbGF5ZXJzIHNlY3Rpb25cclxuICAgIGZvcihsZXQgbGF5ZXIgb2YgcGNiZGF0YVN0cnVjdHVyZS5ib2FyZC5sYXllcnMpXHJcbiAgICB7XHJcbiAgICAgICAgLy8gSWYgaXRlbSBpcyBub3QgaW4gdGhlIGxpc3QgXHJcbiAgICAgICAgaWYoTGF5ZXJzLmZpbmRJbmRleChpID0+IGkubmFtZSA9PT0gbGF5ZXIubmFtZSkgPT09IC0xKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgLy8gQWRkIHRoZSBwYXIgdG8gdGhlIGdsb2JhbCBwYXJ0IGFycmF5XHJcbiAgICAgICAgICAgIExheWVycy5wdXNoKG5ldyBQQ0JMYXllcihsYXllci5uYW1lKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFhYWDogTmVlZCBhbm90aGVyIHdheSB0byBleHRyYWN0IGFsbCBsYXllcnMgZnJvbSBpbnB1dFxyXG4gICAgTGF5ZXJzLnB1c2gobmV3IFBDQkxheWVyKFwiZWRnZXNcIikpO1xyXG4gICAgTGF5ZXJzLnB1c2gobmV3IFBDQkxheWVyKFwicGFkc1wiKSk7XHJcbiAgICBMYXllcnMucHVzaChuZXcgUENCTGF5ZXIoXCJoaWdobGlnaHRzXCIpKTtcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIElzTGF5ZXJWaXNpYmxlKGxheWVyTmFtZSwgaXNGcm9udClcclxue1xyXG4gICAgbGV0IHJlc3VsdCA9IHRydWU7XHJcbiAgICBsZXQgbGF5ZXJJbmRleCA9IExheWVycy5maW5kSW5kZXgoaSA9PiBpLm5hbWUgPT09IGxheWVyTmFtZSk7XHJcblxyXG4gICAgLy8gVGhpcyBtZWFucyB0aGF0IHRoZSBsYXllciBpcyBhbHdheXMgdmlzaWJsZS4gXHJcbiAgICBpZihsYXllck5hbWUgPT0gXCJhbGxcIilcclxuICAgIHtcclxuICAgICAgICByZXN1bHQgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZihpc0Zyb250KVxyXG4gICAge1xyXG4gICAgICAgIC8vIElmIGl0ZW0gaXMgbm90IGluIHRoZSBsaXN0IFxyXG4gICAgICAgIGlmKCBsYXllckluZGV4ID09PSAtMSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBMYXllciBleGlzdHMuIENoZWNrIGlmIHZpc2libGVcclxuICAgICAgICAgICAgcmVzdWx0ID0gTGF5ZXJzW2xheWVySW5kZXhdLnZpc2libGVfZnJvbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIC8vIElmIGl0ZW0gaXMgbm90IGluIHRoZSBsaXN0IFxyXG4gICAgICAgIGlmKCBsYXllckluZGV4ID09PSAtMSlcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBMYXllciBleGlzdHMuIENoZWNrIGlmIHZpc2libGVcclxuICAgICAgICAgICAgcmVzdWx0ID0gTGF5ZXJzW2xheWVySW5kZXhdLnZpc2libGVfYmFjaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gT3BlblBjYkRhdGEocGNiZGF0YSlcclxue1xyXG4gICAgQ3JlYXRlQk9NKHBjYmRhdGEpO1xyXG4gICAgQ3JlYXRlTWV0YWRhdGEocGNiZGF0YSk7XHJcbiAgICBDcmVhdGVMYXllcnMocGNiZGF0YSk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgT3BlblBjYkRhdGEsIEdldEJPTSwgZ2V0QXR0cmlidXRlVmFsdWUsIEdldEJPTUNvbWJpbmVkVmFsdWVzLCBmaWx0ZXJCT01UYWJsZSwgR2V0TWV0YWRhdGEsIFxyXG4gICAgR2V0TGF5ZXJzLCBJc0xheWVyVmlzaWJsZSwgU2V0TGF5ZXJWaXNpYmlsaXR5LCBHZXRMYXllckNhbnZhcywgR2V0Q0FEVHlwZVxyXG59OyIsIi8qIFBDQiByZW5kZXJpbmcgY29kZSAqL1xyXG5cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgZ2xvYmFsRGF0YSAgICAgICAgID0gcmVxdWlyZShcIi4vZ2xvYmFsLmpzXCIpO1xyXG52YXIgcmVuZGVyX3BhZHMgICAgICAgID0gcmVxdWlyZShcIi4vcmVuZGVyL3JlbmRlcl9wYWQuanNcIik7XHJcbnZhciByZW5kZXJfdmlhICAgICAgICAgPSByZXF1aXJlKFwiLi9yZW5kZXIvcmVuZGVyX3ZpYS5qc1wiKTtcclxudmFyIHJlbmRlcl90cmFjZSAgICAgICA9IHJlcXVpcmUoXCIuL3JlbmRlci9yZW5kZXJfdHJhY2UuanNcIik7XHJcbnZhciByZW5kZXJfYm9hcmRlZGdlICAgPSByZXF1aXJlKFwiLi9yZW5kZXIvcmVuZGVyX2JvYXJkZWRnZS5qc1wiKTtcclxudmFyIHJlbmRlcl9zaWxrc2NyZWVuICA9IHJlcXVpcmUoXCIuL3JlbmRlci9yZW5kZXJfc2lsa3NjcmVlbi5qc1wiKTtcclxudmFyIHJlbmRlcl9jYW52YXMgICAgICA9IHJlcXVpcmUoXCIuL3JlbmRlci9yZW5kZXJfY2FudmFzLmpzXCIpO1xyXG52YXIgcmVuZGVyX2JvdW5kaW5nYm94ID0gcmVxdWlyZShcIi4vcmVuZGVyL3JlbmRlcl9ib3VuZGluZ2JveC5qc1wiKTtcclxudmFyIFBvaW50ICAgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL3JlbmRlci9wb2ludC5qc1wiKS5Qb2ludDtcclxudmFyIHBjYiAgICAgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL3BjYi5qc1wiKTtcclxudmFyIGNvbG9yTWFwICAgICAgICAgICA9IHJlcXVpcmUoXCIuL2NvbG9ybWFwLmpzXCIpO1xyXG5cclxuXHJcbi8vUkVNT1ZFOiBVc2luZyB0byB0ZXN0IGFsdGVybmF0ZSBwbGFjZWQgY29sb3JpbmdcclxubGV0IGlzUGxhY2VkID0gZmFsc2U7XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIERyYXdQYWQoY3R4LCBwYWQsIGNvbG9yKSBcclxue1xyXG4gICAgaWYgKHBhZC5zaGFwZSA9PSBcInJlY3RcIikgXHJcbiAgICB7XHJcbiAgICAgICAgcmVuZGVyX3BhZHMuUmVjdGFuZ2xlKGN0eCwgcGFkLCBjb2xvcik7XHJcbiAgICB9IFxyXG4gICAgZWxzZSBpZiAocGFkLnNoYXBlID09IFwib2Jsb25nXCIpIFxyXG4gICAge1xyXG4gICAgICAgIHJlbmRlcl9wYWRzLk9ibG9uZyhjdHgsIHBhZCwgY29sb3IpO1xyXG4gICAgfSBcclxuICAgIGVsc2UgaWYgKHBhZC5zaGFwZSA9PSBcInJvdW5kXCIpIFxyXG4gICAge1xyXG4gICAgICAgIHJlbmRlcl9wYWRzLlJvdW5kKGN0eCwgcGFkLCBjb2xvcik7XHJcbiAgICB9IFxyXG4gICAgZWxzZSBpZiAocGFkLnNoYXBlID09IFwib2N0YWdvblwiKSBcclxuICAgIHtcclxuICAgICAgICByZW5kZXJfcGFkcy5PY3RhZ29uKGN0eCwgcGFkLCBjb2xvcik7XHJcbiAgICB9IFxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiRVJST1I6IFVuc3VwcG9ydGVkIHBhZCB0eXBlIFwiLCBwYWQuc2hhcGUpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBEcmF3UENCRWRnZXMoaXNWaWV3RnJvbnQsIHNjYWxlZmFjdG9yKSBcclxue1xyXG4gICAgbGV0IGN0eCA9IHBjYi5HZXRMYXllckNhbnZhcyhcImVkZ2VzXCIsIGlzVmlld0Zyb250KS5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgICBsZXQgY29sb3IgPSBjb2xvck1hcC5HZXRQQ0JFZGdlQ29sb3IoKTtcclxuXHJcbiAgICBmb3IgKGxldCBlZGdlIG9mIHBjYmRhdGEuYm9hcmQucGNiX3NoYXBlLmVkZ2VzKSBcclxuICAgIHtcclxuICAgICAgICBpZihlZGdlLnBhdGh0eXBlID09IFwibGluZVwiKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgbGV0IGxpbmVXaWR0aCA9IE1hdGgubWF4KDEgLyBzY2FsZWZhY3RvciwgZWRnZS53aWR0aCk7XHJcbiAgICAgICAgICAgIHJlbmRlcl9ib2FyZGVkZ2UuTGluZShjdHgsIGVkZ2UsIGxpbmVXaWR0aCwgY29sb3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmKGVkZ2UucGF0aHR5cGUgPT0gXCJhcmNcIilcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGxldCBsaW5lV2lkdGggPSBNYXRoLm1heCgxIC8gc2NhbGVmYWN0b3IsIGVkZ2Uud2lkdGgpO1xyXG4gICAgICAgICAgICByZW5kZXJfYm9hcmRlZGdlLkFyYyhjdHgsIGVkZ2UsIGxpbmVXaWR0aCwgY29sb3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInVuc3VwcG9ydGVkIGJvYXJkIGVkZ2Ugc2VnbWVudCB0eXBlXCIsIGVkZ2UucGF0aHR5cGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gRHJhd1RyYWNlcyhpc1ZpZXdGcm9udCwgc2NhbGVmYWN0b3IpXHJcbntcclxuICAgIC8vIEl0ZXJhdGUgb3ZlciBhbGwgdHJhY2VzIGluIHRoZSBkZXNpZ25cclxuICAgIGZvciAobGV0IHRyYWNlIG9mIHBjYmRhdGEuYm9hcmQudHJhY2VzKVxyXG4gICAge1xyXG4gICAgICAgIC8vIGl0ZXJhdGUgb3ZlciBhbGwgc2VnbWVudHMgaW4gYSB0cmFjZSBcclxuICAgICAgICBmb3IgKGxldCBzZWdtZW50IG9mIHRyYWNlLnNlZ21lbnRzKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgbGV0IGN0eCA9IHBjYi5HZXRMYXllckNhbnZhcyhzZWdtZW50LmxheWVyLCBpc1ZpZXdGcm9udCkuZ2V0Q29udGV4dChcIjJkXCIpXHJcblxyXG4gICAgICAgICAgICBpZihzZWdtZW50LnBhdGh0eXBlID09IFwibGluZVwiKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbGluZVdpZHRoID0gTWF0aC5tYXgoMSAvIHNjYWxlZmFjdG9yLCBzZWdtZW50LndpZHRoKTtcclxuICAgICAgICAgICAgICAgIHJlbmRlcl90cmFjZS5MaW5lKGN0eCwgc2VnbWVudCwgbGluZVdpZHRoLCBjb2xvck1hcC5HZXRUcmFjZUNvbG9yKHNlZ21lbnQubGF5ZXJOdW1iZXItMSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYoc2VnbWVudC5wYXRodHlwZSA9PSBcImFyY1wiKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbGluZVdpZHRoID0gTWF0aC5tYXgoMSAvIHNjYWxlZmFjdG9yLCBzZWdtZW50LndpZHRoKTtcclxuICAgICAgICAgICAgICAgIHJlbmRlcl90cmFjZS5BcmMoY3R4LCBzZWdtZW50LCBsaW5lV2lkdGgsIGNvbG9yTWFwLkdldFRyYWNlQ29sb3Ioc2VnbWVudC5sYXllck51bWJlci0xKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoc2VnbWVudC5wYXRodHlwZSA9PSBcInBvbHlnb25cIilcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbGV0IGxpbmVXaWR0aCA9IE1hdGgubWF4KDEgLyBzY2FsZWZhY3Rvciwgc2VnbWVudC53aWR0aCk7XHJcbiAgICAgICAgICAgICAgICAvLyBOZWVkIHRvIHNwZWNpZnkgYSBjb2xvciBhdCBmdWxsIHRyYW5zcGFyZW5jeSBzbyB0aGF0IGEgbmVnYXRpdmUgcG9seWdvbiBcclxuICAgICAgICAgICAgICAgIC8vIGNhbiBiZSBzdWJ0cmFjdGVkIGZyb20gYSBwb3NpdGl2ZSBwb2x5Z29uLlxyXG4gICAgICAgICAgICAgICAgbGV0IGNvbG9yID0gKHNlZ21lbnQucG9zaXRpdmUgPT0gMSkgPyBjb2xvck1hcC5HZXRUcmFjZUNvbG9yKHNlZ21lbnQubGF5ZXJOdW1iZXItMSkgOiBcIiMwMDAwMDBGRlwiO1xyXG4gICAgICAgICAgICAgICAgcmVuZGVyX3RyYWNlLlBvbHlnb24oY3R4LCBzZWdtZW50LnNlZ21lbnRzLCBsaW5lV2lkdGgsIGNvbG9yLCBzZWdtZW50LnBvc2l0aXZlID09PSBcIjFcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiggc2VnbWVudC5wYXRodHlwZSA9PSBcInZpYV9yb3VuZFwiKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBsZXQgY2VudGVyUG9pbnQgPSBuZXcgUG9pbnQoc2VnbWVudC54LCBzZWdtZW50LnkpO1xyXG4gICAgICAgICAgICAgICAgcmVuZGVyX3ZpYS5Sb3VuZChcclxuICAgICAgICAgICAgICAgICAgICBjdHhcclxuICAgICAgICAgICAgICAgICAgICAsIGNlbnRlclBvaW50XHJcbiAgICAgICAgICAgICAgICAgICAgLCBzZWdtZW50LmRpYW1ldGVyXHJcbiAgICAgICAgICAgICAgICAgICAgLCBzZWdtZW50LmRyaWxsXHJcbiAgICAgICAgICAgICAgICAgICAgLCBjb2xvck1hcC5HZXRWaWFDb2xvcigpXHJcbiAgICAgICAgICAgICAgICAgICAgLCBjb2xvck1hcC5HZXREcmlsbENvbG9yKClcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiggc2VnbWVudC5wYXRodHlwZSA9PSBcInZpYV9vY3RhZ29uXCIpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGxldCBjZW50ZXJQb2ludCA9IG5ldyBQb2ludChzZWdtZW50LngsIHNlZ21lbnQueSk7XHJcbiAgICAgICAgICAgICAgICByZW5kZXJfdmlhLk9jdGFnb24oXHJcbiAgICAgICAgICAgICAgICAgICAgY3R4XHJcbiAgICAgICAgICAgICAgICAgICAgLCBjZW50ZXJQb2ludFxyXG4gICAgICAgICAgICAgICAgICAgICwgc2VnbWVudC5kaWFtZXRlclxyXG4gICAgICAgICAgICAgICAgICAgICwgc2VnbWVudC5kcmlsbFxyXG4gICAgICAgICAgICAgICAgICAgICwgY29sb3JNYXAuR2V0VmlhQ29sb3IoKVxyXG4gICAgICAgICAgICAgICAgICAgICwgY29sb3JNYXAuR2V0RHJpbGxDb2xvcigpXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYoIHNlZ21lbnQucGF0aHR5cGUgPT0gXCJ2aWFfc3F1YXJlXCIpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGxldCBjZW50ZXJQb2ludCA9IG5ldyBQb2ludChzZWdtZW50LngsIHNlZ21lbnQueSk7XHJcbiAgICAgICAgICAgICAgICByZW5kZXJfdmlhLlNxdWFyZShcclxuICAgICAgICAgICAgICAgICAgICBjdHhcclxuICAgICAgICAgICAgICAgICAgICAsIGNlbnRlclBvaW50XHJcbiAgICAgICAgICAgICAgICAgICAgLCBzZWdtZW50LmRpYW1ldGVyXHJcbiAgICAgICAgICAgICAgICAgICAgLCBzZWdtZW50LmRyaWxsXHJcbiAgICAgICAgICAgICAgICAgICAgLCBjb2xvck1hcC5HZXRWaWFDb2xvcigpXHJcbiAgICAgICAgICAgICAgICAgICAgLCBjb2xvck1hcC5HZXREcmlsbENvbG9yKClcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInVuc3VwcG9ydGVkIHRyYWNlIHNlZ21lbnQgdHlwZVwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gRHJhd1NpbGtzY3JlZW4oaXNWaWV3RnJvbnQsIHNjYWxlZmFjdG9yKVxyXG57XHJcbiAgICBsZXQgY29sb3IgPSBcIiNhYTRcIjtcclxuXHJcbiAgICBmb3IgKGxldCBsYXllciBvZiBwY2JkYXRhLmJvYXJkLmxheWVycylcclxuICAgIHtcclxuICAgICAgICBsZXQgY3R4ID0gcGNiLkdldExheWVyQ2FudmFzKGxheWVyLm5hbWUsIGlzVmlld0Zyb250KS5nZXRDb250ZXh0KFwiMmRcIik7XHJcblxyXG4gICAgICAgaWYobGF5ZXIubGF5ZXJOdW1iZXItMSA8IDE2KVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY29sb3IgPSBjb2xvck1hcC5HZXRUcmFjZUNvbG9yKGxheWVyLmxheWVyTnVtYmVyLTEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjb2xvciA9IFwiI2FhNFwiXHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAobGV0IHBhdGggb2YgbGF5ZXIucGF0aHMpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBpZihwYXRoLnBhdGh0eXBlID09IFwibGluZVwiKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbGluZVdpZHRoID0gTWF0aC5tYXgoMSAvIHNjYWxlZmFjdG9yLCBwYXRoLndpZHRoKTtcclxuICAgICAgICAgICAgICAgIHJlbmRlcl9zaWxrc2NyZWVuLkxpbmUoY3R4LCBwYXRoLCBsaW5lV2lkdGgsIGNvbG9yKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmKHBhdGgucGF0aHR5cGUgPT0gXCJhcmNcIilcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbGV0IGxpbmVXaWR0aCA9IE1hdGgubWF4KDEgLyBzY2FsZWZhY3RvciwgcGF0aC53aWR0aCk7XHJcbiAgICAgICAgICAgICAgICByZW5kZXJfc2lsa3NjcmVlbi5BcmMoY3R4LCBwYXRoLCBsaW5lV2lkdGgsIGNvbG9yKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmKHBhdGgucGF0aHR5cGUgPT0gXCJjaXJjbGVcIilcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbGV0IGxpbmVXaWR0aCA9IE1hdGgubWF4KDEgLyBzY2FsZWZhY3RvciwgcGF0aC53aWR0aCk7XHJcbiAgICAgICAgICAgICAgICByZW5kZXJfc2lsa3NjcmVlbi5DaXJjbGUoY3R4LCBwYXRoLCBsaW5lV2lkdGgsIGNvbG9yKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwidW5zdXBwb3J0ZWQgc2lsa3NjcmVlbiBwYXRoIHNlZ21lbnQgdHlwZVwiLCBwYXRoLnBhdGh0eXBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gRHJhd01vZHVsZShpc1ZpZXdGcm9udCwgbGF5ZXIsIHNjYWxlZmFjdG9yLCBwYXJ0LCBoaWdobGlnaHQpIFxyXG57XHJcbiAgICBpZiAoaGlnaGxpZ2h0IHx8IGdsb2JhbERhdGEuZ2V0RGVidWdNb2RlKCkpXHJcbiAgICB7XHJcbiAgICAgICAgbGV0IGN0eCA9IHBjYi5HZXRMYXllckNhbnZhcyhcImhpZ2hsaWdodHNcIiwgaXNWaWV3RnJvbnQpLmdldENvbnRleHQoXCIyZFwiKTtcclxuICAgICAgICAvLyBkcmF3IGJvdW5kaW5nIGJveFxyXG4gICAgICAgIGlmIChwYXJ0LmxvY2F0aW9uID09IGxheWVyKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgbGV0IGNvbG9yX0JvdW5kaW5nQm94ID0gY29sb3JNYXAuR2V0Qm91bmRpbmdCb3hDb2xvcihoaWdobGlnaHQsIGlzUGxhY2VkKTtcclxuICAgICAgICAgICAgcmVuZGVyX2JvdW5kaW5nYm94LlJlY3RhbmdsZShjdHgsIHBhcnQucGFja2FnZS5ib3VuZGluZ19ib3gsIGNvbG9yX0JvdW5kaW5nQm94KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gZHJhdyBwYWRzXHJcbiAgICAgICAgZm9yIChsZXQgcGFkIG9mIHBhcnQucGFja2FnZS5wYWRzKSBcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgICAgICBDaGVjayB0aGF0IHBhcnQgb24gbGF5ZXIgc2hvdWxkIGJlIGRyYXduLiBXaWxsIGRyYXcgd2hlbiByZXF1ZXN0ZWQgbGF5ZXIgXHJcbiAgICAgICAgICAgICAgICBtYXRjaGVzIHRoZSBwYXJ0cyBsYXllci5cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgSWYgdGhlIHBhcnQgaXMgdGhyb3VnaCBob2xlIGl0IG5lZWRzIHRvIGJlIGRyYXduIG9uIGVhY2ggbGF5ZXJcclxuICAgICAgICAgICAgICBvdGhlcndpc2UgdGhlIHBhcnQgaXMgYW4gc21kIGFuZCBzaG91bGQgb25seSBiZSBkcmF3biBvbiBhIHRoZSBsYXllciBpdCBiZWxvbmdzIHRvLlxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBpZiAoICAgIChwYWQucGFkX3R5cGUgPT0gXCJ0aHRcIilcclxuICAgICAgICAgICAgICAgICB8fCAoKHBhZC5wYWRfdHlwZSA9PSBcInNtZFwiKSAmJiAocGFydC5sb2NhdGlvbiA9PSBsYXllcikpXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbGV0IGhpZ2hsaWdodFBpbjEgPSAoKHBhZC5waW4xID09IFwieWVzXCIpICAmJiBnbG9iYWxEYXRhLmdldEhpZ2hsaWdodFBpbjEoKSk7XHJcbiAgICAgICAgICAgICAgICBsZXQgY29sb3JfcGFkID0gY29sb3JNYXAuR2V0UGFkQ29sb3IoaGlnaGxpZ2h0UGluMSwgaGlnaGxpZ2h0LCBpc1BsYWNlZCk7XHJcbiAgICAgICAgICAgICAgICBEcmF3UGFkKGN0eCwgcGFkLCBjb2xvcl9wYWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGRyYXcgcGFkc1xyXG4gICAgZm9yIChsZXQgcGFkIG9mIHBhcnQucGFja2FnZS5wYWRzKSBcclxuICAgIHtcclxuICAgICAgICAvKlxyXG4gICAgICAgICAgICBDaGVjayB0aGF0IHBhcnQgb24gbGF5ZXIgc2hvdWxkIGJlIGRyYXduLiBXaWxsIGRyYXcgd2hlbiByZXF1ZXN0ZWQgbGF5ZXIgXHJcbiAgICAgICAgICAgIG1hdGNoZXMgdGhlIHBhcnRzIGxheWVyLlxyXG4gICAgICAgIFxyXG4gICAgICAgICAgSWYgdGhlIHBhcnQgaXMgdGhyb3VnaCBob2xlIGl0IG5lZWRzIHRvIGJlIGRyYXduIG9uIGVhY2ggbGF5ZXJcclxuICAgICAgICAgIG90aGVyd2lzZSB0aGUgcGFydCBpcyBhbiBzbWQgYW5kIHNob3VsZCBvbmx5IGJlIGRyYXduIG9uIGEgdGhlIGxheWVyIGl0IGJlbG9uZ3MgdG8uXHJcbiAgICAgICAgKi9cclxuICAgICAgICBpZiAoICAgIChwYWQucGFkX3R5cGUgPT0gXCJ0aHRcIilcclxuICAgICAgICAgICAgIHx8ICgocGFkLnBhZF90eXBlID09IFwic21kXCIpICYmIChwYXJ0LmxvY2F0aW9uID09IGxheWVyKSlcclxuICAgICAgICApXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBsZXQgaGlnaGxpZ2h0UGluMSA9ICgocGFkLnBpbjEgPT0gXCJ5ZXNcIikgICYmIGdsb2JhbERhdGEuZ2V0SGlnaGxpZ2h0UGluMSgpKTtcclxuICAgICAgICAgICAgbGV0IGNvbG9yX3BhZCA9IGNvbG9yTWFwLkdldFBhZENvbG9yKGhpZ2hsaWdodFBpbjEsIGZhbHNlLCBpc1BsYWNlZCk7XHJcbiAgICAgICAgICAgIGxldCBjdHggPSBwY2IuR2V0TGF5ZXJDYW52YXMoXCJwYWRzXCIsIGlzVmlld0Zyb250KS5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgICAgICAgICAgIERyYXdQYWQoY3R4LCBwYWQsIGNvbG9yX3BhZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBEcmF3TW9kdWxlcyhpc1ZpZXdGcm9udCwgbGF5ZXIsIHNjYWxlZmFjdG9yLCBoaWdobGlnaHRlZFJlZnMpXHJcbntcclxuICAgIGZvciAobGV0IHBhcnQgb2YgcGNiZGF0YS5wYXJ0cykgXHJcbiAgICB7XHJcbiAgICAgICAgbGV0IGhpZ2hsaWdodCA9IGhpZ2hsaWdodGVkUmVmcy5pbmNsdWRlcyhwYXJ0Lm5hbWUpO1xyXG4gICAgICAgIGlmIChoaWdobGlnaHRlZFJlZnMubGVuZ3RoID09IDAgfHwgaGlnaGxpZ2h0KSBcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIERyYXdNb2R1bGUoaXNWaWV3RnJvbnQsIGxheWVyLCBzY2FsZWZhY3RvciwgcGFydCwgaGlnaGxpZ2h0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRyYXdDYW52YXMoY2FudmFzZGljdClcclxue1xyXG4gICAgcmVuZGVyX2NhbnZhcy5SZWRyYXdDYW52YXMoY2FudmFzZGljdCk7XHJcbiAgICBsZXQgaXNWaWV3RnJvbnQgPSAoY2FudmFzZGljdC5sYXllciA9PT0gXCJGXCIpO1xyXG4gICAgRHJhd1BDQkVkZ2VzICAoaXNWaWV3RnJvbnQsIGNhbnZhc2RpY3QudHJhbnNmb3JtLnMpO1xyXG4gICAgRHJhd01vZHVsZXMgICAoaXNWaWV3RnJvbnQsIGNhbnZhc2RpY3QubGF5ZXIsIGNhbnZhc2RpY3QudHJhbnNmb3JtLnMsIFtdKTtcclxuICAgIERyYXdUcmFjZXMgICAgKGlzVmlld0Zyb250LCBjYW52YXNkaWN0LnRyYW5zZm9ybS5zKTtcclxuICAgIC8vIERyYXcgbGFzdCBzbyB0aGF0IHRleHQgaXMgbm90IGVyYXNlZCB3aGVuIGRyYXdpbmcgcG9seWdvbnMuXHJcbiAgICBEcmF3U2lsa3NjcmVlbihpc1ZpZXdGcm9udCwgY2FudmFzZGljdC50cmFuc2Zvcm0ucyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIFJvdGF0ZVZlY3Rvcih2LCBhbmdsZSlcclxue1xyXG4gICAgcmV0dXJuIHJlbmRlcl9jYW52YXMucm90YXRlVmVjdG9yKHYsIGFuZ2xlKTtcclxufVxyXG5cclxuXHJcblxyXG5mdW5jdGlvbiBpbml0UmVuZGVyKClcclxue1xyXG4gICAgbGV0IGFsbGNhbnZhcyA9IHtcclxuICAgICAgICBmcm9udDoge1xyXG4gICAgICAgICAgICB0cmFuc2Zvcm06IHtcclxuICAgICAgICAgICAgICAgIHg6IDAsXHJcbiAgICAgICAgICAgICAgICB5OiAwLFxyXG4gICAgICAgICAgICAgICAgczogMSxcclxuICAgICAgICAgICAgICAgIHBhbng6IDAsXHJcbiAgICAgICAgICAgICAgICBwYW55OiAwLFxyXG4gICAgICAgICAgICAgICAgem9vbTogMSxcclxuICAgICAgICAgICAgICAgIG1vdXNlc3RhcnR4OiAwLFxyXG4gICAgICAgICAgICAgICAgbW91c2VzdGFydHk6IDAsXHJcbiAgICAgICAgICAgICAgICBtb3VzZWRvd246IGZhbHNlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBsYXllcjogXCJGXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBiYWNrOiB7XHJcbiAgICAgICAgICAgIHRyYW5zZm9ybToge1xyXG4gICAgICAgICAgICAgICAgeDogMCxcclxuICAgICAgICAgICAgICAgIHk6IDAsXHJcbiAgICAgICAgICAgICAgICBzOiAxLFxyXG4gICAgICAgICAgICAgICAgcGFueDogMCxcclxuICAgICAgICAgICAgICAgIHBhbnk6IDAsXHJcbiAgICAgICAgICAgICAgICB6b29tOiAxLFxyXG4gICAgICAgICAgICAgICAgbW91c2VzdGFydHg6IDAsXHJcbiAgICAgICAgICAgICAgICBtb3VzZXN0YXJ0eTogMCxcclxuICAgICAgICAgICAgICAgIG1vdXNlZG93bjogZmFsc2UsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGxheWVyOiBcIkJcIixcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgLy8gU2V0cyB0aGUgZGF0YSBzdHJ1Y3VyZSB0byBhIGRlZmF1bHQgdmFsdWUuIFxyXG4gICAgZ2xvYmFsRGF0YS5TZXRBbGxDYW52YXMoYWxsY2FudmFzKTtcclxuICAgIC8vIFNldCB0aGUgc2NhbGUgc28gdGhlIFBDQiB3aWxsIGJlIHNjYWxlZCBhbmQgY2VudGVyZWQgY29ycmVjdGx5LlxyXG4gICAgcmVuZGVyX2NhbnZhcy5SZXNpemVDYW52YXMoZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5mcm9udCk7XHJcbiAgICByZW5kZXJfY2FudmFzLlJlc2l6ZUNhbnZhcyhnbG9iYWxEYXRhLkdldEFsbENhbnZhcygpLmJhY2spO1xyXG4gICAgXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRyYXdIaWdobGlnaHRzT25MYXllcihjYW52YXNkaWN0KSBcclxue1xyXG4gICAgbGV0IGlzVmlld0Zyb250ID0gKGNhbnZhc2RpY3QubGF5ZXIgPT09IFwiRlwiKTtcclxuICAgIHJlbmRlcl9jYW52YXMuQ2xlYXJIaWdobGlnaHRzKGNhbnZhc2RpY3QpO1xyXG4gICAgRHJhd01vZHVsZXMgICAoaXNWaWV3RnJvbnQsIGNhbnZhc2RpY3QubGF5ZXIsIGNhbnZhc2RpY3QudHJhbnNmb3JtLnMsIGdsb2JhbERhdGEuZ2V0SGlnaGxpZ2h0ZWRSZWZzKCkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkcmF3SGlnaGxpZ2h0cyhwYXNzZWQpIFxyXG57XHJcbiAgICBpc1BsYWNlZD1wYXNzZWQ7XHJcbiAgICBkcmF3SGlnaGxpZ2h0c09uTGF5ZXIoZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5mcm9udCk7XHJcbiAgICBkcmF3SGlnaGxpZ2h0c09uTGF5ZXIoZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5iYWNrKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVzaXplQWxsKCkgXHJcbntcclxuICAgIHJlbmRlcl9jYW52YXMuUmVzaXplQ2FudmFzKGdsb2JhbERhdGEuR2V0QWxsQ2FudmFzKCkuZnJvbnQpO1xyXG4gICAgcmVuZGVyX2NhbnZhcy5SZXNpemVDYW52YXMoZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5iYWNrKTtcclxuICAgIGRyYXdDYW52YXMoZ2xvYmFsRGF0YS5HZXRBbGxDYW52YXMoKS5mcm9udCk7XHJcbiAgICBkcmF3Q2FudmFzKGdsb2JhbERhdGEuR2V0QWxsQ2FudmFzKCkuYmFjayk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIFNldEJvYXJkUm90YXRpb24odmFsdWUpIFxyXG57XHJcbiAgICAvKlxyXG4gICAgICAgIFRoZSBib2FyZCB3aGVuIGRyYXduIGJ5IGRlZmF1bHQgaXMgc2hvdyByb3RhdGVkIC0xODAgZGVncmVlcy4gXHJcbiAgICAgICAgVGhlIGZvbGxvd2luZyB3aWxsIGFkZCAxODAgZGVncmVlcyB0byB3aGF0IHRoZSB1c2VyIGNhbGN1bGF0ZXMgc28gdGhhdCB0aGUgUENCXHJcbiAgICAgICAgd2lsbCBiZSBkcmF3biBpbiB0aGUgY29ycmVjdCBvcmllbnRhdGlvbiwgaS5lLiBkaXNwbGF5ZWQgYXMgc2hvd24gaW4gRUNBRCBwcm9ncmFtLiBcclxuICAgICAgICBJbnRlcm5hbGx5IHRoZSByYW5nZSBvZiBkZWdyZWVzIGlzIHN0b3JlZCBhcyAwIC0+IDM2MFxyXG4gICAgKi9cclxuICAgIGdsb2JhbERhdGEuU2V0Qm9hcmRSb3RhdGlvbigodmFsdWUgKiA1KSsxODApO1xyXG4gICAgZ2xvYmFsRGF0YS53cml0ZVN0b3JhZ2UoXCJib2FyZFJvdGF0aW9uXCIsIGdsb2JhbERhdGEuR2V0Qm9hcmRSb3RhdGlvbigpKTtcclxuICAgIC8qXHJcbiAgICAgICAgRGlzcGxheSB0aGUgY29ycmVjdCByYW5nZSBvZiBkZWdyZWVzIHdoaWNoIGlzIC0xODAgLT4gMTgwLiBcclxuICAgICAgICBUaGUgZm9sbG93aW5nIGp1c3QgcmVtYXBzIDM2MCBkZWdyZWVzIHRvIGJlIGluIHRoZSByYW5nZSAtMTgwIC0+IDE4MC5cclxuICAgICovXHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInJvdGF0aW9uRGVncmVlXCIpLnRleHRDb250ZW50ID0gKGdsb2JhbERhdGEuR2V0Qm9hcmRSb3RhdGlvbigpLTE4MCk7XHJcbiAgICByZXNpemVBbGwoKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBpbml0UmVuZGVyLCByZXNpemVBbGwsIGRyYXdDYW52YXMsIGRyYXdIaWdobGlnaHRzLCBSb3RhdGVWZWN0b3IsIFNldEJvYXJkUm90YXRpb25cclxufTsiLCJcInVzZSBzdHJpY3RcIjtcclxuLyoqXHJcbiAqIFxyXG4gKiBAcGFyYW0geyp9IHggXHJcbiAqIEBwYXJhbSB7Kn0geSBcclxuICovXHJcbmZ1bmN0aW9uIFBvaW50KHgseSlcclxue1xyXG4gICAgdGhpcy54ID0geDtcclxuICAgIHRoaXMueSA9IHk7XHJcbn1cclxuXHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBQb2ludFxyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIHJlbmRlcl9sb3dsZXZlbCAgICAgPSByZXF1aXJlKFwiLi9yZW5kZXJfbG93bGV2ZWwuanNcIik7XHJcbnZhciBQb2ludCAgICAgICAgICAgICAgID0gcmVxdWlyZShcIi4vcG9pbnQuanNcIikuUG9pbnQ7XHJcblxyXG4vLyBMaW5lIHdpZHRoIGlzIG5vdCBpbmNsdWRlZCBhcyBwYXJ0IG9mIHRoZSB0cmFjZSBhcyBpdCB3aWxsIGRlcGVuZCBvbiB0aGUgY3VycmVudCBndWkgc2NhbGUgZmFjdG9yLlxyXG5mdW5jdGlvbiBBcmMoZ3VpQ29udGV4dCwgdHJhY2UsIGxpbmVXaWR0aCwgY29sb3IpXHJcbntcclxuXHJcbiAgICBsZXQgY2VudGVyUG9pbnQgPSBuZXcgUG9pbnQodHJhY2UuY3gwLCB0cmFjZS5jeTApO1xyXG5cclxuXHJcbiAgICBsZXQgcmVuZGVyT3B0aW9ucyA9IHsgXHJcbiAgICAgICAgY29sb3I6IGNvbG9yLFxyXG4gICAgICAgIGZpbGw6IGZhbHNlLFxyXG4gICAgICAgIGxpbmVXaWR0aDogbGluZVdpZHRoLFxyXG4gICAgICAgIGxpbmVDYXA6IFwicm91bmRcIiBcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLkFyYyggXHJcbiAgICAgICAgZ3VpQ29udGV4dCxcclxuICAgICAgICBjZW50ZXJQb2ludCxcclxuICAgICAgICB0cmFjZS5yYWRpdXMsXHJcbiAgICAgICAgdHJhY2UuYW5nbGUwLFxyXG4gICAgICAgIHRyYWNlLmFuZ2xlMSxcclxuICAgICAgICByZW5kZXJPcHRpb25zXHJcbiAgICApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBMaW5lKGd1aUNvbnRleHQsIHRyYWNlLCBsaW5lV2lkdGgsIGNvbG9yKVxyXG57XHJcbiAgICBsZXQgc3RhcnRQb2ludCA9IG5ldyBQb2ludCh0cmFjZS54MCwgdHJhY2UueTApO1xyXG4gICAgbGV0IGVuZFBvaW50ICAgPSBuZXcgUG9pbnQodHJhY2UueDEsIHRyYWNlLnkxKTtcclxuXHJcbiAgICBsZXQgcmVuZGVyT3B0aW9ucyA9IHsgXHJcbiAgICAgICAgY29sb3I6IGNvbG9yLFxyXG4gICAgICAgIGZpbGw6IGZhbHNlLFxyXG4gICAgICAgIGxpbmVXaWR0aDogbGluZVdpZHRoLFxyXG4gICAgICAgIGxpbmVDYXA6IFwicm91bmRcIiBcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLkxpbmUoIFxyXG4gICAgICAgIGd1aUNvbnRleHQsXHJcbiAgICAgICAgc3RhcnRQb2ludCxcclxuICAgICAgICBlbmRQb2ludCxcclxuICAgICAgICByZW5kZXJPcHRpb25zXHJcbiAgICApO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIEFyYywgTGluZVxyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIHJlbmRlcl9sb3dsZXZlbCAgICAgPSByZXF1aXJlKFwiLi9yZW5kZXJfbG93bGV2ZWwuanNcIik7XHJcbnZhciBQb2ludCAgICAgICAgICAgICAgID0gcmVxdWlyZShcIi4vcG9pbnQuanNcIikuUG9pbnQ7XHJcblxyXG4vLyBMaW5lIHdpZHRoIGlzIG5vdCBpbmNsdWRlZCBhcyBwYXJ0IG9mIHRoZSB0cmFjZSBhcyBpdCB3aWxsIGRlcGVuZCBvbiB0aGUgY3VycmVudCBndWkgc2NhbGUgZmFjdG9yLlxyXG5mdW5jdGlvbiBSZWN0YW5nbGUoZ3VpQ29udGV4dCwgYm91bmRpbmdCb3gsIGNvbG9yKVxyXG57XHJcbiAgICBsZXQgY2VudGVyUG9pbnQgPSBuZXcgUG9pbnQoMCwgMCk7XHJcbiAgICAvKlxyXG4gICAgICAgICAgICBUaGUgZm9sbG93aW5nIGRlcml2ZSB0aGUgY29ybmVyIHBvaW50cyBmb3IgdGhlXHJcbiAgICAgICAgICAgIHJlY3Rhbmd1bGFyIHBhZC4gVGhlc2UgYXJlIGNhbGN1bGF0ZWQgdXNpbmcgdGhlIGNlbnRlciBcclxuICAgICAgICAgICAgcG9pbnQgb2YgdGhlIHJlY3RhbmdsZSBhbG9uZyB3aXRoIHRoZSB3aWR0aCBhbmQgaGVpZ2h0IFxyXG4gICAgICAgICAgICBvZiB0aGUgcmVjdGFuZ2xlLiBcclxuICAgICovXHJcbiAgICAvLyBUb3AgbGVmdCBwb2ludFxyXG4gICAgbGV0IHBvaW50MCA9IG5ldyBQb2ludChib3VuZGluZ0JveC54MCwgYm91bmRpbmdCb3gueTApO1xyXG4gICAgLy8gVG9wIHJpZ2h0IHBvaW50XHJcbiAgICBsZXQgcG9pbnQxID0gbmV3IFBvaW50KGJvdW5kaW5nQm94LngxLCBib3VuZGluZ0JveC55MCk7XHJcbiAgICAvLyBCb3R0b20gcmlnaHQgcG9pbnRcclxuICAgIGxldCBwb2ludDIgPSBuZXcgUG9pbnQoYm91bmRpbmdCb3gueDEsIGJvdW5kaW5nQm94LnkxKTtcclxuICAgIC8vIEJvdHRvbSBsZWZ0IHBvaW50XHJcbiAgICBsZXQgcG9pbnQzID0gbmV3IFBvaW50KGJvdW5kaW5nQm94LngwLCBib3VuZGluZ0JveC55MSk7XHJcblxyXG4gICAgLy8gRmlyc3QgZmlsbCB0aGUgYm94LiBcclxuICAgIGxldCByZW5kZXJPcHRpb25zID0ge1xyXG4gICAgICAgIGNvbG9yOiBjb2xvcixcclxuICAgICAgICBmaWxsOiB0cnVlLFxyXG4gICAgICAgIGdsb2JhbEFscGhhOiAwLjJcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLlJlZ3VsYXJQb2x5Z29uKCBcclxuICAgICAgICBndWlDb250ZXh0LFxyXG4gICAgICAgIGNlbnRlclBvaW50LCBcclxuICAgICAgICBbcG9pbnQwLCBwb2ludDEsIHBvaW50MiwgcG9pbnQzXSxcclxuICAgICAgICAwLFxyXG4gICAgICAgIHJlbmRlck9wdGlvbnNcclxuICAgICk7XHJcblxyXG4gICAgLy8gTm93IHN0b2tlIHRoZSBib3hcclxuICAgIHJlbmRlck9wdGlvbnMgPSB7XHJcbiAgICAgICAgY29sb3I6IGNvbG9yLFxyXG4gICAgICAgIGZpbGw6IGZhbHNlLFxyXG4gICAgICAgIGdsb2JhbEFscGhhOiAxLCBcclxuICAgICAgICBsaW5lV2lkdGg6IDAuMzNcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLlJlZ3VsYXJQb2x5Z29uKCBcclxuICAgICAgICBndWlDb250ZXh0LFxyXG4gICAgICAgIGNlbnRlclBvaW50LCBcclxuICAgICAgICBbcG9pbnQwLCBwb2ludDEsIHBvaW50MiwgcG9pbnQzXSxcclxuICAgICAgICAwLFxyXG4gICAgICAgIHJlbmRlck9wdGlvbnNcclxuICAgICk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgUmVjdGFuZ2xlXHJcbn07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG52YXIgcGNiICAgICAgICA9IHJlcXVpcmUoXCIuLi9wY2IuanNcIik7XHJcbnZhciBnbG9iYWxEYXRhID0gcmVxdWlyZShcIi4uL2dsb2JhbC5qc1wiKTtcclxuXHJcblxyXG5mdW5jdGlvbiBwcmVwYXJlQ2FudmFzKGNhbnZhcywgZmxpcCwgdHJhbnNmb3JtKSBcclxue1xyXG4gICAgbGV0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgICBjdHguc2V0VHJhbnNmb3JtKDEsIDAsIDAsIDEsIDAsIDApO1xyXG4gICAgY3R4LnNjYWxlKHRyYW5zZm9ybS56b29tLCB0cmFuc2Zvcm0uem9vbSk7XHJcbiAgICBjdHgudHJhbnNsYXRlKHRyYW5zZm9ybS5wYW54LCB0cmFuc2Zvcm0ucGFueSk7XHJcbiAgICBpZiAoZmxpcCkgXHJcbiAgICB7XHJcbiAgICAgICAgY3R4LnNjYWxlKC0xLCAxKTtcclxuICAgIH1cclxuICAgIGN0eC50cmFuc2xhdGUodHJhbnNmb3JtLngsIHRyYW5zZm9ybS55KTtcclxuICAgIGN0eC5yb3RhdGUoZ2xvYmFsRGF0YS5HZXRCb2FyZFJvdGF0aW9uKCkqTWF0aC5QSS8xODApO1xyXG4gICAgY3R4LnNjYWxlKHRyYW5zZm9ybS5zLCB0cmFuc2Zvcm0ucyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJvdGF0ZVZlY3Rvcih2LCBhbmdsZSkgXHJcbntcclxuICAgIGFuZ2xlID0gYW5nbGUqTWF0aC5QSS8xODA7XHJcbiAgICByZXR1cm4gW1xyXG4gICAgICAgIHZbMF0gKiBNYXRoLmNvcyhhbmdsZSkgLSB2WzFdICogTWF0aC5zaW4oYW5nbGUpLFxyXG4gICAgICAgIHZbMF0gKiBNYXRoLnNpbihhbmdsZSkgKyB2WzFdICogTWF0aC5jb3MoYW5nbGUpXHJcbiAgICBdO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWNhbGNMYXllclNjYWxlKGNhbnZhc2RpY3QsIGNhbnZhcykgXHJcbntcclxuICAgIGxldCBsYXllcklEID0gKGNhbnZhc2RpY3QubGF5ZXIgPT09IFwiRlwiKSA/IFwiZnJvbnRjYW52YXNcIiA6IFwiYmFja2NhbnZhc1wiIDtcclxuICAgIGxldCB3aWR0aCAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobGF5ZXJJRCkuY2xpZW50V2lkdGggKiAyO1xyXG4gICAgbGV0IGhlaWdodCAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChsYXllcklEKS5jbGllbnRIZWlnaHQgKiAyO1xyXG4gICAgbGV0IGJib3ggICAgPSBhcHBseVJvdGF0aW9uKHBjYmRhdGEuYm9hcmQucGNiX3NoYXBlLmJvdW5kaW5nX2JveCk7XHJcbiAgICBsZXQgc2NhbGVmYWN0b3IgPSAwLjk4ICogTWF0aC5taW4oIHdpZHRoIC8gKGJib3gubWF4eCAtIGJib3gubWlueCksIGhlaWdodCAvIChiYm94Lm1heHkgLSBiYm94Lm1pbnkpKTtcclxuXHJcbiAgICBpZiAoc2NhbGVmYWN0b3IgPCAwLjEpXHJcbiAgICB7XHJcbiAgICAgICAgLy9zY2FsZWZhY3RvciA9IDE7XHJcbiAgICB9XHJcblxyXG4gICAgY2FudmFzZGljdC50cmFuc2Zvcm0ucyA9IHNjYWxlZmFjdG9yO1xyXG5cclxuICAgIGlmICgoY2FudmFzZGljdC5sYXllciAhPSBcIkJcIikpXHJcbiAgICB7XHJcbiAgICAgICAgY2FudmFzZGljdC50cmFuc2Zvcm0ueCA9IC0oKGJib3gubWF4eCArIGJib3gubWlueCkgKiBzY2FsZWZhY3RvciArIHdpZHRoKSAqIDAuNTtcclxuICAgIH1cclxuICAgIGVsc2VcclxuICAgIHtcclxuICAgICAgICBjYW52YXNkaWN0LnRyYW5zZm9ybS54ID0gLSgoYmJveC5tYXh4ICsgYmJveC5taW54KSAqIHNjYWxlZmFjdG9yIC0gd2lkdGgpICogMC41O1xyXG4gICAgfVxyXG4gICAgY2FudmFzZGljdC50cmFuc2Zvcm0ueSA9IC0oKGJib3gubWF4eSArIGJib3gubWlueSkgKiBzY2FsZWZhY3RvciAtIGhlaWdodCkgKiAwLjU7XHJcblxyXG4gICAgaWYoY2FudmFzZGljdC5sYXllciA9PT1cIkZcIilcclxuICAgIHtcclxuICAgICAgICBjYW52YXMud2lkdGggPSB3aWR0aDtcclxuICAgICAgICBjYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xyXG4gICAgICAgIGNhbnZhcy5zdHlsZS53aWR0aCA9ICh3aWR0aCAvIDIpICsgXCJweFwiO1xyXG4gICAgICAgIGNhbnZhcy5zdHlsZS5oZWlnaHQgPSAoaGVpZ2h0IC8gMikgKyBcInB4XCI7XHJcbiAgICB9XHJcbiAgICBlbHNlXHJcbiAgICB7XHJcbiAgICAgICAgY2FudmFzLndpZHRoID0gd2lkdGg7XHJcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGhlaWdodDtcclxuICAgICAgICBjYW52YXMuc3R5bGUud2lkdGggPSAod2lkdGggLyAyKSArIFwicHhcIjtcclxuICAgICAgICBjYW52YXMuc3R5bGUuaGVpZ2h0ID0gKGhlaWdodCAvIDIpICsgXCJweFwiO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBhcHBseVJvdGF0aW9uKGJib3gpIFxyXG57XHJcbiAgICBsZXQgY29ybmVycyA9IFtcclxuICAgICAgICBbYmJveC5taW54LCBiYm94Lm1pbnldLFxyXG4gICAgICAgIFtiYm94Lm1pbngsIGJib3gubWF4eV0sXHJcbiAgICAgICAgW2Jib3gubWF4eCwgYmJveC5taW55XSxcclxuICAgICAgICBbYmJveC5tYXh4LCBiYm94Lm1heHldLFxyXG4gICAgXTtcclxuICAgIGNvcm5lcnMgPSBjb3JuZXJzLm1hcCgodikgPT4gcm90YXRlVmVjdG9yKHYsIGdsb2JhbERhdGEuR2V0Qm9hcmRSb3RhdGlvbigpKSk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG1pbng6IGNvcm5lcnMucmVkdWNlKChhLCB2KSA9PiBNYXRoLm1pbihhLCB2WzBdKSwgSW5maW5pdHkpLFxyXG4gICAgICAgIG1pbnk6IGNvcm5lcnMucmVkdWNlKChhLCB2KSA9PiBNYXRoLm1pbihhLCB2WzFdKSwgSW5maW5pdHkpLFxyXG4gICAgICAgIG1heHg6IGNvcm5lcnMucmVkdWNlKChhLCB2KSA9PiBNYXRoLm1heChhLCB2WzBdKSwgLUluZmluaXR5KSxcclxuICAgICAgICBtYXh5OiBjb3JuZXJzLnJlZHVjZSgoYSwgdikgPT4gTWF0aC5tYXgoYSwgdlsxXSksIC1JbmZpbml0eSksXHJcbiAgICB9O1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gQ2xlYXJIaWdobGlnaHRzKGNhbnZhc2RpY3QpXHJcbntcclxuICAgIGxldCBjYW52YXMgPSBwY2IuR2V0TGF5ZXJDYW52YXMoXCJoaWdobGlnaHRzXCIsIChjYW52YXNkaWN0LmxheWVyID09PSBcIkZcIikpO1xyXG4gICAgQ2xlYXJDYW52YXMoY2FudmFzKTtcclxufVxyXG5cclxuZnVuY3Rpb24gQ2xlYXJDYW52YXMoY2FudmFzKSBcclxue1xyXG4gICAgbGV0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgICBjdHguc2F2ZSgpO1xyXG4gICAgY3R4LnNldFRyYW5zZm9ybSgxLCAwLCAwLCAxLCAwLCAwKTtcclxuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcclxuICAgIGN0eC5yZXN0b3JlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZXBhcmVMYXllcihjYW52YXNkaWN0LCBjYW52YXMpXHJcbntcclxuICAgIGxldCBmbGlwID0gKGNhbnZhc2RpY3QubGF5ZXIgIT0gXCJCXCIpO1xyXG5cclxuICAgIGlmKGNhbnZhc2RpY3QubGF5ZXIgPT09IFwiRlwiKVxyXG4gICAge1xyXG4gICAgICAgIHByZXBhcmVDYW52YXMoY2FudmFzLCBmbGlwLCBjYW52YXNkaWN0LnRyYW5zZm9ybSk7XHJcbiAgICB9XHJcbiAgICBlbHNlXHJcbiAgICB7XHJcbiAgICAgICAgcHJlcGFyZUNhbnZhcyhjYW52YXMsIGZsaXAsIGNhbnZhc2RpY3QudHJhbnNmb3JtKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gUmVkcmF3Q2FudmFzKGxheWVyZGljdClcclxue1xyXG4gICAgbGV0IHBjYkxheWVycyA9IHBjYi5HZXRMYXllcnMoKTtcclxuXHJcbiAgICBpZihsYXllcmRpY3QubGF5ZXIgPT09IFwiRlwiKVxyXG4gICAge1xyXG4gICAgICAgIGxldCBjYW52YXMgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwY2JMYXllcnMubGVuZ3RoOyBpKyspIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQocGNiTGF5ZXJzW2ldLmZyb250X2lkKTtcclxuICAgICAgICAgICAgcHJlcGFyZUxheWVyKGxheWVyZGljdCwgY2FudmFzKTtcclxuICAgICAgICAgICAgQ2xlYXJDYW52YXMoY2FudmFzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlXHJcbiAgICB7XHJcbiAgICAgICAgbGV0IGNhbnZhcyA9IHVuZGVmaW5lZDtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBjYkxheWVycy5sZW5ndGg7IGkrKykgXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChwY2JMYXllcnNbaV0uYmFja19pZCk7XHJcbiAgICAgICAgICAgIHByZXBhcmVMYXllcihsYXllcmRpY3QsIGNhbnZhcyk7XHJcbiAgICAgICAgICAgIENsZWFyQ2FudmFzKGNhbnZhcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBSZXNpemVDYW52YXMobGF5ZXJkaWN0KVxyXG57XHJcbiAgICBsZXQgZmxpcCA9IChsYXllcmRpY3QubGF5ZXIgIT0gXCJCXCIpO1xyXG4gICAgbGV0IHBjYkxheWVycyA9IHBjYi5HZXRMYXllcnMoKTtcclxuICAgIFxyXG4gICAgaWYobGF5ZXJkaWN0LmxheWVyID09PSBcIkZcIilcclxuICAgIHtcclxuICAgICAgICBsZXQgY2FudmFzID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGNiTGF5ZXJzLmxlbmd0aDsgaSsrKSBcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHBjYkxheWVyc1tpXS5mcm9udF9pZCk7XHJcbiAgICAgICAgICAgIHJlY2FsY0xheWVyU2NhbGUobGF5ZXJkaWN0LCBjYW52YXMpO1xyXG4gICAgICAgICAgICBwcmVwYXJlQ2FudmFzKGNhbnZhcywgZmxpcCwgbGF5ZXJkaWN0LnRyYW5zZm9ybSk7XHJcbiAgICAgICAgICAgIENsZWFyQ2FudmFzKGNhbnZhcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIGxldCBjYW52YXMgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwY2JMYXllcnMubGVuZ3RoOyBpKyspIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQocGNiTGF5ZXJzW2ldLmJhY2tfaWQpO1xyXG4gICAgICAgICAgICByZWNhbGNMYXllclNjYWxlKGxheWVyZGljdCwgY2FudmFzKTtcclxuICAgICAgICAgICAgcHJlcGFyZUNhbnZhcyhjYW52YXMsIGZsaXAsIGxheWVyZGljdC50cmFuc2Zvcm0pO1xyXG4gICAgICAgICAgICBDbGVhckNhbnZhcyhjYW52YXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgUmVzaXplQ2FudmFzLCBSZWRyYXdDYW52YXMsIHJvdGF0ZVZlY3RvciwgQ2xlYXJIaWdobGlnaHRzXHJcbn07XHJcblxyXG5cclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgUG9pbnQgPSByZXF1aXJlKFwiLi9wb2ludC5qc1wiKS5Qb2ludDtcclxuXHJcbmZ1bmN0aW9uIEFyYyhndWlDb250ZXh0LCBjZW50ZXJQb2ludCwgcmFkaXVzLCBhbmdsZVN0YXJ0LCBhbmdsZUVuZCwgcmVuZGVyT3B0aW9ucyApXHJcbntcclxuICAgIGd1aUNvbnRleHQuc2F2ZSgpO1xyXG5cclxuICAgIGlmKCByZW5kZXJPcHRpb25zLmNvbG9yKVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuZmlsbFN0eWxlICA9ICByZW5kZXJPcHRpb25zLmNvbG9yO1xyXG4gICAgICAgIGd1aUNvbnRleHQuc3Ryb2tlU3R5bGUgPSAgcmVuZGVyT3B0aW9ucy5jb2xvcjsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIC8vIElmIG92ZXJ3cml0aW5nIGxpbmUgd2lkdGgsIHRoZW4gdXBkYXRlIHRoYXQgaGVyZVxyXG4gICAgaWYocmVuZGVyT3B0aW9ucy5saW5lV2lkdGgpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5saW5lV2lkdGggPSByZW5kZXJPcHRpb25zLmxpbmVXaWR0aDtcclxuICAgIH1cclxuXHJcbiAgICBpZihyZW5kZXJPcHRpb25zLmxpbmVDYXApXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5saW5lQ2FwID0gcmVuZGVyT3B0aW9ucy5saW5lQ2FwO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvLyBodHRwczovL3d3dy53M3NjaG9vbHMuY29tL3RhZ3MvY2FudmFzX2FyYy5hc3BcclxuICAgIGd1aUNvbnRleHQuYmVnaW5QYXRoKCk7XHJcbiAgICBndWlDb250ZXh0LmFyYyggY2VudGVyUG9pbnQueCwgY2VudGVyUG9pbnQueSwgcmFkaXVzLCBhbmdsZVN0YXJ0Kk1hdGguUEkvMTgwLCBhbmdsZUVuZCpNYXRoLlBJLzE4MCk7XHJcblxyXG4gICAgLy8gSWYgZmlsbCBpcyB0cnVlLCBmaWxsIHRoZSBib3gsIG90aGVyd2lzZSBqdXN0IG1ha2UgYW4gb3V0bGluZVxyXG4gICAgaWYocmVuZGVyT3B0aW9ucy5maWxsKVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuZmlsbCgpO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuc3Ryb2tlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZ3VpQ29udGV4dC5yZXN0b3JlKCk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBMaW5lKGd1aUNvbnRleHQsIHN0YXJ0UG9pbnQsIGVuZFBvaW50LCByZW5kZXJPcHRpb25zIClcclxue1xyXG4gICAgZ3VpQ29udGV4dC5zYXZlKCk7XHJcblxyXG4gICAgaWYoIHJlbmRlck9wdGlvbnMuY29sb3IpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5maWxsU3R5bGUgICA9ICByZW5kZXJPcHRpb25zLmNvbG9yO1xyXG4gICAgICAgIGd1aUNvbnRleHQuc3Ryb2tlU3R5bGUgPSAgcmVuZGVyT3B0aW9ucy5jb2xvcjsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIC8vIElmIG92ZXJ3cml0aW5nIGxpbmUgd2lkdGgsIHRoZW4gdXBkYXRlIHRoYXQgaGVyZVxyXG4gICAgaWYocmVuZGVyT3B0aW9ucy5saW5lV2lkdGgpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5saW5lV2lkdGggPSByZW5kZXJPcHRpb25zLmxpbmVXaWR0aDtcclxuICAgIH1cclxuXHJcbiAgICBpZihyZW5kZXJPcHRpb25zLmxpbmVDYXApXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5saW5lQ2FwID0gcmVuZGVyT3B0aW9ucy5saW5lQ2FwO1xyXG4gICAgfVxyXG5cclxuICAgIGd1aUNvbnRleHQuYmVnaW5QYXRoKCk7XHJcbiAgICBndWlDb250ZXh0Lm1vdmVUbyhzdGFydFBvaW50LngsIHN0YXJ0UG9pbnQueSk7XHJcbiAgICBndWlDb250ZXh0LmxpbmVUbyhlbmRQb2ludC54LCBlbmRQb2ludC55KTtcclxuXHJcbiAgICAvLyBJZiBmaWxsIGlzIHRydWUsIGZpbGwgdGhlIGJveCwgb3RoZXJ3aXNlIGp1c3QgbWFrZSBhbiBvdXRsaW5lXHJcbiAgICBpZihyZW5kZXJPcHRpb25zLmZpbGwpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5maWxsKCk7XHJcbiAgICB9XHJcbiAgICBlbHNlXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5zdHJva2UoKTtcclxuICAgIH1cclxuXHJcbiAgICBndWlDb250ZXh0LnJlc3RvcmUoKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIFJlZ3VsYXJQb2x5Z29uKGd1aUNvbnRleHQsIGNlbnRlclBvaW50LCB2ZXJ0aWNlcywgYW5nbGUsIHJlbmRlck9wdGlvbnMgKVxyXG57XHJcblxyXG4gICAgZ3VpQ29udGV4dC5zYXZlKCk7XHJcbiAgICBpZiggcmVuZGVyT3B0aW9ucy5jb2xvcilcclxuICAgIHtcclxuICAgICAgICBndWlDb250ZXh0LmZpbGxTdHlsZSAgPSAgcmVuZGVyT3B0aW9ucy5jb2xvcjtcclxuICAgICAgICBndWlDb250ZXh0LnN0cm9rZVN0eWxlID0gIHJlbmRlck9wdGlvbnMuY29sb3I7ICAgICAgICBcclxuICAgIH1cclxuICAgIC8vIElmIG92ZXJ3cml0aW5nIGxpbmUgd2lkdGgsIHRoZW4gdXBkYXRlIHRoYXQgaGVyZVxyXG4gICAgaWYocmVuZGVyT3B0aW9ucy5saW5lV2lkdGgpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5saW5lV2lkdGggPSByZW5kZXJPcHRpb25zLmxpbmVXaWR0aDtcclxuICAgIH1cclxuXHJcbiAgICBpZihyZW5kZXJPcHRpb25zLmdsb2JhbEFscGhhKVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuZ2xvYmFsQWxwaGEgPSByZW5kZXJPcHRpb25zLmdsb2JhbEFscGhhO1xyXG4gICAgfVxyXG5cclxuICAgIGd1aUNvbnRleHQudHJhbnNsYXRlKGNlbnRlclBvaW50LngsIGNlbnRlclBvaW50LnkpO1xyXG4gICAgLyogXHJcbiAgICAgICBSb3RhdGUgb3JpZ2luIGJhc2VkIG9uIGFuZ2xlIGdpdmVuXHJcbiAgICAgICBOT1RFOiBjb21wYXJlZCB0byBvYmxvbmcgcGFkcywgbm8gYWRkaXRpb25hbCBtb2RpZmljYXRpb24gaXMgcmVxdWlyZWRcclxuICAgICAgICAgICAgIG9mIGFuZ2xlIHRvIGdldCB0aGUgYW5nbGUgdG8gcm90YXRlIGNvcnJlY3RseS5cclxuICAgICovXHJcbiAgICBndWlDb250ZXh0LnJvdGF0ZShhbmdsZSpNYXRoLlBJLzE4MCk7XHJcblxyXG4gICAgLyogXHJcbiAgICAgICBSb3RhdGUgb3JpZ2luIGJhc2VkIG9uIGFuZ2xlIGdpdmVuXHJcbiAgICAgICBOT1RFOiBjb21wYXJlZCB0byBvYmxvbmcgcGFkcywgbm8gYWRkaXRpb25hbCBtb2RpZmljYXRpb24gaXMgcmVxdWlyZWRcclxuICAgICAgICAgICAgIG9mIGFuZ2xlIHRvIGdldCB0aGUgYW5nbGUgdG8gcm90YXRlIGNvcnJlY3RseS5cclxuICAgICovXHJcbiAgICAvL2d1aUNvbnRleHQucm90YXRlKChhbmdsZSkqTWF0aC5QSS8xODApO1xyXG5cclxuICAgIGd1aUNvbnRleHQuYmVnaW5QYXRoKCk7XHJcbiAgICBndWlDb250ZXh0Lm1vdmVUbyh2ZXJ0aWNlc1swXS54LHZlcnRpY2VzWzBdLnkpO1xyXG5cclxuICAgIGZvcih2YXIgaSA9IDE7IGkgPCB2ZXJ0aWNlcy5sZW5ndGg7IGkrKylcclxuICAgIHtcclxuICAgICAgICBndWlDb250ZXh0LmxpbmVUbyh2ZXJ0aWNlc1tpXS54LHZlcnRpY2VzW2ldLnkpO1xyXG4gICAgfVxyXG4gICAgZ3VpQ29udGV4dC5jbG9zZVBhdGgoKTtcclxuICAgIFxyXG4gICAgLy8gSWYgZmlsbCBpcyB0cnVlLCBmaWxsIHRoZSBib3gsIG90aGVyd2lzZSBqdXN0IG1ha2UgYW4gb3V0bGluZVxyXG4gICAgaWYocmVuZGVyT3B0aW9ucy5maWxsKVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuZmlsbCgpO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuc3Ryb2tlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZ3VpQ29udGV4dC5yZXN0b3JlKCk7XHJcblxyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gSXJyZWd1bGFyUG9seWdvbihndWlDb250ZXh0LCB2ZXJ0aWNlcywgcmVuZGVyT3B0aW9ucyApXHJcbntcclxuXHJcbiAgICBndWlDb250ZXh0LnNhdmUoKTtcclxuICAgIGlmKCByZW5kZXJPcHRpb25zLmNvbG9yKVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuZmlsbFN0eWxlICA9ICByZW5kZXJPcHRpb25zLmNvbG9yO1xyXG4gICAgICAgIGd1aUNvbnRleHQuc3Ryb2tlU3R5bGUgPSAgcmVuZGVyT3B0aW9ucy5jb2xvcjsgICAgICAgIFxyXG4gICAgfVxyXG4gICAgLy8gSWYgb3ZlcndyaXRpbmcgbGluZSB3aWR0aCwgdGhlbiB1cGRhdGUgdGhhdCBoZXJlXHJcbiAgICBpZihyZW5kZXJPcHRpb25zLmxpbmVXaWR0aClcclxuICAgIHtcclxuICAgICAgICBndWlDb250ZXh0LmxpbmVXaWR0aCA9IHJlbmRlck9wdGlvbnMubGluZVdpZHRoO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKHJlbmRlck9wdGlvbnMuZ2xvYmFsQWxwaGEpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5nbG9iYWxBbHBoYSA9IHJlbmRlck9wdGlvbnMuZ2xvYmFsQWxwaGE7XHJcbiAgICB9XHJcblxyXG4gICAgaWYocmVuZGVyT3B0aW9ucy5jb21wb3NpdGlvblR5cGUpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5nbG9iYWxDb21wb3NpdGVPcGVyYXRpb24gID0gcmVuZGVyT3B0aW9ucy5jb21wb3NpdGlvblR5cGU7XHJcbiAgICB9XHJcblxyXG4gICAgZ3VpQ29udGV4dC5iZWdpblBhdGgoKTtcclxuICAgIGd1aUNvbnRleHQubW92ZVRvKHZlcnRpY2VzWzBdLngsdmVydGljZXNbMF0ueSk7XHJcblxyXG4gICAgZm9yKHZhciBpID0gMTsgaSA8IHZlcnRpY2VzLmxlbmd0aDsgaSsrKVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQubGluZVRvKHZlcnRpY2VzW2ldLngsdmVydGljZXNbaV0ueSk7XHJcbiAgICB9XHJcbiAgICBndWlDb250ZXh0LmNsb3NlUGF0aCgpO1xyXG5cclxuICAgIC8vIElmIGZpbGwgaXMgdHJ1ZSwgZmlsbCB0aGUgYm94LCBvdGhlcndpc2UganVzdCBtYWtlIGFuIG91dGxpbmVcclxuICAgIGlmKHJlbmRlck9wdGlvbnMuZmlsbClcclxuICAgIHtcclxuICAgICAgICBndWlDb250ZXh0LmZpbGwoKTtcclxuICAgIH1cclxuICAgIGVsc2VcclxuICAgIHtcclxuICAgICAgICBndWlDb250ZXh0LnN0cm9rZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGd1aUNvbnRleHQucmVzdG9yZSgpO1xyXG5cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIENpcmNsZShndWlDb250ZXh0LCBjZW50ZXJQb2ludCwgcmFkaXVzLCByZW5kZXJPcHRpb25zKVxyXG57XHJcbiAgICBndWlDb250ZXh0LnNhdmUoKTtcclxuICAgIFxyXG4gICAgaWYoIHJlbmRlck9wdGlvbnMuY29sb3IpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5maWxsU3R5bGUgID0gIHJlbmRlck9wdGlvbnMuY29sb3I7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5zdHJva2VTdHlsZSA9ICByZW5kZXJPcHRpb25zLmNvbG9yOyAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgaWYocmVuZGVyT3B0aW9ucy5saW5lV2lkdGgpXHJcbiAgICB7XHJcbiAgICAgICAgZ3VpQ29udGV4dC5saW5lV2lkdGggPSByZW5kZXJPcHRpb25zLmxpbmVXaWR0aDtcclxuICAgIH1cclxuXHJcbiAgICAvKiBEcmF3IHRoZSBkcmlsbCBob2xlICovXHJcbiAgICBndWlDb250ZXh0LmJlZ2luUGF0aCgpO1xyXG4gICAgZ3VpQ29udGV4dC5hcmMoY2VudGVyUG9pbnQueCxjZW50ZXJQb2ludC55LCByYWRpdXMsIDAsIDIqTWF0aC5QSSk7XHJcblxyXG4gICAgaWYocmVuZGVyT3B0aW9ucy5maWxsKVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuZmlsbCgpO1xyXG4gICAgfVxyXG4gICAgZWxzZVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuc3Ryb2tlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZ3VpQ29udGV4dC5yZXN0b3JlKCk7XHJcbn1cclxuXHJcblxyXG4vKlxyXG4gICAgVG8gcmVuZGVyIGFuIG92YWwgc29tZSBqYXZhc2NyaXB0IHRyaWNrZXJ5IGlzIHVzZWQuIFRvIGhhbGYgY2lyY2xlcyBhcmUgcmVuZGVyZWQsIFxyXG4gICAgYW5kIHNpbmNlIGJ5IGRlZmF1bHQgd2hlbiBkcmF3aW5nIHNoYXBlcyB0aGV5IHdpbGwgYnkgZGVmYXVsdCBiZSBjb25uZWN0ZWQgYnkgYXQgXHJcbiAgICBsZWFzdCBvbmUgcG9pbnQgaWYgY2xvc2UgcGF0aCBpcyBub3QgY2FsbGVkLiBTbyBieSBqdXN0IGNhbGxpbmcgdGhlIHRvcCBhbmQgYm90dG9tIFxyXG4gICAgaGFsZiBjaXJjbGVzLCB0aGUgcmVjdGFuZ3VsYXIgY2VudGVyIG9mIHRoZSBoYWxmIGNpcmNsZSB3aWxsIGJlIGZpbGxlZC5cclxuKi9cclxuZnVuY3Rpb24gT3ZhbChndWlDb250ZXh0LCBjZW50ZXJQb2ludCwgaGVpZ2h0LCB3aWR0aCwgYW5nbGUsIHJlbmRlck9wdGlvbnMpXHJcbntcclxuXHJcbiAgICAvLyBDZW50ZXIgcG9pbnQgb2YgYm90aCBjaXJjbGVzLlxyXG4gICAgbGV0IGNlbnRlclBvaW50MSA9IG5ldyBQb2ludCgwLCAtaGVpZ2h0LzIpO1xyXG4gICAgbGV0IGNlbnRlclBvaW50MiA9IG5ldyBQb2ludCgwLCBoZWlnaHQvMik7XHJcbiAgICBsZXQgcmFkaXVzID0gd2lkdGgvMjtcclxuXHJcbiAgICBndWlDb250ZXh0LnNhdmUoKTtcclxuICAgIGlmKCByZW5kZXJPcHRpb25zLmNvbG9yKVxyXG4gICAge1xyXG4gICAgICAgIGd1aUNvbnRleHQuZmlsbFN0eWxlICA9ICByZW5kZXJPcHRpb25zLmNvbG9yO1xyXG4gICAgICAgIGd1aUNvbnRleHQuc3Ryb2tlU3R5bGUgPSAgcmVuZGVyT3B0aW9ucy5jb2xvcjtcclxuICAgIH1cclxuXHJcbiAgICAvKlxyXG4gICAgICAgIFRoZSBmb2xsb3dpbmcgb25seSByZWFsbHkgbmVlZHMgdG8gZHJhdyB0d28gc2VtaWNpcmNsZXMgYXMgaW50ZXJuYWxseSB0aGUgc2VtaWNpcmNsZXMgd2lsbCBcclxuICAgICAgICBhdHRhY2ggdG8gZWFjaCBvdGhlciB0byBjcmVhdGUgdGhlIGNvbXBsZXRlZCBvYmplY3QuXHJcbiAgICAgKi9cclxuXHJcbiAgICBndWlDb250ZXh0LnRyYW5zbGF0ZShjZW50ZXJQb2ludC54LCBjZW50ZXJQb2ludC55KTtcclxuICAgIC8qIFxyXG4gICAgICAgUm90YXRlIG9yaWdpbiBiYXNlZCBvbiBhbmdsZSBnaXZlblxyXG4gICAgICAgTk9URTogRm9yIHNvbWUgcmVhc29uIEVhZ2xlQ0FEIGl0ZW1zIGFyZSByb3RhdGVkIGJ5IDkwIGRlZ3JlZXMgYnkgZGVmYXVsdC4gXHJcbiAgICAgICAgICAgICBUaGlzIGNvcnJlY3RzIGZvciB0aGF0IHNvIGl0ZW1zIGFyZSBkaXNwbGF5ZWQgY29ycmVjdGx5LlxyXG4gICAgICAgICAgICAgVGhpcyBzZWVtcyB0byBhbHNvIG9ubHkgYmUgcmVxdWlyZWQgZm9yIG9ibG9uZyBwYWRzLiBUaGlzIGlzIG1vc3QgbGlrZWx5IGR1ZSB0byB0aGUgXHJcbiAgICAgICAgICAgICBhcmMgZnVuY3Rpb25zIHVzZWQuXHJcbiAgICAqL1xyXG4gICAgZ3VpQ29udGV4dC5yb3RhdGUoKGFuZ2xlLTkwKSpNYXRoLlBJLzE4MCk7XHJcblxyXG4gICAgZ3VpQ29udGV4dC5iZWdpblBhdGgoKTtcclxuICAgIGd1aUNvbnRleHQuYXJjKGNlbnRlclBvaW50MS54LCBjZW50ZXJQb2ludDEueSwgcmFkaXVzLCBNYXRoLlBJLDApO1xyXG4gICAgZ3VpQ29udGV4dC5hcmMoY2VudGVyUG9pbnQyLngsIGNlbnRlclBvaW50Mi55LCByYWRpdXMsIDAsIE1hdGguUEkgKTtcclxuICAgIGd1aUNvbnRleHQuY2xvc2VQYXRoKCk7XHJcbiAgICBcclxuICAgIGlmKHJlbmRlck9wdGlvbnMuZmlsbClcclxuICAgIHtcclxuICAgICAgICBndWlDb250ZXh0LmZpbGwoKTtcclxuICAgIH1cclxuICAgIGVsc2VcclxuICAgIHtcclxuICAgICAgICBndWlDb250ZXh0LnN0cm9rZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFJlc3RvcmVzIGNvbnRleHQgdG8gc3RhdGUgcHJpb3IgdG8gdGhpcyByZW5kZXJpbmcgZnVuY3Rpb24gYmVpbmcgY2FsbGVkLiBcclxuICAgIGd1aUNvbnRleHQucmVzdG9yZSgpO1xyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBBcmMsIExpbmUsIFJlZ3VsYXJQb2x5Z29uLCBJcnJlZ3VsYXJQb2x5Z29uLCBDaXJjbGUsIE92YWxcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbnZhciByZW5kZXJfbG93bGV2ZWwgICAgID0gcmVxdWlyZShcIi4vcmVuZGVyX2xvd2xldmVsLmpzXCIpO1xyXG52YXIgUG9pbnQgICAgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL3BvaW50LmpzXCIpLlBvaW50O1xyXG5cclxuZnVuY3Rpb24gRHJhd0RyaWxsSG9sZShndWlDb250ZXh0LCB4LCB5LCByYWRpdXMpXHJcbntcclxuXHJcbiAgICBsZXQgY2VudGVyUG9pbnQgPSBuZXcgUG9pbnQoeCwgeSk7XHJcblxyXG5cclxuICAgIGxldCByZW5kZXJPcHRpb25zID0ge1xyXG4gICAgICAgIGNvbG9yOiBcIiNDQ0NDQ0NcIixcclxuICAgICAgICBmaWxsOiB0cnVlLFxyXG4gICAgfTtcclxuXHJcbiAgICByZW5kZXJfbG93bGV2ZWwuQ2lyY2xlKFxyXG4gICAgICAgIGd1aUNvbnRleHQsXHJcbiAgICAgICAgY2VudGVyUG9pbnQsICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIHJhZGl1cywgXHJcbiAgICAgICAgcmVuZGVyT3B0aW9uc1xyXG4gICAgKTsgICAgICAgICAgICAgICAgICAgICBcclxufVxyXG5cclxuZnVuY3Rpb24gUmVjdGFuZ2xlKGd1aUNvbnRleHQsIHBhZCwgY29sb3IpXHJcbntcclxuICAgIGxldCBjZW50ZXJQb2ludCA9IG5ldyBQb2ludChwYWQueCwgcGFkLnkpO1xyXG5cclxuICAgIC8qXHJcbiAgICAgICAgICAgIFRoZSBmb2xsb3dpbmcgZGVyaXZlIHRoZSBjb3JuZXIgcG9pbnRzIGZvciB0aGVcclxuICAgICAgICAgICAgcmVjdGFuZ3VsYXIgcGFkLiBUaGVzZSBhcmUgY2FsY3VsYXRlZCB1c2luZyB0aGUgY2VudGVyIFxyXG4gICAgICAgICAgICBwb2ludCBvZiB0aGUgcmVjdGFuZ2xlIGFsb25nIHdpdGggdGhlIHdpZHRoIGFuZCBoZWlnaHQgXHJcbiAgICAgICAgICAgIG9mIHRoZSByZWN0YW5nbGUuIFxyXG4gICAgKi9cclxuICAgIC8vIFRvcCBsZWZ0IHBvaW50XHJcbiAgICBsZXQgcG9pbnQwID0gbmV3IFBvaW50KC1wYWQuZHgvMiwgcGFkLmR5LzIpO1xyXG4gICAgLy8gVG9wIHJpZ2h0IHBvaW50XHJcbiAgICBsZXQgcG9pbnQxID0gbmV3IFBvaW50KHBhZC5keC8yLCBwYWQuZHkvMik7XHJcbiAgICAvLyBCb3R0b20gcmlnaHQgcG9pbnRcclxuICAgIGxldCBwb2ludDIgPSBuZXcgUG9pbnQocGFkLmR4LzIsIC1wYWQuZHkvMik7XHJcbiAgICAvLyBCb3R0b20gbGVmdCBwb2ludFxyXG4gICAgbGV0IHBvaW50MyA9IG5ldyBQb2ludCgtcGFkLmR4LzIsIC1wYWQuZHkvMik7XHJcblxyXG5cclxuICAgIGxldCByZW5kZXJPcHRpb25zID0ge1xyXG4gICAgICAgIGNvbG9yOiBjb2xvcixcclxuICAgICAgICBmaWxsOiB0cnVlLFxyXG4gICAgfTtcclxuXHJcbiAgICByZW5kZXJfbG93bGV2ZWwuUmVndWxhclBvbHlnb24oIFxyXG4gICAgICAgIGd1aUNvbnRleHQsXHJcbiAgICAgICAgY2VudGVyUG9pbnQsIFxyXG4gICAgICAgIFtwb2ludDAsIHBvaW50MSwgcG9pbnQyLCBwb2ludDNdLFxyXG4gICAgICAgIHBhZC5hbmdsZSxcclxuICAgICAgICByZW5kZXJPcHRpb25zXHJcbiAgICApO1xyXG5cclxuICAgIGlmKHBhZC5wYWRfdHlwZSA9PSBcInRodFwiKVxyXG4gICAge1xyXG4gICAgICAgIERyYXdEcmlsbEhvbGUoZ3VpQ29udGV4dCwgcGFkLngsIHBhZC55LCBwYWQuZHJpbGwvMik7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qXHJcbiAgICBBbiBvYmxvbmcgcGFkIGNhbiBiZSB0aG91Z2h0IG9mIGFzIGhhdmluZyBhIHJlY3Rhbmd1bGFyIG1pZGRsZSB3aXRoIHR3byBzZW1pY2lyY2xlIGVuZHMuIFxyXG5cclxuICAgIEVhZ2xlQ0FEIHByb3ZpZGVzIHByb3ZpZGVzIHRocmVlIHBpZWNlcyBvZiBpbmZvcm1hdGlvbiBmb3IgZ2VuZXJhdGluZyB0aGVzZSBwYWRzLiBcclxuICAgICAgICAxKSBDZW50ZXIgcG9pbnQgPSBDZW50ZXIgb2YgcGFydFxyXG4gICAgICAgIDIpIERpYW1ldGVyID0gZGlzdGFuY2UgZnJvbSBjZW50ZXIgcG9pbnQgdG8gZWRnZSBvZiBzZW1pY2lyY2xlXHJcbiAgICAgICAgMykgRWxvbmdhdGlvbiA9JSByYXRpbyByZWxhdGluZyBkaWFtZXRlciB0byB3aWR0aFxyXG5cclxuICAgIFRoZSBkZXNpZ24gYWxzbyBoYXMgNCBwb2ludHMgb2YgIGludGVyZXN0LCBlYWNoIHJlcHJlc2VudGluZyB0aGUgXHJcbiAgICBjb3JuZXIgb2YgdGhlIHJlY3RhbmdsZS4gXHJcblxyXG4gICAgVG8gcmVuZGVyIHRoZSBsZW5ndGggYW5kIHdpZHRoIGFyZSBkZXJpdmVkLiBUaGlzIGlzIGRpdmlkZWQgaW4gaGFsZiB0byBnZXQgdGhlIFxyXG4gICAgdmFsdWVzIHVzZWQgdG8gdHJhbnNsYXRlIHRoZSBjZW50cmFsIHBvaW50IHRvIG9uZSBvZiB0aGUgdmVydGljaWVzLiBcclxuKi9cclxuZnVuY3Rpb24gT2Jsb25nKGd1aUNvbnRleHQsIHBhZCwgY29sb3IpXHJcbnsgICAgXHJcbiAgICAvLyBEaWFtZXRlciBpcyB0aGUgZGlzbmNlIGZyb20gY2VudGVyIG9mIHBhZCB0byB0aXAgb2YgY2lyY2xlXHJcbiAgICAvLyBlbG9uZ2F0aW9uIGlzIGEgZmFjdG9yIHRoYXQgcmVsYXRlZCB0aGUgZGlhbWV0ZXIgdG8gdGhlIHdpZHRoXHJcbiAgICAvLyBUaGlzIGlzIHRoZSB0b3RhbCB3aWR0aFxyXG4gICAgbGV0IHdpZHRoICAgPSBwYWQuZGlhbWV0ZXIqcGFkLmVsb25nYXRpb24vMTAwO1xyXG4gICAgXHJcbiAgICAvLyBUSGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSBpcyB0aGUgZGlhbWV0ZXIgLWhhbGYgdGhlIHJhZGl1cy5cclxuICAgIC8vIFNlZSBkb2N1bWVudGF0aW9uIG9uIGhvdyB0aGVzZSBhcmUgY2FsY3VsYXRlZC5cclxuICAgIGxldCBoZWlnaHQgID0gKHBhZC5kaWFtZXRlci13aWR0aC8yKSoyO1xyXG5cclxuICAgIC8vIGFzc3VtZXMgb3ZhbCBpcyBjZW50ZXJlZCBhdCAoMCwwKVxyXG4gICAgbGV0IGNlbnRlclBvaW50ID0gbmV3IFBvaW50KHBhZC54LCBwYWQueSk7XHJcblxyXG4gICAgbGV0IHJlbmRlck9wdGlvbnMgPSB7IFxyXG4gICAgICAgIGNvbG9yOiBjb2xvcixcclxuICAgICAgICBmaWxsOiB0cnVlLFxyXG4gICAgfTtcclxuXHJcbiAgICByZW5kZXJfbG93bGV2ZWwuT3ZhbCggXHJcbiAgICAgICAgZ3VpQ29udGV4dCxcclxuICAgICAgICBjZW50ZXJQb2ludCxcclxuICAgICAgICBoZWlnaHQsXHJcbiAgICAgICAgd2lkdGgsXHJcbiAgICAgICAgcGFkLmFuZ2xlLFxyXG4gICAgICAgIHJlbmRlck9wdGlvbnNcclxuICAgICk7XHJcblxyXG4gICAgLyogT25seSBkcmF3IGRyaWxsIGhvbGUgaWYgdGh0IHR5cGUgcGFkICovXHJcbiAgICBpZihwYWQucGFkX3R5cGUgPT0gXCJ0aHRcIilcclxuICAgIHtcclxuICAgICAgICBEcmF3RHJpbGxIb2xlKGd1aUNvbnRleHQsIHBhZC54LCBwYWQueSwgcGFkLmRyaWxsLzIpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBSb3VuZChndWlDb250ZXh0LCBwYWQsIGNvbG9yKVxyXG57XHJcbiAgICBsZXQgY2VudGVyUG9pbnQgPSBuZXcgUG9pbnQocGFkLngsIHBhZC55KTtcclxuXHJcbiAgICBsZXQgcmVuZGVyT3B0aW9ucyA9IHtcclxuICAgICAgICBjb2xvcjogY29sb3IsXHJcbiAgICAgICAgZmlsbDogdHJ1ZSxcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLkNpcmNsZSggXHJcbiAgICAgICAgZ3VpQ29udGV4dCxcclxuICAgICAgICBjZW50ZXJQb2ludCwgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgcGFkLmRyaWxsLCBcclxuICAgICAgICByZW5kZXJPcHRpb25zXHJcbiAgICApOyBcclxuXHJcbiAgICBpZihwYWQucGFkX3R5cGUgPT0gXCJ0aHRcIilcclxuICAgIHtcclxuICAgICAgICBEcmF3RHJpbGxIb2xlKGd1aUNvbnRleHQsIHBhZC54LCBwYWQueSwgcGFkLmRyaWxsLzIpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBPY3RhZ29uKGd1aUNvbnRleHQsIHBhZCwgY29sb3IpXHJcbntcclxuICAgIC8vIFdpbGwgc3RvcmUgdGhlIHZlcnRpY2llcyBvZiB0aGUgcG9seWdvbi5cclxuICAgIGxldCBwb2x5Z29uVmVydGljaWVzID0gW107XHJcblxyXG4gICAgXHJcbiAgICBsZXQgbiA9IDg7XHJcbiAgICBsZXQgciA9IHBhZC5kaWFtZXRlci8yO1xyXG4gICAgLy8gQXNzdW1lcyBhIHBvbHlnb24gY2VudGVyZWQgYXQgKDAsMClcclxuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IG47IGkrKykgXHJcbiAgICB7XHJcbiAgICAgICAgcG9seWdvblZlcnRpY2llcy5wdXNoKG5ldyBQb2ludChyICogTWF0aC5jb3MoMiAqIE1hdGguUEkgKiBpIC8gbiksIHIgKiBNYXRoLnNpbigyICogTWF0aC5QSSAqIGkgLyBuKSkpO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBhbmdsZSA9IChwYWQuYW5nbGUrNDUvMik7XHJcbiAgICBsZXQgY2VudGVyUG9pbnQgPSBuZXcgUG9pbnQocGFkLngsIHBhZC55KTtcclxuXHJcbiAgICBsZXQgcmVuZGVyT3B0aW9ucyA9IHsgXHJcbiAgICAgICAgY29sb3I6IGNvbG9yLFxyXG4gICAgICAgIGZpbGw6IHRydWUsXHJcbiAgICB9O1xyXG5cclxuICAgIHJlbmRlcl9sb3dsZXZlbC5SZWd1bGFyUG9seWdvbiggXHJcbiAgICAgICAgZ3VpQ29udGV4dCxcclxuICAgICAgICBjZW50ZXJQb2ludCwgXHJcbiAgICAgICAgcG9seWdvblZlcnRpY2llcyxcclxuICAgICAgICBhbmdsZSxcclxuICAgICAgICByZW5kZXJPcHRpb25zXHJcbiAgICApO1xyXG5cclxuICAgIC8qIE9ubHkgZHJhdyBkcmlsbCBob2xlIGlmIHRodCB0eXBlIHBhZCAqL1xyXG4gICAgaWYocGFkLnBhZF90eXBlID09IFwidGh0XCIpXHJcbiAgICB7XHJcbiAgICAgICAgRHJhd0RyaWxsSG9sZShndWlDb250ZXh0LCBwYWQueCwgcGFkLnksIHBhZC5kcmlsbC8yKTtcclxuICAgIH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBSZWN0YW5nbGUsIE9ibG9uZywgUm91bmQsIE9jdGFnb25cclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbnZhciByZW5kZXJfbG93bGV2ZWwgICAgID0gcmVxdWlyZShcIi4vcmVuZGVyX2xvd2xldmVsLmpzXCIpO1xyXG52YXIgUG9pbnQgICAgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL3BvaW50LmpzXCIpLlBvaW50O1xyXG5cclxuLy8gTGluZSB3aWR0aCBpcyBub3QgaW5jbHVkZWQgYXMgcGFydCBvZiB0aGUgdHJhY2UgYXMgaXQgd2lsbCBkZXBlbmQgb24gdGhlIGN1cnJlbnQgZ3VpIHNjYWxlIGZhY3Rvci5cclxuZnVuY3Rpb24gQXJjKGd1aUNvbnRleHQsIHRyYWNlLCBsaW5lV2lkdGgsIGNvbG9yKVxyXG57XHJcblxyXG4gICAgbGV0IGNlbnRlclBvaW50ID0gbmV3IFBvaW50KHRyYWNlLmN4MCwgdHJhY2UuY3kwKTtcclxuXHJcblxyXG4gICAgbGV0IHJlbmRlck9wdGlvbnMgPSB7IFxyXG4gICAgICAgIGNvbG9yOiBjb2xvcixcclxuICAgICAgICBmaWxsOiBmYWxzZSxcclxuICAgICAgICBsaW5lV2lkdGg6IGxpbmVXaWR0aCxcclxuICAgICAgICBsaW5lQ2FwOiBcInJvdW5kXCIgXHJcbiAgICB9O1xyXG5cclxuICAgIHJlbmRlcl9sb3dsZXZlbC5BcmMoIFxyXG4gICAgICAgIGd1aUNvbnRleHQsXHJcbiAgICAgICAgY2VudGVyUG9pbnQsXHJcbiAgICAgICAgdHJhY2UucmFkaXVzLFxyXG4gICAgICAgIHRyYWNlLmFuZ2xlMCxcclxuICAgICAgICB0cmFjZS5hbmdsZTEsXHJcbiAgICAgICAgcmVuZGVyT3B0aW9uc1xyXG4gICAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gTGluZShndWlDb250ZXh0LCB0cmFjZSwgbGluZVdpZHRoLCBjb2xvcilcclxue1xyXG4gICAgbGV0IHN0YXJ0UG9pbnQgPSBuZXcgUG9pbnQodHJhY2UueDAsIHRyYWNlLnkwKTtcclxuICAgIGxldCBlbmRQb2ludCAgID0gbmV3IFBvaW50KHRyYWNlLngxLCB0cmFjZS55MSk7XHJcblxyXG4gICAgbGV0IHJlbmRlck9wdGlvbnMgPSB7IFxyXG4gICAgICAgIGNvbG9yOiBjb2xvcixcclxuICAgICAgICBmaWxsOiBmYWxzZSxcclxuICAgICAgICBsaW5lV2lkdGg6IGxpbmVXaWR0aCxcclxuICAgICAgICBsaW5lQ2FwOiBcInJvdW5kXCIgXHJcbiAgICB9O1xyXG5cclxuICAgIHJlbmRlcl9sb3dsZXZlbC5MaW5lKCBcclxuICAgICAgICBndWlDb250ZXh0LFxyXG4gICAgICAgIHN0YXJ0UG9pbnQsXHJcbiAgICAgICAgZW5kUG9pbnQsXHJcbiAgICAgICAgcmVuZGVyT3B0aW9uc1xyXG4gICAgKTtcclxufVxyXG5cclxuLy8gTGluZSB3aWR0aCBpcyBub3QgaW5jbHVkZWQgYXMgcGFydCBvZiB0aGUgdHJhY2UgYXMgaXQgd2lsbCBkZXBlbmQgb24gdGhlIGN1cnJlbnQgZ3VpIHNjYWxlIGZhY3Rvci5cclxuZnVuY3Rpb24gQ2lyY2xlKGd1aUNvbnRleHQsIHRyYWNlLCBsaW5lV2lkdGgsIGNvbG9yKVxyXG57XHJcblxyXG4gICAgbGV0IGNlbnRlclBvaW50ID0gbmV3IFBvaW50KHRyYWNlLmN4MCwgdHJhY2UuY3kwKTtcclxuXHJcbiAgICBsZXQgcmVuZGVyT3B0aW9ucyA9IHsgXHJcbiAgICAgICAgY29sb3I6IGNvbG9yLFxyXG4gICAgICAgIGZpbGw6IGZhbHNlLFxyXG4gICAgICAgIGxpbmVXaWR0aDogbGluZVdpZHRoLFxyXG4gICAgICAgIGxpbmVDYXA6IFwicm91bmRcIiBcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLkFyYyggXHJcbiAgICAgICAgZ3VpQ29udGV4dCxcclxuICAgICAgICBjZW50ZXJQb2ludCxcclxuICAgICAgICB0cmFjZS5yYWRpdXMsXHJcbiAgICAgICAgMCwgXHJcbiAgICAgICAgMipNYXRoLlBJLFxyXG4gICAgICAgIHJlbmRlck9wdGlvbnNcclxuICAgICk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgQXJjLCBMaW5lLCBDaXJjbGVcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbnZhciByZW5kZXJfbG93bGV2ZWwgICAgID0gcmVxdWlyZShcIi4vcmVuZGVyX2xvd2xldmVsLmpzXCIpO1xyXG52YXIgUG9pbnQgICAgICAgICAgICAgICA9IHJlcXVpcmUoXCIuL3BvaW50LmpzXCIpLlBvaW50O1xyXG5cclxuLy8gTGluZSB3aWR0aCBpcyBub3QgaW5jbHVkZWQgYXMgcGFydCBvZiB0aGUgdHJhY2UgYXMgaXQgd2lsbCBkZXBlbmQgb24gdGhlIGN1cnJlbnQgZ3VpIHNjYWxlIGZhY3Rvci5cclxuZnVuY3Rpb24gQXJjKGd1aUNvbnRleHQsIHRyYWNlLCBsaW5lV2lkdGgsIGNvbG9yKVxyXG57XHJcblxyXG4gICAgbGV0IGNlbnRlclBvaW50ID0gbmV3IFBvaW50KHRyYWNlLmN4MCwgdHJhY2UuY3kwKTtcclxuXHJcbiAgICBsZXQgcmVuZGVyT3B0aW9ucyA9IHsgXHJcbiAgICAgICAgY29sb3I6IGNvbG9yLFxyXG4gICAgICAgIGZpbGw6IGZhbHNlLFxyXG4gICAgICAgIGxpbmVXaWR0aDogbGluZVdpZHRoLFxyXG4gICAgICAgIGxpbmVDYXA6IFwicm91bmRcIiBcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLkFyYyggXHJcbiAgICAgICAgZ3VpQ29udGV4dCxcclxuICAgICAgICBjZW50ZXJQb2ludCxcclxuICAgICAgICB0cmFjZS5yYWRpdXMsXHJcbiAgICAgICAgdHJhY2UuYW5nbGUwLFxyXG4gICAgICAgIHRyYWNlLmFuZ2xlMSxcclxuICAgICAgICByZW5kZXJPcHRpb25zXHJcbiAgICApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBMaW5lKGd1aUNvbnRleHQsIHRyYWNlLCBsaW5lV2lkdGgsIGNvbG9yKVxyXG57XHJcbiAgICBsZXQgc3RhcnRQb2ludCA9IG5ldyBQb2ludCh0cmFjZS54MCwgdHJhY2UueTApO1xyXG4gICAgbGV0IGVuZFBvaW50ICAgPSBuZXcgUG9pbnQodHJhY2UueDEsIHRyYWNlLnkxKTtcclxuXHJcbiAgICBsZXQgcmVuZGVyT3B0aW9ucyA9IHsgXHJcbiAgICAgICAgY29sb3I6IGNvbG9yLFxyXG4gICAgICAgIGZpbGw6IGZhbHNlLFxyXG4gICAgICAgIGxpbmVXaWR0aDogbGluZVdpZHRoLFxyXG4gICAgICAgIGxpbmVDYXA6IFwicm91bmRcIiBcclxuICAgIH07XHJcbiAgICByZW5kZXJfbG93bGV2ZWwuTGluZShcclxuICAgICAgICBndWlDb250ZXh0LFxyXG4gICAgICAgIHN0YXJ0UG9pbnQsXHJcbiAgICAgICAgZW5kUG9pbnQsXHJcbiAgICAgICAgcmVuZGVyT3B0aW9uc1xyXG4gICAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gUG9seWdvbihndWlDb250ZXh0LCBzZWdtZW50cywgbGluZVdpZHRoLCBjb2xvciwgaXNQb3NpdGl2ZSlcclxue1xyXG4gICAgbGV0IHZlcnRpY2VzID0gW107XHJcbiAgICBmb3IgKGxldCBpIG9mIHNlZ21lbnRzKVxyXG4gICAge1xyXG4gICAgICAgIGxldCBwb2ludDEgPSBuZXcgUG9pbnQoaS54MCwgaS55MCk7XHJcbiAgICAgICAgdmVydGljZXMucHVzaChwb2ludDEpO1xyXG4gICAgfVxyXG4gICAgbGV0IGNvbXBvc2l0aW9uVHlwZSA9IChpc1Bvc2l0aXZlKSA/IFwic291cmNlLW92ZXJcIiA6IFwiZGVzdGluYXRpb24tb3V0XCI7XHJcblxyXG4gICAgbGV0IHJlbmRlck9wdGlvbnMgPSB7IGNvbG9yOiBjb2xvcixcclxuICAgICAgICBmaWxsOiB0cnVlLFxyXG4gICAgICAgIGNvbXBvc2l0aW9uVHlwZTogY29tcG9zaXRpb25UeXBlXHJcbiAgICB9O1xyXG5cclxuICAgIHJlbmRlcl9sb3dsZXZlbC5JcnJlZ3VsYXJQb2x5Z29uKCBcclxuICAgICAgICBndWlDb250ZXh0LFxyXG4gICAgICAgIHZlcnRpY2VzLFxyXG4gICAgICAgIHJlbmRlck9wdGlvbnNcclxuICAgICk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgQXJjLCBMaW5lLCBQb2x5Z29uXHJcbn07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG52YXIgcmVuZGVyX2xvd2xldmVsICAgICA9IHJlcXVpcmUoXCIuL3JlbmRlcl9sb3dsZXZlbC5qc1wiKTtcclxudmFyIFBvaW50ICAgICAgICAgICAgICAgPSByZXF1aXJlKFwiLi9wb2ludC5qc1wiKS5Qb2ludDtcclxuXHJcblxyXG5mdW5jdGlvbiBHZXRQb2x5Z29uVmVydGljaWVzKHJhZGl1cywgbnVtYmVyU2l6ZWQpXHJcbntcclxuICAgIC8vIFdpbGwgc3RvcmUgdGhlIHZlcnRpY2llcyBvZiB0aGUgcG9seWdvbi5cclxuICAgIGxldCBwb2x5Z29uVmVydGljaWVzID0gW107XHJcbiAgICAvLyBBc3N1bWVzIGEgcG9seWdvbiBjZW50ZXJlZCBhdCAoMCwwKVxyXG4gICAgLy8gQXNzdW1lcyB0aGF0IGEgY2lyY3Vtc2NyaWJlZCBwb2x5Z29uLiBUaGUgZm9ybXVsYXMgdXNlZCBiZWxvIGFyZSBmb3IgYSBpbnNjcmliZWQgcG9seWdvbi4gXHJcbiAgICAvLyBUbyBjb252ZXJ0IGJldHdlZW4gYSBjaXJjdW1zY3JpYmVkIHRvIGFuIGluc2NyaWJlZCBwb2x5Z29uLCB0aGUgcmFkaXVzIGZvciB0aGUgb3V0ZXIgcG9seWdvbiBuZWVkcyB0byBiZSBjYWxjdWxhdGVkLlxyXG4gICAgLy8gU29tZSBvZiB0aGUgdGhlb3J5IGZvciBiZWxvdyBjb21lcyBmcm9tIFxyXG4gICAgLy8gaHR0cHM6Ly93d3cubWFhLm9yZy9leHRlcm5hbF9hcmNoaXZlL2pvbWEvVm9sdW1lNy9Ba3R1bWVuL1BvbHlnb24uaHRtbFxyXG4gICAgLy8gLy8gSXRzIGlzIHNvbWUgYmFzaWMgdHJpZyBhbmQgZ2VvbWV0cnlcclxuICAgIGxldCBhbHBoYSA9ICgyKk1hdGguUEkgLyAoMipudW1iZXJTaXplZCkpO1xyXG4gICAgbGV0IGluc2NyaWJlZF9yYWRpdXMgPSByYWRpdXMgL01hdGguY29zKGFscGhhKTtcclxuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IG51bWJlclNpemVkOyBpKyspIFxyXG4gICAge1xyXG5cclxuICAgICAgICBwb2x5Z29uVmVydGljaWVzLnB1c2gobmV3IFBvaW50KGluc2NyaWJlZF9yYWRpdXMgKiBNYXRoLmNvcygyICogTWF0aC5QSSAqIGkgLyBudW1iZXJTaXplZCksIGluc2NyaWJlZF9yYWRpdXMgKiBNYXRoLnNpbigyICogTWF0aC5QSSAqIGkgLyBudW1iZXJTaXplZCkpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcG9seWdvblZlcnRpY2llcztcclxufVxyXG5cclxuZnVuY3Rpb24gU3F1YXJlKGd1aUNvbnRleHQsIGNlbnRlclBvaW50LCBkaWFtZXRlciwgZHJpbGxEaWFtZXRlciwgY29sb3JWaWEsIGNvbG9yRHJpbGwpXHJcbntcclxuICAgIGxldCBwb2x5Z29uVmVydGljaWVzID0gR2V0UG9seWdvblZlcnRpY2llcyhkaWFtZXRlci8yLCA0KTtcclxuXHJcbiAgICAvLyBUaGlzIGlzIG5lZWRlZCBpbiBvcmRlciBzbyB0aGF0IHRoZSBzaGFwZSBpcyByZW5kZXJlZCB3aXRoIGNvcnJlY3Qgb3JpZW50YXRpb24sIGllIHRvcCBvZiBcclxuICAgIC8vIHNoYXBlIGlzIHBhcmFsbGVsIHRvIHRvcCBhbmQgYm90dG9tIG9mIHRoZSBkaXNwbGF5LlxyXG4gICAgbGV0IGFuZ2xlID0gNDU7XHJcblxyXG4gICAgbGV0IHJlbmRlck9wdGlvbnMgPSB7XHJcbiAgICAgICAgY29sb3I6IGNvbG9yVmlhLFxyXG4gICAgICAgIGZpbGw6IHRydWUsXHJcbiAgICB9O1xyXG5cclxuICAgIHJlbmRlcl9sb3dsZXZlbC5SZWd1bGFyUG9seWdvbiggXHJcbiAgICAgICAgZ3VpQ29udGV4dCxcclxuICAgICAgICBjZW50ZXJQb2ludCwgXHJcbiAgICAgICAgcG9seWdvblZlcnRpY2llcyxcclxuICAgICAgICBhbmdsZSxcclxuICAgICAgICByZW5kZXJPcHRpb25zXHJcbiAgICApO1xyXG5cclxuICAgIC8vIERyYXcgZHJpbGwgaG9sZVxyXG4gICAgcmVuZGVyT3B0aW9ucyA9IHtcclxuICAgICAgICBjb2xvcjogY29sb3JEcmlsbCxcclxuICAgICAgICBmaWxsOiB0cnVlLFxyXG4gICAgfTtcclxuXHJcbiAgICByZW5kZXJfbG93bGV2ZWwuQ2lyY2xlKCBcclxuICAgICAgICBndWlDb250ZXh0LFxyXG4gICAgICAgIGNlbnRlclBvaW50LFxyXG4gICAgICAgIGRyaWxsRGlhbWV0ZXIvMiwgXHJcbiAgICAgICAgcmVuZGVyT3B0aW9uc1xyXG4gICAgKTsgXHJcbn1cclxuXHJcbmZ1bmN0aW9uIE9jdGFnb24oZ3VpQ29udGV4dCwgY2VudGVyUG9pbnQsIGRpYW1ldGVyLCBkcmlsbERpYW1ldGVyLCBjb2xvclZpYSwgY29sb3JEcmlsbClcclxue1xyXG4gICAgLy8gV2lsbCBzdG9yZSB0aGUgdmVydGljaWVzIG9mIHRoZSBwb2x5Z29uLlxyXG4gICAgbGV0IHBvbHlnb25WZXJ0aWNpZXMgPSBHZXRQb2x5Z29uVmVydGljaWVzKGRpYW1ldGVyLzIsIDgpO1xyXG4gICAgbGV0IGFuZ2xlID0gKDQ1LzIpO1xyXG5cclxuICAgIGxldCByZW5kZXJPcHRpb25zID0geyBcclxuICAgICAgICBjb2xvcjogY29sb3JWaWEsXHJcbiAgICAgICAgZmlsbDogdHJ1ZSxcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLlJlZ3VsYXJQb2x5Z29uKCBcclxuICAgICAgICBndWlDb250ZXh0LFxyXG4gICAgICAgIGNlbnRlclBvaW50LCBcclxuICAgICAgICBwb2x5Z29uVmVydGljaWVzLFxyXG4gICAgICAgIGFuZ2xlLFxyXG4gICAgICAgIHJlbmRlck9wdGlvbnNcclxuICAgICk7XHJcblxyXG4gICAgLy8gRHJhdyBkcmlsbCBob2xlXHJcbiAgICByZW5kZXJPcHRpb25zID0ge1xyXG4gICAgICAgIGNvbG9yOiBjb2xvckRyaWxsLFxyXG4gICAgICAgIGZpbGw6IHRydWUsXHJcbiAgICB9O1xyXG5cclxuICAgIHJlbmRlcl9sb3dsZXZlbC5DaXJjbGUoIFxyXG4gICAgICAgIGd1aUNvbnRleHQsXHJcbiAgICAgICAgY2VudGVyUG9pbnQsXHJcbiAgICAgICAgZHJpbGxEaWFtZXRlci8yLCBcclxuICAgICAgICByZW5kZXJPcHRpb25zXHJcbiAgICApOyBcclxufVxyXG5cclxuZnVuY3Rpb24gUm91bmQoZ3VpQ29udGV4dCwgY2VudGVyUG9pbnQsIGRpYW1ldGVyLCBkcmlsbERpYW1ldGVyLCBjb2xvclZpYSwgY29sb3JEcmlsbClcclxue1xyXG5cclxuICAgIGxldCByZW5kZXJPcHRpb25zID0ge1xyXG4gICAgICAgIGNvbG9yOiBjb2xvclZpYSxcclxuICAgICAgICBmaWxsOiB0cnVlLFxyXG4gICAgfTtcclxuXHJcbiAgICByZW5kZXJfbG93bGV2ZWwuQ2lyY2xlKCBcclxuICAgICAgICBndWlDb250ZXh0LFxyXG4gICAgICAgIGNlbnRlclBvaW50LFxyXG4gICAgICAgIGRpYW1ldGVyLzIsIFxyXG4gICAgICAgIHJlbmRlck9wdGlvbnNcclxuICAgICk7IFxyXG4gICAgXHJcbiAgICAvLyBEcmF3IGRyaWxsIGhvbGVcclxuICAgIHJlbmRlck9wdGlvbnMgPSB7XHJcbiAgICAgICAgY29sb3I6IGNvbG9yRHJpbGwsXHJcbiAgICAgICAgZmlsbDogdHJ1ZSxcclxuICAgIH07XHJcblxyXG4gICAgcmVuZGVyX2xvd2xldmVsLkNpcmNsZSggXHJcbiAgICAgICAgZ3VpQ29udGV4dCxcclxuICAgICAgICBjZW50ZXJQb2ludCxcclxuICAgICAgICBkcmlsbERpYW1ldGVyLzIsIFxyXG4gICAgICAgIHJlbmRlck9wdGlvbnNcclxuICAgICk7IFxyXG5cclxuICAgIC8vIFJlc3RvcmVzIGNvbnRleHQgdG8gc3RhdGUgcHJpb3IgdG8gdGhpcyByZW5kZXJpbmcgZnVuY3Rpb24gYmVpbmcgY2FsbGVkLiBcclxuICAgIGd1aUNvbnRleHQucmVzdG9yZSgpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFNxdWFyZSwgT2N0YWdvbiwgUm91bmQsXHJcbn07XHJcbiJdfQ==
