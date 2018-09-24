// Demonstrates parallel projection views

// Global WebGL context variable
let gl;

// Buffer ids
let verts_id, colors_id;

// Global list of vertices being drawn
let verts = [];

// Sliders
let theta, phi, distance, near, far, aspect, fov;

// Location of the view uniforms
let model_view_loc, perspective_loc;

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
		uniform mat4 model_view;
		uniform mat4 perspective;
		void main() {
			gl_Position = perspective*model_view*vPosition;
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

	// Get the location of the transform uniform matrices
	model_view_loc = gl.getUniformLocation(program, "model_view");
	perspective_loc = gl.getUniformLocation(program, "perspective");

	// Listen to resize events
	window.addEventListener('resize', onResize);

	// Get the slider objects and when they change then render the scene
	theta = document.getElementById("theta");
	phi = document.getElementById("phi");
	distance = document.getElementById("distance");
	near = document.getElementById("near");
	far = document.getElementById("far");
	aspect = document.getElementById("aspect");
	fov = document.getElementById("fov");
	theta.addEventListener('change', render);
	phi.addEventListener('change', render);
	distance.addEventListener('change', render);
	near.addEventListener('change', render);
	far.addEventListener('change', render);
	aspect.addEventListener('change', render);
	fov.addEventListener('change', render);

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

	// Render the scene
	render();
}

/**
 * Render the scene.
 */
function render() {
	// Calculate the model-view and perspective matrices
	// The *1 simply converts a string to a number
	let d = distance.value*1;
	let t = radians(theta.value*1);
	let p = radians(phi.value*1);
	let eye = vec3(
		d*Math.sin(t)*Math.cos(p),
		d*Math.sin(t)*Math.sin(p),
		d*Math.cos(t));
	let mv = lookAt(eye, vec3(0,0,0), vec3(0,1,0));
	let pers = perspective(fov.value*1, aspect.value*1, near.value*1, far.value*1);
	gl.uniformMatrix4fv(model_view_loc, false, flatten(mv));
	gl.uniformMatrix4fv(perspective_loc, false, flatten(pers));

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
