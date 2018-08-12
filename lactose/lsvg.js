(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ?
        factory(exports) :
    typeof define === 'function' && define.amd ?
        define(['exports'], factory) :
    (factory((global.LSVG = global.LSVG || {})));
} (this, (function (exports) {
    
    'use strict';
    
    const url = 'http://www.w3.org/2000/svg';
    
    function circle(cx, cy, r, c) {
        let c1 = document.createElementNS(url, 'circle');
        c1.style.cx = cx;
        c1.style.cy = cy;
        c1.style.r = r;
        c1.style.fill = c;
        return c1;
    }

    function rect(x, y, w, h, c) {
        let r1 = document.createElementNS(url, 'rect');
        r1.style.x = x;
        r1.style.y = y;
        r1.style.width = w;
        r1.style.height = h;
        r1.style.fill = c;
        return r1;
    }

    function text(x, y, a, v, c) {
        let t1 = document.createElementNS(url, 'text');
        t1.setAttribute('x', x);
        t1.setAttribute('y', y);
        t1.style.fill = c;
        t1.innerHTML = v;
        t1.setAttribute('text-anchor', a);
        return t1;
    }
    
    function line(x1, y1, x2, y2, c) {
        let l1 = document.createElementNS(url, 'line');
        l1.setAttribute('x1', x1);
        l1.setAttribute('y1', y1);
        l1.setAttribute('x2', x2);
        l1.setAttribute('y2', y2);
        l1.style.stroke = c;
        return l1;
    }

    function g() {
        return document.createElementNS(url, 'g');
    }
    
    exports.url = url;
    exports.circle = circle;
    exports.rect = rect;
    exports.text = text;
    exports.line = line;
    exports.g = g;
    
})));