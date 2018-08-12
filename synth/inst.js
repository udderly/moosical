let lowpass_filter = new TONES.LowpassFilter();

let instrument = new TONES.SimpleInstrument({
    unison: 10,
    detune: 60,
    blend: 0.3,
    waveform: "sawtooth"
});

instrument.connect(lowpass_filter);
lowpass_filter.connect(TONES.masterEntryNode);

instrument.enableKeyboardPlay();

let tParams = {
    scale: TONES.Scales.ET12,
    baseNote: TONES.KeyboardPitches.A4,
    baseFrequency: 440,
    unison: 10,
    detune: 60,
    blend: 0.3,
    waveform: "sawtooth",
    attack: 0.09,
    decay: 1.65,
    sustain: 0.6,
    release: 0.27
};

function refreshInst() {
    let keyboardPlay = instrument.keyboardPlayEnabled;

    instrument.params.unison = tParams.unison;
    instrument.detune = tParams.detune;
    instrument.blend = tParams.blend;
    instrument.waveform = tParams.waveform;

    instrument.pitch_mapping = TONES.pitchMappingFromScale(tParams.scale, tParams.baseNote, tParams.baseFrequency);

    let a = new TONES.LinearEnvelopeSegment([0,0], [tParams.attack,1]);
    let b = new TONES.LinearEnvelopeSegment(a.p2, [tParams.decay + tParams.attack, tParams.sustain]);
    let attack_env = new TONES.Envelope([a,b]);

    instrument.params.attack_envelope = attack_env;
    instrument.params.release_length = tParams.release;
}
/*
wavb1.change = function() {
    if (wavb1.v) {
        tParams.waveform = "sine";
        refreshInst();
    }
};

wavb2.change = function() {
    if (wavb2.v) {
        tParams.waveform = "square";
        refreshInst();
    }
};

wavb3.change = function() {
    if (wavb3.v) {
        tParams.waveform = "sawtooth";
        refreshInst();
    }
};

wavb4.change = function() {
    if (wavb4.v) {
        tParams.waveform = "triangle";
        refreshInst();
    }
};
*/

let osc1 = synth.elements.osc1;
            
osc1.uni.k.change = function() {
    let val = Math.floor(osc1.uni.k.v * 15) + 1;
    osc1.uni.i.set(val);
    tParams.unison = val;
    refreshInst();
}

osc1.det.k.change = function() {
    let val = osc1.det.k.v * 200;
    osc1.det.i.set(Math.round(val));
    tParams.detune = val;
    refreshInst();
};

osc1.ble.k.change = function() {
    let val = osc1.ble.k.v;
    osc1.ble.i.set(Math.round(val * 100));
    tParams.blend = val;
    refreshInst();
};
/*
resk.change = function() {
    let val = Math.pow(2, (resk.v * 0.5 + 0.5) * 14.5);
    resi.set(Math.round(val / 100) / 10);
    lowpass_filter.frequency.value = val;
    
    let graph = [...Array(400).keys()].map(x => 24000/400 * x);
    let result = lowpass_filter.getMagnitudeResponse(graph);
    t.set(result);
};
*/

let env = synth.elements.env;

env.att.s.change = function() {
    let val = Math.pow(2, 5 * env.att.s.v / 4) - 1;
    env.att.i.set(Math.round(val * 100));
    tParams.attack = val;
    refreshInst();
};

env.dec.s.change = function() {
    let val = Math.pow(2, 7 * env.dec.s.v / 4) - 0.99;
    env.dec.i.set(Math.round(val * 100));
    tParams.decay = val;
    refreshInst();
};

env.sus.s.change = function() {
    let val = env.sus.s.v;
    env.sus.i.set(Math.round(val * 100));
    tParams.sustain = val;
    refreshInst();
};

env.rel.s.change = function() {
    let val = Math.pow(2, 7 * env.rel.s.v / 4) - 0.99;
    env.rel.i.set(Math.round(val * 100));
    tParams.release = val;
    refreshInst();
};

let scl = synth.elements.scl;

scl.fil.o.change = function() {
    let val = scl.fil.o.v.name.replace('.scl', '');
    scl.fil.t.set(val.substring(0, 8) + (val.length > 8 ? '...' : ''));
};

let reader = new TONES.ScalaReader(function(scalaFile) {
    tParams.scale = scalaFile.scale;
    
    refreshInst();
}, {
    domElement: scl.fil.o.dialog
});

let BASS_1 = "(G2{d:e,v:0.5}D3G3){d:1.3*e}R{d:-0.3*e}";
let BASS_2 = "(F2{d:e,v:0.5}C3F3){d:1.3*e}R{d:-0.3*e}";
let BASS_3 = "(Eb2{d:e,v:0.5}Bb2Eb3){d:1.3*e}R{d:-0.3*e}";
let MIDDLE_TUNE = "(A3{d:q,v:0.7}B3D4){d:e}G4R{d:-e}";
let MIDDLE_TUNE_2 = "(A3{d:q,v:0.7}Bb3D4){d:e}G4R{d:-e}";
let MIDDLE_TUNE_3 = "(A3{d:q,v:0.7}C4D4){d:e}G4R{d:-e}";
let HIGH_FOURTH = "[D6G6]{d:e,v:1}R{d:-h}";

let strn = `
${BASS_1}
${MIDDLE_TUNE}
${BASS_1}
${HIGH_FOURTH}
R{d:w}
${BASS_2}
${MIDDLE_TUNE}
${BASS_2}
${HIGH_FOURTH}
R{d:h+q}
D3{d:q,v:0.5}
${BASS_1}
${MIDDLE_TUNE}
${BASS_1}
${HIGH_FOURTH}
R{d:w}
${BASS_2}
${MIDDLE_TUNE}
${BASS_2}
${HIGH_FOURTH}
R{d:w}
${BASS_3}
${MIDDLE_TUNE_2}
${BASS_3}
${HIGH_FOURTH}
R{d:w}
${BASS_2}
${MIDDLE_TUNE_3}
${BASS_2}
${HIGH_FOURTH}
`;

let note_group = TONES.parseAbbreviatedGroup(strn);

function playDDD() {
    instrument.cancelAll();
    let time_context = new TONES.TimeContext(140, TONES.Context.currentTime + 0.3);
    note_group.schedule(instrument, time_context);
}

let svg = new TONES.SVGContext("bar");

let bar = new TONES.SVGLevelVisualizer(svg, {
    width: 50,
    height: 500,
    show_lines: false,
    bar_width: 1,
    normal_color: "#3c9",
    warning_color: "#fc3",
    peak_color: "#f36",
    background_color: "#fff",
    text_color: "#000",
    font: "Abel"
});

TONES.masterEntryNode.connect(bar.entry);

setTimeout(() => {
    bar.start();
}, 1000);


let downsampler = new TONES.Downsampler();

downsampler.connectFrom(TONES.masterEntryNode);