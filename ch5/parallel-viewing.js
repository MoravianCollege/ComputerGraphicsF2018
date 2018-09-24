// Demonstrates parallel projection views

// Global WebGL context variable
let gl;

// Buffer ids
let verts_id, colors_id;

// Global list of vertices being drawn
let verts = [];

// Location of the view uniform
let transform_loc;

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

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec4 vColor;
		varying vec4 fColor;
		uniform mat4 transform;
		void main() {
			gl_Position = transform*vPosition;
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

	// Create the vertex/position buffer on the GPU but don't allocate any memory for it (do that once OBJ file is loaded)
	verts_id = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, verts_id); // bind to the new buffer
	let vPosition = gl.getAttribLocation(program, 'vPosition'); // get the vertex shader attribute "vPosition"
	gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Create the color buffer on the GPU but don't allocate any memory for it (do that once OBJ file is loaded)
	colors_id = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, colors_id); // bind to the new buffer
	let vColor = gl.getAttribLocation(program, 'vColor'); // get the vertex shader attribute "vColor"
	gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vColor" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vColor); // enable this set of data

	// Load the temple asynchronously
	load_obj('temple.obj', temple_loaded);

	// Get the location of the transform uniform
	transform_loc = gl.getUniformLocation(program, "transform");

	// Listen to resize events
	window.addEventListener('resize', onResize);

	// Listen to the buttons being click
	document.getElementById('front').addEventListener('click', ortho_front);
	document.getElementById('left').addEventListener('click', ortho_left);
	document.getElementById('back').addEventListener('click', ortho_back);
	document.getElementById('right').addEventListener('click', ortho_right);
	document.getElementById('top').addEventListener('click', ortho_top);
	document.getElementById('bottom').addEventListener('click', ortho_bottom);
	document.getElementById('isometric').addEventListener('click', axo_isometric);
	document.getElementById('dimetric').addEventListener('click', axo_dimetric);
	document.getElementById('trimetric').addEventListener('click', axo_trimetric);
	document.getElementById('cavalier').addEventListener('click', obl_cavalier);
	document.getElementById('cabinet').addEventListener('click', obl_cabinet);
	document.getElementById('military').addEventListener('click', obl_military);

	// NOTE: Do not call render until OBJ file is loaded
});

/**
 * Once the temple file is loaded we need to get the vertices of all of its triangles and setup the
 * colors based on the normals of the vertices.
 */
function temple_loaded(pts, _, normals, inds) {
	// Setup the data from the file
	let colors = [];
	for (let i = 0; i < inds.length; i++) {
		verts.push(pts[inds[i]]);
		let n = normals[inds[i]];
		let color = vec4(0, 0, 0, 1);
		color[0] = Math.abs(n[2]);
		color[1] = Math.abs(n[1]);
		color[2] = Math.abs(n[0]);
		colors.push(color);
	}

	// Load the vertex and color data into the GPU
	gl.bindBuffer(gl.ARRAY_BUFFER, verts_id);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(verts), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, colors_id);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

	// Set the default view to isometric and render the scene.
	axo_isometric();
}

/**
 * Render the scene.
 */
function render() {
	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, verts.length);
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
 * Update the transformation applied in the vertex shader. The scene is then rendered.
 */
function update_trans(m) {
	m = mult(scalem(0.5, 0.5, 0.5), m);
	gl.uniformMatrix4fv(transform_loc, false, flatten(m));
	render();
}

/**
 * The button functions that set the appropriate rotations.
 */
function ortho_front() { update_trans(rotateY(0)); }
function ortho_left() { update_trans(rotateY(-90)); }
function ortho_back() { update_trans(rotateY(180)); }
function ortho_right() { update_trans(rotateY(90)); }
function ortho_top() { update_trans(rotateX(-90)); }
function ortho_bottom() { update_trans(rotateX(90)); }
function axo_isometric() { update_trans(mult(rotateX(-35.264), rotateY(45))); }
function axo_dimetric() { update_trans(mult(rotateX(-20), rotateY(45))); }
function axo_trimetric() { update_trans(mult(rotateX(-20), rotateY(30))); }
function obl_cavalier() {
	let alpha = 45;
	update_trans(mat4(
		1, 0, Math.cos(alpha), 0,
		0, 1, Math.sin(alpha), 0,
		0, 0, 1, 0,
		0, 0, 0, 1));
}
function obl_cabinet() {
	let alpha = 63.4;
	update_trans(mat4(
		1, 0, 0.5*Math.cos(alpha), 0,
		0, 1, 0.5*Math.sin(alpha), 0,
		0, 0, 1, 0,
		0, 0, 0, 1));
}
function obl_military() {
	let alpha = -45;
	update_trans(mult(rotateZ(-45), mult(mat4(
		1, 0, Math.cos(alpha), 0,
		0, 1, Math.sin(alpha), 0,
		0, 0, 1, 0,
		0, 0, 0, 1), rotateX(-90))));
}
