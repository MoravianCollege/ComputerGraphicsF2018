// This is a WebGL example that draws a cube with a checkboard texture.
/* exported cube tetrahedron unit_sphere */

// Global WebGL context variable
let gl;

// Global list of vertices being drawn
let total_verts;

// Uniform locations
let model_view_loc, projection_loc;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 1;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;

// Whether to render with perspective or not
const show_perspective = false;

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
	gl.getExtension('OES_standard_derivatives');
	gl.clearColor(1.0, 1.0, 1.0, 0.0); // setup the background color with red, green, blue, and alpha
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden
	gl.enable(gl.CULL_FACE); // faces turned away from the view will be hidden
	gl.cullFace(gl.BACK);

	// Create a cube
	let verts = [], inds = [];
	cube(
		vec4(-0.5, -0.5, -0.5, 1),
		vec4( 0.5, -0.5, -0.5, 1),
		vec4( 0.5,  0.5, -0.5, 1),
		vec4(-0.5,  0.5, -0.5, 1),
		vec4(-0.5,  0.5,  0.5, 1),
		vec4( 0.5,  0.5,  0.5, 1),
		vec4( 0.5, -0.5,  0.5, 1),
		vec4(-0.5, -0.5,  0.5, 1),
		verts, inds);
	let normals = calc_normals(verts, inds);
	total_verts = inds.length;

	// Create the texture data
	let img = create_checkerboard_image(64, 2);
	let texCoords = [
		vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1),
		vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1),
	];
	//let texCoords = [
	//	vec2(0.25, 0.00), vec2(0.50, 0.00), vec2(0.25, 0.25), vec2(0.50, 0.25),
	//	vec2(0.25, 0.50), vec2(0.50, 0.50), vec2(0.50, 0.75), vec2(0.25, 0.75),
	//];

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		attribute vec4 vNormal;
		attribute vec2 vTexCoord;
		uniform mat4 model_view;
		uniform mat4 projection;
		const vec4 light_src = vec4(1.0, 1.0, -1.0, 1.0);
		const bool light_in_model = false;
		varying vec4 pos, N, L, V;
		varying vec2 fTexCoord;
		void main() {
			pos = model_view*vPosition;
			gl_Position = projection*pos;

			N = normalize(model_view*vNormal);

			L = light_in_model ? model_view*light_src : light_src;
			if (light_src.w == 1.0) { L -= pos; } // light source is given as a location
			L = normalize(L);

			// NOTE: this assumes viewer is at <0,0,0> in model coordinates
			V = normalize(vec4(0.0, 0.0, 0.0, 1.0)-pos);
			V.z = -V.z;

			// Simply passes texture coordinate through
			fTexCoord = vTexCoord;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		#extension GL_OES_standard_derivatives : enable
		precision highp float;
		const bool flat_shading = false;
		const vec4 material_color = vec4(0.0, 1.0, 0.0, 1.0);
		const float ka = 0.2, kd = 1.0, ks = 1.0;
		const float shininess = 20.0;
		varying vec4 N, L, V, pos;

		uniform sampler2D texture;
		varying vec2 fTexCoord;

		void main() {
			vec4 n = normalize(!flat_shading ? N :
				vec4(cross(vec3(dFdy(pos)), vec3(dFdx(pos))), 0));
			vec4 l = normalize(L);
			vec4 v = normalize(V);
			float d = max(dot(l, n), 0.0);
			float s = d != 0.0 ? pow(max(dot(n, normalize(l + v)), 0.0), shininess) : 0.0;

			vec4 color = texture2D(texture, fTexCoord)*material_color;
			gl_FragColor = ka*color + d*kd*color + s*ks*vec4(1.0, 1.0, 1.0, 0.0);
			gl_FragColor.a = 1.0; // force opaque
		}
	`);

	// Link the programs and use them with the WebGL context
	let program = linkProgram(gl, [vertShdr, fragShdr]);
	gl.useProgram(program);

	// Load the vertex data into the GPU and associate with shader
	create_vertex_attr_buffer(program, 'vPosition', verts);
	create_vertex_attr_buffer(program, 'vNormal', normals);
	create_vertex_attr_buffer(program, 'vTexCoord', texCoords);

	// Load the indices
	let bufferId = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), gl.STATIC_DRAW);

	// Load the textures
	load_texture(img);

	// Get the uniform locations
	model_view_loc = gl.getUniformLocation(program, 'model_view');
	projection_loc = gl.getUniformLocation(program, 'projection');

	// Give the uniforms their initial values
	update_model_view();
	update_projection();

	// Add just the mouse-down handler initially
	canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Render the static scene
	render();
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
 * Load a texture onto the GPU. The image must be power-of-two sized image using RGBA with uint8
 *values. The image will be flipped vertically and will support mipmapping.
 */
function load_texture(img, idx) {
	if (typeof idx === "undefined") { idx = 0; }

	let texture = gl.createTexture(); // create a texture resource on the GPU
	gl.activeTexture(gl['TEXTURE'+idx]); // set the current texture that all following commands will apply to
	gl.bindTexture(gl.TEXTURE_2D, texture); // assign our texture resource as the current texture
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // tell WebGL to flip the image vertically (almost always want this to be true)

	// Load the image data into the texture
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

	// Setup options for downsampling and upsampling the image data
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	return texture;
}

/**
 * Create a checkerboard image of white and black squares. The image will be texSize-by-texSize
 * pixels. There will be a total of numChecks boxes in each direction for a total of numChecks^2.
 */
function create_checkerboard_image(texSize, numChecks) {
	let img = new ImageData(texSize, texSize);
	let data = img.data;
	let checkSize = texSize/numChecks;
	for (let i = 0; i < texSize; i++) {
		for (let j = 0; j < texSize; j++) {
			let off = 4*(i*texSize+j);
			let checkX = Math.floor(i/checkSize)%2;
			let checkY = Math.floor(j/checkSize)%2;
			let c = (checkX !== checkY) ? 255 : 0;
			data[off] = data[off+1] = data[off+2] = c;
			data[off+3] = 255;
		}
	}
	return img;
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
	if (show_perspective) {
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
	gl.drawElements(gl.TRIANGLE_STRIP, total_verts, gl.UNSIGNED_SHORT, 0);

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
		let a = verts[j], b = verts[k], c = verts[l];
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

/**
 * Create an approximate unit sphere by subdividing the faces of a tetrahedron repeatedly. The
 * sphere will be centered at the origin and have a radius of 1. For different spheres the
 * vertices can just be transformed as necessary.
 */
function unit_sphere(verts, inds, num_subdivisions) {
	// The unit sphere has 4 equidistant points at:
	//    <0,0,-1>, <0,2*sqrt(2)/3,1/3>, <-sqrt(6)/3, -sqrt(2)/3, 1/3>, and <sqrt(6)/3, -sqrt(2)/3, 1/3>
	let a = vec4(0.0, 0.0, -1.0, 1);
	let b = vec4(0.0, 0.94280904158, 0.33333333333, 1);
	let c = vec4(-0.81649658093, -0.4714045207, 0.33333333333, 1);
	let d = vec4( 0.81649658093, -0.4714045207, 0.33333333333, 1);
	let map = new Map();
	let verts_start = verts.length;
	divide_triangle(a, b, c, verts, inds, map, num_subdivisions);
	divide_triangle(d, c, b, verts, inds, map, num_subdivisions);
	divide_triangle(a, d, b, verts, inds, map, num_subdivisions);
	divide_triangle(a, c, d, verts, inds, map, num_subdivisions);
	for (let i = verts_start; i < verts.length; i++) { verts[i] = normalize(verts[i], true); }
}

function divide_triangle(a, b, c, verts, inds, map, num_subdivisions) {
	if (num_subdivisions === 0) {
		inds.push(
			get_vert_idx(a, verts, map),
			get_vert_idx(b, verts, map),
			get_vert_idx(c, verts, map));
	} else {
		let ab = mix(a, b, 0.5);
		let ac = mix(a, c, 0.5);
		let bc = mix(b, c, 0.5);
		divide_triangle(a, ab, ac, verts, inds, map, num_subdivisions-1);
		divide_triangle(ab, b, bc, verts, inds, map, num_subdivisions-1);
		divide_triangle(bc, c, ac, verts, inds, map, num_subdivisions-1);
		divide_triangle(ab, bc, ac, verts, inds, map, num_subdivisions-1);
	}
}

/**
 * Gets the index of the vertex v. If v is already in verts/map than its previous index is returned
 * otherwise v is added to verts and map and its new index is returned.
 */
function get_vert_idx(v, verts, map) {
	let str = v.toString();
	if (!map.has(str)) { map.set(str, verts.length); verts.push(v); }
	return map.get(str);
}
