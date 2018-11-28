// This is a WebGL example that demonstrates rendering to a texture

// Global WebGL context variable
let gl;

// Off-Screen Buffers
let fb, rb, tex;

// Global program variables
let program1; // used to render off-screen
let program2; // used to render unblurred
let program3; // used to render blurred

// Global buffer locations
let buffer1, buffer2, buffer3;

// Global attribute locations
let vPosition_loc_1, vPosition_loc_2, vPosition_loc_3;

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

	// Create a single rectangle and triangle
	let tri_verts = [vec2(-1, -1), vec2(1, -1), vec2(0, 1)];
	let sq_verts = [vec2(-1, -1), vec2(-1, 0), vec2(0, -1), vec2(0, 0)];
	let sq_verts_2 = [vec2(0, 0), vec2(0, 1), vec2(1, 0), vec2(1, 1)];

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		varying vec2 fTexCoord;
		void main() {
			gl_Position = vPosition;
			fTexCoord = vPosition.xy;
		}
	`);
	// Fragment shader for off-screen rendering
	let fragShdr1 = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		void main() {
			gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
		}
	`);
	// Fragment shader for unblurred rendering
	let fragShdr2 = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		uniform sampler2D texture;
		varying vec2 fTexCoord;
		void main() {
			gl_FragColor = texture2D(texture, fTexCoord);
		}
	`);
	// Fragment shader for blurry rendering
	let fragShdr3 = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		uniform sampler2D texture;
		varying vec2 fTexCoord;
		void main() {
			float d = 1.0/512.0;
			vec4 top = texture2D(texture, fTexCoord-vec2(0,d));
			vec4 left = texture2D(texture, fTexCoord-vec2(d,0));
			vec4 right = texture2D(texture, fTexCoord+vec2(d,0));
			vec4 bottom = texture2D(texture, fTexCoord+vec2(0,d));
			vec4 cur = texture2D(texture, fTexCoord);

			gl_FragColor = (cur + top + left + right + bottom) / 5.0;
		}
	`);

	// Link the programs
	program1 = linkProgram(gl, [vertShdr, fragShdr1]);
	program2 = linkProgram(gl, [vertShdr, fragShdr2]);
	program3 = linkProgram(gl, [vertShdr, fragShdr3]);

	// Get attribute locations
	vPosition_loc_1 = gl.getAttribLocation(program1, 'vPosition');
	vPosition_loc_2 = gl.getAttribLocation(program2, 'vPosition');
	vPosition_loc_3 = gl.getAttribLocation(program3, 'vPosition');

	// Set the texture number
	gl.useProgram(program2);
	gl.uniform1i(gl.getUniformLocation(program2, 'texture'), 0);
	gl.useProgram(program3);
	gl.uniform1i(gl.getUniformLocation(program3, 'texture'), 0);

	// Load the vertex data into the GPU and associate with shader
	buffer1 = create_vertex_attr_buffer(gl, program1, 'vPosition', tri_verts);
	buffer2 = create_vertex_attr_buffer(gl, program2, 'vPosition', sq_verts);
	buffer3 = create_vertex_attr_buffer(gl, program3, 'vPosition', sq_verts_2);

	// Off-screen buffers
	fb = gl.createFramebuffer();
	rb = gl.createRenderbuffer();
	tex = create_texture(gl, 512, 512, 0);

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Render the scene
	render();
});

/**
 * Render the scene.
 */
function render() {
	// Begin rendering to texture
	render_to_texture(gl, fb, rb, tex);
	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the green triangle to a texture
	gl.useProgram(program1);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer1);
	gl.vertexAttribPointer(vPosition_loc_1, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);

	// Mipmaps must be re-generated after updating the data on the texture
	gl.activeTexture(gl.TEXTURE0);
	gl.generateMipmap(gl.TEXTURE_2D);

	// Begin rendering to screen
	render_to_screen(gl);
	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the textured square to the screen
	gl.useProgram(program2);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer2);
	gl.vertexAttribPointer(vPosition_loc_2, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Draw the textured square to the screen
	gl.useProgram(program3);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer3);
	gl.vertexAttribPointer(vPosition_loc_3, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Animate
	window.requestAnimationFrame(render);
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
