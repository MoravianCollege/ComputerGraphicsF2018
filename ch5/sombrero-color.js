// Draws a sombrero wireframe mesh that is colored based on function height

const DETAIL = 50; // number of points to evaluate function at in each direction

// Global WebGL context variable
let gl;

// Locations of the uniforms
let model_view_loc, projection_loc, color_loc;

// Whether of not to show perspective
let show_perspective = false;

// Total number of vertices to draw
let total_verts;

// Current rotation angle, position, and scale of the display
let thetas = [0,0,0], position = [0,0,0], cur_scale = 1;

// The drag mode - 'rotate' is regular click, 'move' is shift-click
let drag_mode;

// The intial mouse down location
let initial_coord;

// The initial thetas/position during a drag event
let initial_thetas, initial_pos;


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
	gl.enable(gl.DEPTH_TEST); // things further away will be hidden by closer things
	gl.enable(gl.POLYGON_OFFSET_FILL);
	gl.polygonOffset(1.0, 2.0);
	gl.lineWidth(0.5);

	// Generate the data for the mesh
	let verts = [];
	generate_mesh(sombrero(1, DETAIL), verts);
	total_verts = verts.length;

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		uniform mat4 model_view;
		uniform mat4 projection;
		varying float fHeight;
		void main() {
			gl_Position = projection*model_view*vPosition;
			fHeight = vPosition.y;
		}
	`);
	let fragShdr = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		uniform vec4 color;
		varying float fHeight;
		void main() {
			// Other posibilities for assigning color:
			//   just using red channel instead of red and blue
			//   abs(fHeight)
			//	 sqrt(abs(fHeight))
			float factor = pow(abs(fHeight), 0.75);
			vec4 base = ((fHeight > 0.0) ? vec4(factor, 0.0, 0.0, 1.0) : vec4(0.0, 0.0, factor, 1.0));
			gl_FragColor = color*base;
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
	gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0); // associate the buffer with "vPosition" making sure it knows it is length-3 vectors of floats
	gl.enableVertexAttribArray(vPosition); // enable this set of data

	// Get the location of the uniforms
	model_view_loc = gl.getUniformLocation(program, "model_view");
	projection_loc = gl.getUniformLocation(program, "projection");
	color_loc = gl.getUniformLocation(program, "color");

	// Initialize the uniforms
	update_model_view();
	update_projection();

	// Add just the mouse-down handler initially
	canvas.addEventListener('mousedown', onMouseDown);

	// Add the scroll wheel handler
	canvas.addEventListener('wheel', onWheel);

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Get the radius control and listen to its changes
	document.getElementById("radius").addEventListener('change', onRadiusChange);

	// Render the scene
	render();
});

/**
 * Update the model-view transformation
 */
function update_model_view() {
	let mv = mult(rotateZ(thetas[2]), mult(rotateY(thetas[1]), rotateX(thetas[0])));
	mv = mult(translate(position[0], position[1], position[2]), mv);
	mv = mult(scalem(cur_scale, cur_scale, cur_scale), mv);
	gl.uniformMatrix4fv(model_view_loc, false, flatten(mv));
}

/**
* Update the projection transformation based on global variables.
 */
function update_projection() {
	let p, w = gl.canvas.width, h = gl.canvas.height;
	if (show_perspective) {
		p = perspective(45, w/h, 0.01, 10);
		p = mult(p, mult(translate(0, 0, -3), scalem(1, 1, -1)));
	} else {
		p = (w > h) ? ortho(-w/h, w/h, -1, 1, 10, -10) : ortho(-1, 1, -h/w, h/w, 10, -10);
	}
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
	evt.preventDefault(); // prevents the default action associated with the event
	drag_mode = evt.shiftKey ? 'move' : 'rotate';
	initial_coord = mouse_coords(evt);
	initial_thetas = thetas.slice(0);
	initial_pos = position.slice(0);
	this.addEventListener('mousemove', onMouseMove);
	this.addEventListener('mouseup', onMouseUp);
}

/**
 * When the mouse is moved (while down) then the rotation is updated and the scene rendered.
 */
function onMouseMove(evt) {
	evt.preventDefault(); // prevents the default action associated with the event
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
			position[0] = initial_pos[1] + (coord[0] - initial_coord[0]);
			position[1] = initial_pos[0] + (coord[1] - initial_coord[1]);
		}
		update_model_view();
	}
}

/**
 * When the mouse is lifted we update the rotation is updated one final time and we stop listening
 * to the mouse move and up events.
 */
function onMouseUp(evt) {
	evt.preventDefault(); // prevents the default action associated with the event
	let coord = mouse_coords(evt);
	if (drag_mode === 'rotate') {
		thetas[1] = initial_thetas[1] - (coord[0] - initial_coord[0]) * 180;
		thetas[0] = initial_thetas[0] - (coord[1] - initial_coord[1]) * -180;
	} else {
		position[0] = initial_pos[1] + (coord[0] - initial_coord[0]);
		position[1] = initial_pos[0] + (coord[1] - initial_coord[1]);
	}
	update_model_view();
	this.removeEventListener('mousemove', onMouseMove);
	this.removeEventListener('mouseup', onMouseUp);
}

/**
 * Make the object smaller/larger on scroll wheel.
 */
function onWheel(evt) {
	evt.preventDefault(); // prevents the default action associated with the event
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
 * Render the scene.
 */
function render() {
	// Render
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the surface of the mesh
	gl.uniform4f(color_loc, 1, 1, 1, 1);
	for (let i = 0; i < total_verts; i += 4) { gl.drawArrays(gl.TRIANGLE_FAN, i, 4); }

	// Draw the lines of the mesh
	gl.uniform4f(color_loc, 0, 0, 0, 1);
	for (let i = 0; i < total_verts; i += 4) { gl.drawArrays(gl.LINE_LOOP, i, 4); }

	// Animate
	window.requestAnimationFrame(render);
}

/**
 * When the radius changes we need to re-generate the mesh completely
 */
function onRadiusChange() {
	// Generate the data for the mesh
	let verts = [];
	generate_mesh(sombrero(+this.value, DETAIL), verts);
	total_verts = verts.length;
	// Update the vertices on the GPU
	gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(verts));
}

/**
 * Generates the vertices for the mesh to be drawn with drawArray(gl.TRIANGLE_FAN) and
 * drawArray(gl.LINE_LOOP)
 */
function generate_mesh(data, verts) {
	let m = data.length, n = data[0].length;
	// Every single rectangle with only 4 vertices
	for (let i = 0; i < m-1; i++) {
		for (let j = 0; j < n-1; j++) {
			verts.push(vec4(2*i/(m-1)-1, data[i][j], 2*j/(n-1)-1, 1.0));
			verts.push(vec4(2*(i+1)/(m-1)-1, data[i+1][j], 2*j/(n-1)-1, 1.0));
			verts.push(vec4(2*(i+1)/(m-1)-1, data[i+1][j+1], 2*(j+1)/(n-1)-1, 1.0));
			verts.push(vec4(2*i/(m-1)-1, data[i][j+1], 2*(j+1)/(n-1)-1, 1.0));
		}
	}
}

/**
 * Generates a 2D array with the sombrero/Mexican hat/sinc function.
 * The detail argument describes how fine of detail to produce.
 */
function sombrero(radius, detail) {
	let width = 2*detail + 1;
	let data = new Array(width);
	for (let i = -detail; i <= detail; i++) {
		data[i+detail] = new Float32Array(width);
		for(let j = -detail; j <= detail; j++) {
			let r = 2*Math.PI*Math.sqrt(i*i+j*j)*radius/detail;
			data[i+detail][j+detail] = (r !== 0) ? Math.sin(r)/r : 1;
		}
	}
	return data;
}
