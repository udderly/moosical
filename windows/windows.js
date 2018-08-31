class Window {
    constructor(s, params) {
        this.svg = s;
        this.params = params;
        
        this.params.x = this.params.x || 0;
        this.params.y = this.params.y || 0;
        this.params.width = this.params.width || 500;
        this.params.height = this.params.height || 500;
        
        this.params.minWidth = this.params.minWidth || 100;
        this.params.minHeight = this.params.minHeight || 100;
        
        this.sx;
        this.sy;
        this.ox;
        this.oy;
        this.ow;
        this.oh;
        
        this.elements = {};
    }
    
    update() {
        let e = this.elements;
        
        e.container.setAttribute('transform', 'translate(' + this.params.x + ',' + this.params.y + ')');
        e.body.style.width = this.params.width;
        e.body.style.height = this.params.height;
        e.nav.style.width = this.params.width;
        e.no.style.width = this.params.width;
        
        e.resize.n.style.width = this.params.width - 10;
        
        e.resize.e.style.x = this.params.width - 5;
        e.resize.e.style.height = this.params.height - 10;
        
        e.resize.s.style.y = this.params.height - 5;
        e.resize.s.style.width = this.params.width - 10;
        
        e.resize.w.style.height = this.params.height - 10;
        
        e.resize.ne.style.x = this.params.width - 5;
        
        e.resize.se.style.x = this.params.width - 5;
        e.resize.se.style.y = this.params.height - 5;
        
        e.resize.sw.style.y = this.params.height - 5;
    }
    
    build() {
        let self = this;
        let e = this.elements;
        
        e.container = LSVG.g();
        this.svg.appendChild(e.container);
        
        e.body = LSVG.rect(0, 0, 0, 0, '#fff');
        e.body.style.stroke = "#ccc";
        e.container.appendChild(e.body);
        
        e.no = LSVG.rect(0, 0, 0, 25, '');
        e.no.style.fillOpacity = 0;
        e.no.style.stroke = "#069";
        e.container.appendChild(e.no);
        
        e.nav = LSVG.foreignObject(0, 0, 0, 25);
        e.nav.id = 'windowTop';
        e.nav.innerHTML = document.getElementById('windowTop').innerHTML;
        e.container.appendChild(e.nav);
            
        
        e.nav.onmousedown = function(event) {
            self.sx = event.clientX;
            self.sy = event.clientY;
            self.ox = self.params.x;
            self.oy = self.params.y;

            let f = function(ev) {
                self.params.x = self.bounds(ev.clientX - self.sx + self.ox, 0, document.body.clientWidth - self.params.width);
                self.params.y = self.bounds(ev.clientY - self.sy + self.oy, 0, document.body.clientHeight - self.params.height);
                self.update();
            };
                
            f(event);
            
            document.addEventListener('mousemove', f);
            document.addEventListener('mouseup', function() {
                document.removeEventListener('mousemove', f);
            }, {once: true});
        };
        
        this.prepareResize();
        
        this.update();
    }
    
    bounds(x, a, b) {
        return Math.min(Math.max(x, a), b);
    }
    
    prepareResize() {
        let rn = function(ev) {
            if (ev.clientY + 50 < self.params.y + self.params.height) {
                if (ev.clientY > 0) {
                    self.params.y = ev.clientY - self.sy + self.oy;
                    self.params.height = self.sy - ev.clientY + self.oh;
                } else {
                    self.params.y = 0;
                    self.params.height = self.oh + self.oy;
                }
            } else {
                self.params.y = self.oy + self.oh - 50;
                self.params.height = 50;
            }
            self.update();
        };

        let re = function(ev) {
            if (ev.clientX - 200 > self.params.x) {
                if (ev.clientX < document.body.clientWidth) {
                    self.params.width = ev.clientX - self.sx + self.ow;
                } else {
                    self.params.width = document.body.clientWidth - self.params.x;
                }
            } else {
                self.params.width = 200;
            }
            self.update();
        };

        let rs = function(ev) {
            if (ev.clientY - 50 > self.params.y) {
                if (ev.clientY < document.body.clientHeight) {
                    self.params.height = ev.clientY - self.sy + self.oh;
                } else {
                    self.params.height = document.body.clientHeight - self.params.y;
                }
            } else {
                self.params.height = 50;
            }
            self.update();
        };

        let rw = function(ev) {
            if (ev.clientX + 200 < self.params.x + self.params.width) {
                if (ev.clientX > 0) {
                    self.params.x = ev.clientX - self.sx + self.ox;
                    self.params.width = self.sx - ev.clientX + self.ow;
                } else {
                    self.params.x = 0;
                    self.params.width = self.ow + self.ox;
                }
            } else {
                self.params.x = self.ox + self.ow - 200;
                self.params.width = 200;
            }
            self.update();
        };
        
        let trigger = function(...args) {
            console.log(event);
            self.sx = event.clientX;
            self.ox = self.params.x;
            self.ow = self.params.width;
            
            self.sy = event.clientY;
            self.oy = self.params.y;
            self.oh = self.params.height;
            
            args.forEach(function(func) {
                func(event);
                document.addEventListener('mousemove', func);
            });
            
            document.addEventListener('mouseup', function() {
                args.forEach(function(func) {
                    document.removeEventListener('mousemove', func);
                });
            }, {once: true});
        };
        
        let self = this;
        let e = this.elements;
        
        e.resize = {};
        
        e.resize.n = LSVG.rect(5, -5, 0, 10, '');
        e.resize.n.style.fillOpacity = 0;
        e.resize.n.style.cursor = 'ns-resize';
        e.container.appendChild(e.resize.n);
        
        e.resize.e = LSVG.rect(0, 5, 10, 0, '');
        e.resize.e.style.fillOpacity = 0;
        e.resize.e.style.cursor = 'ew-resize';
        e.container.appendChild(e.resize.e);
        
        e.resize.s = LSVG.rect(5, 0, 0, 10, '');
        e.resize.s.style.fillOpacity = 0;
        e.resize.s.style.cursor = 'ns-resize';
        e.container.appendChild(e.resize.s);
        
        e.resize.w = LSVG.rect(-5, 5, 10, 0, '');
        e.resize.w.style.fillOpacity = 0;
        e.resize.w.style.cursor = 'ew-resize';
        e.container.appendChild(e.resize.w);
        
        e.resize.ne = LSVG.rect(0, -5, 10, 10, '');
        e.resize.ne.style.fillOpacity = 0;
        e.resize.ne.style.cursor = 'nesw-resize';
        e.container.appendChild(e.resize.ne);
        
        e.resize.se = LSVG.rect(0, 0, 10, 10, '');
        e.resize.se.style.fillOpacity = 0;
        e.resize.se.style.cursor = 'nwse-resize';
        e.container.appendChild(e.resize.se);
        
        e.resize.sw = LSVG.rect(-5, 0, 10, 10, '');
        e.resize.sw.style.fillOpacity = 0;
        e.resize.sw.style.cursor = 'nesw-resize';
        e.container.appendChild(e.resize.sw);
        
        e.resize.nw = LSVG.rect(-5, -5, 10, 10, '');
        e.resize.nw.style.fillOpacity = 0;
        e.resize.nw.style.cursor = 'nwse-resize';
        e.container.appendChild(e.resize.nw);
        
        e.resize.n.onmousedown = function() { trigger(rn); };
        e.resize.e.onmousedown = function() { trigger(re); };
        e.resize.s.onmousedown = function() { trigger(rs); };
        e.resize.w.onmousedown = function() { trigger(rw); };
        e.resize.ne.onmousedown = function() { trigger(rn, re); };
        e.resize.se.onmousedown = function() { trigger(rs, re); };
        e.resize.sw.onmousedown = function() { trigger(rs, rw); };
        e.resize.nw.onmousedown = function() { trigger(rn, rw); };
    }
}