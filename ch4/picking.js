// Animated Rotating Cube with picking to determine which face of cube is hit
/* exported cube tetrahedron */

// Global WebGL context variable
let gl;

// Global list of vertices being drawn
let verts = [];

// Location of the transform uniform
let transform_loc;

// Current rotation angle
let theta = 0;

// Speed of rotation
let degrees_per_sec = 30;

// Last time we redrew the screen
let last_redraw;

window.addEventListener('load', function init() {
	// Get the HTML5 canvas object from it's ID
	const canvas = document.getElementById('gl-canvas');

	// Get the WebGL context (save into a global variable)
	gl = WebGLUtils.create3DContext(canvas, {preserveDrawingBuffer: true});
	if (!gl) {
		window.alert("WebGL isn't available");
		return;
	}

	// Configure WebGL
	gl.viewport(0, 0, canvas.width, canvas.height); // this is the region of the canvas we want to draw on (all of it)
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden

	// Create a tetrahedron
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

	// Get the location of the transform uniform
	transform_loc = gl.getUniformLocation(program, "transform");

	// Listen for click events
	canvas.addEventListener('click', onClick);

	// Render the static scene
	render();
});

/**
 * Render the scene.
 */
function render(ms) {
	// Update theta
	if (ms) {
		let elapsed_ms = ms - last_redraw;
		theta += degrees_per_sec * elapsed_ms / 1000;
		last_redraw = ms;
	} else { last_redraw = performance.now(); }

	// Update the transformation on the GPU
	gl.uniformMatrix4fv(transform_loc, false, flatten(rotate(theta, 1, 1, 1)));

	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, verts.length);

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * Click handler that logs out if we clicked the square or not.
 */
function onClick(evt) {
	// Get coordinates in HTML-space
	let x = evt.clientX - this.getBoundingClientRect().left - this.clientLeft + this.scrollLeft;
	let y = evt.clientY - this.getBoundingClientRect().top - this.clientTop + this.scrollTop;

	// Read the pixel under the mouse click
	let buf = new Uint8Array(4);
	gl.readPixels(x, gl.canvas.height-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
	console.log(x, y, buf);
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
