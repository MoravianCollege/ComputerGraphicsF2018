// OBJ file viewer including basic materials

// NOTES: Lots of information show up in the console, look at it!
// Some common ones:
//	Ignoring face with >3 vertices
//		This only support triangles - you will have to triangulate the mesh (can be done in Blender)
//		Unknown or unsupported command ... - most common with s, means the OBJ file is giving some information we are ignoring
//		Model middle is ... - means your model is not exactly at the origin which may effect your usage of it, can be fixed in Blender or in code
//		The scale is ... - tells you the relative scale of the object

const filename = 'TankFullUnScaled.obj';
const IGNORE_NORMALS = true;

// Global WebGL context variable
let gl;

// Global uniform locations
let ka_loc, kd_loc, ks_loc, alpha_loc, shininess_loc;

// Global list of objects being drawn
let objects;


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
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden
	gl.enable(gl.CULL_FACE); // faces turned away from the view will be hidden
	gl.cullFace(gl.BACK);

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec3 vNormal;
		uniform mat4 model_view;
		uniform mat4 projection;
		varying vec3 N, L, V;
		void main() {
			gl_Position = projection*model_view*vPosition;
			mat3 mv3 = mat3(model_view);
			vec3 pos = mv3*vPosition.xyz;
			N = normalize(mv3*vNormal.xyz);
			L = normalize(vec3(1.0, 1.0, 2.0)-pos);
			V = normalize(vec3(0.0, 0.0, 0.0)-pos);
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision highp float;
		uniform vec3 ka, kd, ks;
		uniform float shininess, alpha;
		varying vec3 N, L, V;
		void main() {
			vec3 n = normalize(N);
			vec3 l = normalize(L);
			vec3 v = normalize(V);
			float d = max(dot(l, n), 0.0);
			float s = d != 0.0 ? pow(max(dot(n, normalize(l + v)), 0.0), shininess) : 0.0;
			gl_FragColor.rgb = ka + d*kd + s*ks;
			gl_FragColor.a = alpha;
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Get uniform locations
	ka_loc = gl.getUniformLocation(program, 'ka');
	kd_loc = gl.getUniformLocation(program, 'kd');
	ks_loc = gl.getUniformLocation(program, 'ks');
	alpha_loc = gl.getUniformLocation(program, 'alpha');
	shininess_loc = gl.getUniformLocation(program, 'shininess');

	// Load the OBJ file
	load_obj(filename, function (verts, texCoords, normals, inds, objs) {
		/* eslint-disable no-use-before-define, no-console */

		// Get the bounding box so scale and position can be calculated
		let max = verts[0].slice(0), min = verts[0].slice(0);
		for (let v of verts) {
			if (v[0] > max[0]) { max[0] = v[0]; } else if (v[0] < min[0]) { min[0] = v[0]; }
			if (v[1] > max[1]) { max[1] = v[1]; } else if (v[1] < min[1]) { min[1] = v[1]; }
			if (v[2] > max[2]) { max[2] = v[2]; } else if (v[2] < min[2]) { min[2] = v[2]; }
		}
		let size = subtract(max, min);
		let middle = add(scale(0.5, size), min);
		if (middle[0] !== 0 || middle[1] !== 0 || middle[2] !== 0) {
			console.log('Model middle is', middle);
			console.log('Adjusted in this program, you should adjust your model so it is at the origin');
			for (let v of verts) {
				v[0] -= middle[0];
				v[1] -= middle[1];
				v[2] -= middle[2];
			}
		}
		cur_scale = Math.max(1/size[0], 1/size[1], 1/size[2]);
		console.log('The scale is', cur_scale);
		update_model_view();
		/* eslint-enable no-use-before-define, no-console */

		// Load the vertex data into the GPU and associate with shader
		create_vertex_attr_buffer(program, 'vPosition', verts);
		create_vertex_attr_buffer(program, 'vNormal', normals);

		// Load the indices
		let bufferId = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

		// Save the object information
		objects = objs;

		// Render the scene
		render();
	}, null, IGNORE_NORMALS);

	// Setup the standard movement system
	add_standard_handlers(program);
});

/**
 * Creates a vertex attribute buffer for the given program and attribute with
 * the given name. If x is an array, it is used as the initial values in the
 * buffer. Otherwise it must be an integer and specifies the size of the buffer.
 * In addition, if x is not an array, n must be provided which is the dimension
 * of the data to be allocated eventually.
 */
function create_vertex_attr_buffer(program, name, x, n) {
	let is_array = Array.isArray(x);
	let bufferId = gl.createBuffer(); // create a new buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferId); // bind to the new buffer
	gl.bufferData(gl.ARRAY_BUFFER, is_array ? flatten(x) : (x*n*sizeof.vec2/2), gl.STATIC_DRAW); // load the flattened data into the buffer
	let attrib_loc = gl.getAttribLocation(program, name); // get the vertex shader attribute location
	gl.vertexAttribPointer(attrib_loc, is_array ? x[0].length : n, gl.FLOAT, false, 0, 0); // associate the buffer with the attributes making sure it knows its type
	gl.enableVertexAttribArray(attrib_loc); // enable this set of data
	return bufferId;
}

/**
 * Render the scene.
 */
function render() {
	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	for (let obj of objects) {
		for (let part of obj.parts) {
			let mat = part.material;
			gl.uniform3fv(ka_loc, mat.Ka);
			gl.uniform3fv(kd_loc, mat.Kd);
			gl.uniform3fv(ks_loc, mat.Ks);
			gl.uniform1f(alpha_loc, mat.d);
			gl.uniform1f(shininess_loc, mat.Ns);
			// NOTE: sometimes additional material properties are available and you
			// may want/need to handle them specifically. The above are guaranteed to
			// be available.
			gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_SHORT, part.start*2);
		}
	}

	// Animate
	window.requestAnimationFrame(render);
}



//////////////////////// Standard Movement Handlers ////////////////////////
// Uniform locations
let model_view_loc, projection_loc;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 0.5;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;

/**
 * Sets up our standard movement handlerrs for the given program.
 */
function add_standard_handlers(program) {
	// Get the uniforms
	model_view_loc = gl.getUniformLocation(program, 'model_view');
	projection_loc = gl.getUniformLocation(program, 'projection');

	// Give the uniforms their initial values
	update_model_view();
	update_projection();

	// Add just the mouse-down handler initially
	gl.canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	gl.canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);
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
	p = perspective(45, w/h, 0.01, 10);
	// Need to move the camera away from the origin and flip the z-axis
	p = mult(p, translate(0, 0, -3));
	gl.uniformMatrix4fv(projection_loc, false, flatten(p));
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
			thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * -180;
			thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * 180;
		} else {
			position[0] = initial_pos[0] + (coord[0] - initial_coord[0])/cur_scale;
			position[1] = initial_pos[1] + (coord[1] - initial_coord[1])/cur_scale;
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
		thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * -180;
		thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * 180;
	} else {
		position[0] = initial_pos[0] + (coord[0] - initial_coord[0])/cur_scale;
		position[1] = initial_pos[1] + (coord[1] - initial_coord[1])/cur_scale;
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
