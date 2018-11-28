// This is a WebGL example that demonstrates rendering to a texture

// Global WebGL context variable
let gl;

// Off-Screen Buffers
let fb, rb, tex;

// Global program variables
let program_green, program_blur, program_texture;

// Global buffer locations
let buffer_tri, buffer_sq1, buffer_sq2;

// Global attribute locations
let vPosition_loc_green, vPosition_loc_blur, vPosition_loc_texture;

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
	// Fragment shader for rendering in all-green
	let fragShdr_green = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		void main() {
			gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
		}
	`);
	// Fragment shader for rendering a texture plain
	let fragShdr_texture = compileShader(gl, gl.FRAGMENT_SHADER, `
		precision mediump float;
		uniform sampler2D texture;
		varying vec2 fTexCoord;
		void main() {
			gl_FragColor = texture2D(texture, fTexCoord);
		}
	`);
	// Fragment shader for rendering a texture blurry
	let fragShdr_blur = compileShader(gl, gl.FRAGMENT_SHADER, `
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
	program_green = linkProgram(gl, [vertShdr, fragShdr_green]);
	program_texture = linkProgram(gl, [vertShdr, fragShdr_texture]);
	program_blur = linkProgram(gl, [vertShdr, fragShdr_blur]);

	// Get attribute locations
	vPosition_loc_green = enable_attribute(gl, program_green, 'vPosition');
	vPosition_loc_blur = enable_attribute(gl, program_blur, 'vPosition');
	vPosition_loc_texture = enable_attribute(gl, program_texture, 'vPosition');

	// Set the texture number
	gl.useProgram(program_blur);
	gl.uniform1i(gl.getUniformLocation(program_blur, 'texture'), 0);
	gl.useProgram(program_texture);
	gl.uniform1i(gl.getUniformLocation(program_texture, 'texture'), 0);

	// Load the vertex data into the GPU
	buffer_tri = create_buffer(gl, tri_verts);
	buffer_sq1 = create_buffer(gl, sq_verts);
	buffer_sq2 = create_buffer(gl, sq_verts_2);

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
	gl.useProgram(program_green);
	set_vertex_attr_buffer(gl, vPosition_loc_green, buffer_tri, 2);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);

	// Mipmaps must be re-generated after updating the data on the texture
	gl.activeTexture(gl.TEXTURE0);
	gl.generateMipmap(gl.TEXTURE_2D);

	// Begin rendering to screen
	render_to_screen(gl);
	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the textured square to the screen
	gl.useProgram(program_texture);
	set_vertex_attr_buffer(gl, vPosition_loc_texture, buffer_sq1, 2);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Draw the textured square to the screen
	gl.useProgram(program_blur);
	set_vertex_attr_buffer(gl, vPosition_loc_blur, buffer_sq2, 2);
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
