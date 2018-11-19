// This is a WebGL example that will demonstrate multiple programs

// Global WebGL context variable
let gl;

// Global program variables
let program1;

window.addEventListener('load', function init() {
	// Get the HTML5 canvas object from it's ID
	const canvas = document.getElementById('gl-canvas');

	// Get the WebGL context (save into a global variable)
	gl = WebGLUtils.create3DContext(canvas, {premultipliedAlpha:false});
	if (!gl) {
		window.alert("WebGL isn't available");
		return;
	}

	// Configure WebGL
	onResize();
	gl.clearColor(0.0, 0.0, 0.0, 0.0); // setup the background color with red, green, blue, and alpha

	// Create a single rectangle and triangle
	let sq_verts = [vec2(-0.5, -0.5), vec2(-0.5, 0.5), vec2(0.5, -0.5), vec2(0.5, 0.5)];
	let tri_verts = [vec2(-0.5, -0.5), vec2(0.5, -0.5), vec2(0, 0.5)];

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		void main() {
			gl_Position = vPosition;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		void main() {
			gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
		}
	`);

	// Link the programs
	program1 = linkProgram(gl, [vertShdr, fragShdr]);

	// Load the vertex data into the GPU and associate with shader
	let buffer1 = create_vertex_attr_buffer(gl, program1, 'vPosition', sq_verts);

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Render the scene
	render();
});

/**
 * Render the scene.
 */
function render() {
	// Clear
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the red square
	gl.useProgram(program1)
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/**
 * When resizing the canvas takes up the entire screen.
 */
function onResize() {
	let w = window.innerWidth, h = window.innerHeight;
	gl.canvas.width = w;
	gl.canvas.height = h;
	gl.viewport(0, 0, w, h);
}
