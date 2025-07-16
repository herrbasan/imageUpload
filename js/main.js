'use strict';

let g = {};
let ut = initUtilities();
document.addEventListener('DOMContentLoaded', init);

function init() {
	g.imagePreviewContainer = ut.el('.image-preview-container');
	g.cssVars = ut.getCssVars();
	g.imageWidth = g.cssVars['--image-width']?.computed || 800;
	g.imageHeight = g.cssVars['--image-height']?.computed || 600;

	checkSetTheme();
	initUpload();

	// Responsive resize logic
	function resizePreviewContainer() {
		let section = ut.el('main > section');
		let preview = ut.el('.image-preview');
		let maxW = g.cssVars['--image-width']?.computed || 800;
		let maxH = g.cssVars['--image-height']?.computed || 600;
		let style = window.getComputedStyle(section);
		let padLeft = parseFloat(style.paddingLeft) || 0;
		let padRight = parseFloat(style.paddingRight) || 0;
		let sectionW = section.offsetWidth - padLeft - padRight;
		let w = Math.min(sectionW, maxW);
		let h = Math.min(sectionW, maxW); // keep square aspect ratio
		preview.style.width = w + 'px';
		preview.style.height = h + 'px';
		g.imageWidth = w;
		g.imageHeight = h;
	}
	window.addEventListener('resize', resizePreviewContainer);
	resizePreviewContainer();
	
	ut.log(g.cssVars);

	ut.el('#upload-button').addEventListener('click', uploadImage);
}

function initUpload() {
	placeImagePreview(randomUnsplashPortrait());
	let uploadInput = ut.el('#image-upload');
	uploadInput.addEventListener('change', handleFileSelect);
	function handleFileSelect(event) {
		let files = event.target.files;
		if (files.length > 0) {
			let file = files[0];
			let reader = new FileReader();
			reader.onload = function (e) {
				let img = document.createElement('img');
				img.src = e.target.result;
				placeImagePreview(img);
			};
			reader.readAsDataURL(file);
		} else {
			ut.el('#image-preview').innerHTML = 'No image selected.';
		}
	}
}

function placeImagePreview(img) {
	img.alt = 'Preview Image';
	img.style.cursor = 'grab';
	img.style.userSelect = 'none';
	img.style.transformOrigin = 'top left';
	ut.killKids(g.imagePreviewContainer);
	g.imagePreviewContainer.appendChild(img);

	// Always use reference size for transforms
	let refW = g.cssVars['--image-width']?.computed || 800;
	let refH = g.cssVars['--image-height']?.computed || 800;
	let scale = 1;
	let pos = { x: 0, y: 0 };
	g.lastScale = scale;
	g.lastPos = pos;
	let start = { x: 0, y: 0 };
	let dragging = false;
	let rafId = null;
	let last = { x: pos.x, y: pos.y, scale: scale };
	const MIN_ZOOM = 0.05;
	const MAX_ZOOM = 2.5;

	// Initial fit-to-reference
	function applyInitialTransform() {
		let iW = img.naturalWidth;
		let iH = img.naturalHeight;
		ut.log(`Image size: ${iW}x${iH}, Reference size: ${refW}x${refH}`);
		if (iW && iH && refW && refH) {
			let scaleW = refW / iW;
			let scaleH = refH / iH;
			ut.log(`Initial scale: ${scaleW} (width), ${scaleH} (height)`);
			scale = Math.min(scaleW, scaleH);
			scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
			pos.x = (refW - iW * scale) / 2;
			pos.y = (refH - iH * scale) / 2;
			setTransform();
		}
	}
	img.onload = applyInitialTransform;

	// When container is resized, only update visual size, not transform logic
	window.addEventListener('resize', () => {
		let preview = ut.el('.image-preview');
		let section = ut.el('main > section');
		let style = window.getComputedStyle(section);
		let padLeft = parseFloat(style.paddingLeft) || 0;
		let padRight = parseFloat(style.paddingRight) || 0;
		let sectionW = section.offsetWidth - padLeft - padRight;
		let w = Math.min(sectionW, refW);
		preview.style.width = w + 'px';
		preview.style.height = w + 'px';
	});

	// Reset button handler
	let resetBtn = ut.el('#reset-image');
	if (resetBtn) {
		resetBtn.onclick = function() {
			applyInitialTransform();
		};
	}

	let zoomSlider = ut.el('#zoom-slider');
	let transformQueued = false;
	function setTransform() {
		scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
		if (pos.x === last.x && pos.y === last.y && scale === last.scale) return;
		if (transformQueued) return;
		transformQueued = true;
		requestAnimationFrame(() => {
			last.x = pos.x;
			last.y = pos.y;
			last.scale = scale;
			img.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${scale})`;
			if (zoomSlider && Number(zoomSlider.value) !== scale) {
				zoomSlider.value = scale;
			}
			// Store current transform globally for cropping
			g.lastScale = scale;
			g.lastPos = { x: pos.x, y: pos.y };
			transformQueued = false;
		});
	}

	if (zoomSlider) {
		zoomSlider.max = MAX_ZOOM;
		zoomSlider.min = MIN_ZOOM;
		zoomSlider.addEventListener('input', function() {
			let prevScale = scale;
			let nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoomSlider.value)));
			// Center image in reference container when zooming
			let centerX = refW / 2;
			let centerY = refH / 2;
			let imgCenterX = (centerX - pos.x) / prevScale;
			let imgCenterY = (centerY - pos.y) / prevScale;
			pos.x -= (imgCenterX * (nextScale - prevScale));
			pos.y -= (imgCenterY * (nextScale - prevScale));
			scale = nextScale;
			setTransform();
		});
	}

	img.addEventListener('wheel', function(e) {
		e.preventDefault();
		let prevScale = scale;
		let baseStep = 0.05;
		let step = baseStep * scale;
		let delta = e.deltaY > 0 ? -step : step;
		let nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale + delta));
		// Center image in reference container
		let centerX = refW / 2;
		let centerY = refH / 2;
		let imgCenterX = (centerX - pos.x) / prevScale;
		let imgCenterY = (centerY - pos.y) / prevScale;
		pos.x -= (imgCenterX * (nextScale - prevScale));
		pos.y -= (imgCenterY * (nextScale - prevScale));
		scale = nextScale;
		setTransform();
	}, { passive: false });

	img.addEventListener('mousedown', function(e) {
		e.preventDefault();
		dragging = true;
		img.style.cursor = 'grabbing';
		start.x = e.clientX - pos.x;
		start.y = e.clientY - pos.y;
		document.body.style.userSelect = 'none';
	});

	document.addEventListener('mousemove', onMove);
	document.addEventListener('mouseup', onUp);

	function onMove(e) {
		if (!dragging) return;
		pos.x = e.clientX - start.x;
		pos.y = e.clientY - start.y;
		setTransform();
	}

	function onUp() {
		dragging = false;
		img.style.cursor = 'grab';
		document.body.style.userSelect = '';
	}

	// Touch support (improved pinch/zoom logic)
	let lastTouch = null;
	let pinchStart = null;
	img.addEventListener('touchstart', function(e) {
		if (e.touches.length === 1) {
			dragging = true;
			lastTouch = { x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y };
			img.style.cursor = 'grabbing';
		} else if (e.touches.length === 2) {
			let rect = img.getBoundingClientRect();
			let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
			let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
			pinchStart = {
				dist: getTouchDist(e.touches),
				scale: scale,
				center: {
					x: (cx - rect.left) / scale,
					y: (cy - rect.top) / scale
				},
				pos: { x: pos.x, y: pos.y },
				screenCenter: { x: cx, y: cy }
			};
		}
	}, { passive: false });

	img.addEventListener('touchmove', function(e) {
		e.preventDefault();
		if (e.touches.length === 1 && dragging) {
			pos.x = e.touches[0].clientX - lastTouch.x;
			pos.y = e.touches[0].clientY - lastTouch.y;
			setTransform();
		} else if (e.touches.length === 2 && pinchStart) {
			let newDist = getTouchDist(e.touches);
			let nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStart.scale * (newDist / pinchStart.dist)));
			let rect = img.getBoundingClientRect();
			let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
			let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
			// Calculate pan delta
			let dx = cx - pinchStart.screenCenter.x;
			let dy = cy - pinchStart.screenCenter.y;
			// Keep pinch center fixed and allow panning
			pos.x = pinchStart.pos.x - (pinchStart.center.x * (nextScale - pinchStart.scale)) + dx;
			pos.y = pinchStart.pos.y - (pinchStart.center.y * (nextScale - pinchStart.scale)) + dy;
			scale = nextScale;
			setTransform();
		}
	}, { passive: false });

	img.addEventListener('touchend', function(e) {
		dragging = false;
		img.style.cursor = 'grab';
		lastTouch = null;
		pinchStart = null;
	}, { passive: false });

	function getTouchDist(touches) {
		let dx = touches[0].clientX - touches[1].clientX;
		let dy = touches[0].clientY - touches[1].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	// Keyboard pan support when container is focused
	let previewContainer = g.imagePreviewContainer;
	if (previewContainer) {
		previewContainer.addEventListener('keydown', function(e) {
			let panStep = 20 * scale; // step size relative to current scale
			let moved = false;
			switch (e.key) {
				case 'ArrowLeft':
					pos.x -= panStep;
					moved = true;
					break;
				case 'ArrowRight':
					pos.x += panStep;
					moved = true;
					break;
				case 'ArrowUp':
					pos.y -= panStep;
					moved = true;
					break;
				case 'ArrowDown':
					pos.y += panStep;
					moved = true;
					break;
			}
			if (moved) {
				setTransform();
				e.preventDefault();
			}
		});
	}
}

function uploadImage() {
	// Save current preview size
	let preview = ut.el('.image-preview');
	let prevW = preview.style.width;
	let prevH = preview.style.height;
	// Set preview to max size for export
	let maxW = g.cssVars['--image-width']?.computed || 800;
	let maxH = g.cssVars['--image-height']?.computed || 600;
	preview.style.width = maxW + 'px';
	preview.style.height = maxH + 'px';
	// Update global size
	g.imageWidth = maxW;
	g.imageHeight = maxH;

	// Generate cropped image
	let img = g.imagePreviewContainer.querySelector('img');
	let cropSize = { width: maxW, height: maxH };
	let imgDataUrl = generateCroppedImage(img, g.lastScale, g.lastPos, cropSize);

	// Restore preview size
	preview.style.width = prevW;
	preview.style.height = prevH;
	// Restore global size
	let section = ut.el('main > section');
	let style = window.getComputedStyle(section);
	let padLeft = parseFloat(style.paddingLeft) || 0;
	let padRight = parseFloat(style.paddingRight) || 0;
	let sectionW = section.offsetWidth - padLeft - padRight;
	g.imageWidth = Math.min(sectionW, maxW);
	g.imageHeight = Math.min(sectionW, maxW);

	let win = window.open();
	if (win) {
		win.document.write(/*html*/`
			<html>
				<head><title>Cropped Image</title></head>
				<body style='margin:0;display:flex;align-items:center;justify-content:center;background:#222;'>
					<img src='${imgDataUrl}'>
				</body>
			</html>`
		);
		win.document.close();
	}
}

// Generate a cropped image from the preview using canvas
function generateCroppedImage(img, scale, pos, cropSize) {
	// cropSize: { width, height } in pixels (output size)
	let canvas = document.createElement('canvas');
	canvas.width = cropSize.width;
	canvas.height = cropSize.height;
	let ctx = canvas.getContext('2d');

	// Draw blank black canvas first
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, cropSize.width, cropSize.height);

	// Draw the image exactly as positioned and scaled in the preview
	let iW = img.naturalWidth;
	let iH = img.naturalHeight;
	scale = Math.max(0.0001, scale); // avoid div by zero

	// The image in the preview is transformed by pos and scale
	// We want to draw the image at the same offset and scale on the canvas
	// The canvas is the same size as the preview
	// So: drawImage(img, dx, dy, dw, dh)
	// dx = pos.x, dy = pos.y, dw = iW * scale, dh = iH * scale
	// If part of the image is outside the canvas, it will be clipped, and the background will show
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, cropSize.width, cropSize.height);
	ctx.clip();
	ctx.drawImage(img, pos.x, pos.y, iW * scale, iH * scale);
	ctx.restore();

	let out = canvas.toDataURL('image/jpeg', 0.92); // 0.92 is a good default quality
	return out;
}

function checkSetTheme() {
	let root = document.documentElement;
	let themeToggle = ut.el('#theme-toggle');

	function setTheme(mode) {
		if (mode === 'dark') {
			root.setAttribute('data-theme', 'dark');
			localStorage.setItem('theme', 'dark');
		} else if (mode === 'light') {
			root.setAttribute('data-theme', 'light');
			localStorage.setItem('theme', 'light');
		} else {
			root.removeAttribute('data-theme');
			localStorage.removeItem('theme');
		}
	}

	function getPreferredTheme() {
		return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
	}

	function toggleTheme() {
		let current = getPreferredTheme();
		setTheme(current === 'dark' ? 'light' : 'dark');
	}

	if (themeToggle) {
		themeToggle.addEventListener('click', toggleTheme);
	}

	// Set theme on page load
	setTheme(getPreferredTheme());
}

function randomUnsplashPortrait() {
	let n = Math.floor(Math.random() * 24) + 1;
	let numStr = n.toString().padStart(3, '0');
	let url = `assets/${numStr}.jpg`;
	let img = new Image();
	img.src = url;
	return img;
}

function initUtilities() {
	let utils = {};
	utils.el = function (s, context = document) { if (s instanceof Element) { return s; } else { return context.querySelector(s); } }
	utils.els = function (s, context = document) { return context.querySelectorAll(s); }
	utils.killKids = function (_el) { _el = utils.el(_el); while (_el?.firstChild) { _el.removeChild(_el.firstChild); } }
	utils.killMe = function (_el) { _el = utils.el(_el); if (_el?.parentNode) { _el.parentNode.removeChild(_el); } }
	utils.log = console.log.bind(console);

	utils.getCssVars = function(el = document.styleSheets) {
		let out = {};
		let names = getCssVarNames(el);
		for (let i = 0; i < names.length; i++) {
			out[names[i]] = utils.getCssVar(names[i]);
		}
		return out;
	}

	utils.getCssVar = function(prop, el) {
		if (!el) { el = document.body }
		let s = getComputedStyle(el).getPropertyValue(prop).trim();
		let unit = false;
		let value = s;
		let computed = false;
		let absolute_units = ['cm', 'mm', 'Q', 'in', 'pc', 'pt', 'px'];
		let relative_units = ['%', 'rem', 'em', 'ex', 'ch', 'lh', 'rlh', 'svw', 'svh', 'dvw', 'dvh', 'lvw', 'lvh', 'vw', 'vh', 'vmin', 'vmax', 'vb', 'vi'];
		let isAbsolute = false;

		if (!isNaN(s)) { return { value: Number(s), unit: 'number', absolute: true, computed: Number(s) } }

		for (let i = 0; i < absolute_units.length; i++) {
			let item = absolute_units[i];
			if (s.substr(s.length - item.length, item.length) == item && !s.includes('vmin')) {
				let t = Number(s.substr(0, s.length - item.length));
				if (!isNaN(t)) {
					value = t;
					computed = value;
					unit = item;
					isAbsolute = true;
					break;
				}
			}
		}
		if (!isAbsolute) {
			for (let i = 0; i < relative_units.length; i++) {
				let item = relative_units[i];
				if (s.substr(s.length - item.length, item.length) == item) {
					value = Number(s.substr(0, s.length - item.length));
					unit = item;
					if (item == 'em' || item == 'rem') {
						let base = ut.getCssVar('font-size', el).value;
						computed = Math.round(value * base);
					}
					else if (item == 'vw' || item == '%') {
						value = value / 100;
						computed = Math.round(value * window.innerWidth);
					}
					else if (item == 'vh') {
						value = value / 100;
						computed = Math.round(value * window.innerHeight);
					}
					else if (item == 'vmin' || item == 'vmax') {
						value = value / 100;
						let side = window.innerWidth;
						if (window.innerHeight > window.innerWidth) {
							side = window.innerHeight;
						}
						computed = Math.round(value * side);
					}
					break;
				}
			}
		}
		if (!unit) {
			let c = utils.parseCSSColor(s);
			if (c) {
				unit = 'rgba';
				isAbsolute = true;
				computed = c;
			}
		}
		return { value: value, unit: unit, absolute: isAbsolute, computed: computed };
	}

	utils.setCssVar = function(s, val) {
		document.documentElement.style.setProperty(s, val);
	}

	utils.cssColorString = function(ar) {
		if (ar.length > 3) {
			return `rgba(${ar[0]},${ar[1]},${ar[2]},${ar[3]})`
		}
		return `rgb(${ar[0]},${ar[1]},${ar[2]})`
	}

	function getCssVarNames(el = document.styleSheets) {
		var cssVars = [];
		for (var i = 0; i < el.length; i++) {
			try {
				for (var j = 0; j < el[i].cssRules.length; j++) {
					try {
						for (var k = 0; k < el[i].cssRules[j].style.length; k++) {
							let name = el[i].cssRules[j].style[k];
							if (name.startsWith('--') && cssVars.indexOf(name) == -1) {
								cssVars.push(name);
							}
						}
					} catch (error) { }
				}
			} catch (error) { }
		}
		return cssVars;
	}

	utils.parseCSSColor = function(color) {
		var cache,
			p = parseInt,
			color = color.replace(/\s/g, '');
		if (cache = /#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})/.exec(color))
			cache = [p(cache[1], 16), p(cache[2], 16), p(cache[3], 16)];
		else if (cache = /#([\da-fA-F])([\da-fA-F])([\da-fA-F])/.exec(color))
			cache = [p(cache[1], 16) * 17, p(cache[2], 16) * 17, p(cache[3], 16) * 17];
		else if (cache = /rgba\(([\d]+),([\d]+),([\d]+),([\d]+|[\d]*.[\d]+)\)/.exec(color))
			cache = [+cache[1], +cache[2], +cache[3], +cache[4]];
		else if (cache = /rgb\(([\d]+),([\d]+),([\d]+)\)/.exec(color))
			cache = [+cache[1], +cache[2], +cache[3]];
		else return false;

		isNaN(cache[3]) && (cache[3] = 1);
		return cache;
	}
	return utils;
}