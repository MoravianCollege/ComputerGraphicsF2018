// This is a WebGL example that draws Maxwell's triangle along with a clicking debug.

// Global WebGL context variable
let gl;

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

	// The vertices for the triangle (uses 2D vectors)
	let verts = [
		vec2(-1, -1),
		vec2( 0,  1),
		vec2( 1, -1)
	];
	// The colors for the triangle (uses 4D vectors)
	let colors = [
		vec4(1, 0, 0, 1), // red
		vec4(0, 1, 0, 1), // green
		vec4(0, 0, 1, 1), // blue
	];

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

	// Add the click listener
	canvas.addEventListener('click', onClick);

	// Render the static scene
	render();
});

/**
 * Render the scene. Currently just a simple static triangle.
 */
function render() {
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function onClick(evt) {
	let x = evt.clientX - this.getBoundingClientRect().left - this.clientLeft + this.scrollLeft;
	let y = evt.clientY - this.getBoundingClientRect().top - this.clientTop + this.scrollTop;
	x = 2*(x/this.width) - 1;
	y = 1 - 2*(y/this.height);
	console.log(x, y);
}
