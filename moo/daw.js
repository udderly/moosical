

class DAW extends SVGContext { // HTML class name: daw
    constructor(domElem, params = {}) {
        super(domElem, params);

        this.use_zindex = utils.select(params.use_zindex, true);
        this.autoresize = utils.select(params.autoresize, true);

        this.windows = [];

        this.addClass("daw");
        this.resize();
    }

    resize() {
        let boundingRect = this.element.getBoundingClientRect();

        [this.width, this.height] = [boundingRect.width, boundingRect.height];

        return this;
    }

    get autoresize() {
        return this._autoresize;
    }

    set autoresize(value) {
        if (value && !this.autoresize) {
            let _resizeListenerFunction = () => this.resize();
            window.addEventListener("resize", _resizeListenerFunction);
        } else if (!value && this.autoresize) {
            window.removeEventListener("resize", this._resizeListenerFunction);
        }

        this._autoresize = value;
    }

    _markWindow(window) {
        utils.assert(window instanceof DAWWindow, "_markWindow called on non-DAWWindow");

        this.windows.push(window);
    }
}