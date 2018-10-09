// This is a WebGL example that draws a cube with each face a different color. The cube is
// rotated with the mouse clicking and dragging.
/* exported cube tetrahedron */

// Global WebGL context variable
let gl;

// Global list of vertices being drawn
let total_verts;

// Location of the model-view and projection uniform
let model_view_loc, projection_loc;

// Whether or not to show perspective
let show_perspective = false;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 1;

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
		verts);
	total_verts = verts.length;
	let colors = [];
	let red = vec4(1.0, 0.0, 0.0, 1.0);
	let grn = vec4(0.0, 1.0, 0.0, 1.0);
	let blu = vec4(0.0, 0.0, 1.0, 1.0);
	let org = vec4(1.0, 0.5, 0.0, 1.0);
	let ylw = vec4(1.0, 1.0, 0.0, 1.0);
	let blk = vec4(0.0, 0.0, 0.0, 1.0);
	colors.push(red, red, red, red, red, red);
	colors.push(grn, grn, grn, grn, grn, grn);
	colors.push(blu, blu, blu, blu, blu, blu);
	colors.push(org, org, org, org, org, org);
	colors.push(ylw, ylw, ylw, ylw, ylw, ylw);
	colors.push(blk, blk, blk, blk, blk, blk);

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec4 vColor;
		varying vec4 fColor;
		uniform mat4 model_view;
		uniform mat4 projection;
		void main() {
			gl_Position = projection*model_view*vPosition;
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

	// Get the location of the transform and projection uniforms
	model_view_loc = gl.getUniformLocation(program, 'model_view');
	projection_loc = gl.getUniformLocation(program, 'projection');
	update_model_view();
	update_projection();

	// Add just the mouse-down handler initially
	canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Add a listener to the checkbox
	let checkbox = document.getElementById('viewing-mode');
	checkbox.addEventListener('click', onChangeMode);

	// Render the static scene
	render();
});

/**
 * Updates the model-view transformation based on the global variables.
 */
function update_model_view() {
	let mv = mult(rotateZ(thetas[2]), mult(rotateY(thetas[1]), rotateX(thetas[0])));
	mv = mult(translate(position[0], position[1], position[2]), mv);
	mv = mult(scalem(cur_scale, cur_scale, cur_scale), mv);
	gl.uniformMatrix4fv(model_view_loc, false, flatten(mv));
}

/**
 * Updates the projection transformation based on the global variables.
 */
function update_projection() {
	let p, w = gl.canvas.width, h = gl.canvas.height;
	if (show_perspective) {
		p = perspective(45, w/h, 0.01, 10);
		// Need to move the camera away from the origin and flip the z-axis
		p = mult(p, mult(translate(0, 0, -3), scalem(1, 1, -1)));
	} else {
		p = (w > h) ? ortho(-w/h, w/h, -1, 1, 10, -10) : ortho(-1, 1, -h/w, h/w, 10, -10);
	}
	gl.uniformMatrix4fv(projection_loc, false, flatten(p));
}

/**
 * Render the scene.
 */
function render() {
	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, total_verts);

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
	update_model_view();
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
		update_model_view();
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
	update_model_view();
	this.removeEventListener('mousemove', onMouseMove);
	this.removeEventListener('mouseup', onMouseUp);
}

/**
 * Make the object smaller/larger on scroll wheel.
 */
function onWheel(evt) {
	// Various equations could be used here, but this is what I chose
	cur_scale *= (1000-evt.deltaY) / 1000;
	update_model_view();
}

/**
 * Make the canvas fit the window
 */
function onResize() {
	let w = window.innerWidth, h = window.innerHeight;
	gl.canvas.width = w;
	gl.canvas.height = h;
	gl.viewport(0, 0, w, h);
	update_projection();
}

/**
 * When the mode (perspective vs orthographic) is changed update the projection
 * matrix on the GPU to give that form of projection.
 */
function onChangeMode() {
	show_perspective = this.checked;
	update_projection();
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
function cube(a, b, c, d, e, f, g, h, pts) {
	rect(a, b, c, d, pts);
	rect(e, f, g, h, pts);
	rect(a, d, e, h, pts);
	rect(c, d, e, f, pts);
	rect(b, c, f, g, pts);
	rect(a, b, g, h, pts);
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
