const url = 'http://www.w3.org/2000/svg';
    
function circle(cx, cy, r, c) {
    let c1 = document.createElementNS(url, 'circle');
    c1.style.cx = cx;
    c1.style.cy = cy;
    c1.style.r = r;
    c1.style.fill = c;
    return c1;
}

function rect(x, y, w, h, c) {
    let r1 = document.createElementNS(url, 'rect');
    r1.style.x = x;
    r1.style.y = y;
    r1.style.width = w;
    r1.style.height = h;
    r1.style.fill = c;
    return r1;
}

function text(x, y, a, v, c) {
    let t1 = document.createElementNS(url, 'text');
    t1.setAttribute('x', x);
    t1.setAttribute('y', y);
    t1.style.fill = c;
    t1.innerHTML = v;
    t1.setAttribute('text-anchor', a);
    return t1;
}

function g() {
    return document.createElementNS(url, 'g');
}