// This is a WebGL example that draws a teapot with 'cartoon shading'.
// components.
/* exported cube tetrahedron */

// Global WebGL context variable
let gl;

// Global list of vertices being drawn
let total_verts;

// Uniform locations
let model_view_loc, projection_loc;
let light_src_loc, light_in_model_loc;

// Buffer Ids
let verts_id, norms_id, inds_id;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 0.01;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;

// HTML Elements
let viewing_mode;
let ls_x, ls_y, ls_z, ls_w;

window.addEventListener('load', function init() {
	// Get the HTML5 canvas object from it's ID
	const canvas = document.getElementById('gl-canvas');

	// Get the WebGL context (save into a global variable)
	gl = WebGLUtils.create3DContext(canvas, {premultipliedAlpha:false});
	if (!gl) {
		window.alert("WebGL isn't available");
		return;
	}

	// Add a listener to the checkboxes
	viewing_mode = document.getElementById('viewing-mode');
	let light_in_model = document.getElementById('light-in-model');
	viewing_mode.addEventListener('click', onChangeMode);
	light_in_model.addEventListener('click', onChangeLightInModel);

	// Add listeners for the extra light properties
	ls_x = document.getElementById('x');
	ls_y = document.getElementById('y');
	ls_z = document.getElementById('z');
	ls_w = document.getElementById('pt_src');
	ls_x.addEventListener('change', onChangeLightSource);
	ls_y.addEventListener('change', onChangeLightSource);
	ls_z.addEventListener('change', onChangeLightSource);
	ls_w.addEventListener('click', onChangeLightSource);


	// Configure WebGL
	onResize();
	gl.getExtension('OES_standard_derivatives');
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden
	//gl.enable(gl.CULL_FACE); // faces turned away from the view will be hidden
	//gl.cullFace(gl.BACK);

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec4 vNormal;
		uniform mat4 model_view;
		uniform mat4 projection;
		uniform vec4 light_src;
		uniform bool light_in_model;
		varying vec4 pos, N, L, V;
		void main() {
			pos = model_view*vPosition;
			gl_Position = projection*pos;

			N = normalize(model_view*vNormal);

			L = light_in_model ? model_view*light_src : light_src;
			if (light_src.w == 1.0) {
				// light source is given as a location
				L -= pos;
			}
			L = normalize(L);

			// NOTE: this assumes viewer is at <0,0,0> in model coordinates
			V = normalize(vec4(0.0, 0.0, 0.0, 1.0)-pos);
			V.z = -V.z;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		#extension GL_OES_standard_derivatives : enable
		precision highp float;
		varying vec4 N, L, V;
		void main() {
			vec4 n = normalize(N);
			vec4 l = normalize(L);
			vec4 v = normalize(V);

			float d = dot(l, n);
			if (dot(v, n) < -0.95) {
				// Black outlines
				gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
			} else if (d > 0.5) {
				// Yellow highlights
				gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
			} else {
				// Red base
				gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
			}
			gl_FragColor.a = 1.0; // force opaque
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Load the teapot asynchronously
	load_obj('teapot.obj', teapot_loaded);

	// Create the vertex buffer on the GPU and associate with shader
	verts_id = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, verts_id); // bind to the new buffer
	let vPosition = gl.getAttribLocation(program, 'vPosition'); // get the vertex shader attribute "vPosition"
	gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Create the normals buffer on the GPU and associate with shader
	norms_id = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, norms_id); // bind to the new buffer
	let vNormal = gl.getAttribLocation(program, 'vNormal'); // get the vertex shader attribute "vNormal"
	gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vNormal" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vNormal); // enable this set of data

	// Create the indices buffer
	inds_id = gl.createBuffer();

	// Get the uniform locations
	model_view_loc = gl.getUniformLocation(program, 'model_view');
	projection_loc = gl.getUniformLocation(program, 'projection');
	light_in_model_loc = gl.getUniformLocation(program, 'light_in_model');
	light_src_loc = gl.getUniformLocation(program, 'light_src');

	// Give the uniforms their initial values
	update_model_view();
	update_projection();
	gl.uniform1i(light_in_model_loc, light_in_model.checked);
	onChangeLightSource();

	// Add just the mouse-down handler initially
	canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Do not render the static scene until loaded
	//render();
});

/**
 * Once the teapot file is loaded we need to get the vertices of all of its triangles.
 */
function teapot_loaded(verts, _, _n, inds) {
	gl.bindBuffer(gl.ARRAY_BUFFER, verts_id);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(verts), gl.STATIC_DRAW);
	let normals = calc_normals(verts, inds, false);
	gl.bindBuffer(gl.ARRAY_BUFFER, norms_id);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, inds_id);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);
	total_verts = inds.length;

	// Render the scene
	render();
}

/**
 * Updates the model-view transformation based on the global variables.
 */
function update_model_view() {
	let mv = mult(rotateZ(thetas[2]), mult(rotateY(thetas[1]), rotateX(thetas[0])));
	mv = mult(translate(position[0], position[1], position[2]), mv);
	mv = mult(scalem(cur_scale, cur_scale, cur_scale), mv);
	gl.uniformMatrix4fv(model_view_loc, false, flatten(mv));
}

/**
 * Updates the projection transformation based on the global variables.
 */
function update_projection() {
	let p, w = gl.canvas.width, h = gl.canvas.height;
	if (viewing_mode.checked) {
		p = perspective(45, w/h, 0.01, 10);
		// Need to move the camera away from the origin and flip the z-axis
		p = mult(p, mult(translate(0, 0, -3), scalem(1, 1, -1)));
	} else {
		p = (w > h) ? ortho(-w/h, w/h, -1, 1, 10, -10) : ortho(-1, 1, -h/w, h/w, 10, -10);
	}
	gl.uniformMatrix4fv(projection_loc, false, flatten(p));
}

/**
 * Render the scene.
 */
function render() {
	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.drawElements(gl.TRIANGLES, total_verts, gl.UNSIGNED_SHORT, 0);

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * Calculates the normals for the vertices given an array of vertices and array of indices to look
 * up into. By default this assumes the indices represents a triangle strip. To work with triangles
 * pass a third argument of false.
 */
function calc_normals(verts, inds, strip) {
	if (strip !== true && strip !== false) { strip = true; }
	let normals = new Array(verts.length);

	// Start with all vertex normals as <0,0,0,0>
	for (let i = 0; i < verts.length; i++) { normals[i] = vec4(0, 0, 0, 0); }

	// Calculate the face normals for each triangle then add them to the vertices
	let inc = strip ? 1 : 3;
	for (let i = 0; i < inds.length - 2; i+=inc) {
		let j = inds[i], k = inds[i+1], l = inds[i+2];
		let a = ensure_vec4(verts[j], 1), b = ensure_vec4(verts[k], 1), c = ensure_vec4(verts[l], 1);
		let face_norm = cross((strip && (i%2) !== 0) ? subtract(a, b) : subtract(b, a), subtract(a, c));
		normals[j] = add(normals[j], face_norm);
		normals[k] = add(normals[k], face_norm);
		normals[l] = add(normals[l], face_norm);
	}

	// Normalize the normals
	for (let i = 0; i < verts.length; i++) { normals[i] = normalize(normals[i]); }
	return normals;
}

/**
 * Ensures that the argument v is a vec4 with the given last value. If it is only a vec3 than the
 * last value is appended and it is returned.
 */
function ensure_vec4(v, last) {
	if (v.length === 3) {
		v = vec4(v, last);
	} else if (v.length !== 4 || v[3] !== last) { throw "invalid argument value"; }
	return v;
}

/**
 * Get the mouse coordinates in object-space as a vec2 from the MouseEvent.
 */
function mouse_coords(evt) {
	let t = evt.currentTarget;
	let x = evt.clientX - t.clientLeft - t.getBoundingClientRect().left + t.scrollLeft;
	let y = evt.clientY - t.clientTop - t.getBoundingClientRect().top + t.scrollTop;
	x = 2*(x/t.width) - 1;
	y = 1 - 2*(y/t.height);
	return vec2(x, y);
}

/**
 * When the mouse is pressed down we record the initial coordinates and start listening for the
 * mouse move and up events.
 */
function onMouseDown(evt) {
	drag_mode = evt.shiftKey ? 'move' : 'rotate';
	initial_coord = mouse_coords(evt);
	initial_thetas = thetas.slice(0);
	initial_pos = position.slice(0);
	this.addEventListener('mousemove', onMouseMove);
	this.addEventListener('mouseup', onMouseUp);
	update_model_view();
}

/**
 * When the mouse is moved (while down) then the rotation is updated and the scene rendered.
 */
function onMouseMove(evt) {
	if (evt.buttons === 0) {
		// mouse button went away when we weren't paying attention
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);
	} else {
		let coord = mouse_coords(evt);
		if (drag_mode === 'rotate') {
			thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
			thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
		} else {
			position[0] = initial_pos[0] + (coord[0] - initial_coord[0]);
			position[1] = initial_pos[1] + (coord[1] - initial_coord[1]);
		}
		update_model_view();
	}
}

/**
 * When the mouse is lifted we update the rotation is updated one final time and we stop listening
 * to the mouse move and up events.
 */
function onMouseUp(evt) {
	let coord = mouse_coords(evt);
	if (drag_mode === 'rotate') {
		thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
		thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
	} else {
		position[0] = initial_pos[0] + (coord[0] - initial_coord[0]);
		position[1] = initial_pos[1] + (coord[1] - initial_coord[1]);
	}
	update_model_view();
	this.removeEventListener('mousemove', onMouseMove);
	this.removeEventListener('mouseup', onMouseUp);
}

/**
 * Make the object smaller/larger on scroll wheel.
 */
function onWheel(evt) {
	// Various equations could be used here, but this is what I chose
	cur_scale *= (1000-evt.deltaY) / 1000;
	update_model_view();
}

/**
 * Make the canvas fit the window
 */
function onResize() {
	let w = window.innerWidth, h = window.innerHeight;
	gl.canvas.width = w;
	gl.canvas.height = h;
	gl.viewport(0, 0, w, h);
	update_projection();
}

/**
 * When the mode (perspective vs orthographic) is changed update the projection
 * matrix on the GPU to give that form of projection.
 */
function onChangeMode() { update_projection(); }

/**
 * When the state of the light is changed inform the GPU.
 */
function onChangeLightInModel() { gl.uniform1i(light_in_model_loc, this.checked); }

/**
 * When any of the light source attributes change update on the GPU
 */
function onChangeLightSource() {
	gl.uniform4fv(light_src_loc, vec4(+ls_x.value, +ls_y.value, +ls_z.value, ls_w.checked ? 1 : 0));
}

/**
 * Adds a cube to verts/inds defined by the vertices a, b, c, d, e, f, g, h with
 * abcd and efgh as opposite faces of the cube.
 * The indices need to be drawn as a triangle strip.
 */
function cube(a, b, c, d, e, f, g, h, verts, inds) {
	let off = verts.length;
	verts.push(a, b, c, d, e, f, g, h);
	inds.push(off+0, off+2,
		off+3, off+4, off+0, // around vertex d
		off+7, off+6, off+4, // around vertex h
		off+5, off+2, off+6, // around vertex f
		off+1, off+0, off+2  // around vertex b
	);
}

/**
 * Adds a tetrahedron to verts/inds defined by the vertices a, b, c, and d.
 * The indices need to be drawn as a triangle strip.
 */
function tetrahedron(a, b, c, d, verts, inds) {
	let off = verts.length;
	verts.push(a, b, c, d);
	inds.push(off+0, off+1, off+2, off+3, off+0, off+1);
}
