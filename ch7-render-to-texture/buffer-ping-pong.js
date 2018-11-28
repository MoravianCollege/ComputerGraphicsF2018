// This is a WebGL example that demonstrates buffer ping-ponging

// Global WebGL context variable
let gl;

// Off-Screen Buffers
let fb, rb, tex1, tex2;

// Global program variables
let program_green, program_blur, program_texture;

// Global texture uniform locations
let texture_loc_blur, texture_loc_texture;

// Global attribute locations
let vPosition_loc_green, vPosition_loc_blur, vPosition_loc_texture;

// Global buffer locations
let buffer_tri, buffer_sq;

// Target texture (are we rendering to tex1 or tex2 and using the other one)
let target = 1;

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
	let sq_verts = [vec2(-1, -1), vec2(-1, 1), vec2(1, -1), vec2(1, 1)];

	// Compile shaders
	let vertShdr = compileShader(gl, gl.VERTEX_SHADER, `
		attribute vec4 vPosition;
		varying vec2 fTexCoord;
		void main() {
			gl_Position = vPosition;
			fTexCoord = (vPosition.xy + 1.0) / 2.0;
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
	texture_loc_blur = gl.getUniformLocation(program_blur, 'texture');
	texture_loc_texture = gl.getUniformLocation(program_texture, 'texture');

	// Load the vertex data into the GPU
	buffer_tri = create_buffer(gl, tri_verts);
	buffer_sq = create_buffer(gl, sq_verts);

	// Off-screen buffers (we need 2 textures for ping-ponging)
	fb = gl.createFramebuffer();
	rb = gl.createRenderbuffer();
	tex1 = create_texture(gl, 512, 512, 1);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	tex2 = create_texture(gl, 512, 512, 2);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// Render the initial triangle
	render_triangle();

	// Add the resize listener
	window.addEventListener('resize', onResize);

	// Render the scene
	render();
});

function render_triangle() {
	render_to_texture(gl, fb, rb, tex1);
	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the green triangle to a texture
	gl.useProgram(program_green);
	set_vertex_attr_buffer(gl, vPosition_loc_green, buffer_tri, 2);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);

	// Mipmaps must be re-generated after updating the data on the texture
	gl.activeTexture(gl.TEXTURE1);
	gl.generateMipmap(gl.TEXTURE_2D);
}

function offscreen_blur() {
	render_to_texture(gl, fb, rb, target === 1 ? tex1 : tex2);
	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the green triangle to a texture
	gl.useProgram(program_blur);
	gl.uniform1i(texture_loc_blur, target === 1 ? 2 : 1);
	set_vertex_attr_buffer(gl, vPosition_loc_blur, buffer_sq, 2);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// Mipmaps must be re-generated after updating the data on the texture
	gl.activeTexture(target === 1 ? gl.TEXTURE1 : gl.TEXTURE2);
	gl.generateMipmap(gl.TEXTURE_2D);
}

/**
 * Render the scene.
 */
function render() {
	// Update the off-screen rendering
	target = target === 1 ? 2 : 1;
	offscreen_blur();

	// Begin rendering to screen
	render_to_screen(gl);
	gl.clearColor(0.0, 0.0, 0.0, 0.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw the textured square to the screen
	gl.useProgram(program_texture);
	gl.uniform1i(texture_loc_texture, target === 1 ? 1 : 2);
	set_vertex_attr_buffer(gl, vPosition_loc_texture, buffer_sq, 2);
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
