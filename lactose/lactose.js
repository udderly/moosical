(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ?
        factory(exports) :
    typeof define === 'function' && define.amd ?
        define(['exports'], factory) :
    (factory((global.LACTOSE = global.LACTOSE || {})));
} (this, (function (exports) {
    
    'use strict';

    class Widget {
        constructor(cx, cy, s, v, c, svg) {
            this.cx = cx;
            this.cy = cy;
            this.s = s;
            this.v = v;
            this.c = c;
            this.svg = svg;
            this.parent = svg;
            while (this.parent.tagName !== 'svg') {
                this.parent = this.parent.parentNode;
            }
            this.mod = [];
            this.sx = 0;
            this.sy = 0;
            this.old = 0;
            this.add();
        }

        set(v) {
            this.v = v;
            this.update();
        }
        add() {}
        change() {}
        update() {}
    }

    class Knob extends Widget {
        constructor(cx, cy, s, v, c, svg) {
            super(cx, cy, s, v, c, svg);
        }

        update() {
            let angle = Math.PI * (this.v * 2 - 1.5);
            let d = {
                x: this.s * Math.cos(angle) / 2,
                y: this.s * Math.sin(angle) / 2
            };
            
            this.mod[0].style.opacity = this.v === 1 ? 1 : 0;

            this.mod[1].setAttribute('d', 'M ' + (this.cx + d.x) + ' ' + (this.cy + d.y) +
                                     ' A ' + (this.s / 2) + ' ' + (this.s / 2) +
                                     ' 0 ' + (this.v > 0.5 ? 1 : 0) + ' 0 ' +
                                     this.cx + ' ' + (this.cy + this.s / 2) +
                                     ' L ' + this.cx + ' ' + this.cy);

            this.change();
        }

        add() {
            let g1 = LSVG.g();

            let c1 = LSVG.circle(this.cx, this.cy, this.s / 2, '#eee');
            g1.appendChild(c1);

            let c3 = LSVG.circle(this.cx, this.cy, this.s / 2, this.c);
            g1.appendChild(c3);
            this.mod.push(c3);

            let arc = document.createElementNS(LSVG.url, 'path');
            arc.style.fill = this.c;
            g1.appendChild(arc);
            this.mod.push(arc);

            let c2 = LSVG.circle(this.cx, this.cy, this.s / 2 - 2, '#fff');
            g1.appendChild(c2);

            let r1 = LSVG.rect(this.cx - 1, this.cy + this.s / 4, 2, this.s / 4, this.c);
            //g1.appendChild(r1);
            this.mod.push(r1);

            let self = this;
            g1.onmousedown = function(event) {
                self.sx = event.clientX;
                self.sy = event.clientY;
                self.old = self.v;

                document.onmousemove = function(event) {
                    if (event.clientX > 0 && event.clientY > 0) { 
                        let result = 1000 * (self.sy - event.clientY) / (self.parent.clientWidth * self.s) / 4 + self.old;

                        result = result < 0 ? 0 : result > 1 ? 1 : result;
                        self.v = result;
                        self.update();
                    }
                };

                document.onmouseup = function() {
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };
            this.svg.appendChild(g1);

            this.update();
        }
    }

    class Slider extends Widget {
        constructor(cx, cy, s, v, c, svg) {
            super(cx, cy, s, v, c, svg);
        }

        update() {
            this.mod[0].style.y = this.cy + this.s / 2 - this.v * this.s;
            this.mod[0].style.height = this.v * this.s;
            this.mod[1].style.cy = this.cy + this.s / 2 - this.v * this.s;

            this.change();
        }

        add() {
            let g1 = LSVG.g();

            let r1 = LSVG.rect(this.cx - 1, this.cy - this.s / 2, 2, this.s, '#eee');
            g1.appendChild(r1);

            let r2 = LSVG.rect(this.cx - 1, 0, 2, 0, this.c);
            g1.appendChild(r2);
            this.mod.push(r2);

            let c1 = LSVG.circle(this.cx, 0, 5, '#fff');
            c1.style.stroke = this.c;
            c1.style.strokeWidth = 2;
            g1.appendChild(c1);
            this.mod.push(c1);

            let self = this;
            g1.onmousedown = function(event) {
                self.sx = event.clientX;
                self.sy = event.clientY;
                self.old = self.v;

                document.onmousemove = function(event) {
                    if (event.clientX > 0 && event.clientY > 0) {
                        let result = 1000 * (self.sy - event.clientY) / (self.parent.clientWidth * self.s) + self.old;

                        result = result < 0 ? 0 : result > 1 ? 1 : result;
                        self.v = result;
                        self.update();
                    }
                };

                document.onmouseup = function() {
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };
            this.svg.appendChild(g1);

            this.update();
        }
    }

    class Button extends Widget {
        constructor(cx, cy, s, v, c, svg) {
            super(cx, cy, s, v, c, svg);
            this.radio = null;
        }

        update() {
            this.mod[0].style.stroke = this.v ? this.c : '#eee';

            this.change();

            if (this.radio !== undefined && this.v) {
                this.radio.update(this);
            }
        }

        add() {
            let g1 = LSVG.g();

            let c1 = LSVG.circle(this.cx, this.cy, this.s / 2, '#fff');
            c1.style.strokeWidth = 2;
            g1.appendChild(c1);
            this.mod.push(c1);

            let self = this;
            g1.onmousedown = function() {
                self.v = this.radio !== null ? true : self.v === 0 ? 1 : 0;

                self.update();
            };
            this.svg.appendChild(g1);

            this.update();
        }
    }

    class Radio {
        constructor() {
            this.buttons = [];
        }

        update(b) {
            for (let i = 0; i < this.buttons.length; i++) {
                if (this.buttons[i] !== b) {
                    this.buttons[i].set(false);
                }
            }
        }

        add(b) {
            this.buttons.push(b);
            b.radio = this;
        }
    }

    class Open extends Widget {
        constructor(cx, cy, s, c, svg) {
            super(cx, cy, s, 0, c, svg);

            this.dialog = document.createElement('input');
            this.dialog.setAttribute('type', 'file');

            let self = this;
            this.dialog.onchange = function() {
                self.v = self.dialog.files.item(0);
                self.change();
            };
        }

        add() {
            let g1 = LSVG.g();

            let r1 = LSVG.rect(this.cx - this.s / 2, this.cy - this.s / 2, this.s, this.s, '#fff');
            r1.style.stroke = this.c;
            r1.style.strokeWidth = 2;
            r1.style.rx = 4;
            g1.appendChild(r1);

            let self = this;
            g1.onmousedown = function() {
                self.dialog.click();
            };
            this.svg.appendChild(g1);

            this.update();
        }
    }

    class Text extends Widget {
        constructor(cx, cy, s, v, c, svg) {
            super(cx, cy, s, v, c, svg);
        }

        update() {
            this.mod[0].innerHTML = this.v;
        }

        add() {
            let g1 = LSVG.g();

            let t1 = LSVG.text(this.cx, this.cy, this.s, this.v, this.c);
            g1.appendChild(t1);
            this.mod.push(t1);

            this.svg.appendChild(g1);
        }
    }

    class Graph extends Widget {
        constructor(cx, cy, s, v, c, svg) {
            super(cx, cy, s, v, c, svg);
        }

        update() {
            let path = 'M' + (this.cx - this.s[0] / 2) + ' ' + (this.cy + this.s[1] / 2);
            let dx = this.cx - this.s[0] / 2;
            let dy = this.cy - this.s[1] / 2;

            for (let i = 0; i < this.v.length; i++) {
                path += 'L' + (i + dx) + ' ' + Math.round(-this.v[i] * 50 + 200 + dy);
            }

            this.mod[0].setAttribute('d', path);
        }

        add() {
            let g1 = LSVG.g();

            let r1 = LSVG.rect(this.cx - this.s[0] / 2, this.cy - this.s[1] / 2, this.s[0], this.s[1], '#ddd');
            r1.style.stroke = '#ccc';
            g1.appendChild(r1);

            let arc = document.createElementNS(LSVG.url, 'path');
            arc.style.stroke = this.c;
            arc.style.strokeWidth = 2;
            arc.style.fillOpacity = 0;
            arc.style.strokeLinejoin = 'round';
            arc.style.strokeLinecap = 'round';
            g1.appendChild(arc);
            this.mod.push(arc);

            this.svg.appendChild(g1);
        }
    }

    class Group {
        constructor(x1, y1, x2, y2, t, svg) {
            this.x1 = x1;
            this.y1 = y1;
            this.x2 = x2;
            this.y2 = y2;
            this.t = t;
            this.svg = svg;
            this.add();
        }

        add() {
            let g1 = document.createElementNS(LSVG.url, 'g');

            let r1 = document.createElementNS(LSVG.url, 'rect');
            r1.style.x = this.x1;
            r1.style.y = this.y1;
            r1.style.width = this.x2 - this.x1;
            r1.style.height = this.y2 - this.y1;
            r1.style.stroke = '#ccc';
            r1.style.fillOpacity = 0;
            g1.appendChild(r1);

            let t1 = document.createElementNS(LSVG.url, 'text');
            t1.setAttribute('x', this.x1 + 5);
            t1.setAttribute('y', this.y1 + 20);
            t1.style.fill = '#666';
            t1.innerHTML = this.t;
            g1.appendChild(t1);

            this.svg.appendChild(g1);
        }
    }
    
    exports.Knob = Knob;
    exports.Slider = Slider;
    exports.Button = Button;
    exports.Radio = Radio;
    exports.Open = Open;
    exports.Text = Text;
    exports.Graph = Graph;
    exports.Group = Group;
    
})));