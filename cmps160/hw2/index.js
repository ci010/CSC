/**
 * Global var for render tick per second
 */
const TPS = 60;


/**
 * Current drawing polyline
 * @type {Polyline}
 */
let polyline = [];

/**
 * @type {SimpleModel}
 */
const cylinders = { vertices: new Float32Array(0), indexes: new Uint16Array(0) };


/**
 * Flat the polyline to drawable array
 * 
 * @param {Polyline} line
 * @return Float32Array
 */
function flatPolyline(line) {
    const pos = new Float32Array(line.length * 3);
    for (let i = 0; i < line.length; i++) {
        const p = line[i];
        pos[i * 3] = p.elements[0];
        pos[i * 3 + 1] = p.elements[1];
        pos[i * 3 + 2] = p.elements[2];
    }
    return pos;
}

/**
 * 
 * @param {Matrix4} mat
 * @return {number[]}
 */
function flatMatrix(mat) {
    const e = mat.elements;
    return [
        e[12] * e[0] + e[13] * e[4] + e[14] * e[8],
        e[12] * e[1] + e[13] * e[5] + e[14] * e[9],
        e[12] * e[2] + e[13] * e[6] + e[14] * e[10],
    ]
}


/**
 * 
 * @param {Vector3} from 
 * @param {Vector3} to 
 */
function bakeIntersection(from, to, radius) {
    const mid = new Vector3([from.elements[0] + to.elements[0],
    from.elements[1] + to.elements[1],
    from.elements[2] + to.elements[2]])

    const len = radius / sinTheta(mid, from);
    const scalar = len / length(mid);
    scale(mid, scalar); // now mid is the translate of vertices
}

class CylinderPrototype {
    /**
     * 
     * @param {number} faces 
     * @param {number} radius 
     */
    constructor(faces, radius) {
        const rotAngle = 360.0 / faces;

        /**
         * @type {Vector3[]}
         */
        const vertices = [];

        const rot = new Matrix4();
        rot.setTranslate(0, 0, radius);

        for (let i = 0; i < faces; ++i) {
            vertices.push(new Vector3(flatMatrix(rot)));
            rot.rotate(rotAngle, 0, 1, 0);
        }
        this.vertices = vertices;
    }

    /**
     * 
     * @param {Vector3} vector 
     */
    at(vector) {

    }

    /**
     * @param {number} angle 
     */
    toAngle(angle) {
        return this.vertices.map(v => new Vector3(new Matrix4().setTranslate(v.elements[0], v.elements[1], v.elements[2])
            .rotate(angle, 0, 0, 0)))
    }
}

/**
 * @param {Polyline} polyline 
 * @param {number} faces 
 * @param {number} radius 
 * @return {SimpleModel}
 */
function bakeCylinders(polyline, faces, radius) {
    const vertices = [];
    const indexes = [];
    let index = 2;
    const rotAngle = 360.0 / faces;

    for (let i = 0; i < polyline.length - 1; ++i) {
        const from = polyline[i];
        const to = polyline[i + 1];


        const rot = new Matrix4();
        rot.setTranslate(0, 0, radius);

        const fmat = (m, t) => {
            const arr = flatMatrix(m);
            arr[0] += t.elements[0];
            arr[1] += t.elements[1];
            arr[2] += t.elements[2];
            return arr;
        }
        vertices.push(...fmat(rot, from));
        vertices.push(...fmat(rot, to));
        indexes.push(0, 1);

        const rotX = to.elements[0] - from.elements[0];
        const rotY = to.elements[1] - from.elements[1];
        const rotZ = to.elements[2] - from.elements[2];

        for (let i = 0; i < faces; ++i) {
            rot.rotate(rotAngle, rotX, rotY, rotZ);

            const flatUpper = fmat(rot, from);
            const flatLower = fmat(rot, to);

            vertices.push(...flatUpper);
            vertices.push(...flatLower);
            indexes.push(index - 1, index, index, index - 2); // complete first triangle

            indexes.push(index, index - 1, index - 1, index + 1, index + 1, index); // sec triagnle
            index += 2;
        }
    }
    return {
        vertices: new Float32Array(vertices),
        indexes: new Uint16Array(indexes),
    }
}

/**
 * 
 * @param {SimpleModel} dest 
 * @param {SimpleModel} incoming 
 */
function concatModel(dest, incoming) {
    const off = dest.vertices.length / 3;
    const vers = new Float32Array(dest.vertices.length + incoming.vertices.length);
    vers.set(dest.vertices);
    vers.set(incoming.vertices, dest.vertices.length);

    const ind = new Uint16Array(dest.indexes.length + incoming.indexes.length);
    ind.set(dest.indexes);
    ind.set(incoming.indexes.map(i => i + off), dest.indexes.length);

    dest.vertices = vers;
    dest.indexes = ind;
}


/**
 * @param {string} name 
 * @return {Promise<string>}
 */
function ldfile(name) {
    return new Promise((resolve, reject) => {
        loadFile(name, (content) => {
            resolve(content)
        })
    })
}

Matrix4.prototype.toString = function () {
    const e = this.elements;
    const str =
        `${e[0].toFixed(2)} ${e[4].toFixed(2)} ${e[8].toFixed(2)} ${e[12].toFixed(2)}
${e[1].toFixed(2)} ${e[5].toFixed(2)} ${e[9].toFixed(2)} ${e[13].toFixed(2)}
${e[2].toFixed(2)} ${e[6].toFixed(2)} ${e[10].toFixed(2)} ${e[14].toFixed(2)}
${e[3].toFixed(2)} ${e[7].toFixed(2)} ${e[11].toFixed(2)} ${e[15].toFixed(2)}
    `
    return str;
}

function main() {
    Promise.all([ldfile('shaders/basic.vert'), ldfile('shaders/basic.frag')])
        .then(setup);
}

function setup([VSHADER_SOURCE, FSHADER_SOURCE]) {


    /**
     * Caculate the point at x and y
     * 
     * @param {number} x
     * @param {number} y
     * @return {Vector3}
     */
    function point(x, y) {
        return new Vector3([
            x,
            y,
            0,
        ]);
    }

    /**
     * Flush current line and begin record new line
     */
    function flush() {
        if (polyline.length <= 1) return;
        console.log('You have finished drawing');
        let s = ''
        for (let i = 0; i < polyline.length; i += 2) {
            s += `(${polyline[i].x}, ${polyline[i].y}) `
        }
        console.log(`your polyline ${s}`);

        const faces = Number.parseInt(document.getElementById('face').value);
        const radius = Number.parseFloat(document.getElementById('width').value);

        console.log(`faces: ${faces}, radius: ${radius}`)

        concatModel(cylinders, bakeCylinders(polyline, faces, radius));

        polyline = [];
    }

    /******************
     * GL init section  
     ******************/

    const canvas = document.getElementById('webgl');
    const gl = getWebGLContext(canvas);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }
    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.');
        return;
    }
    const attr = (loc) => {
        const l = gl.getAttribLocation(gl.program, loc)
        if (l < 0)
            throw new Error(`Fail to get storage location of ${loc}`)
        return l;
    }

    /**
     * Convert mouse event to openGL coord position
     * 
     * @param {MouseEvent} ev 
     */
    const glPos = (ev) => {
        let x = ev.clientX; // x coordinate of a mouse pointer
        let y = ev.clientY; // y coordinate of a mouse pointer
        const rect = ev.target.getBoundingClientRect();

        x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
        y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);
        return { x, y };
    }

    const a_Position = attr('a_Position');
    const u_Color = gl.getUniformLocation(gl.program, 'u_Color');
    const b_Pos = gl.createBuffer();
    const ib_Pos = gl.createBuffer();
    if (!b_Pos) {
        console.log('Failed to create the buffer object');
        return -1;
    }
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    /********************
     * controller section
     ********************/

    const colorInput = document.getElementById('color');
    setupIOSOR("fileinput");


    document.getElementById('extra_sor').onclick = function () {
        const sor = readFile();      // get SOR from file
        if (sor) {
            cylinders.vertices = new Float32Array(sor.vertices);
            cylinders.indexes = new Uint16Array(sor.indexes);
        }
    }
    document.getElementById('save_canvas').onclick = function () {
        const sor = new SOR();
        sor.objName = "model";
        sor.vertices = cylinders.vertices;
        sor.indexes = cylinders.indexes;
        saveFile(sor);
    };
    document.getElementById('reset_canvas').onclick = function () {
        cylinders.indexes = new Uint16Array(0);
        cylinders.vertices = new Float32Array(0);
    };

    const tempPoint = { x: 0, y: 0 };
    canvas.onmousemove = function (ev) {
        const { x, y } = glPos(ev);
        tempPoint.x = x;
        tempPoint.y = y;
    };
    canvas.onmousedown = function (ev) {
        const { x, y } = glPos(ev);
        console.log(`x:${x} y:${y} ${ev.button === 0 ? 'left' : 'right'} click`);
        polyline.push(point(x, y));
        if (ev.button === 2) {
            flush();
            return false;
        }
    };
    colorInput.onchange = () => {
        const colors = hashToRGB(colorInput.value)
        gl.uniform3f(u_Color, colors[0], colors[1], colors[2]);
    }
    colorInput.onchange();


    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, b_Pos);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);


    /**
     * start render loop
     */
    setInterval(render, 1000 / TPS);

    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT);

        const renderTest = () => {
            const vertices = new Float32Array([
                0, 0, 0,
                0.2, 0, 0,
                0.2, 0.2, 0,
                0.4, 0.2, 0,
                -0.4, -0.2, 0]);
            const indexes = new Uint16Array([0, 1, 0, 2, 0, 3, 0, 4]);

            gl.bindBuffer(gl.ARRAY_BUFFER, b_Pos);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib_Pos);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexes, gl.STATIC_DRAW);

            gl.drawElements(gl.LINES, indexes.length, gl.UNSIGNED_SHORT, 0);
        }
        const renderLine = (line) => {
            if (line.length < 1) return;
            const pass = [...line];
            if (line === polyline) // if it's current drawing polyline
                pass.push(point(tempPoint.x, tempPoint.y)); // add temp point to draw
            const pos = flatPolyline(pass);

            gl.bindBuffer(gl.ARRAY_BUFFER, b_Pos);
            gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);

            gl.drawArrays(gl.LINE_STRIP, 0, pass.length);
        }
        const renderCylinder =
            /**
             * @param {Cylinder} cy
             */
            (cy) => {
                gl.bindBuffer(gl.ARRAY_BUFFER, b_Pos);
                gl.bufferData(gl.ARRAY_BUFFER, cy.vertices, gl.STATIC_DRAW);

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib_Pos);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cy.indexes, gl.STATIC_DRAW);

                gl.drawElements(gl.LINES, cy.indexes.length, gl.UNSIGNED_SHORT, 0);
            }
        renderLine(polyline);

        renderCylinder(cylinders);
    }
}
