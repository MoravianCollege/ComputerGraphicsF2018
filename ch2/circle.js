// This is a WebGL example that draws a circle.

// Global WebGL context variable
let gl;
const SIDES = 32;

// Once the document is fully loaded run this init function.
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
	gl.viewport(0, 0, canvas.width, canvas.height); // this is the region of the canvas we want to draw on (all of it)
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha

	// The vertices for the circle
	let verts = [];
	circle(vec2(0, 0), 1, SIDES, verts);
	// The colors for the circle (solid red)
	let colors = [];
	for (let i = 0; i < verts.length; ++i) { colors.push(vec4(1, 0, 0, 1)); }

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec4 vColor;
		varying vec4 fColor;
		void main() {
			gl_Position = vPosition;
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
	gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-2 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Load the color data into the GPU and associate with shader
	bufferId = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW); // load the flattened data into the buffer
	let vColor = gl.getAttribLocation(program, 'vColor'); // get the vertex shader attribute "vColor"
	gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vColor" making sure it knows it is length-4 vectors of floats
	gl.enableVertexAttribArray(vColor); // enable this set of data

	// Render the static scene
	render();
});

/**
 * Render the scene. Currently just a simple static triangle.
 */
function render() {
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, SIDES*3);
}

/**
 * Add the vertices for a circle centered at c with a radius of r and n sides to the array verts.
 */
function circle(c, r, n, verts) {
	let theta = 2*Math.PI/n;
	let a = vec2(c[0]+r, c[1]);
	for (let i = 1; i <= n; ++i) {
		let b = vec2(
			c[0]+Math.cos(i*theta)*r,
			c[1]+Math.sin(i*theta)*r);
		verts.push(c, a, b);
		a = b;
	}
}
