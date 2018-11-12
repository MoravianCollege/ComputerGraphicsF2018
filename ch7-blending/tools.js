// Various useful functions
/* exported create_vertex_attr_buffer load_texture load_cubemap_texture */
/* exported calc_normals generate_mesh */
/* exported cube tetrahedron unit_sphere */


/**
 * Creates a vertex attribute buffer for the given program and attribute with
 * the given name. If x is an array, it is used as the initial values in the
 * buffer. Otherwise it must be an integer and specifies the size of the buffer.
 * In addition, if x is not an array, n must be provided which is the dimension
 * of the data to be allocated eventually.
 */
function create_vertex_attr_buffer(gl, program, name, x, n) {
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
 * values. The image will be flipped vertically and will support mipmapping. Optional arguments for
 * index number to load into (default #0) and magnification filter (default gl.LINEAR).
 */
function load_texture(gl, img, idx, mag_filter) {
	if (typeof idx === "undefined") { idx = 0; }
	if (typeof mag_filter === "undefined") { mag_filter = gl.LINEAR; }

	let texture = gl.createTexture(); // create a texture resource on the GPU
	gl.activeTexture(gl['TEXTURE'+idx]); // set the current texture that all following commands will apply to
	gl.bindTexture(gl.TEXTURE_2D, texture); // assign our texture resource as the current texture

	// Load the image data into the texture
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

	// Setup options for downsampling and upsampling the image data
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag_filter);

	return texture;
}

/**
 * Load a texture onto the GPU as a cube-map texture. The images must be power-of-two sized image
 * using RGBA with uint8 values. Optional arguments for index number to load into (default #0) and
 * magnification filter (default gl.LINEAR).
 */
function load_cubemap_texture(gl, xp, xn, yp, yn, zp, zn, idx, mag_filter) {
	if (typeof idx === "undefined") { idx = 0; }
	if (typeof mag_filter === "undefined") { mag_filter = gl.LINEAR; }

	let texture = gl.createTexture(); // create a texture resource on the GPU
	gl.activeTexture(gl['TEXTURE'+idx]); // set the current texture that all following commands will apply to
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture); // assign our texture resource as the current texture

	// Load the image data into the texture
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,xp);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,xn);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,yp);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,yn);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,zp);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,zn);

	// Setup options for downsampling and upsampling the image data
	gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, mag_filter);
	return texture;
}

/**
 * Calculates the normals for the vertices given an array of vertices and array of indices to look
 * up into. By default this assumes the indices represents a triangle strip. To work with triangles
 * pass a third argument of false. The optional fourth argument says which triangles (as indices) to
 * skip during the calculations.
 */
function calc_normals(verts, inds, strip, skip) {
	if (strip !== true && strip !== false) { strip = true; }
	let normals = new Array(verts.length);

	// Setup skip information
	skip = typeof skip === "undefined" ? [] : skip.slice(0);
	skip.sort(function (a, b) { return a - b; }).push(-1);
	let skipInd = 0;

	// Start with all vertex normals as <0,0,0,0>
	for (let i = 0; i < verts.length; i++) { normals[i] = vec4(0, 0, 0, 0); }

	// Calculate the face normals for each triangle then add them to the vertices
	let inc = strip ? 1 : 3;
	for (let i = 0; i < inds.length - 2; i+=inc) {
		if (i === skip[skipInd]) { skipInd++; continue; } // skip this triangle
		let j = inds[i], k = inds[i+1], l = inds[i+2];
		if (j === k || k === l || l === j) { continue; } // degenerate triangle, skip it
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
 * Generate a mesh of triangles from a 2D dataset that indicates the height of the mesh at every
 * point. The result is to be drawn with gl.drawElements(gl.TRIANGLE_STRIP).
 */
function generate_mesh(data, verts, inds) {
	let off = verts.length, n = data.length, m = data[0].length;
	// Just the vertices
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < m; j++) {
			verts.push(vec4(2*i/(n-1)-1, data[i][j], 2*j/(m-1)-1, 1.0));
		}
	}
	// Rectangles
	for (let i = 0; i < n-1; i++) {
		for (let j = 0; j < m; j++) {
			inds.push(off+i*m+j);
			inds.push(off+(i+1)*m+j);
		}
		inds.push(off+(i+2)*m-1);
		inds.push(off+(i+1)*m);
	}
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


///////////// Shapes /////////////

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

/**
 * Divide a triangle into several triangles.
 */
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
