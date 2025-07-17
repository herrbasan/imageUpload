'use strict';

let g = {};
let ut = initUtilities();
document.addEventListener('DOMContentLoaded', init);

function init() {
	g.imagePreviewContainer = ut.el('.image-preview-container');
	g.imageWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--image-width')) || 256;
	g.imageHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--image-height')) || 256;
	
	g.canvas = document.createElement('canvas');
	g.canvas.width = g.imageWidth;
	g.canvas.height = g.imageHeight;
	g.ctx = g.canvas.getContext('2d');

	g.MAX_ZOOM = 2.5;
	g.MIN_ZOOM = 0.05;
	g.MOUSEWHEEL_ZOOM_STEP = 0.05;

	

	ut.el('section.canvas').appendChild(g.canvas);
	checkSetTheme();
	initApp();

	window.addEventListener('resize', resizePreviewContainer);
	resizePreviewContainer();
	
	ut.el('#upload-button').addEventListener('click', uploadImage);
}

function initApp() {
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
	g.currentImage = img;
	img.scale = 1;
	img.pos = { x: 0, y: 0 };
	img.start = { x: 0, y: 0 };
	img.dragging = false;
	img.rafId = null;
	img.last = { x: img.pos.x, y: img.pos.y, scale: img.scale };
	
	g.lastScale = img.scale;
	g.lastPos = img.pos;

	img.resetBtn = ut.el('#reset-image');
	img.zoomSlider = ut.el('#zoom-slider');

	img.onload = function() {
		g.img = img.cloneNode(true);
		initTransformEvents(img);
		applyInitialTransform();
	};

}

function setTransform() {
	if (!g.currentImage) return;
	let img = g.currentImage;
	img.scale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, img.scale));
	if (img.pos.x === img.last.x && img.pos.y === img.last.y && img.scale === img.last.scale) return;
	if (img.transformQueued) return;
	img.transformQueued = true;
	requestAnimationFrame(() => {
		img.last.x = img.pos.x;
		img.last.y = img.pos.y;
		img.last.scale = img.scale;
		img.style.transform = `translate(${img.pos.x}px, ${img.pos.y}px) scale(${img.scale})`;
		if (img.zoomSlider && Number(img.zoomSlider.value) !== img.scale) {
			img.zoomSlider.value = img.scale;
		}
		// Store current transform globally for cropping
		g.lastScale = img.scale;
		g.lastPos = { x: img.pos.x, y: img.pos.y };
		img.transformQueued = false;
		updateCroppedImageDelayed();
	});
}

function applyInitialTransform() {
	if(!g.currentImage) return;
	let img = g.currentImage;
	let iW = img.naturalWidth;
	let iH = img.naturalHeight;
	ut.log(`Image size: ${iW}x${iH}, Reference size: ${g.imageWidth}x${g.imageHeight}`);
	if (iW && iH && g.imageWidth && g.imageHeight) {
		let scaleW = g.imageWidth / iW;
		let scaleH = g.imageHeight / iH;
		ut.log(`Initial scale: ${scaleW} (width), ${scaleH} (height)`);
		img.scale = Math.min(scaleW, scaleH);
		img.scale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, img.scale));
		img.pos.x = (g.imageWidth - iW * img.scale) / 2;
		img.pos.y = (g.imageHeight - iH * img.scale) / 2;
		setTransform();
	}
}

function initTransformEvents(img) {
	if (img.resetBtn) {
		img.resetBtn.onclick = function() {
			applyInitialTransform();
		};
	}

	if (img.zoomSlider) {
		img.zoomSlider.addEventListener('input', function() {
			let prevScale = img.scale;
			let nextScale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, Number(img.zoomSlider.value)));
			// Center image in reference container when zooming
			let centerX = g.imageWidth / 2;
			let centerY = g.imageHeight / 2;
			let imgCenterX = (centerX - img.pos.x) / prevScale;
			let imgCenterY = (centerY - img.pos.y) / prevScale;
			img.pos.x -= (imgCenterX * (nextScale - prevScale));
			img.pos.y -= (imgCenterY * (nextScale - prevScale));
			img.scale = nextScale;
			setTransform();
		});
	}

	img.addEventListener('wheel', function(e) {
		e.preventDefault();
		let prevScale = img.scale;
		let baseStep = g.MOUSEWHEEL_ZOOM_STEP;
		let step = baseStep * img.scale;
		let delta = e.deltaY > 0 ? -step : step;
		let nextScale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, img.scale + delta));
		// Center image in reference container
		let centerX = g.imageWidth / 2;
		let centerY = g.imageHeight / 2;
		let imgCenterX = (centerX - img.pos.x) / prevScale;
		let imgCenterY = (centerY - img.pos.y) / prevScale;
		img.pos.x -= (imgCenterX * (nextScale - prevScale));
		img.pos.y -= (imgCenterY * (nextScale - prevScale));
		img.scale = nextScale;
		setTransform();
	}, { passive: false });

	img.addEventListener('mousedown', function(e) {
		e.preventDefault();
		img.dragging = true;
		img.style.cursor = 'grabbing';
		img.start.x = e.clientX - img.pos.x;
		img.start.y = e.clientY - img.pos.y;
		document.body.style.userSelect = 'none';
	});

	document.addEventListener('mousemove', onMove);
	document.addEventListener('mouseup', onUp);

	function onMove(e) {
		if (!img.dragging) return;
		img.pos.x = e.clientX - img.start.x;
		img.pos.y = e.clientY - img.start.y;
		setTransform();
	}

	function onUp() {
		img.dragging = false;
		img.style.cursor = 'grab';
		document.body.style.userSelect = '';
	}

	// Touch support (improved pinch/zoom logic)
	let lastTouch = null;
	let pinchStart = null;
	img.addEventListener('touchstart', function(e) {
		if (e.touches.length === 1) {
			img.dragging = true;
			lastTouch = { x: e.touches[0].clientX - img.pos.x, y: e.touches[0].clientY - img.pos.y };
			img.style.cursor = 'grabbing';
		} else if (e.touches.length === 2) {
			let rect = img.getBoundingClientRect();
			let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
			let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
			pinchStart = {
				dist: getTouchDist(e.touches),
				scale: img.scale,
				center: {
					x: (cx - rect.left) / img.scale,
					y: (cy - rect.top) / img.scale
				},
				pos: { x: img.pos.x, y: img.pos.y },
				screenCenter: { x: cx, y: cy }
			};
		}
	}, { passive: false });

	img.addEventListener('touchmove', function(e) {
		interActionStarted();
		e.preventDefault();
		if (e.touches.length === 1 && img.dragging) {
			img.pos.x = e.touches[0].clientX - lastTouch.x;
			img.pos.y = e.touches[0].clientY - lastTouch.y;
			setTransform();
		} else if (e.touches.length === 2 && pinchStart) {
			let newDist = getTouchDist(e.touches);
			let nextScale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, pinchStart.scale * (newDist / pinchStart.dist)));
			let rect = img.getBoundingClientRect();
			let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
			let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
			// Calculate pan delta
			let dx = cx - pinchStart.screenCenter.x;
			let dy = cy - pinchStart.screenCenter.y;
			// Keep pinch center fixed and allow panning
			img.pos.x = pinchStart.pos.x - (pinchStart.center.x * (nextScale - pinchStart.scale)) + dx;
			img.pos.y = pinchStart.pos.y - (pinchStart.center.y * (nextScale - pinchStart.scale)) + dy;
			img.scale = nextScale;
			setTransform();
		}
	}, { passive: false });

	img.addEventListener('touchend', function(e) {
		img.dragging = false;
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
			let panStep = 20 * img.scale; // step size relative to current scale
			let moved = false;
			switch (e.key) {
				case 'ArrowLeft':
					img.pos.x -= panStep;
					moved = true;
					break;
				case 'ArrowRight':
					img.pos.x += panStep;
					moved = true;
					break;
				case 'ArrowUp':
					img.pos.y -= panStep;
					moved = true;
					break;
				case 'ArrowDown':
					img.pos.y += panStep;
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

function interActionStarted() {
	/*if (!g.currentImage) return;
	clearTimeout(g.currentImage.canvasTimeout);
	g.currentImage.canvasTimeout = null;*/
}

function interActionFinished() {
	/*updateCroppedImage();*/
}

// Responsive resize logic
function resizePreviewContainer() {
	let section = ut.el('main > section');
	let preview = ut.el('.image-preview');
	let maxW = g.imageWidth || 800;
	let maxH = g.imageHeight || 600;
	let style = window.getComputedStyle(section);
	let padLeft = parseFloat(style.paddingLeft) || 0;
	let padRight = parseFloat(style.paddingRight) || 0;
	let sectionW = section.offsetWidth - padLeft - padRight;
	let w = Math.min(sectionW, maxW);
	let scale = w / maxW;
	// Use transform to scale the container instead of changing width/height
	preview.style.transform = `scale(${scale})`;
	preview.style.transformOrigin = 'top left';
	// Keep original dimensions for consistent logic
	preview.style.width = maxW + 'px';
	preview.style.height = maxH + 'px';
	preview.style.marginBottom = -maxH * (1 - scale) + 'px';

	updateCroppedImage();
}

function uploadImage() {
	generateCroppedImage(g.img, g.lastScale, g.lastPos, {width: g.imageWidth, height: g.imageHeight});
	let imgDataUrl = g.canvas.toDataURL('image/jpeg', 0.92);
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

function updateCroppedImage() {
	if (!g.currentImage) return;
	let img = g.currentImage;
	generateCroppedImage(img, g.lastScale, g.lastPos, { width: g.imageWidth, height: g.imageHeight });
}
function updateCroppedImageDelayed() {
	if (!g.currentImage) return;
	let img = g.currentImage;
	clearTimeout(img.canvasTimeout);
	img.canvasTimeout = setTimeout(() => {
		generateCroppedImage(img, g.lastScale, g.lastPos, { width: g.imageWidth, height: g.imageHeight });
	}, 100);
}
// Generate a cropped image from the preview using canvas
function generateCroppedImage(img, scale, pos, cropSize) {
	
	let ctx = g.ctx;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, cropSize.width, cropSize.height);


	let iW = img.naturalWidth;
	let iH = img.naturalHeight;
	scale = Math.max(0.0001, scale); // avoid div by zero

	//ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, cropSize.width, cropSize.height);
	ctx.clip();
	ctx.drawImage(img, pos.x, pos.y, iW * scale, iH * scale);
	//ctx.restore();
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
	return utils;
}