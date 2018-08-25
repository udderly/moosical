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
        
        e.resize.n.style.width = this.params.width - 10;
        
        e.resize.e.style.x = this.params.width - 5;
        e.resize.e.style.height = this.params.height - 10;
        
        e.resize.s.style.y = this.params.height - 5;
        e.resize.s.style.width = this.params.width - 10;
        
        e.resize.w.style.height = this.params.height - 10;
    }
    
    build() {
        let self = this;
        let e = this.elements;
        
        e.container = LSVG.g();
        this.svg.appendChild(e.container);
        
        e.body = LSVG.rect(0, 0, 0, 0, '#fff');
        e.body.style.stroke = "#069";
        e.body.style.rx = 5;
        e.container.appendChild(e.body);
        
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
        let self = this;
        let e = this.elements;
        
        e.resize = {};
        
        e.resize.n = LSVG.rect(5, -5, 0, 10, '');
        e.resize.n.style.fillOpacity = 0;
        e.resize.n.style.cursor = 'n-resize';
        e.container.appendChild(e.resize.n);
        
        e.resize.n.onmousedown = function(event) {
            self.sy = event.clientY;
            self.oy = self.params.y;
            self.oh = self.params.height;

            let f = function(ev) {
                if (self.params.y > 0) {
                    self.params.y = ev.clientY - self.sy + self.oy;
                    self.params.height = self.sy - ev.clientY + self.oh;
                } else {
                    self.params.y = 0;
                }
                self.update();
            };
                
            f(event);
            
            document.addEventListener('mousemove', f);
            document.addEventListener('mouseup', function() {
                document.removeEventListener('mousemove', f);
            }, {once: true});
        };
        
        e.resize.e = LSVG.rect(0, 5, 10, 0, '');
        e.resize.e.style.fillOpacity = 0;
        e.resize.e.style.cursor = 'e-resize';
        e.container.appendChild(e.resize.e);
        
        
        e.resize.e.onmousedown = function(event) {
            self.sx = event.clientX;
            self.ow = self.params.width;

            let f = function(ev) {
                self.params.width = ev.clientX - self.sx + self.ow;
                self.update();
            };
                
            f(event);
            
            document.addEventListener('mousemove', f);
            document.addEventListener('mouseup', function() {
                document.removeEventListener('mousemove', f);
            }, {once: true});
        };
        
        e.resize.s = LSVG.rect(5, 0, 0, 10, '');
        e.resize.s.style.fillOpacity = 0;
        e.resize.s.style.cursor = 's-resize';
        e.container.appendChild(e.resize.s);
        
        
        e.resize.s.onmousedown = function(event) {
            self.sy = event.clientY;
            self.oh = self.params.height;

            let f = function(ev) {
                self.params.height = ev.clientY - self.sy + self.oh;
                self.update();
            };
                
            f(event);
            
            document.addEventListener('mousemove', f);
            document.addEventListener('mouseup', function() {
                document.removeEventListener('mousemove', f);
            }, {once: true});
        };
        
        e.resize.w = LSVG.rect(-5, 5, 10, 0, '');
        e.resize.w.style.fillOpacity = 0;
        e.resize.w.style.cursor = 'w-resize';
        e.container.appendChild(e.resize.w);
        
        e.resize.w.onmousedown = function(event) {
            self.sx = event.clientX;
            self.ox = self.params.x;
            self.ow = self.params.width;

            let f = function(ev) {
                self.params.x = ev.clientX - self.sx + self.ox;
                self.params.width = self.sx - ev.clientX + self.ow;
                self.update();
            };
                
            f(event);
            
            document.addEventListener('mousemove', f);
            document.addEventListener('mouseup', function() {
                document.removeEventListener('mousemove', f);
            }, {once: true});
        };
    }
}