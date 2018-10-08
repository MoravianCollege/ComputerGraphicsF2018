// A simple shadow demo

// Global WebGL context variable
let gl;

// Uniform locations
let model_view_loc, projection_loc, color_loc;

// Location of the light source (x and z will be set in render based on theta)
let light = vec3(0.0, 2.0, 0.0);
let theta = 0;

// Color of the square and its shadow
const color_square = vec4(1.0, 0.0, 0.0, 1.0), color_shadow = vec4(0.0, 0.0, 0.0, 1.0);

// Keep track of the last time redrawn
let last_redraw;

// Model-view matrix of square
let model_view = lookAt(
	vec3(1.0, 1.0, 1.0), // eye
	vec3(0.0, 0.0, 0.0), // at
	vec3(0.0, 1.0, 0.0)  // up
);

// Shadow projection matrix
let shadow_proj = mat4([
	1,   0, 0, 0,
	0,   1, 0, 0,
	0,   0, 1, 0,
	0, -.5, 0, 0, // project shadow onto y=0
]);


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

	// Vertices for a square that can be drawn with a triangle fan
	// Also include the light point
	let verts = [
		vec4(-0.5, 0.5, -0.5, 1.0),
		vec4(-0.5, 0.5,  0.5, 1.0),
		vec4( 0.5, 0.5,  0.5, 1.0),
		vec4( 0.5, 0.5, -0.5, 1.0),
		vec4(light)
	];

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		uniform mat4 model_view;
		uniform mat4 projection;
		void main() {
			gl_Position = projection*model_view*vPosition;
			gl_PointSize = 5.0;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		uniform vec4 color;
		void main() {
			gl_FragColor = color;
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Create the vertex/position buffer on the GPU but don't allocate any memory for it (do that once OBJ file is loaded)
	let bufferId = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
	gl.bufferData(gl.ARRAY_BUFFER, flatten(verts), gl.DYNAMIC_DRAW); // load the flattened data into the buffer
	let vPosition = gl.getAttribLocation(program, 'vPosition'); // get the vertex shader attribute "vPosition"
	gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Get the uniform locations
	model_view_loc = gl.getUniformLocation(program, "model_view");
	projection_loc = gl.getUniformLocation(program, "projection");
	color_loc = gl.getUniformLocation(program, "color");

	// Load a default projection matrix
	let proj = ortho(-2.5, 2.5, 2.5, -2.5, -4, 4);
	gl.uniformMatrix4fv(projection_loc, false, flatten(proj));

	// Listen to resize events
	window.addEventListener('resize', onResize);

	// Listen to the keyboard
	window.addEventListener('keydown', onKeyDown);

	// Render the scene
	render();
});

/**
 * Render the scene.
 */
function render(ms) {
	// Reset
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the square
	gl.uniformMatrix4fv(model_view_loc, false, flatten(model_view));
	gl.uniform4fv(color_loc, flatten(color_square));
	gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

	// Update the location of the light
	if (ms) {
		let elapsed_ms = ms - last_redraw;
		theta += Math.PI * elapsed_ms / 1000;
		last_redraw = ms;
	} else { last_redraw = performance.now(); }
	theta %= 2*Math.PI;
	light[0] = Math.sin(theta);
	light[2] = Math.cos(theta);

	// Draw the light
	gl.bufferSubData(gl.ARRAY_BUFFER, 4*sizeof.vec4, flatten(light));
	gl.drawArrays(gl.POINTS, 4, 1);

	// Project the shadow of the square
	let m = mult(mult(mult(model_view, translate(light)), shadow_proj), translate(negate(light)));

	// Draw the shadow
	gl.uniformMatrix4fv(model_view_loc, false, flatten(m));
	gl.uniform4fv(color_loc, flatten(color_shadow));
	gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

	// Animate
	window.requestAnimFrame(render);
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

/**
 * On key-down we perform an incremental rotation of the pyramid.
 */
function onKeyDown(evt) {
	switch (evt.keyCode) {
	case 37: model_view = mult(model_view, rotateY(+1)); break; // left  (+y)
	case 39: model_view = mult(model_view, rotateY(-1)); break; // right (-y)
	case 38: model_view = mult(model_view, rotateX(+1)); break; // up    (+x)
	case 40: model_view = mult(model_view, rotateX(-1)); break; // down  (-x)
	case 65: model_view = mult(model_view, rotateZ(-1)); break; // A     (-z)
	case 68: model_view = mult(model_view, rotateZ(+1)); break; // D     (+z)
	default: return; // do nothing for other keys
	}
}
