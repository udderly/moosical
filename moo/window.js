class DAWButton extends SVGGroup { // a general button
    constructor(parent, params = {}) {
        super(parent, 'g', params);

        this.translation = new TONES.Translation();
        this.transform.add(this.translation);

        this.x = utils.select(params.x, 0);
        this.y = utils.select(params.y, 0);

        let evtFactory = (func) => {
            return (evt) => {
                if (evt) {
                    evt.stopPropagation();
                    evt.preventDefault();
                }
                func.call(this, evt);
            };
        };

        this.onMouseOver = evtFactory(this.over);
        this.onMouseDown = evtFactory(this.down);
        this.onMouseUp = evtFactory(this.up);
        this.onMouseOut = evtFactory(this.out);
        this.onClickEvent = evtFactory(this.click);

        this.allow_hover = utils.select(params.allow_hover, true);
        this.allow_click = utils.select(params.allow_click, true);
    }

    get x() { return this.translation.x; }
    get y() { return this.translation.y; }

    set x(value) { this.translation.x = value; }
    set y(value) { this.translation.y = value; }

    get allow_hover() { return this._allow_hover; }
    set allow_hover(value) {
        if (this._allow_hover && !value) {
            this.removeEventListener("mouseover", this.onMouseOver);
            this.removeEventListener("mouseout", this.onMouseOut);
        } else if (!this._allow_hover && value) {
            this.addEventListener("mouseover", this.onMouseOver);
            this.addEventListener("mouseout", this.onMouseOut);
        }

        this._allow_hover = value;
    }

    get allow_click() { return this._allow_click; }
    set allow_click(value) {
        if (this._allow_click && !value) {
            this.removeEventListener("click", this.onClickEvent);
            this.removeEventListener("mousedown", this.onMouseDown);
            this.removeEventListener("mouseup", this.onMouseUp);
        } else if (!this._allow_click && value) {
            this.addEventListener("click", this.onClickEvent);
            this.addEventListener("mousedown", this.onMouseDown);
            this.addEventListener("mouseup", this.onMouseUp);
        }

        this._allow_click = value;
    }

    _destroy() {
        this.removeEventListener("mouseover", this.onMouseOver);
        this.removeEventListener("mouseout", this.onMouseOut);
        this.removeEventListener("click", this.onClickEvent);
        this.removeEventListener("mousedown", this.onMouseDown);
        this.removeEventListener("mouseup", this.onMouseUp);
    }
}

const EXPAND_BUTTON_PATH = "M 0.25 0.35 L 0.25 0.75 L 0.65 0.75 L 0.25 0.35 M 0.35 0.25 L 0.75 0.25 L 0.75 0.65 L 0.35 0.25";
const MINIMIZE_BUTTON_PATH = "M 0.2 0.43 L 0.8 0.43 L 0.8 0.57 L 0.2 0.57 Z";
const X_BUTTON_PATH = "M 0.2 0.7 L 0.3 0.8 L 0.5 0.6 L 0.7 0.8 L 0.8 0.7 L 0.6 0.5 L 0.8 0.3 L 0.7 0.2 L 0.5 0.4 L 0.3 0.2 L 0.2 0.3 L 0.4 0.5 Z";

class DAWWindowButton extends DAWButton {
    constructor(parent, params = {}) {
        super(parent, params);

        this.button = new SVGGroup(this);

        this.onMouseOut();

        this.hover_path_scale = new TONES.ScaleTransform();
        this.path.transform.add(this.hover_path_scale);

        this.button_size = utils.select(params.button_size, 6.5);
        this.normal_color = utils.select(params.normal_color, "#8b8");
        this.click_color = utils.select(params.click_color, "#6a6");
        this.hover_path = utils.select(params.hover_path, EXPAND_BUTTON_PATH);
        this.hover_color = utils.select(params.hover_color, "#373");

        this.ispressed = false;

        this.element.style.cursor = "default";
    }

    get button_size() { return this.bgcircle.r; }
    get normal_color() { return this._normal_color; }
    get click_color() { return this._click_color; }
    get hover_path() { return this.bgcircle.fill; }
    get hover_color() { return this.bgcircle.fill; }

    set normal_color(value) {
        this._normal_color = value;

        if (!this.ispressed)
            this.bgcircle.fill = this.normal_color;
    }

    set click_color(value) {
        this._click_color = value;

        if (this.ispressed)
            this.bgcircle.fill = this.click_color;
    }

    set hover_path(value) {
        this.path.d = value;
    }

    set hover_color(value) {
        this.path.fill = value;
    }

    set button_size(value) {
        this.bgcircle.r = value;
        this.bgcircle.cx = value;
        this.bgcircle.cy = value;

        this.hover_path_scale.xs = 2 * value;
        this.hover_path_scale.ys = 2 * value;
    }

    get height() {
        return 2 * this.button_size;
    }

    get width() {
        return 2 * this.button_size;
    }

    over(evt) {
        this.path.display = "";
    }

    down(evt) {
        this.bgcircle.fill = this.click_color;

        this.ispressed = true;
    }

    up(evt) {
        this.bgcircle.fill = this.normal_color;

        this.ispressed = false;
    }

    out(evt) {
        if (!this.bgcircle)
            this.bgcircle = new TONES.Circle(this.button);
        if (!this.path)
            this.path = new TONES.Path(this.button, {d: this.hover_path || " "});
        this.path.display = "none";
    }
}

class DAWCloseButton extends DAWWindowButton {
    constructor(parent, params = {}) {
        super(parent, Object.assign({
            normal_color: "#d88",
            click_color: "#a66",
            hover_color: "#733",
            hover_path: X_BUTTON_PATH
        }, params));
    }
}

class DAWMinimizeButton extends DAWWindowButton {
    constructor(parent, params = {}) {
        super(parent, Object.assign({
            normal_color: "#dd8",
            click_color: "#aa6",
            hover_color: "#773",
            hover_path: MINIMIZE_BUTTON_PATH
        }, params));
    }
}

class DAWBar extends SVGGroup { // HTML class name: dawbar
    constructor(parent, params = {}) {
        utils.assert(parent instanceof DAWWindow, "parent of DAWWindow must be DAW");

        super(parent, 'g', params);

        this.addClass("dawbar");

        this.buttons = [];
        this.button_sep = utils.select(params.button_sep, 7.5);

        this.path = new TONES.Path(this);
        this.x_button = new DAWCloseButton(this);
        this.min_button = new DAWMinimizeButton(this);
        this.fs_button = new DAWWindowButton(this);

        this.buttons.push(this.x_button, this.min_button, this.fs_button);
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

    get button_sep() {
        return this._button_sep;
    }

    set button_sep(value) {
        this._button_sep = value;
        this.updateButtonPos();
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
                evt.stopPropagation();
                evt.preventDefault();

                this._dragging = true;
                if (!this._firstEvent)
                    this._firstEvent = {x: evt.x, y: evt.y};
                this.context.addEventListener("mousemove", this.onDragEvent);
                this.context.addEventListener("mouseup", this.onReleaseEvent);
            };

            let ode = this.onDragEvent = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._dragging)
                    return;

                if (!this._firstEvent)
                    this._firstEvent = {x: evt.x, y: evt.y};

                let le = this._firstEvent;

                let offsetx = evt.x - le.x;
                let offsety = evt.y - le.y;

                this.parent.x += offsetx;
                this.parent.y += offsety;

                this._firstEvent = {x: evt.x, y: evt.y};
            };

            let ore = this.onReleaseEvent = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._dragging = false;
                this._firstEvent = undefined;

                this.context.removeEventListener("mousemove", this.onDragEvent);
                this.context.removeEventListener("mouseup", this.onReleaseEvent);
            };

            this.addEventListener("mousedown", oce);

            // this.element.style.cursor = "move"; // cursor when hovering over bar
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

    updateButtonPos() {
        let x = this.height / 2 - (this.buttons.length > 0 ? this.buttons[0].height / 2 : 0);

        for (let i = 0; i < this.buttons.length; i++) {
            let button = this.buttons[i];

            button.x = x;
            button.y = this.height / 2 - button.height / 2;

            x += button.width + this.button_sep;
        }
    }

    updateBarPath() {
        let er = this.edge_round;
        let w = this.width, h = this.height;

        if (er === this._er && w === this._w && h === this._h) // If nothing has changed
            return;

        this._er = er, this._w = w, this._h = h;

        this.path.d = `M 0 ${er} a ${er} ${er} 0 0 1 ${er} ${-er} L ${w - er} 0 a ${er} ${er} 0 0 1 ${er} ${er} L ${w} ${h} L 0 ${h} Z`;

        this.updateButtonPos();
    }

}

function clamp(x, min, max) {
    if (x < min)
        return min;
    else if (x > max)
        return max;
    else
        return x;
}

const RESIZE_SELECTOR_ENCROACH = 1.8;

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
        this.bar_height = utils.select(params.bar_height, 35);
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
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_n_dragging = true;
                this.context.addEventListener("mousemove", this._onresize_n_mousemove);
                this.context.addEventListener("mouseup", this._onresize_n_mouseup);
            };

            this._onresize_n_mousemove = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._resize_n_dragging)
                    return;

                let ph = this.height;

                this.height += this.y - evt.y;
                this.y -= (this.height - ph);
            };

            this._onresize_n_mouseup = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_n_dragging = false;

                this.context.removeEventListener("mousemove", this._onresize_n_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_n_mouseup);
            };
        } else if (this.resize_n && !value) {
            this._resize_n_h_rect.destroy();
            this._resize_n_dragging = false;

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
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_s_dragging = true;

                this.context.addEventListener("mousemove", this._onresize_s_mousemove);
                this.context.addEventListener("mouseup", this._onresize_s_mouseup);
            };

            this._onresize_s_mousemove = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._resize_s_dragging)
                    return;

                this.height = evt.y - this.y;
            };

            this._onresize_s_mouseup = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_s_dragging = false;

                this.context.removeEventListener("mousemove", this._onresize_s_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_s_mouseup);
            };
        } else if (this.resize_s && !value) {
            this._resize_s_h_rect.destroy();
            this._resize_s_dragging = false;

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
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_e_dragging = true;

                this.context.addEventListener("mousemove", this._onresize_e_mousemove);
                this.context.addEventListener("mouseup", this._onresize_e_mouseup);
            };

            this._onresize_e_mousemove = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._resize_e_dragging)
                    return;
                this.width = evt.x - this.x;
            };

            this._onresize_e_mouseup = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_e_dragging = false;

                this.context.removeEventListener("mousemove", this._onresize_e_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_e_mouseup);
            };
        } else if (this.resize_e && !value) {
            this._resize_e_h_rect.destroy();
            this._resize_e_dragging = false;

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
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_w_dragging = true;

                this.context.addEventListener("mousemove", this._onresize_w_mousemove);
                this.context.addEventListener("mouseup", this._onresize_w_mouseup);
            };

            this._onresize_w_mousemove = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._resize_w_dragging)
                    return;

                let pw = this.width;

                this.width -= evt.x - this.x;
                this.x -= this.width - pw;
            };

            this._onresize_w_mouseup = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_w_dragging = false;

                this.context.removeEventListener("mousemove", this._onresize_w_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_w_mouseup);
            };
        } else if (this.resize_w && !value) {
            this._resize_w_h_rect.destroy();
            this._resize_w_dragging = false;

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
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_nw_dragging = true;

                this.context.addEventListener("mousemove", this._onresize_nw_mousemove);
                this.context.addEventListener("mouseup", this._onresize_nw_mouseup);
            };

            this._onresize_nw_mousemove = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._resize_nw_dragging)
                    return;

                let pw = this.width;
                let ph = this.height;

                this.width -= evt.x - this.x;
                this.height -= evt.y - this.y;

                this.x += pw - this.width;
                this.y += ph - this.height;
            };

            this._onresize_nw_mouseup = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_nw_dragging = false;

                this.context.removeEventListener("mousemove", this._onresize_nw_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_nw_mouseup);
            };
        } else if (this.resize_nw && !value) {
            this._resize_nw_h_rect.destroy();
            this._resize_nw_dragging = false;

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
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_ne_dragging = true;

                this.context.addEventListener("mousemove", this._onresize_ne_mousemove);
                this.context.addEventListener("mouseup", this._onresize_ne_mouseup);
            };

            this._onresize_ne_mousemove = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._resize_ne_dragging)
                    return;

                let pw = this.width;
                let ph = this.height;

                this.width = evt.x - this.x;
                this.height -= evt.y - this.y;

                this.y += ph - this.height;
            };

            this._onresize_ne_mouseup = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_ne_dragging = false;

                this.context.removeEventListener("mousemove", this._onresize_ne_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_ne_mouseup);
            };
        } else if (this.resize_ne && !value) {
            this._resize_ne_h_rect.destroy();
            this._resize_ne_dragging = false;

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
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_sw_dragging = true;

                this.context.addEventListener("mousemove", this._onresize_sw_mousemove);
                this.context.addEventListener("mouseup", this._onresize_sw_mouseup);
            };

            this._onresize_sw_mousemove = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._resize_sw_dragging)
                    return;

                let pw = this.width;

                this.width -= evt.x - this.x;
                this.height = evt.y - this.y;

                this.x += pw - this.width;
            };

            this._onresize_sw_mouseup = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_sw_dragging = false;

                this.context.removeEventListener("mousemove", this._onresize_sw_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_sw_mouseup);
            };
        } else if (this.resize_sw && !value) {
            this._resize_sw_h_rect.destroy();
            this._resize_sw_dragging = false;

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
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_se_dragging = true;

                this.context.addEventListener("mousemove", this._onresize_se_mousemove);
                this.context.addEventListener("mouseup", this._onresize_se_mouseup);
            };

            this._onresize_se_mousemove = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                if (!this._resize_se_dragging)
                    return;

                this.width = evt.x - this.x;
                this.height = evt.y - this.y;
            };

            this._onresize_se_mouseup = (evt) => {
                evt.stopPropagation();
                evt.preventDefault();

                this._resize_se_dragging = false;

                this.context.removeEventListener("mousemove", this._onresize_se_mousemove);
                this.context.removeEventListener("mouseup", this._onresize_se_mouseup);
            };
        } else if (this.resize_se && !value) {
            this._resize_se_h_rect.destroy();
            this._resize_se_dragging = false;

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

    get dragging() {
        return this._resize_se_dragging ||
            this._resize_sw_dragging ||
            this._resize_ne_dragging ||
            this._resize_nw_dragging ||
            this._resize_n_dragging ||
            this._resize_s_dragging ||
            this._resize_w_dragging ||
            this._resize_e_dragging;
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

const HTMLNS = "http://www.w3.org/1999/xhtml";

class HTMLDAWWindow extends DAWWindow {
    constructor(parent, params = {}) {
        super(parent, params);

        this.html_top_margin = utils.select(params.html_top_margin, 10);
        this.html_bottom_margin = utils.select(params.html_bottom_margin, 10);
        this.html_right_margin = utils.select(params.html_right_margin, 10);
        this.html_left_margin = utils.select(params.html_left_margin, 10);

        let html = this.html = new SVGGroup(this, 'foreignObject');
        this.html_translation = new TONES.Translation();
        html.addTransform(this.html_translation);

        html.set("width", super.width);
        html.set("height", super.height);

        let body = this.body = this.html.element.appendChild(document.createElementNS(HTMLNS, "body"));

        this.updateHTMLPos();
    }

    updateHTMLPos() {
        if (this.html) {
            let width = super.width, height = super.height;

            let lm = this.html_translation.x = this.html_left_margin;
            let tm = this.html_translation.y = this.html_top_margin + this.bar_height;

            let hwidth = Math.max(super.width - this.html_right_margin - lm, 0);
            let hheight = Math.max(super.height - tm - this.html_bottom_margin);

            this.html.set("width", hwidth);
            this.html.set("height", hheight);

            this.body.style.overflowY = "scroll";
        }
    }

    get html_top_margin() {
        return this._html_top_margin;
    }

    set html_top_margin(value) {
        this._html_top_margin = value;
        this.updateHTMLPos();
    }

    get html_bottom_margin() {
        return this._html_bottom_margin;
    }

    set html_bottom_margin(value) {
        this._html_bottom_margin = value;
        this.updateHTMLPos();
    }

    get html_right_margin() {
        return this._html_right_margin;
    }

    set html_right_margin(value) {
        this._html_right_margin = value;
        this.updateHTMLPos();
    }

    get html_left_margin() {
        return this._html_left_margin;
    }

    set html_left_margin(value) {
        this._html_left_margin = value;
        this.updateHTMLPos();
    }

    get width() { return super.width; }
    get height() { return super.height; }

    set width(value) {
        super.width = value;
        this.updateHTMLPos();
    }

    set height(value) {
        super.height = value;
        this.updateHTMLPos();
    }
}