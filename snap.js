/*
 * Snap.js
 *
 * Copyright 2013, Jacob Kelley - http://jakiestfu.com/
 * Released under the MIT Licence
 * http://opensource.org/licenses/MIT
 *
 * Github:  http://github.com/jakiestfu/Snap.js/
 * Version: 1.5.0
 */
/*jslint browser: true*/
/*global define, module, ender*/
(function(win, doc) {
    'use strict';
    var Snap = Snap || function(userOpts) {
        var settings = {
            element: null,
            disable: 'none',
            addBodyClasses: true,
            resistance: 0.5,
            flickThreshold: 50,
            transitionSpeed: 0.3,
            easing: 'ease',
            maxPosition: 266,
            minPosition: -266,
            tapToClose: true,
            slideIntent: 40, // degrees
            minDragDistance: 5
        },
        cache = {
            simpleStates: {
                opening: null,
                towards: null,
                hyperExtending: null,
                halfway: null,
                flick: null,
                translation: {
                    absolute: 0,
                    relative: 0,
                    sinceDirectionChange: 0,
                    percentage: 0
                }
            }
        },
        eventList = {},
        utils = {
            hasTouch: (doc.ontouchstart === null),
            eventType: function(action) {
                var eventTypes = {
                        down: utils.hasTouch ? 'touchstart' : 'mousedown',
                        move: utils.hasTouch ? 'touchmove' : 'mousemove',
                        up: utils.hasTouch ? 'touchend' : 'mouseup',
                        out: utils.hasTouch ? 'touchcancel' : 'mouseout'
                    };
                return eventTypes[action];
            },
            dispatchEvent: function(type) {
                if (typeof eventList[type] === 'function') {
                    eventList[type].call();
                }
            },
            deepExtend: function(destination, source) {
                var property;
                for (property in source) {
                    if (source[property] && source[property].constructor && source[property].constructor === Object) {
                        destination[property] = destination[property] || {};
                        utils.deepExtend(destination[property], source[property]);
                    } else {
                        destination[property] = source[property];
                    }
                }
                return destination;
            },
            angleOfDrag: function(x, y) {
                var degrees, theta;
                // Calc Theta
                theta = Math.atan2(-(cache.startDragY - y), (cache.startDragX - x));
                if (theta < 0) {
                    theta += 2 * Math.PI;
                }
                // Calc Degrees
                degrees = Math.floor(theta * (180 / Math.PI) - 180);
                if (degrees < 0 && degrees > -180) {
                    degrees = 360 - Math.abs(degrees);
                }
                return Math.abs(degrees);
            },
            events: {
                addEvent: function addEvent(element, eventName, func) {
                    if (element.addEventListener) {
                        element.addEventListener(eventName, func, false);
                    } else if (element.attachEvent) {
                        element.attachEvent("on" + eventName, func);
                    }
                },
                removeEvent: function addEvent(element, eventName, func) {
                    if (element.addEventListener) {
                        element.removeEventListener(eventName, func, false);
                    } else if (element.attachEvent) {
                        element.detachEvent("on" + eventName, func);
                    }
                },
                preventDefaultEvent: function(e) {
                    if (e.preventDefault) {
                        e.preventDefault();
                    } else {
                        e.returnValue = false;
                    }
                }
            }
        },
        action = {
            translate: {
                get: {
                    matrix: function(index) {
                        var matrix = win.getComputedStyle(settings.element).webkitTransform.match(/\((.*)\)/);
                        if (matrix) {
                            matrix = matrix[1].split(',');
                            return parseInt(matrix[index], 10);
                        }
                        return 0;
                    }
                },
                easeTo: function(n) {
                    cache.easing = true;
                    settings.element.style.webkitTransition = 'all ' + settings.transitionSpeed + 's ' + settings.easing;
                    var animatingInterval = setInterval(function() {
                        utils.dispatchEvent('animating');
                    }, 1);
                    utils.events.addEvent(settings.element, 'webkitTransitionEnd', function() {
                        settings.element.style.webkitTransition = '';
                        cache.translation = action.translate.get.matrix(4);
                        cache.easing = false;
                        clearInterval(animatingInterval);
                        if(settings.addBodyClasses) {

                            switch(n) {
                                case settings.minPosition:
                                    doc.body.classList.add('snapjs-right');
                                    doc.body.classList.remove('snapjs-left');
                                    break;
                                case settings.maxPosition:
                                    doc.body.classList.add('snapjs-left');
                                    doc.body.classList.remove('snapjs-right');
                                    break;
                                default:
                                    doc.body.classList.remove('snapjs-left');
                                    doc.body.classList.remove('snapjs-right');
                                    break;
                            }
                        }

                        utils.dispatchEvent('animated');
                    });
                    action.translate.x(n);
                },
                x: function(n) {
                    var theTranslate = 'translate3d(' + parseInt(n, 10) + 'px, 0,0)';
                    settings.element.style.webkitTransform = theTranslate;
                }
            },
            drag: {
                listen: function() {
                    cache.translation = 0;
                    cache.easing = false;
                    utils.events.addEvent(settings.element, utils.eventType('down'), action.drag.startDrag);
                    utils.events.addEvent(settings.element, utils.eventType('move'), action.drag.dragging);
                    utils.events.addEvent(settings.element, utils.eventType('up'), action.drag.endDrag);
                },
                startDrag: function(e) {

                    // No drag on ignored elements
                    if (e.srcElement.dataset.snapIgnore == "true") {
                        utils.dispatchEvent('ignore');
                        return;
                    }
                    utils.dispatchEvent('start');
                    settings.element.style.webkitTransition = '';
                    cache.isDragging = true;
                    cache.hasIntent = null;
                    cache.intentChecked = false;
                    cache.startDragX = utils.hasTouch ? e.touches[0].pageX : e.pageX;
                    cache.startDragY = utils.hasTouch ? e.touches[0].pageY : e.pageY;
                    cache.dragWatchers = {
                        current: 0,
                        last: 0,
                        hold: 0,
                        state: ''
                    };
                    cache.simpleStates = {
                        opening: null,
                        towards: null,
                        hyperExtending: null,
                        halfway: null,
                        flick: null,
                        translation: {
                            absolute: 0,
                            relative: 0,
                            sinceDirectionChange: 0,
                            percentage: 0
                        }
                    };
                },
                dragging: function(e) {
                    if (cache.isDragging) {

                        var thePageX = utils.hasTouch ? e.touches[0].pageX : e.pageX,
                            thePageY = utils.hasTouch ? e.touches[0].pageY : e.pageY,
                            translated = cache.translation,
                            absoluteTranslation = action.translate.get.matrix(4),
                            whileDragX = thePageX - cache.startDragX,
                            openingLeft = absoluteTranslation > 0,
                            translateTo = whileDragX,
                            diff;

                        if( (cache.intentChecked && !cache.hasIntent) || // Does user show intent?
                            (thePageX-cache.startDragX)>0 && (settings.disable=='left') || // Left pane Disabled?
                            (thePageX-cache.startDragX)<0 && (settings.disable=='right') // Right pane Disabled?
                        ){
                            return;
                        }

                        if(settings.addBodyClasses){
                            if((absoluteTranslation)>0){
                                doc.body.classList.add('snapjs-left');
                                doc.body.classList.remove('snapjs-right');
                            } else if((absoluteTranslation)<0){
                                doc.body.classList.add('snapjs-right');
                                doc.body.classList.remove('snapjs-left');
                            }
                        }

                        if (cache.hasIntent === false || cache.hasIntent === null) {
                            var deg = utils.angleOfDrag(thePageX, thePageY),
                                inRightRange = (deg >= 0 && deg <= settings.slideIntent) || (deg <= 360 && deg > (360 - settings.slideIntent)),
                                inLeftRange = (deg >= 180 && deg <= (180 + settings.slideIntent)) || (deg <= 180 && deg >= (180 - settings.slideIntent));
                            if (!inLeftRange && !inRightRange) {
                                cache.hasIntent = false;
                            } else {
                                cache.hasIntent = true;
                            }
                            cache.intentChecked = true;
                        }

                        if (
                            (settings.minDragDistance>=Math.abs(thePageX-cache.startDragX)) && // Has user met minimum drag distance?
                            (cache.hasIntent === false)
                        ) {
                            return;
                        }

                        e.preventDefault();
                        utils.dispatchEvent('drag');

                        cache.dragWatchers.current = thePageX;
                        // Determine which direction we are going
                        if (cache.dragWatchers.last > thePageX) {
                            if (cache.dragWatchers.state !== 'left') {
                                cache.dragWatchers.state = 'left';
                                cache.dragWatchers.hold = thePageX;
                            }
                            cache.dragWatchers.last = thePageX;
                        } else if (cache.dragWatchers.last < thePageX) {
                            if (cache.dragWatchers.state !== 'right') {
                                cache.dragWatchers.state = 'right';
                                cache.dragWatchers.hold = thePageX;
                            }
                            cache.dragWatchers.last = thePageX;
                        }
                        if (openingLeft) {
                            // Pulling too far to the right
                            if (settings.maxPosition < absoluteTranslation) {
                                diff = (absoluteTranslation - settings.maxPosition) * settings.resistance;
                                translateTo = whileDragX - diff;
                            }
                            cache.simpleStates = {
                                opening: 'left',
                                towards: cache.dragWatchers.state,
                                hyperExtending: settings.maxPosition < absoluteTranslation,
                                halfway: absoluteTranslation > (settings.maxPosition / 2),
                                flick: Math.abs(cache.dragWatchers.current - cache.dragWatchers.hold) > settings.flickThreshold,
                                translation: {
                                    absolute: absoluteTranslation,
                                    relative: whileDragX,
                                    sinceDirectionChange: (cache.dragWatchers.current - cache.dragWatchers.hold),
                                    percentage: (absoluteTranslation/settings.maxPosition)*100
                                }
                            };
                        } else {
                            // Pulling too far to the left
                            if (settings.minPosition > absoluteTranslation) {
                                diff = (absoluteTranslation - settings.minPosition) * settings.resistance;
                                translateTo = whileDragX - diff;
                            }
                            cache.simpleStates = {
                                opening: 'right',
                                towards: cache.dragWatchers.state,
                                hyperExtending: settings.minPosition > absoluteTranslation,
                                halfway: absoluteTranslation < (settings.minPosition / 2),
                                flick: Math.abs(cache.dragWatchers.current - cache.dragWatchers.hold) > settings.flickThreshold,
                                translation: {
                                    absolute: absoluteTranslation,
                                    relative: whileDragX,
                                    sinceDirectionChange: (cache.dragWatchers.current - cache.dragWatchers.hold),
                                    percentage: (absoluteTranslation/settings.minPosition)*100
                                }
                            };
                        }
                        action.translate.x(translateTo + translated);
                    }
                },
                endDrag: function(e) {
                    if (cache.isDragging) {
                        utils.dispatchEvent('end');
                        var translated = action.translate.get.matrix(4);
                        // Tap Close
                        if (cache.dragWatchers.current === 0 && translated !== 0 && settings.tapToClose) {
                            action.translate.easeTo(0);
                            cache.isDragging = false;
                            cache.startDragX = 0;
                            return;
                        }
                        // Revealing Left
                        if (cache.simpleStates.opening === 'left') {
                            // Halfway, Flicking, or Too Far Out
                            if ((cache.simpleStates.halfway || cache.simpleStates.hyperExtending || cache.simpleStates.flick)) {
                                if (cache.simpleStates.flick && cache.simpleStates.towards === 'left') { // Flicking Closed
                                    action.translate.easeTo(0);
                                } else if (
                                    (cache.simpleStates.flick && cache.simpleStates.towards === 'right') || // Flicking Open OR
                                    (cache.simpleStates.halfway || cache.simpleStates.hyperExtending) // At least halfway open OR hyperextending
                                ) {
                                    action.translate.easeTo(settings.maxPosition); // Open Left
                                }
                            } else {
                                action.translate.easeTo(0); // Close Left
                            }
                            // Revealing Right
                        } else if (cache.simpleStates.opening === 'right') {
                            // Halfway, Flicking, or Too Far Out
                            if ((cache.simpleStates.halfway || cache.simpleStates.hyperExtending || cache.simpleStates.flick)) {
                                if (cache.simpleStates.flick && cache.simpleStates.towards === 'right') { // Flicking Closed
                                    action.translate.easeTo(0);
                                } else if (
                                    (cache.simpleStates.flick && cache.simpleStates.towards === 'left') || // Flicking Open OR
                                    (cache.simpleStates.halfway || cache.simpleStates.hyperExtending) // At least halfway open OR hyperextending
                                ) {
                                    action.translate.easeTo(settings.minPosition); // Open Right
                                }
                            } else {
                                action.translate.easeTo(0); // Close Right
                            }
                        }
                        cache.isDragging = false;
                        cache.startDragX = utils.hasTouch ? e.touches[0].pageX : e.pageX;
                    }
                }
            }
        },
        init = function(opts) {
            if (opts.element) {
                utils.deepExtend(settings, opts);
                action.drag.listen();
            }
        };
        /*
         * Public
         */
        this.open = function(side) {
            if (side === 'left') {
                cache.simpleStates.opening = 'left';
                cache.simpleStates.towards = 'right';
                doc.body.classList.add('snapjs-left');
                doc.body.classList.remove('snapjs-right');
                action.translate.easeTo(settings.maxPosition);
            } else if (side === 'right') {
                cache.simpleStates.opening = 'right';
                cache.simpleStates.towards = 'left';
                doc.body.classList.add('snapjs-right');
                doc.body.classList.remove('snapjs-left');
                action.translate.easeTo(settings.minPosition);
            }
        };
        this.close = function() {
            action.translate.easeTo(0);
        };
        this.on = function(evt, fn) {
            eventList[evt] = fn;
            return this;
        };
        this.off = function(evt) {
            if (eventList[evt]) {
                eventList[evt] = false;
            }
        };
        this.state = function() {
            var state,
                fromLeft = action.translate.get.matrix(4);
            if (fromLeft === settings.maxPosition) {
                state = 'left';
            } else if (fromLeft === settings.minPosition) {
                state = 'right';
            } else {
                state = 'closed';
            }
            return {
                state: state,
                info: cache.simpleStates
            };
        };
        init(userOpts);
    };
    if ((typeof module !== 'undefined') && module.exports) {
        module.exports = Snap;
    }
    if (typeof ender === 'undefined') {
        this.Snap = Snap;
    }
    if ((typeof define === "function") && define.amd) {
        define("snap", [], function() {
            return Snap;
        });
    }
}).call(this, window, document);