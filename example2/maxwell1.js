// This is a WebGL example that draws Maxwell's triangle using the fragment shader.

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

	// Compile shaders
	// Vertex Shader: simplest possible
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		void main() {
			gl_Position = vPosition;
		}
	`);
	// Fragment Shader: calculates the color based on the position of the fragment
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		const float w = 399.0;
		void main() {
			float x = gl_FragCoord.x, y = gl_FragCoord.y;
			float r = 1.0 - sqrt(x*x + y*y) / w;
			float b = 1.0 - sqrt((x-w)*(x-w) + y*y) / w;
			gl_FragColor = vec4(r, 1.0 - r - b, b, 1.0);
			// Or:
			//gl_FragColor.r = 1.0 - sqrt(x*x + y*y) / w;
			//gl_FragColor.b = 1.0 - sqrt((x-w)*(x-w) + y*y) / w;
			//gl_FragColor.g = 1.0 - gl_FragColor.r - gl_FragColor.b;
			//gl_FragColor.a = 1.0;
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
