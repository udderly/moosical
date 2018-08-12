class Window {
    constructor(s, params) {
        this.svg = s;
        this.params = params;
        this.params.x = this.params.x || 0;
        this.params.y = this.params.y || 0;
        this.params.width = this.params.width || 500;
        this.params.height = this.params.height || 500;
        
        this.sx;
        this.sy;
        this.ox;
        this.oy;
        
        this.container;
    }
    
    update() {
        this.container.setAttribute('transform', 'translate(' + this.params.x + ',' + this.params.y + ')');
    }
    
    build() {
        this.container = LSVG.g();
        this.svg.appendChild(this.container);
        
        let body = LSVG.rect(0, 0, this.params.width, this.params.height, '#fff');
        body.style.stroke = "#069";
        body.style.rx = 5;
        this.container.appendChild(body);
        
        let nav = LSVG.foreignObject(0, 0, this.params.width, 25);
        nav.id = 'windowTop';
        nav.innerHTML = document.getElementById('windowTop').innerHTML;
        
        this.container.appendChild(nav);
        
        let self = this;
        nav.onmousedown = function(event) {
            self.sx = event.clientX;
            self.sy = event.clientY;
            self.ox = self.params.x;
            self.oy = self.params.y;

            document.onmousemove = function(event) {
                if (event.clientX > 0 && event.clientY > 0) {
                    self.params.x = event.clientX - self.sx + self.ox;
                    self.params.y = event.clientY - self.sy + self.oy;
                    self.update();
                }
            };

            document.onmouseup = function() {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
        
        this.update();
    }
}