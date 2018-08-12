class Synth {
    constructor(s) {
        this.svg = s;
        this.elements = {
            osc1: {},
            osc2: {},
            env: {},
            scl: {}
        };
    }
    
    addOsc(l, x, y, n, c) {
        l.g = new LACTOSE.Group(10 + x, 60 + y, 210 + x, 260 + y, 'Osc ' + n, c);
        
        l.uni = {};
        l.det = {};
        l.ble = {};
        l.pan = {};
        l.lev = {};

        l.uni.k = new LACTOSE.Knob(60 + x, 115 + y, 25, 0.6, '#096', c);
        l.uni.t = new LACTOSE.Text(80 + x, 120 + y, 'start', 'Vcs', '#333', c);
        l.uni.i = new LACTOSE.Text(40 + x, 120 + y, 'end', '10', '#096', c);

        l.det.k = new LACTOSE.Knob(60 + x, 165 + y, 25, 0.3, '#096', c);
        l.det.t = new LACTOSE.Text(80 + x, 170 + y, 'start', 'Det', '#333', c);
        l.det.i = new LACTOSE.Text(40 + x, 170 + y, 'end', '60', '#096', c);

        l.ble.k = new LACTOSE.Knob(60 + x, 215 + y, 25, 0.3, '#096', c);
        l.ble.t = new LACTOSE.Text(80 + x, 220 + y, 'start', 'Bld', '#333', c);
        l.ble.i = new LACTOSE.Text(40 + x, 220 + y, 'end', '30', '#096', c);

        l.pan.k = new LACTOSE.Knob(160 + x, 115 + y, 25, 0.6, '#c90', c);
        l.pan.t = new LACTOSE.Text(140 + x, 120 + y, 'end', 'Pan', '#333', c);
        l.pan.i = new LACTOSE.Text(180 + x, 120 + y, 'start', '10', '#c90', c);

        l.lev.k = new LACTOSE.Knob(160 + x, 165 + y, 25, 0.6, '#c90', c);
        l.lev.t = new LACTOSE.Text(140 + x, 170 + y, 'end', 'Lev', '#333', c);
        l.lev.i = new LACTOSE.Text(180 + x, 170 + y, 'start', '10', '#c90', c);
    }

    build(s) {
        let container = LSVG.g();
        
        let frame = LSVG.g();
        let r1 = LSVG.rect(0, 49, 750, 1, '#ccc');
        let r2 = LSVG.rect(0, 0, 750, 500, '#000');
        r2.style.fillOpacity = 0;
        r2.style.stroke = '#333';
        r2.style.strokeWidth = 2;
        let t1 = LSVG.text(10, 40, 'start', 'Synth', '#000');
        t1.classList.add('title');
        frame.appendChild(r1);
        frame.appendChild(r2);
        frame.appendChild(t1);
        
        this.svg.appendChild(frame);
        this.svg.appendChild(container);
        
        this.addOsc(this.elements.osc1, 0, 0, 1, container);
        this.addOsc(this.elements.osc2, 0, 200, 2, container);

        //adsr
        
        let env = this.elements.env;
        
        env.att = {};
        env.dec = {};
        env.sus = {};
        env.rel = {};

        env.g = new LACTOSE.Group(210, 260, 410, 460, 'Envelope', container);

        env.att.s = new LACTOSE.Slider(250, 365, 100, 0.1, '#069', container);
        env.att.t = new LACTOSE.Text(250, 440, 'middle', 'A', '#333', container);
        env.att.i = new LACTOSE.Text(250, 305, 'middle', '9', '#333', container);

        env.dec.s = new LACTOSE.Slider(290, 365, 100, 0.8, '#069', container);
        env.dec.t = new LACTOSE.Text(290, 440, 'middle', 'D', '#333', container);
        env.dec.i = new LACTOSE.Text(290, 305, 'middle', '165', '#333', container);

        env.sus.s = new LACTOSE.Slider(330, 365, 100, 0.6, '#069', container);
        env.sus.t = new LACTOSE.Text(330, 440, 'middle', 'S', '#333', container);
        env.sus.i = new LACTOSE.Text(330, 305, 'middle', '60', '#333', container);

        env.rel.s = new LACTOSE.Slider(370, 365, 100, 0.2, '#069', container);
        env.rel.t = new LACTOSE.Text(370, 440, 'middle', 'R', '#333', container);
        env.rel.i = new LACTOSE.Text(370, 305, 'middle', '27', '#333', container);

        //ehh

        /*let wavr = new Radio();

        let wavb1 = new Button(570, 200, 20, false, '#903', this.svg);
        let wavb2 = new Button(570, 250, 20, false, '#903', this.svg);
        let wavb3 = new Button(570, 300, 20, true, '#903', this.svg);
        let wavb4 = new Button(570, 350, 20, false, '#903', this.svg);

        let wavt1 = new LACTOSE.Text(590, 205, 'left', 'SINE', '#333', this.svg);
        let wavt2 = new LACTOSE.Text(590, 255, 'left', 'SQUARE', '#333', this.svg);
        let wavt3 = new LACTOSE.Text(590, 305, 'left', 'SAW', '#333', this.svg);
        let wavt4 = new LACTOSE.Text(590, 355, 'left', 'TRIANGLE', '#333', this.svg);

        wavr.add(wavb1);
        wavr.add(wavb2);
        wavr.add(wavb3);
        wavr.add(wavb4);*/
        
        let scl = this.elements.scl;

        scl.fil = {};
        
        scl.fil.o = new LACTOSE.Open(20, 480, 20, '#903', container);
        scl.fil.t = new LACTOSE.Text(40, 485, 'left', 'LOAD .SCL', '#333', container);

        /*let resk = new LACTOSE.Knob(650, 100, 50, 0.6, '#c90', this.svg);
        let rest = new LACTOSE.Text(650, 150, 'middle', 'FREQ', '#333', this.svg);
        let resi = new LACTOSE.Text(650, 105, 'middle', '3.1', '#c90', this.svg);

        //stuff



        let t = new Graph(700, 300, [400, 200], [], '#333', this.svg);*/
    }
}