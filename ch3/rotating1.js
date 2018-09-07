// Animated Rotating Square.
// The computations are all completed in the JS code and sent to the GPU every frame.

// Global WebGL context variable
let gl;

// Vertices of square
let verts;
// Angle of square
let theta = 0;

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

	// The vertices of the square
	verts = [
		vec2(0.5, 0.5), vec2(0.5, -0.5), vec2(-0.5, -0.5),
		vec2(0.5, 0.5), vec2(-0.5, 0.5), vec2(-0.5, -0.5),
	];

	// Vertex Shader
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		void main() {
			gl_Position = vPosition;
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
	gl.bufferData(gl.ARRAY_BUFFER, flatten(verts), gl.DYNAMIC_DRAW); // load the flattened data into the buffer
	let vPosition = gl.getAttribLocation(program, 'vPosition'); // get the vertex shader attribute "vPosition"
	gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-2 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Render
	render();
});

/**
 * Render the scene.
 */
function render() {
	// Update theta
	theta += 0.01;
	theta = theta % (2*Math.PI); // bonus line that reduces stutter
	
	// Transform vertices
	let verts_rot = [];
	for (let i = 0; i < verts.length; ++i) {
		let x = verts[i][0], y = verts[i][1];
		verts_rot.push(vec2(
			-x*Math.sin(theta) + y*Math.cos(theta),
			y*Math.sin(theta) + x*Math.cos(theta)
		));
	}

	// Send transformed vertices to GPU
	gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(verts_rot));

	// Draw
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, verts.length);

	// Animate
	window.requestAnimationFrame(render);
}
