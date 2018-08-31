// This is a WebGL example that draws Sierpinski's Triangle in a multicolor.

// Global WebGL context variable
let gl;
const COUNT = 3;

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

	// The vertices for the triangles (generated recursively)
	let verts = [];
	sierpinski(vec2(-1, -1), vec2(0, 1), vec2(1, -1), COUNT, verts);

	// The colors for the triangles (all red)
	let colors = [];
	const red = vec4(1, 0, 0, 1);
	const grn = vec4(0, 1, 0, 1);
	const blu = vec4(0, 0, 1, 1);
	for (let i = 0; i < verts.length / 9; ++i) {
		colors.push(red, red, red, grn, grn, grn, blu, blu, blu);
	}

	// Alternative approach
	//let verts = [];
	//let colors = [];
	//sierpinski_color(vec2(-1, -1), vec2(0, 1), vec2(1, -1), COUNT, vec4(), points, colors);

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

	// Load the vertex data into the GPU and associate with shader
	bufferId = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW); // load the flattened data into the buffer
	let vColor = gl.getAttribLocation(program, 'vColor'); // get the vertex shader attribute "vPosition"
	gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-2 vectors of floats
	gl.enableVertexAttribArray(vColor); // enable this set of data

	// Render the static scene
	render();
});

/**
 * Render the scene. Currently just a simple static triangle.
 */
function render() {
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, Math.pow(3, COUNT+1));
}

/**
 * Generate the vertices for Sierpinski's triangle.
 * a, b, and c are the vertices of the overall triangle.
 * count is the number of iterations to do.
 * points is the array of vertices to append the new vertices to.
 */
function sierpinski(a, b, c, count, points) {
	if (count === 0) {
		// Base case: add triangle vertices to array of points
		points.push(a, b, c);
	} else {
		// Recursive case: divide triangle and recurse
		// Calculate midpoints of sides
		let ab = mix(a, b, 0.5);
		let ac = mix(a, c, 0.5);
		let bc = mix(b, c, 0.5);
		// Recurse to each of the new triangles
		sierpinski(a, ab, ac, count-1, points);
		sierpinski(ab, b, bc, count-1, points);
		sierpinski(ac, bc, c, count-1, points);
	}
}

// Alternative approach
/*function sierpinski_color(a, b, c, count, color, points, colors) {
	if (count === 0) {
		// Base case: add triangle vertices to array of points
		points.push(a, b, c);
		colors.push(color, color, color);
	} else {
		// Recursive case: divide triangle and recurse
		// Calculate midpoints of sides
		let ab = mix(a, b, 0.5);
		let ac = mix(a, c, 0.5);
		let bc = mix(b, c, 0.5);
		// Recurse to each of the new triangles
		sierpinski_color(a, ab, ac, count-1, vec4(1, 0, 0, 1), points, colors);
		sierpinski_color(ab, b, bc, count-1, vec4(0, 1, 0, 1), points, colors);
		sierpinski_color(ac, bc, c, count-1, vec4(0, 0, 1, 1), points, colors);
	}
}*/
