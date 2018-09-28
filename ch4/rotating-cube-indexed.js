// This is a WebGL example that draws a cube with each face a different color. The cube is
// rotated with the mouse clicking and dragging. The drawing is done with an index array.
/* exported cube tetrahedron */

// Global WebGL context variable
let gl;

// Global list of vertices being drawn
let inds = [];

// Location of the transform uniform
let transform_loc;

// Current rotation angle around the X, Y, and Z axes
let thetas = [0,0,0];

// Current position of the cube
let position = [0,0,0];

// Current scale of the cube
let cur_scale = 1;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;


window.addEventListener('load', function init() {
	// Get the HTML5 canvas object from it's ID
	const canvas = document.getElementById('gl-canvas');

	// Get the WebGL context (save into a global variable)
	gl = WebGLUtils.create3DContext(canvas);
	if (!gl) {
		window.alert("WebGL isn't available");
		return;
	}

	// Configure WebGL
	onResize();
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden

	// Create a cube
	let verts = [];
	cube(
		vec3(-0.5, -0.5, -0.5),
		vec3( 0.5, -0.5, -0.5),
		vec3( 0.5,  0.5, -0.5),
		vec3(-0.5,  0.5, -0.5),
		vec3(-0.5,  0.5,  0.5),
		vec3( 0.5,  0.5,  0.5),
		vec3( 0.5, -0.5,  0.5),
		vec3(-0.5, -0.5,  0.5),
		verts, inds);
	let colors = [];
	let red = vec4(1.0, 0.0, 0.0, 1.0);
	let grn = vec4(0.0, 1.0, 0.0, 1.0);
	let blu = vec4(0.0, 0.0, 1.0, 1.0);
	let org = vec4(1.0, 0.5, 0.0, 1.0);
	let ylw = vec4(1.0, 1.0, 0.0, 1.0);
	let mag = vec4(1.0, 0.0, 1.0, 1.0);
	let cyn = vec4(0.0, 1.0, 1.0, 1.0);
	let blk = vec4(0.0, 0.0, 0.0, 1.0);
	colors.push(red, grn, blu, org, ylw, blk, mag, cyn);

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec4 vColor;
		varying vec4 fColor;
		uniform mat4 transform;
		void main() {
			gl_Position = transform*vPosition;
			fColor = vColor;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		varying vec4 fColor;
		void main() {
			gl_FragColor = fColor;
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Load the vertex data into the GPU and associate with shader
	let bufferId = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
	gl.bufferData(gl.ARRAY_BUFFER, flatten(verts), gl.STATIC_DRAW); // load the flattened data into the buffer
	let vPosition = gl.getAttribLocation(program, 'vPosition'); // get the vertex shader attribute "vPosition"
	gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Load the color data into the GPU and associate with shader
	bufferId = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW); // load the flattened data into the buffer
	let vColor = gl.getAttribLocation(program, 'vColor'); // get the vertex shader attribute "vColor"
	gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vColor" making sure it knows it is length-4 vectors of floats
	gl.enableVertexAttribArray(vColor); // enable this set of data

	bufferId = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW); // load the flattened data into the buffer

	// Get the location of the transform uniform
	transform_loc = gl.getUniformLocation(program, 'transform');

	// Add just the mouse-down handler initially
	canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Render the static scene
	render();
});

/**
 * Render the scene.
 */
function render() {
	// Update the transformation
	let m = rotateX(thetas[0]);
	m = mult(rotateY(thetas[1]), m);
	m = mult(rotateZ(thetas[2]), m);
	m = mult(translate(position[0], position[1], position[2]), m);
	m = mult(scalem(cur_scale, cur_scale, cur_scale), m);
	gl.uniformMatrix4fv(transform_loc, false, flatten(m));

	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawElements(gl.TRIANGLES, inds.length, gl.UNSIGNED_SHORT, 0);

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * Get the mouse coordinates in object-space as a vec2 from the MouseEvent.
 */
function mouse_coords(evt) {
	let t = evt.currentTarget;
	let x = evt.clientX - t.clientLeft - t.getBoundingClientRect().left + t.scrollLeft;
	let y = evt.clientY - t.clientTop - t.getBoundingClientRect().top + t.scrollTop;
	x = 2*(x/t.width) - 1;
	y = 1 - 2*(y/t.height);
	return vec2(x, y);
}

/**
 * When the mouse is pressed down we record the initial coordinates and start listening for the
 * mouse move and up events.
 */
function onMouseDown(evt) {
	drag_mode = evt.shiftKey ? 'move' : 'rotate';
	initial_coord = mouse_coords(evt);
	initial_thetas = thetas.slice(0);
	initial_pos = position.slice(0);
	this.addEventListener('mousemove', onMouseMove);
	this.addEventListener('mouseup', onMouseUp);
}

/**
 * When the mouse is moved (while down) then the rotation is updated and the scene rendered.
 */
function onMouseMove(evt) {
	if (evt.buttons === 0) {
		// mouse button went away when we weren't paying attention
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);
	} else {
		let coord = mouse_coords(evt);
		if (drag_mode === 'rotate') {
			thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
			thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
		} else {
			position[0] = initial_pos[1] + (coord[0] - initial_coord[0]);
			position[1] = initial_pos[0] + (coord[1] - initial_coord[1]);
		}
	}
}

/**
 * When the mouse is lifted we update the rotation is updated one final time and we stop listening
 * to the mouse move and up events.
 */
function onMouseUp(evt) {
	let coord = mouse_coords(evt);
	if (drag_mode === 'rotate') {
		thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
		thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
	} else {
		position[0] = initial_pos[1] + (coord[0] - initial_coord[0]);
		position[1] = initial_pos[0] + (coord[1] - initial_coord[1]);
	}
	this.removeEventListener('mousemove', onMouseMove);
	this.removeEventListener('mouseup', onMouseUp);
}

/**
 * Make the object smaller/larger on scroll wheel.
 */
function onWheel(evt) {
	// Various equations could be used here, but this is what I chose
	cur_scale *= (1000-evt.deltaY) / 1000;
}

/**
 * Make the canvas fit the window (but stay a square)
 */
function onResize() {
	let sz = Math.min(window.innerWidth, window.innerHeight);
	gl.canvas.width = sz;
	gl.canvas.height = sz;
	gl.viewport(0, 0, sz, sz);
}

/**
 * Add the rectangle abcd to verts as two triangles.
 */
function rect(a, b, c, d, pts) {
	pts.push(a, b, c, a, c, d);
}

/**
 * Adds a cube to verts defined by the vertices a, b, c, d, e, f, g, h with
 * abcd and efgh as opposite faces of the cube.
 */
function cube(a, b, c, d, e, f, g, h, pts, inds_) {
	let off = pts.length;
	pts.push(a, b, c, d, e, f, g, h);
	rect(off+0, off+1, off+2, off+3, inds_);
	rect(off+4, off+5, off+6, off+7, inds_);
	rect(off+0, off+3, off+4, off+7, inds_);
	rect(off+2, off+3, off+4, off+5, inds_);
	rect(off+1, off+2, off+5, off+6, inds_);
	rect(off+0, off+1, off+6, off+7, inds_);
}

/**
 * Adds a tetrahedron to points defined by the vertices a, b, c, and d.
 */
function tetrahedron(a, b, c, d, pts) {
	pts.push(
		a, c, b,
		a, c, d,
		a, b, d,
		b, c, d);
}
