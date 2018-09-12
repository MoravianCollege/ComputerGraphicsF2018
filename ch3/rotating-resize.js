// Animated Rotating Square that changes speed with an HTML slider and keyboard.
// The canvas resizes to fit the window.

// Global WebGL context variable
let gl;

// Vertices of square
let verts;
// Angle of square
let theta = 0;
// Uniform theta location
let theta_loc;
// Last time the screen was redrawn
let last_redraw;
// Speed of animation
let RADS_PER_SEC = 0;
// The slider for speed control
let speed_control;

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
	let sz = Math.min(window.innerWidth);
	canvas.width = canvas.height = sz;
	gl.viewport(0, 0, sz, sz); // this is the region of the canvas we want to draw on (all of it)
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha

	// The vertices of the square
	verts = [
		vec2(0.5, 0.5), vec2(0.5, -0.5), vec2(-0.5, -0.5),
		vec2(0.5, 0.5), vec2(-0.5, 0.5), vec2(-0.5, -0.5),
	];

	// Vertex Shader
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		uniform float theta;
		void main() {
			float x = vPosition.x, y = vPosition.y;
			gl_Position.x = -x*sin(theta) + y*cos(theta);
			gl_Position.y = y*sin(theta) + x*cos(theta);
			gl_Position.zw = vec2(1.0);
		}
	`);
	// Fragment Shader
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		void main() {
			gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
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
	gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-2 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Get the theta uniform location
	theta_loc = gl.getUniformLocation(program, 'theta');

	// Listen to the slider events
	speed_control = document.getElementById('speed');
	speed_control.addEventListener('change', changeSpeed);

	// Listen to keyboard events
	window.addEventListener('keydown', onKeyDown);

	// Listen to resize events
	window.addEventListener('resize', onResize);

	// Render
	render();
});

/**
 * Render the scene.
 */
function render(ms) {
	// Update theta
	if (ms) {
		let elapsed_ms = ms - last_redraw;
		theta += RADS_PER_SEC * elapsed_ms / 1000;
		last_redraw = ms;
	} else { last_redraw = performance.now(); }
	theta = theta % (2*Math.PI); // bonus line that reduces stutter
	gl.uniform1f(theta_loc, theta);

	// Draw
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, verts.length);

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * Update the speed of the rotating square. No need to call render here as it will be called soon
 * enough on its own.
 */
function changeSpeed() {
	RADS_PER_SEC = this.value;
}

/**
 * Update speed and direction when keyboard keys are used. No need to call render here as it will be
 * called soon enough on its own.
 */
function onKeyDown(evt) {
	switch (evt.keyCode) {
	case 32: RADS_PER_SEC = -RADS_PER_SEC; break; // space
	case 40: RADS_PER_SEC -= 0.1; break; // down
	case 38: RADS_PER_SEC += 0.1; break; // up
	}
	speed_control.value = RADS_PER_SEC;
}

/**
 * When we resize the window resize the canvas as well.
 */
function onResize() {
	let sz = Math.min(window.innerWidth, window.innerHeight);
	gl.canvas.width = sz;
	gl.canvas.height = sz;
	gl.viewport(0, 0, sz, sz);
}
