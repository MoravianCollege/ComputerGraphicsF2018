// This is a WebGL example that demonstrates multiple programs

// Global WebGL context variable
let gl;

// Global program variables
let program1, program2;

// Global buffer locations
let buffer_1, buffer_2;

// Global attribute locations
let vPosition_loc_1, vPosition_loc_2;

// Global uniform locations
let translation_loc_1, translation_loc_2;

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
		uniform vec2 translation;
		void main() {
			gl_Position = vPosition;
			gl_Position.x += translation.x;
			gl_Position.y += translation.y;
		}
	`);
	let fragShdr1 = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		void main() {
			gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
		}
	`);
	let fragShdr2 = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		void main() {
			gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
		}
	`);

	// Link the programs
	program1 = linkProgram(gl, [vertShdr, fragShdr1]);
	program2 = linkProgram(gl, [vertShdr, fragShdr2]);

	// Get the uniforms
	translation_loc_1 = gl.getUniformLocation(program1, 'translation');
	translation_loc_2 = gl.getUniformLocation(program2, 'translation');

	// Get attribute locations
	vPosition_loc_1 = gl.getAttribLocation(program1, 'vPosition');
	vPosition_loc_2 = gl.getAttribLocation(program2, 'vPosition');

	// Load the vertex data into the GPU and associate with shader
	buffer_1 = create_vertex_attr_buffer(gl, program1, 'vPosition', sq_verts);
	buffer_2 = create_vertex_attr_buffer(gl, program2, 'vPosition', tri_verts);

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
	gl.useProgram(program1);
	gl.uniform2f(translation_loc_1, 0.2, 0.2);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer_1);
	gl.vertexAttribPointer(vPosition_loc_1, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Draw the green triangle
	gl.useProgram(program2);
	gl.uniform2f(translation_loc_2, -0.2, -0.2);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer_2);
	gl.vertexAttribPointer(vPosition_loc_2, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);
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
