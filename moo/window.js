class DAWBar extends SVGGroup { // HTML class name: dawbar
    constructor(parent, params = {}) {
        utils.assert(parent instanceof DAWWindow, "parent of DAWWindow must be DAW");

        super(parent, 'g', params);

        this.addClass("dawbar");

        this.path = new TONES.Path(this);
    }

    get x() {
        return this.parent.x;
    }

    get y() {
        return this.parent.y;
    }

    get width() {
        return this.parent.width;
    }

    get height() {
        return this.parent.bar_height;
    }

    get edge_round() {
        return this.parent.edge_round;
    }

    get fill() {
        return this.path.fill;
    }

    set fill(value) {
        this.path.fill = value;
    }

    get allow_drag() {
        return this._allow_drag;
    }

    set allow_drag(value) {
        if (this._allow_drag && !value) {
            this.removeEventListener("mousedown", this.onClickEvent);
            this.removeEventListener("mouseup", this.onReleaseEvent);

            try {
                this.context.removeEventListener("mousemove", this.onDragEvent); // in case the object is destroyed while being dragged
            } catch(e) {

            }

            this._dragging = false;
            this.element.style.cursor = "default";
        } else if (!this._allow_drag && value) {
            this._dragging = false;

            let oce = this.onClickEvent = (evt) => {
                this._dragging = true;
                if (!this._lastEvent)
                    this._lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this.onDragEvent);
                this.context.addEventListener("mouseup", this.onReleaseEvent);
            };

            let ode = this.onDragEvent = (evt) => {
                if (!this._dragging)
                    return;

                if (!this._lastEvent)
                    this._lastEvent = {x: evt.x, y: evt.y};

                let le = this._lastEvent;

                let offsetx = evt.x - le.x;
                let offsety = evt.y - le.y;

                this.parent.x += offsetx;
                this.parent.y += offsety;

                this._lastEvent = {x: evt.x, y: evt.y};
            };

            let ore = this.onReleaseEvent = (evt) => {
                this._dragging = false;
                this._lastEvent = undefined;

                this.context.removeEventListener("mousemove", this.onDragEvent);
                this.context.removeEventListener("mouseup", this.onReleaseEvent);
            };

            this.addEventListener("mousedown", oce);

            this.element.style.cursor = "move";
        }

        this._allow_drag = value;
    }

    _destroy() {
        try {
            this.context.removeEventListener("mousemove", this.onDragEvent); // in case the object is destroyed while being dragged
        } catch(e) {

        }

        try {
            this.context.removeEventListener("mouseup", this.onReleaseEvent);
        } catch (e) {

        }
    }

    updateBarPath() {
        let er = this.edge_round;
        let w = this.width, h = this.height;

        if (er === this._er && w === this._w && h === this._h) // If nothing has changed
            return;

        this._er = er, this._w = w, this._h = h;

        let d = `M 0 ${er} a ${er} ${er} 0 0 1 ${er} ${-er} L ${w - er} 0 a ${er} ${er} 0 0 1 ${er} ${er} L ${w} ${h} L 0 ${h} Z`;

        this.path.d = d;
    }

}

function clamp(x, min, max) {
    if (x < min)
        return min;
    else if (x > max)
        return max
    else
        return x;
}

const RESIZE_SELECTOR_ENCROACH = 3.5;

class DAWWindow extends SVGGroup { // HTML class name: dawwindow
    constructor(parent, params = {}) {
        utils.assert(parent instanceof DAW, "parent of DAWWindow must be DAW");

        super(parent, 'g', params);

        this.addClass("dawwindow");

        this.translation = new TONES.Translation();
        this.transform.add(this.translation);

        this.background_rect = new TONES.Rectangle(this); // HTML class name: dawwindow-backgroundrect
        this.background_rect.addClass("dawwindow-backgroundrect");

        this.x = utils.select(params.x, 0);
        this.y = utils.select(params.y, 0);

        this.width = utils.select(params.width, 100);
        this.height = utils.select(params.height, 100);

        this.background_color = utils.select(params.bg_color, params.background_color, "#ddd");
        this.background_opacity = utils.select(params.bg_opacity, params.background_opacity, 1);

        this.edge_round = utils.select(params.edge_round, 5);

        this.bar_fill = utils.select(params.bar_fill, "#ccc");
        this.bar_height = utils.select(params.bar_height, 20);
        this.show_bar = utils.select(params.show_bar, true);
        this.allow_drag = utils.select(params.allow_drag, true);

        this.resize_thickness = utils.select(params.resize_thickness, 8);

        this.resize_s = utils.select(params.allow_resize, params.resize_s, true);
        this.resize_w = utils.select(params.allow_resize, params.resize_w, true);
        this.resize_e = utils.select(params.allow_resize, params.resize_e, true);
        this.resize_n = utils.select(params.allow_resize, params.resize_n, true);

        this.min_width = utils.select(params.min_width, 150);
        this.max_width = utils.select(params.max_width, Infinity);

        this.min_height = utils.select(params.min_height, 150);
        this.max_height = utils.select(params.max_height, Infinity);

        this.resize_nw = utils.select(params.allow_resize, params.resize_nw, true);
        this.resize_sw = utils.select(params.allow_resize, params.resize_sw, true);
        this.resize_ne = utils.select(params.allow_resize, params.resize_ne, true);
        this.resize_se = utils.select(params.allow_resize, params.resize_se, true);

        parent._markWindow(this);
    }

    close() {
        this.destroy();
    }

    get min_width() { return this._min_width; }
    set min_width(value) { this._min_width = value; if (this.width < this.min_width) this.width = this.min_width; }

    get max_width() { return this._max_width; }
    set max_width(value) { this._max_width = value; if (this.width > this.max_width) this.width = this.max_width; }

    get min_height() { return this._min_height; }
    set min_height(value) { this._min_height = value; if (this.height < this.min_height) this.height = this.min_height; }

    get max_height() { return this._max_height; }
    set max_height(value) { this._max_height = value; if (this.height > this.max_height) this.height = this.max_height; }

    get allow_drag() { return this._allow_drag; }
    set allow_drag(value) { this._allow_drag = value; this.updateBar(); }

    get x() { return this.translation.x; }
    get y() { return this.translation.y; }

    set x(value) { this.translation.x = value; }
    set y(value) { this.translation.y = value; }

    get width() { return this.background_rect.width; }
    get height() { return this.background_rect.height; }

    set width(value) { this.background_rect.width = clamp(value, this.min_width, this.max_width); this.resize(); }
    set height(value) { this.background_rect.height = clamp(value, this.min_height, this.max_height); this.resize(); }

    get background_color() { return this.background_rect.fill; }
    set background_color(value) { this.background_rect.fill = value; }

    get background_opacity() { return parseFloat(this.background_rect.opacity); }
    set background_opacity(value) { this.background_rect.opacity = value; }

    get bar_fill() { return this._bar_fill; }
    set bar_fill(value) { this._bar_fill = value; this.updateBar(); }

    get show_bar() {
        return !!this.bar;
    }

    set show_bar(value) {
        if (!this.bar && value) {
            this.bar = new DAWBar(this);
        } else if (this.bar && !value) {
            this.bar.destroy();
            this.bar = undefined;
        }

        this.updateBar();
    }

    get bar_height() { return this._bar_height; }
    set bar_height(value) { this._bar_height = value; this.updateBar(); }

    get edge_round() { return this.background_rect.rx; }
    set edge_round(value) { let rect = this.background_rect; rect.rx = rect.ry = value; }

    get resize_n() { return this._resize_n; }
    get resize_s() { return this._resize_s; }
    get resize_w() { return this._resize_w; }
    get resize_e() { return this._resize_e; }
    get resize_nw() { return this._resize_nw; }
    get resize_sw() { return this._resize_sw; }
    get resize_ne() { return this._resize_ne; }
    get resize_se() { return this._resize_se; }

    get resize_thickness() { return this._resize_thickness; }
    set resize_thickness(value) { this._resize_thickness = value; this._updateResizeSelectorsOnResize(); }

    set resize_n(value) {
        if (!this.resize_n && value) {
            let rect = this._resize_n_h_rect = new TONES.Rectangle(this);

            this._update_resize_n_rect_selector();

            rect.element.style.cursor = "ns-resize";

            rect.element.onmousedown = (evt) => {
                this._resize_n_dragging = true;
                if (!this._resize_n_lastEvent)
                    this._resize_n_lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this._onresize_n_mousemove);
                this.context.addEventListener("mouseup", this._onresize_n_mouseup);
            };

            this._onresize_n_mousemove = (evt) => {
                if (!this._resize_n_dragging)
                    return;

                if (!this._resize_n_lastEvent)
                    this._resize_n_lastEvent = {x: evt.x, y: evt.y};

                let le = this._resize_n_lastEvent;

                let offsety = evt.y - le.y;
                let ph = this.height;

                this.height -= offsety;
                this.y -= (this.height - ph);

                this._resize_n_lastEvent = {x: evt.x, y: evt.y};
            };

            this._onresize_n_mouseup = (evt) => {
                this._resize_n_dragging = false;
                this._resize_n_lastEvent = undefined;

                this.context.removeEventListener("mousemove", this._onresize_n_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_n_mouseup);
            };
        } else if (this.resize_n && !value) {
            this._resize_n_h_rect.destroy();

            try {
                this.context.removeEventListener("mousemove", this._onresize_n_mousemove);
            } catch (e) {

            }

            try {
                this.context.removeEventListener("mouseup", this._onresize_n_mouseup);
            } catch (e) {

            }
        }

        this._resize_n = value;
    }

    _update_resize_n_rect_selector() {
        let rect = this._resize_n_h_rect;
        if (!rect)
            return;
        let bh = this.resize_thickness;

        rect.x = bh + RESIZE_SELECTOR_ENCROACH;
        rect.y = -bh;
        rect.width = this.width - 2 * bh - 2 * RESIZE_SELECTOR_ENCROACH;
        rect.height = bh + RESIZE_SELECTOR_ENCROACH;
        rect.opacity = 0; // so that it isn't displayed
    }

    set resize_s(value) {
        if (!this.resize_s && value) {
            let rect = this._resize_s_h_rect = new TONES.Rectangle(this);

            this._update_resize_s_rect_selector();

            rect.element.style.cursor = "ns-resize";

            rect.element.onmousedown = (evt) => {
                this._resize_s_dragging = true;
                if (!this._resize_s_lastEvent)
                    this._resize_s_lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this._onresize_s_mousemove);
                this.context.addEventListener("mouseup", this._onresize_s_mouseup);
            };

            this._onresize_s_mousemove = (evt) => {
                if (!this._resize_s_dragging)
                    return;

                if (!this._resize_s_lastEvent)
                    this._resize_s_lastEvent = {x: evt.x, y: evt.y};

                let le = this._resize_s_lastEvent;

                let offsety = evt.y - le.y;
                this.height += offsety;

                this._resize_s_lastEvent = {x: evt.x, y: evt.y};
            };

            this._onresize_s_mouseup = (evt) => {
                this._resize_s_dragging = false;
                this._resize_s_lastEvent = undefined;

                this.context.removeEventListener("mousemove", this._onresize_s_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_s_mouseup);
            };
        } else if (this.resize_s && !value) {
            this._resize_s_h_rect.destroy();

            try {
                this.context.removeEventListener("mousemove", this._onresize_s_mousemove);
            } catch (e) {

            }

            try {
                this.context.removeEventListener("mouseup", this._onresize_s_mouseup);
            } catch (e) {

            }
        }

        this._resize_s = value;
    }

    _update_resize_s_rect_selector() {
        let rect = this._resize_s_h_rect;
        if (!rect)
            return;

        let bh = this.resize_thickness;

        rect.x = bh + RESIZE_SELECTOR_ENCROACH;
        rect.y = this.height - RESIZE_SELECTOR_ENCROACH;
        rect.width = this.width - 2 * bh - 2 * RESIZE_SELECTOR_ENCROACH;
        rect.height = bh + RESIZE_SELECTOR_ENCROACH;
        rect.opacity = 0; // so that it isn't displayed
    }

    set resize_e(value) {
        if (!this.resize_e && value) {
            let rect = this._resize_e_h_rect = new TONES.Rectangle(this);

            this._update_resize_e_rect_selector();

            rect.element.style.cursor = "ew-resize";

            rect.element.onmousedown = (evt) => {
                this._resize_e_dragging = true;
                if (!this._resize_e_lastEvent)
                    this._resize_e_lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this._onresize_e_mousemove);
                this.context.addEventListener("mouseup", this._onresize_e_mouseup);
            };

            this._onresize_e_mousemove = (evt) => {
                if (!this._resize_e_dragging)
                    return;

                if (!this._resize_e_lastEvent)
                    this._resize_e_lastEvent = {x: evt.x, y: evt.y};

                let le = this._resize_e_lastEvent;

                let offsetx = evt.x - le.x;
                this.width += offsetx;

                this._resize_e_lastEvent = {x: evt.x, y: evt.y};
            };

            this._onresize_e_mouseup = (evt) => {
                this._resize_e_dragging = false;
                this._resize_e_lastEvent = undefined;

                this.context.removeEventListener("mousemove", this._onresize_e_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_e_mouseup);
            };
        } else if (this.resize_e && !value) {
            this._resize_e_h_rect.destroy();

            try {
                this.context.removeEventListener("mousemove", this._onresize_e_mousemove);
            } catch (e) {

            }

            try {
                this.context.removeEventListener("mouseup", this._onresize_e_mouseup);
            } catch (e) {

            }
        }

        this._resize_e = value;
    }

    _update_resize_e_rect_selector() {
        let rect = this._resize_e_h_rect;
        if (!rect)
            return;

        let bh = this.resize_thickness;

        rect.x = this.width - RESIZE_SELECTOR_ENCROACH;
        rect.y = bh + RESIZE_SELECTOR_ENCROACH;
        rect.width = bh + RESIZE_SELECTOR_ENCROACH;
        rect.height = this.height - 2 * bh - 2 * RESIZE_SELECTOR_ENCROACH;
        rect.opacity = 0; // so that it isn't displayed
    }

    set resize_w(value) {
        if (!this.resize_w && value) {
            let rect = this._resize_w_h_rect = new TONES.Rectangle(this);

            this._update_resize_w_rect_selector();

            rect.element.style.cursor = "ew-resize";

            rect.element.onmousedown = (evt) => {
                this._resize_w_dragging = true;
                if (!this._resize_w_lastEvent)
                    this._resize_w_lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this._onresize_w_mousemove);
                this.context.addEventListener("mouseup", this._onresize_w_mouseup);
            };

            this._onresize_w_mousemove = (evt) => {
                if (!this._resize_w_dragging)
                    return;

                if (!this._resize_w_lastEvent)
                    this._resize_w_lastEvent = {x: evt.x, y: evt.y};

                let le = this._resize_w_lastEvent;

                let offsetx = evt.x - le.x;
                let pw = this.width;

                this.width -= offsetx;
                this.x -= this.width - pw;

                this._resize_w_lastEvent = {x: evt.x, y: evt.y};
            };

            this._onresize_w_mouseup = (evt) => {
                this._resize_w_dragging = false;
                this._resize_w_lastEvent = undefined;

                this.context.removeEventListener("mousemove", this._onresize_w_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_w_mouseup);
            };
        } else if (this.resize_w && !value) {
            this._resize_w_h_rect.destroy();

            try {
                this.context.removeEventListener("mousemove", this._onresize_w_mousemove);
            } catch (e) {

            }

            try {
                this.context.removeEventListener("mouseup", this._onresize_w_mouseup);
            } catch (e) {

            }
        }

        this._resize_w = value;
    }

    _update_resize_w_rect_selector() {
        let rect = this._resize_w_h_rect;
        if (!rect)
            return;

        let bh = this.resize_thickness;

        rect.x = -bh;
        rect.y = bh + RESIZE_SELECTOR_ENCROACH;
        rect.width = bh + RESIZE_SELECTOR_ENCROACH;
        rect.height = this.height - 2 * bh - 2 * RESIZE_SELECTOR_ENCROACH;
        rect.opacity = 0; // so that it isn't displayed
    }

    set resize_nw(value) {
        if (!this.resize_nw && value) {
            let rect = this._resize_nw_h_rect = new TONES.Rectangle(this);

            this._update_resize_nw_rect_selector();

            rect.element.style.cursor = "nwse-resize";

            rect.element.onmousedown = (evt) => {
                this._resize_nw_dragging = true;
                if (!this._resize_nw_lastEvent)
                    this._resize_nw_lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this._onresize_nw_mousemove);
                this.context.addEventListener("mouseup", this._onresize_nw_mouseup);
            };

            this._onresize_nw_mousemove = (evt) => {
                if (!this._resize_nw_dragging)
                    return;

                if (!this._resize_nw_lastEvent)
                    this._resize_nw_lastEvent = {x: evt.x, y: evt.y};

                let le = this._resize_nw_lastEvent;

                let offsetx = evt.x - le.x;
                let offsety = evt.y - le.y;

                let pw = this.width;
                let ph = this.height;

                this.width -= offsetx;
                this.height -= offsety;

                this.x += pw - this.width;
                this.y += ph - this.height;

                this._resize_nw_lastEvent = {x: evt.x, y: evt.y};
            };

            this._onresize_nw_mouseup = (evt) => {
                this._resize_nw_dragging = false;
                this._resize_nw_lastEvent = undefined;

                this.context.removeEventListener("mousemove", this._onresize_nw_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_nw_mouseup);
            };
        } else if (this.resize_nw && !value) {
            this._resize_nw_h_rect.destroy();

            try {
                this.context.removeEventListener("mousemove", this._onresize_nw_mousemove);
            } catch (e) {

            }

            try {
                this.context.removeEventListener("mouseup", this._onresize_nw_mouseup);
            } catch (e) {

            }
        }

        this._resize_nw = value;
    }

    _update_resize_nw_rect_selector() {
        let rect = this._resize_nw_h_rect;
        if (!rect)
            return;

        let bh = this.resize_thickness;

        rect.x = -bh;
        rect.y = -bh;
        rect.width = 2 * bh + RESIZE_SELECTOR_ENCROACH;
        rect.height = 2 * bh + RESIZE_SELECTOR_ENCROACH;
        rect.opacity = 0; // so that it isn't displayed
    }

    set resize_ne(value) {
        if (!this.resize_ne && value) {
            let rect = this._resize_ne_h_rect = new TONES.Rectangle(this);

            this._update_resize_ne_rect_selector();

            rect.element.style.cursor = "nesw-resize";

            rect.element.onmousedown = (evt) => {
                this._resize_ne_dragging = true;
                if (!this._resize_ne_lastEvent)
                    this._resize_ne_lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this._onresize_ne_mousemove);
                this.context.addEventListener("mouseup", this._onresize_ne_mouseup);
            };

            this._onresize_ne_mousemove = (evt) => {
                if (!this._resize_ne_dragging)
                    return;

                if (!this._resize_ne_lastEvent)
                    this._resize_ne_lastEvent = {x: evt.x, y: evt.y};

                let le = this._resize_ne_lastEvent;

                let offsetx = evt.x - le.x;
                let offsety = evt.y - le.y;

                let pw = this.width;
                let ph = this.height;

                this.width += offsetx;
                this.height -= offsety;

                this.y += ph - this.height;

                this._resize_ne_lastEvent = {x: evt.x, y: evt.y};
            };

            this._onresize_ne_mouseup = (evt) => {
                this._resize_ne_dragging = false;
                this._resize_ne_lastEvent = undefined;

                this.context.removeEventListener("mousemove", this._onresize_ne_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_ne_mouseup);
            };
        } else if (this.resize_ne && !value) {
            this._resize_ne_h_rect.destroy();

            try {
                this.context.removeEventListener("mousemove", this._onresize_ne_mousemove);
            } catch (e) {

            }

            try {
                this.context.removeEventListener("mouseup", this._onresize_ne_mouseup);
            } catch (e) {

            }
        }

        this._resize_ne = value;
    }

    _update_resize_ne_rect_selector() {
        let rect = this._resize_ne_h_rect;
        if (!rect)
            return;

        let bh = this.resize_thickness;

        rect.x = this.width - bh - RESIZE_SELECTOR_ENCROACH;
        rect.y = -bh;
        rect.width = 2 * bh + RESIZE_SELECTOR_ENCROACH;
        rect.height = 2 * bh + RESIZE_SELECTOR_ENCROACH;
        rect.opacity = 0; // so that it isn't displayed
    }

    set resize_sw(value) {
        if (!this.resize_sw && value) {
            let rect = this._resize_sw_h_rect = new TONES.Rectangle(this);

            this._update_resize_sw_rect_selector();

            rect.element.style.cursor = "nesw-resize";

            rect.element.onmousedown = (evt) => {
                this._resize_sw_dragging = true;
                if (!this._resize_sw_lastEvent)
                    this._resize_sw_lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this._onresize_sw_mousemove);
                this.context.addEventListener("mouseup", this._onresize_sw_mouseup);
            };

            this._onresize_sw_mousemove = (evt) => {
                if (!this._resize_sw_dragging)
                    return;

                if (!this._resize_sw_lastEvent)
                    this._resize_sw_lastEvent = {x: evt.x, y: evt.y};

                let le = this._resize_sw_lastEvent;

                let offsetx = evt.x - le.x;
                let offsety = evt.y - le.y;

                let pw = this.width;
                let ph = this.height;

                this.width -= offsetx;
                this.height += offsety;

                this.x += pw - this.width;

                this._resize_sw_lastEvent = {x: evt.x, y: evt.y};
            };

            this._onresize_sw_mouseup = (evt) => {
                this._resize_sw_dragging = false;
                this._resize_sw_lastEvent = undefined;

                this.context.removeEventListener("mousemove", this._onresize_sw_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_sw_mouseup);
            };
        } else if (this.resize_sw && !value) {
            this._resize_sw_h_rect.destroy();

            try {
                this.context.removeEventListener("mousemove", this._onresize_sw_mousemove);
            } catch (e) {

            }

            try {
                this.context.removeEventListener("mouseup", this._onresize_sw_mouseup);
            } catch (e) {

            }
        }

        this._resize_sw = value;
    }

    _update_resize_sw_rect_selector() {
        let rect = this._resize_sw_h_rect;
        if (!rect)
            return;

        let bh = this.resize_thickness;

        rect.x = -bh;
        rect.y = this.height - RESIZE_SELECTOR_ENCROACH - bh;
        rect.width = 2 * bh + RESIZE_SELECTOR_ENCROACH;
        rect.height = 2 * bh + RESIZE_SELECTOR_ENCROACH;
        rect.opacity = 0; // so that it isn't displayed
    }

    set resize_se(value) {
        if (!this.resize_se && value) {
            let rect = this._resize_se_h_rect = new TONES.Rectangle(this);

            this._update_resize_se_rect_selector();

            rect.element.style.cursor = "nwse-resize";

            rect.element.onmousedown = (evt) => {
                this._resize_se_dragging = true;
                if (!this._resize_se_lastEvent)
                    this._resize_se_lastEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this._onresize_se_mousemove);
                this.context.addEventListener("mouseup", this._onresize_se_mouseup);
            };

            this._onresize_se_mousemove = (evt) => {
                if (!this._resize_se_dragging)
                    return;

                if (!this._resize_se_lastEvent)
                    this._resize_se_lastEvent = {x: evt.x, y: evt.y};

                let le = this._resize_se_lastEvent;

                let offsetx = evt.x - le.x;
                let offsety = evt.y - le.y;

                this.width += offsetx;
                this.height += offsety;

                this._resize_se_lastEvent = {x: evt.x, y: evt.y};
            };

            this._onresize_se_mouseup = (evt) => {
                this._resize_se_dragging = false;
                this._resize_se_lastEvent = undefined;

                this.context.removeEventListener("mousemove", this._onresize_se_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_se_mouseup);
            };
        } else if (this.resize_se && !value) {
            this._resize_se_h_rect.destroy();

            try {
                this.context.removeEventListener("mousemove", this._onresize_se_mousemove);
            } catch (e) {

            }

            try {
                this.context.removeEventListener("mouseup", this._onresize_se_mouseup);
            } catch (e) {

            }
        }

        this._resize_se = value;
    }

    _update_resize_se_rect_selector() {
        let rect = this._resize_se_h_rect;
        if (!rect)
            return;

        let bh = this.resize_thickness;

        rect.x = this.width-bh-RESIZE_SELECTOR_ENCROACH;
        rect.y = this.height-bh-RESIZE_SELECTOR_ENCROACH;
        rect.width = 2 * bh + RESIZE_SELECTOR_ENCROACH;
        rect.height = 2 * bh + RESIZE_SELECTOR_ENCROACH;
        rect.opacity = 0; // so that it isn't displayed
    }

    _destroy() {
        try {
            this.context.removeEventListener("mousemove", this._onresize_n_mousemove);
        } catch (e) {

        }

        try {
            this.context.removeEventListener("mouseup", this._onresize_n_mouseup);
        } catch (e) {

        }
    }

    updateBar() {
        let bar = this.bar;
        if (!bar)
            return;

        bar.fill = this.bar_fill;
        bar.allow_drag = this.allow_drag;
        bar.updateBarPath();
    }

    _updateResizeSelectorsOnResize() {
        [
            this._update_resize_n_rect_selector,
            this._update_resize_s_rect_selector,
            this._update_resize_e_rect_selector,
            this._update_resize_w_rect_selector,
            this._update_resize_nw_rect_selector,
            this._update_resize_ne_rect_selector,
            this._update_resize_sw_rect_selector,
            this._update_resize_se_rect_selector
        ].forEach(x => (!x || x.call(this)));
    }

    resize() {
        let rect = this.background_rect;
        rect.x = rect.y = 0;

        this.updateBar();
        this._updateResizeSelectorsOnResize();
    }
}