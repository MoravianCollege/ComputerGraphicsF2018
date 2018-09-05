// This is a WebGL example that draws Sierpinski's Tetrahedron.

// Global WebGL context variable
let gl;

// Number of subdivision times in Sierpinski's Tetrahedron
const COUNT = 3;

// Global list of vertices being drawn
let verts = [];

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
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden

	// The vertices for the tetrahedron
	const SQRT_2_3 = Math.sqrt(2/3), SQRT_2_9 = Math.sqrt(2/9), SQRT_8_9 = Math.sqrt(8/9);
	sierpinski3(
		vec3(0, 0, -1),
		vec3(0, SQRT_8_9, 1/3),
		vec3(-SQRT_2_3, -SQRT_2_9, 1/3),
		vec3(SQRT_2_3, -SQRT_2_9, 1/3), COUNT, verts);
	// The colors for the tetrahedron (each face is a different color)
	let red = vec4(1.0, 0.0, 0.0, 1.0);
	let grn = vec4(0.0, 1.0, 0.0, 1.0);
	let blu = vec4(0.0, 0.0, 1.0, 1.0);
	let blk = vec4(0.0, 0.0, 0.0, 1.0);
	let colors = [];
	while (colors.length < verts.length) {
		colors.push(
			red, red, red,
			grn, grn, grn,
			blu, blu, blu,
			blk, blk, blk);
	}

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
	gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-3 vectors of floats
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
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, verts.length);
}

/**
 * Adds a tetrahedron to points defined by the vertices a, b, c, and d.
 */
function tetrahedron(a, b, c, d, points) {
	points.push(
		a, c, b,
		a, c, d,
		a, b, d,
		b, c, d);
}

/**
 * Generate the vertices for Sierpinski's tetrahedron.
 * a, b, c, and d are the vertices of the overall tetrahedron.
 * count is the number of iterations to do.
 * points is the array of vertices to append the new vertices to.
 */
function sierpinski3(a, b, c, d, count, points) {
	if (count === 0) {
		// Base case: add tetrahedron
		tetrahedron(a, b, c, d, points);
	} else {
		// Recursive case: divide tetrahedron and recurse
		// Calculate midpoints of sides
		let ab = mix(a, b, 0.5), ac = mix(a, c, 0.5);
		let ad = mix(a, d, 0.5), bc = mix(b, c, 0.5);
		let bd = mix(b, d, 0.5), cd = mix(c, d, 0.5);
		// Recurse to each of the new tetrahedrons
		sierpinski3(a, ab, ac, ad, count-1, points);
		sierpinski3(ab, b, bc, bd, count-1, points);
		sierpinski3(ac, bc, c, cd, count-1, points);
		sierpinski3(ad, bd, cd, d, count-1, points);
	}
}
