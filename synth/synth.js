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

        l.uni.k = new LACTOSE.Knob(c, {pos: [50 + x, 115 + y], size: 50, value: 0.6, color: '#0c9'});
        l.uni.t = new LACTOSE.Text(c, {pos: [80 + x, 120 + y], align: 'start', value: 'Vcs', color: '#000'});
        l.uni.i = new LACTOSE.Text(c, {pos: [50 + x, 120 + y], align: 'middle', value: '10', color: '#096'});

        l.det.k = new LACTOSE.Knob(c, {pos: [60 + x, 165 + y], size: 25, value: 0.3, color: '#0c9'});
        l.det.t = new LACTOSE.Text(c, {pos: [80 + x, 170 + y], align: 'start', value: 'Det', color: '#000'});
        l.det.i = new LACTOSE.Text(c, {pos: [40 + x, 170 + y], align: 'end', value: '60', color: '#096'});

        l.ble.k = new LACTOSE.Knob(c, {pos: [60 + x, 215 + y], size: 25, value: 0.3, color: '#0c9'});
        l.ble.t = new LACTOSE.Text(c, {pos: [80 + x, 220 + y], align: 'start', value: 'Bld', color: '#000'});
        l.ble.i = new LACTOSE.Text(c, {pos: [40 + x, 220 + y], align: 'end', value: '30', color: '#096'});

        l.pan.k = new LACTOSE.Knob(c, {pos: [160 + x, 115 + y], size: 25, value: 0.6, color: '#fc0'});
        l.pan.t = new LACTOSE.Text(c, {pos: [140 + x, 120 + y], align: 'end', value: 'Pan', color: '#000'});
        l.pan.i = new LACTOSE.Text(c, {pos: [180 + x, 120 + y], align: 'start', value: '10', color: '#c90'});

        l.lev.k = new LACTOSE.Knob(c, {pos: [160 + x, 165 + y], size: 25, value: 0.6, color: '#fc0'});
        l.lev.t = new LACTOSE.Text(c, {pos: [140 + x, 170 + y], align: 'end', value: 'Lev', color: '#000'});
        l.lev.i = new LACTOSE.Text(c, {pos: [180 + x, 170 + y], align: 'start', value: '10', color: '#c90'});
    }

    build() {
        let frame = LSVG.g();
        let container = LSVG.g();

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

        env.att.s = new LACTOSE.Slider(container, {pos: [250, 365], size: 100, value: 0.1, color: '#09c'});
        env.att.t = new LACTOSE.Text(container, {pos: [250, 440], align: 'middle', value: 'A', color: '#333'});
        env.att.i = new LACTOSE.Text(container, {pos: [250, 305], align: 'middle', value: '9', color: '#333'});

        env.dec.s = new LACTOSE.Slider(container, {pos: [290, 365], size: 100, value: 0.8, color: '#09c'});
        env.dec.t = new LACTOSE.Text(container, {pos: [290, 440], align: 'middle', value: 'D', color: '#333'});
        env.dec.i = new LACTOSE.Text(container, {pos: [290, 305], align: 'middle', value: '165', color: '#333'});

        env.sus.s = new LACTOSE.Slider(container, {pos: [330, 365], size: 100, value: 0.6, color: '#09c'});
        env.sus.t = new LACTOSE.Text(container, {pos: [330, 440], align: 'middle', value: 'S', color: '#333'});
        env.sus.i = new LACTOSE.Text(container, {pos: [330, 305], align: 'middle', value: '60', color: '#333'});

        env.rel.s = new LACTOSE.Slider(container, {pos: [370, 365], size: 100, value: 0.2, color: '#09c'});
        env.rel.t = new LACTOSE.Text(container, {pos: [370, 440], align: 'middle', value: 'R', color: '#333'});
        env.rel.i = new LACTOSE.Text(container, {pos: [370, 305], align: 'middle', value: '27', color: '#333'});

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

        scl.fil.o = new LACTOSE.Open(container, {pos: [20, 480], size: 20, color: '#f03'});
        scl.fil.t = new LACTOSE.Text(container, {pos: [40, 485], algin: 'left', value: 'LOAD .SCL', color: '#333'});

        /*let resk = new LACTOSE.Knob(650, 100, 50, 0.6, '#c90', this.svg);
        let rest = new LACTOSE.Text(650, 150, 'middle', 'FREQ', '#333', this.svg);
        let resi = new LACTOSE.Text(650, 105, 'middle', '3.1', '#c90', this.svg);

        //stuff



        let t = new Graph(700, 300, [400, 200], [], '#333', this.svg);*/
    }
}
