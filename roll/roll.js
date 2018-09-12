class Roll {
    constructor(s) {
        this.svg = s;
        this.elements = {};
    }
    
    build() {
        let frame = LSVG.g();
        let container = LSVG.g();
        
        this.svg.appendChild(frame);
        this.svg.appendChild(container);
        
        let notes = LSVG.g();
        container.appendChild(notes);
        
        this.elements.notes = notes;
        
        for (let i = 0; i < 4; i++) {
            let r1 = LSVG.rect(i * 320, 0, 320, 500, i % 2 === 1  ? "#eee" : "#fff");
            r1.style.fillOpacity = 0.5;
            container.appendChild(r1);
        }
        for (let i = 0; i < 24; i++) {
            let r1 = LSVG.rect(0, i * 20, 1000, 20, [1, 3, 6, 8, 10].indexOf(i % 12) > -1 ? "#eee" : "#fff");
            r1.style.fillOpacity = 0.5;
            container.appendChild(r1);
        }
        for (let i = 0; i < 256; i++) {
            let l1 = LSVG.line(i * 20, 0, i * 20, 500, i % 4 === 0 ? "#ddd" : "#eee");
            container.appendChild(l1);
        }
        for (let i = 0; i < 24; i++) {
            let l1 = LSVG.line(0, i * 20, 1000, i * 20, "#eee");
            container.appendChild(l1);
        }
    }
}

class Note {
    constructor(r, params) {
        this.roll = r;
        this.params = params;
        
        this.params.x = this.params.x || 0;
        this.params.y = this.params.y || 0;
        this.params.length = this.params.length || 4;
        
        this.elements = {};
    }
    
    update() {
        e.body.x = this.params.x * 20;
        e.body.y = this.params.y * 20;
        e.body.width = this.params.length * 20;
    }
    
    build() {
        let e = this.elements;
        
        e.body = LSVG.rect(0, 0, 0, 20, "hsl(200, 60%, 70%)");
        e.body.style.fillOpacity = 0.75;
        e.body.style.stroke = "#fff";
        e.body.style.rx = 5;
        this.roll.notes.appendChild(e.body);

        e.text = LSVG.text(305, 255, "start", "B3", "#fff");
        this.roll.notes.appendChild(e.text);
        
        this.update();
    }
}