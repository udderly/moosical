(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (factory((global.TONES = {})));
}(this, (function (exports) { 'use strict';

    // https://developer.mozilla.org/en-US/docs/Web/API/Element/getAttributeNames
    if (Element.prototype.getAttributeNames === undefined) {
        Element.prototype.getAttributeNames = function () {
            let attributes = this.attributes;
            let length = attributes.length;
            let result = new Array(length);
            for (let i = 0; i < length; i++) {
                result[i] = attributes[i].name;
            }
            return result;
        };
    }

    const a = 0;

    try {
        exports.Context = new (window.AudioContext || window.webkitAudioContext)(); // Create Web Audio Context
    } catch (e) {
        alert("Your browser doesn't support the Web Audio API; audio functionality will be impaired.");
        console.warn("The browser does not support the Web Audio API; audio functionality will be impaired.");
    
        // TODO: Add popup?
    }

    /* Chain an array of nodes together in succession */
    function chainNodes(nodes) {
        for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].connect(nodes[i + 1]);
        }
    }

    /* Remove some nodes after a timeout */
    function removeNodesTimeout(nodes, timeout) {
        return setTimeoutAudioCtx(() => {
            for (let i = 0; i < nodes.length; i++) {
                nodes[i].disconnect();
            }
        }, timeout);
    }

    const masterEntryNode = exports.Context.createGain();        // Entry node for instruments + effects
    const masterGainNode = exports.Context.createGain();         // Master gain node
    const masterAnalyzerNode = exports.Context.createAnalyser(); // Analyzer node to look at whole waveform

    chainNodes([
        masterEntryNode,
        masterGainNode,
        exports.Context.destination
    ]);

    masterGainNode.connect(masterAnalyzerNode);

    const voidNode = exports.Context.createChannelMerger();      // Used to keep nodes alive
    const voidGainNode = exports.Context.createGain();
    voidGainNode.gain.setValueAtTime(0, 0);

    chainNodes([
        voidNode,
        voidGainNode,
        exports.Context.destination
    ]);

    /* Set master gain value */
    function setMasterGain(gain) {
        masterGainNode.gain.value = gain;
    }

    let previousVolume;

    function mute() { // mute
        previousVolume = masterGainNode.gain;
        setMasterGain(0);
    }

    function unmute() { // unmute
        setMasterGain(previousVolume);
    }

    function contextTime() { // AudioContext time
        return exports.Context.currentTime;
    }

    /* Class representing an AudioContext timeout allowing note_timeouts to be scheduled very precisely */
    class ContextTimeout {
        constructor(node, time, func) {
            this.node = node;
            this.time = time;

            this.node.onended = () => {
                func();
                node.disconnect();
            };

            this.cancelled = false;
        }

        ended() {
            return exports.Context.currentTime > this.time || this.cancelled;
        }

        cancel() {
            this.node.onended = (x => null);
            this.node.stop();
            this.node.disconnect();
            this.cancelled = true;
        }
    }

    /* Set an audio context timeout offset from the current time */
    function setTimeoutAudioCtx(func, time_delta) {
        let timingNode = exports.Context.createOscillator();
        let curr = exports.Context.currentTime;

        timingNode.start(curr + time_delta);
        timingNode.stop(curr + time_delta);

        timingNode.connect(exports.Context.destination);

        return new ContextTimeout(timingNode, curr + time_delta, func); // Returns a cancelable ContextTimeout object
    }

    /* Set an audio context timeout offset from AudioContext time 0 */
    function setTimeoutAbsoluteAudioCtx(func, audioCtxTime) {
        let timingNode = exports.Context.createOscillator();

        timingNode.start(audioCtxTime);
        timingNode.stop(audioCtxTime);

        timingNode.connect(exports.Context.destination);

        return new ContextTimeout(timingNode, audioCtxTime, func); // Returns a cancelable ContextTimeout object
    }

    /*
    General node class with input and output
    */
    class Node {
        constructor() {
            this.entry = exports.Context.createGain(); // entry to node
            this.exit = exports.Context.createGain(); // exit to node
            this.destroyed = false;
        }

        _checkDestroyed() {
            if (this.destroyed)
                throw new Error("Node is destroyed");
        }

        isDestroyed() {
            return this.destroyed;
        }

        connect(x) { // connect to node
            this._checkDestroyed();

            if (this._connect) {
                this._connect(x);
            }

            if (x instanceof Node) {
                this.exit.connect(x.entry);
            } else if (x instanceof EndingNode) {
                this.exit.connect(x.entry);
            } else {
                this.exit.connect(x);
            }
            return this;
        }

        disconnect(x) { // disconnect from node
            this._checkDestroyed();

            if (this._disconnect) {
                this._disconnect(x);
            }

            if (!x) {
                this.exit.disconnect();
            } else if (x instanceof Node) {
                this.exit.disconnect(x.entry);
            } else if (x instanceof EndingNode) {
                this.exit.disconnect(x.entry);
            } else {
                this.exit.disconnect(x);
            }

            return this;
        }

        destroy() {
            if (this.isDestroyed()) {
                return;
            }

            if (this._destroy) {
                this._destroy();
            }

            try {
                this.stop();
            } catch (e) {}

            this.disconnect();
            this.connect(voidNode); // allow further render quantums so the stop call propagates

            setTimeout(() => {
                this.exit.disconnect();
            }, 1000); // Disconnect it later

            this.destroyed = true;
        }

        connectToMaster() { // connect the node to master
            this.connect(masterEntryNode);
        }
    }

    /*
    Node with no input producing audio
    */
    class SourceNode {
        constructor() {
            this.exit = exports.Context.createGain();
            this.destroyed = false;
        }

        _checkDestroyed() {
            if (this.destroyed)
                throw new Error("Node is destroyed");
        }

        isDestroyed() {
            return this.destroyed;
        }

        connect(x) { // connect to node
            this._checkDestroyed();

            if (this._connect) {
                this._connect(x);
            }

            if (x instanceof Node) {
                this.exit.connect(x.entry);
            } else if (x instanceof EndingNode) {
                this.exit.connect(x.entry);
            } else {
                this.exit.connect(x);
            }

            return this;
        }

        disconnect(x) { // disconnect from node
            this._checkDestroyed();

            if (this._disconnect) {
                this._disconnect(x);
            }

            if (!x) {
                this.exit.disconnect();
            } else if (x instanceof Node) {
                this.exit.disconnect(x.entry);
            } else if (x instanceof EndingNode) {
                this.exit.disconnect(x.entry);
            } else {
                this.exit.disconnect(x);
            }

            return this;
        }

        destroy() { // destroy the node

            if (this.isDestroyed()) {
                return;
            }

            if (this._destroy) {
                this._destroy();
            }

            try {
                this.stop();
            } catch (e) {}

            this.disconnect();
            this.connect(voidNode); // allow further render quantums so the stop call propagates

            setTimeout(() => {
                this.exit.disconnect();
            }, 1000); // Disconnect it later

            this.destroyed = true;
        }

        connectToMaster() { // connect to master
            return this.connect(masterEntryNode);
        }
    }

    /*
    node with no output
    */
    class EndingNode {
        constructor() {
            this.entry = exports.Context.createGain();
            this.source = null;
        }

        connectFrom(node) { // connect from input node
            node.connect(this.entry);
            this.source = node;
        }
        
        connectFromMaster() { // connect from master node
            this.connectFrom(masterEntryNode);
        }

        disconnectFrom() { // disconnect from node
            this.source.disconnect(this.entry);
        }
    }

    /*
    General instrument class.

    panNode -> master pan of the instrument
    gainNode -> master gain of the instrument
    entryNode -> internal instrument sources should enter here
    */
    class Instrument extends SourceNode {
        constructor(parameters) {
            super(parameters.context);

            this.panNode = exports.Context.createStereoPanner();
            this.gainNode = exports.Context.createGain();
            this.entryNode = exports.Context.createGain();

            chainNodes([
                this.entryNode,
                this.gainNode,
                this.panNode,
                this.exit
            ]);

            if (parameters.destinationNode) // can specify node to connect to immediately
                this.exit.connect(parameters.destinationNode);

            this.previousVolume = null;
        }

        set volume(gain) {
            this.gainNode.gain = gain;
        }

        setVolume(volume) {
            this.volume = volume;
        }

        get volume() {
            return this.gainNode.gain;
        }

        mute() { // mute the instrument allowing unmuting to return to old volune
            this.previousVolume = this.volume;
            this.setVolume(0);
        }

        unmute() { // unmute the instrument
            this.setVolume(this.volume);
        }
    }

    class EnvelopeControlPoint {
        constructor(x, y) {
            if (Array.isArray(x)) {
                this.x = x[0];
                this.y = x[1];
            } else if (y !== undefined) {
                this.x = x;
                this.y = y;
            } else {
                this.x = x.x;
                this.y = x.y;
            }
        }
    }

    const EnvelopeVertical = {
        none: (x => x),
        octaves: (baseFrequency => (x => baseFrequency * Math.pow(2, x))),
        semitones: (baseFrequency => (x => baseFrequency * Math.pow(2, x / 12))),
        cents: (baseFrequency => (x => baseFrequency * Math.pow(2, x / 1200))),
        decibel_gain: (x => Math.pow(10, x / 20))
    };

    const EnvelopeVerticalInverse = {
        none: (x => x),
        octaves: (baseFrequency => (x => Math.log2(x / baseFrequency))),
        semitones: (baseFrequency => (x => Math.log(x / baseFrequency) / Math.log(1 / 12))),
        cents: (baseFrequency => (x => Math.log(x / baseFrequency) / Math.log(1 / 1200))),
        decibel_gain: (x => 20 * Math.log10(x))
    };

    const EnvelopeHorizontal = {
        none: (x => x),
        currTimeOffset: (x => x + exports.Context.currentTime),
        absoluteOffset: (time => (x => x + time)),
        offset: (time => (x => x + exports.Context.currentTime + time))
    };

    /* General envelope segment type. Envelope segment subclasses should have the following methods:

    valueAt(x)
    (maybe) override maxY()
    (maybe) override minY()
    sample(nPoints, minX = minX(), maxX = maxX()) returns array of y values for evenly spaced x values
    samplePoints(nPoints, minX = minX(), maxX = maxX()) returns array of x, y values
    segmentApproximation(fidelity = 0.95)
     */

    class EnvelopeSegment {
        constructor(p1i, p2i) {
            p1i = new EnvelopeControlPoint(p1i);
            p2i = new EnvelopeControlPoint(p2i);

            if (p1i === p2i) {
                throw new Error("Points cannot be the same.");
            }

            let p1, p2;

            if (p2i.x < p1i.x) {
                p1 = p2i;
                p2 = p1i;
            } else {
                p1 = p1i;
                p2 = p2i;
            }


            this.p1 = p1;
            this.p2 = p2;
        }

        minX() {
            return this.p1.x;
        }

        minY() {
            return Math.min(this.p1.y, this.p2.y);
        }

        maxX() {
            return this.p2.x;
        }

        maxY() {
            return Math.max(this.p1.y, this.p2.y);
        }

        contains(x) {
            return (this.minX() <= x && x <= this.maxX());
        }

        length() {
            return this.maxX() - this.minX();
        }
    }



    class LinearEnvelopeSegment extends EnvelopeSegment {
        constructor(p1i, p2i) {
            super(p1i, p2i);
        }

        valueAt(x) {
            return (x - this.p1.x) / (this.p2.x - this.p1.x) * (this.p2.y - this.p1.y) + this.p1.y;
        }

        sample(nPoints, minX = this.minX(), maxX = this.maxX()) {
            let array = new Float32Array(nPoints);
            let x_delta = maxX - minX;

            if (x_delta === 0) { // segment with 0 length
                let y_delta = this.p2.y - this.p1.y;
                for (let i = 0; i < nPoints; i++) {
                    array[i] = i / (nPoints - 1) * y_delta + this.p1.y;
                }
                return array;
            }

            for (let i = 0; i < nPoints; i++) {
                array[i] = this.valueAt(i / (nPoints - 1) * x_delta + minX);
            }

            return array;
        }

        samplePoints(nPoints, minX = this.minX(), maxX = this.maxX()) {
            let array = new Float32Array(2 * nPoints);
            let x_delta = maxX - minX;

            if (x_delta === 0) { // segment with 0 length
                let y_delta = this.p2.y - this.p1.y;
                for (let i = 0; i < nPoints; i++) {
                    array[2 * i] = this.minX();
                    array[2 * i + 1] = i / (nPoints - 1) * y_delta + this.p1.y;
                }
                return array;
            }

            for (let i = 0; i < nPoints; i++) {
                let x_value = i / (nPoints - 1) * x_delta + minX;
                array[2 * i] = x_value;
                array[2 * i + 1] = this.valueAt(x_value);
            }

            return array;
        }

        segmentApproximation(fidelity = 0.95) {
            return new Float32Array([this.p1.x, this.p1.y, this.p2.x, this.p2.y]);
        }

        static _segApproxArrayLength(fidelity = 0.95) {
            return 4;
        }
    }

    function expEnvSegApproxLen(fidelity, b2) {
        return Math.min(2 * Math.ceil(Math.max(1 / (1.51 - fidelity - Math.abs(b2 - 0.5)), 2 + 5 * fidelity)), 75);
    }

    class ExponentialEnvelopeSegment extends EnvelopeSegment {
        constructor(p1i, p2i, inter_y) {
            super(p1i, p2i);
            if (inter_y <= this.minY() || inter_y >= this.maxY()) {
                throw new Error("Intermediate y value must be between point y values");
            }
            this._inter_y = inter_y || (this.p1.y + this.p2.y) / 2;
        }

        valid() {
            return (inter_y > this.minY() && inter_y < this.maxY());
        }

        get inter_y() {
            return this._inter_y;
        }

        set inter_y(value) {
            if (value < this.minY() || value > this.maxY()) {
                throw new Error("Intermediate y value must be between point y values");
            }
        }

        valueAt(x) {
            let c1 = this.p2.x - this.p1.x, c2 = this.p2.y - this.p1.y;

            let b2 = (this.inter_y - this.p1.y) / c2;

            let q = (1 - b2) / b2;

            if (q > 1 - 1e-6 && q < 1 + 1e-6) {
                // Treat as linear
                return c2 * (x - this.p1.x) / c1 + this.p1.y;
            }

            return c2 * (Math.pow(q, 2 * (x - this.p1.x) / c1) - 1) / (q * q - 1) + this.p1.y;
        }

        sample(nPoints, minX = this.minX(), maxX = this.maxX()) {
            let array = new Float32Array(nPoints);
            let x_delta = maxX - minX;

            if (x_delta === 0) { // segment with 0 length
                let y_delta = this.p2.y - this.p1.y;
                for (let i = 0; i < nPoints; i++) {
                    array[i] = i / (nPoints - 1) * y_delta + this.p1.y;
                }
                return array;
            }

            for (let i = 0; i < nPoints; i++) {
                array[i] = this.valueAt(i / (nPoints - 1) * x_delta + minX);
            }

            return array;
        }

        samplePoints(nPoints, minX = this.minX(), maxX = this.maxX()) {
            let array = new Float32Array(2 * nPoints);
            let x_delta = maxX - minX;

            if (x_delta === 0) { // segment with 0 length
                let y_delta = this.p2.y - this.p1.y;
                for (let i = 0; i < nPoints; i++) {
                    array[2 * i] = this.minX();
                    array[2 * i + 1] = i / (nPoints - 1) * y_delta + this.p1.y;
                }
                return array;
            }

            for (let i = 0; i < nPoints; i++) {
                let x_value = i / (nPoints - 1) * x_delta + minX;
                array[2 * i] = x_value;
                array[2 * i + 1] = this.valueAt(x_value);
            }

            return array;
        }

        segmentApproximation(fidelity = 0.95) {
            // Pretty optimized (about 0.0017 ms for 14 points at fidelity = 1)
            let c2 = this.p2.y - this.p1.y;
            let b2 = (this.inter_y - this.p1.y) / c2;

            let q = (1 - b2) / b2;

            if (q > 1 - 1e-6 && q < 1 + 1e-6) {
                // Treat as linear
                return new Float32Array([this.p1.x, this.p1.y, this.p2.x, this.p2.y]);
            }

            let nPoints = expEnvSegApproxLen(fidelity, b2);
            let array = new Float32Array(2 * nPoints);
            let g = q * q;

            let log_g = Math.log(g);

            let inverse_derivative = x => Math.log(x * (g - 1) / log_g) / log_g;

            let value = x => c2 * (x * (g - 1) / log_g - 1) / (g - 1) + this.p1.y;

            let d_0 = Math.atan(log_g / (g - 1));
            let h_a = Math.atan(g * log_g / (g - 1)) - d_0;

            let c1 = this.p2.x - this.p1.x;

            for (let i = 0; i < nPoints; i++) {
                let slope = Math.tan(i / (nPoints - 1) * h_a + d_0);

                array[2 * i] = inverse_derivative(slope) * c1 + this.p1.x;
                array[2 * i + 1] = value(slope);
            }

            return array;
        }


        _segApproxArrayLength(fidelity = 0.95) {
            let b2 = (this.inter_y - this.p1.y) / (this.p2.y - this.p1.y);
            let q = (1 - b2) / b2;

            if (q > 1 - 1e-6 && q < 1 + 1e-6) {
                return 4;
            }

            return 2 * expEnvSegApproxLen(fidelity, b2);
        }
    }

    class QuadraticEnvelopeSegment extends EnvelopeSegment {
        constructor(p1i, p2i, inter_point) {
            inter_point = new EnvelopeControlPoint(inter_point);

            super(p1i, p2i);

            this._inter_point = inter_point || new EnvelopeControlPoint([(p1i.x + p2i.x) / 2, (p1i.y + p2i.y) / 2]);
        }
    }

    function transformPoints(segments, vTransform) {
        for (let i = 0; i < segments.length/2; i++) {
            segments[2*i+1] = vTransform(segments[2*i + 1]);
        }
        return segments;
    }

    function transformSegments(segments, vTransform, fidelity = 0.95) {
        for (let i = 0; i < segments.length/2; i++) {
            segments[2*i+1] = vTransform(segments[2*i + 1]);
        }
        return segments;
    }

    class Envelope {
        constructor(segments, vTransform = EnvelopeVertical.none) {
            if (!Array.isArray(segments)) {
                throw new Error("Array of segments must be passed to Envelope constructor.");
            }
            if (segments.length < 1) {
                throw new Error("Not enough segments passed to Envelope constructor.");
            }

            this.segments = [];

            for (let i = 0; i < segments.length; i++) {
                // Make sure segments don't intersect
                if (i !== 0) {
                    let prevMax = segments[i - 1].maxX();
                    let currMin = segments[i].minX();
                    if (prevMax > currMin) {
                        throw new Error("Intersecting or invalid segments at indices " + String(i - 1) + ", " + String(i));
                    } else if (prevMax < currMin) {
                        // interpolation between end and start points that are discontinuous (instant jump to later value)
                        this.segments.push(new LinearEnvelopeSegment(segments[i - 1].p2, [segments[i].p1.x, segments[i - 1].p2.y]));
                    }
                }
                this.segments.push(segments[i]);
            }

            this.vTransform = vTransform;
        }

        minX() {
            return this.segments[0].minX();
        }

        maxX() {
            return this.segments[this.segments.length - 1].maxX();
        }

        minY() {
            return Math.min(...this.segments.apply(x => x.p1.y), ...this.segments.apply(x => x.p2.y));
        }

        maxY() {
            return Math.max(...this.segments.apply(x => x.p1.y), ...this.segments.apply(x => x.p2.y));
        }

        addSegment(segment) {
            let segMinX = segment.minX();
            let maxX = this.maxX();

            if (segMinX === maxX) {
                this.segments.push(segment);
            } else if (segMinX > maxX) {
                this.segments.push(new EnvelopeSegment(this.segments[this.segments.length - 1].p2, segment.p1));
            } else {
                throw new Error("Discontinuous segment.");
            }
        }

        valueAt(x) {
            if (x < this.minX()) {
                return this.valueAt(this.minX());
            } else if (x > this.maxX()) {
                return this.valueAt(this.maxX());
            }

            for (let i = 0; i < this.segments.length; i++) {
                let segment = this.segments[i];

                if (segment.minX() <= x && segment.maxX() >= x) {
                    return segment.valueAt(x);
                }
            }
        }

        sample(nPoints, minX = this.minX(), maxX = this.maxX()) {
            let array = new Float32Array(nPoints);
            let x_delta = maxX - minX;

            for (let i = 0; i < nPoints; i++) {
                array[i] = this.valueAt(i / (nPoints - 1) * x_delta + minX);
            }

            return array.map(this.vTransform);
        }

        samplePoints(nPoints, minX = this.minX(), maxX = this.maxX()) {
            let array = new Float32Array(2 * nPoints);
            let x_delta = maxX - minX;

            for (let i = 0; i < nPoints; i++) {
                let x_value = i / (nPoints - 1) * x_delta + minX;
                array[2 * i] = x_value;
                array[2 * i + 1] = this.valueAt(x_value);
            }

            return transformPoints(array, this.vTransform);
        }

        segmentApproximation(fidelity = 0.95) {
            let arrayLength = 0;

            for (let i = 0; i < this.segments.length; i++) {
                arrayLength += this.segments[i]._segApproxArrayLength(fidelity);
            }

            let array = new Float32Array(arrayLength);

            let x_value = 0;

            for (let i = 0; i < this.segments.length; i++) {
                let approximation = this.segments[i].segmentApproximation(fidelity);

                array.set(approximation, x_value);
                x_value += approximation.length;
            }

            return transformSegments(array, this.vTransform, fidelity);
        }

        smartSample(resolution = 0.1, minSegSamples = 3) {
            let nPoints = 0;
            for (let i = 0; i < this.segments.length; i++) {
                let segment = this.segments[i];

                nPoints += Math.max(Math.ceil(segment.length() / resolution), 3);
            }

            let array = new Float32Array(2 * nPoints);
            let x_value = 0;

            for (let i = 0; i < this.segments.length; i++) {
                let segment = this.segments[i];
                let approximation = segment.samplePoints(Math.max(Math.ceil(segment.length() / resolution), minSegSamples));

                for (let j = 0; j < approximation.length / 2; j++) {
                    approximation[2 * j + 1] = this.vTransform(approximation[2 * j + 1]);
                }

                array.set(approximation, x_value);
                x_value += approximation.length;
            }

            return array;
        }

        apply(parameter, hTransform = EnvelopeHorizontal.currTimeOffset, resolution = 0.1, minSegSamples = 3, vTransform = EnvelopeVertical.none) {
            applySegmentsToParameter(this.smartSample(resolution, minSegSamples), parameter, hTransform);
        }
    }

    function applySegmentsToParameter(segments, parameter, hTransform = EnvelopeHorizontal.currTimeOffset, vTransform = EnvelopeVertical.none) {
        let prev_x = hTransform(segments[0]);
        let prev_y = vTransform(segments[1]);
        parameter.setValueAtTime(prev_y, prev_x);

        for (let i = 0; i < segments.length / 2; i++) {
            let new_x = hTransform(segments[2 * i]);
            let new_y = vTransform(segments[2 * i + 1]);

            if (prev_x === new_x) {
                parameter.setValueAtTime(new_y, new_x);
            } else {
                parameter.linearRampToValueAtTime(new_y, new_x);
            }

            prev_x = new_x;
            prev_y = new_y;
        }
    }

    function clamp(value, min, max, name) {
        if (value > max) {
            console.warn(`Value ${name} outside nominal range [${min}, ${max}]; value will be clamped.`);
            return max;
        } else if (value < min) {
            console.warn(`Value ${name} outside nominal range [${min}, ${max}]; value will be clamped.`);
            return min;
        } else {
            return value;
        }
    }

    function desmosPrint(pointArray, minX, maxX) {
        let out_str = "";
        if (minX) { // just y values
            for (let i = 0; i < pointArray.length; i++) {
                out_str += `${i / (pointArray.length - 1) * (maxX - minX) + minX}\t${pointArray[i]}\n`;
            }
        } else { // x, y, x, y
            for (let i = 0; i < pointArray.length / 2; i++) {
                out_str += `${pointArray[i * 2]}\t${pointArray[i * 2 + 1]}\n`;
            }
        }
    }

    function isNumeric(n) {
        return (n !== null) && (n !== undefined) && !!n.toFixed;
    }

    function isString(s) {
        return (typeof s === 'string' || s instanceof String);
    }

    let ID_INDEX = 0;

    function getID() {
        return ++ID_INDEX;
    }

    class CancellableTimeout {
        constructor(func, secs, absoluteAudioCtxTime = false) {
            this.end_time = (absoluteAudioCtxTime ? 0 : exports.Context.currentTime) + secs;

            let f_c = () => {
                if (exports.Context.currentTime >= this.end_time) {
                    this._ended = true;
                    func();
                } else {
                    this.timeout = setTimeout(f_c, 2000/3 * (this.end_time - exports.Context.currentTime));
                }
            };

            this.timeout = setTimeout(f_c, 2000 / 3 * (this.end_time - exports.Context.currentTime));

            this._ended = false;
        }

        cancel() {
            clearTimeout(this.timeout);
            this._ended = true;
        }

        ended() {
            return this._ended;
        }
    }

    function assert(test, message = "Assertion error") {
        if (!test) {
            throw new Error(message);
        }
    }

    function compareObjects(object1, object2) {
        for (let p in object1){
            if (object1.hasOwnProperty(p)) {
                if (object1[p] !== object2[p]) {
                    return false;
                }
            }
        }

        for (let p in object2) {
            if (object2.hasOwnProperty(p)) {
                if (object1[p] !== object2[p]) {
                    return false;
                }
            }
        }

        return true;
    }

    function select(s1, ...args) {
        if (s1 !== undefined) {
            return s1;
        } else {
            if (args.length === 0) {
                return undefined;
            }

            return select(...args);
        }
    }

    function time(func, times = 1) {
        let time = performance.now();

        for (let i = 0; i < times; i++)
            func();

        return (performance.now() - time) / times;
    }

    function isInteger(x) {
        return isNumeric(x) && (x % 1 === 0);
    }

    function inRange(x, min, max) {
        return (min <= x) && (x <= max);
    }

    function inStrictRange(x, min, max) {
        return (min < x) && (x < max);
    }

    var utils = /*#__PURE__*/Object.freeze({
        clamp: clamp,
        isNumeric: isNumeric,
        CancellableTimeout: CancellableTimeout,
        isString: isString,
        desmosPrint: desmosPrint,
        getID: getID,
        assert: assert,
        compareObjects: compareObjects,
        select: select,
        time: time,
        isInteger: isInteger,
        inRange: inRange,
        inStrictRange: inStrictRange
    });

    const isNumeric$1 = isNumeric;

    // Terminology

    // 0 -> C-1, 1 -> C#-1, etc., like MIDI in scientific pitch notation
    // Black notes are named as a sharp by default
    // Sharp -> #, Double sharp -> ##, Flat -> b, Double flat -> bb

    /* Name of notes in the chromatic scale */
    const octave_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    /* Mod function allowing proper result for negative numbers */
    function mod(n, m) {
        return ((n % m) + m) % m;
    }

    /* Note to scientific pitch notation */
    function noteToName(note) {
        return octave_names[mod(note, 12)] + String(parseInt(note / 12) - 1);
    }

    /* Number of semitones corresponding with each letter; C is base note */
    const letter_nums = {
        "C": 0,
        "D": 2,
        "E": 4,
        "F": 5,
        "G": 7,
        "A": 9,
        "B": 11
    };

    /* Number of semitones corresponding with each accidental */
    const accidental_offsets = {
        "#": 1,
        "##": 2,
        "B": -1,
        "BB": -2,
        "b" : -1,
        "bb": -2,
        "s": 1,
        "ss" : 2,
        "S": 1,
        "SS": 2
    };

    /* Convert a note name to a numerical note */
    function nameToNote(name) {
        //                letter   accidental  -?  number
        let groups = /^([ABCDEFG])(#|##|B|BB|S|SS)?(-)?([0-9]+)$/.exec(name.toUpperCase().trim());

        try {
            return letter_nums[groups[1]] +                           // semitone offset of note without accidental
                (groups[2] ? accidental_offsets[groups[2]] : 0) +     // semitone offset of accidental
                (groups[3] ? -12 : 12) * (parseInt(groups[4])) + 12;  // octave offset of note
        } catch (e) {
            throw new Error("Invalid note");
        }
    }

    /* Allowed names for various interval types */
    const augmented_names = ["A", "AUG", "AUGMENTED"];
    const diminished_names = ["D", "DIM", "DIMIN", "DIMINISHED"];
    const perfect_names = ["P", "PERF", "PERFECT"];

    /* Return the quality of an interval (i.e. major, minor, diminished, perfect, augmented) given its name */
    function getIntervalQuality(desc) {
        desc = desc.trim();

        if (desc[0] === "m" || desc[0] === "M") {
            // Interval is major or minor

            let desc_upper = desc.toUpperCase();

            if (desc_upper.includes("MIN")) {
                return "min";
            } else if (desc_upper.includes("MAJ")) {
                return "maj";
            } else if (desc[0] === "m" && desc.length === 1) { // If name of interval is lowercase m, it's minor
                return "min";
            } else if (desc[0] === "M" && desc.length === 1) { // If uppercase, it's major
                return "maj";
            } else {
                throw new Error("Invalid interval");
            }
        }

        let desc_upper = desc.toUpperCase();
        if (augmented_names.includes(desc_upper))
            return "aug";
        if (diminished_names.includes(desc_upper))
            return "dim";
        if (perfect_names.includes(desc_upper))
            return "perf";

        throw new Error("Invalid interval");
    }

    /* Get the nominal size of an interval (not in semitones) */
    function getIntervalSize(ord) {
        switch (ord) {
            case "one": case "first": case "1st": case "unison":
                return 1;
            case "two": case "second": case "2nd":
                return 2;
            case "three": case "third": case "3rd":
                return 3;
            case "four": case "fourth":
                return 4;
            case "five": case "fifth":
                return 5;
            case "six": case "sixth":
                return 6;
            case "seven": case "seventh":
                return 7;
            case "eight": case "eighth": case "octave":
                return 8;
            case "nine": case "ninth":
                return 9;
            case "ten": case "tenth":
                return 10;
            case "eleven": case "eleventh":
                return 11;
            case "twelve": case "twelfth":
                return 12;
            case "thirteen": case "thirteenth":
                return 13;
            case "fourteen": case "fourteenth":
                return 14;
            case "fifteen": case "fifteenth":
                return 15;
            case "sixteen": case "sixteenth":
                return 16;
            case "seventeen": case "seventeenth":
                return 17;
            case "eighteen": case "eighteenth":
                return 18;
            case "nineteen": case "nineteenth":
                return 19;
            case "twenty": case "twentieth":
                return 20;
        }

        //              number  ord
        let groups = /^([0-9]+)(th|)?$/.exec(ord);

        if (groups) {
            return parseInt(groups[1]);
        }
        return null;
    }

    /* Convert interval name to numerical interval */
    function nameToInterval(name) {
        name = name.trim();
        let upper_name = name.toUpperCase();

        if (upper_name === "TT" || upper_name === "tritone")
            return KeyboardIntervals.tritone;
        if (upper_name === "unison")
            return KeyboardIntervals.unison;
        if (upper_name === "octave")
            return KeyboardIntervals.octave;

        //               quality       interval
        let groups = /^([A-Za-z]+)\s*([A-Za-z0-9]+)$/.exec(name);

        if (!groups)
            throw new Error("Invalid interval.");

        let quality = getIntervalQuality(groups[1]);
        let value = getIntervalSize(groups[2]);

        if (!isNumeric$1(value) || !quality || !value)
            throw new Error("Invalid interval.");

        let m_value = value % 7;            // offset from the octave
        let s_value = parseInt(value / 7);  // number of octaves

        if ([4, 5, 1].includes(value % 7)) { // fourths, fifths, unisons
            value = s_value * 12;

            switch (m_value) {
                case 4: // fourth
                    value += 5;
                    break;
                case 5: // fifth
                    value += 7;
                    break;
                case 1: // unison
                default:
            }

            switch (quality) {
                case "dim":
                    return new KeyboardInterval(value - 1);
                case "aug":
                    return new KeyboardInterval(value + 1);
                case "perf":
                    return new KeyboardInterval(value);
                default:
                case "min":
                case "maj":
                    throw new Error("Invalid interval.");
            }
        } else { // seconds, thirds, sixths, sevenths
            value = s_value * 12;

            switch (m_value) {
                case 0: // seventh
                    value += 11;
                    break;
                case 2: // second
                    value += 2;
                    break;
                case 3: // third
                    value += 4;
                    break;
                case 6: // sixth
                    value += 9;
                    break;
            }

            switch (quality) {
                case "dim":
                    return new KeyboardInterval(value - 2);
                case "aug":
                    return new KeyboardInterval(value + 1);
                case "min":
                    return new KeyboardInterval(value - 1);
                case "maj":
                    return new KeyboardInterval(value);
                default:
                case "perf":
                    throw new Error("Invalid interval.");
            }
        }
    }

    const numericalIntervals = [["P", 1], ["m", 2], ["M", 2], ["m", 3], ["M", 3], ["P", 4], ["A", 4], ["P", 5], ["m", 6], ["M", 6], ["m", 7], ["M", 7]];

    /* Convert numerical interval to name */
    function intervalToName(interval_size) {
        let s_value = interval_size % 12;
        let m_value = parseInt(interval_size / 12);

        let interval = numericalIntervals[s_value];


        let value = m_value * 7 + interval[1];

        return interval[0] + String(value);
    }

    /* Common keyboard intervals */
    const KeyboardIntervals = {
        unison: 0,
        minor_second: 1,
        major_second: 2,
        minor_third: 3,
        major_third: 4,
        perfect_fourth: 5,
        tritone: 6,
        perfect_fifth: 7,
        minor_sixth: 8,
        major_sixth: 9,
        minor_seventh: 10,
        major_seventh: 11,
        octave: 12
    };

    function _isKeyboardNoteInstance(note) {
        return (note instanceof KeyboardPitch);
    }

    function _isKeyboardIntervalInstance(interval) {
        return (interval instanceof KeyboardInterval);
    }

    /* Unique note on the piano */
    class KeyboardPitch {
        constructor(note) {
            if (isNumeric$1(note)) {
                this.value = note;
            } else if (_isKeyboardNoteInstance(note)) {
                this.value = note.value;
            } else {
                this.value = nameToNote(note);
            }
        }

        subtract(note) { // subtract note or Interval
            if (_isKeyboardNoteInstance(note) || isNumeric$1(note)) {
                return new KeyboardInterval(this.value - new KeyboardPitch(note).value);
            } else if (_isKeyboardIntervalInstance(note)) {
                return new KeyboardPitch(this.value - note.value);
            }
        }

        add(interval) { // add interval
            return new KeyboardPitch(this.value + interval.value);
        }

        name() { // name of note
            return noteToName(this.value);
        }

        twelveTETFrequency() { // frequency in 12TET
            return Math.pow(2, (this.value - 69) / 12) * 440;
        }
    }

    /* Pass arguments to KeyboardPitch constructor */
    function makeKeyboardPitch(...args) {
        return new KeyboardPitch(...args);
    }

    /* Interval on the piano */
    class KeyboardInterval {
        constructor(arg1, arg2) {
            if (isNumeric(arg1) && arg2 === undefined) {
                this.value = arg1;
            } else if (arg2 !== undefined) {
                this.value = new KeyboardPitch(arg2).subtract(new KeyboardPitch(arg1)).value;
            } else if (_isKeyboardIntervalInstance(arg1)) {
                this.value = arg1.value;
            } else if (typeof arg1 === "string") {
                this.value = nameToInterval(arg1).value;
            }
        }

        add(interval) { // add interval
            return new KeyboardInterval(this.value + (new KeyboardInterval(interval)).value);
        }

        subtract(interval) { // subtract interval
            return new KeyboardInterval(this.value - (new KeyboardInterval(interval)).value);
        }

        negate() {
            return new KeyboardInterval(-this.value);
        }

        cents() { // 12-TET
            return this.value * 100;
        }

        ratio() { // interval value in 12 tet
            return Math.pow(2, this.value / 12);
        }

        name() { // name of interval
            return intervalToName(this.value);
        }
    }

    /* Pass arguments to KeyboardInterval constructor */
    function makeKeyboardInterval(...args) {
        return new KeyboardInterval(...args);
    }

    /* Convert KeyboardIntervals to actual KeyboardInterval instances */
    for (let key in KeyboardIntervals) {
        KeyboardIntervals[key] = new KeyboardInterval(KeyboardIntervals[key]);
    }

    Object.freeze(KeyboardIntervals);

    /* Notes C0 to G9, notes for easy access; sharps are s instead of # */
    const KeyboardPitches = {};

    for (let i = 12; i < 128; i++) {
        let note = new KeyboardPitch(i);

        KeyboardPitches[note.name().replace("#", "s")] = note;
    }

    Object.freeze(KeyboardPitches);

    class KeyboardMapping {
        constructor(dict, func) { // Key pathway: (keypress / keyup) -> dict -> func call (KeyboardPitch, bool pressed)
            this.keydict = dict;
            this.func = func;
            this.enabled = false;
            this.keyPress = (evt => {
                try {
                    this.func(this.keydict[evt.key], true);
                } catch (e) {
                    console.log(e);
                    // Key that's not in the mapping, ok
                }
            });
            this.keyUp = (evt => {
                try {
                    this.func(this.keydict[evt.key], false);
                } catch (e) {
                    console.log(e);
                    // Key that's not in the mapping, ok
                }
            });
        }

        enable() {
            if (!this.enabled) {
                document.addEventListener("keypress", this.keyPress);
                document.addEventListener("keyup", this.keyUp);
                this.enabled = true;
            }
        }

        disable() {
            if (this.enabled) {
                document.removeEventListener("keypress", this.keyPress);
                document.removeEventListener("keyup", this.keyUp);
                this.enabled = false;
            }
        }

        dictApply(func) {
            for (let key in this.keydict) {
                this.keydict[key] = func(this.keydict[key]);
            }
        }

        transform(key) {
            return this.keydict[key];
        }

        virtualPress(key) {
            this.func(this.keydict[key], true);
        }

        virtualRelease(key) {
            this.func(this.keydict[key], false);
        }
    }

    let N = KeyboardPitches;

    let _DefaultKeyboardMapping = {
        "z" : N.C3,
        "s" : N.Cs3,
        "x" : N.D3,
        "d" : N.Ds3,
        "c" : N.E3,
        "v" : N.F3,
        "g" : N.Fs3,
        "b" : N.G3,
        "h" : N.Gs3,
        "n" : N.A3,
        "j" : N.As3,
        "m" : N.B3,
        "," : N.C4,
        "l" : N.Cs4,
        "." : N.D4,
        ";" : N.Ds4,
        "/" : N.E4,
        "q" : N.C4,
        "2" : N.Cs4,
        "w" : N.D4,
        "3" : N.Ds4,
        "e" : N.E4,
        "r" : N.F4,
        "5" : N.Fs4,
        "t" : N.G4,
        "6" : N.Gs4,
        "y" : N.A4,
        "7" : N.As4,
        "u" : N.B4,
        "i" : N.C5,
        "9" : N.Cs5,
        "o" : N.D5,
        "0" : N.Ds5,
        "p" : N.E5,
        "[" : N.F5,
        "=" : N.Fs5,
        "]" : N.G5
    };

    function getDefaultKeyboardDict() {
        return Object.assign({}, _DefaultKeyboardMapping);
    }

    // Hz is associated with Frequencies
    // ratio is associated with Intervals

    function _isFrequency(obj) {
        return !!obj.Hz;
    }

    function _isInterval(obj) {
        return !!obj.ratio;
    }

    /*
    Represents a specific pitch or frequency
    */
    class Pitch {
        constructor(value) {
            if (_isFrequency(value)) { // convert from object with an Hz() method, such as this class
                this.value = value.Hz();
            } else if (value instanceof KeyboardPitch) { // convert from keyboard pitch (12tet)
                this.value = value.twelveTETFrequency();
            } else {
                this.value = value; // value is in Hz
            }
        }

        Hz() { // Hz
            return this.value;
        }

        period() { // seconds
            return 1 / this.value;
        }

        add(interval) { // new pitch with an added interval
            return new Pitch(this.value * interval.ratio());
        }

        subtract(note) {
            if (note.ratio) { // subtracting interval
                return new Pitch(this.value / interval.ratio());
            } else { // subtracting a note
                return new Interval(note.value / this.value);
            }
        }
    }

    /*
    Various basic interval units
    */
    let intervalUnits = {
        cents : 1.000577789506554859297,
        schismas : 1.001129150390625,
        semitones : 1.059463094359295264562,
        tones: 1.122462048309372981434,
        tritones: 1.414213562373095048802,
        octaves: 2,
        millioctaves: 1.000693387462580632538,
        savarts: 1.002305238077899671915,
        decades: 10,
        merides: 1.016248692870695627673,
        heptamerides: 1.002305238077899671915,
        demiheptamerides: 1.001151955538168876984,
        decamerides: 1.000230285020824752684,
        jots: 1.000023026116026880671,
        syntonic_commas: 81/80,
        pythagorean_commas: 531441 / 524288
    };

    // Construct interval from an object of the form {cents: "150", semitones: "5", ... }
    function getIntervalFromObj(obj) {
        let interval_out = new Interval(1);

        for (let key in intervalUnits) {
            if (obj[key]) {
                interval_out = interval_out.add(intervalUnits[key].stack(obj[key]));
            }
        }

        return interval_out;
    }

    /*
    Interval between two notes
    */
    class Interval {
        constructor(arg1, arg2) {
            if (arg1 && arg2) { // difference between two frequencies
                arg1 = new Pitch(arg1);
                arg2 = new Pitch(arg2);

                this.value = arg2.Hz() / arg1.Hz();
            } else if (arg1) {
                if (isNumeric(arg1)) {
                    this.value = arg1;
                } else if (_isInterval(arg1)) { // duplicate Interval
                    this.value = arg1.value;
                } else {
                    if (arg1 instanceof KeyboardInterval) { // get ratio from keyboardinterval (12tet)
                        this.value = arg1.ratio();
                    } else { // get from object
                        this.value = getIntervalFromObj(arg1).value;
                    }
                }
            }
        }

        reverse() { // negate the interval
            return new Interval(1 / this.value);
        }

        subtract(interval, times = 1) { // result of subtracting interval * times from this
            return new Interval(this.value / interval.stack(times).value);
        }

        add(interval, times = 1) { // result of adding interval * times from this
            return new Interval(this.value * interval.stack(times).value);
        }

        divideByInterval(interval) { // how much interval can fit in this
            return Math.log(this.value, interval.value);
        }

        divide(number) { // size of each piece if divided into number intervals
            return new Interval(Math.pow(this.value, 1 / number));
        }

        stack(times = 1) { // stacking the interval some number of times
            return new Interval(Math.pow(this.value, times));
        }

        ratio() { // frequency ratio
            return this.value;
        }
    }

    for (let key in intervalUnits) { // convert intervalUnits to Interval objects
        intervalUnits[key] = new Interval(intervalUnits[key]);
    }

    function makePitch(...args) { // factory function for pitch
        return new Pitch(...args);
    }

    function makeInterval(...args) { // factory function for intervals
        return new Interval(...args);
    }

    let TwelveTETIntervals = { // Basic 12tet intervals
        unison: 1,
        minor_second: {cents: 100},
        semitone: {cents : 100},
        major_second: {cents : 200},
        tone: {cents: 200},
        whole_tone : {cents: 200},
        minor_third: {cents: 300},
        major_third: {cents: 400},
        perfect_fourth: {cents: 500},
        tritone: {cents: 600},
        perfect_fifth: {cents: 700},
        minor_sixth : {cents: 800},
        major_sixth : {cents: 900},
        minor_seventh: {cents: 1000},
        major_seventh: {cents: 1100},
        octave: 2
    };

    for (let key in TwelveTETIntervals) {
        TwelveTETIntervals[key] = new Interval(TwelveTETIntervals[key]);
    }

    class PitchMapping {
        constructor(pitchDict, pitchMap = (x => x), kPitchMap = (x => x)) {
            this.dict = pitchDict;
            this.pitchMap = pitchMap; // Changing a frequency
            this.kPitchMap = kPitchMap; // Changing the nominal meaning of a keyboard pitch
        }

        transform(keyboardPitch) {
            return this.pitchMap(this.dict[this.kPitchMap(keyboardPitch.value)]);
        }

        dictApply(func) {
            for (let key in this.dict) {
                this.dict[key] = func(this.dict[key]);
            }
        }
    }

    let twelveTETDict = {};

    for (let i = 0; i < 128; i++) {
        twelveTETDict[i] = (new KeyboardPitch(i)).twelveTETFrequency();
    }

    let twelveTETMapping = new PitchMapping(twelveTETDict);

    let PitchMappings = {
        ET12 : twelveTETMapping
    };

    function pitchMappingFromScale(scale, baseNote = Tones.KeyboardPitches.C4, baseFrequency) {
        // scale is array of intervals or single arguments to an interval constructor

        scale = scale.map(f => new Interval(f));

        let scale_length = scale.length;
        let scale_repeating_interval = scale[scale_length - 1];
        baseFrequency = new Pitch(baseFrequency || baseNote.twelveTETFrequency());

        let dict = {};

        let scaleRepeats = Math.ceil((baseNote.value + 1) / scale_length);
        let bottom = baseNote.value - scaleRepeats * scale_length;

        for (let offset = bottom, scaleR = -scaleRepeats; offset < 129; offset += scale_length, scaleR++) {
            for (let i = offset + 1, j = 0; j < scale_length; i++, j++) {
                dict[i] = baseFrequency.add(scale[j]).add(scale_repeating_interval.stack(scaleR)).Hz();
            }
        }

        return new PitchMapping(dict);
    }

    function periodicClearTimeout(list, timeout = 1000) {
        let timer = setInterval(() => {
            for (let i = 0; i < list.length; i++) {
                if (list[i].ended()) {
                    list.splice(i, 1);
                    i--;
                }
            }
        }, timeout);
    }

    // Abstract class, Instrument with pitch
    class PitchedInstrument extends Instrument {
        constructor(parameters = {}) {
            /*
            Takes parameters: pitch_mapping
            Creates functions:
                schedule(KeyboardNote, msBefore = 100)
                    -> if (note.start < currentTime) don't schedule it, also takes into account overlapping notes, returns
                       cancellable object allowing the note to be cancelled; cancelling during playing causes instant release,
                       msBefore is how many milliseconds before the note is played it should be internally scheduled
                playPitch(KeyboardPitch, vel = 1, pan = 0)
                    -> play a pitch with velocity vel and pan value pan immediately (useful for interactive playPitch)
                releasePitch(KeyboardPitch)
                    -> release a pitch (useful for interactive play)
                predictedState(audioCtxTime)
                    -> get the predicted state of all notes, based on currently playing and scheduled notes, as a boolean array
                releaseAll()
                    -> immediately release all notes, but don't cancel later scheduled notes
                cancelAll()
                    -> immediately release all notes and cancel all scheduled notes
                isPlaying
            Requires functions:
                createNode(pitch, start, end)
                    -> returning an object with the following properties:
                        _connect(node), connecting the note's exit node to a node,
                        _disconnect(), disconnecting the note's exit node,
                        _release(), immediately releasing the note;
                        _cancel(), immediately cancelling the note;
                        _destroy(), immediately destroying the note,
                        _timeAfterRelease(), returning the amount of time needed until the note can be destroyed after release
             */

            super(parameters);

            this.pitch_mapping = parameters.pitch_mapping || PitchMappings.ET12;

            this.note_states = Array(128);

            for (let i = 0; i < 128; i++) {
                /*
                Each entry in future_nodes as well as active node, will have the following format:
                node: output of createNode (with cancel functions etc.),
                start: seconds against audio context time of note start,
                end: seconds against audio context time of note end
                */

                this.note_states[i] = {
                    future_nodes: [],
                    active_note: null,
                };
            }

            this.internal_timeouts = [];

            this._timeout_interval = periodicClearTimeout(this.internal_timeouts);
            this._active_note_remover = setInterval(() => {
                this.clearOldActiveNodes();
            }, 500);
        }

        frequencyOf(keyboardPitch) {
            return this.pitch_mapping.transform(keyboardPitch);
        }

        getNoteState(note_num) {
            return this.note_states[note_num];
        }

        getActiveNote(note_num) {
            return this.note_states[note_num].active_note;
        }

        hasEventsScheduled(note_num) {
            let state = this.getNoteState(note_num);

            return !(state.future_nodes.length === 0 && !state.active_note);
        }

        predictNoteState(note_num) { // Return the predicted note state
            if (!this.hasEventsScheduled(note_num)) {
                return {
                    future_nodes: [],
                    active_note: null
                }
            }

            let curr_state = this.getNoteState(note_num);

            for (let i = 0; i < curr_state.future_nodes.length; i++) {
                let node = curr_state[i];

                // TODO
            }
        }

        _addInternalTimeout(timeout) {
            this.internal_timeouts.push(timeout);
        }

        setActiveNodeFromFuture(pitch, node) {
            let note_state = this.getNoteState(pitch);

            if (note_state.active_note)
                note_state.active_note.node.release();

            let node_index = note_state.future_nodes.indexOf(node);
            note_state.active_note = note_state.future_nodes.splice(node_index, 1)[0];
        }

        setLongActiveNode(pitch, node) {
            let note_state = this.getNoteState(pitch);

            if (note_state.active_note)
                note_state.active_note.node.release();


            note_state.active_note = {
                node: node,
                start: exports.Context.currentTime,
                end: Infinity
            };
        }

        clearOldActiveNodes() {
            for (let i = 0; i < 128; i++) {
                let curr_state = this.getNoteState(i);

                if (curr_state.active_note) {
                    if (curr_state.active_note.end < exports.Context.currentTime + 0.05) {
                        curr_state.active_note = null;
                    }
                }
            }
        }

        schedule(note, createMsBefore = 1500, id = 0) {
            // note is KeyboardNote

            // console.log(note, id);
            if (note.end < exports.Context.currentTime) { // if note is old news, ignore it
                // console.log("Ignored ", note, id, audio.Context.currentTime);
                return null;

            }

            if (!createMsBefore)
                createMsBefore = 5000;

            let note_id = id ? id : getID();

            if (note.start > exports.Context.currentTime + 2 * createMsBefore / 1e3) {
                // console.log("Make timeout: ", note.pitch.name(), note_id, note);

                let timeout =
                    new CancellableTimeout(() => {
                        // console.log("Calling timeout: ", note.pitch.name(), note_id, note);
                        this.schedule(note, createMsBefore, note_id);
                    },
                    note.start - createMsBefore / 1e3, true);

                timeout.id = note_id;

                this._addInternalTimeout(timeout);

                return {
                    cancel: () => {
                        this.terminateNote(note_id);
                    },
                    id: note_id
                }
            }


            // console.log("Scheduling: ", note.pitch.name(), note.start, audio.Context.currentTime, note_id);
            let frequency = this.pitch_mapping.transform(note.pitch);

            let note_state = this.getNoteState(note.pitch.value);
            let audio_node = this.createNode(frequency, Math.max(note.start, exports.Context.currentTime), note.end, note.vel, note.pan);

            audio_node.id = note_id;

            let node = {
                node: audio_node,
                start: note.start,
                end: note.end,
                id: note_id
            };

            note_state.future_nodes.push(node);

            let setActiveTimeout = new CancellableTimeout(() => {
                this.setActiveNodeFromFuture(note.pitch.value, node);
            }, note.start, true);

            setActiveTimeout.id = note_id;

            this._addInternalTimeout(setActiveTimeout);

            audio_node.connect(this.entryNode);

            return {
                cancel: () => {
                    this.terminateSource(note_id);
                },
                id: note_id
            };
        }

        terminateTimeout(id) {
            for (let i = 0; i < this.internal_timeouts.length; i++) {
                let timeout = this.internal_timeouts[i];

                if (timeout.id === id) {
                    timeout.cancel();
                    this.internal_timeouts.splice(i--, 0);
                }
            }
        }

        terminateSource(id) {
            for (let i = 0; i < 128; i++) {
                let state = this.getNoteState(i);

                for (let j = 0; j < state.future_nodes.length; j++) {
                    let note = state.future_nodes[j];

                    if (note.id === id) {
                        note.destroy();
                        state.future_nodes.splice(j--, 0);
                    }
                }
            }
        }

        terminateNote(id) {
            this.terminateTimeout(id);
            this.terminateSource(id);
        }

        playPitch(pitch, vel = 1, pan = 0) {
            let node = this.createNode(
                this.pitch_mapping.transform(pitch),
                exports.Context.currentTime,
                Infinity,
                vel, pan);

            let note_id = getID();
            node.id = note_id;

            node.connect(this.entryNode);

            this.setLongActiveNode(pitch.value, node);

            return {
                cancel: () => {
                    this.terminateNote(note_id);
                },
                id: note_id
            };
        }

        releasePitch(pitch) {
            let note = this.getActiveNote(pitch.value);
            if (note) {
                note.node.release();
                note.end = -1;
            }
        }

        cancelAll() {
            for (let i = 0; i < this.internal_timeouts.length; i++) {
                this.internal_timeouts[i].cancel();
            }

            for (let i = 0; i < this.note_states.length; i++) {
                let state = this.note_states[i];

                if (state.active_note)
                    state.active_note.node.destroy();
                state.active_note = null;

                for (let j = 0; j < state.future_nodes.length; j++)
                    state.future_nodes[j].node.destroy();

                state.future_nodes = [];
            }
        }

        releaseAll() {
            for (let i = 0; i < 128; i++) {
                try {
                    this.releasePitch(i);
                } catch (e) {}
            }
        }

        createNode(pitch, start, end, vel, pan) {
            let osc = exports.Context.createOscillator();

            osc.frequency.value = pitch;
            osc.start(start);
            osc.stop(end);

            return {
                node: osc
            };
        }

        iterateOverNodes(func) {
            for (let i = 0; i < this.note_states.length; i++) {
                let state = this.note_states[i];

                if (state.active_note)
                    func(state.active_note);
                for (let j = 0; j < state.future_nodes.length; j++) {
                    func(state.future_nodes[j]);
                }
            }
        }

        setPitchMapping(mapping) {
            this.pitch_mapping = (mapping instanceof PitchMapping) ? mapping : new PitchMapping(mapping);
        }

        destroy() {
            this.cancelAll();
            clearInterval(this._timeout_interval);
            clearInterval(this._active_note_remover);
            this.enableKeyboardPlay = false;
        }
    }

    /*
    PitchedInstrument allowing mapping and playing between the keyboard and the instrument
    */
    class KeyboardInstrument extends PitchedInstrument {
        constructor(parameters = {}) {
            super(parameters);

            this.keyboard = {};
            for (let i = 0; i < 128; i++) { // states of notes 0-127
                this.keyboard[i] = false;
            }

            // Play a note using keyboard mapping
            this.keyboard_mapping = new KeyboardMapping(parameters.keyboard_dict || getDefaultKeyboardDict(),
                (note, pressing) => { // activate notes from keyboard
                    if (!note) return;
                    if (pressing) {
                        this.play(note);
                    } else {
                        this.release(note);
                    }
                });
        }

        play(note) {
            note = new KeyboardPitch(note);
            if (!this.keyboard[note.value]) { // if the key isn't already pressed (this would happen when holding the key down)
                this.keyboard[note.value] = true;
                this.playPitch(note);
            }
        }

        release(note) {
            note = new KeyboardPitch(note);
            if (this.keyboard[note.value]) { // if the key is still pressed
                this.keyboard[note.value] = false;
                this.releasePitch(note);
            }
        }

        get keyboardPlayEnabled() { // is keyboard interaction enabled
            return this.keyboard_mapping.enabled;
        }

        set keyboardPlayEnabled(boolean) { // enable/disable keyboard playing
            if (boolean) {
                enableKeyboardPlay();
            } else {
                disableKeyboardPlay();
            }
        }

        enableKeyboardPlay() { // enable keyboard playing
            this.keyboard_mapping.enable();
        }

        disableKeyboardPlay() { // disable keyboard playing
            this.keyboard_mapping.disable();
            this.releaseAll();
        }
    }

    const MAX_DETUNE_CENTS = 200;
    const MIN_FREQUENCY = -22050;
    const MAX_FREQUENCY = 22050;
    const MIN_BLEND = 0;
    const MAX_BLEND = 1;
    const MAX_UNISON = 16;

    function blendMapping(x) {
        if (x === 0) {
            return 0;
        } else if (0 < x && x <= 1) {
            return x - 1;
        } else {
            return x + 1;
        }
    }

    class UnisonOscillator extends SourceNode {
        constructor(parameters = {}) {
            super(parameters.context);

            this._frequency = clamp(parameters.frequency || 440, MIN_FREQUENCY, MAX_FREQUENCY, "frequency"); // frequency of average oscillation
            this._detune = clamp((parameters.detune === 0) ? 0 : (parameters.detune || 20), 0, MAX_DETUNE_CENTS, "detune"); // spread width of oscillators (symmetric)
            this._unison_obj = {value : clamp((parameters.unison || 4), 2, MAX_UNISON)}; // Number of oscillators

            Object.freeze(this._unison_obj);
            this._blend = clamp((parameters.blend === 0) ? 0 : (parameters.blend || 0.5), MIN_BLEND, MAX_BLEND, "blend"); // ratio (gain of centermost oscillators) / (gain of peripheral oscillators)
            this._type = parameters.type || "triangle"; // type of waveform

            this._context = exports.Context;
            this.oscillators = [];

            let unison = this.unison;

            if (unison % 2 === 0) {
                let centerBlend = this._blend;
                let peripheralBlend = 1 - this._blend;
                let loudness = 2 * centerBlend + (unison - 2) * peripheralBlend;

                this.exit.gain.value = 1 / loudness;

                for (let i = 0; i < unison; i++) {
                    let series = {d: (i - unison / 2 + 1 / 2) / (unison - 1),
                        o: exports.Context.createOscillator(),
                        g: exports.Context.createGain(),
                        delay: exports.Context.createDelay(),
                        pan: exports.Context.createStereoPanner()
                    };

                    series.o.frequency.setValueAtTime(this._frequency, 0);
                    series.o.detune.setValueAtTime(series.d * this._detune, 0);
                    series.o.type = this._type;
                    series.delay.delayTime.setValueAtTime(1 / this._frequency * Math.random(), 0);

                    if (unison === 2) {
                        series.pan.pan.setValueAtTime(series.d * 2, 0);
                    } else {
                        series.pan.pan.setValueAtTime(blendMapping(series.d * 2), 0);
                    }

                    if (i === unison / 2 - 1 || i === unison / 2 || unison === 2) {
                        series.g.gain.setValueAtTime(centerBlend, 0);
                    } else {
                        series.g.gain.setValueAtTime(peripheralBlend, 0);
                    }

                    chainNodes([
                        series.o,
                        series.delay,
                        series.g,
                        series.pan,
                        this.exit
                    ]);

                    this.oscillators.push(series);
                }
            } else {
                let centerBlend = this._blend;
                let peripheralBlend = 1 - this._blend;
                let loudness = centerBlend + (unison - 1) * peripheralBlend;

                this.exit.gain.value = 1 / loudness;

                for (let i = 0; i < unison; i++) {
                    let series = {d: (i - unison / 2 + 1 / 2) / (unison - 1),
                        o: exports.Context.createOscillator(),
                        g: exports.Context.createGain(),
                        delay: exports.Context.createDelay(),
                        pan: exports.Context.createStereoPanner()
                    };

                    series.o.frequency.setValueAtTime(this._frequency, 0);
                    series.o.detune.setValueAtTime(series.d * this._detune, 0);
                    series.o.type = this._type;
                    series.delay.delayTime.setValueAtTime(1 / this._frequency * Math.random(), 0);

                    if (unison === 3) {
                        series.pan.pan.setValueAtTime(series.d * 2, 0);
                    } else {
                        series.pan.pan.setValueAtTime(blendMapping(series.d * 2), 0);
                    }

                    if (i === (unison - 1) / 2) {
                        series.g.gain.setValueAtTime(centerBlend, 0);
                    } else {
                        series.g.gain.setValueAtTime(peripheralBlend, 0);
                    }

                    chainNodes([
                        series.o,
                        //series.delay,
                        series.g,
                        series.pan,
                        this.exit
                    ]);

                    this.oscillators.push(series);
                }
            }

            this.channelCount = 2;
            this.channelCountMode = "max";
            this.channelInterpretation = "speakers";

            let that = this;

            this.frequency = {
                setValueAtTime: (value, time$$1) => {
                    value = clamp(value, MIN_FREQUENCY, MAX_FREQUENCY, "frequency");
                    for (let i = 0; i < this.unison; i++) {
                        this.oscillators[i].o.frequency.setValueAtTime(value, time$$1);
                    }
                },
                linearRampToValueAtTime: (value, time$$1) => {
                    value = clamp(value, MIN_FREQUENCY, MAX_FREQUENCY, "frequency");
                    for (let i = 0; i < this.unison; i++) {
                        this.oscillators[i].o.frequency.linearRampToValueAtTime(value, time$$1);
                    }
                },
                exponentialRampToValueAtTime: (value, time$$1) => {
                    value = clamp(value, MIN_FREQUENCY, MAX_FREQUENCY, "frequency");
                    for (let i = 0; i < this.unison; i++) {
                        this.oscillators[i].o.frequency.exponentialRampToValueAtTime(value, time$$1);
                    }
                },
                setTargetAtTime: (value, startTime, constantTime) => {
                    value = clamp(value, MIN_FREQUENCY, MAX_FREQUENCY, "frequency");
                    for (let i = 0; i < this.unison; i++) {
                        this.oscillators[i].o.frequency.setTargetAtTime(value, startTime, constantTime);
                    }
                },
                setValueCurveAtTime: (table, startTime, endTime) => {
                    for (let i = 0; i < table.length; i++) {
                        table[i] = clamp(table[i], MIN_FREQUENCY, MAX_FREQUENCY, "frequency");
                    }
                    for (let i = 0; i < this.unison; i++) {
                        this.oscillators[i].o.frequency.setValueCurveAtTime(table, startTime, endTime);
                    }
                },
                cancelScheduledValues: () => {
                    for (let i = 0; i < this.unison; i++) {
                        this.oscillators[i].o.frequency.cancelScheduledValues();
                    }
                },
                get value() {
                    return that.oscillators[0].o.frequency.value;
                },
                set value(value) {
                    value = clamp(value, MIN_FREQUENCY, MAX_FREQUENCY, "frequency");
                    for (let i = 0; i < that.unison; i++) {
                        that.oscillators[i].o.frequency.value = value;
                    }
                }
            };

            Object.defineProperties(this.frequency, {
                minValue: {
                    value: MIN_FREQUENCY,
                    writable: false
                },
                maxValue: {
                    value: MAX_FREQUENCY,
                    writable: false
                },
                defaultValue: {
                    value: 440,
                    writable: false
                }
            });

            this.detune = {
                setValueAtTime: (value, time$$1) => {
                    value = clamp(value, 0, that.detune.maxValue, "detune");

                    for (let i = 0; i < this.unison; i++) {
                        let series = this.oscillators[i];
                        series.o.detune.setValueAtTime(series.d * value, time$$1);
                    }
                },
                linearRampToValueAtTime: (value, time$$1) => {
                    value = clamp(value, 0, that.detune.maxValue, "detune");

                    for (let i = 0; i < this.unison; i++) {
                        let series = this.oscillators[i];
                        series.o.detune.linearRampToValueAtTime(series.d * value, time$$1);
                    }
                },
                exponentialRampToValueAtTime: (value, time$$1) => {
                    value = clamp(value, 0, that.detune.maxValue, "detune");

                    for (let i = 0; i < this.unison; i++) {
                        let series = this.oscillators[i];
                        series.o.detune.exponentialRampToValueAtTime(series.d * value, time$$1);
                    }
                },
                setTargetAtTime: (value, startTime, constantTime) => {
                    value = clamp(value, 0, that.detune.maxValue, "detune");

                    for (let i = 0; i < this.unison; i++) {
                        let series = this.oscillators[i];
                        series.o.detune.setTargetAtTime(series.d * value, startTime, constantTime);
                    }
                },
                setValueCurveAtTime: (table, startTime, endTime) => {
                    for (let i = 0; i < table.length; i++) {
                        table[i] = clamp(table[i], 0, that.detune.maxValue, "detune");
                    }
                    for (let i = 0; i < this.unison; i++) {
                        let series = this.oscillators[i];
                        let newTable = table.slice();

                        for (let j = 0; j < newTable.length; j++) {
                            newTable[j] = series.d * newTable[j];
                        }

                        series.o.detune.setValueCurveAtTime(newTable, startTime, endTime);
                    }
                },
                cancelScheduledValues: () => {
                    for (let i = 0; i < this.unison; i++) {
                        this.oscillators[i].o.detune.cancelScheduledValues();
                    }
                },
                get value() {
                    return that.oscillators[0].o.detune.value / that.oscillators[0].d;
                },
                set value(value) {
                    value = clamp(value, 0, that.detune.maxValue, "detune");

                    for (let i = 0; i < that.unison; i++) {
                        let series = that.oscillators[i];
                        series.o.detune.value = series.d * value;
                    }
                }
            };

            Object.defineProperties(this.detune, {
                minValue: {
                    value: 0,
                    writable: false
                },
                maxValue: {
                    value: MAX_DETUNE_CENTS,
                    writable: false
                },
                defaultValue: {
                    value: 50,
                    writable: false
                }
            });

            // TODO: Allow blend enveloping and such, not trivial, might not actually do it
            this.blend = {
                get value() {
                    if (that.unison % 2 === 0) {
                        return that.oscillators[that.unison / 2].g.gain.value;
                    } else {
                        return that.oscillators[(that.unison - 1) / 2].g.gain.value;
                    }
                },
                set value(value) {
                    value = clamp(value, MIN_BLEND, MAX_BLEND, "blend");
                    if (that.unison % 2 === 0) {
                        let centerBlend = value;
                        let peripheralBlend = 1 - value;
                        let loudness = 2 * centerBlend + (unison - 2) * peripheralBlend;

                        that.exit.gain.value = 1 / loudness;

                        for (let i = 0; i < that.unison; i++) {
                            let series = that.oscillators[i];

                             if (i === unison / 2 - 1 || i === unison / 2 || unison === 2) {
                                series.g.gain.value = centerBlend;
                            } else {
                                series.g.gain.value = peripheralBlend;
                            }
                        }
                    } else {
                        let centerBlend = value;
                        let peripheralBlend = 1 - value;
                        let loudness = centerBlend + (unison - 1) * peripheralBlend;

                        that.exit.gain.value = 1 / loudness;

                        for (let i = 0; i < that.unison; i++) {
                            let series = that.oscillators[i];

                            if (i === (unison - 1) / 2) {
                                series.g.gain.setValueAtTime(centerBlend, 0);
                            } else {
                                series.g.gain.setValueAtTime(peripheralBlend, 0);
                            }
                        }
                    }
                }
            };

            Object.defineProperties(this.blend, {
                minValue: {
                    value: MIN_BLEND,
                    writable: false
                },
                maxValue: {
                    value: MAX_BLEND,
                    writable: false
                },
                defaultValue: {
                    value: 0.5,
                    writable: false
                }
            });

            delete this._frequency;
            delete this._detune;
            delete this._blend;
        }

        get unison() {
            return this._unison_obj.value;
        }

        get type() {
            return this._type;
        }

        set type(value) {
            this._type = value;
            for (let i = 0; i < this.unison; i++) {
                this.oscillators[i].o.type = value;
            }
        }

        static get numberOfInputs() {
            return 0;
        }

        static get numberOfOutputs() {
            return 1;
        }

        static get context() {
            return this._context;
        }

        start(time$$1 = this._context.currentTime) {
            for (let i = 0; i < this.oscillators.length; i++) {
                let series = this.oscillators[i];

                series.o.start(time$$1);
            }
        }

        stop(time$$1 = this._context.currentTime) {
            //console.log(this.oscillators);

            for (let i = 0; i < this.oscillators.length; i++) {
                let series = this.oscillators[i];

                series.o.stop(time$$1);
            }
        }
    }

    let a$1 = new LinearEnvelopeSegment([0, 0], [0.01, 1]);
    let b = new LinearEnvelopeSegment(a$1.p2, [1, 0.2], 0.4);

    const DefaultAttackEnvelope = new Envelope([a$1, b]);

    class SimpleInstrumentNode extends SourceNode {
        constructor(parent, frequency, start, end, velocity, panValue) {
            super(parent);

            if (parent.params.unison === 1) {
                var tone = exports.Context.createOscillator();
            } else {
                var tone = new UnisonOscillator(parent.params);
            }

            let gain = exports.Context.createGain();
            let vel = exports.Context.createGain();
            let pan = exports.Context.createStereoPanner();

            chainNodes([
                tone,
                gain,
                vel,
                pan,
                parent._getEntry()
            ]);

            tone.type = parent.waveform;

            tone.frequency.setValueAtTime(frequency, 0);
            gain.gain.setValueAtTime(0, 0);
            vel.gain.setValueAtTime(velocity, 0);
            pan.pan.setValueAtTime(panValue, 0);

            tone.start(start);

            parent.params.attack_envelope.apply(gain.gain,
                EnvelopeHorizontal.absoluteOffset(start));

            // Make a release envelope and then apply it to tone_gain.gain
            if (end !== Infinity) {
                gain.gain.cancelScheduledValues(end);

                parent.createReleaseEnvelope(
                    parent.params.attack_envelope.valueAt(end - start)
                ).apply(gain.gain,
                    EnvelopeHorizontal.absoluteOffset(end));
            }

            this.node = tone;
            this.gain = gain;
            this.pan = pan;
            this.vel = vel;
            this.start = start;
            this.end = end;
            this.parent = parent;

            if (end !== Infinity) {
                window.setTimeout(() => { // Note that precision isn't necessary here, so we'll use setTimeout
                    this.destroy();
                }, (end - exports.Context.currentTime + parent.params.release_length) * 1000);
            }
        }

        release() {
            /*
            When releasing the note, cancel all future values of gain and then apply the release envelope.
            After some time, destroy the note.
            */

            let currTime = exports.Context.currentTime;
            if (currTime > this.end)
                return;

            let K = this.gain;

            K.gain.cancelScheduledValues(0);
            this.parent.createReleaseEnvelope(
                K.gain.value
            ).apply(this.gain.gain,
                EnvelopeHorizontal.absoluteOffset(currTime));

            window.setTimeout(() => { // Note that precision isn't necessary here, so we'll use setTimeout
                this.destroy();
            }, this.parent.params.release_length * 1000);
        }

        _disconnect() {
            this.node.stop();
        }

        _destroy() {
            this.node.stop();
        }
    }

    class SimpleInstrument extends KeyboardInstrument {
        constructor(parameters = {}) {
            super(parameters);

            this.params = {};

            this.params.unison = parameters.unison || 8; // Unison (integer >= 1)
            this.params.detune = (parameters.detune === 0) ? 0 : (parameters.detune || 20); // Spread of detune (cents)
            this.params.blend = (parameters.blend === 0) ? 0 : (parameters.blend || 0.6); // Blend between central and peripheral oscillators
            this.params.release_length = (parameters.release_length === 0) ? 0 : (parameters.release_length || 0.1); // Decay (sec)
            this.params.attack_envelope = (parameters.attack_envelope || DefaultAttackEnvelope);
            this.params.waveform = parameters.waveform || "square";

            this.entries = [];

            for (let i = 0; i < 4; i++) {
                let entry = exports.Context.createGain();
                entry.connect(this.entryNode);

                this.entries.push(entry);
            }

            this.createReleaseEnvelope = (gain_value) => {
                return new Envelope([new LinearEnvelopeSegment([0, gain_value], [this.params.release_length, 0])]);
            };
        }

        _getEntry() {
            return this.entries[~~(Math.random() * this.entries.length)];
        }

        createNode(frequency, start, end, vel, pan) {
            return new SimpleInstrumentNode(this, ...arguments);
        }

        oscillatorApply(func) {
            this.iterateOverNodes(x => func(x.node.node));
        }

        set detune(value) {
            this.params.detune = value;
            if (this.params.unison !== 1) {
                this.oscillatorApply(function (x) {
                    x.detune.value = value;
                });
            }
        }

        get detune() {
            return this.params.detune;
        }

        set blend(value) {
            this.params.blend = value;
            if (this.params.unison !== 1) {
                this.oscillatorApply(function (x) {
                    x.blend.value = value;
                });
            }
        }

        get blend() {
            return this.params.blend;
        }

        set waveform(value) {
            this.params.waveform = value;
                this.oscillatorApply(function (x) {
                    x.type = value;
                });
        }

        get waveform() {
            return this.params.waveform;
        }
    }

    /*
    parse scala expression to value
    */
    function parseSclExpression(line) {
        line = line.trim().replace(/\s/g, ''); // remove whitespace

        for (let i = line.length; i > 0; i--) { // tries parsing starting at end
            let cut_line = line.slice(0, i);

            if (cut_line.includes(".")) { // period means value is in cents
                let value = parseFloat(cut_line);

                if (!isNaN(value)) {
                    return new Interval({cents: value});
                }
            } else if (cut_line.includes("/")) { // vinculum means value is a ratio
                let fraction = cut_line.split("/");

                if (fraction.length === 2) {
                    // make sure there's a numerator and denominator (when slicing right to left it might temporarily not be the case)
                    let num = parseInt(fraction[0]), din = parseInt(fraction[1]);

                    if (!isNaN(num) && !isNaN(din) && num > 0 && din > 0) {
                        return new Interval(num / din);
                    }
                }
            } else { // Value is an integer
                let value = parseInt(cut_line);

                if (!isNaN(value)) {
                    return new Interval(value);
                }
            }
        }
        
        // if it gets here it's invalid

        throw new Error(`parseSclExpression: Invalid expression ${line}`);
    }

    // get scale from scl file content
    function sclFileToScale(file_content) {
        return parseSclFile(file_content).scale;
    }

    // parse an scl file to a description and intervals
    function parseSclFile(file_content) {
        let file_lines = file_content.split('\n');
        let description = null;
        let note_count = null;
        let notes_in = 0;

        let notes = [];

        for (let i = 0; i < file_lines.length; i++) {
            if (file_lines[i][0] === "!") { // comment
                continue;
            }

            if (description === null) {
                description = file_lines[i];
            } else if (note_count === null) {
                try {
                    note_count = parseInt(file_lines[i]); // second line is scale length
                } catch (e) {
                    throw new Error("sclFileToScale: second non-comment line of file should be number of notes in scale");
                }
            } else {
                if (note_count !== null) { // if note count is read, the expression parsing can begin
                    notes.push(parseSclExpression(file_lines[i]));
                    notes_in += 1;

                    if (notes_in >= note_count) { // parse until note count (though this shouldnt happen)
                        break;
                    }
                }
            }
        }


        if (notes.length !== note_count) {
            throw new Error("sclFileToScale: scale size and given scale do not match in size");
        }

        return {desc: description, scale: notes};
    }

    // convert scl file, base keyboardnote, and base keyboard frequency
    function sclFileToPitchMapping(file_content, baseNote = KeyboardPitches.C4, baseFrequency) {
        baseFrequency = baseFrequency || new Pitch(baseNote.twelveTETFrequency());

        return pitchMappingFromScale(sclFileToScale(file_content), baseNote, baseFrequency);
    }

    /*
    Class combining scl reading logic and an actual file reader

    domElement -> input element in DOM
    allowMultiple -> let multiple scl files
    requireExtension -> require scl extension
    onerror -> function if file reading fails
    */
    class ScalaReader { // TODO include scala parsing in reader
        constructor(passScalaFile, params = {}) {
            let that = this;

            params.domElement = params.domElement || null;
            params.allowMultiple = (params.allowMultiple === undefined) ? true : params.allowMultiple;
            params.requireExtension = (params.requireExtension === undefined) ? true : params.requireExtension;
            params.onerror = params.onerror || console.error;

            this.params = params;

            this.passScalaFile = passScalaFile; // arguments of function: arg1 -> content, arg2 -> name of file

            this.onchange = function() { // function when reading in file
                let files = this.files;

                if (!that.params.allowMultiple && files.length > 1) {
                    that.params.onerror(new Error("Only one file allowed."));
                }

                for (let i = 0; i < files.length; i++) {
                    let file = files[i];

                    if (!file) {
                        that.params.onerror(new Error("No file selected."));
                    }

                    if (that.params.requireExtension && !file.name.endsWith(".scl")) {
                        that.params.onerror(new Error("Invalid file extension."));
                    }

                    let reader = new FileReader();

                    reader.addEventListener("loadend", () => {
                        try {
                            that.passScalaFile(parseSclFile(reader.result), file.name);
                        } catch (e) {
                            that.params.onerror(e);
                        }
                    });

                    reader.readAsText(file);
                }
            };

            if (params.domElement) {
                this.addTo(params.domElement); // add listener to given domElement
            }
        }

        addTo(domElement) {
            if (!this.domElement) {
                domElement.addEventListener("change", this.onchange);
                this.domElement = domElement;
            }
        }

        remove() { // remove from domElement
            this.domElement.removeEventListener("change", this.onchange);
        }
    }

    // A scale is just an array of intervals, starting on the first pitch above the unison and ending with the repeating note, usually the octave

    const Scales = {
        ET12: [
            {cents: 100},
            {cents: 200},
            {cents: 300},
            {cents: 400},
            {cents: 500},
            {cents: 600},
            {cents: 700},
            {cents: 800},
            {cents: 900},
            {cents: 1000},
            {cents: 1100},
            2/1,
        ]
    };

    for (let scaleKey in Scales) {
        let scale = Scales[scaleKey];

        for (let i = 0; i < scale.length; i++) {
            scale[i] = new Interval(scale[i]);
        }
    }

    /*
    KeyboardNote represents a note to be played, containing a KeyboardPitch,
    start time (seconds against audio context time), duration (seconds), pan (-1 left to 1 right), and vel (0 silent to 1 loud)
     */
    class KeyboardNote {
        /*
        Takes parameters:
        pitch, sent to KeyboardPitch constructor;
        start, time that note starts;
        end, time that note ends;          | Interchangeable
        duration, time that note lasts;    |
        pan, pan of note;
        vel, velocity of note;
         */

        constructor(params = {}) {
            if (params instanceof KeyboardNote) {
                this.params = params.params;
                return;
            }

            this.pitch = (params.pitch !== undefined) ? params.pitch : KeyboardPitches.A4;
            this.start = (params.start === undefined) ? 0 : params.start;

            if (params.end) {
                this.duration = params.end - this.start;
            } else {
                this.duration = (params.duration === undefined) ? 1 : params.duration;
            }

            this.pan = (params.pan === undefined) ? 0 : params.pan;
            this.vel = (params.vel === undefined) ? 1 : params.vel;

            if (this.start < 0) {
                throw new Error("Invalid start time")
            }

            if (this.duration <= 0) {
                throw new Error("Invalid duration")
            }
        }

        get end() {
            return this.start + this.duration;
        }

        set end(value) {
            if (value <= this.start) {
                throw new Error("Invalid end time")
            }
            this.duration = value - this.start;
        }

        translate(x) {
            return new KeyboardNote({
                pitch: this.pitch,
                start: this.start + x,
                duration: this.duration,
                pan: this.pan,
                vel: this.vel
            });
        }
    }

    /*
    Base filter class
    */
    class Filter extends Node {
        constructor() {
            super();
        }
    }

    let BLOCK_SIZE = 1024;

    function fillImpulseValues(leftChannel, rightChannel, length, decay, minX, maxX) {
        for (let i = minX; i < maxX; i++) {
            leftChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            rightChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }

    let BUILDERS = {};

    /*
    Create convolver impulse for convolver node
    */
    function generateConvolverImpulse(length, decay, callback) {
        let id = getID();

        BUILDERS[id] = {left: new Float32Array(length), right: new Float32Array(length)};

        function buildSection(minX, maxX) {
            let builder = BUILDERS[id];
            let leftChannel = builder.left;
            let rightChannel = builder.right;

            fillImpulseValues(leftChannel, rightChannel, length, decay, minX, maxX);

            if (maxX === length) {
                let buffer = exports.Context.createBuffer(2, length, exports.Context.sampleRate);

                buffer.getChannelData(0).set(leftChannel);
                buffer.getChannelData(1).set(rightChannel);

                delete BUILDERS[id];
                callback(buffer);
                return;
            }

            setTimeout(() => {
                buildSection(maxX, Math.min(maxX + BLOCK_SIZE, length));
            }, 1);
        }

        buildSection(0, BLOCK_SIZE);
    }

    /*
    Reverb filter

    dry -> dry value
    wet -> wet value

    wet_filter -> filter to apply to wet side
    length -> size of convolver impulse
    decay -> decay rate of impulse
    */
    class Reverb extends Filter {
        constructor(params = {}) {
            super();

            this.dry_node = exports.Context.createGain();
            this.wet_node = exports.Context.createGain();
            this.convolver_node = exports.Context.createConvolver();

            this.entry.connect(this.dry_node);
            this.entry.connect(this.wet_node);
            this.dry_node.connect(this.exit);
            this.wet_node.connect(this.convolver_node);

            if (params.wet_filter) {
                this.convolver_node.connect(params.wet_filter);
                params.wet_filter.connect(this.exit);
            } else {
                this.convolver_node.connect(this.exit);
            }

            this.dry_node.gain.value = (params.dry !== undefined) ? params.dry : 0.5;
            this.wet_node.gain.value = (params.wet !== undefined) ? params.wet : 0.5;

            this._length = params.length || 1e5;
            this._decay = params.decay || 2.5;

            this.setImpulse();
        }

        setImpulse() { // set convolver node impulse
            generateConvolverImpulse(this._length, this._decay, (buffer) => {
                this.convolver_node.buffer = buffer;
            });
        }

        get wet() {
            return this.wet_node.gain;
        }

        get dry() {
            return this.dry_node.gain;
        }

        get length() {
            return this._length;
        }

        get decay() {
            return this._decay;
        }

        set length(value) {
            this._length = value;
            this.setImpulse();
        }

        set decay(value) {
            this._decay = value;
            this.setImpulse();
        }
    }

    /*
    delay filter

    delay: length of delay,
    loss: loss at each delay iteration
    */
    class Delay extends Filter {
        constructor(params = {}) {
            super();

            this.delay_node = exports.Context.createDelay();
            this.loss_node = exports.Context.createGain();

            chainNodes([
                this.entry,
                this.loss_node,
                this.delay_node,
                this.exit
            ]);

            this.delay_node.connect(this.loss_node); // forms feedback loop

            this.entry.connect(this.exit);

            this.delay_node.delayTime.value = params.delay || 0.5;
            this.loss_node.gain.value = params.loss || 0.3;
        }

        get delay() {
            return this.delay_node.delayTime;
        }

        get loss() {
            return this.loss_node.gain;
        }
    }

    /*
    Wrapper around biquad filter
    */
    class BiquadWrapper extends Filter {
        constructor(params = {}, type) {
            super();

            let biquad_filter = exports.Context.createBiquadFilter();

            biquad_filter.type = type;
            biquad_filter.gain.value = (params.gain !== undefined) ? params.gain : 2;
            biquad_filter.frequency.value = (params.frequency !== undefined) ? params.frequency : 1000;
            biquad_filter.Q.value = (params.Q !== undefined) ? params.Q : 1;

            this.entry.connect(biquad_filter);
            biquad_filter.connect(this.exit);

            this.biquad_filter = biquad_filter;
        }

        get frequency() {
            return this.biquad_filter.frequency;
        }

        get Q() {
            return this.biquad_filter.Q;
        }

        get gain() {
            return this.biquad_filter.gain;
        }

        getResponse(arr) { // Return the scaling value for each frequency
            if (!(arr instanceof Float32Array)) {
                if (isNumeric(arr))
                    arr = new Float32Array([arr]);
                else
                    arr = new Float32Array(arr);
            }

            let magnitude_response = new Float32Array(arr.length);
            let phase_response = new Float32Array(arr.length);

            this.biquad_filter.getFrequencyResponse(arr, magnitude_response, phase_response);

            return {
                mag: magnitude_response,
                phase: phase_response
            };
        }

        getMagnitudeResponse(arr) {
            return this.getResponse(arr).mag;
        }

        getPhaseResponse(arr) {
            return this.getResponse(arr).phase;
        }
    }

    /* lowpass filter */
    class LowpassFilter extends BiquadWrapper {
        constructor(params = {}) {
            super(params, "lowpass");
        }
    }

    /* highpass filter */
    class HighpassFilter extends BiquadWrapper {
        constructor(params = {}) {
            super(params, "highpass");
        }
    }

    /* peaking filter */
    class FrequencyBumpFilter extends BiquadWrapper {
        constructor(params = {}) {
            super(params, "peaking");
        }
    }

    /* bandpass filter */
    class BandpassFilter extends BiquadWrapper {
        constructor(params = {}) {
            super(params, "bandpass");
        }
    }

    /* notch filter */
    class NotchFilter extends BiquadWrapper {
        constructor(params = {}) {
            super(params, "notch");
        }
    }

    class LowshelfFilter extends BiquadWrapper {
        constructor(params = {}) {
            super(params, "lowshelf");
        }
    }

    class HighshelfFilter extends BiquadWrapper {
        constructor(params = {}) {
            super(params, "highshelf");
        }
    }

    let MIN_FREQ = 50;
    let MAX_FREQ = 8000;
    const MIN_FREQ_LOG2 = Math.log2(MIN_FREQ);
    const MAX_FREQ_LOG2 = Math.log2(MAX_FREQ);
    const FREQ_DIFF = MAX_FREQ_LOG2 - MIN_FREQ_LOG2;

    function expScaleFreq(x) {
        return Math.pow(2, MIN_FREQ_LOG2 + FREQ_DIFF * x);
    }

    let DEFAULT_BAND_WIDTH = 0.2; // Octaves
    let DEFAULT_BAND_Q = bandWidthToQ(DEFAULT_BAND_WIDTH);

    function bandWidthToQ(bandwidth) { // bandwidth is in octaves
        return Math.sqrt(2 * bandwidth) / (Math.pow(2, bandwidth) - 1);
    }

    /* Parametric EQ with n knobs */
    class ParametricEQ extends Filter {
        constructor(size = 6) {
            super();

            if (size < 2 || size > 12) {
                throw new Error(`Size ${size} is not in allowed range [2, 11]`);
            }

            this.F0 = new LowshelfFilter();

            this.F0.frequency.value = MIN_FREQ;

            let last_filter = new HighshelfFilter();
            this['F' + String(size - 1)] = last_filter;

            last_filter.frequency.value = MAX_FREQ;

            this.size = size;

            for (let i = 1; i < size - 1; i++) {
                let filter = new FrequencyBumpFilter();
                filter.frequency.value = expScaleFreq(i / (size - 1));
                this['F' + String(i)] = filter;

                filter.Q.value = DEFAULT_BAND_Q;//Math.log2(filter.frequency.value);
            }

            for (let i = 0; i < size - 1; i++) {
                this.getFilter(i).connect(this.getFilter(i + 1));
            }

            this.entry.connect(this.F0.entry);
            last_filter.connect(this.exit);
        }

        getFilter(i) {
            if (i < 0 || i >= this.size)
                throw new Error(`${i} out of range [0, ${this.size - 1}]`);
            return this['F' + String(i)];
        }

        filterApply(func) {
            for (let i = 0; i < this.size; i++) {
                let filter = this.getFilter(i);

                func(filter);
            }
        }

        getResponse(arr) { // Return the scaling value for each frequency
            if (!(arr instanceof Float32Array)) {
                if (isNumeric(arr))
                    arr = new Float32Array([arr]);
                else
                    arr = new Float32Array(arr);
            }

            let magnitude_response = new Float32Array(arr.length);
            magnitude_response.fill(1);
            let phase_response = new Float32Array(arr.length);

            this.filterApply((filter) => {
                let resp = filter.getResponse(arr);

                for (let i = 0; i < arr.length; i++) {
                    magnitude_response[i] *= resp.mag[i];
                    phase_response[i] += resp.phase[i];
                }
            });

            return {
                mag: magnitude_response,
                phase: phase_response
            };
        }

        getMagnitudeResponse(arr) {
            return this.getResponse(arr).mag;
        }

        getPhaseResponse(arr) {
            return this.getResponse(arr).phase;
        }
    }

    /*
    This class wraps the Web Audio API's analyzer node
     */
    class SimpleFFT extends EndingNode {
        /*
        Parameters:

        fftSize = size of the fft,
        sTC = smoothing time constant of the fft
         */
        constructor(params = {}) {
            super();

            this.analyzer = exports.Context.createAnalyser();

            this.entry.connect(this.analyzer);

            this.analyzer.fftSize = params.fftSize || 16384;
            this.analyzer.smoothingTimeConstant = params.sTC || 0.3;

            this.bufferLength = this.analyzer.frequencyBinCount;
            this.buffer = new Uint8Array(this.bufferLength);
        }

        /*
        Copy the frequency data, as bins from [0, ..., nyquist] in decibels, to Float32Array buffer
         */
        getFloatFrequencyData(buffer) {
            this.analyzer.getFloatFrequencyData(buffer);
        }

        /*
        Copy the frequency data, as bins from [0, ..., nyquist] in decibels scaled to [0, ..., 255], to Uint8Array buffer
         */
        getByteFrequencyData(buffer) {
            this.analyzer.getByteFrequencyData(buffer);
        }

        // Size of returned frequencies
        get frequencyBinCount() {
            return this.bufferLength;
        }

        // Copy to internal buffer
        computeAll() {
            this.analyzer.getByteFrequencyData(this.buffer);
        }

        // Output with more context for easier use
        getFrequencies() {
            this.computeAll();

            return {
                values: this.buffer,  // Frequency values
                min_freq: 0, // Smallest frequency
                max_freq: exports.Context.sampleRate / 2, // Nyquist frequency, max frequency
                bin_size: exports.Context.sampleRate / 2 / this.bufferLength // Size in Hz of each bin
            }
        }

        /*
        The Nyquist frequency, or half the sample rate. This frequency is the maximum frequency outputted by the FFT
         */
        nyquist() {
            return exports.Context.sampleRate / 2;
        }

        /*
        The resolution, in hertz, or the bin size
         */
        resolution() {
            return exports.Context.sampleRate / 2 / this.bufferLength;
        }

        /*
        Frequency at which a semitone becomes indistinguishable (in the sense that two adjacent frequencies near this point
        differing by a semitone would nominally fall into the same bin)
         */
        semitoneBlurred() {
            return this.resolution() / SEMITONE;
        }
    }

    /*
    This class allows live audio to be downsampled and sent to an array
     */
    class Downsampler extends EndingNode {
        /*
        Parameters:

        rate = delta between consecutive samples taken,
        size = size of the buffer keeping track of previous samples
         */
        constructor(params = {}) {
            super();

            this.sample_delta = Math.max(1, Math.round((params.rate !== undefined) ? params.rate : 20));

            this.tracked_length = Math.max(256, (params.size) ? params.size : 1024); // Size of the script processor window

            this.processor = exports.Context.createScriptProcessor(this.tracked_length, 2, 1); // Create a script processor with one input and one (void) output
            this.index = 0;

            this.circular_buffer = new Float32Array(this.tracked_length); // This circular buffer will temporally start at dataWriteIndex and wrap around
            this.dataWriteIndex = 0;

            this.entry.connect(this.processor);

            this.processor.onaudioprocess = (event) => {
                let channel_count = event.inputBuffer.numberOfChannels;
                let channels = []; // Use all channels

                for (let i = 0; i < channel_count; i++) {
                    channels.push(event.inputBuffer.getChannelData(i));
                }

                    let prev_index = -2;
                    let index = -1;

                    while (index > prev_index) { // If the previous index is larger than the new index, the new index lies outside of the current window
                        prev_index = index;
                        index = this.getNextIndex(); // Index tells us where to get the sample from

                        let sum = 0;

                        for (let i = 0; i < channel_count; i++) { // Add up the channel data
                            sum += channels[i][index];
                        }

                        this.writeData(sum); // Write to the circular buffer
                    }

                    this.backCycle(); // We went one index too far, so go back by one
            };

            this.processor.connect(TONES.voidNode); // Connect to the void node so the processor actually runs
        }

        backCycle() { // Jump back one step after ending a window
            this.index += this.tracked_length - this.sample_delta;
            this.dataWriteIndex--;

            if (this.dataWriteIndex < 0) { // If the dataWriteIndex should wrap around
                this.dataWriteIndex = this.tracked_length - 1;
            }
        }

        getNextIndex() {
            this.index += this.sample_delta;
            this.index %= this.tracked_length; // Modulo tracked_length so it always stays in the range of the window

            return this.index;
        }

        writeData(d) {
            let index = this.dataWriteIndex++;
            this.dataWriteIndex %= this.tracked_length; // Circulate the dataWriteIndex

            this.circular_buffer[index] = d;
        }

        getData() { // Get the data as a Float32Array, but aligned correctly (not circular)
            let flattened_data = new Float32Array(this.tracked_length);

            this.writeDataTo(flattened_data);

            return flattened_data;
        }

        writeDataTo(array) { // Write the de-circularized data to an array
            let max_index = this.dataWriteIndex;

            if (array instanceof Float32Array) { // If the array is a Float32Array, use built-in methods to copy
                if (max_index < this.tracked_length - 1) // Array
                    array.set(this.circular_buffer.subarray(max_index, this.tracked_length), 0);
                if (max_index > 0)
                    array.set(this.circular_buffer.subarray(0, max_index), this.tracked_length - max_index);
                return;
            }

            let j = 0;

            for (let i = max_index; i < this.tracked_length; i++, j++) {
                array[j] = this.circular_buffer[i];
            }

            for (let i = 0; i < max_index; i++, j++) {
                array[j] = this.circular_buffer[i];
            }
        }
    }

    // https://gist.github.com/mbitsnbites/a065127577ff89ff885dd0a932ec2477
    function computeFFTInPlace(x_real, x_imag) {
        let middle = x_real.length / 2;
        let X_r = [], X_i = [], Y_r = [], Y_i = [];

        for (let i = 0; i < middle; i++) {
            X_r[i] = x_real[2 * i];
            Y_r[i] = x_real[2 * i + 1];
            X_i[i] = x_imag[2 * i];
            Y_i[i] = x_imag[2 * i + 1];
        }

        if (middle > 1) {
            computeFFTInPlace(X_r, X_i);
            computeFFTInPlace(Y_r, Y_i);
        }

        for (let i = 0; i < middle; ++i) {
            let a = -Math.PI * i / middle,
                tw_re = Math.cos(a),
                tw_im = Math.sin(a),
                b = tw_re * Y_i[i] + tw_im * Y_r[i];

            a = tw_re * Y_r[i] - tw_im * Y_i[i];

            x_real[i] = X_r[i] + a;
            x_imag[i] = X_i[i] + b;
            x_real[i + middle] = X_r[i] - a;
            x_imag[i + middle] = X_i[i] - b;
        }
    }

    function clampUint8(x) {
        if (x > 255)
            x = 255;
        else if (x < 0)
            x = 0;
        return parseInt(Math.round(x));
    }

    const SEMITONE = Math.pow(2, 1/12) - 1;

    const dbMin = -100;
    const dbMax = -30;

    class DownsamplerFFT extends Downsampler {
        constructor(params = {}) {
            super(params);

            let fftReal = new Float32Array(this.tracked_length);
            let fftImag = fftReal.slice();

            this.fftReal = fftReal;
            this.fftImag = fftImag;

            this.buffer = new Float32Array(this.tracked_length / 2);
            this.buffer.fill(0);

            this.smoothingTimeConstant = (params.sTC !== undefined) ? params.sTC : 0.5;
        }

        resetImag() {
            this.fftImag.fill(0);
        }

        read() {
            this.writeDataTo(this.fftReal);
            this.resetImag();
        }

        smoothFFT() {
            let N = this.tracked_length;

            let real = this.fftReal;
            let old = this.buffer;

            for (let i = 0; i < N / 2; i++) {
                real[i] *= 1 - this.smoothingTimeConstant;
                real[i] += old[i] * this.smoothingTimeConstant;
            }

            this.buffer.set(real.subarray(0, N / 2));
        }

        computeFFT() {
            let N = this.tracked_length;

            let real = this.fftReal;
            let imag = this.fftImag;

            computeFFTInPlace(real, imag);

            for (let i = 0; i < N / 2; i++) {
                real[i] = Math.sqrt((real[i] * real[i] + imag[i] * imag[i])) / N;
            }

            this.smoothFFT();
        }

        computeWindow() {
            let N = this.tracked_length;

            let a = 0.16;
            let a0 = (1 - a) / 2;
            let a1 = 1 / 2;
            let a2 = a / 2;

            for (let i = 0; i < N; i++) {
                this.fftReal[i] *= a0 - a1 * Math.cos(2 * Math.PI * i / N) + a2 * Math.cos(4 * Math.PI * i / N);
            }
        }

        decibelConvert() {
            let real = this.fftReal;

            for (let i = 0; i < this.tracked_length / 2; i++) {
                real[i] = Math.log10(real[i] + 1e-40) * 20;
            }
        }

        computeAll() {
            this.read();
            this.computeWindow();
            this.computeFFT();
            this.decibelConvert();
        }

        get frequencyBinCount() {
            return this.tracked_length / 2;
        }

        getByteFrequencyData(array) {
            this.computeAll();

            let real = this.fftReal;
            for (let i = 0; i < this.tracked_length / 2; i++) {
                array[i] = clampUint8(Math.floor(255 / (dbMax - dbMin) * (real[i] - dbMin)));
            }
        }

        getFloatFrequencyData(array) {
            this.computeAll();

            let real = this.fftReal;
            for (let i = 0; i < this.tracked_length / 2; i++) {
                array[i] = real[i];
            }
        }

        getFrequencies() {
            let buffer = new Float32Array(this.tracked_length);
            this.getByteFrequencyData(buffer);

            return {
                values: buffer,
                min_freq: 0,
                max_freq: exports.Context.sampleRate / 2 / this.sample_delta, // Nyquist
                bin_size: exports.Context.sampleRate / 2 / this.tracked_length / this.sample_delta
            }
        }

        nyquist() {
            return exports.Context.sampleRate / 2 / this.sample_delta;
        }

        resolution() {
            return exports.Context.sampleRate / 2 / this.tracked_length / this.sample_delta;
        }

        semitoneBlurred() {
            return this.resolution() / SEMITONE;
        }
    }

    function powerOfTwo(x) {
        return Math.log2(x) % 1 === 0;
    }

    class MultilayerFFT extends EndingNode {
        constructor(params = {}) {
            throw new Error("WIP");

            super();

            this.size = params.size || 4096;
            this.layers = params.layers || 4;

            if (this.layers > 8)
                throw new Error("too many layers");

            if (!powerOfTwo(this.size))
                throw new Error("FFT must be power of two in size");

            this.ffts = [];
            this.arrays = [];

            let main_fft = new SimpleFFT({
                fftSize: this.size
            });

            this.entry.connect(main_fft.entry);

            this.ffts.push(main_fft);

            for (let i = 1; i < this.layers; i++) {
                let downsampler_fft = new DownsamplerFFT({
                    size: this.size,
                    rate: Math.pow(2, i)
                });

                this.entry.connect(downsampler_fft.entry);

                this.ffts.push(downsampler_fft);
            }
        }

        computeAll() {
            for (let i = 0; i < this.ffts.length; i++) {
                if (this.arrays[i])
                    this.ffts[i].getByteFrequencyData(this.arrays[i]);
                else
                    this.arrays[i] = new Uint8Array(this.ffts[i].frequencyBinCount);
            }
        }

        getValue(frequency) {
            let sum = 0;
            let count = 0;

            for (let i = 0; i < this.layers; i++) {
                let fft = this.ffts[i];
                let buffer = this.arrays[i];

                if ((frequency < fft.nyquist() / 3 || i === 0)) {
                    let nearest_i = Math.round(frequency / fft.nyquist() * buffer.length);
                    let factor = Math.max((frequency / fft.semitoneBlurred()) - 1, 0.02);

                    sum += buffer[nearest_i] * factor;
                    count += factor;
                }
            }

            if (count === 0) {
                return 0;
            }

            return sum / count;
        }
    }

    /*
    This class represents a mapping from audioContext time to beat time, and vice versa
     */
    class TimeContext {
        constructor(bpm, offset, beat_meaning = 4) {
            this.bpm = bpm;       // beats per minute
            this.offset = offset; // second offset of beat 0 against audio context time
            this.beat_meaning = beat_meaning;
        }

        ctxTimeToBeat(time$$1) {
            return (time$$1 - this.offset) / 60 * this.bpm / this.beat_meaning;
        }

        beatToCtxTime(beat) {
            return (beat / this.bpm * this.beat_meaning) * 60 + this.offset;
        }

        ctxDeltaToBeat(delta) {
            return delta / 60 * this.bpm / this.beat_meaning;
        }

        beatDeltaToCtx(delta) {
            return delta * 60 / this.bpm * this.beat_meaning;
        }

        parseLength(string) {
            return this.beatToCtxTime(parseLength(string));
        }

        currentBeat() {
            return this.ctxTimeToBeat(exports.Context.currentTime);
        }
    }

    function parseLength(s) {
        if (isNumeric(s))
            return s;
        // TODO: add evaluation with more complex strings
    }

    class Note {
        constructor(params) {
            // pitch should be KeyboardPitch or constructor input
            if (params instanceof KeyboardPitch || !(params instanceof Object)) {
                this.pitch = new KeyboardPitch(params);
            } else {
                this.pitch = new KeyboardPitch((params.pitch !== undefined) ? params.pitch : 69);
            }

            this.start = (params.start !== undefined) ? params.start : 0;
            if (params.end) {
                this.duration = params.end - this.start;
            } else {
                this.duration = (params.duration === undefined) ? 1 : params.duration;
            }

            this.vel = (params.vel !== undefined) ? params.vel : 1;
            this.pan = (params.pan !== undefined) ? params.pan : 0;
        }

        get end() {
            return this.duration + this.start;
        }

        translate(x) {
            this.start += x;
            return this;
        }

        tr(x) {
            return this.translate(x);
        }

        transpose(x) {
            this.pitch.value += x;
            return this;
        }

        tp(x) {
            return this.transpose(x);
        }

        amplify(x) {
            this.vel *= x;
            return this;
        }

        amp(x) {
            return this.amplify(x);
        }

        quieten(x) {
            return this.amplify(1 / x);
        }

        quiet(x) {
            return this.quieten(x);
        }

        clone() {
            return new Note({pitch: this.pitch, duration: this.duration, start: this.start, vel: this.vel, pan: this.pan});
        }

        keyboardNote(timeContext) {
            return new KeyboardNote({
                start: timeContext.beatToCtxTime(this.start),
                end: timeContext.beatToCtxTime(this.end),
                vel: this.vel,
                pan: this.pan,
                pitch: this.pitch
            });
        }
    }

    function makeNote(params) {
        return new Note(params);
    }

    class NoteGroup {
        constructor(notes) {
            if (Array.isArray(notes)) {
                this.notes = notes;
            } else {
                this.notes = [notes];
            }

            for (let i = 0; i < this.notes.length; i++) {
                if (!(this.notes[i] instanceof Note)) {
                    this.notes[i] = new Note(this.notes[i]);
                }
            }

            this.fix();
            this.sort();
        }

        sort() {
            this.notes.sort((x, y) => x.start - y.start);
        }

        apply(func) {
            for (let i = 0; i < this.notes.length; i++) {
                func(this.notes[i]);
            }
        }

        addNote(params) {
            if (params instanceof Note) {
                this.notes.push(params);
            } else {
                this.notes.push(new Note(params));
            }

            this.fix();
            this.sort();
        }

        addNotes(notes) {
            for (let i = 0; i < notes.length; i++) {
                let note = notes[i];
                if (note instanceof Note) {
                    this.notes.push(note);
                } else {
                    this.notes.push(new Note(note));
                }
            }

            this.fix();
            this.sort();
        }

        addGroup(group) {
            this.notes = unionNoteGroups(this, group).notes;
        }

        removeNote(note) {
            if (note instanceof Note) {
                for (let i = 0; i < this.notes.length; i++) {
                    if (this.notes[i] === note) {
                        this.notes.splice(i, 1);
                        return;
                    }
                }
            } else if (note instanceof Function) {
                for (let i = 0; i < this.notes.length; i++) {
                    if (note(this.notes[i])) {
                        this.notes.splice(i, 1);
                        return;
                    }
                }
            }
        }

        translate(x) {
            this.apply(n => n.translate(x));
            return this;
        }

        tr(x) {
            return this.translate(x);
        }

        transpose(x) {
            this.apply(n => n.transpose(x));
            return this;
        }

        tp(x) {
            return this.transpose(x);
        }

        amplify(x) {
            this.apply(n => n.amplify(x));
            return this;
        }

        amp(x) {
            return this.amplify(x);
        }

        quieten(x) {
            this.apply(n => n.quieten(x));
            return this;
        }

        quiet(x) {
            return this.apply(n => n.quiet(x));
        }

        getNotes(minX = -Infinity, maxX = Infinity) {
            let notes = [];

            for (let i = 0; i < this.notes.length; i++) {
                let note = this.notes[i];
                if (note.start > minX && note.start < maxX) {
                    notes.push(note);
                }
            }

            return new NoteGroup(notes);
        }

        fix(unionStrategy = UNION_TYPE.trim()) {
            this.notes = fixNoteArray(this.notes, unionStrategy);
        }

        minStart() {
            let min_start = -Infinity;
            for (let i = 0; i < this.notes.length; i++) {
                if (this.notes[i].start < min_start) {
                    min_start = this.notes[i].start;
                }
            }
        }

        maxStart() {
            let max_start = -Infinity;
            for (let i = 0; i < this.notes.length; i++) {
                if (this.notes[i].start > max_start) {
                    max_start = this.notes[i].start;
                }
            }
        }

        minEnd() {
            let min_end = -Infinity;
            for (let i = 0; i < this.notes.length; i++) {
                if (this.notes[i].end < min_end) {
                    min_end = this.notes[i].end;
                }
            }
        }

        maxEnd() {
            let max_end = -Infinity;
            for (let i = 0; i < this.notes.length; i++) {
                if (this.notes[i].end > max_end) {
                    max_end = this.notes[i].end;
                }
            }
        }

        schedule(instrument, timeContext, params = {}) {
            let minX = (params.minX !== undefined) ? params.minX :
                ((params.minTime !== undefined) ? timeContext.ctxTimeToBeat(params.minTime) : -Infinity);
            let maxX = (params.maxX !== undefined) ? params.maxX :
                ((params.maxTime !== undefined) ? timeContext.ctxTimeToBeat(params.maxTime) : Infinity);

            let notes = this.getNotes(minX, maxX).notes;

            for (let i = 0; i < notes.length; i++) {
                instrument.schedule(notes[i].keyboardNote(timeContext));
            }
        }
    }

    const COINCIDENT_TYPE = { // Union cases where two notes of the same pitch start at the same time
        sum: function(x, y) { // Merge the notes properties
            return new Note({
                pitch: x.pitch,
                vel: x.vel + y.vel,
                end: Math.max(x.end, y.end),
                pan: (x.pan + y.pan) / 2,
                start: x.start
            });
        },
        remove: function(x, y) { // Remove both notes
            return;
        },
        longer: function(x, y) { // Choose the longer one
            if (y.end > x.end) {
                return y;
            } else {
                return x;
            }
        },
        shorter: function(x, y) { // Choose the shorter one
            if (y.end > x.end) {
                return x;
            } else {
                return y;
            }
        },
        max_properties: function(x, y) { // Choose the maximum properties
            return new Note({
                pitch: x.pitch,
                vel: Math.max(x.vel, y.vel),
                end: Math.max(x.end, y.end),
                pan: (x.pan + y.pan) / 2,
                start: x.start
            });
        }
    };

    const UNION_TYPE = { // Union cases where two notes of the same pitch intersect
        merge: ((coincident_type = COINCIDENT_TYPE.sum) => function(x, y) { // Merge the notes together into one note with max length
            if (x.start === y.start) {
                return coincident_type(x, y);
            } else if (x.start < y.start) {
                return new Note({
                    pitch: x.pitch,
                    vel: x.vel,
                    end: y.end,
                    pan: x.pan,
                    start: x.start
                });
            } else {
                return new Note({
                    pitch: y.pitch,
                    vel: y.vel,
                    end: x.end,
                    pan: y.pan,
                    start: y.start
                });
            }
        }),
        trim: ((coincident_type = COINCIDENT_TYPE.sum) => function(x, y) { // Trim the first note so it ends when the second note starts
            if (x.start === y.start) {
                return coincident_type(x, y);
            } else if (x.start < y.start) {
                return [new Note({
                    pitch: x.pitch,
                    vel: x.vel,
                    end: y.start,
                    pan: x.pan,
                    start: x.start
                }), y];
            } else {
                return [new Note({
                    pitch: y.pitch,
                    vel: y.vel,
                    end: x.start,
                    pan: y.pan,
                    start: y.start
                }), x];
            }
        }),
        remove: ((coincident_type = COINCIDENT_TYPE.sum) => function(x, y) { // Remove the notes
            if (x.start === y.start) {
                return coincident_type(x, y);
            }
        }),
        first: ((coincident_type = COINCIDENT_TYPE.sum) => function(x, y) { // choose the first note
            if (x.start === y.start) {
                return coincident_type(x, y);
            } else if (x.start < y.start) {
                return x;
            } else {
                return y;
            }
        }),
        second: ((coincident_type = COINCIDENT_TYPE.sum) => function(x, y) { // choose the second note
            if (x.start === y.start) {
                return coincident_type(x, y);
            } else if (x.start > y.start) {
                return x;
            } else {
                return y;
            }
        })
    };

    function fixNoteArray(arr, unionStrategy = UNION_TYPE.trim()) {
        let process = false;

        do {
            process = false;

            let n_len = arr.length;

            for (let i = 0; i < n_len; i++) {
                let note1 = arr[i];
                for (let j = i + 1; j < n_len; j++) { // (note1, note2) is every pair of notes
                    let note2 = arr[j];

                    if (note1.pitch.value === note2.pitch.value) { // same pitch, might need a union strategy
                        if ((note2.start < note1.start && note1.start < note2.end) ||
                            (note1.start < note2.start && note2.start < note1.end)) {

                            let result = unionStrategy(note1, note2);

                            if (Array.isArray(result)) {
                                for (let k = 0; k < result.length; k++) {
                                    arr.push(result[k]);
                                    n_len++;
                                }
                            } else if (result) {
                                arr.push(result);
                                n_len++;
                            }

                            arr.splice(j, 1);
                            arr.splice(i, 1);

                            i--; j--; n_len -= 2;
                            process = true;
                            break;
                        }
                    }
                }

            }
        } while (process);

        return arr;
    }

    function unionNoteGroups(group1, group2, unionStrategy = UNION_TYPE.trim()) {
        let notes = group1.notes.concat(group2.notes);

        return new NoteGroup(fixNoteArray(notes, unionStrategy));
    }

    function trimComments(line) {
        for (let i = 0; i < line.length; i++) {
            if (line[i] === "!") {
                return line.slice(0, i);
            }
        }
        return line;
    }

    class Rest extends Note {
        constructor(params) {
            super(params);
            this.isRest = true;
        }
    }

    let ENV = {
        d1: 1,
        whole: 1,
        w: 1,
        d2: 0.5,
        half: 0.5,
        h: 0.5,
        d4: 0.25,
        q: 0.25,
        quarter: 0.25,
        d8: 0.125,
        eighth: 0.125,
        e: 0.125,
        d16: 1 / 16,
        sixteenth: 1 / 16,
        s: 1/16,
        d32: 1/32,
        tt: 1/32,
        d64: 1/64,
        sf: 1/64,
        d128: 1/128,
        d256: 1/256,
        d512: 1/512
    };

    let WARNED_EVAL_EXPRESSION = false;


    function _evalExpressions(exprs) {
        if (!WARNED_EVAL_EXPRESSION) {
            WARNED_EVAL_EXPRESSION = true;
            console.warn("evalExpression uses eval(), which is dangerous and therefore should only be used for testing purposes.");
        }
        try {
            return new Function("ENV", "exprs", "let _=[];with(ENV){for(let i=0;i<exprs.length;i++){_.push([exprs[i][0],eval(exprs[i][1])])}}return _")(ENV, exprs);
        } catch (e) {
            throw new Error(`Invalid expression ${exprs}`);
        }
    }

    function exprApply(note, kv_pair) {
        let value = kv_pair[1];

        switch (kv_pair[0]) {
            case 'd':
            case 'dur':
            case 'duration':
                if (value <= 0 && !note.isRest)
                    throw new Error(`Duration length ${value} is invalid`);
                note.duration = value;
                break;
            case 's':
            case 'start':
                note.start = value;
                break;
            case 'e':
            case 'end':
                note.duration = value - note.start;
                if (note.duration <= 0 && !note.isRest)
                    throw new Error(`End value ${value} is invalid`);
                break;
            case 's_off':
            case 's_offset':
            case 'start_offset':
                note.start += value;
                break;
            case 'd_off':
            case 'd_offset':
            case 'duration_offset':
            case 'dur_offset':
                note.duration += value;
                if (note.duration <= 0)
                    throw new Error(`Duration offset value ${value} makes a duration of ${note.duration}`);
                break;
            case 'v':
            case 'vel':
            case 'velocity':
                if (value <= 0)
                    throw new Error(`Velocity value ${value} is invalid`);
                note.vel = value;
                break;
            case 'p':
            case 'pan':
                if (pan < -1 || pan > 1)
                    throw new Error(`Pan value ${value} is invalid`);
                note.pan = value;
                break;
        }
    }

    function applyCurly(notes, exprs_string) {
        if (!exprs_string)
            return;

        let exprs = exprs_string.split(',').map(expr => {
            let kv_pair = expr.split(":");
            if (kv_pair.length !== 2)
                throw new Error(`Invalid key value pair ${expr}`);
            return kv_pair;
        });

        exprs = _evalExpressions(exprs);

        for (let i = 0; i < notes.length; i++) {
            let note = notes[i];

            for (let j = 0; j < exprs.length; j++) {
                exprApply(note, exprs[j]);
            }
        }
    }

    function parseGroupString(string, prev_note, override_prev_note = false, depth = 0) {
        prev_note = prev_note || new Note({start: -0.25, duration: 0.25, pan: 0, vel: 1});
        prev_note._depth = depth;

        let next_start = prev_note.end;

        let generator = parserGenerator(string);
        let token = null;

        let notes = [];
        let active_notes = [];

        function pushNotes() {
            if (!override_prev_note && active_notes.length > 0) {
                prev_note = active_notes[active_notes.length - 1];
            }
            for (let i = 0; i < active_notes.length; i++) {
                if (!active_notes[i].isRest) {
                    notes.push(active_notes[i]);
                }
            }
            active_notes = [];
        }

        while (true) {
            token = generator.next();

            if (token.done) break;

            let contents = token.value;
            let value = contents.value;

            switch (contents.type) {
                case "pitch":
                    pushNotes();

                    let c = new Note({
                        pan: prev_note.pan,
                        vel: prev_note.vel,
                        duration: prev_note.duration,
                        start: prev_note.end,
                        pitch: value
                    });

                    c._depth = depth;
                    active_notes = [c];

                    break;
                case "curly":
                    applyCurly(active_notes, value);
                    pushNotes();

                    break;
                case "bracket":
                    pushNotes();

                    active_notes = parseGroupString(value, prev_note, true, depth + 1);
                    break;
                case "paren":
                    pushNotes();

                    active_notes = parseGroupString(value, prev_note, false, depth + 1);
                    break;
                case "rest":
                    pushNotes();

                    let rest = new Rest({
                        pan: prev_note.pan,
                        vel: prev_note.vel,
                        duration: prev_note.duration,
                        start: prev_note.end,
                        pitch: prev_note.pitch
                    });

                    active_notes = [rest];

                    break;
            }
        }

        pushNotes();

        return notes;
    }

    function* parserGenerator(string) {
        let groupingHistory = [];

        let in_properties = function () {
            return (groupingHistory.includes('{'));
        };

        let last_opening = function () {
            if (groupingHistory.length === 0) {
                throw new Error("Unbalanced parentheses, brackets, and/or curly braces");
            }
            return (groupingHistory[groupingHistory.length - 1]);
        };

        let remove_last_opening = function () {
            if (groupingHistory.length === 0) {
                throw new Error("Unbalanced parentheses, brackets, and/or curly braces");
            }
            return groupingHistory.splice(groupingHistory.length - 1, 1);
        };

        let at_top_level = function() {
            return !groupingHistory.length;
        };

        let ltoi = -1; // Last top level opening index
        let note_concat = "";

        for (let i = 0; i < string.length; i++) {
            //console.log(groupingHistory, string[i]);
            let ret_value = null;

            switch (string[i]) {
                case '[':
                    if (in_properties())
                        throw new Error("Cannot have bracket in properties");
                    if (at_top_level())
                        ltoi = i + 1;
                    groupingHistory.push('[');
                    break;
                case ']':
                    if (last_opening() === '[')
                        remove_last_opening();
                    else
                        throw new Error("Mismatched bracket");
                    if (at_top_level())
                        ret_value = {type: "bracket", value: string.slice(ltoi, i)};
                    break;
                case '(':
                    if (at_top_level())
                        ltoi = i + 1;
                    groupingHistory.push('(');
                    break;
                case ')':
                    if (last_opening() === '(')
                        remove_last_opening();
                    else
                        throw new Error("Mismatched parentheses");
                    if (at_top_level())
                        ret_value = {type: "paren", value: string.slice(ltoi, i)};
                    break;
                case '{':
                    if (in_properties())
                        throw new Error("Cannot have nested curly braces");
                    if (at_top_level())
                        ltoi = i + 1;
                    groupingHistory.push('{');
                    break;
                case '}':
                    if (last_opening() === '{')
                        remove_last_opening();
                    else
                        throw new Error("Mismatched curly braces");
                    if (at_top_level())
                        ret_value = {type: "curly", value: string.slice(ltoi, i)};
                    break;
                case 'R':
                    if (at_top_level())
                        ret_value = {type: "rest", value: "R"};
                    break;
                default:
                    if (at_top_level()) {
                        let prev_note_concat = note_concat;
                        note_concat += string[i];
                        try {
                            let p = new KeyboardPitch(note_concat);
                        } catch (e) {
                            try {
                                yield {type: "pitch", value: new KeyboardPitch(prev_note_concat)};
                                note_concat = string[i];
                            } catch (f) {

                            }
                        }
                    } else {
                        continue;
                    }
            }

            if (ret_value) {
                if (note_concat) {
                    try {
                        let p = new KeyboardPitch(note_concat);
                        yield {type: "pitch", value: p};
                        note_concat = "";
                    } catch (e) {
                        throw new Error(`Invalid pitch "${note_concat}"`)
                    }
                }

                yield ret_value;
            }
        }

        if (note_concat) {
            try {
                let p = new KeyboardPitch(note_concat);
                yield {type: "pitch", value: p};
            } catch (e) {
                throw new Error(`Invalid pitch "${note_concat}"`)
            }
        }
    }

    /*
    A somewhat difficult to use function, but useful for quick tests
     */
    function parseAbbreviatedGroup(string) {
        if (!isString(string)) {
            throw new Error("Parse group must act on a string");
        }

        let lines = string.split('\n');

        for (let i = 0; i < lines.length; i++) {
            lines[i] = trimComments(lines[i]).replace(/\s/g,''); // remove comments and whitespace
        }

        string = lines.join('');

        return new NoteGroup(parseGroupString(string));
    }

    const MIN_FREQ$1 = 40;
    const MAX_FREQ$1 = 16000;
    const MIN_FREQ_LOG2$1 = Math.log2(MIN_FREQ$1);
    const MAX_FREQ_LOG2$1 = Math.log2(MAX_FREQ$1);
    const FREQ_DIFF$1 = MAX_FREQ_LOG2$1 - MIN_FREQ_LOG2$1;

    function transformUnit(x) {
        return Math.pow(2, MIN_FREQ_LOG2$1 + FREQ_DIFF$1 * x);
    }

    const vsSource = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `;

    const fsSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
	precision highp float;
  #else
    precision mediump float;
  #endif
  

  uniform vec2 resolution;
  uniform sampler2D uSampler;
  uniform vec2 textureSize;
  

vec4 getValueFromTexture(float index) {
   float column = mod(index, textureSize.x);
   float row    = floor(index / textureSize.x);
   vec2 uv = vec2(
      (column + 0.5) / textureSize.x,
      (row    + 0.5) / textureSize.y);
   return texture2D(uSampler, uv);
}
 
  void main() {
	highp vec2 position = ( gl_FragCoord.xy / resolution.xy );
	vec4 color = texture2D(uSampler, position);
	
	gl_FragColor = getValueFromTexture(position.x * textureSize.x * textureSize.x);//vec4(position.x * 2.0, ian, ian, 1.0);
  }
  `;


    // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context
    function loadShader(ctx, type, source) {
        const shader = ctx.createShader(type);

        ctx.shaderSource(shader, source);
        ctx.compileShader(shader);

        if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
            setTimeout(() => ctx.deleteShader(shader), 1);
            throw new Error('An error occurred compiling the shaders: ' + ctx.getShaderInfoLog(shader));
        }

        return shader;
    }

    function initShaderProgram(ctx, vertex_shader, fragment_shader) {
        const vertexShader = loadShader(ctx, ctx.VERTEX_SHADER, vertex_shader);
        const fragmentShader = loadShader(ctx, ctx.FRAGMENT_SHADER, fragment_shader);

        const shaderProgram = ctx.createProgram();
        ctx.attachShader(shaderProgram, vertexShader);
        ctx.attachShader(shaderProgram, fragmentShader);
        ctx.linkProgram(shaderProgram);

        if (!ctx.getProgramParameter(shaderProgram, ctx.LINK_STATUS)) {
            throw new Error('Unable to initialize the shader program: ' + ctx.getProgramInfoLog(shaderProgram));
        }

        return shaderProgram;
    }

    class FrequencyVisualizer extends SimpleFFT {
        constructor(params = {}) {
            super(params);

            if (params.domElement) {
                this.setCanvas(params.domElement);
            }

            this.color = params.color || {
                r: 250,
                g: 175,
                b: 162
            };

            this.opacity = params.opacity || 255;

            this.draw_loop_enabled = false;
        }

        clearCanvas() {
            let ctx = this.ctx;

            ctx.clearColor(0.0, 0.0, 0.0, 1.0);
            ctx.clear(ctx.COLOR_BUFFER_BIT);

            ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
        }

        startDrawLoop() {
            this.draw_loop_enabled = true;
            this.drawLoop();
        }

        drawLoop() {
            this.computeAll();
            this.drawScene();

            if (this.draw_loop_enabled) {
                window.requestAnimationFrame(() => {
                    this.drawLoop();
                });
            }
        }

        stopDrawLoop() {
            this.draw_loop_enabled = false;
            this.clearCanvas();
        }

        drawScene() {
            let ctx = this.ctx;

            let program_info = this.program_info;
            let buffers = this.buffers;

            this.clearCanvas();

            ctx.bindBuffer(ctx.ARRAY_BUFFER, buffers.position);
            ctx.vertexAttribPointer(program_info.attribLocations.vertexPosition, 2, ctx.FLOAT, false, 0, 0);
            ctx.enableVertexAttribArray(program_info.attribLocations.vertexPosition);

            let proj_matrix = new Float32Array([
                0.943,  0,      0,      0,
                0,      2.414,  0,      0,
                0,      0,      -1.002, -1,
                0,      0,      -0.200, 0
            ]);

            let model_matrix = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, -1, 1
            ]);

            if (!this.active_texture) {
                this.active_texture = ctx.createTexture();
            }

            ctx.useProgram(program_info.program);

            ctx.uniformMatrix4fv(
                program_info.uniformLocations.projectionMatrix,
                false,
                proj_matrix);
            ctx.uniformMatrix4fv(
                program_info.uniformLocations.modelViewMatrix,
                false,
                model_matrix);
            ctx.uniform2fv(
                program_info.uniformLocations.resolution,
                [this.canvas.width, this.canvas.height]
            );

            let texture_size = 64;
            let s_size = texture_size * texture_size;

            let color_array = this._image ? this._image.data : new Uint8ClampedArray(4 * s_size);
            let r = this.color.r / 256.;
            let g = this.color.g / 256.;
            let b = this.color.b / 256.;

            for (let i = 0; i < s_size; i++) {
                let x = transformUnit(i / s_size);

                let nearest_i = Math.min(parseInt(x / this.nyquist() * this.buffer.length), this.buffer.length - 1);

                let value = this.buffer[nearest_i];

                value *= value / 256;

                color_array[4 * i] = value * r;
                color_array[4 * i + 1] = value * g;
                color_array[4 * i + 2] = value * b;
                color_array[4 * i + 3] = this.opacity;
            }

            let image = this._image ? this._image : new ImageData(color_array, texture_size, texture_size);
            if (!this._image)
                this._image = image;

            ctx.activeTexture(ctx.TEXTURE0);

            ctx.bindTexture(ctx.TEXTURE_2D, this.active_texture);
            ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, image);

            ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);

            ctx.uniform1i(program_info.uniformLocations.uSampler, 0);
            ctx.uniform2fv(program_info.uniformLocations.textureSize, [texture_size,texture_size]);

            ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
        }

        makeQuad() {
            let ctx = this.ctx;

            const positionBuffer = ctx.createBuffer();
            ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);

            const positions = [
                -9.0, 9.0,
                9.0, 9.0,
                -9.0, -9.0,
                9.0, -9.0,
            ];

            ctx.bufferData(ctx.ARRAY_BUFFER,
                new Float32Array(positions),
                ctx.STATIC_DRAW);

            return {
                position: positionBuffer,
            };
        }

        setCanvas(canvas) {
            let ctx = (canvas.getContext("webgl"));

            if (!ctx)
                throw new Error("WebGL not supported");

            this.canvas = canvas;
            this.ctx = ctx;

            let shaderProgram = initShaderProgram(ctx, vsSource, fsSource);
            this.shaderProgram = shaderProgram;

            ctx.enable(ctx.DEPTH_TEST);

            this.program_info = {
                program: shaderProgram,
                attribLocations: {
                    vertexPosition: ctx.getAttribLocation(shaderProgram, 'aVertexPosition'),
                },
                uniformLocations: {
                    projectionMatrix: ctx.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
                    modelViewMatrix: ctx.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
                    uSampler: ctx.getUniformLocation(shaderProgram, 'uSampler'),
                    resolution: ctx.getUniformLocation(shaderProgram, 'resolution'),
                    textureSize: ctx.getUniformLocation(shaderProgram, 'textureSize')
                },
            };

            this.buffers = this.makeQuad();
        }
    }

    function stretchToExp(minX, maxX, x) {
        let MIN_FREQ_LOG2 = Math.log2(minX);
        let MAX_FREQ_LOG2 = Math.log2(maxX);
        let FREQ_DIFF = MAX_FREQ_LOG2 - MIN_FREQ_LOG2;

        return Math.pow(2, MIN_FREQ_LOG2 + FREQ_DIFF * x);
    }

    window.ian = stretchToExp;

    class ArrayGrapher {
        constructor(params = {}) {
            if (params.domElement) {
                this.setCanvas(params.domElement);
                this.setContext(params.context || params.domElement.getContext('2d'));
            }

            this.transformation = params.transformation || ((x, y) => [x, y]);
        }

        setCanvas(canvas) {
            this.canvas = canvas;
        }

        setContext(ctx) {
            this.ctx = ctx;
        }

        transform(x, y) {
            return this.transformation(x, y);
        }

        clearCanvas() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        drawLineSegments(arg1, arg2) {
            this.clearCanvas();
            if (!arg2) { // arg1 is sequence x,y,x,y
                let ctx = this.ctx;

                ctx.beginPath();

                let drewFirst = false;

                for (let i = 0; i < arg1.length / 2; i++) {
                    let x = arg1[2 * i];
                    let y = arg1[2 * i + 1];

                    let point = this.transform(x, y);
                    if (!drewFirst) {
                        drewFirst = true;

                        ctx.moveTo(...point);
                    } else {
                        ctx.lineTo(...point);
                    }
                }

                ctx.stroke();
            } else { // arg1, arg2 are x, y
                let ctx = this.ctx;

                ctx.beginPath();

                let drewFirst = false;

                for (let i = 0; i < arg1.length; i++) {
                    let x = arg1[i];
                    let y = arg2[i];

                    let point = this.transform(x, y);
                    if (!drewFirst) {
                        drewFirst = true;

                        ctx.moveTo(...point);
                    } else {
                        ctx.lineTo(...point);
                    }
                }

                ctx.stroke();
            }
        }

        drawRange(arg1, minX, maxX) {
            this.clearCanvas();
            let ctx = this.ctx;

            ctx.beginPath();

            let drewFirst = false;

            for (let i = 0; i < arg1.length; i++) {
                let x = i / arg1.length * (maxX - minX) + minX;
                let y = arg1[i];

                let point = this.transform(x, y);

                if (!drewFirst) {
                    drewFirst = true;

                    ctx.moveTo(...point);
                } else {
                    ctx.lineTo(...point);
                }
            }

            ctx.stroke();
        }

        drawExpRange(arg1, minX, maxX) {
            this.clearCanvas();
            let ctx = this.ctx;

            ctx.beginPath();

            let drewFirst = false;

            for (let i = 0; i < arg1.length; i++) {
                let x = stretchToExp(minX, maxX, i / arg1.length);
                let y = arg1[i];

                let point = this.transform(x, y);

                if (!drewFirst) {
                    drewFirst = true;

                    ctx.moveTo(...point);
                } else {
                    ctx.lineTo(...point);
                }
            }

            ctx.stroke();
        }
    }

    function stretchToCanvas(canvas, minX = 0, maxX = 100, minY = 0, maxY = 100) {
        let width = canvas.width;
        let height = canvas.height;

        return function(x, y) {
            return [
                (x - minX) / (maxX - minX) * width,
                (y - minY) / (maxY - minY) * height
            ]
        }
    }

    let ID_INTERNAL = new Uint32Array(1);
    ID_INTERNAL[0] = 0xCF39ACE1;

    /* Linear shift register to generate unique IDs for elements */
    function getID$1(prefix = "S") {
        let lsb = ID_INTERNAL[0] & 1;
        ID_INTERNAL[0] >>= 1;
        if (lsb)
            ID_INTERNAL[0] ^= 0xD11AB400;

        return prefix + ID_INTERNAL[0];
    }

    const SVGNS = "http://www.w3.org/2000/svg";

    function svgClassFactory(group, class_, ...args) {
        return new class_(group, ...args);
    }

    // Class which allows modification of parents by setting "propagators"
    class ChildUpdater {
        constructor() {
            this.propagators = {};
        }

        _setModificationPropagation(func, id) {
            this.propagators[id] = func;
        }

        _removeModificationPropagation(id) {
            delete this.propagators[id];
        }

        propagateChange(...args) {
            Object.keys(this.propagators).forEach(key => {
                this.propagators[key](...args);
            });
        }
    }

    class SVGElement extends ChildUpdater {
        constructor(parent, tag) {
            super();

            if (!parent) { // used in construction of SVGContext, which has no parent
                this.context = this;
                this.element = tag;
                this.parent = null;
            } else { // Other nodes go here
                this.context = parent.context;
                this.element = isString(tag) ? parent.createRawElement(tag, {}, true) : tag;
                this.parent = parent;

                parent.children.push(this);
            }

            this._id = getID$1();

            this.element.setAttributeNS(null, "_id", this._id);

            this.transform = new Transformation();
            this.transform._setModificationPropagation(() => {
                this.updateTransform();
            }, this._id);

            this.updateTransform();
            this.set("class", ""); // TODO stop this
        }

        updateTransform() {
            let value = this.transform.toSVGValue();

            if (value) {
                this.set("transform", value);
            }

            return this;
        }

        addTransform(...args) {
            this.transform.addTransform(...args);
            this.updateTransform();

            return this;
        }

        removeTransform(...args) {
            this.transform.removeTransform(...args);
            this.updateTransform();

            return this;
        }

        resetTransform() {
            this.transform.removeAll();
            this.updateTransform();

            return this;
        }

        getBBox() {
            return this.element.getBBox();
        }

        set(attribute, value) {
            if (attribute instanceof Object) {
                Object.keys(attribute).forEach((key) => {
                    this.element.setAttributeNS(null, key, attribute[key]);
                });
            } else {
                this.element.setAttributeNS(null, attribute, value);
            }

            return this;
        }

        _addTo(element = this.context.element) {
            element.appendChild(this.element);
            return this;
        }

        remove() {
            this.element.remove();
            this.parent.removeChild(this);
        }

        get(attribute) {
            return this.element.getAttributeNS(null, attribute);
        }

        getNames() {
            return this.element.getAttributeNames();
        }

        has(attribute) {
            return !!this.element.getAttributeNS(null, attribute);
        }

        highlightBox() {
            this._highlight_box = new TONES.Rectangle(this.parent, this.getBBox()).addClass("highlight");
            return this;
        }

        unhighlightBox() {
            this._highlight_box.destroy();
            this._highlight_box = undefined;

            return this;
        }

        getAll() {
            let names = this.getNames();
            let attribs = {};

            for (let i = 0; i < names.length; i++) {
                attribs[names[i]] = this.get(names[i]);
            }

            return attribs;
        }

        destroy() {
            this.remove();

            this._id = -1;
        }

        get destroyed() {
            return this._id === -1;
        }

        addEventListener(...args) {
            return this.element.addEventListener(...args);
        }

        removeEventListener(...args) {
            return this.element.removeEventListener(...args);
        }

        getClasses() {
            let classes = this.get("class");

            if (!classes) {
                return [];
            }

            return classes.split('\n');
        }

        addClass(x) {
            let classes = this.getClasses();

            for (let i = 0; i < classes.length; i++) {
                let Class = classes[i];

                if (x === Class) return;
            }

            this.set("class", this.get("class") + x);
            return this;
        }

        removeClass(x) {
            if (!Array.isArray(x))
                x = [x];

            let classes = this.getClasses();

            for (let i = 0; i < x.length; i++) {
                for (let j = 0; j < classes.length; j++) {
                    if (x[i] === classes[j]) {
                        classes.splice(j--, 1);
                    }
                }
            }

            this.set("class", classes.join(' '));
            return this;
        }

        hide() {
            this.set("display", "none");
        }

        show() {
            this.set("display", "");
        }
    }

    class SVGGroup extends SVGElement {
        constructor(parent, _contextDOM = null) { // DO NOT USE THE SECOND PARAMETER
            super(parent, _contextDOM ? _contextDOM : "g");

            this.children = [];
        }

        traverseNodes(func, evalBefore = true) {
            for (let i = 0; i < this.children.length; i++) {
                let child = this.children[i];

                if (evalBefore)
                    func(child, this, i);
                if (child.traverseNodes)
                    child.traverseNodes(func, evalBefore);
                if (!evalBefore)
                    func(child, this, i);
            }
        }

        createElement(name, attribs = {}, append = false, namespace = SVGNS) {
            let elem = this.createRawElement(name, attribs, append, namespace);

            let svgElement = new SVGElement(this, elem);
            this.children.push(svgElement);

            return svgElement;
        }

        createRawElement(name, attribs = {}, append = false, namespace = SVGNS) {
            let elem = document.createElementNS(namespace, name);

            Object.keys(attribs).forEach((key) => {
                elem.setAttributeNS(null, key, attribs[key]);
            });

            if (append)
                this.element.appendChild(elem);

            return elem;
        }

        addElement(name, attribs = {}, namespace = SVGNS) {
            return this.createElement(name, attribs, true, namespace);
        }

        makeGroup(attribs = {}, append = false) {
            let elem = document.createElementNS(SVGNS, 'g');

            Object.keys(attribs).forEach((key) => {
                elem.setAttributeNS(null, key, attribs[key]);
            });

            if (append)
                this.element.appendChild(elem);

            let svgElement = new SVGGroup(this, elem);
            this.children.push(svgElement);

            return svgElement;
        }

        addGroup(attribs = {}) {
            return this.makeGroup(attribs, true);
        }

        removeElement(elem, recursive = false) {
            let id;
            if (elem instanceof SVGElement) {
                id = elem._id;
            } else {
                id = elem;
            }

            return this.removeIf(e => e._id === id);
        }

        removeChild(elem, recursive = false) {
            let id;
            if (elem instanceof SVGElement) {
                id = elem._id;
            } else {
                id = elem;
            }

            let count = 0;

            for (let i = 0; i < this.children.length; i++) {
                let child = this.children[i];

                if (recursive && child.removeChild) {
                    let res = child.removeChild(id, recursive);
                    count += res;
                }

                if (child._id === id) {
                    this.children.splice(i--, 1);
                    count += 1;
                }
            }

            return count;
        }

        removeIf(func, recursive = false) {

            for (let i = 0; i < this.children.length; i++) {
                let child = this.children[i];

                if (recursive && child.removeIf) {
                    let res = child.removeIf(func, recursive);
                }

                if (func(child)) {
                    this.children[i].destroy();
                    this.children.splice(i--, 1);
                }
            }

            return 0;
        }

        destroy() {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].destroy();
            }

            this.remove();
            this._id = -1;
        }
    }

    class SVGContext extends SVGGroup {
        constructor(domElem) {
            if (typeof domElem === "string") {
                domElem = document.getElementById(domElem);
            }

            if (!domElem) {
                throw new Error("Must pass valid DOM element or id");
            }

            super(null, domElem);

            this.context = this;

            this.children = [];
            this._id = getID$1();

            this.element.setAttributeNS(null, "_id", this._id);
        }

        get width() {
            return parseInt(this.element.getAttributeNS(null, "width"));
        }

        get height() {
            return parseInt(this.element.getAttributeNS(null, "height"));
        }

        set width(value) {
            this.element.setAttributeNS(SVGNS, "width", value);
        }

        set height(value) {
            this.element.setAttributeNS(SVGNS, "height", value);
        }

        makeCircle(cx = 0, cy = 0, r = 0) {
            return svgClassFactory(this, Circle, 'circle', cx, cy, r);
        }
    }

    class SimpleTransformation extends ChildUpdater {
        constructor() {
            super();
        }
    }

    class Transformation extends ChildUpdater {
        constructor(transforms = []) {
            super();

            this.transforms = transforms;
            this._id = getID$1("T");
        }

        transform(x, y) {
            for (let i = this.transforms.length - 1; i >= 0; i--) {
                let result = this.transforms[i].transform(x, y);

                x = result[0];
                y = result[1];
            }
        }

        toSVGValue() {
            let text = "";

            for (let i = 0; i < this.transforms.length; i++) {
                text += this.transforms[i].toSVGValue() + ' ';
            }

            return text;
        }

        addTransform(t) {
            this.transforms.push(t);

            t._setModificationPropagation(() => {
                this.propagateChange();
            }, this._id);
        }

        prependTransform(t) {
            this.transforms.unshift(t);

            t._setModificationPropagation(() => {
                this.propagateChange();
            }, this._id);
        }

        removeTransform(elem) {
            let id;
            if (elem instanceof SimpleTransformation) {
                id = elem._id;
            } else {
                id = elem;
            }

            this.removeIf(e => e._id === id);
            this.propagateChange();
        }

        removeIf(func) {
            for (let i = 0; i < this.transforms.length; i++) {
                if (func(this.transforms[i])) {
                    this.transforms[i]._removeModificationPropagation(this._id);
                    this.transforms.splice(i--, 0);
                }
            }
        }

        removeAll() {
            this.removeIf(() => true);
        }
    }

    class Translation extends SimpleTransformation {
        constructor(xd = 0, yd = 0) {
            super();

            this._x = xd;
            this._y = yd;

            this._id = getID$1("T");
        }

        get x() {
            return this._x;
        }

        get y() {
            return this._y;
        }

        set x(value) {
            this._x = value;
            this.propagateChange();
        }

        set y(value) {
            this._y = value;
            this.propagateChange();
        }

        transform(x, y) {
            if (Array.isArray(x)) {
                y = x[1];
                x = x[0];
            }

            return [x + this.x, y + this.y];
        }

        toSVGValue() {
            return `translate(${this.x}, ${this.y})`;
        }
    }

    class MatrixTransform extends SimpleTransformation {
        constructor(a, b, c, d, e, f) {
            super();

            this._a = a;
            this._b = b;
            this._c = c;
            this._d = d;
            this._e = e;
            this._f = f;
        }

        get a() {
            return this._a;
        }

        get b() {
            return this._b;
        }

        get c() {
            return this._c;
        }

        get d() {
            return this._d;
        }

        get e() {
            return this._e;
        }

        get f() {
            return this._f;
        }

        set a(value) {
            this._a = value;
            this.propagateChange();
        }

        set b(value) {
            this._b = value;
            this.propagateChange();
        }

        set c(value) {
            this._c = value;
            this.propagateChange();
        }

        set d(value) {
            this._d = value;
            this.propagateChange();
        }

        set e(value) {
            this._e = value;
            this.propagateChange();
        }

        set f(value) {
            this._f = value;
            this.propagateChange();
        }

        transform(x, y) {
            if (Array.isArray(x)) {
                y = x[1];
                x = x[0];
            }

            return [this.a * x + this.c * y + this.e, this.b * x + this.d * y + this.f];
        }

        toSVGValue() {
            return `matrix(${this.a} ${this.b} ${this.c} ${this.d} ${this.e} ${this.f})`;
        }
    }

    class ScaleTransform extends SimpleTransformation {
        constructor(xs, ys = xs) {
            super();

            this._xs = xs;
            this._ys = ys;
        }

        transform(x, y) {
            if (Array.isArray(x)) {
                y = x[1];
                x = x[0];
            }

            return [x * this.xs, y * this.ys];
        }

        get xs() {
            return this._xs;
        }

        get ys() {
            return this._ys;
        }

        set xs(value) {
            this._xs = value;
            this.propagateChange();
        }

        set ys(value) {
            this._ys = value;
            this.propagateChange();
        }

        toSVGValue() {
            return `scale(${this.xs} ${this.ys})`;
        }
    }

    class Rotation extends SimpleTransformation {
        constructor(a, x = 0, y = 0) {
            super();

            this._a = a;
            this._x = x;
            this._y = y;
        }

        transform(x, y) {
            let xr = this.x;
            let yr = this.y;
            let a = this.a * Math.PI / 180;

            x -= xr;
            y -= yr;

            let s = Math.sin(a), c = Math.cos(a);

            let xn = x * c - y * s;

            return [xn + xr, xn + yr];
        }

        get a() {
            return this._a;
        }

        get x() {
            return this._x;
        }

        get y() {
            return this._y;
        }

        set a(value) {
            this._a = value;
            this.propagateChange();
        }

        set x(value) {
            this._x = value;
            this.propagateChange();
        }

        set y(value) {
            this._y = value;
            this.propagateChange();
        }

        toSVGValue() {
            return `rotate(${this.a} ${this.x} ${this.y})`;
        }
    }

    class Circle extends SVGElement {
        constructor(parent, cx = 0, cy = 0, r = 0) {
            super(parent, 'circle');

            this._cx = cx;
            this._cy = cy;
            this._r = r;

            this.updateSVG();
        }

        get cx() {
            return this._cx;
        }

        get cy() {
            return this._cy;
        }

        get r() {
            return this._r;
        }

        set cx(value) {
            this._cx = value;
            this.updateSVG();
        }

        set cy(value) {
            this._cy = value;
            this.updateSVG();
        }

        set r(value) {
            this._r = value;
            this.updateSVG();
        }

        area() {
            return Math.PI * this.r * this.r;
        }

        circumference() {
            return 2 * Math.PI * this.r;
        }

        diameter() {
            return this.r * Math.PI;
        }

        updateSVG() {
            this.set("cx", this.cx);
            this.set("cy", this.cy);
            this.set("r", this.r);
        }
    }

    class Rectangle extends SVGElement {
        constructor(parent, params = {}) {
            super(parent, 'rect');

            this._width = select(params.width, 100);
            this._height = select(params.height, 100);
            this._x = select(params.x, 0);
            this._y = select(params.y, 0);
            this._rx = select(params.rx, 0);
            this._ry = select(params.ry, 0);

            this.updateSVG();
        }

        updateSVG() {
            this.set('width', this.width);
            this.set('height', this.height);
            this.set('x', this.x);
            this.set('y', this.y);
            this.set('rx', this.rx);
            this.set('ry', this.ry);
        }

        get width() {
            return this._width;
        }

        set width(value) {
            this._width = value;
            this.updateSVG();
        }

        get height() {
            return this._height;
        }

        set height(value) {
            this._height = value;
            this.updateSVG();
        }

        get x() {
            return this._x;
        }

        set x(value) {
            this._x = value;
            this.updateSVG();
        }

        get y() {
            return this._y;
        }

        set y(value) {
            this._y = value;
            this.updateSVG();
        }

        get rx() {
            return this._rx;
        }

        set rx(value) {
            this._rx = value;
            this.updateSVG();
        }

        get ry() {
            return this._ry;
        }

        set ry(value) {
            this._ry = value;
            this.updateSVG();
        }

        static tag() {
            return "rect";
        }
    }

    class Ellipse extends SVGElement {
        constructor(parent, cx = 0, cy = 0, rx = 0, ry = 0) {
            super(parent, 'ellipse');

            this._cx = cx;
            this._cy = cy;
            this._rx = rx;
            this._ry = ry;

            this.updateSVG();
        }

        updateSVG() {
            this.set('cx', this.cx);
            this.set('cy', this.cy);
            this.set('rx', this.rx);
            this.set('ry', this.ry);
        }

        get cx() {
            return this._cx;
        }

        set cx(value) {
            this._cx = value;
            this.updateSVG();
        }

        get cy() {
            return this._cy;
        }

        set cy(value) {
            this._cy = value;
            this.updateSVG();
        }

        get rx() {
            return this._rx;
        }

        set rx(value) {
            this._rx = value;
            this.updateSVG();
        }

        get ry() {
            return this._ry;
        }

        set ry(value) {
            this._ry = value;
            this.updateSVG();
        }

        static tag() {
            return "ellipse";
        }
    }

    class Text extends SVGElement {
        constructor(parent, text = "lorem ipsum", x = 0, y = 0, dx = 0, dy = 0) {
            super(parent, 'text');

            this._text = text;
            this._x = x;
            this._y = y;
            this._dx = dx;
            this._dy = dy;

            this.updateSVG();
        }

        updateSVG() {
            this.set('x', this.x);
            this.set('y', this.y);
            this.set('dx', this.dx);
            this.set('dy', this.dy);
            this.element.textContent = this._text;
        }

        get x() {
            return this._x;
        }

        set x(value) {
            this._x = value;
            this.updateSVG();
        }

        get y() {
            return this._y;
        }

        set y(value) {
            this._y = value;
            this.updateSVG();
        }

        get dx() {
            return this._dx;
        }

        set dx(value) {
            this._dx = value;
            this.updateSVG();
        }

        get dy() {
            return this._dy;
        }

        set dy(value) {
            this._dy = value;
            this.updateSVG();
        }

        get text() {
            return this._text;
        }

        set text(value) {
            this._text = value;
            this.updateSVG();
        }

        static tag() {
            return "text";
        }
    }

    class Path extends SVGElement {
        constructor(parent, d = "") {
            super(parent, 'path');

            this._d = d;
            this.updateSVG();
        }

        updateSVG() {
            this.set("d", this._d);
        }

        get d() {
            return this._d;
        }

        set d(value) {
            this._d = value;
            this.updateSVG();
        }

        static tag() {
            return "path";
        }
    }

    class Polygon extends SVGElement {
        constructor(parent, points = []) { // Note: you'll have to call updateSVG when changing points because IMPLOSION
            super(parent, 'polygon');

            this.points = points;
            this.updateSVG();
        }

        updateSVG() {
            let text = "";

            for (let i = 0; i < this.points.length; i++) {
                text += this.points[i].join(',');
            }

            this.set("points", text);
        }
    }

    class ScoreContext extends SVGContext {
        constructor(domElem) {
            super(domElem);
        }

        propagateParentsUpdate() {
            if (this._update) {
                this._update();
            }
        }
    }

    class ScoreGroup extends SVGGroup {
        constructor(parent) {
            super(parent);
        }

        propagateParentsUpdate(execbefore = true) {
            if (execbefore && this._update) {
                this._update();
            }

            if (this.parent) {
                this.parent.propagateParentsUpdate(execbefore);
            }

            if (!execbefore && this._update) {
                this._update();
            }
        }

        makeScoreElem(Class, ...args) {
            let element = new Class(this, ...args);
        }

        addScoreElem(...args) {
            this.makeScoreElem(...args);
        }

        static tag() {
            return "g";
        }
    }

    const DEFAULTS = {
        STAFF_LINE_SEPARATION: 10,
        MEASURE_HEIGHT: 40,
        STAVE_MARGIN_X: 10.5,
        STAVE_MARGIN_Y: 10.5,
        STAFF_SEPARATION: 100
    };

    /*
    Properties:

    barline_type -> type of barline, one of
    normal: simple line
    none: no line
    right_double: two lines, right side
    left_double: two lines, left side
    dashed: dashed line
    right_ending: ending symbol
    left_ending: left ending symbol
    right_repeat: repeat symbol
    left_repeat: left repeat symbol
    height -> height of the barline
    arg1 -> used for special arguments to the barline_type
    Interpretation:
    normal: N/A
    none: N/A
    left_double / right_double: spacing between lines
    left_ending / right_ending: spacing between lines
    left_repeat / right_repeat: spacing between lines
    arg2 -> used for special arguments to the barline_type
    normal: N/A
    none: N/A
    left_double / right_double: N/A
    left_ending / right_ending: N/A
    left_repeat / right_repeat: array of centered positions to put the dots
    arg3 -> used for special arguments to the barline_type
    normal: N/A
    none: N/A
    left_double / right_double: N/A
    left_ending / right_ending: N/A
    left_repeat / right_repeat: width of each dot pair
     */

    class Barline extends ScoreGroup {
        constructor(parent, params) {

            super(parent);

            // Parameters
            this.barline_type = params.barline_type || "normal";
            this.height = params.height || DEFAULTS.MEASURE_HEIGHT;
            this.offset_x = (params.offset_x !== undefined) ? params.offset_x : 0;
            this.arg1 = (params.arg1 !== undefined) ? params.arg1 : 0;
            this.arg2 = params.arg2;
            this.arg3 = params.arg3;

            // Internals
            this.components = [];
            this.translation = new Translation(this.offset_x);
            this.addTransform(this.translation);

            this.recalculate();
        }

        recalculate() {
            // Destroy old components
            this.components.forEach(x => x.destroy());
            this.components = [];

            // Update translation
            this.translation.x = this.offset_x;

            assert(this.height > 0, "Height must be positive");
            let o_x = 0;
            let r_x = 1;

            switch (this.barline_type) {
                case "none":
                    return;
                case "normal":
                    let path = new Path(this, `M 0 0 L 0 ${this.height}`);
                    path.addClass("barline-normal");
                    this.components.push(path);
                    break;
                case "left_double": // makes o_x = -1
                    o_x += -2;
                case "right_double":  // makes o_x = 1
                    o_x += 1;
                case "center_double": // o_x = 0
                    var width = this.arg1 || 5;
                    var f_x = width / 2 * (o_x - 1);
                    var s_x = width / 2 * (o_x + 1);

                    assert(width > 0, "Width of double barline must be positive");

                    let lpath = new Path(this, `M ${s_x} 0 L ${s_x} ${this.height} M ${f_x} 0 L ${f_x} ${this.height}`);
                    lpath.addClass("barline-double");
                    this.components.push(lpath);

                    break;
                case "dashed":
                    let dashedpath = new Path(this, `M 0 0 L 0 ${this.height}`);
                    dashedpath.addClass("barline-dashed");
                    this.components.push(dashedpath);
                    break;
                case "left_ending":
                    var width = 2 + (this.arg1 || 7);

                    assert(width > 0, "Width of ending barline must be positive");

                    var thickpath = new Path(this, `M 2.5 0 L 2.5 ${this.height}`);
                    thickpath.addClass("barline-ending-thick");
                    var thinpath = new Path(this, `M ${width} 0 L ${width} ${this.height}`);
                    thinpath.addClass("barline-ending-thin");

                    this.components.push(thickpath);
                    this.components.push(thinpath);

                    break;

                case "right_ending":
                    var width = 2 + (this.arg1 || 7);

                    assert(width > 0, "Width of ending barline must be positive");

                    width *= -1;

                    var thickpath = new Path(this, `M -2.5 0 L -2.5 ${this.height}`);
                    thickpath.addClass("barline-ending-thick");
                    var thinpath = new Path(this, `M ${width} 0 L ${width} ${this.height}`);
                    thinpath.addClass("barline-ending-thin");

                    this.components.push(thickpath);
                    this.components.push(thinpath);

                    break;
                case "right_repeat":
                    o_x += 2.5;
                case "center_right_repeat":
                    r_x = -1;
                case "center_left_repeat":
                    o_x -= 2.5;
                case "left_repeat":
                    // Lines
                    var arg1 = (this.arg1 || 7);
                    var width = (2.5 + o_x) + arg1;
                    var thick_x = 2.5 + o_x;

                    assert(width > 0, "Width of ending barline must be positive");

                    width *= r_x;
                    thick_x *= r_x;
                    arg1 *= r_x;

                    var thickpath = new Path(this, `M ${thick_x} 0 L ${thick_x} ${this.height}`);
                    thickpath.addClass("barline-ending-thick");
                    var thinpath = new Path(this, `M ${width} 0 L ${width} ${this.height}`);
                    thinpath.addClass("barline-ending-thin");

                    this.components.push(thickpath);
                    this.components.push(thinpath);

                    // Dots
                    var y_pos = (this.arg2 !== undefined) ? this.arg2 : [2 * DEFAULTS.STAFF_LINE_SEPARATION];
                    var dot_sep = (this.arg3 !== undefined) ? this.arg3 : DEFAULTS.STAFF_LINE_SEPARATION;
                    var x = 2.5 + o_x + 1.8 * arg1;

                    for (let i = 0; i < y_pos.length; i++) {
                        let y = y_pos[i];

                        let dot1 = new Circle(this, x, y - dot_sep / 2);
                        dot1.addClass("barline-repeat-circle");
                        let dot2 = new Circle(this, x, y + dot_sep / 2);
                        dot2.addClass("barline-repeat-circle");

                        this.components.push(dot1);
                        this.components.push(dot2);
                    }

                    break;
            }
        }

        getParams() {
            return {
                barline_type: this.barline_type,
                height: this.height,
                offset_x: this.offset_x,
                arg1: this.arg1,
                arg2: this.arg2,
                arg3: this.arg3
            };
        }

        get minY() {
            return 0;
        }

        get maxY() {
            return this.height;
        }
    }

    // All shapes are from Bravura

    const SHAPES = {
        G_CLEF: {
            path: "M470 943q-50 0 -91.5 -71t-41.5 -181q0 -53 6 -92q3 -17 13 -8q31 27 63 59q111 111 111 211q0 40 -17 61t-43 21zM430 103l49 -285q1 -9 4 -10t12 4q43 22 68.5 59t25.5 83q0 65 -43 111.5t-105 51.5q-9 1 -11 -2t0 -12zM361 262l-21 128q-2 8 -4 9t-10 -5 q-94 -76 -153 -142q-93 -105 -93 -232q0 -105 79 -170.5t209 -65.5q29 0 56 5q12 2 13.5 4t0.5 10l-50 298q-2 8 -5 9.5t-15 -1.5q-46 -13 -73 -44t-27 -73q0 -34 20 -63.5t52 -43.5q15 -6 15 -13q0 -11 -12 -11q-11 0 -27 6q-52 18 -83.5 64.5t-31.5 112.5q0 64 39.5 118 t105.5 76q14 5 15.5 7.5t-0.5 16.5zM376 415l25 -145q2 -14 5.5 -16t23.5 -2q107 0 174 -71t67 -170q0 -83 -45 -145t-123 -93q-1 -1 -4 -2q-10 -4 -10 -8q0 -2 1 -7q29 -163 29 -214q0 -48 -14.5 -85.5t-35.5 -58.5t-49 -34.5t-51.5 -17.5t-46.5 -4q-54 0 -93 16t-59 41.5 t-29 52t-9 53.5q0 48 29 81.5t78 33.5q44 0 70 -29.5t26 -72.5q0 -40 -19.5 -63t-47.5 -31q-32 -10 -32 -17q0 -11 21 -20t59 -9q27 0 50.5 5.5t50.5 21.5t42.5 51.5t15.5 87.5q0 50 -27 201q-1 8 -4 9.5t-11 -0.5q-30 -6 -69 -6q-89 0 -160 28.5t-114.5 76t-66.5 107.5 t-23 127q0 146 112 286q62 76 185 178q8 7 9.5 11t-0.5 13q-14 82 -14 164q0 202 98 311q44 48 65 48q8 0 24 -16t28 -34q65 -95 65 -233q0 -84 -35.5 -169.5t-98.5 -154.5q-27 -30 -56 -57q-8 -8 -6 -19z",
            adv_x: 1099
        },
        F_CLEF: {
            path: "M252 262q129 0 204 -79t75 -211q0 -197 -139 -347q-129 -139 -367 -255q-10 -5 -17 -5q-13 0 -13 12q0 10 15 18q200 115 287 249q84 130 84 319q0 123 -37.5 192t-114.5 69q-70 0 -116 -38.5t-46 -74.5q0 -18 16 -18q5 0 20 3.5t30 3.5q39 0 67.5 -29t28.5 -75 q0 -47 -29.5 -76.5t-76.5 -29.5q-58 0 -90.5 43t-32.5 106q0 38 15.5 76t45 71.5t79.5 54.5t112 21zM630 -71q23 0 38.5 -15.5t15.5 -38.5t-15.5 -38.5t-38.5 -15.5t-38.5 15.5t-15.5 38.5t15.5 38.5t38.5 15.5zM629 180q23 0 39 -16t16 -39t-16 -39t-39 -16t-39 16t-16 39 t16 39t39 16z",
            adv_x: 684
        },
        C_CLEF: {
            path: "M21 503h86q21 0 21 -21v-964q0 -21 -21 -21h-86q-21 0 -21 21v964q0 21 21 21zM230 482v-438q0 -8 9 -6q65 18 89 146q5 25 19 25q13 0 21 -27q12 -42 35.5 -67.5t71.5 -25.5q47 0 65 46t18 149q0 102 -23 146t-83 44q-32 0 -58 -8q-27 -8 -27 -19q0 -5 27 -15 q40 -14 40 -65q0 -32 -19 -50.5t-49 -18.5q-34 0 -55.5 22t-21.5 60q0 52 45 89t129 37q114 0 175 -66t61 -153q0 -105 -55.5 -169.5t-153.5 -64.5q-32 0 -61 9q-19 6 -29 -1q-11 -7 -23.5 -27t-12.5 -34t12.5 -34t23.5 -27q10 -7 29 -1q29 9 61 9q98 0 153.5 -64.5 t55.5 -169.5q0 -87 -61 -153t-175 -66q-84 0 -129 37t-45 89q0 38 21.5 60t55.5 22q30 0 49 -18.5t19 -50.5q0 -51 -40 -65q-27 -10 -27 -15q0 -11 27 -19q26 -8 58 -8q60 0 83 44t23 146q0 103 -18 149t-65 46q-48 0 -71.5 -25.5t-35.5 -67.5q-8 -27 -21 -27q-14 0 -19 25 q-24 128 -89 146q-9 2 -9 -6v-438q0 -21 -21 -21h-1q-21 0 -21 21v964q0 21 21 21h1q21 0 21 -21z",
            adv_x: 699
        },
        G_CLEF_CHANGE: {
            path: "M386 -46v7q-2 41 -27.5 64t-67.5 23q8 -42 16 -102t12 -82q36 15 51.5 35.5t15.5 54.5zM61 -5v-6q1 -40 19.5 -69t47.5 -43t57.5 -20t58.5 -6q28 0 43 6l-34 188q-71 -14 -71 -69v-6q1 -19 13.5 -36.5t23.5 -21.5q10 -6 10 -12t-8 -6q-5 0 -14 3q-24 8 -43.5 31.5 t-26.5 55.5q-4 12 -4 29q0 44 30 81.5t75 50.5l-12 79q-42 -32 -63.5 -49.5t-49.5 -47.5t-40 -62t-12 -70zM303 578q-37 -1 -57 -44.5t-20 -99.5q0 -16 1 -23q0 -2 1 -6.5t2 -12t2 -14.5q57 44 78.5 69.5t27.5 63.5q1 5 1 14q0 53 -36 53zM440 1v-10q0 -55 -30.5 -97.5 t-85.5 -62.5q2 -15 8 -44t9.5 -53t3.5 -46q0 -69 -38 -104t-82 -38q-3 0 -8 -0.5t-7 -0.5q-38 0 -64.5 12t-38.5 31t-17 35.5t-5 33.5q0 23 3 23q4 30 27 51t53 21q15 0 29 -7q39 -16 39 -65v-5q0 -49 -63 -68q-4 -2 -17 -4q-6 -4 -6 -6q0 -3 6 -7q18 -13 55 -13h13 q6 0 12.5 1t21.5 6.5t26 16t19.5 32.5t8.5 52q0 29 -7 66l-13 71q-6 0 -21.5 -1.5t-26.5 -1.5q-43 0 -82 10.5t-74.5 33.5t-59 65.5t-27.5 99.5q-1 7 -1 20q0 45 17 87.5t51 83t62.5 68t74.5 66.5l-8 42q-5 29 -5 66q0 89 29.5 157t76.5 89q3 0 7.5 -2.5t17.5 -18.5t24 -42 q29 -64 29 -125q0 -89 -27.5 -154.5t-92.5 -125.5q15 -79 17 -89q2 1 8 1h7q62 0 104.5 -43t47.5 -107z",
            adv_x: 440
        },
        F_CLEF_CHANGE: {
            path: "M162 170h4q68 -4 122 -48q59 -49 62 -140v-4q0 -53 -28 -117q-36 -85 -107 -156q-46 -46 -105.5 -82.5t-111.5 -36.5q-3 0 -8 3.5t-5 7.5q0 10 13 18q9 5 31.5 16.5t38.5 21t30 20.5q82 63 113 153q23 71 23 146q0 25 -2 37q0 3 -1 7v1q-8 66 -31 93q-23 25 -53 25 q-4 1 -10 1q-56 0 -82 -59q-1 -2 -1 -4q0 -14 16 -14h19q30 0 55 -15t25 -54q0 -30 -25.5 -57t-55.5 -27h-4q-30 0 -54 24t-29 67q-1 3 -1 9q0 56 43 110t119 54zM418 -41q19 0 32 -13t13 -31t-13 -31t-32 -13q-17 0 -30 13t-13 31t13 31t30 13zM418 127q18 0 31 -12.5 t13 -30.5q0 -19 -13 -32t-31 -13q-19 0 -31.5 13t-12.5 32q0 18 12.5 30.5t31.5 12.5z",
            adv_x: 462
        },
        C_CLEF_CHANGE: {
            path: "M102 317v-634q0 -15 -15 -15h-72q-6 0 -10.5 4.5t-4.5 10.5v634q0 6 4.5 10.5t10.5 4.5h72q15 0 15 -15zM395 137v79q0 90 -70 90q-26 0 -43 -17q-2 -1 -2 -3t6 -5l6 -3l8 -6q7 -5 12.5 -9.5t10.5 -12.5t5 -16q0 -19 -17 -34.5t-38 -15.5t-36 18t-15 40q0 29 31 59.5 t94 30.5q69 0 114 -47t45 -107q0 -61 -39 -106.5t-107 -45.5q-19 0 -34.5 9.5t-17.5 9.5q-9 0 -24 -23q0 -1 -1.5 -2t-1.5 -2q-7 -16 -7 -18q0 -3 1.5 -6.5t3.5 -7.5t3 -7q15 -25 26 -25q2 0 17.5 10.5t34.5 10.5q68 0 107 -46t39 -108q0 -59 -45.5 -106t-113.5 -47 q-63 0 -94 31t-31 60q0 21 15 39.5t36 18.5t38 -15.5t17 -34.5q0 -12 -7.5 -21t-18.5 -16t-12 -8t-3.5 -2t-4.5 -2.5t-2 -3.5q0 -1 3 -4q15 -15 42 -15q70 0 70 89v78q0 43 -7.5 57t-38.5 14t-46.5 -13t-23.5 -39q-7 -19 -15 -19q-11 0 -15 19q-8 37 -20 56.5t-20.5 23.5 t-21.5 5v-284q0 -6 -8 -10t-15 -4q-14 0 -14 14v635q0 15 14 15q7 0 15 -4.5t8 -10.5v-283q13 1 21.5 5t20.5 23.5t20 56.5q4 19 15 19q8 0 15 -19q15 -51 70 -51q31 0 38.5 13.5t7.5 55.5z",
            adv_x: 506
        },
        TIME_SIG_0: {
            path: "M450 0q0 -104 -63 -177t-152 -73t-152 73t-63 177t63 177.5t152 73.5t152 -73.5t63 -177.5zM235 220q-31 0 -53 -62t-22 -151q0 -88 22 -150t53 -62t53 62t22 150t-22 150.5t-53 62.5z",
            adv_x: 470
        },
        TIME_SIG_1: {
            path: "M24 13l96 219q8 19 18 19l2 -1h3q22 -3 52 -3q6 0 25.5 2t26.5 2q20 -1 20 -23v-412q0 -12 10.5 -23.5t21.5 -11.5q7 0 10.5 -3.5t4.5 -7.5v-4q0 -16 -16 -16h-213q-22 0 -22 16q0 15 17 15t30.5 11t13.5 27v258q0 14 -6 14q-4 0 -10 -10l-54 -88q-4 -9 -14 -9q-1 0 -9 2 q-11 4 -11 14z",
            adv_x: 334
        },
        TIME_SIG_2: {
            path: "M421 -91q-5 -44 -17 -75.5t-25 -47.5t-32.5 -24.5t-32 -10t-29.5 -1.5q-38 0 -65.5 13.5t-45.5 27t-33 13.5q-26 0 -44 -15t-29.5 -30.5t-19.5 -15.5q-5 0 -8 2q-18 11 -18 31q0 1 0.5 3t0.5 3q25 92 111 147q67 41 113 102q34 45 34 102q0 96 -90 96q-39 0 -58 -12 t-21 -26q0 -7 17 -15.5t34.5 -25t17.5 -42.5q0 -17 -4 -34.5t-21 -35.5t-45 -18q-26 0 -48 15.5t-34 39.5q-9 23 -9 43q0 38 28 73q38 45 94 56q30 7 87 7q16 0 38 -3t56 -14.5t57 -31.5q46 -39 46 -103q0 -58 -43 -92q-27 -22 -90 -39q-29 -8 -72 -28.5t-57 -43.5 q16 6 37 6q48 0 108 -24q4 -2 8.5 -3.5l10.5 -3.5t11 -4q11 -3 17 -3q14 0 22 10t17 33l1 1v2q3 10 13 10q12 0 12 -14z",
            adv_x: 446
        },
        TIME_SIG_3: {
            path: "M213 248q20 -1 44.5 -7.5t54 -19.5t49 -38t19.5 -57q0 -39 -22 -64q-12 -15 -39 -27q-2 -1 -31 -9q-4 -1 -4 -9q0 -3 1 -5q2 -3 10 -5l33 -9l21 -12q15 -9 24 -21q13 -15 19 -29q7 -16 9 -41v-7q0 -63 -61 -101t-140 -38h-9q-168 3 -171 110q0 42 22 61q19 21 48 26 q4 1 11 1q21 0 40 -11.5t27 -29.5q5 -12 5 -31q-1 -15 -12 -35.5t-11 -30.5v-5q1 -13 28 -16h4q3 -1 5 -1q11 0 21.5 4t24 15t22 36.5t8.5 62.5q0 9 -4 20.5t-14.5 29t-38 29.5t-67.5 12q-25 0 -25 12q0 15 24 17q53 3 87.5 28.5t34.5 77.5v7q0 12 -3 22.5t-11.5 24.5 t-28.5 22t-50 8q-10 0 -25.5 -7t-16.5 -18v-4q0 -6 3.5 -9t9.5 -4l7 -1l3 -1q4 -1 7 -2t7 -4t7 -7t5.5 -11t3.5 -16v-8q0 -27 -17.5 -46t-48.5 -19h-5q-42 3 -61.5 27t-19.5 54q0 40 54 75t118 35q2 0 7 -0.5t8 -0.5z",
            adv_x: 421
        },
        TIME_SIG_4: {
            path: "M362 -74h73q15 0 15 -19t-15 -19h-73v-59q0 -21 10 -29.5t21 -8.5q22 0 22 -20q0 -21 -20 -21h-213q-19 0 -19 21q0 19 23 19q40 0 40 35v63h-186q-20 0 -20 17q0 5 3 11l1 1v2l6 8q128 179 128 305q0 19 23 19q3 0 32 -1t39 -1t37.5 1t30.5 1q15 0 15 -14 q0 -1 -0.5 -2.5t-0.5 -2.5q-2 -7 -44.5 -67t-102.5 -134t-96 -105h135v84q0 12 9 23l95 115q8 9 20 9t12 -17v-214z",
            adv_x: 470
        },
        TIME_SIG_5: {
            path: "M76 59v-4q0 -7 4 -7q3 0 5 1q49 29 133 29q68 0 116.5 -48.5t48.5 -116.5q0 -70 -49.5 -117t-136.5 -47q-91 0 -134 30.5t-43 93.5q0 12 1 18q3 30 22.5 52t56.5 22q32 0 55 -22.5t23 -55.5q0 -44 -38 -67q-12 -7 -12 -14q1 -7 12 -14q7 -3 23 -3q12 0 24.5 4.5t27.5 16 t24 38t9 65.5q0 73 -33 101.5t-70 28.5q-35 0 -68 -33q-3 -3 -6.5 -7.5t-5 -7t-4 -4t-6.5 -1.5q-20 0 -20 15v2l11 222q2 17 24 17q85 -10 135 -10q18 0 68.5 4.5t54.5 4.5q14 0 14 -21q0 -11 -3.5 -22.5t-15.5 -30.5t-44.5 -31t-80.5 -12q-53 0 -98 9h-4q-13 0 -15 -13z ",
            adv_x: 403
        },
        TIME_SIG_6: {
            path: "M260 100l-4 4q-15 17 -15 41q0 16 7 29q2 3 13.5 16.5t11.5 21.5q0 15 -33 15q-80 0 -83 -190q0 -24 9 -24q4 0 6 2q40 35 91 35q47 0 89 -31q62 -47 62 -114q0 -72 -58 -118q-45 -36 -131 -36q-48 0 -80 14q-54 24 -94 96q-29 53 -31 138v4q0 68 39 142q26 50 75.5 77.5 t107.5 28.5q48 0 79 -13q24 -9 41.5 -27t21.5 -41q1 -4 1 -11q0 -24 -16 -45t-39 -27q-16 -4 -25 -4q-28 0 -45 17zM222 2q-24 0 -41 -33t-17 -79t17 -79t41 -33t41.5 33t17.5 79t-17.5 79t-41.5 33z",
            adv_x: 434
        },
        TIME_SIG_7: {
            path: "M421 204v-4q0 -41 -29.5 -110t-59.5 -150.5t-30 -152.5q0 -37 -16 -37q-3 0 -35.5 4.5t-46.5 4.5q-13 0 -35 -4.5t-30 -4.5q-13 0 -16 6.5t-3 24.5q0 28 19.5 67.5t49.5 73.5q23 27 60 63t57 58t20 34q-2 9 -7 9q-3 0 -9 -4q-28 -21 -50 -21q-31 0 -79.5 37.5t-66.5 37.5 q-13 0 -23 -5.5t-17.5 -17.5t-11.5 -19.5t-9.5 -23t-6.5 -17.5q-7 -20 -15 -20q-4 0 -7 4t-4 8v4v165q0 12 10 12q8 0 12 -7q4 -8 12 -16t14 -8q9 1 27 18l7 7t9 8.5t11 7.5t15 7t19 4t26 2q36 0 69 -21.5t55 -42.5t31 -21q11 0 20.5 13.5t17 33.5t8.5 22q2 3 7 6t9 4t5 1 q12 0 14.5 -8.5t2.5 -31.5z",
            adv_x: 441
        },
        TIME_SIG_8: {
            path: "M334 36q82 -42 82 -117q0 -93 -60.5 -135.5t-146.5 -42.5q-80 0 -134.5 32.5t-54.5 94.5q0 77 92 121q-87 49 -87 133q0 63 53.5 100t141.5 37q16 0 39.5 -4.5t56.5 -15.5t55.5 -36.5t22.5 -60.5q0 -68 -60 -106zM205 -226q48 0 73 21t25 53q0 14 -4 25.5t-13 21.5 t-17 17t-25 15.5t-26.5 13t-31 13.5t-30.5 13q-34 -13 -56.5 -39t-22.5 -55q0 -47 37.5 -73t90.5 -26zM282 59q53 31 53 85q0 32 -24 53t-48 27t-45 6q-37 0 -69 -17t-32 -46q0 -13 4.5 -24t14.5 -20t20 -16t28 -14t30 -11t34 -11.5t34 -11.5z",
            adv_x: 436
        },
        TIME_SIG_9: {
            path: "M174 -98l4 -4q15 -16 15 -41q0 -16 -7 -29q-2 -3 -13.5 -16.5t-11.5 -21.5q0 -15 33 -15q80 0 83 190q0 24 -9 24q-4 0 -6 -2q-40 -35 -91 -35q-47 0 -89 31q-62 47 -62 114q0 72 58 118q45 36 131 36q48 0 80 -14q54 -24 94 -96q29 -53 31 -138v-4q0 -68 -39 -142 q-26 -50 -75.5 -77.5t-107.5 -28.5q-48 0 -79 13q-24 9 -41.5 27t-21.5 41q-1 4 -1 11q0 24 16 45t39 27q16 4 25 4q28 0 45 -17zM212 0q24 0 41 33t17 79t-17 79t-41 33t-41.5 -33t-17.5 -79t17.5 -79t41.5 -33z",
            adv_x: 434
        },
        COMMON_TIME: {
            path: "M233 251q10 0 25.5 -2t42 -11t48.5 -23t38 -42t16 -65t-19 -58.5t-38 -24.5l-19 -3q-27 0 -52 18.5t-25 56.5q0 26 17.5 50t45.5 24q18 0 18 22q0 6 -7 13.5t-24.5 14t-41.5 6.5q-23 0 -43.5 -8.5t-41 -28.5t-33 -61.5t-12.5 -100.5q0 -244 124 -244q15 0 36 7.5 t46.5 23.5t42.5 49.5t17 78.5q0 8 2.5 12t5 5t7.5 1q15 0 15 -22q0 -12 -4 -31t-17 -47.5t-33.5 -52t-59 -40.5t-87.5 -17q-98 0 -153 67q-57 69 -64 145q-1 9 -1 27q0 76 36 144.5t100 96.5q45 20 92 20z",
            adv_x: 424
        },
        CUT_TIME: {
            path: "M175 -163v329q0 6 -3.5 11t-7.5 5q-2 0 -3 -2q-38 -54 -38 -154q0 -140 41 -198q2 -3 5 -3q6 0 6 12zM398 -40h4q15 0 16 -19q0 -13 -4 -32t-17 -47.5t-33 -51.5t-57.5 -40.5t-85.5 -18.5q-11 -5 -11 -14v-79q0 -17 -18 -17q-6 0 -11.5 5t-5.5 12v77q0 6 -6.5 14.5 t-12.5 10.5q-53 14 -90 58q-58 68 -65 144q-1 9 -1 28q0 76 36 144t100 96l27 10q2 0 7 5.5t5 10.5v25v63q0 6 5.5 11.5t11.5 5.5q8 0 13 -5.5t5 -11.5v-73q0 -5 3.5 -13.5t7.5 -9.5h5l1 1q14 0 36 -4.5t55 -17t56 -44t23 -76.5q0 -37 -19 -58.5t-38 -24.5l-19 -3 q-27 0 -52 18t-25 56q0 26 17.5 50t45.5 24q18 0 18 22q0 6 -7 13.5t-25 14t-41 6.5q-11 0 -17 -1q-5 -1 -15 -10.5t-10 -14.5v-396q0 -13 10 -15q12 -3 26 -3q11 0 27 4t36.5 15t37.5 28t29 46t12 65q0 17 10 17z",
            adv_x: 417
        },
        TIME_SIG_ADD: {
            path: "M300 37h185q14 0 14 -14v-46q0 -15 -14 -15h-184q-14 0 -14 -16v-182q0 -14 -15 -14h-46q-14 0 -14 14v184q0 5 -4 9.5t-11 4.5h-184q-14 0 -14 15v46q0 14 14 14h184q5 0 10 6t5 12v181q0 14 14 14h46q15 0 15 -14v-181q0 -18 13 -18z",
            adv_x: 500
        },
        TIME_SIG_NUM_ADD: {
            path: "M153 14h94q7 0 7 -7v-24q0 -7 -7 -7h-93q-8 0 -8 -9v-92q0 -7 -7 -7h-24q-7 0 -7 7v93q0 8 -8 8h-93q-8 0 -8 7v24q0 7 8 7h93q8 0 8 9v92q0 7 7 7h24q7 0 7 -7v-92q0 -9 7 -9z",
            adv_x: 254
        },
        NOTEHEAD_DOUBLE_WHOLE: {
            path: "M9 155h13q9 0 9 -8v-295q0 -7 -9 -7h-13q-9 0 -9 7v295q0 8 9 8zM67 155h12q10 0 10 -8v-295q0 -7 -10 -7h-12q-10 0 -10 7v295q0 8 10 8zM399 -49q2 10 2 18q0 47 -37 90t-86 43q-66 0 -79 -39q-2 -7 -2 -23q0 -47 33 -89q14 -16 21 -22q20 -17 48 -27q9 -3 27 -3 q20 0 29 3q36 10 44 49zM304 125q74 0 139.5 -36.5t65.5 -87.5q0 -126 -215 -126q-104 0 -154 36t-50 90q0 53 58.5 88.5t155.5 35.5zM519 155h13q10 0 10 -8v-295q0 -7 -10 -7h-13q-10 0 -10 7v295q0 8 10 8zM576 155h13q10 0 10 -8v-295q0 -7 -10 -7h-13q-10 0 -10 7v295 q0 8 10 8z",
            adv_x: 599
        },
        NOTEHEAD_WHOLE: {
            path: "M216 125q74 0 140 -36t66 -87q0 -127 -216 -127q-105 0 -155.5 36t-50.5 91q0 52 59.5 87.5t156.5 35.5zM111 63q-3 -12 -3 -24q0 -49 35 -89q8 -11 21 -22q22 -19 47 -26q12 -4 26 -4q18 0 31 4q36 9 44 48q2 12 2 19q0 48 -37 91t-87 43q-66 0 -79 -40z",
            adv_x: 422
        },
        NOTEHEAD_HALF: {
            path: "M97 -125q-43 0 -70 22t-27 61q0 22 10.5 48.5t31.5 54t61.5 46t92.5 18.5q44 0 71.5 -22.5t27.5 -60.5q0 -17 -8.5 -41t-28 -54t-62 -51t-99.5 -21zM173 -46q51 33 71 53.5t20 36.5q0 7 -6 19q-12 21 -37 21q-34 0 -101 -39q-91 -53 -91 -89q0 -8 6 -20q13 -23 40 -23 q37 0 98 41z",
            adv_x: 295
        },
        NOTEHEAD_NORMAL: {
            path: "M97 -125q-42 0 -69.5 22.5t-27.5 60.5q0 66 58.5 116.5t139.5 50.5q43 0 70 -22.5t27 -60.5q0 -62 -64.5 -114.5t-133.5 -52.5z",
            adv_x: 295
        },
        TREMELO_1: {path: "M150 -31l-300 -62v125l300 62v-125z", adv_x: 150},
        TREMELO_2: {path: "M149 62l-300 -62v125l300 62v-125zM149 1v-125l-300 -63v125z", adv_x: 149},
        TREMELO_3: {
            path: "M150 153l-300 -63v125l300 63v-125zM150 91v-125l-300 -62v125zM150 -93v-125l-300 -62v125z",
            adv_x: 150
        },
        TREMELO_4: {
            path: "M150 63l-300 -63v125l300 63v-125zM150 1v-125l-300 -62v125zM150 -183v-125l-300 -62v125zM150 249l-300 -62v125l300 62v-125z",
            adv_x: 149
        },
        TREMELO_5: {
            path: "M150 -27l-300 -63v125l300 63v-125zM150 -89v-125l-300 -62v125zM150 -273v-125l-300 -62v125zM149 345l-300 -62v125l300 62v-125zM149 284v-125l-300 -63v125z",
            adv_x: 149
        },
        FLAG_UP_1: {
            path: "M238 -790q-3 -12 -13 -17t-15 -2q-16 11 -16 29q0 6 3 15q24 64 24 137q0 96 -24 150q-31 72 -91 148.5t-106 84.5v239q0 15 10 15q26 0 30 -22q21 -124 109 -261q115 -183 115 -343q0 -35 -6.5 -78t-13.5 -69z",
            adv_x: 264
        },
        FLAG_UP_2: {
            path: "M272 -796q-8 -17 -20 -17q-2 0 -8 2q-14 4 -14 24q0 5 1 9q8 48 8 89q0 82 -32 149q-20 40 -42.5 68.5t-40 42.5t-42 21.5t-38.5 9t-39 2.5h-5v397q11 1 17 1q18 0 20 -13q6 -37 20.5 -65.5t28.5 -42t39 -35.5t39 -37q61 -66 81 -96.5t27 -77.5q3 -18 3 -36q0 -27 -6 -58 t-11 -47.5t-8 -21.5q-1 -3 -1 -7q0 -2 0.5 -5t0.5 -4q29 -60 29 -120v-22q0 -101 -7 -110zM209 -459q3 -4 7 -4q11 0 13 6q1 1 7 26q1 7 1 20q0 50 -27 89q-71 105 -148 105h-8q-6 0 -10 -3.5t-4 -6.5q0 -2 1 -3q10 -37 25 -61t47.5 -56t41.5 -43q37 -42 54 -69z",
            adv_x: 279
        },
        FLAG_UP_3: {
            path: "M260 -673q0 -4 0.5 -13.5t0.5 -14.5q0 -81 -7 -95q-10 -16 -20 -16q-2 0 -6 2q-13 6 -13 24q0 1 0.5 3t0.5 4q8 46 8 85q0 75 -31 137q-23 46 -47 75t-51 40.5t-43.5 14.5t-46.5 4h-5v560q6 12 12 12q5 0 12 -6.5t8 -12.5q6 -35 20 -61.5t27.5 -40t37 -34t36.5 -34.5 q55 -60 74 -89t27 -72q2 -9 2 -28q0 -48 -20 -106q13 -27 18 -58q3 -18 3 -35q0 -13 -1.5 -28t-4 -26.5t-5.5 -23.5t-5 -19.5t-4.5 -14t-2.5 -7.5q-1 -2 -1 -6q0 -5 1 -7q23 -55 26 -113zM208 -181q-69 117 -169 117q6 -34 19 -60t25 -39t35 -34t35 -35q44 -48 55 -62 q10 34 12 44l3 21q0 21 -15 48zM219 -456q2 16 2 24q0 43 -25 80q-65 97 -145 97q-4 -1 -8.5 -6.5t-4.5 -6.5q9 -35 24 -58t43.5 -50.5t39.5 -40.5l5 -5q29 -34 46 -59q1 -4 7 -4q9 0 11 6q2 4 3 12.5t2 10.5z",
            adv_x: 262
        },
        FLAG_UP_4: {
            path: "M260 -673q0 -4 0.5 -13.5t0.5 -14.5q0 -81 -7 -95q-10 -16 -20 -16q-2 0 -6 2q-13 6 -13 24q0 1 0.5 3t0.5 4q8 46 8 85q0 75 -31 137q-23 46 -47 75t-51 40.5t-43.5 14.5t-46.5 4h-5v758q6 12 12 12q5 0 12 -6.5t8 -12.5q6 -35 20 -61.5t27.5 -40t37 -34t36.5 -34.5 q55 -60 74 -89t27 -72q2 -18 2 -27q0 -50 -22 -111q14 -25 20 -60q2 -9 2 -28q0 -48 -20 -106q13 -27 18 -58q3 -18 3 -35q0 -13 -1.5 -28t-4 -26.5t-5.5 -23.5t-5 -19.5t-4.5 -14t-2.5 -7.5q-1 -2 -1 -6q0 -5 1 -7q23 -55 26 -113zM208 17q-70 117 -169 117q1 -1 1 -4 q6 -35 19 -62t24 -39.5t34.5 -34t35.5 -34.5q36 -39 54 -61l13 49q0 2 1 6t1.5 7.5t0.5 7.5q0 21 -15 48zM208 -181q-69 117 -169 117q6 -34 19 -60t25 -39t35 -34t35 -35q44 -48 55 -62q10 34 12 44l3 21q0 21 -15 48zM219 -456q2 16 2 24q0 43 -25 80q-65 97 -145 97 q-4 -1 -8.5 -6.5t-4.5 -6.5q9 -35 24 -58t43.5 -50.5t39.5 -40.5l5 -5q29 -34 46 -59q1 -4 7 -4q9 0 11 6q2 4 3 12.5t2 10.5z",
            adv_x: 262
        },
        FLAG_UP_5: {
            path: "M260 -673q0 -4 0.5 -13.5t0.5 -14.5q0 -81 -7 -95q-10 -16 -20 -16q-2 0 -6 2q-13 6 -13 24q0 1 0.5 3t0.5 4q8 46 8 85q0 75 -31 137q-23 46 -47 75t-51 40.5t-43.5 14.5t-46.5 4h-5v944q6 12 12 12q5 0 12 -6.5t8 -12.5q6 -35 20 -61.5t27.5 -40t37 -34t36.5 -34.5 q55 -60 74 -89t27 -72q2 -9 2 -29q0 -49 -19 -102q11 -23 17 -55q2 -18 2 -27q0 -50 -22 -111q14 -25 20 -60q2 -9 2 -28q0 -48 -20 -106q13 -27 18 -58q3 -18 3 -35q0 -13 -1.5 -28t-4 -26.5t-5.5 -23.5t-5 -19.5t-4.5 -14t-2.5 -7.5q-1 -2 -1 -6q0 -5 1 -7q23 -55 26 -113 zM208 203q-69 117 -170 117q8 -42 23 -67t48 -54t44 -41q40 -43 56 -64q7 23 11 40l3 21q0 21 -15 48zM208 17q-70 117 -170 117q1 -1 1 -4q6 -35 19 -62t24.5 -39.5t35 -34t35.5 -34.5q36 -39 54 -61l13 49q0 2 1 6t1.5 7.5t0.5 7.5q0 21 -15 48zM208 -181 q-69 117 -169 117q6 -34 19 -60t25 -39t35 -34t35 -35q44 -48 55 -62q10 34 12 44l3 21q0 21 -15 48zM219 -456q2 16 2 24q0 43 -25 80q-65 97 -145 97q-4 -1 -8.5 -6.5t-4.5 -6.5q9 -35 24 -58t43.5 -50.5t39.5 -40.5l5 -5q29 -34 46 -59q1 -4 7 -4q9 0 11 6q2 4 3 12.5 t2 10.5z",
            adv_x: 259
        },
        FLAG_UP_6: {
            path: "M263 -670q0 -4 0.5 -13.5t0.5 -14.5q0 -87 -8 -97q-8 -17 -19 -17q-4 0 -8 2q-13 4 -13 23q0 5 1 8q8 48 8 86q0 75 -30 138q-19 39 -40 65.5t-38 40.5t-40.5 21.5t-36.5 8.5t-36 2h-4v1112q0 4 6.5 6.5t8.5 2.5q5 0 7.5 -0.5t5.5 -5t3 -12.5q6 -34 20.5 -62t27 -42 t39 -38.5t37.5 -36.5l18 -19q46 -50 64 -77t24 -64q2 -10 2 -31q0 -53 -18 -107q11 -21 16 -49q2 -10 2 -31q0 -53 -18 -107q11 -21 16 -49q2 -10 2 -31q0 -53 -18 -107q11 -21 16 -49q3 -15 3 -32q0 -45 -17 -102q6 -18 9 -40q3 -18 3 -36q0 -40 -23 -120q-1 -1 -1 -5 q0 -2 1 -5v-3q24 -55 27 -113zM155 -224q42 -46 58 -67q1 4 8 27q3 10 3 22q0 22 -15 47q-69 116 -170 118q9 -36 25 -58.5t47 -49t44 -39.5zM155 -54l55 -61q1 5 4 13.5t4.5 14.5l2.5 10q3 11 3 22q0 23 -15 48q-69 117 -170 117q9 -39 24 -63.5t49.5 -58t42.5 -42.5z M155 133l55 -61q1 5 4 13.5t4.5 14.5l2.5 10q3 10 3 22q0 20 -15 46q-69 119 -170 119q9 -39 24 -63.5t49.5 -58t42.5 -42.5zM208 365q-68 119 -169 119q9 -39 24 -63.5t49.5 -58t42.5 -42.5l55 -61q1 5 4 13.5t4.5 14.5l2.5 10q3 10 3 22q0 21 -16 46zM221 -450q2 14 2 21 q0 42 -27 83q-25 39 -62 68t-77 29h-6q-12 0 -12 -13q8 -35 22 -57t45.5 -53t40.5 -41q30 -33 49 -65q3 -4 8 -4q9 0 11 7q1 2 6 25z",
            adv_x: 268
        },
        FLAG_UP_7: {
            path: "M264 -670q0 -4 0.5 -13.5t0.5 -14.5q0 -87 -8 -97q-9 -17 -19 -17q-4 0 -8 2q-13 4 -13 23q0 5 1 8q8 46 8 86q0 76 -31 138q-19 39 -40 65.5t-38 40.5t-40.5 21.5t-36.5 8.5t-36 2h-5v191l1 183v925q0 4 6.5 6.5t8.5 2.5q5 0 7.5 -0.5t5.5 -5t3 -12.5q8 -44 24.5 -72 t53 -61.5t46.5 -45.5l16 -17q48 -51 66.5 -78.5t24.5 -65.5q2 -18 2 -28q0 -46 -18 -109q10 -21 16 -50q2 -18 2 -28q0 -46 -18 -109q10 -21 16 -50q2 -18 2 -28q0 -46 -18 -109q10 -21 16 -49q2 -18 2 -28q0 -47 -18 -110q10 -21 16 -49q2 -18 2 -29q0 -45 -17 -105 q5 -15 10 -40q3 -18 3 -36q0 -40 -23 -120q-1 -1 -1 -5v-5l1 -3q24 -55 27 -113zM155 -224q41 -45 59 -67l8 27q3 10 3 22q0 20 -16 47q-69 116 -170 118q9 -36 25 -59t47 -48.5t44 -39.5zM155 -54q47 -51 55 -61q3 8 7 21.5t5 16.5q3 11 3 22q0 22 -15 47q-70 118 -171 118 q9 -39 24.5 -64t49 -57t42.5 -43zM155 133q47 -51 55 -61q3 8 7 21.5t5 16.5q3 10 3 22q0 21 -15 46q-71 119 -171 119q9 -39 24.5 -64t49 -57t42.5 -43zM155 320q47 -51 55 -61q3 8 7 21.5t5 16.5q3 10 3 22q0 21 -15 46q-71 119 -171 119q9 -39 24.5 -64t49 -57t42.5 -43z M209 552q-70 119 -170 119q9 -39 24.5 -64t49 -57t42.5 -43q47 -51 55 -61q3 8 7 21.5t5 16.5q3 10 3 21q0 20 -16 47zM222 -450q2 14 2 21q0 42 -27 82q-26 40 -63 69t-77 29h-6q-12 0 -12 -13q6 -27 18.5 -49.5t24 -35t33 -33t32.5 -33.5q33 -36 50 -65q3 -4 8 -4 q9 0 11 7q1 2 6 25z",
            adv_x: 268
        },
        FLAG_UP_8: {
            path: "M264 -670q0 -4 0.5 -13.5t0.5 -14.5q0 -87 -8 -97q-9 -17 -19 -17q-4 0 -8 2q-13 4 -13 23q0 5 1 8q8 46 8 86q0 76 -31 138q-19 39 -40 65.5t-38 40.5t-40.5 21.5t-36 8.5t-35.5 2h-5v1487q0 4 6.5 6.5t9.5 2.5q5 0 7.5 -0.5t5.5 -5t3 -12.5q8 -44 24 -72t53 -63t46 -45 l15 -16q34 -37 48.5 -54t27 -40t16.5 -50q2 -18 2 -28q0 -47 -18 -110q12 -22 16 -50q2 -18 2 -28q0 -46 -18 -109q12 -22 16 -50q2 -18 2 -28q0 -46 -18 -109q12 -22 16 -50q2 -18 2 -28q0 -46 -18 -109q11 -21 16 -49q2 -18 2 -28q0 -47 -18 -110q11 -21 16 -49 q2 -18 2 -29q0 -45 -17 -105q8 -23 10 -40q3 -18 3 -36q0 -40 -23 -120q-1 -1 -1 -5v-5l1 -3q24 -55 27 -113zM155 -224q41 -45 59 -67l8 27q3 10 3 22q0 22 -15 47q-69 116 -171 118q9 -36 25.5 -59t47 -48.5t43.5 -39.5zM155 -54q34 -35 55 -61q3 8 7 21.5t5 16.5 q3 11 3 22q0 22 -15 47q-70 118 -171 118q9 -39 24.5 -64t49 -57t42.5 -43zM155 133q27 -29 56 -61l11 38q3 10 3 22q0 22 -15 47q-70 118 -171 118q9 -39 24.5 -64t49 -57t42.5 -43zM155 320q34 -35 55 -61q3 8 7 21.5t5 16.5q3 10 3 22q0 21 -15 46q-71 119 -171 119 q9 -39 24.5 -64t49 -57t42.5 -43zM155 507q27 -29 56 -61l11 38q3 10 3 22q0 21 -15 46q-71 119 -171 119q9 -39 24.5 -64t49 -57t42.5 -43zM209 740q-69 118 -170 118q9 -39 24.5 -64t49 -57t42.5 -43q47 -51 55 -61q3 8 7 21.5t5 16.5q3 11 3 22q0 20 -16 47zM222 -450 q2 14 2 21q0 42 -27 82q-26 40 -63 69t-77 29h-6q-11 0 -11 -13q8 -35 21.5 -57.5t45 -53t40.5 -40.5q33 -36 50 -65q3 -4 8 -4q9 0 11 7q1 2 6 25z",
            adv_x: 272
        },
        FLAG_DOWN_1: {
            path: "M240 760q-11 31 10 45q17 11 26 -6l2 -6q28 -112 28 -181q0 -148 -124 -343q-11 -16 -40 -58.5t-45 -67.5t-33.5 -63.5t-23.5 -71.5q-3 -22 -29 -22q-11 0 -11 15v235q91 31 139.5 82.5t81.5 127.5q14 31 27 84t13 93q0 74 -21 137z",
            adv_x: 306
        },
        FLAG_DOWN_2: {
            path: "M240 786q-4 24 17 26q8 0 11 -0.5t7 -5.5t6 -16q30 -148 -21 -253q0 -1 -0.5 -4t-0.5 -5q0 -5 1 -7q3 -5 8 -21.5t11 -47.5t6 -58q0 -20 -3 -36q-7 -43 -32.5 -81.5t-58 -67.5t-64.5 -58t-57.5 -67t-32.5 -80q-2 -13 -20 -13l-17 1v396h5q25 1 40 2.5t41 9.5t45 22 t42.5 42.5t43.5 68.5q50 102 23 253zM226 456q-4 0 -7 -4q-19 -30 -54 -69q-14 -17 -45.5 -44.5t-50.5 -53t-28 -62.5q-1 -1 -1 -3q0 -10 14 -10h8q42 0 86 32t72 73q27 39 27 89q0 13 -1 20q-6 23 -7 25q-2 7 -13 7z",
            adv_x: 292
        },
        FLAG_DOWN_3: {
            path: "M273 676v-11q-4 -66 -22 -100l-4 -7q-3 -4 -3 -7q0 -1 1.5 -4t1.5 -5q20 -50 20 -105q0 -19 -3 -39q-6 -37 -20 -62q22 -66 22 -114q0 -20 -2 -29q-8 -45 -28 -75.5t-77 -92.5q-12 -13 -48 -43.5t-53 -58.5t-25 -75q-1 -7 -8.5 -13.5t-12.5 -6.5q-3 0 -6 3t-4 7l-2 3v589 q31 1 48 4t45 15t54.5 42.5t53.5 78.5q31 55 31 98q0 15 -3 31.5t-8.5 39.5t-8.5 39q0 2 -0.5 4t-0.5 3q0 20 14 26q2 1 6 1q12 0 21 -16q5 -8 13 -47.5t8 -72.5zM39 268q0 -13 13 -13h5q43 0 81 29.5t65 71.5q27 40 27 84q0 9 -2 25q-1 2 -2 10.5t-3 12.5q-2 6 -12 6 q-5 0 -8 -4q-17 -27 -52 -67q-11 -13 -41 -42t-46 -53t-25 -60zM229 243q-13 49 -14 51q-16 -21 -56 -64q-13 -14 -37 -36t-37 -35.5t-26.5 -41t-19.5 -64.5q0 -2 2 -3q103 0 175 122q16 28 16 50z",
            adv_x: 274
        },
        FLAG_DOWN_4: {
            path: "M273 676v-11q-4 -66 -22 -100l-4 -7q-3 -4 -3 -7q0 -1 1.5 -4t1.5 -5q20 -50 20 -105q0 -19 -3 -39q-6 -37 -20 -62q22 -66 22 -114q0 -20 -2 -29q-6 -35 -20 -62q23 -60 23 -112q0 -15 -3 -30q-8 -45 -28 -75.5t-77 -92.5q-12 -13 -48 -43.5t-53 -58.5t-25 -75 q-1 -7 -8.5 -13.5t-12.5 -6.5q-3 0 -6 3t-4 7l-2 3v793q31 1 48 4t45 15t54.5 42.5t53.5 78.5q31 55 31 98q0 15 -3 31.5t-8.5 39.5t-8.5 39q0 2 -0.5 4t-0.5 3q0 20 14 26q2 1 6 1q12 0 21 -16q5 -8 13 -47.5t8 -72.5zM39 268q0 -13 13 -13h5q43 0 81 29.5t65 71.5 q27 40 27 84q0 9 -2 25q-1 2 -2 10.5t-3 12.5q-2 6 -12 6q-5 0 -8 -4q-17 -27 -52 -67q-11 -13 -41 -42t-46 -53t-25 -60zM229 39l-13 50q-19 -23 -57 -64q-13 -15 -40 -40.5t-38.5 -38.5t-24 -40t-17.5 -60q105 0 177 122q16 28 16 50zM229 243q-13 49 -14 51 q-16 -21 -56 -64q-13 -14 -37 -36t-37 -35.5t-26.5 -41t-19.5 -64.5q0 -2 2 -3q103 0 175 122q16 28 16 50z",
            adv_x: 275
        },
        FLAG_DOWN_5: {
            path: "M273 676v-11q-4 -66 -22 -100l-4 -7q-3 -4 -3 -7q0 -1 1.5 -4t1.5 -5q20 -50 20 -105q0 -19 -3 -39q-6 -37 -20 -62q22 -66 22 -114q0 -20 -2 -29q-6 -35 -20 -62q23 -60 23 -112q0 -15 -3 -30q-6 -35 -20 -62q23 -60 23 -112q0 -15 -3 -30q-8 -45 -28 -75.5t-77 -92.5 q-12 -13 -48 -43.5t-53 -58.5t-25 -75q-1 -7 -8.5 -13.5t-12.5 -6.5q-3 0 -6 3t-4 7l-2 3v997q31 1 48 4t45 15t54.5 42.5t53.5 78.5q31 55 31 98q0 15 -3 31.5t-8.5 39.5t-8.5 39q0 2 -0.5 4t-0.5 3q0 20 14 26q2 1 6 1q12 0 21 -16q5 -8 13 -47.5t8 -72.5zM39 268 q0 -13 13 -13h5q43 0 81 29.5t65 71.5q27 40 27 84q0 9 -2 25q-1 2 -2 10.5t-3 12.5q-2 6 -12 6q-5 0 -8 -4q-17 -27 -52 -67q-11 -13 -41 -42t-46 -53t-25 -60zM229 -165l-13 50q-19 -23 -57 -64q-13 -15 -40 -40.5t-38.5 -38.5t-24 -40t-17.5 -60q105 0 177 122 q16 28 16 50zM229 39l-13 50q-19 -23 -57 -64q-13 -15 -40 -40.5t-38.5 -38.5t-24 -40t-17.5 -60q105 0 177 122q16 28 16 50zM229 243q-13 49 -14 51q-16 -21 -56 -64q-13 -14 -37 -36t-37 -35.5t-26.5 -41t-19.5 -64.5q0 -2 2 -3q103 0 175 122q16 28 16 50z",
            adv_x: 275
        },
        FLAG_DOWN_6: {
            path: "M282 168q17 -60 17 -103q0 -17 -3 -34q-4 -25 -14 -50q17 -60 17 -103q0 -18 -3 -34q-4 -25 -14 -50q17 -60 17 -103q0 -17 -3 -34q-8 -50 -30.5 -83.5t-87.5 -104.5q-15 -16 -43 -40t-43.5 -39.5t-31.5 -47t-22 -72.5q-2 -7 -10.5 -14t-13.5 -7q-3 0 -6.5 3.5t-5.5 7.5 l-2 3v1162q25 1 38 2.5t37 9.5t41 22t40 41.5t46 67.5q31 55 31 100q0 15 -3 31.5t-8.5 39.5t-8.5 39q-1 3 -1 9q0 19 14 25q1 0 2.5 0.5t2.5 0.5q14 0 22 -16q5 -8 13 -48.5t8 -73.5v-11q-3 -46 -7.5 -63.5t-16.5 -39.5l-3 -6q-2 -6 -2 -7q0 -4 2 -8q21 -64 21 -142v-1 q1 -1 1 -2t0.5 -2t0.5 -2q29 -76 29 -138q0 -18 -3 -35q-4 -25 -14 -50zM256 87q0 6 -4 28q-24 -32 -74 -85q-16 -18 -50 -44.5t-56 -52t-33 -62.5q125 4 202 137q16 28 16 54q0 5 -0.5 13t-0.5 12zM245 330q-17 -31 -85 -106q-13 -14 -37 -34.5t-37.5 -34t-27.5 -39 t-20 -58.5q124 0 203 137q16 28 16 54q0 5 -0.5 13t-0.5 12q0 14 -10 52v2zM151 419q-12 -13 -34 -34.5t-33.5 -34t-25 -36t-21.5 -51.5q0 -4 4 -8.5t11 -4.5h8q75 0 144 102q27 40 27 82q0 14 -3 28q0 7 -4 23q-2 6 -12 6q-5 0 -8 -4q-15 -22 -53 -68zM256 -286q0 5 -4 27 q-18 -23 -74 -85q-16 -18 -50 -44.5t-56 -52t-33 -62.5q124 4 202 137q16 28 16 55q0 5 -0.5 13t-0.5 12zM256 -100q0 6 -4 28q-24 -32 -74 -85q-16 -18 -50 -44.5t-56 -52t-33 -62.5q125 4 202 137q16 28 16 54q0 5 -0.5 13t-0.5 12z",
            adv_x: 301
        },
        FLAG_DOWN_7: {
            path: "M284 167q16 -56 16 -101q0 -18 -3 -36q-5 -29 -13 -50q16 -56 16 -101q0 -18 -3 -36q-5 -29 -13 -50q16 -56 16 -101q0 -18 -3 -36q-5 -29 -13 -50q16 -56 16 -101q0 -18 -3 -36q-8 -51 -30.5 -84.5t-87.5 -102.5q-12 -13 -53.5 -48.5t-60 -67t-26.5 -84.5 q-2 -7 -10.5 -14t-13.5 -7q-3 0 -7 3.5t-6 7.5l-2 3v1349q32 2 49 5t45.5 15.5t55 43t54.5 79.5q31 55 31 100q0 15 -3 31.5t-8.5 39.5t-8.5 39q-1 3 -1 9q0 19 14 25q1 0 2.5 0.5t2.5 0.5q14 0 22 -16q4 -9 12 -49.5t8 -72.5v-11q-4 -64 -21 -99l-2 -3l-3 -7q-2 -6 -2 -7 q0 -4 2 -8l3 -11q4 -11 8 -23.5t7 -33t3 -39.5q0 -22 -2 -33q1 0 8.5 -21t15.5 -57.5t8 -68.5q0 -18 -3 -35q-5 -29 -13 -50zM258 86q0 10 -5 28q-11 -16 -65 -76l-8 -9q-16 -17 -50.5 -44t-56.5 -52.5t-33 -62.5q126 4 203 137q16 30 16 56q0 4 -0.5 11.5t-0.5 11.5z M246 329q-18 -34 -84 -106q-11 -12 -46.5 -42t-52 -55.5t-23.5 -68.5q123 0 202 137q17 29 17 55q0 4 -0.5 12t-0.5 12q0 16 -12 56zM153 418q-12 -13 -34 -34t-34 -34t-25.5 -36.5t-21.5 -51.5q0 -4 4 -8.5t11 -4.5h8q76 0 145 102q27 40 27 82q0 15 -3 28q0 7 -4 23 q-2 6 -12 6q-5 0 -8 -4q-15 -22 -53 -68zM258 -474q0 9 -5 27q-19 -26 -74 -84q-15 -17 -39 -37t-41 -33.5t-34 -37t-26 -52.5q126 4 203 137q17 29 17 56q0 4 -0.5 12t-0.5 12zM258 -287q0 9 -5 27q-19 -26 -74 -84q-17 -18 -50.5 -44.5t-55.5 -52.5t-33 -63q125 4 202 137 q17 29 17 56q0 4 -0.5 12t-0.5 12zM258 -101q0 10 -5 28q-23 -31 -67 -77l-7 -7q-17 -18 -50.5 -44.5t-55.5 -52.5t-33 -63q126 4 203 137q16 30 16 56q0 4 -0.5 12t-0.5 11z",
            adv_x: 301
        },
        FLAG_DOWN_8: {
            path: "M284 98q16 -56 16 -101q0 -18 -3 -36q-5 -29 -13 -50q16 -56 16 -101q0 -18 -3 -36q-5 -29 -13 -50q16 -56 16 -101q0 -18 -3 -36q-5 -29 -13 -50q16 -56 16 -101q0 -18 -3 -36q-4 -26 -14 -53q18 -58 18 -107q0 -18 -3 -34q-9 -50 -31.5 -83.5t-87.5 -103.5 q-12 -13 -53.5 -48.5t-60 -67t-26.5 -84.5q-2 -7 -10.5 -14t-13.5 -7q-3 0 -7 3.5t-6 6.5l-2 4v1543q32 2 49 5t45.5 15.5t55 43t54.5 79.5q30 55 30 100q0 15 -3 31.5t-8 40t-8 38.5q-1 3 -1 9q0 19 14 25q1 0 2.5 0.5t2.5 0.5q13 0 21 -16q5 -8 13 -48.5t8 -73.5v-11 q-3 -46 -7.5 -63.5t-16.5 -39.5l-3 -6l-2 -8q0 -1 1 -3t1 -4t1 -3q21 -50 21 -104q0 -22 -2 -33q1 0 8.5 -21t15.5 -57.5t8 -68.5q0 -19 -3 -35q-5 -29 -13 -50zM257 17q0 13 -4 28q-11 -16 -65 -76l-8 -9q-17 -17 -51.5 -44t-56.5 -52.5t-33 -62.5q127 4 204 137 q15 27 15 53q0 5 -0.5 13.5t-0.5 12.5zM246 260q-18 -34 -84 -106q-11 -12 -46.5 -42t-52 -55.5t-23.5 -68.5q123 0 203 137q15 27 15 53q0 5 -0.5 13.5t-0.5 12.5q0 19 -11 56zM153 349q-12 -13 -34 -34t-34 -34t-25.5 -36.5t-21.5 -51.5q0 -4 4 -8.5t11 -4.5h8 q76 0 145 102q27 40 27 82q0 14 -3 28q0 7 -4 23q-2 6 -12 6q-5 0 -8 -4q-15 -22 -53 -68zM257 -737q0 12 -5 32q-14 -18 -65 -73l-8 -9q-16 -18 -51 -45.5t-56.5 -54.5t-32.5 -67q125 4 204 137q15 27 15 54q0 5 -0.5 13.5t-0.5 12.5zM257 -543q0 12 -4 27q-19 -26 -74 -84 q-15 -17 -39 -37t-41 -33.5t-34 -37t-26 -52.5q126 4 204 137q15 27 15 54q0 5 -0.5 13.5t-0.5 12.5zM257 -356q0 12 -4 27q-19 -26 -74 -84q-15 -17 -39 -37t-41 -33.5t-34 -37t-26 -52.5q126 4 204 137q15 27 15 54q0 5 -0.5 13.5t-0.5 12.5zM257 -169q0 12 -4 27 q-23 -31 -67 -77l-7 -7q-15 -17 -39 -37t-41 -33.5t-34 -37t-26 -52.5q126 4 204 137q15 27 15 54q0 5 -0.5 13.5t-0.5 12.5z",
            adv_x: 310
        },
        ACCIDENTAL_FLAT: {
            path: "M47 -81q0 -15 11 -15q4 0 10 3q48 30 72 75q17 30 17 60q0 29 -16 47q-9 11 -25 11q-13 0 -26 -7q-12 -7 -26.5 -20.5t-17.5 -21.5q-2 -8 -2 -32zM12 -170q-4 4 -7 149.5t-4 288.5l-1 143q1 13 10.5 20.5t20.5 7.5q19 0 19 -17q0 -128 -7 -282q0 -12 11 -17q2 -1 5 -1 q5 0 22 14q13 8 34 14q11 3 21 3q36 -2 63 -28.5t27 -67.5q0 -85 -120 -169q-9 -6 -35.5 -28.5t-43.5 -32.5q-3 -2 -6 -2q-5 0 -9 5z",
            adv_x: 226
        },
        ACCIDENTAL_NATURAL: {
            path: "M37 39v-103q0 -6 12 -6q21 0 51.5 14t30.5 27v103q0 5 -9 5q-19 0 -52 -15t-33 -25zM141 181l15 5q1 1 4 1q8 0 8 -8v-502q0 -12 -12 -12h-13q-12 0 -12 12v149q0 11 -17 11q-29 0 -99 -30l-3 -1h-2l-2 -1q-8 0 -8 9v515q0 12 12 12h13q12 0 12 -12v-167q0 -5 10 -5 q12 0 34.5 5.5t38.5 11.5l17 6h1q2 1 3 1z",
            adv_x: 168
        },
        ACCIDENTAL_SHARP: {
            path: "M168 -45q4 18 4 64q0 47 -4 57q-3 6 -15 6q-20 0 -46 -13t-27 -25q-3 -12 -3 -74q0 -44 3 -50q2 -5 12 -5q19 0 45.5 13t30.5 27zM237 118l-26 -10q-5 -2 -9 -12t-4 -17v-93q0 -18 13 -18l26 10q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17q-21 -8 -28 -11q-11 -5 -11 -23v-142 q0 -11 -17 -11q-13 0 -13 11v125q0 5 -4 11.5t-9 6.5q-1 0 -2 -0.5t-2 -0.5l-61 -25q-10 -4 -10 -22v-139q0 -11 -17 -11q-13 0 -13 11v123q0 5 -3.5 10.5t-8.5 5.5q-2 0 -3 -1l-23 -9h-2l-2 -1q-8 0 -8 9v71q0 13 12 16q21 9 27 11q11 6 11 23v99q0 6 -4 12t-9 6h-1l-2 -1 l-22 -10l-2 -1h-2q-8 0 -8 9v71q0 13 12 16q20 8 26 11q12 6 12 27v135q0 11 16 11q14 0 14 -11v-120q0 -20 12 -20q34 8 63 25q11 7 13 29v130q0 11 16 11q14 0 14 -11v-122q0 -13 14 -13l25 9q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17z",
            adv_x: 249
        },
        ACCIDENTAL_DOUBLE_SHARP: {
            path: "M190 -32h10q33 0 40 -7q7 -9 7 -40q0 -29 -7 -36q-10 -10 -38 -10t-40 10q-5 4 -5 38q-4 13 -14.5 29.5t-19.5 16.5q-13 0 -31 -42q-2 -2 -2 -4q0 -31 -8 -38q-9 -10 -37 -10t-40 10q-5 3 -5 38q0 33 5 38q8 7 43 7h10q14 5 30 15t16 19q0 7 -47 33q-1 0 -4.5 -0.5 t-5.5 -0.5q-30 0 -42 10q-5 5 -5 39t5 37q8 7 41 7q30 0 36 -7q8 -6 8 -39q4 -14 14.5 -30.5t19.5 -16.5q12 0 33 47q0 35 5 39q7 7 41 7q31 0 37 -7q7 -9 7 -40q0 -29 -7 -36q-12 -10 -38 -10q-2 0 -6 0.5t-6 0.5q-47 -17 -47 -34q0 -7 47 -33z",
            adv_x: 247
        },
        ACCIDENTAL_DOUBLE_FLAT: {
            path: "M314 151h6q37 -1 64 -27t27 -67q0 -85 -122 -170q-6 -4 -33 -27.5t-45 -32.5q-3 -2 -6 -2q-4 0 -8 5q-3 3 -7 135q-32 -41 -84 -77q-3 -2 -32 -27t-47 -34q-3 -2 -6 -2q-5 0 -9 5q-3 4 -6 149t-4 289l-2 143q1 12 10.5 19t20.5 7q19 0 19 -16q0 -9 -3.5 -139.5 t-3.5 -141.5q0 -14 11 -17q2 -1 5 -1q5 0 14 6t10 7q19 12 33 15q4 1 14 1h6q27 0 51 -16l-3 276q1 12 10.5 19t20.5 7q19 0 19 -16q0 -9 -3 -139.5t-3 -141.5q0 -14 10 -17q1 -1 5 -1t8 2t9 6t7 5q19 12 33 15q5 1 14 1zM141 -18q16 29 16 59t-16 49q-9 10 -24 10 q-13 0 -26 -7q-12 -7 -27 -20.5t-18 -22.5q-2 -8 -2 -32l3 -98q0 -16 11 -16q4 0 9 3q50 32 74 75zM324 -18q16 31 16 59q0 29 -15 49q-9 10 -24 10q-13 0 -26 -7t-28 -20.5t-18 -22.5q-1 -3 -1 -23l3 -107q0 -16 11 -16q3 0 9 3q52 32 73 75z",
            adv_x: 413
        },
        ACCIDENTAL_TRIPLE_SHARP: {
            path: "M456 -32h10q33 0 40 -7q7 -9 7 -40q0 -29 -7 -36q-10 -10 -38 -10t-40 10q-5 4 -5 38q-4 13 -14.5 29.5t-19.5 16.5q-13 0 -31 -42q-2 -2 -2 -4q0 -31 -8 -38q-9 -10 -37 -10t-40 10q-5 3 -5 38q0 33 5 38q8 7 43 7h10q14 5 30 15t16 19q0 7 -47 33q-1 0 -4.5 -0.5 t-5.5 -0.5q-30 0 -42 10q-5 5 -5 39t5 37q8 7 41 7q30 0 36 -7q8 -6 8 -39q4 -14 14.5 -30.5t19.5 -16.5q12 0 33 47q0 35 5 39q7 7 41 7q31 0 37 -7q7 -9 7 -40q0 -29 -7 -36q-12 -10 -38 -10q-2 0 -6 0.5t-6 0.5q-47 -17 -47 -34q0 -7 47 -33zM168 -45q4 18 4 64 q0 47 -4 57q-3 6 -15 6q-20 0 -46 -13t-27 -25q-3 -12 -3 -74q0 -44 3 -50q2 -5 12 -5q19 0 45.5 13t30.5 27zM237 118l-26 -10q-5 -2 -9 -12t-4 -17v-93q0 -18 13 -18l26 10q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17q-21 -8 -28 -11q-11 -5 -11 -23v-142q0 -11 -17 -11 q-13 0 -13 11v125q0 5 -4 11.5t-9 6.5q-1 0 -2 -0.5t-2 -0.5l-61 -25q-10 -4 -10 -22v-139q0 -11 -17 -11q-13 0 -13 11v123q0 5 -3.5 10.5t-8.5 5.5q-2 0 -3 -1l-23 -9h-2l-2 -1q-8 0 -8 9v71q0 13 12 16q21 9 27 11q11 6 11 23v99q0 6 -4 12t-9 6h-1l-2 -1l-22 -10l-2 -1 h-2q-8 0 -8 9v71q0 13 12 16q20 8 26 11q12 6 12 27v135q0 11 16 11q14 0 14 -11v-120q0 -20 12 -20q34 8 63 25q11 7 13 29v130q0 11 16 11q14 0 14 -11v-122q0 -13 14 -13l25 9q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17z",
            adv_x: 513
        },
        ACCIDENTAL_TRIPLE_FLAT: {
            path: "M314 151h6q28 0 53 -18l-3 278q1 13 10.5 20.5t20.5 7.5q19 0 19 -17q0 -128 -7 -282q0 -12 11 -17q2 -1 5 -1q5 0 22 14q13 8 34 14q11 3 21 3q36 -2 63 -28.5t27 -67.5q0 -85 -120 -169q-9 -6 -35.5 -28.5t-43.5 -32.5q-3 -2 -6 -2q-5 0 -9 5q-4 6 -6 137 q-33 -42 -87 -80q-6 -4 -33 -27.5t-45 -32.5q-3 -2 -6 -2q-4 0 -8 5q-3 3 -7 135q-32 -41 -84 -77q-3 -2 -32 -27t-47 -34q-3 -2 -6 -2q-5 0 -9 5q-3 4 -6 149t-4 289l-2 143q1 12 10.5 19t20.5 7q19 0 19 -16q0 -9 -3.5 -139.5t-3.5 -141.5q0 -14 11 -17q2 -1 5 -1 q5 0 14 6t10 7q19 12 33 15q4 1 14 1h6q27 0 51 -16l-3 276q1 12 10.5 19t20.5 7q19 0 19 -16q0 -9 -3 -139.5t-3 -141.5q0 -14 10 -17q1 -1 5 -1t8 2t9 6t7 5q19 12 33 15q5 1 14 1zM141 -18q16 29 16 59t-16 49q-9 10 -24 10q-13 0 -26 -7q-12 -7 -27 -20.5t-18 -22.5 q-2 -8 -2 -32l3 -98q0 -16 11 -16q4 0 9 3q50 32 74 75zM324 -18q16 31 16 59q0 29 -15 49q-9 10 -24 10q-13 0 -26 -7t-28 -20.5t-18 -22.5q-1 -3 -1 -23l3 -107q0 -16 11 -16q3 0 9 3q52 32 73 75zM510 -18q17 30 17 60q0 29 -16 47q-9 11 -25 11q-13 0 -26 -7 q-12 -7 -26.5 -20.5t-17.5 -21.5q-2 -8 -2 -32l3 -100q0 -15 11 -15q4 0 10 3q48 30 72 75z",
            adv_x: 600
        },
        ACCIDENTAL_NATURAL_FLAT: {
            path: "M37 39v-103q0 -6 12 -6q21 0 51.5 14t30.5 27v103q0 5 -9 5q-19 0 -52 -15t-33 -25zM141 181l15 5q1 1 4 1q8 0 8 -8v-502q0 -12 -12 -12h-13q-12 0 -12 12v149q0 11 -17 11q-29 0 -99 -30l-3 -1h-2l-2 -1q-8 0 -8 9v515q0 12 12 12h13q12 0 12 -12v-167q0 -5 10 -5 q12 0 34.5 5.5t38.5 11.5l17 6h1q2 1 3 1zM280 -81q0 -15 11 -15q4 0 10 3q48 30 72 75q17 30 17 60q0 29 -16 47q-9 11 -25 11q-13 0 -26 -7q-12 -7 -26.5 -20.5t-17.5 -21.5q-2 -8 -2 -32zM245 -170q-4 4 -7 149.5t-4 288.5l-1 143q1 13 10.5 20.5t20.5 7.5q19 0 19 -17 q0 -128 -7 -282q0 -12 11 -17q2 -1 5 -1q5 0 22 14q13 8 34 14q10 3 21 3q36 -2 63 -28.5t27 -67.5q0 -85 -120 -169q-9 -6 -35.5 -28.5t-43.5 -32.5q-3 -2 -6 -2q-5 0 -9 5z",
            adv_x: 459
        },
        ACCIDENTAL_NATURAL_SHARP: {
            path: "M37 39v-103q0 -6 12 -6q21 0 51.5 14t30.5 27v103q0 5 -9 5q-19 0 -52 -15t-33 -25zM141 181l15 5q1 1 4 1q8 0 8 -8v-502q0 -12 -12 -12h-13q-12 0 -12 12v149q0 11 -17 11q-29 0 -99 -30l-3 -1h-2l-2 -1q-8 0 -8 9v515q0 12 12 12h13q12 0 12 -12v-167q0 -5 10 -5 q12 0 34.5 5.5t38.5 11.5l17 6h1q2 1 3 1zM400 -45q4 18 4 64q0 47 -4 57q-3 6 -15 6q-20 0 -46 -13t-27 -25q-3 -12 -3 -74q0 -44 3 -50q2 -5 12 -5q19 0 45.5 13t30.5 27zM469 118l-26 -10q-5 -2 -9 -12t-4 -17v-93q0 -18 13 -18l26 10q2 1 5 1q7 0 7 -8v-71 q0 -12 -12 -17q-21 -8 -28 -11q-11 -5 -11 -23v-142q0 -11 -17 -11q-13 0 -13 11v125q0 5 -4 11.5t-9 6.5h-2l-2 -1l-61 -25q-10 -4 -10 -22v-139q0 -11 -17 -11q-13 0 -13 11v123q0 5 -3.5 10.5t-8.5 5.5q-2 0 -3 -1l-23 -9h-2l-2 -1q-8 0 -8 9v71q0 13 12 16q21 9 27 11 q11 6 11 23v99q0 6 -4 12t-9 6h-1l-2 -1l-22 -10q-1 0 -4 -1q-8 0 -8 9v71q0 13 12 16q20 8 26 11q12 6 12 27v135q0 11 16 11q14 0 14 -11v-120q0 -20 12 -20q34 8 63 25q11 7 13 29v130q0 11 16 11q14 0 14 -11v-122q0 -13 14 -13l25 9q2 1 5 1q7 0 7 -8v-71 q0 -12 -12 -17z",
            adv_x: 480
        },
        ACCIDENTAL_SHARP_SHARP: {
            path: "M168 -45q4 18 4 64q0 47 -4 57q-3 6 -15 6q-20 0 -46 -13t-27 -25q-3 -12 -3 -74q0 -44 3 -50q2 -5 12 -5q19 0 45.5 13t30.5 27zM237 118l-26 -10q-5 -2 -9 -12t-4 -17v-93q0 -18 13 -18l26 10q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17q-21 -8 -28 -11q-11 -5 -11 -23v-142 q0 -11 -17 -11q-13 0 -13 11v125q0 5 -4 11.5t-9 6.5q-1 0 -2 -0.5t-2 -0.5l-61 -25q-10 -4 -10 -22v-139q0 -11 -17 -11q-13 0 -13 11v123q0 5 -3.5 10.5t-8.5 5.5q-2 0 -3 -1l-23 -9h-2l-2 -1q-8 0 -8 9v71q0 13 12 16q21 9 27 11q11 6 11 23v99q0 6 -4 12t-9 6h-1l-2 -1 l-22 -10l-2 -1h-2q-8 0 -8 9v71q0 13 12 16q20 8 26 11q12 6 12 27v135q0 11 16 11q14 0 14 -11v-120q0 -20 12 -20q34 8 63 25q11 7 13 29v130q0 11 16 11q14 0 14 -11v-122q0 -13 14 -13l25 9q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17zM438 -45q4 18 4 64q0 47 -4 57 q-3 6 -15 6q-20 0 -46 -13t-27 -25q-3 -12 -3 -74q0 -44 3 -50q2 -5 12 -5q19 0 45.5 13t30.5 27zM507 118l-26 -10q-5 -2 -9 -12t-4 -17v-93q0 -18 13 -18l26 10q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17q-21 -8 -28 -11q-11 -5 -11 -23v-142q0 -11 -17 -11q-13 0 -13 11v125 q0 5 -4 11.5t-9 6.5q-1 0 -2 -0.5t-2 -0.5l-61 -25q-10 -4 -10 -22v-139q0 -11 -17 -11q-13 0 -13 11v123q0 5 -3.5 10.5t-8.5 5.5q-2 0 -3 -1l-23 -9h-2l-2 -1q-8 0 -8 9v71q0 13 12 16q21 9 27 11q11 6 11 23v99q0 6 -4 12t-9 6h-1l-2 -1l-22 -10l-2 -1h-2q-8 0 -8 9v71 q0 13 12 16q20 8 26 11q12 6 12 27v135q0 11 16 11q14 0 14 -11v-120q0 -20 12 -20q34 8 63 25q11 7 13 29v130q0 11 16 11q14 0 14 -11v-122q0 -13 14 -13l25 9q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17z",
            adv_x: 519
        },
        ACCIDENTAL_PARENS_FLAT: {
            path: "M141 230q0 -3 -2 -5q-42 -38 -60.5 -90.5t-18.5 -134.5q0 -84 18 -136.5t61 -90.5q2 -2 2 -4v-15q0 -2 -3 -2q-138 88 -138 248q0 77 35 143.5t105 103.5q1 0 1 -3v-14zM210 -81q0 -15 11 -15q4 0 10 3q48 30 72 75q17 30 17 60q0 29 -16 47q-9 11 -25 11q-13 0 -26 -7 q-12 -7 -26.5 -20.5t-17.5 -21.5q-2 -8 -2 -32zM175 -170q-4 4 -7 149.5t-4 288.5l-1 143q1 13 10.5 20.5t20.5 7.5q19 0 19 -17q0 -128 -7 -282q0 -12 11 -17q2 -1 5 -1q5 0 22 14q13 8 34 14q10 3 21 3q36 -2 63 -28.5t27 -67.5q0 -85 -120 -169q-9 -6 -35.5 -28.5 t-43.5 -32.5q-3 -2 -6 -2q-5 0 -9 5zM365 230v14q0 3 1 3q70 -37 105 -103.5t35 -143.5q0 -160 -138 -248q-3 0 -3 2v15q0 2 2 4q43 38 61 90.5t18 136.5q0 82 -18.5 134.5t-60.5 90.5q-2 2 -2 5z",
            adv_x: 506
        },
        ACCIDENTAL_PARENS_NATURAL: {
            path: "M141 230q0 -3 -2 -5q-42 -38 -60.5 -90.5t-18.5 -134.5q0 -84 18 -136.5t61 -90.5q2 -2 2 -4v-15q0 -2 -3 -2q-138 88 -138 248q0 77 35 143.5t105 103.5q1 0 1 -3v-14zM223 39v-103q0 -6 12 -6q21 0 51.5 14t30.5 27v103q0 5 -9 5q-19 0 -52 -15t-33 -25zM327 181l15 5 q1 1 4 1q8 0 8 -8v-502q0 -12 -12 -12h-13q-12 0 -12 12v149q0 11 -17 11q-29 0 -99 -30l-3 -1h-2l-2 -1q-8 0 -8 9v515q0 12 12 12h13q12 0 12 -12v-167q0 -5 10 -5q12 0 34.5 5.5t38.5 11.5l17 6h1q2 1 3 1zM400 230v14q0 3 1 3q70 -37 105 -103.5t35 -143.5 q0 -160 -138 -248q-3 0 -3 2v15q0 2 2 4q43 38 61 90.5t18 136.5q0 82 -18.5 134.5t-60.5 90.5q-2 2 -2 5z",
            adv_x: 540
        },
        ACCIDENTAL_PARENS_SHARP: {
            path: "M141 230q0 -3 -2 -5q-42 -38 -60.5 -90.5t-18.5 -134.5q0 -84 18 -136.5t61 -90.5q2 -2 2 -4v-15q0 -2 -3 -2q-138 88 -138 248q0 77 35 143.5t105 103.5q1 0 1 -3v-14zM320 -45q4 18 4 64q0 47 -4 57q-3 6 -15 6q-20 0 -46 -13t-27 -25q-3 -12 -3 -74q0 -44 3 -50 q2 -5 12 -5q19 0 45.5 13t30.5 27zM389 118l-26 -10q-5 -2 -9 -12t-4 -17v-93q0 -18 13 -18l26 10q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17q-21 -8 -28 -11q-11 -5 -11 -23v-142q0 -11 -17 -11q-13 0 -13 11v125q0 5 -4 11.5t-9 6.5q-1 0 -2 -0.5t-2 -0.5l-61 -25 q-10 -4 -10 -22v-139q0 -11 -17 -11q-13 0 -13 11v123q0 5 -3.5 10.5t-8.5 5.5q-2 0 -3 -1l-23 -9h-2l-2 -1q-8 0 -8 9v71q0 13 12 16q21 9 27 11q11 6 11 23v99q0 6 -4 12t-9 6h-1l-2 -1l-22 -10l-2 -1h-2q-8 0 -8 9v71q0 13 12 16q20 8 26 11q12 6 12 27v135q0 11 16 11 q14 0 14 -11v-120q0 -20 12 -20q34 8 63 25q11 7 13 29v130q0 11 16 11q14 0 14 -11v-122q0 -13 14 -13l25 9q2 1 5 1q7 0 7 -8v-71q0 -12 -12 -17zM419 230v14q0 3 1 3q70 -37 105 -103.5t35 -143.5q0 -160 -138 -248q-3 0 -3 2v15q0 2 2 4q43 38 61 90.5t18 136.5 q0 82 -18.5 134.5t-60.5 90.5q-2 2 -2 5z",
            adv_x: 560
        },
        ACCIDENTAL_PARENS_DOUBLE_SHARP: {
            path: "M141 230q0 -3 -2 -5q-42 -38 -60.5 -90.5t-18.5 -134.5q0 -84 18 -136.5t61 -90.5q2 -2 2 -4v-15q0 -2 -3 -2q-138 88 -138 248q0 77 35 143.5t105 103.5q1 0 1 -3v-14zM316 -32h10q33 0 40 -7q7 -9 7 -40q0 -29 -7 -36q-10 -10 -38 -10t-40 10q-5 4 -5 38 q-4 13 -14.5 29.5t-19.5 16.5q-13 0 -31 -42q-2 -2 -2 -4q0 -31 -8 -38q-9 -10 -37 -10t-40 10q-5 3 -5 38q0 33 5 38q8 7 43 7h10q14 5 30 15t16 19q0 7 -47 33q-1 0 -4.5 -0.5t-5.5 -0.5q-30 0 -42 10q-5 5 -5 39t5 37q8 7 41 7q30 0 36 -7q8 -6 8 -39q4 -14 14.5 -30.5 t19.5 -16.5q12 0 33 47q0 35 5 39q7 7 41 7q31 0 37 -7q7 -9 7 -40q0 -29 -7 -36q-12 -10 -38 -10q-2 0 -6 0.5t-6 0.5q-47 -17 -47 -34q0 -7 47 -33zM357 230v14q0 3 1 3q70 -37 105 -103.5t35 -143.5q0 -160 -138 -248q-3 0 -3 2v15q0 2 2 4q43 38 61 90.5t18 136.5 q0 82 -18.5 134.5t-60.5 90.5q-2 2 -2 5z",
            adv_x: 497
        },
        ACCIDENTAL_PARENS_DOUBLE_FLAT: {
            path: "M141 230q0 -3 -2 -5q-42 -38 -60.5 -90.5t-18.5 -134.5q0 -84 18 -136.5t61 -90.5q2 -2 2 -4v-15q0 -2 -3 -2q-138 88 -138 248q0 77 35 143.5t105 103.5q1 0 1 -3v-14zM479 151h6q37 -1 64 -27t27 -67q0 -85 -122 -170q-6 -4 -33 -27.5t-45 -32.5q-3 -2 -6 -2q-4 0 -8 5 q-3 3 -7 135q-32 -41 -84 -77q-3 -2 -32 -27t-47 -34q-3 -2 -6 -2q-5 0 -9 5q-3 4 -6 149t-5 289l-1 143q1 12 10.5 19t20.5 7q19 0 19 -16q0 -9 -3.5 -139.5t-3.5 -141.5q0 -14 11 -17q2 -1 5 -1q5 0 14 6t10 7q19 12 33 15q4 1 14 1h6q27 0 51 -16l-3 276q1 12 10.5 19 t20.5 7q19 0 19 -16q0 -9 -3 -139.5t-3 -141.5q0 -14 10 -17q1 -1 5 -1t8 2t9 6t7 5q19 12 33 15q5 1 14 1zM306 -18q16 29 16 59t-16 49q-9 10 -24 10q-13 0 -26 -7q-12 -7 -27 -20.5t-18 -22.5q-2 -8 -2 -32l3 -98q0 -16 11 -16q5 0 9 3q50 32 74 75zM489 -18q16 31 16 59 q0 29 -15 49q-9 10 -24 10q-13 0 -26 -7t-28 -20.5t-18 -22.5q-1 -3 -1 -23l3 -107q0 -16 11 -16q3 0 9 3q52 32 73 75zM552 230v14q0 3 1 3q70 -37 105 -103.5t35 -143.5q0 -160 -138 -248q-3 0 -3 2v15q0 2 2 4q43 38 61 90.5t18 136.5q0 82 -18.5 134.5t-60.5 90.5 q-2 2 -2 5z",
            adv_x: 693
        },
        ARTICULATION_ACCENT_ABOVE: {
            path: "M326 105l-306 -103q-1 -1 -4 -1q-8 0 -14 15q-2 6 -2 9q0 9 14 15q214 73 225 76q8 3 8 7q0 6 -7 7l-226 77q-14 5 -14 14q0 2 2 10q5 14 15 14q1 0 9 -2l300 -102q13 -4 13 -18q0 -15 -13 -18z",
            adv_x: 339
        },
        ARTICULATION_ACCENT_BELOW: {
            path: "M326 -140l-306 -103q-1 -1 -4 -1q-8 0 -14 15q-2 6 -2 9q0 9 14 15q214 73 225 76q8 3 8 7q0 6 -7 7l-226 77q-14 5 -14 14q0 2 2 10q5 14 15 14q1 0 9 -2l300 -102q13 -4 13 -18q0 -15 -13 -18z",
            adv_x: 339
        },
        ARTICULATION_STACCATO_ABOVE: {
            path: "M84 42q0 -17 -12.5 -29.5t-29.5 -12.5t-29.5 12.5t-12.5 29.5t12.5 29.5t29.5 12.5t29.5 -12.5t12.5 -29.5z",
            adv_x: 84
        },
        ARTICULATION_STACCATO_BELOW: {
            path: "M84 -42q0 -17 -12.5 -29.5t-29.5 -12.5t-29.5 12.5t-12.5 29.5t12.5 29.5t29.5 12.5t29.5 -12.5t12.5 -29.5z",
            adv_x: 122
        },
        REST_WHOLE: {
            path: "M282 -109q0 -11 -8 -18.5t-18 -7.5h-230q-11 0 -18.5 7.5t-7.5 18.5v92q0 11 7.5 18.5t18.5 7.5h230q11 0 18.5 -7.5t7.5 -18.5v-92z",
            adv_x: 283
        },
        REST_HALF: {
            path: "M282 24q0 -10 -8 -18t-18 -8h-230q-11 0 -18.5 7.5t-7.5 18.5v92q0 11 7.5 18.5t18.5 7.5h230q11 0 18.5 -7.5t7.5 -18.5v-92z",
            adv_x: 283
        },
        REST_QUARTER: {
            path: "M78 -38l-49 60q-10 10 -10 24q0 15 14 29q60 63 60 127q0 32 -14 62t-30.5 50.5t-16.5 21.5q-4 8 -4 16q0 21 20 21q10 0 18 -8l165 -193q4 -9 4 -19q0 -8 -4 -15q-2 -3 -13 -20.5t-15 -24t-13 -22t-12.5 -26t-7.5 -25.5t-5 -29q0 -2 -0.5 -6.5t-0.5 -6.5q0 -26 11 -52 t22 -41.5t36 -45.5q37 -40 37 -57q0 -4 -5 -4q-4 0 -7 1l-1 1h-2q-45 17 -78 17q-11 0 -16 -1q-23 -4 -35 -25t-12 -47q0 -15 4 -26q2 -10 9.5 -23t16.5 -13q16 -14 16 -24q0 -1 -2 -7t-15 -6q-14 0 -26 9q-116 89 -116 155q0 39 24.5 67.5t57.5 28.5q3 0 8 -1.5t8 -1.5 q12 -3 16 -3q9 0 11 5q1 1 1 4q0 2 -6 14q-17 28 -43 60z",
            adv_x: 270
        },
        REST_1: {
            path: "M134 107v-10q11 0 27 10t27.5 20.5t23.5 22.5l12 13q6 4 11 4q12 -6 12 -16q0 -2 -4 -15.5t-6 -23.5q-98 -351 -101 -353q-12 -10 -35 -10q-29 0 -29 13q8 28 30.5 95.5t42 123t20.5 61.5q1 4 1 11q0 9 -5 9q-3 0 -5 -1q-19 -10 -36 -15q-19 -7 -39 -7q-10 0 -26 4 q-12 2 -28 13q-27 22 -27 51q0 28 19.5 47.5t47.5 19.5t47.5 -19.5t19.5 -47.5z",
            adv_x: 247
        },
        REST_2: {
            path: "M208 111v-10q12 0 28 10t27.5 21t23.5 24l12 12q6 4 11 4q10 -5 10 -11v-1q-1 -2 -1 -3l-27 -101q-19 -67 -45 -152l-116 -381q-8 -23 -38 -23q-31 0 -31 18v1q1 1 1 2l95 283v1q1 1 1 2q0 5 -4 5q-18 -10 -33 -14q-21 -7 -42 -7q-13 0 -25 3q-14 4 -27 14q-28 21 -28 51 q0 29 20 48.5t48 19.5t48 -20t20 -48q0 -6 -1 -10q12 0 27.5 9t21.5 22q6 12 29.5 83.5t25.5 81.5q3 11 3 15q0 7 -5 7q-1 0 -7 -2q-19 -10 -36 -15q-21 -7 -42 -7q-14 0 -24 3q-16 5 -28 14q-28 21 -28 51q0 28 20 48t48 20t48 -19.5t20 -48.5z",
            adv_x: 320
        },
        REST_3: {
            path: "M353 419q10 0 10 -11l-1 -2v-2l-26 -101q-172 -770 -175 -782q-3 -7 -5 -10.5t-10.5 -7t-23.5 -3.5q-27 0 -27 16q0 4 1 6q2 8 36.5 145.5t34.5 140.5q0 6 -6 6q-2 0 -3 -1q-19 -10 -36 -15q-21 -7 -42 -7q-14 0 -24 3q-16 5 -28 14q-28 21 -28 51q0 28 20 48t48 20 t48 -19.5t20 -48.5q0 -6 -1 -10q14 1 31 11t20 24l40 164q0 13 -7 13q-2 0 -3 -1q-14 -7 -35 -15q-19 -7 -40 -7q-11 0 -27 4q-17 5 -27 14q-28 21 -28 50q0 28 19.5 48t48.5 20q28 0 48 -20t20 -48q0 -6 -1 -9q12 0 31 12t23 24l39 160q0 1 0.5 2t0.5 2q0 16 -11 16 q-3 0 -4 -1q-14 -7 -35 -15q-21 -7 -41 -7q-10 0 -26 4q-18 5 -28 14q-28 21 -28 50q0 28 20 48t48 20q29 0 48.5 -20t19.5 -48v-9q12 0 28 10t28 21t23 22.5t12 12.5q6 4 11 4z",
            adv_x: 363
        },
        REST_4: {
            path: "M414 423q9 -2 9 -15l-27 -102l-93 -400q-22 -99 -24 -99q-105 -449 -129 -538q-1 -4 -1 -5q-6 -17 -33 -17q-32 0 -32 14q0 4 1 7l72 279q0 1 0.5 3t0.5 3q0 11 -8 11q-2 0 -4 -1t-24 -9q-19 -7 -40 -7q-11 0 -27 4q-17 5 -27 14q-28 21 -28 50q0 28 20 48t48 20 t48 -19.5t20 -48.5q0 -6 -1 -9q12 0 26.5 8t18.5 22q3 7 21 80t19 79v3q1 3 1 5q0 14 -6 14q-2 0 -3 -1q-5 -2 -13.5 -7t-16.5 -8q-21 -7 -40 -7q-11 0 -27 4q-13 4 -28 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48v-10q13 0 28.5 9t20.5 26q12 33 41 162q1 2 1 5 q0 9 -6 9q-2 0 -4 -1q-7 -3 -40 -15q-18 -6 -42 -6q-13 0 -25 3q-16 5 -28 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48v-10q13 0 34 13t26 27q2 7 21 82l18 74q2 8 2 10q0 11 -9 11q-3 0 -7 -2q-21 -9 -36 -15q-19 -7 -40 -7q-11 0 -27 4q-14 4 -27 14q-28 21 -28 51 q0 28 20 48t48 20t48 -20t20 -48q0 -7 -1 -10q12 0 28 10t28 21t23.5 23t12.5 13q6 4 11 4z",
            adv_x: 424
        },
        REST_5: {
            path: "M373 621v-10q12 0 28 10t28 21.5t23 23t12 12.5q6 4 11 4q10 -5 10 -11l-1 -1v-3l-27 -101l-297 -1300q-3 -10 -10 -13t-30 -3q-29 0 -29 16q1 3 37 148t37 147q1 1 1 4q0 5 -5 5h-1l-2 -1q-18 -9 -33 -14q-1 0 -3 -1q-19 -7 -40 -7q-10 0 -26 4q-15 3 -28 13 q-28 23 -28 51t20 48t48 20t48 -19.5t20 -48.5l3 -10q33 2 46 36q3 7 10 33.5t13.5 54t12.5 53.5t6 27q0 8 -6 8q-3 0 -4 -1q-24 -11 -35 -15q-21 -7 -40 -7q-11 0 -27 4q-14 4 -27 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48q0 -2 -0.5 -5.5t-0.5 -4.5q14 0 31 10 t22 28q4 11 20 76t18 77q2 8 2 11q0 10 -6 10q-2 0 -6 -2q-24 -11 -35 -15q-21 -7 -40 -7q-11 0 -27 4q-16 5 -28 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48v-10q13 0 32.5 13t23.5 27l39 156q2 8 2 14q0 13 -5 13q-2 0 -3 -1q-38 -17 -45 -20q-18 -6 -42 -6 q-13 0 -25 3q-13 4 -28 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48v-10q14 0 37.5 17t26.5 28q23 79 39 157q1 3 1 8q0 13 -12 13q-4 0 -8 -2q-18 -9 -33 -14l-1 -1h-2q-19 -7 -40 -7q-10 0 -26 4q-16 3 -28 14q-28 21 -28 50q0 28 20 48t48 20q29 0 48.5 -19.5 t19.5 -48.5z",
            adv_x: 485
        },
        REST_6: {
            path: "M369 150l38 157q1 4 1 10q0 10 -7 10q-4 0 -6 -1q-13 -7 -41 -17q-18 -6 -41 -6q-15 0 -25 3q-16 5 -28 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48q0 -7 -1 -10q17 0 38.5 14t26.5 33q2 5 10.5 39t17.5 72t11 44q0 1 0.5 3t0.5 3q0 15 -13 15q-3 0 -7 -2 q-18 -9 -33 -14h-1l-2 -1q-19 -7 -40 -7q-11 0 -27 4q-14 3 -27 14q-28 21 -28 50q0 28 20 48t48 20t48 -20t20 -48q0 -6 -1 -10q12 0 28 10t28 21.5t23.5 23l12.5 12.5q6 4 11 4q9 -5 9 -11v-4l-27 -101l-359 -1549q-2 -7 -4.5 -11.5t-11.5 -8.5t-24 -4q-26 0 -26 15 q0 5 1 7q4 10 67 278q2 10 2 13q0 6 -4 6l-6 -2q-4 -2 -11.5 -6t-15.5 -7q-19 -7 -40 -7q-11 0 -27 4q-14 4 -27 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48q0 -7 -1 -10q35 0 45 38q3 11 9 35l15.5 62t15.5 61v2q1 1 1 2q1 4 1 11q0 9 -5 9q-2 0 -6 -2 q-15 -7 -32 -13q-19 -7 -40 -7q-11 0 -27 4q-13 3 -27 13q-28 23 -28 51t19.5 48t48.5 20t48.5 -20t19.5 -48q0 -6 -1 -10q42 3 53 42q2 6 34 139l2 6q3 10 3 17q0 9 -5 9q-1 0 -5 -2q-24 -11 -35 -15q-21 -7 -40 -7q-11 0 -27 4q-16 5 -28 14q-28 21 -28 51q0 28 20 48 t48 20t48 -20t20 -48v-10q14 0 31 10.5t24 31.5q2 6 10.5 39.5t17.5 71t9 38.5q0 2 0.5 4.5t0.5 3.5q0 13 -7 13q-1 0 -5 -2q-21 -9 -36 -15q-19 -7 -40 -7q-11 0 -27 4q-15 5 -27 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48q0 -7 -1 -10q16 0 35 11.5t24 31.5z",
            adv_x: 541
        },
        REST_7: {
            path: "M430 624v-10q15 0 35.5 14t26.5 32q2 6 10.5 43t17 71.5t8.5 35.5q1 3 1 9q0 13 -9 13q-2 0 -6 -2q-19 -10 -36 -15q-21 -7 -42 -7q-14 0 -24 3q-16 5 -28 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48q0 -6 -1 -10q12 0 28.5 10t28 21t23.5 23l12 13q6 4 11 4 q10 -5 10 -11v-2q-1 -1 -1 -2l-27 -101q-413 -1786 -416 -1797q-3 -8 -5 -12t-11 -8t-24 -4q-27 0 -27 19q0 6 1 8t17 67.5t32.5 133.5t18.5 74q1 2 1 6q0 6 -5 6q-3 0 -4 -1q-9 -5 -32 -13q-19 -7 -40 -7q-10 0 -26 4q-18 5 -28 14q-28 21 -28 50q0 28 20 48t48 20 t48 -19.5t20 -48.5v-9q39 0 46 29l43 180q0 12 -7 12q-2 0 -3 -1q-20 -11 -36 -15q-21 -7 -42 -7q-13 0 -24 3q-16 5 -28 14q-28 21 -28 51q0 28 20 48t48 20q29 0 48.5 -20t19.5 -48v-10q14 0 32 12t23 32l36 152q1 3 1 7q0 9 -6 9q-3 0 -5 -1q-14 -7 -35 -15 q-19 -7 -40 -7q-11 0 -27 4q-17 5 -27 14q-28 21 -28 50t19.5 48.5t48.5 19.5q28 0 48 -20t20 -48q0 -6 -1 -9q15 0 31.5 9.5t22.5 27.5q12 44 37 154q2 10 2 12q0 9 -6 9l-6 -2q-24 -11 -35 -15q-21 -7 -40 -7q-11 0 -27 4q-13 4 -28 14q-27 20 -27 51q0 28 20 48t48 20 t48 -20t20 -48q0 -2 -0.5 -5.5t-0.5 -4.5q15 0 32.5 10t22.5 30q4 15 38 155q1 1 1 3q0 1 0.5 3t0.5 3q0 15 -10 15q-2 0 -6 -2q-24 -11 -35 -15q-21 -7 -40 -7q-11 0 -27 4q-13 4 -28 14q-27 22 -27 51q0 28 20 48t48 20t48 -20t20 -48q0 -2 -0.5 -5.5t-0.5 -4.5 q16 0 36 12t25 32q35 138 38 159q1 2 1 5q0 14 -11 14q-3 0 -5 -1q-20 -11 -36 -15q-21 -7 -42 -7q-14 0 -24 3q-16 5 -28 14q-28 21 -28 51q0 28 20 48t48 20t48 -20t20 -48z",
            adv_x: 604
        },
        REST_8: {
            path: "M473 1059l-28 14q-29 29 -29 53q0 29 21.5 50t50.5 21t47.5 -22.5t18.5 -58.5q27 0 59 33.5t45 38.5q10 -5 10 -15l-104 -387q-23 -105 -125 -546t-192 -825.5t-90 -388.5q-4 -11 -11 -15t-28 -4q-6 0 -17 10t-11 13q2 3 19 68t34 134t18 73q0 9 -9 9l-34 -9 q-13 -10 -37 -10q-5 0 -14.5 2t-14.5 2l-27 15q-25 16 -25 52q0 25 19.5 46t47.5 21q26 0 45.5 -22t19.5 -59q34 0 49 33q1 4 11 48t19.5 84.5t12.5 42.5q0 4 -3.5 9.5t-7.5 5.5q-6 -4 -38 -15q-14 -9 -37 -9q-5 0 -14.5 2t-13.5 2l-29 15q-24 15 -24 52q0 25 19.5 46 t47.5 21q26 0 46 -22t20 -59q45 13 57 46q5 19 19 81.5t14 71.5q0 3 -3.5 8.5t-6.5 5.5q-3 -4 -7 -6t-7 -3t-9.5 -2.5t-9.5 -2.5q-20 -11 -38 -11q-4 0 -13.5 3t-15.5 3l-27 14q-29 19 -29 51q0 25 20.5 45.5t46.5 20.5q27 0 48.5 -21.5t21.5 -58.5q43 14 52 38 q9 23 18.5 62.5t15 67.5t5.5 31q0 4 -3.5 9t-7.5 5q-5 -3 -37 -14q-20 -9 -38 -9q-5 0 -14.5 2.5t-13.5 2.5l-29 14q-29 21 -29 52q0 25 22 45.5t50 20.5q17 0 32.5 -20t25.5 -40t13 -20q42 11 53 42l36 157q0 18 -13 18l-38 -14q-14 -4 -48 -4h-18l-29 14q-28 30 -28 52 q0 27 21 46.5t50 19.5t48 -20.5t19 -55.5q15 0 34 11.5t26 30.5l38 161q0 14 -15 14l-38 -14q-9 -4 -37 -4q-18 0 -28 4q-7 0 -29 10q-28 28 -28 51q0 29 21 48t50 19t47.5 -20.5t18.5 -54.5q16 0 35.5 13.5t26.5 33.5l38 147q3 13 3 19q0 5 -3 5t-8 -2.5t-7 -2.5l-38 -14 q-9 -5 -37 -5q-20 0 -28 5q-6 0 -15 3.5t-13 4.5q-29 29 -29 53q0 29 21 47.5t50 18.5t47.5 -20t18.5 -56q15 0 36.5 14.5t25.5 28.5q3 11 12 38t14.5 45.5t10.5 42t5 39.5q0 10 -14 10l-38 -14q-18 -10 -38 -10q-5 0 -14.5 2t-14.5 2z",
            adv_x: 668
        },
        FERMATA_ABOVE: {
            path: "M302 221q-206 0 -263 -194q-2 -8 -3 -9q-9 -21 -20 -21q-13 0 -13 13q0 7 1 11q12 63 34.5 113.5t46 81.5t53.5 54.5t53.5 34t50.5 16.5t38.5 7t23.5 1q18 0 37 -2t62 -19t77.5 -46t70.5 -92t53 -149q1 -4 1 -10q0 -14 -14 -14q-11 0 -21 21q-1 1 -1 3q-1 3 -1 4 q-5 20 -11 36t-26 48.5t-46 54.5t-74.5 39.5t-108.5 17.5zM358 52q0 -22 -16 -38.5t-39 -16.5q-22 0 -38 16.5t-16 38.5t16 38t38 16t38.5 -16t16.5 -38z",
            adv_x: 605
        },
        FERMATA_BELOW: {
            path: "M302 -224q60 0 108.5 17.5t74.5 39.5t46 54.5t26 48.5t11 36q0 1 1 4l1 3q10 21 21 21q14 0 14 -14q0 -6 -1 -10q-17 -86 -53 -149t-70.5 -92t-77.5 -46t-62 -19t-37 -2q-12 0 -23.5 1t-38.5 7t-50.5 16.5t-53.5 34t-53.5 54.5t-46 81.5t-34.5 113.5q-1 4 -1 11 q0 13 13 13q11 0 20 -21q1 -1 3 -9q57 -194 263 -194zM358 -55q0 -22 -16.5 -38t-38.5 -16t-38 16t-16 38t16 38.5t38 16.5q23 0 39 -16t16 -39z",
            adv_x: 605
        },
        CAESURA: {
            path: "M28 -1q-6 0 -9 2q-19 6 -19 25q0 4 2 10l168 477q6 19 26 19q4 0 10 -2q18 -7 18 -26q0 -6 -1 -9l-169 -477q-6 -19 -26 -19zM214 18q-6 -19 -26 -19q-6 0 -9 2q-19 6 -19 26q0 6 1 9l169 477q6 19 26 19q4 0 10 -2q18 -7 18 -26q0 -6 -1 -9z",
            adv_x: 385
        },
        DYNAMIC_P: {
            path: "M274 274q43 0 67.5 -23t24.5 -66q0 -73 -52 -134t-122 -61q-26 0 -44 9q-7 3 -12 8l-7.5 7.5t-4.5 2.5q-4 0 -9 -12l-45 -112q-2 -6 -2 -7q0 -3 9 -3h40q12 0 12 -12q0 -13 -13 -13h-193q-12 0 -12 12q0 13 13 13h31q11 0 15 10l123 305q6 14 6 25q0 12 -11 12 q-23 0 -67 -76q-8 -15 -16 -15q-11 0 -11 11q0 6 7 19q27 49 54 74t68 25q36 0 48 -21q4 -7 5.5 -13.5t2.5 -8.5t3 -2t4 2t6.5 7.5t10.5 10.5q29 26 71 26zM247 237q-17 0 -35 -18t-29 -45l-20 -49q-19 -48 -19 -69q0 -32 25 -32q33 0 67 67t34 109q0 37 -23 37z",
            adv_x: 365
        },
        DYNAMIC_M: {
            path: "M367 274q28 0 41 -16t13 -38q0 -30 -29 -96t-29 -81q0 -9 8 -9q17 0 51 54q8 13 15 13q9 0 9 -9q0 -6 -9 -21q-49 -81 -105 -81q-45 0 -45 40q0 22 31 92.5t31 87.5q0 14 -15 14q-34 0 -55 -50l-65 -162q-5 -12 -16 -12h-49q-11 0 -11 6q0 4 3 11q63 158 63 156 q10 23 10 37t-15 14q-34 0 -55 -50l-65 -162q-5 -12 -16 -12h-49q-11 0 -11 6q0 4 3 11l73 181q6 14 6 25q0 12 -11 12q-22 0 -68 -78q-8 -13 -15 -13q-11 0 -11 11q0 6 7 19q27 49 53 74t62 25q28 0 39 -23q2 -4 3 -7.5t1 -6t0.5 -4t1.5 -2.5t2 -1t15 14q29 31 68 31 q33 0 44 -24q2 -3 3 -7t1 -6t0.5 -4t1.5 -3t2 -1t15 14q29 31 68 31z",
            adv_x: 437
        },
        DYNAMIC_F: {
            path: "M16 264h58q11 0 13.5 2t6.5 13q57 165 184 165q86 0 86 -67q0 -26 -14 -40t-35 -14q-20 0 -32.5 11t-12.5 31q0 28 21 38l6 2t4.5 2t3 1.5t2 1.5t0.5 3q0 8 -16 8q-35 0 -55.5 -34t-36.5 -106q0 -2 -0.5 -4t-1 -3t-0.5 -2.5v-2.5q0 -5 10 -5h60q15 0 15 -15 q0 -16 -16 -16h-65q-3 0 -8 -4.5t-5 -6.5v-1q-1 -1 -1 -2q-35 -123 -75 -207q-43 -88 -83 -126t-95 -38q-33 0 -54 17.5t-21 49.5q0 23 15 39t37 16q21 0 33 -11t12 -30q0 -24 -20 -37q-5 -3 -10 -5t-7.5 -2.5t-4.5 -1.5t-2 -4q0 -9 18 -9q29 0 46.5 27.5t39.5 102.5l63 219 l2 10q0 4 -8 4h-58q-15 0 -15 15q0 16 16 16z",
            adv_x: 364
        },
        DYNAMIC_R: {
            path: "M225 274q26 0 39 -15t13 -38q0 -26 -11.5 -40.5t-30.5 -14.5q-16 0 -26 8.5t-10 23.5q0 16 11 27t11 13q0 6 -10 6q-16 0 -36.5 -22t-30.5 -48l-65 -162q-5 -12 -16 -12h-49q-11 0 -11 6q0 4 3 11l73 181q6 14 6 25q0 12 -11 12q-23 0 -68 -78q-6 -13 -15 -13 q-11 0 -11 11q0 6 7 19q26 49 52.5 74t61.5 25q29 0 40 -23q2 -4 3 -8l1.5 -6t0.5 -4t1 -2.5t2 -0.5q2 0 3 1t4.5 5.5t6.5 7.5q27 31 62 31z",
            adv_x: 277
        },
        DYNAMIC_S: {
            path: "M147 273q38 0 60 -16t22 -44q0 -15 -10 -26.5t-27 -11.5q-15 0 -25 8.5t-10 23.5q0 16 10 24q3 2 6 3.5t4.5 2.5t1.5 3q0 11 -31 11q-22 0 -32.5 -9.5t-10.5 -23.5t9.5 -24.5t38.5 -32.5q49 -36 49 -78q0 -43 -32.5 -68t-82.5 -25q-38 0 -62.5 19t-24.5 45 q0 20 11.5 33.5t29.5 13.5q15 0 25.5 -9t10.5 -24q0 -20 -14 -29q-4 -2 -7.5 -3.5t-5.5 -2t-3 -1.5t-1 -3q0 -6 12 -10.5t30 -4.5q23 0 37 13.5t14 31.5q0 27 -38 53q-29 20 -41.5 36.5t-12.5 41.5q0 39 27.5 61t72.5 22z",
            adv_x: 229
        },
        DYNAMIC_Z: {
            path: "M229 274q28 0 41 -16t13 -38q0 -30 -29 -96t-29 -81q0 -9 8 -9q17 0 51 54q8 13 15 13q9 0 9 -9q0 -6 -9 -21q-49 -81 -105 -81q-45 0 -45 40q0 22 31 92.5t31 87.5q0 14 -15 14q-34 0 -55 -50l-65 -162q-5 -12 -16 -12h-49q-11 0 -11 6q0 4 3 11l73 181q6 14 6 25 q0 12 -11 12q-22 0 -68 -78q-8 -13 -15 -13q-11 0 -11 11q0 6 7 19q27 49 53 74t62 25q28 0 39 -23q2 -4 3 -7.5t1 -6t0.5 -4t1.5 -2.5t2 -1t15 14q29 31 68 31z",
            adv_x: 308
        },
        TUPLET_0: {
            path: "M207 375q54 0 82.5 -31.5t28.5 -76.5t-14 -96q-27 -84 -78.5 -131.5t-115.5 -47.5q-54 0 -82 31.5t-28 76.5t14 96q26 84 77.5 131.5t115.5 47.5zM208 349q-56 0 -109 -166q-9 -28 -14.5 -55t-7 -52.5t6.5 -41.5t25 -16q58 0 110 166q9 28 14.5 55t6.5 52.5t-7 41.5 t-25 16z",
            adv_x: 319
        },
        TUPLET_1: {
            path: "M60 244l106 120q8 8 16 8q6 0 15 -4.5t16 -4.5q5 0 16.5 4.5t17.5 4.5q9 0 9 -10q0 -1 -2 -11l-97 -306q-3 -13 4 -14l34 -3q13 -1 13 -14q0 -14 -15 -14h-168q-15 0 -15 14q0 12 14 14l35 3q8 1 12 10l68 213q2 10 2 12q0 6 -5 6q-7 0 -13 -9l-37 -40q-9 -11 -18 -11 q-6 0 -11 5t-5 10q0 6 8 17z",
            adv_x: 246
        },
        TUPLET_2: {
            path: "M210 375q56 0 87.5 -23t31.5 -63q0 -109 -149 -143q-65 -15 -95 -49q-15 -17 -4 -17l16 6q17 7 40 7q16 0 43.5 -9t41.5 -9q26 0 43 22q7 11 15 11q15 0 15 -12q0 -5 -4 -14q-14 -45 -35 -66.5t-57 -21.5q-37 0 -75 21.5t-52 21.5q-18 0 -26 -22q-7 -18 -20 -18 q-16 0 -16 15q0 4 3 16q14 51 45 87.5t91 60.5q100 40 100 128q0 43 -52 43q-24 0 -38.5 -9t-14.5 -19q0 -7 11 -18q12 -12 12 -30q0 -21 -13.5 -36t-33.5 -15q-22 0 -32.5 12.5t-10.5 30.5q0 45 37 78.5t96 33.5z",
            adv_x: 319
        },
        TUPLET_3: {
            path: "M122 207h11q43 0 67.5 25t24.5 66q0 19 -12.5 32.5t-39.5 13.5q-33 0 -33 -14q0 -3 12 -13q9 -11 9 -25q0 -20 -13 -33.5t-32 -13.5q-17 0 -28 12t-10 31q1 39 34.5 63t82.5 24q47 0 79 -23t32 -61q0 -29 -21.5 -52t-54.5 -37q-12 -6 -12 -9q0 -4 11 -9q39 -20 39 -62 q0 -58 -45 -94t-110 -36q-50 0 -76.5 22.5t-26.5 54.5q0 25 14 41.5t35 16.5q17 0 27.5 -9.5t10.5 -26.5q0 -32 -25 -43q-13 -6 -13 -12q0 -8 10.5 -13t25.5 -5q42 0 67 33.5t25 71.5q0 25 -14 39.5t-41 14.5h-10q-20 0 -20 15t20 15z",
            adv_x: 296
        },
        TUPLET_4: {
            path: "M270 131h29q14 0 14 -14t-15 -14h-34q-8 0 -10 -8l-16 -50q-3 -13 4 -14l34 -3q13 -1 13 -14q0 -14 -15 -14h-168q-15 0 -15 14q0 12 14 14l35 3q8 1 12 10l17 55q1 7 -5 7h-136q-18 0 -18 13q0 7 10 17q64 64 100 116q38 55 55 112q4 11 13 11q6 0 22 -4.5t26 -4.5 q9 0 24.5 4.5t22.5 4.5q11 0 11 -8q0 -6 -5 -12q-36 -47 -94.5 -104.5t-117.5 -104.5q-5 -4 -5 -7q0 -5 8 -5h90q7 0 10 8l18 57q3 10 11 19l64 69q12 13 23 13q14 0 14 -9q0 -3 -4 -19l-41 -130q-1 -8 5 -8z",
            adv_x: 303
        },
        TUPLET_5: {
            path: "M55 192l55 161q6 17 22 17q10 0 27 -5q24 -8 60 -8q44 0 74 9l25 7q9 0 9 -9t-13 -22q-60 -56 -135 -56q-6 0 -39 3q-14 3 -18 -8l-15 -45q-2 -8 0.5 -11.5t13.5 -0.5q23 7 47 7q105 0 105 -82q0 -70 -45 -113.5t-115 -43.5q-50 0 -76.5 22.5t-26.5 54.5q0 25 14 41.5 t34 16.5q17 0 28 -9.5t11 -26.5q0 -32 -25 -43q-13 -6 -13 -12q0 -8 10.5 -13t25.5 -5q44 0 70.5 43t26.5 86q0 51 -46 51q-30 0 -60 -30q-10 -10 -19 -10q-16 0 -16 15q0 6 4 19z",
            adv_x: 317
        },
        TUPLET_6: {
            path: "M165 194q-26 0 -47.5 -26.5t-29.5 -65.5q-17 -84 37 -84q30 0 53.5 37.5t23.5 89.5q0 49 -37 49zM229 350q-74 -4 -118 -127q-4 -13 0.5 -16.5t11.5 2.5q28 21 71 21q42 0 65.5 -24.5t23.5 -61.5q0 -72 -47 -112t-108 -40q-59 0 -89 32t-28.5 80.5t17.5 104.5 q27 82 76 124t115 42q44 0 69.5 -20t25.5 -51q0 -25 -13.5 -40.5t-35.5 -15.5q-17 0 -29.5 10.5t-12.5 27.5q0 30 27 43q14 6 14 10q0 5 -10.5 8.5t-24.5 2.5z",
            adv_x: 304
        },
        TUPLET_7: {
            path: "M32 249l34 108q5 12 18 12t13 -9q0 -4 -2 -10.5t-2 -9.5q0 -4 3 -4q2 0 13 11q29 25 57 25q26 0 56 -20.5t45 -20.5q22 0 31 25q5 13 20 13t15 -11q0 -5 -2 -15q-23 -76 -90 -153q-26 -30 -43.5 -63t-25 -57t-16.5 -63q-2 -11 -13 -11q-7 0 -21 4.5t-22 4.5t-23.5 -4.5 t-22.5 -4.5q-9 0 -9 8q0 5 2 9q32 104 119 172q7 6 29 23t30.5 24.5t23 22.5t24.5 30q4 5 1 8.5t-9 -0.5q-31 -20 -62 -20q-20 0 -52.5 9.5t-45.5 9.5q-29 0 -45 -48q-4 -13 -18 -13q-12 0 -12 10q0 2 2 8z",
            adv_x: 303
        },
        TUPLET_8: {
            path: "M211 375q56 0 84 -23.5t28 -60.5q0 -54 -61 -86q-7 -4 -10.5 -6.5t-3 -6t2.5 -6t7 -8.5q26 -29 26 -71q0 -53 -43 -84t-105 -31t-94 26.5t-32 68.5q0 67 72 96q14 6 15 10.5t-7 13.5q-19 22 -19 59q0 51 38.5 80t101.5 29zM119 162q-46 -28 -46 -83q0 -26 15.5 -44.5 t49.5 -18.5q30 0 49.5 17.5t19.5 47.5q0 17 -12 31t-53 45q-13 11 -23 5zM209 351q-27 0 -44 -15t-17 -42q0 -17 10.5 -31t39.5 -35q13 -10 24 -4q39 27 39 74q0 53 -52 53z",
            adv_x: 313
        },
        TUPLET_9: {
            path: "M159 173q26 0 47.5 26.5t29.5 65.5q17 84 -37 84q-30 0 -53.5 -37.5t-23.5 -89.5q0 -49 37 -49zM95 17q74 4 118 127q4 13 -0.5 16.5t-11.5 -2.5q-28 -21 -71 -21q-42 0 -65.5 24.5t-23.5 61.5q0 72 47 112t108 40q59 0 89 -32t28.5 -80.5t-17.5 -104.5q-27 -82 -76 -124 t-115 -42q-44 0 -69.5 20t-25.5 51q0 25 13.5 40.5t35.5 15.5q17 0 29.5 -10.5t12.5 -27.5q0 -30 -27 -43q-14 -6 -14 -10q0 -5 10.5 -8.5t24.5 -2.5z",
            adv_x: 304
        },
        TUPLET_COLON: {
            path: "M47 58q-17 0 -27 11.5t-10 27.5q0 19 12 31t29 12q16 0 26.5 -11.5t10.5 -26.5q0 -19 -12 -31.5t-29 -12.5zM80 186q-17 0 -27 11.5t-10 27.5q0 19 12 31t29 12q16 0 26.5 -11.5t10.5 -26.5q0 -19 -12 -31.5t-29 -12.5z",
            adv_x: 111
        },
        AUGMENTATION_DOT: {path: "M100 0q0 -21 -14.5 -35.5t-35.5 -14.5t-35.5 14.5t-14.5 35.5t14.5 35.5t35.5 14.5t35.5 -14.5t14.5 -35.5z", adv_x: 100}
    };

    function makeShape(parent, shape_name, offset = true) { // TODO optimize
        let shape_props = SHAPES[shape_name];

        let shape = new Path(parent, shape_props.path);

        /*let shape = parent.addElement("use", {}, true, "http://www.w3.org/1999/xlink");
        shape.element.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#SYM" + shape_name);*/

        let offset_x = (offset && shape_props.offset_x !== undefined) ? shape_props.offset_x : 0;
        let offset_y = (offset && shape_props.offset_y !== undefined) ? shape_props.offset_y : 0;

        let shape_translation = new Translation(offset_x, offset_y);

        shape.addTransform(shape_translation);
        shape.addTransform(new ScaleTransform(0.04, -0.04));

        shape.translation = shape_translation;

        shape.adv_x = shape_props.adv_x * 0.04;

        return shape;
    }

    /*
    Commonly used shapes in the scores
     */

    function makeSharp(parent) {
        let sharp = new ScoreGroup(parent);

        let H1 = new Path(sharp, "m 2.66239772,10.6496172141 0,-5.40507744 1.5787195,-0.56191509" +
            "c 0.2675747,-0.1070381 0.4548811,-0.34785122 0.4548811,-0.61543003 l 0,-2.06035122 c 0,-0.37460869" +
            " -0.3211006,-0.66894497 -0.6956997,-0.66894497 -0.053567,0 -0.1605503,0 -0.2408323,0.0267561 l" +
            " -1.0970686,0.37461006 0,-5.45859375 1.5787195,-0.53515625 c 0.2675747,-0.1070381 0.4548811,-0.37461006 0.4548811,-0.66894634 l" +
            " 0,-2.03359238 c 0,-0.37461006 -0.3211006,-0.69569973 -0.6956997,-0.69569973 -0.053567,0 -0.1605503,0 -0.2408323,0.0535122 l" +
            " -1.0970686,0.40136616 0,-4.95019497 c 0,-0.34785122 -0.2675747,-0.6421875 -0.6154314,-0.6421875 -0.3210869,0 -0.6421875,0.29433628 -0.6421875,0.6421875 l" +
            " 0,5.40507881 -2.8363247,1.04355366 0,-4.95019497 c 0,-0.34785122 -0.29433354,-0.6421875 -0.64218613,-0.6421875 -0.34785122,0 -0.61543003,0.29433628 -0.61543003,0.6421875 l" +
            " 0,5.40507881 -1.55195244,0.56191372 c -0.29433628,0.1070381 -0.45488111,0.34785122 -0.45488111,0.61542866 l" +
            " 0,2.06035259 c 0,0.37460869 0.29433491,0.66894497 0.66894497,0.66894497 0.0802683,0 0.18730503,0 0.24081997,-0.0267561 l" +
            " 1.09706997,-0.37461006 0,5.45859375 -1.55195244,0.53515625 c -0.29433628,0.1070381 -0.45488111,0.37461006 -0.45488111,0.66894497 l" +
            " 0,2.03359512 c 0,0.37460869 0.29433491,0.69570244 0.66894497,0.69570244 0.0802683,0 0.18730503,0 0.24081997,-0.0535122 l" +
            " 1.09706997,-0.40136753 0,4.95019497 c 0,0.34785122 0.26757473,0.6421875 0.61543003,0.6421875 0.34785259,0 0.64218613,-0.29433628 0.64218613,-0.6421875 l" +
            " 0,-5.40507744 2.8363247,-1.04355503 0,4.95019497 c 0,0.34785122 0.3211006,0.6421875 0.6421875,0.6421875 0.3478567,0 0.6154314,-0.29433628 0.6154314,-0.6421875 z" +
            " m -4.0939436,-12.87050747 2.8363247,-1.01679756 0,5.45859375 -2.8363247,1.01679756 0,-5.45859375 z m 0,0");

        sharp.width = 6.855471611022949;
        sharp.minX = -sharp.width / 2;
        sharp.maxX = sharp.width / 2;
        sharp.type = "s";

        return sharp;
    }

    function makeAccidental(parent, params) {
        switch (params.type) {
            case "s":
                return makeSharp(parent);
            case "b":
                return makeFlat(parent);
            case "ss":
                return makeDoubleSharp(parent);
            case "bb":
                return makeDoubleFlat(parent);
            case "n":
                return makeNatural(parent);
        }
    }

    /*
    Abstract class of a score element
     */
    class ScoreElement extends ScoreGroup {
        constructor(parent, params = {}) {
            super(parent);
            this.param_list = [];

            let translation = new Translation();
            this.addTransform(translation);

            let bounding_box = {x: 0, y: 0, width: 0, height: 0};

            this.makeParam("bounding_box", () => {
                if (this.needs_bb_recalculate || this.needs_recalculate)
                    bounding_box = this.getBBox();
                
                return bounding_box;
            }, () => {
                throw new Error("Cannot set bounding box");
            });

            this.makeParam("offset_x", () => translation.x, (value) => {
                let delta = value - this.offset_x;
                translation.x = value;

                if (this.bounding_box) {
                    this.bounding_box.x += delta;
                }
            });

            this.makeParam("offset_y", () => translation.y, (value) => {
                let delta = value - this.offset_y;
                translation.y = value;

                if (this.bounding_box) {
                    this.bounding_box.y += delta;
                }
            });

            let duration = 0;

            this.makeSimpleParam("duration", {
                obj: duration,
                allow: [
                    (x) => (isNumeric(x) && x >= 0)
                ]
            });

            this.offset_x = select(params.offset_x, 0);
            this.offset_y = select(params.offset_y, 0);
            this.impl = {};

            this.duration = select(params.duration, 0);

            this.needs_recalculate = true;
            this.needs_bb_recalculate = true;
        }

        setParams(object) {
            for (let key in object) {
                if (object.hasOwnProperty(key) && this.param_list.includes(key)) {
                    this[key] = object[key];
                }
            }
        }

        recalculate(force = false) {
            if (!force && !this.needs_recalculate)
                return;

            this.needs_recalculate = false;

            if (this._recalculate)
                this._recalculate();

            this.needs_bb_recalculate = true;
            // propagate here
        }

        getParams() {
            let ret = {};

            for (let i = 0; i < this.param_list.length; i++) {
                let param = this.param_list[i];

                ret[param] = this[param];
            }

            if (this._getOtherParams)
                Object.assign(ret, this._getOtherParams());

            return ret;
        }

        makeParam(name, getter, setter) {

            Object.defineProperty(this, name, {
                set(v) {
                    setter(v);
                },
                get() {
                    return getter();
                }
            });

            this.param_list.push(name);
        }

        makeSimpleParam(name, params = {}) {
            params.mark = select(params.mark, true);

            if (params.allow) {
                let allowed = params.allow.map(x => (x instanceof Function) ? x : ((a) => a === x));

                this.makeParam(name, () => params.obj, (value) => {
                    assert(allowed.some(func => {
                        try {
                            return func(value)
                        } catch (e) {
                            return false;
                        }
                    }), `Invalid value ${value} for parameter ${name}`);

                    params.obj = value;

                    if (params.mark)
                        this.needs_recalculate = true;
                });
            } else {
                this.makeParam(name, () => params.obj, (value) => {
                    params.obj = value;
                });
            }
        }

        remove() {
            this.element.remove();

            this.parent.removeChild(this);
        }

        getBBox() {
            if (this.needs_recalculate)
                this.recalculate();
            if (!this.needs_bb_recalculate)
                return Object.assign({}, this.bounding_box);

            let box = (this._getBBox) ? this._getBBox() : this.element.getBBox();

            box.x += this.offset_x;
            box.y += this.offset_y;

            return box;
        }

        get minX() {
            return this.bounding_box.x;
        }

        set minX(value) {
            this.offset_x = value - this.minX;
        }

        get maxX() {
            return this.bounding_box.x + this.bounding_box.width;
        }

        set maxX(value) {
            this.offset_x = value - this.maxX;
        }

        get width() {
            return this.bounding_box.width;
        }

        get minY() {
            return this.bounding_box.y;
        }

        set minY(value) {
            this.offset_y = value - this.minY;
        }

        get maxY() {
            return this.bounding_box.y + this.bounding_box.height;
        }

        set maxY(value) {
            this.offset_y = value - this.maxY;
        }

        get height() {
            return this.bounding_box.height;
        }
    }

    /*
    Clef class

    Parameters:

    type, one of "g", "f", "treble", "bass", "alto", "tenor", "french violin", "baritone", "subbass", "baritoneC", "mezzosoprano", "soprano", or from CLEFS
    offset_x, inherited from Element
    translation.y, inherited from Element
     */

    const CLEFS = {
        TREBLE: "treble",
        BASS: "bass",
        ALTO: "alto",
        TENOR: "tenor",
        FRENCH_VIOLIN: "french violin",
        BARITONE: "baritone",
        SUBBASS: "subbass",
        BARITONEC: "baritoneC",
        MEZZOSOPRANO: "mezzosoprano",
        SOPRANO: "soprano"
    };

    class ElementClef extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);

            let type, change;

            this.makeSimpleParam("type", {
                obj: type,
                allow: [
                    ...Object.values(CLEFS)
                ]
            });
            
            this.makeSimpleParam("change", {
                obj: change,
                allow: [
                    true, false
                ]
            });

            this.type = select(params.type, "g");
            this.change = select(params.change, false); // is it a clef change
            
            this.impl.path = null;

            this.recalculate();
        }

        _recalculate() {
            if (this.impl.path)
                this.impl.path.destroy(); // Destroy the old path

            let addition = this.change ? "_CHANGE" : "";

            switch (this.type) {
                case "g":
                case "treble":
                    this.impl.path = makeShape(this, "G_CLEF" + addition);
                    this.impl.path.translation.y = 30;
                    break;
                case "f":
                case "bass":
                    this.impl.path = makeShape(this, "F_CLEF" + addition);
                    this.impl.path.translation.y = 10;
                    break;
                case "alto":
                    this.impl.path = makeShape(this, "C_CLEF" + addition);
                    this.impl.path.translation.y = 20;
                    break;
                case "tenor":
                    this.impl.path = makeShape(this, "C_CLEF" + addition);
                    this.impl.path.translation.y = 10;
                    break;
                case "french violin":
                    this.impl.path = makeShape(this, "G_CLEF" + addition);
                    this.impl.path.translation.y = 40;
                    break;
                case "baritone":
                    this.impl.path = makeShape(this, "F_CLEF" + addition);
                    this.impl.path.translation.y = 20;
                    break;
                case "subbass":
                    this.impl.path = makeShape(this, "F_CLEF" + addition);
                    break;
                case "baritoneC":
                    this.impl.path = makeShape(this, "C_CLEF" + addition);
                    break;
                case "mezzosoprano":
                    this.impl.path = makeShape(this, "C_CLEF" + addition);
                    this.impl.path.translation.y = 30;
                    break;
                case "soprano":
                    this.impl.path = makeShape(this, "C_CLEF");
                    this.impl.path.translation.y = 40;
                    break;
                default:
                    throw new Error(`Unrecognized clef type ${this.type}`);
            }
        }
    }

    /*
    Parameters:

    num, numerator of time signature
    den, denominator of time signature
    type: number, common, cut
     */
    class ElementTimeSig extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);
            
            let type, num, den;
            
            this.makeSimpleParam("type", {
                obj: type,
                allow: [
                    "number", "common", "cut"
                ]
            });
            
            this.makeSimpleParam("num", {
                obj: num,
                allow: [
                    x => (isInteger(x) && x > 0),
                    x => (x.split('+').every(c => {
                        let int_c = parseInt(c);
                        return isInteger(int_c) && int_c >= 0;
                    }))
                ]
            });
            
            this.makeSimpleParam("den", {
                obj: den,
                allow: [
                    x => (isInteger(x) && x > 0)
                ]
            });
            
            this.type = select(params.type, "number");
            this.num = select(params.num, 4);
            this.den = select(params.den, 4);
            
            this.impl.num_group = null;
            this.impl.den_group = null;

            this.recalculate();
        }

        _recalculate() {
            if (this.impl.num_group)
                this.impl.num_group.destroy();
            if (this.impl.den_group)
                this.impl.den_group.destroy();

            switch (this.type) {
                case "common":
                    this.impl.num_group = new ScoreGroup(this);

                    let common_time = makeShape(this.impl.num_group, "COMMON_TIME");

                    this.impl.num_group.addTransform(new Translation(0, 20));

                    break;
                case "cut":
                    this.impl.num_group = new ScoreGroup(this);

                    let cut_time = makeShape(this.impl.num_group, "CUT_TIME");

                    this.impl.num_group.addTransform(new Translation(0, 20));

                    break;
                case "number":
                    this.impl.num_group = new ScoreGroup(this);
                    this.impl.den_group = new ScoreGroup(this);

                    let num_string = '' + this.num;
                    let den_string = '' + this.den;

                    let offset_x = 0;

                    for (let i = 0; i < num_string.length; i++) {
                        let c = num_string.charAt(i);

                        assert((c >= '0' && c <= '9') || c === "+", `Invalid character ${c} in numerator`);

                        if (c === "+")
                            c = "NUM_ADD";

                        let character = makeShape(this.impl.num_group, "TIME_SIG_" + c);
                        character.translation.x = offset_x;

                        offset_x += character.adv_x;
                    }

                    let num_width = offset_x;

                    offset_x = 0;

                    for (let i = 0; i < den_string.length; i++) {
                        let c = den_string.charAt(i);

                        assert((c >= '0' && c <= '9'), `Invalid character ${c} in denominator`);

                        let character = makeShape(this.impl.den_group, "TIME_SIG_" + c);
                        character.translation.x = offset_x;

                        offset_x += character.adv_x;
                    }

                    let width = Math.max(num_width, offset_x);

                    this.impl.num_group.addTransform(new Translation((width - num_width) / 2, 10));
                    this.impl.den_group.addTransform(new Translation((width - offset_x) / 2, 30));

                    break;
                default:
                    throw new Error(`Unrecognized time signature type ${this._type}`);
            }
        }
    }

    function accidentalToShapeName(acc) {
        let PRE = "ACCIDENTAL_";

        switch (acc) {
            case "s":
                return PRE + "SHARP";
            case "ss":
                return PRE + "DOUBLE_SHARP";
            case "b":
                return PRE + "FLAT";
            case "bb":
                return PRE + "DOUBLE_FLAT";
            case "n":
                return PRE + "NATURAL";
            case "sss":
                return PRE + "TRIPLE_SHARP";
            case "bbb":
                return PRE + "TRIPLE_FLAT";
            case "nb":
                return PRE + "NATURAL_FLAT";
            case "ns":
                return PRE + "NATURAL_SHARP";
            default:
                throw new Error(`Unrecognized accidental ${acc}`);
        }
    }

    const boundingBoxes = {
        "n" : {x: 0, y: -13.64000129699707, height: 27.040000915527344, width: 6.720000267028809},
        "b" : {x: 0, y: -17.560001373291016, height: 24.560001373291016, width: 9.040000915527344},
        "ss" : {x: 0, y: -5.080000400543213, height: 10.080000877380371, width: 9.880001068115234},
        "bb" : {x: 0, y: -17.48000144958496, height: 24.48000144958496, width: 16.440000534057617},
        "sss" : {x: 0, y: -14.000000953674316, height: 27.920001983642578, width: 20.520002365112305},
        "bbb" : {x: 0, y: -17.560001373291016, height: 24.560001373291016, width: 23.840002059936523},
        "nb" : {x: 0, y: -17.560001373291016, height: 30.960002899169922, width: 18.360000610351562},
        "ns" : {x: 0, y: -14.000000953674316, height: 27.920001983642578, width: 19.240001678466797},
        "s" : {x: 0, y: -14.000000953674316, height: 27.920001983642578, width: 9.960000991821289}
    };


    /*
    Parameters:

    type, one of s (sharp), ss (double sharp), b (flat), bb (flat), n (natural),
    sss (triple sharp), bbb (triple flat), nb (natural flat), ns (natural sharp)
     */
    class ElementAccidental extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);
            
            let type = null;

            this.makeSimpleParam("type", {obj: type,
                allow: [
                    ...Object.keys(boundingBoxes)
                ]
            });

            this.type = select(params.type, "s");
            
            this.impl.shape = null;

            this.recalculate();
        }

        _getBBox() {
            return Object.assign({}, boundingBoxes[this.type]);
        }

        _recalculate() {
            if (this.impl.shape)
                this.impl.shape.destroy();

            this.impl.shape = makeShape(this, accidentalToShapeName(this.type));
        }
    }

    class ElementKeySig extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);

            this.accidentals = params.accidentals ? params.accidentals : [];
            this.accidental_objects = [];

            this.recalculate();
        }

        addAccidental(acc) {
            this.accidentals.push(acc);
            this.recalculate();
        }

        removeAccidental(index) {
            this.accidentals.splice(index, 1);
            this.recalculate();
        }

        recalculate(force = false) {
            try {
                if (!force && this.accidentals.every((x,i) => compareObjects(x, this._last_accidentals[i]))) { // Is everything the same?
                    return;
                }
            } catch (e) { // Might throw an IndexError, something changed!

            }

            this._last_accidentals = this.accidentals.map(x => {return {...x}});

            this.accidental_objects.forEach(x => x.destroy());
            this.accidental_objects = [];

            let offset_x = 0;

            for (let i = 0; i < this.accidentals.length; i++) {
                let accidental = new ElementAccidental(this, this.accidentals[i]);

                accidental.offset_x = offset_x;
                accidental.offset_y = this.accidentals[i].line * 10;

                offset_x += accidental.width + 2;

                this.accidental_objects.push(accidental);
            }

            this.bboxCalc();
        }
    }

    class ElementSpacer extends ScoreElement {
        constructor(parent, params) {
            super(parent);

            this.width_value = params.width;
            this.path = new Path(this, "");

            this.recalculate();
        }

        _recalculate() {
            this.path.d = `M 0 0 L ${this.width_value} 0`;
        }
    }

    class ElementPositioner extends ScoreElement {
        constructor(parent, params) {
            super(parent);

            this.x = params.x || 0;
            this.width = 0;
        }

        get minX() {
            return this.x;
        }

        set minX(value) {

        }

        get maxX() {
            return this.x;
        }

        set maxX(value) {

        }

        get minY() {
            return 0;
        }

        set minY(value) {

        }

        get maxY() {
            return 0;
        }

        set maxY(value) {

        }
    }

    class ElementNoteHead extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);

            let type;

            this.makeSimpleParam("type", {
                obj: type,
                allow: [
                    "normal", "half", "whole", "double", "none"
                ]
            });

            this.type = select(params.type, "normal");

            this.impl.shape = null;

            this.recalculate();
        }

        rightConnectionX() {
            switch (this.type) {
                case "normal":
                case "none":
                case "half":
                    return this.offset_x + 1.18 * 10;
                default:
                    throw new Error(`Note of type ${this.type} cannot have a connection`);
            }
        }

        leftConnectionX() {
            switch (this.type) {
                case "normal":
                case "none":
                case "half":
                    return this.offset_x;
                default:
                    throw new Error(`Note of type ${this.type} cannot have a connection`);
            }
        }

        rightConnectionY() {
            switch (this.type) {
                case "normal":
                case "none":
                case "half":
                    return this.offset_y - 0.168 * 10;
                default:
                    throw new Error(`Note of type ${this.type} cannot have a connection`);
            }
        }

        leftConnectionY() {
            switch (this.type) {
                case "normal":
                case "none":
                case "half":
                    return this.offset_y + 0.168 * 10;
                default:
                    throw new Error(`Note of type ${this.type} cannot have a connection`);
            }
        }

        recalculate() {
            if (this.impl.shape)
                this.impl.shape.destroy();

            switch (this.type) {
                case "normal":
                    this.impl.shape = makeShape(this, "NOTEHEAD_NORMAL");
                    break;
                case "half":
                    this.impl.shape = makeShape(this, "NOTEHEAD_HALF");
                    break;
                case "whole":
                    this.impl.shape = makeShape(this, "NOTEHEAD_WHOLE");
                    break;
                case "double":
                    this.impl.shape = makeShape(this, "NOTEHEAD_DOUBLE_WHOLE");
                    break;
                case "none":
                    break;
                default:
                    throw new Error(`Unrecognized notehead type ${this.type}`);
            }
        }

    }

    class ElementAugmentationDot extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);

            this.path = makeShape(this, "AUGMENTATION_DOT");

            this.recalculate();
        }

        getBBox() {
            return {x: this.offset_x, y: this.offset_y - 2, width: 4, height: 4};
        }

        _recalculate() {

        }
    }

    class ElementNote extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);

            let accidental, line, type;

            this.makeSimpleParam("line", {
                obj: line,
                allow: [
                    isNumeric
                ]
            });

            this.makeSimpleParam("type", {
                obj: type,
                allow: [
                    "normal", "half", "whole"
                ]
            });

            this.makeSimpleParam("accidental", {
                obj: accidental
            });

            this.line = select(params.line, 0);
            this.type = select(params.type, "normal");
            this.accidental = select(params.accidental, params.acc, "");

            this.impl.notehead = null;
            this.impl.accidental_object = null;

            this.recalculate();
        }

        _recalculate() {
            if (this.impl.notehead)
                this.impl.notehead.destroy();
            if (this.impl.accidental_object)
                this.impl.accidental_object.destroy();

            this.impl.notehead = new ElementNoteHead(this, {type: this.type});
            this.offset_y = this.line * 10;

            if (this.accidental)
                this.impl.accidental_object = new ElementAccidental(this, {type: this.accidental, offset_x: -12});
        }
    }

    class ElementStem extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);

            let y1, y2;

            this.makeSimpleParam("y1", {
                obj: y1,
                allow: [
                    isNumeric
                ]
            });

            this.makeSimpleParam("y2", {
                obj: y2,
                allow: [
                    isNumeric
                ]
            });

            this.y1 = select(params.y1, 0);
            this.y2 = select(params.y2, 0);

            this.impl.path = new Path(this, "");
            this.impl.path.addClass("note-stem");

            this.recalculate();
        }

        _recalculate() {
            this.impl.path.d = `M 0 ${this.y1} L 0 ${this.y2}`;
        }
    }

    class ElementFlag extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);

            let degree = 1;

            this.makeSimpleParam("degree", {
                obj: degree,
                allow: [
                    (x) => (isInteger(x) && inRange(x, 1, 8))
                ]
            });

            this.makeSimpleParam("orientation", {
                obj: degree,
                allow: [
                    "up", "down"
                ]
            });

            this.degree = select(params.degree, 1);
            this.orientation = select(params.orientation, "up");

            this.impl.shape = null;

            this.recalculate();
        }

        _recalculate() {
            if (this.impl.shape)
                this.impl.shape.destroy();

            let SHAPE_ID = "FLAG_" + (this.orientation.toUpperCase()) + "_" + this.degree;

            this.impl.shape = makeShape(this, SHAPE_ID);
        }
    }

    const STEM_THICKNESS = 2; // Move to defaults TODO

    class ElementChord extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, params);

            this.impl.chord_group = new ScoreGroup(this);

            this.notes = params.notes ? params.notes.map(x => new ElementNote(this.impl.chord_group, x)) : [];

            let articulation = "";
            this.makeSimpleParam("articulation", {obj: articulation});

            this.articulation = select(params.articulation, ".");

            let stem = "";
            this.makeSimpleParam("stem", {obj: stem, allow: [
                    (x) => !x, "up", "down"
                ]
            });

            this.stem = select(params.stem, "up"); // Values: falsy is none, "up" is upward facing stem, "down" is downward facing stem

            let flag = "";
            this.makeSimpleParam("flag", {obj: flag, allow: [
                    (x) => !x, (x) => (isInteger(x) && inRange(x, 0, 8))
                ]
            });

            this.flag = select(params.flag, 0); // Values: falsy is none (0 is natural here), 1 is eighth, 2 is sixteenth, etc. to 8 is 1024th

            let stem_y = 0;
            this.makeSimpleParam("stem_y", {obj: stem_y, allow: [
                    isNumeric
                ]
            });

            this.stem_y = select(params.stem_y, 35); // Extra amount stem from last note
            
            let dot_count = 0;
            this.makeSimpleParam("dot_count", {obj: dot_count, allow: [
                    (x) => (isInteger(x) && inRange(x, 0, 5))
                ]
            });
            
            this.dot_count = select(params.dot_count, 0);
            
            let force_y = 0;
            this.makeSimpleParam("force_y", {obj: force_y, allow: [
                    isNumeric, (x) => (x === null)
                ]
            });
            
            this.force_y = select(params.force_y, null); // Force the stem to go here and stop displaying the flag, for use in beaming

            this.impl.articulation_object = null;
            this.impl.stem_object = null;
            this.impl.flag_object = null;
            this.impl.dots = [];
            this.impl.lines = []; // extra lines when notes go beyond staff

            this.impl.centering_translation = new Translation();
            this.impl.chord_group.addTransform(this.impl.centering_translation);

            this.recalculate();
        }

        addNote(params = {}) {
            let note = new ElementNote(this.impl.chord_group, params);
            this.notes.push(note);

            this.needs_recalculate = true;

            return note;
        }

        removeNote(index) {
            this.notes[index].destroy();
            this.notes.splice(index, 1);

            this.needs_recalculate = true;
        }

        sortNotes() {
            this.notes.sort((n1, n2) => (n1.line - n2.line));
        }

        _recalculate() {
            if (this.impl.stem_object)
                this.impl.stem_object.destroy();
            if (this.impl.articulation_object)
                this.impl.articulation_object.destroy();
            if (this.impl.flag_object)
                this.impl.flag_object.destroy();

            this.impl.lines.forEach(x => x.destroy());
            this.impl.lines = [];

            this.impl.dots.forEach(x => x.destroy());
            this.impl.dots = [];

            this.sortNotes();

            let prevline = Infinity;
            let prev_connect = 1;

            let default_connect = (!this.stem) ? 0 : ((this.stem === "up") ? 0 : 1);

            let minConnectionY = Infinity;
            let maxConnectionY = -Infinity;

            let minX = Infinity;
            let maxX = -Infinity;

            let minlLineY = 5;
            let maxlLineY = -1;
            let minrLineY = 5;
            let maxrLineY = -1;

            let maxlLineX = -Infinity;

            let dot_positions = [];

            for (let i = this.notes.length - 1; i >= 0; i--) {
                let note = this.notes[i];

                if (note.line < prevline - 0.6) {
                    note.connectOn = default_connect; // 1 is right, 0 is left
                    note.offset_x = note.connectOn * (11.8 - STEM_THICKNESS / 2) - 11.8;
                } else {
                    note.connectOn = 1 - prev_connect;
                    note.offset_x = note.connectOn * (11.8 - STEM_THICKNESS / 2) - 11.8;
                }

                if (note.connectOn === 0) {
                    if (note.line < minlLineY)
                        minlLineY = Math.floor(note.line + 0.5);
                    if (note.line > maxlLineY)
                        maxlLineY = Math.ceil(note.line - 0.5);
                    let n_x = note.impl.notehead.maxX + note.offset_x;
                    if (n_x > maxlLineX)
                        maxlLineX = n_x;
                } else {
                    if (note.line < minrLineY)
                        minrLineY = Math.floor(note.line + 0.5);
                    if (note.line > maxrLineY)
                        maxrLineY = Math.ceil(note.line - 0.5);
                }

                let dot_y = Math.floor((note.offset_y + 5) / 10) * 10 - 5;

                if (dot_positions.includes(dot_y)) {
                    if (!dot_positions.includes(dot_y + 10))
                        dot_positions.push(dot_y + 10);
                } else {
                    dot_positions.push(dot_y);
                }

                if (this.stem) {
                    let connectionY = (note.connectOn ? note.impl.notehead.leftConnectionY() : note.impl.notehead.rightConnectionY()) + note.offset_y;

                    if (connectionY < minConnectionY)
                        minConnectionY = connectionY;
                    if (connectionY > maxConnectionY)
                        maxConnectionY = connectionY;
                }

                    let pminX = note.impl.notehead.minX + note.offset_x;
                    let pmaxX = note.impl.notehead.maxX + note.offset_x;

                    if (pminX < minX)
                        minX = pminX;
                    if (pmaxX > maxX)
                        maxX = pmaxX;

                    prevline = note.line;
                    prev_connect = note.connectOn;
            }

            if (!(this.force_y === null)) { // if there's a stem y value to be forced, use it
                if (minConnectionY > this.force_y) {
                    minConnectionY = this.force_y;
                } else if (maxConnectionY < this.force_y) {
                    maxConnectionY = this.force_y;
                }
            } else {
                if (this.stem === "up")
                    minConnectionY -= this.stem_y;
                else
                    maxConnectionY += this.stem_y;
            }

            if (this.notes.length === 0) {
                minConnectionY = 0;
                maxConnectionY = 0;
            }

            if (this.stem) { // If stem is not falsy then draw a stem
                if (this.flag && this.force_y === null) // Only draw when there's no stem y
                    this.impl.flag_object = new ElementFlag(this.impl.chord_group, {degree: this.flag, orientation: this.stem});

                this.impl.stem_object = new ElementStem(this.impl.chord_group, {y1: minConnectionY, y2: maxConnectionY});

                if (this.flag && this.force_y === null) {
                    this.impl.flag_object.offset_y = (this.stem === "up") ? this.impl.stem_object.y1 : this.impl.stem_object.y2;
                    this.impl.flag_object.offset_x = - STEM_THICKNESS / 2;
                }
            }

            for (let j = 0; j < dot_positions.length; j++) {
                let offset_x = maxX + 1.5;
                let dot_y = dot_positions[j];

                for (let i = 0; i < this.dot_count; i++) {
                    offset_x += 3.3;

                        this.impl.dots.push(new ElementAugmentationDot(this.impl.chord_group, {
                            offset_x: offset_x,
                            offset_y: dot_y
                        }));

                    offset_x += 2.2;
                }
            }

            for (let i = minlLineY; i < 0; i++) {
                let y = 10 * i;
                let p = new Path(this.impl.chord_group, `M ${minX - 3} ${y} L ${maxlLineX + 3} ${y}`);
                p.addClass("stave-line");
                this.impl.lines.push(p);
            }

            for (let i = 5; i <= maxlLineY; i++) {
                let y = 10 * i;
                let p = new Path(this.impl.chord_group, `M ${minX - 3} ${y} L ${maxlLineX + 3} ${y}`);
                p.addClass("stave-line");
                this.impl.lines.push(p);
            }

            for (let i = minrLineY; i < 0; i++) {
                let y = 10 * i;
                let p = new Path(this.impl.chord_group, `M -3 ${y} L ${maxX + 3} ${y}`);
                p.addClass("stave-line");
                this.impl.lines.push(p);
            }

            for (let i = 5; i <= maxrLineY; i++) {
                let y = 10 * i;
                let p = new Path(this.impl.chord_group, `M -3 ${y} L ${maxX + 3} ${y}`);
                p.addClass("stave-line");
                this.impl.lines.push(p);
            }

            let prevBoundingRects = [];

            for (let i = 0; i < this.notes.length; i++) {
                let note = this.notes[i];

                if (note.impl.accidental_object) {
                    let box = note.impl.accidental_object.getBBox();

                    box.x += note.offset_x;
                    box.y += note.offset_y;

                    let top_height = box.y - 2;
                    let bottom_height = box.y + box.height + 2;

                    let prev_intersect = minX;
                    let pos = Infinity;

                    prevBoundingRects.sort((x, y) => (x.x - y.x));

                    for (let j = prevBoundingRects.length - 1; j >= 0; j--) {
                        let rect = prevBoundingRects[j];

                        if (rect.y <= bottom_height && top_height <= rect.y + rect.height) {
                            if (rect.x + rect.width + 2 < prev_intersect - box.width) { // enough space, maybe?
                                pos = prev_intersect - box.width - 2;
                            }
                            prev_intersect = rect.x;
                        }
                    }

                    if (pos === Infinity)
                        pos = prev_intersect - box.width - 2;

                    note.impl.accidental_object.offset_x = pos - note.offset_x;
                    box = note.impl.accidental_object.getBBox();

                    box.x += note.offset_x;
                    box.y += note.offset_y;

                    prevBoundingRects.push(box);
                }
            }

            this.impl.centering_translation.x = ((this.stem === "up") ? 1 : -1) * (11.8 - STEM_THICKNESS / 2) / 2;
        }

        _getOtherParams() {
            return {
                notes: this.notes.map(note => note.getParams())
            }
        }
    }

    function get_class(params = {}) {
        assert(params.class, `Invalid element ${params}`);

        switch (params.class) {
            case "clef":
                return ElementClef;
            case "time":
                return ElementTimeSig;
            case "key":
                return ElementKeySig;
            case "space":
                return ElementSpacer;
            case "position":
                return ElementPositioner;
            case "chord":
                return ElementChord;
        }
    }

    function constructElement(parent, params = {}) {
        return new (get_class(params))(parent, params);
    }

    function buildElements(parent, json) {
        let elements = [];

        for (let i = 0; i < json.length; i++) {
            constructElement(parent, json[i]);
        }

        return elements;
    }

    function jsonifyElements(elements) { // Major TODO: implement getParams on all elements
    }

    // basic unit of manipulation
    class StaffMeasure extends ScoreGroup {
        constructor(parent, params = {}) {
            super(parent);

            let offset_x = (params.offset_x !== undefined) ? params.offset_x : 0;
            let offset_y = (params.offset_y !== undefined) ? params.offset_y : 0;

            this.measure_translation = new Translation(offset_x, offset_y);
            this.addTransform(this.measure_translation);

            this.elements = (params.elements) ? buildElements(params.elements) : [];
        }

        /*
        Useful internally and for editing things purely graphically (or doing things that are sneaky like with note positions)
         */
        addElement(params = {}) {
            let element = constructElement(this, params);

            this.elements.push(element);

            return element;
        }

        /*
        Calls addElement internally
         */
        addElements(...array) {
            if (array.length > 0 && Array.isArray(array[0])) {
                array = array[0];
            }

            let elements = [];

            for (let i = 0; i < array.length; i++) {
                elements.push(this.addElement(array[i]));
            }

            return elements;
        }

        /*
        Params:

        duration, the length of the note: default is "4"

        "1." gives dotted whole note
        "2.." gives double dotted half note
        8 gives eighth note

        line, the line position of the note: interchangeable with next, where 0 is first line and 0.5 is first space, default is undefined
        note, the actual note value:

        if this is used, the note will not actually graph properly until a Processor has gone through the score, and will default to line 0, unless clef is passed
        default is "C4", is effectively an argument to KeyboardNote

        clef, the clef used to calculate the line of the note, one of clef.js -> CLEFS, default is undefined
        acc, the accidental on the note, default is ""
         */
        addNote(params = {}) { // Friendly :)

        }

        addChord(params = {}) { // Friendly :)

        }

        addClef(params = {}) { // Friendly :)

        }

        addTime(params = {}) { // Friendly :)

        }

        getParams() {
            return {
                offset_x: this.measure_translation.x,
                offset_y: this.measure_translation.y,
                elements: jsonifyElements(this.elements)
            };
        }

        optimize(optimizer = this.context.score.optimizer) {
            optimizer.optimize(this);
        }
    }


    class Measure extends ScoreGroup {
        constructor(parent, params = {}) {
            super(parent);

            // Parameters
            this.height = params.height || DEFAULTS.MEASURE_HEIGHT;

            assert(this.height > 0, "Height must be positive");

            this.start_x = (params.start_x !== undefined) ? params.start_x : 0;
            this.end_x = (params.end_x !== undefined) ? params.end_x : 200;

            assert(this.start_x < this.end_x, "Start x must be smaller than end x");

            // Internal
            this.start_barline = new Barline(this, params.start_barline || {offset_x: this.start_x, barline_type: "normal", height: this.height});
            this.end_barline = new Barline(this, params.end_barline || {offset_x: this.end_x, barline_type: "normal", height: this.height});

            this.staff_measures = (params.staff_measures !== undefined) ?
                params.staff_measures.map(meas => new StaffMeasure(this, meas)) :
                [...Array(this.parent.staffs.length).keys()].map(index => new StaffMeasure(this));

            this.recalculate();
        }

        get _staffs() {
            return this.parent.staffs;
        }

        _setStartX(value) {
            this.start_x = value;

            assert(this.start_x < this.end_x, "Start x must be smaller than end x");

            this.recalculate();
        }

        _setEndX(value) {
            this.end_x = value;

            assert(this.start_x < this.end_x, "Start x must be smaller than end x");

            this.recalculate();
        }

        _addStaffMeasureBefore(index, params = {}) {
            this.staff_measures.splice(index, 0, new StaffMeasure(this, params));

            this.recalculate();
        }

        _getStaffMeasure(index) {
            return this.staff_measures[index];
        }

        _deleteStaffMeasure(index) {
            let measure = this.staff_measures[index];
            measure.destroy();
            this.staff_measures.splice(index, 1);

            this.recalculate();
        }

        startBarline() {
            return this.start_barline;
        }

        endBarline() {
            return this.end_barline;
        }

        staff(index) {
            return this.staff_measures[index];
        }

        recalculate() {
            // set start and end barline x positions

            this.start_barline.offset_x = this.start_x;
            this.end_barline.offset_x = this.end_x;

            this.start_barline.height = this.height;
            this.end_barline.height = this.height;

            // regenerate start and end barline

            this.start_barline.recalculate();
            this.end_barline.recalculate();

            for (let i = 0; i < this.staff_measures.length; i++) {
                let measure = this.staff_measures[i];

                measure.measure_translation.x = this.start_x;
                measure.measure_translation.y = this._staffs[i].stave_translation.y;

                measure.width = this.end_x - this.start_x;
            }
        }

        getParams() {
            return {
                height: this.height,
                start_x: this.start_x,
                end_x: this.end_x,
                start_barline: this.start_barline.getParams(),
                end_barline: this.end_barline.getParams(),
                staff_measures: this.staff_measures.map(meas => meas.getParams())
            };
        }

        get minY() {
            return 0;
        }

        get maxY() {
            return this.height;
        }

        optimize(optimizer = this.context.score.optimizer) {
            this.staff_measures.forEach(meas => meas.optimize(optimizer));
        }
    }

    class StaffLines extends ScoreGroup {
        constructor(parent, line_count = 5, width = parent.width, line_separation = DEFAULTS.STAFF_LINE_SEPARATION) {
            assert(parent instanceof Staff);

            super(parent);

            this.ian = 10;

            this._lines = [];
            this._width = width;
            this._line_count = line_count;

            this.recalculate();
        }

        get line_count() {
            return this._line_count;
        }

        get width() {
            return this._width;
        }

        set width(value) {
            this._width = value;
            this.recalculate();
        }

        set line_count(value) {
            this._line_count = value;
            this.recalculate();
        }

        recalculate() {
            let new_lines = [];

            for (let i = 0; i < this._lines.length; i++) {
                this._lines[i].destroy();
            }

            for (let i = 0; i < this.line_count; i++) {
                let xs = 0;
                let ys = i * DEFAULTS.STAFF_LINE_SEPARATION;
                let xe = this.width;
                let ye = ys;

                let line = new Path(this, `M ${xs} ${ys} L ${xe} ${ye}`);
                line.addClass("stave-line");

                new_lines.push(line);
            }

            this._lines = new_lines;
        }

        get maxY() {
            return (this.line_count - 1) * DEFAULTS.STAFF_LINE_SEPARATION;
        }

        get minY() {
            return 0;
        }

        get height() {
            return this.maxY - this.minY;
        }
    }

    class Staff extends ScoreGroup {
        constructor(parent, params = {}) {
            super(parent);

            this.width = params.width || parent.width;

            // Internal
            let lines = new StaffLines(this, 5);
            this.lines = lines;

            this.stave_translation = new Translation(0, (params.stave_translation_y !== undefined) ? params.stave_translation_y : 0);
            this.stave_spacing_y = (params.stave_spacing_y !== undefined) ? params.stave_spacing_y : 0;

            this.addTransform(this.stave_translation);

            this.recalculate();
        }

        recalculate() {
            this.lines.width = this.width;

            this.height = this.lines.height;
        }

        get minY() {
            return this.lines.minY;
        }

        get maxY() {
            return this.lines.maxY;
        }

        getParams() {
            return {
                stave_translation_y: this.stave_translation.y,
                stave_spacing_y: this.stave_spacing_y,
                width: this.width
            };
        }
    }

    /*
    Parameters:

    offset_x, offset_y -> master offset
    width -> width of stave
    staff_count -> number of staffs at initialization
    barline
     */
    class System extends ScoreElement {
        constructor(parent, params = {}) {
            super(parent, Object.assign({offset_x: DEFAULTS.STAVE_MARGIN_X, offset_y: DEFAULTS.STAVE_MARGIN_Y}, params));

            let width = 0;

            this.makeSimpleParam("width", {
                obj: width,
                allow: [
                    isNumeric
                ]
            });

            this.makeParam("right_margin_x", () => parent.width - this.offset_x - this.width, (x) => {
                this.width = parent.width - this.offset_x - x;
            });

            this.width = params.width || parent.width - 2 * this.offset_x;

            if (params.right_margin_x)
                this.right_margin_x = params.right_margin_x;

            let staff_count = select(params.staff_count, 0);
            this.staffs = (params.staffs !== undefined) ? params.staffs.map(staff => new Staff(this, staff)) : [];

            let measure_count = select(params.measure_count, 0);
            this.measures = (params.measures !== undefined) ? params.measures.map(measure => new Measure(this, measure)) : []; // Measures

            for (let i = 0; i < staff_count; i++)
                this.addStaff();
            for (let i = 0; i < measure_count; i++)
                this.addMeasure();

            this.recalculate();
        }

        addStaff(params = {}) {
            return this.addStaffAfter(this.staffs.length - 1, params);
        }

        addStaffs(count = 1, params = {}) {
            for (let i = 0; i < count; i++) {
                this.addStaff(params);
            }
        }

        addStaffBefore(index, params = {}) {
            assert(index >= 0 && index <= this.staffs.length);

            let staff = new Staff(this, params);
            let translation = new Translation();

            let spacing_y = params.spacing_y || DEFAULTS.STAFF_SEPARATION;

            assert(spacing_y > 0);

            staff.stave_spacing_y = spacing_y;

            this.staffs.splice(index, 0, staff);

            for (let i = 0; i < this.measures.length; i++) {
                let measure = this.measures[i];

                measure._addStaffMeasureBefore(index);
            }

            this.recalculate();

            return staff;
        }

        addStaffAfter(index, params = {}) {
            return this.addStaffBefore(index + 1, params);
        }

        deleteStaff(index) {
            let staff = this.staffs[index];
            staff.destroy();

            this.staffs.splice(index, 1);

            for (let i = 0; i < this.measures.length; i++) {
                let measure = this.measures[i];

                measure._deleteStaffMeasure(index);
            }
        }

        setStaffSpacing(index, spacing_y) {
            assert(spacing_y > 0);

            let staff = this.getStaff(index);

            staff.spacing_y = spacing_y;

            this.recalculate();
        }

        updateStaffHeights() {
            let last_y = 0;
            for (let i = 0; i < this.staffs.length; i++) {
                let staff = this.staffs[i];

                staff.stave_translation.y = last_y;

                last_y += staff.stave_spacing_y;
            }
        }

        lastStaff() {
            if (this.staffCount() <= 0) {
                return null;
            }

            return this.staffs[this.staffs.length - 1];
        }

        getStaff(index) {
            return this.staffs[index];
        }

        getStaffHeight(index) {
            return this.staffs[index].stave_translation.y;
        }

        getStaffIndex(staff) {
            let id;

            if (staff._id) {
                id = staff._id;
            } else {
                id = staff;
            }

            for (let i = 0; i < this.staffs.length; i++) {
                let staff = this.getStaff(i);

                if (staff._id === id) {
                    return i;
                }
            }

            return -1;
        }

        removeStaff(index) {
            this.staffs[index].staff.destroy();
            this.staffs.splice(index, 1);
        }

        rescaleMeasures() {
            if (this.measureCount() === 0) return;
            let prevWidth = this.getMeasure(this.measureCount() - 1).end_x;
            let width = this.width;

            if (prevWidth === width) return;

            for (let i = 0; i < this.measures.length - 1; i++) {
                this.setBarlineXAfter(i, this.getBarlineXAfter(i) / prevWidth * width);
            }
        }

        recalculate() {
            for (let i = 0; i < this.staffs.length; i++) {
                this.staffs[i].width = this.width;
                this.staffs[i].recalculate();
            }

            // Recalculate staff heights
            this.updateStaffHeights();

            // Rescale measures
            this.rescaleMeasures();

            let height = this.height;

            // Recalculate measures
            for (let i = 0; i < this.measures.length; i++) {
                this.measures[i].height = height;
                this.measures[i].recalculate();
            }
        }

        measureApply(func) {
            for (let i = 0; i < this.measures.length; i++) {
                func(this.measures[i], i);
            }
        }

        addMeasure(params = {}) {
            let width = this.width;
            let measure_count = this.measures.length + 1;

            let measure = new Measure(this, Object.assign({height: this.height}, params));

            let start_x = 0;
            let end_x = width;

            for (let i = 0; i < measure_count - 1; i++) {
                let measure = this.measures[i];

                measure.start_x = measure.start_x / (measure_count) * (measure_count - 1);
                measure.end_x = measure.end_x / (measure_count) * (measure_count - 1);

                start_x = measure.end_x;

                measure.recalculate();
            }

            measure.start_x = start_x;
            measure.end_x = end_x;

            this.measures.push(measure);

            measure.recalculate();

            this.recalculate();

            return measure;
        }

        addMeasures(count = 1, params = {}) {
            for (let i = 0; i < count; i++) {
                this.addMeasure(params);
            }
        }

        getBarlineBefore(index) {
            return this.getMeasure(index).start_barline;
        }

        getBarlineAfter(index) {
            return this.getMeasure(index).end_barline;
        }

        getBarlineXBefore(index) {
            return this.getMeasure(index).start_x;
        }

        getBarlineXAfter(index) {
            return this.getMeasure(index).end_x;
        }

        setBarlineXBefore(index, value) {
            assert(index > 0 && index < this.measures.length);

            this.getMeasure(index - 1).end_x = value;
            this.getMeasure(index).start_x = value;
        }

        setBarlineXAfter(index, value) {
            this.setBarlineXBefore(index + 1, value);
        }

        measureCount() {
            return this.measures.length;
        }

        getMeasure(index) {
            assert(index >= 0 && index < this.measures.length);

            return this.measures[index];
        }

        measure(index) {
            return this.getMeasure(index);
        }

        getMeasureIndex(measure) {
            let id;

            if (measure._id) {
                id = measure._id;
            } else {
                id = measure;
            }

            for (let i = 0; i < this.measures.length; i++) {
                let m = this.getMeasure(i);

                if (m._id === id) {
                    return i;
                }
            }

            return -1;
        }

        deleteMeasure(index) {
            assert(index >= 0 && index < this.measures.length);

            let measure_count = this.measures.length;

            let before = index;
            let after = measure_count - index - 1;

            let measure = this.getMeasure(index);

            let start_x = measure.start_x;
            let end_x = measure.end_x;

            let middle_x = (start_x * after + end_x * before) / (after + before);

            measure.destroy();
            this.measures.splice(index, 1);

            for (let i = 0; i < index; i++) {
                // Measures before the deleted measure

                this.setBarlineXAfter(i, this.getBarlineXAfter(i) / start_x * middle_x);
            }

            // Measures after the deleted measure
            for (let i = index; i < this.measures.length - 1; i++) {
                this.setBarlineXAfter(i, this.width - (this.width - this.getBarlineXAfter(i)) / start_x * middle_x);
            }

            this.recalculate();
        }

        insertMeasureAfter(index, params = {}) {

        }

        getParams() {
            return {
                offset_x: this.offset_x,
                offset_y: this.offset_y,
                width: this.width,
                measures: this.measures.map(meas => meas.getParams()),
                staffs: this.staffs.map(staff => staff.getParams())
            };
        }

        get height() {
            return (this.staffs.length >= 1) ? this.maxY - this.minY : 0;
        }

        get maxY() {
            if (this.staffs.length >= 1) {
                let last_staff = this.staffs[this.staffs.length - 1];
                return last_staff.stave_translation.y + last_staff.maxY;
            } else {
                return null;
            }
        }

        get minY() {
            if (this.staffs.length >= 1) {
                let first_staff = this.staffs[0];
                return first_staff.stave_translation.y + first_staff.minY;
            } else {
                return null;
            }
        }

        get leftMargin() {
            return this.offset_x;
        }

        set leftMargin(value) {
            this.offset_x = value;
            this.recalculate();
        }

        get rightMargin() {
            return this.right_margin_x;
        }

        set rightMargin(value) {
            this.right_margin_x = value;
            this.recalculate();
        }

        optimize(optimizer = this.context.score.optimizer) {
            this.measures.forEach(meas => meas.optimize(optimizer));
        }
    }

    function getExpression(x) {
        if (x instanceof Function) {
            return x;
        } else {
            return (() => x);
        }
    }

    /*
    Elements should have the following properties to help the optimizer:

    width() (width of object)
    minX() (current minX of object based off offset_x)
    maxX() current maxX of object based off offset_y)
    spacingX(state) (desired spacing after maxX for the element, given a state, allowing smarter spacing)

    state has the following structure:

    {
       width: width of measure,
       count: number of elements
    }
     */

    class Optimizer {
        constructor(params = {}) {
            this.left_margin = params.left_margin ? getExpression(params.left_margin) : getExpression(15);
            this.right_margin = params.right_margin ? getExpression(params.right_margin) : getExpression(15);

            this.move_barlines = (params.move_barlines !== undefined) ? params.move_barlines : false;
        }

        optimize(elem) {
            if (elem instanceof StaffMeasure) {
                this.optimizeStaffMeasure(elem);
            } else if (elem instanceof Measure) {
                this.optimizeMeasure(elem);
            } else if (elem instanceof System) {
                this.optimizeSystem(elem);
            }
        }

        optimizeStaffMeasure(staff_measure) {
            let elements = staff_measure.elements;
            let width = staff_measure.width;

            let start_x = this.left_margin(width);
            let end_x = width - this.right_margin(width);

            let lastSpacingX = start_x;

            for (let i = 0; i < elements.length; i++) {
                let element = elements[i];

                if (element instanceof ElementClef) {
                    element.minX = lastSpacingX;
                    lastSpacingX = element.maxX + 10;
                } else if (element instanceof ElementTimeSig) {
                    element.minX = lastSpacingX;
                    lastSpacingX = element.maxX + 10;
                } else {
                    element.minX = lastSpacingX;
                    lastSpacingX = element.maxX + 5;
                }
            }
        }

        optimizeMeasure(measure) {
            for (let i = 0; i < measure.staff_measures.length; i++) {
                this.optimizeStaffMeasure(measure.staff_measures[i]);
            }
        }

        optimizeSystem(system) {
            if (!this.move_barlines) {
                for (let i = 0; i < system.measures.length; i++) {
                    this.optimizeMeasure(system.measures[i]);
                }
            } else {
                for (let i = 0; i < system.measures.length; i++) {

                }
            }
        }
    }

    class Score {
        constructor(domElem, params = {}) {
            this.context = new ScoreContext(domElem);
            this.context.score = this;

            this.staff_count = params.staffs || 1;
            this.system_count = 0;

            assert(this.staff_count > 0 && this.staff_count < 13, "Number of staffs must be in the range [1, 12]");

            this.systems = [];
            this.optimizer = new Optimizer(params.optimizer || {});

            if (params.systems) {
                assert(params.systems > 0 && params.systems < 13, "Number of systems must be in the range [1, 12]");

                for (let i = 0; i < params.systems; i++) {
                    this.addSystem();
                }
            }
        }

        addSystem() {
            let system = new System(this.context, {
                staff_count: this.staff_count
            });

            system.spacing_y = 75;

            this.systems.push(system);
            this.system_count++;

            this.spaceSystems();
        }

        spaceSystems() {
            let offset_y = 20;

            for (let i = 0; i < this.systems.length; i++) {
                let system = this.systems[i];

                system.offset_y = offset_y;
                system.recalculate();

                offset_y += system.height + system.spacing_y;
            }
        }

        system(index) {
            return this.systems[index];
        }

        recalculate() {
            this.spaceSystems();
        }

        optimize() {
            this.systems.forEach(sys => this.optimizer.optimize(sys));
        }
    }

    // Polyfills

    exports.utils = utils;
    exports.a = a;
    exports.Instrument = Instrument;
    exports.masterEntryNode = masterEntryNode;
    exports.masterGainNode = masterGainNode;
    exports.masterAnalyzerNode = masterAnalyzerNode;
    exports.setMasterGain = setMasterGain;
    exports.masterMute = mute;
    exports.masterUnmute = unmute;
    exports.chainNodes = chainNodes;
    exports.contextTime = contextTime;
    exports.setTimeout = setTimeoutAudioCtx;
    exports.setTimeoutAbsolute = setTimeoutAbsoluteAudioCtx;
    exports.voidNode = voidNode;
    exports.ContextTimeout = ContextTimeout;
    exports.removeNodesTimeout = removeNodesTimeout;
    exports.Envelope = Envelope;
    exports.EnvelopeControlPoint = EnvelopeControlPoint;
    exports.EnvelopeVertical = EnvelopeVertical;
    exports.EnvelopeHorizontal = EnvelopeHorizontal;
    exports.LinearEnvelopeSegment = LinearEnvelopeSegment;
    exports.QuadraticEnvelopeSegment = QuadraticEnvelopeSegment;
    exports.ExponentialEnvelopeSegment = ExponentialEnvelopeSegment;
    exports.applySegmentsToParameter = applySegmentsToParameter;
    exports.EnvelopeVerticalInverse = EnvelopeVerticalInverse;
    exports.noteToName = noteToName;
    exports.nameToNote = nameToNote;
    exports.KeyboardPitch = KeyboardPitch;
    exports.KeyboardInterval = KeyboardInterval;
    exports.KeyboardIntervals = KeyboardIntervals;
    exports.KeyboardPitches = KeyboardPitches;
    exports.makeKeyboardPitch = makeKeyboardPitch;
    exports.makeKeyboardInterval = makeKeyboardInterval;
    exports.intervalToName = intervalToName;
    exports.KeyboardMapping = KeyboardMapping;
    exports.getDefaultKeyboardDict = getDefaultKeyboardDict;
    exports.SimpleInstrument = SimpleInstrument;
    exports.UnisonOscillator = UnisonOscillator;
    exports.Pitch = Pitch;
    exports.Interval = Interval;
    exports.makePitch = makePitch;
    exports.makeInterval = makeInterval;
    exports.TwelveTETIntervals = TwelveTETIntervals;
    exports.intervalUnits = intervalUnits;
    exports.PitchMapping = PitchMapping;
    exports.PitchMappings = PitchMappings;
    exports.pitchMappingFromScale = pitchMappingFromScale;
    exports.sclFileToScale = sclFileToScale;
    exports.parseSclExpression = parseSclExpression;
    exports.sclFileToPitchMapping = sclFileToPitchMapping;
    exports.ScalaReader = ScalaReader;
    exports.parseSclFile = parseSclFile;
    exports.Scales = Scales;
    exports.KeyboardNote = KeyboardNote;
    exports.PitchedInstrument = PitchedInstrument;
    exports.Reverb = Reverb;
    exports.Delay = Delay;
    exports.Filter = Filter;
    exports.LowpassFilter = LowpassFilter;
    exports.HighpassFilter = HighpassFilter;
    exports.FrequencyBumpFilter = FrequencyBumpFilter;
    exports.BandpassFilter = BandpassFilter;
    exports.NotchFilter = NotchFilter;
    exports.LowshelfFilter = LowshelfFilter;
    exports.HighshelfFilter = HighshelfFilter;
    exports.ParametricEQ = ParametricEQ;
    exports.SimpleFFT = SimpleFFT;
    exports.Downsampler = Downsampler;
    exports.computeFFT = computeFFTInPlace;
    exports.DownsamplerFFT = DownsamplerFFT;
    exports.MultilayerFFT = MultilayerFFT;
    exports.Note = Note;
    exports.makeNote = makeNote;
    exports.NoteGroup = NoteGroup;
    exports.parseAbbreviatedGroup = parseAbbreviatedGroup;
    exports.TimeContext = TimeContext;
    exports.FrequencyVisualizer = FrequencyVisualizer;
    exports.ArrayGrapher = ArrayGrapher;
    exports.stretchToCanvas = stretchToCanvas;
    exports.ScoreContext = ScoreContext;
    exports.ScoreGroup = ScoreGroup;
    exports.SVGContext = SVGContext;
    exports.SVGElement = SVGElement;
    exports.SVGGroup = SVGGroup;
    exports.Circle = Circle;
    exports.Rectangle = Rectangle;
    exports.Ellipse = Ellipse;
    exports.Text = Text;
    exports.Path = Path;
    exports.Polygon = Polygon;
    exports.Transformation = Transformation;
    exports.Translation = Translation;
    exports.getSVGID = getID$1;
    exports.MatrixTransform = MatrixTransform;
    exports.ScaleTransform = ScaleTransform;
    exports.Rotation = Rotation;
    exports.ChildUpdater = ChildUpdater;
    exports.SVGNS = SVGNS;
    exports.Score = Score;
    exports.Staff = Staff;
    exports.System = System;
    exports.Measure = Measure;
    exports.StaffMeasure = StaffMeasure;
    exports.Barline = Barline;
    exports.buildElements = buildElements;
    exports.jsonifyElements = jsonifyElements;
    exports.constructElement = constructElement;
    exports.ElementClef = ElementClef;
    exports.ElementTimeSig = ElementTimeSig;
    exports.ElementKeySig = ElementKeySig;
    exports.ElementSpacer = ElementSpacer;
    exports.ElementPositioner = ElementPositioner;
    exports.ElementNote = ElementNote;
    exports.ElementChord = ElementChord;
    exports.ElementFlag = ElementFlag;
    exports.Optimizer = Optimizer;
    exports.makeSharp = makeSharp;
    exports.makeAccidental = makeAccidental;
    exports.makeShape = makeShape;
    exports.SHAPES = SHAPES;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
