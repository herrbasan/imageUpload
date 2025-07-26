'use strict';
import { initImageFilters } from './imageUploadFilters.js';
let g = {};
let ut = initUtilities();

export function initImageUpload(prop = {}) {
	init(prop);
}

function init(prop) {
	applyMinimalStyles();
	g.imagePreviewContainer = ut.el('.imageUpload-preview-container');
	g.imagePreviewPositionControls = ut.el('.imageUpload-preview .position-controls');
	g.imagePreview = g.imagePreviewContainer.parentNode
	g.imageWidth = g.imageWidth || ut.cssVarNum('--imageUpload-width') || 512;
	g.imageHeight = g.imageHeight || ut.cssVarNum('--imageUpload-height') || 512;


	g.canvas = ut.el('.imageUpload-canvas-preview canvas');
	g.canvas.width = g.imageWidth || prop.imageWidth || 512;
	g.canvas.height = g.imageHeight || prop.imageHeight || 512;
	g.ctx = g.canvas.getContext('2d', { willReadFrequently: true });
	g.containerScale = 1;

	g.MAX_ZOOM = prop.MAX_ZOOM || 5;
	g.MIN_ZOOM = prop.MIN_ZOOM || 0.05;
	g.MOUSEWHEEL_ZOOM_STEP = prop.MOUSEWHEEL_ZOOM_STEP || 0.05;
	g.KEYBOARD_PAN_STEP = prop.KEYBOARD_PAN_STEP || 40; // pixels per key press

	g.ALLOW_FILTERS = prop.ALLOW_FILTERS || false;
	g.ALLOW_OFFSCREEN_CANVAS = prop.ALLOW_OFFSCREEN_CANVAS || true; // Use OffscreenCanvas if available
	g.CANVAS_PREVIEW_DELAY = prop.CANVAS_PREVIEW_DELAY || 0; // ms delay for canvas updates
	g.CANVAS_BACKGROUND_COLOR = prop.CANVAS_BACKGROUND_COLOR || getComputedStyle(document.documentElement).getPropertyValue('--color-canvas-bg') || 'rgb(150, 150, 150)'; // Background color for canvas

	// Initialize worker for offscreen canvas processing
	if (g.ALLOW_OFFSCREEN_CANVAS) {
		initImageWorker();
	}
	if( g.ALLOW_FILTERS ) { initImageFilters(g, ut, setTransform); }

	window.addEventListener('resize', resizePreviewContainer);
	resizePreviewContainer();

	ut.el('#imageUpload-upload-button').addEventListener('click', uploadImage);
	ut.el('#imageUpload-file-select').addEventListener('change', handleFileSelect);
	
}

function handleFileSelect(event) {
		let files = event.target.files;
		if (files.length > 0) {
			let file = files[0];
			let reader = new FileReader();
			reader.onload = function (e) {
				let img = document.createElement('img');
				img.src = e.target.result;
				placeImage(img);
			};
			reader.readAsDataURL(file);
		} else {
			ut.log('No file selected');
		}
	}

function placeImage(img) {
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
	g.activeFilter = 'none';

	img.resetBtnFill = ut.el('#reset-imageUpload-fill');
	img.resetBtnFit = ut.el('#reset-imageUpload-fit');
	img.zoomSlider = ut.el('#zoom-slider-control');

	img.onload = function() {
		g.img = img.cloneNode(true);
		// Send new image to worker when image changes
		sendImageToWorker(img);
		initTransformEvents(img);
		applyTransform();
		if( g.ALLOW_FILTERS ) { 
			initImageFilters(g, ut, setTransform); }
	}
}

function setTransform() {
	if (!g.currentImage) return;
	let img = g.currentImage;
	img.scale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, img.scale));
	if (img.pos.x === img.last.x && img.pos.y === img.last.y && img.scale === img.last.scale && g.activeFilter === img.last.filter) return;
	if (img.transformQueued) return;
	img.transformQueued = true;
	requestAnimationFrame(() => {
		img.last.x = img.pos.x;
		img.last.y = img.pos.y;
		img.last.scale = img.scale;
		img.last.filter = g.activeFilter;
		img.style.transform = `translate(${img.pos.x}px, ${img.pos.y}px) scale(${img.scale})`;
		img.style.filter = g.activeFilter || 'none';
		if (img.zoomSlider && Number(img.zoomSlider.value) !== img.scale) {
			img.zoomSlider.value = img.scale;
		}
		g.lastScale = img.scale;
		g.lastPos = { x: img.pos.x, y: img.pos.y };
		img.transformQueued = false;
		updateCroppedImage();
	});
}

function applyTransform(mode = 'fill') {
	if(!g.currentImage) return;
	let img = g.currentImage;
	let iW = img.naturalWidth;
	let iH = img.naturalHeight;
	ut.log(`Image size: ${iW}x${iH}, Reference size: ${g.imageWidth}x${g.imageHeight}`);
	if (iW && iH && g.imageWidth && g.imageHeight) {
		let scaleW = g.imageWidth / iW;
		let scaleH = g.imageHeight / iH;
		ut.log(`Scale options: ${scaleW} (width), ${scaleH} (height), mode: ${mode}`);
		
		if (mode === 'fill') {
			img.scale = Math.max(scaleW, scaleH);
		} else {
			img.scale = Math.min(scaleW, scaleH);
		}
		
		img.scale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, img.scale));
		img.pos.x = (g.imageWidth - iW * img.scale) / 2;
		img.pos.y = (g.imageHeight - iH * img.scale) / 2;
		setTransform();
	}
}

function initTransformEvents(img) {
	// Init buttons and sliders
	if (img.resetBtnFit) {
		img.resetBtnFit.onclick = function() {
			applyTransform('fit');
		};
	}
	if (img.resetBtnFill) {
		img.resetBtnFill.onclick = function() {
			applyTransform('fill');
		};
	}

	// Consolidated positioning functions
	function panImage(direction) {
		let basePanStep = g.KEYBOARD_PAN_STEP;
		let panStep = basePanStep * Math.max(0.5, img.scale); // Scale with zoom but minimum 0.5x
		switch (direction) {
			case 'left':
				img.pos.x -= panStep;
				break;
			case 'right':
				img.pos.x += panStep;
				break;
			case 'up':
				img.pos.y -= panStep;
				break;
			case 'down':
				img.pos.y += panStep;
				break;
		}
		setTransform();
	}
	
	// Keyboard pan support when container is focused
	// Uses Ctrl/Cmd + arrow keys to avoid conflicts with screen readers
	// Uses Alt + up/down arrow keys for zooming

	if (g.imagePreviewPositionControls) {
		g.imagePreviewPositionControls.addEventListener('keydown', function(e) {
			let moved = false;
			
			// Handle zoom with Alt + Up/Down arrows
			if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				zoomImage(e.key === 'ArrowUp' ? 'in' : 'out');
				moved = true;
			}
			// Handle panning with Ctrl/Cmd + arrow keys
			else if ((e.ctrlKey || e.metaKey) && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
				switch (e.key) {
					case 'ArrowLeft':
						panImage('left');
						moved = true;
						break;
					case 'ArrowRight':
						panImage('right');
						moved = true;
						break;
					case 'ArrowUp':
						panImage('up');
						moved = true;
						break;
					case 'ArrowDown':
						panImage('down');
						moved = true;
						break;
				}
			}
			
			if (moved) {
				e.preventDefault();
				e.stopPropagation();
			}
		});
	}

	// Initialize position control buttons for accessibility
	let panLeft = ut.el('#pan-left');
	let panRight = ut.el('#pan-right');
	let panUp = ut.el('#pan-up');
	let panDown = ut.el('#pan-down');

	if (panLeft) {
		panLeft.onclick = function() {
			panImage('left');
		};
	}
	if (panRight) {
		panRight.onclick = function() {
			panImage('right');
		};
	}
	if (panUp) {
		panUp.onclick = function() {
			panImage('up');
		};
	}
	if (panDown) {
		panDown.onclick = function() {
			panImage('down');
		};
	}

	function zoomImage(direction) {
		let prevScale = img.scale;
		let baseStep = g.MOUSEWHEEL_ZOOM_STEP;
		let step = baseStep * img.scale; // Make zoom proportional to current scale
		let delta = direction === 'in' ? step : -step;
		let nextScale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, img.scale + delta));
		
		// Center zoom on the image center
		let centerX = g.imageWidth / 2;
		let centerY = g.imageHeight / 2;
		let imgCenterX = (centerX - img.pos.x) / prevScale;
		let imgCenterY = (centerY - img.pos.y) / prevScale;
		img.pos.x -= (imgCenterX * (nextScale - prevScale));
		img.pos.y -= (imgCenterY * (nextScale - prevScale));
		img.scale = nextScale;
		setTransform();
	}

	if (img.zoomSlider) {
		img.zoomSlider.min = g.MIN_ZOOM;
		img.zoomSlider.max = g.MAX_ZOOM;
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

	// Mouse wheel zoom support
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

	// Mouse drag support
	img.addEventListener('mousedown', function(e) {
		e.preventDefault();
		img.dragging = true;
		img.style.cursor = 'grabbing';
		img.start.x = (e.clientX / g.containerScale) - img.pos.x;
		img.start.y = (e.clientY / g.containerScale) - img.pos.y;
		document.body.style.userSelect = 'none';
	});

	document.addEventListener('mousemove', onMove);
	document.addEventListener('mouseup', onUp);

	function onMove(e) {
		if (!img.dragging) return;
		img.pos.x = (e.clientX / g.containerScale) - img.start.x;
		img.pos.y = (e.clientY / g.containerScale) - img.start.y;
		setTransform();
	}

	function onUp() {
		img.dragging = false;
		img.style.cursor = 'grab';
		document.body.style.userSelect = '';
	}

	// Touch support
	let lastTouch = null;
	let pinchStart = null;
	img.addEventListener('touchstart', function(e) {
		e.preventDefault();
		e.stopPropagation();
		if (e.touches.length === 1) {
			img.dragging = true;
			lastTouch = { x: (e.touches[0].clientX / g.containerScale) - img.pos.x, y: (e.touches[0].clientY / g.containerScale) - img.pos.y };
			img.style.cursor = 'grabbing';
		} else if (e.touches.length === 2) {
			let rect = img.getBoundingClientRect();
			let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 / g.containerScale;
			let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 / g.containerScale;
			pinchStart = {
				dist: getTouchDist(e.touches),
				scale: img.scale,
				center: {
					x: (cx - rect.left / g.containerScale) / img.scale,
					y: (cy - rect.top / g.containerScale) / img.scale
				},
				pos: { x: img.pos.x, y: img.pos.y },
				screenCenter: { x: cx, y: cy }
			};
		}
	}, { passive: false });

	img.addEventListener('touchmove', function(e) {
		e.preventDefault();
		if (e.touches.length === 1 && img.dragging) {
			img.pos.x = (e.touches[0].clientX / g.containerScale) - lastTouch.x;
			img.pos.y = (e.touches[0].clientY / g.containerScale) - lastTouch.y;
			setTransform();
		} else if (e.touches.length === 2 && pinchStart) {
			let newDist = getTouchDist(e.touches);
			let nextScale = Math.max(g.MIN_ZOOM, Math.min(g.MAX_ZOOM, pinchStart.scale * (newDist / pinchStart.dist)));
			let rect = img.getBoundingClientRect();
			let cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 / g.containerScale;
			let cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 / g.containerScale;
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
}

// Responsive resize logic
function resizePreviewContainer() {
	let preview  = g.imagePreview;
	let container = preview.parentNode
	let maxW = g.imageWidth;
	let maxH = g.imageHeight;
	let style = window.getComputedStyle(container);
	let padTop = parseFloat(style.paddingTop) || 0;
	let padLeft = parseFloat(style.paddingLeft) || 0;
	let padRight = parseFloat(style.paddingRight) || 0;
	let containerW = container.offsetWidth - padLeft - padRight;
	let w = Math.min(containerW, maxW);
	let scale = w / maxW;
	g.containerScale = scale; // Store for later use

	preview.style.transform = `scale(${scale})`;
	preview.style.transformOrigin = 'top left';
	preview.style.marginBottom = -maxH * (1 - scale) + 'px';

	updateCroppedImage();
}

function uploadImage() {
	generateCroppedImage();
	
	// Use worker-generated blob if available, otherwise fallback to canvas
	let getImageData = () => {
		if (g.lastGeneratedBlob) {
			return URL.createObjectURL(g.lastGeneratedBlob);
		} else {
			return g.canvas.toDataURL('image/jpeg', 0.92);
		}
	};
	
	// Small delay to ensure worker has processed if using worker
	setTimeout(() => {
		let imgDataUrl = getImageData();
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
	}, g.workerReady ? 100 : 0);
}

function updateCroppedImage() {
	if (!g.currentImage) return;
	let img = g.currentImage;
	if(g.CANVAS_PREVIEW_DELAY === 0) {
		generateCroppedImage();
		return;
	}
	clearTimeout(img.canvasTimeout);
	img.canvasTimeout = setTimeout(() => {
		generateCroppedImage();
	}, g.CANVAS_PREVIEW_DELAY);
}

// Generate a cropped image from the preview using canvas
function generateCroppedImage(img, scale, pos, cropSize) {
	img = img || g.currentImage;
	scale = scale || img.scale;
	pos = pos || img.pos;
	cropSize = cropSize || { width: g.imageWidth, height: g.imageHeight };

	// Use worker if available, fallback to main thread
	if (g.imageWorker && g.workerReady) {
		generateCroppedImageWorker(img, scale, pos, cropSize);
	} else {
		generateCroppedImageMainThread(img, scale, pos, cropSize);
	}
}

function generateCroppedImageWorker(img, scale, pos, cropSize) {
	// Send transform parameters to worker (image bitmap is already there)
	g.imageWorker.postMessage({
		type: 'generateImage',
		data: {
			scale: scale,
			pos: pos,
			cropSize: cropSize,
			backgroundColor: g.CANVAS_BACKGROUND_COLOR,
			filter: g.activeFilter || 'none'
		}
	});
}

function sendImageToWorker(img) {
	if (!g.imageWorker || !g.workerReady) return;
	
	// Create ImageBitmap from the image for efficient transfer
	createImageBitmap(img).then(bitmap => {
		g.imageWorker.postMessage({
			type: 'updateImage',
			data: {
				imageBitmap: bitmap,
				imageWidth: img.naturalWidth,
				imageHeight: img.naturalHeight
			}
		}, [bitmap]); // Transfer the bitmap
	}).catch(error => {
		ut.log('Failed to create ImageBitmap:', error);
		// Fallback to ImageData approach
		let tempCanvas = document.createElement('canvas');
		tempCanvas.width = img.naturalWidth;
		tempCanvas.height = img.naturalHeight;
		let tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
		tempCtx.drawImage(img, 0, 0);
		let imageData = tempCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
		
		g.imageWorker.postMessage({
			type: 'updateImage',
			data: {
				imageData: imageData,
				imageWidth: img.naturalWidth,
				imageHeight: img.naturalHeight
			}
		});
	});
}

function generateCroppedImageMainThread(img, scale, pos, cropSize) {
	let ctx = g.ctx;
	ctx.fillStyle = g.CANVAS_BACKGROUND_COLOR;
	ctx.fillRect(0, 0, cropSize.width, cropSize.height);
	ctx.filter = g.activeFilter || 'none';

	let iW = img.naturalWidth;
	let iH = img.naturalHeight;
	scale = Math.max(0.0001, scale); // avoid div by zero

	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, cropSize.width, cropSize.height);
	ctx.clip();
	ctx.drawImage(img, pos.x, pos.y, iW * scale, iH * scale);
	ctx.restore();
	ctx.filter = 'none';
}

function initImageWorker() {
	// Check if OffscreenCanvas is supported
	if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') {
		ut.log('OffscreenCanvas or Worker not supported, using main thread');
		g.workerReady = false;
		return;
	}

	try {
		g.imageWorker = new Worker('js/imageUploadWorker.js');
		g.workerReady = false;

		g.imageWorker.addEventListener('message', function(e) {
			let { type, blob, imageData, message } = e.data;
			
			switch (type) {
				case 'ready':
					g.workerReady = true;
					ut.log('Image worker ready');
					// Send initial image if one exists
					if (g.currentImage && g.currentImage.complete) {
						sendImageToWorker(g.currentImage);
					}
					break;
				case 'imageReady':
					// Update main canvas with worker result
					if (imageData) {
						g.ctx.putImageData(imageData, 0, 0);
					}
					// Store blob for download
					g.lastGeneratedBlob = blob;
					break;
				case 'imageUpdated':
					ut.log('Worker image updated');
					// Regenerate cropped image with new source
					updateCroppedImage();
					break;
				case 'error':
					ut.log('Worker error:', message);
					// Fallback to main thread
					g.workerReady = false;
					break;
			}
		});

		g.imageWorker.addEventListener('error', function(error) {
			ut.log('Worker failed to load:', error);
			g.workerReady = false;
		});

		// Initialize worker
		g.imageWorker.postMessage({
			type: 'init',
			data: {
				width: g.imageWidth,
				height: g.imageHeight,
				backgroundColor: g.CANVAS_BACKGROUND_COLOR
			}
		});

	} catch (error) {
		ut.log('Failed to create worker:', error);
		g.workerReady = false;
	}
}

function applyMinimalStyles() {
	let style = document.createElement('style');
	style.textContent = /*css*/`
		:root {
			--imageUpload-width: 256px;
			--imageUpload-height: 256px;
			--color-canvas-bg: rgb(150, 150, 150);
		}
	
		.imageUpload-preview-wrapper .imageUpload-preview {
			box-sizing: content-box;
			position: relative;
			width: var(--imageUpload-width);
			height: var(--imageUpload-height);
		}


		.imageUpload-preview-wrapper .imageUpload-preview-container {
			position: relative;
			width: 100%;
			height: 100%;
			overflow: hidden;
			background-color: var(--color-canvas-bg);
		}

		.imageUpload-preview-wrapper .imageUpload-preview-container img {
			position: absolute;
			top: 0;
			left: 0;
			transition: transform 0.1s ease-out;
		}`;
	document.head.prepend(style);
}

function initUtilities() {
	let utils = {};
	utils.el = function (s, context = document) { if (s instanceof Element) { return s; } else { return context.querySelector(s); } }
	utils.els = function (s, context = document) { return context.querySelectorAll(s); }
	utils.css = function (q, cs, remove=false) { let el = ut.el(q); if (!el) return; for (let key in cs) { if(remove){ el.style[key] = null;}else { el.style.setProperty(key, cs[key]);}}}
	utils.cssVar = function(varName, value, numeric=false) {
		let root = document.documentElement;
		if (value !== undefined) {
			root.style.setProperty(varName, value);
		} else {
			return getComputedStyle(root).getPropertyValue(varName) || '';
		}
	}
	utils.cssVarNum = function(varName, value, numeric=false) {
		let root = document.documentElement;
		if (value !== undefined) {
			root.style.setProperty(varName, value);
		} else {
			return parseFloat(getComputedStyle(root).getPropertyValue(varName)) || 0;
		}
	}
	utils.killKids = function (_el) { _el = utils.el(_el); while (_el?.firstChild) { _el.removeChild(_el.firstChild); } }
	utils.killMe = function (_el) { _el = utils.el(_el); if (_el?.parentNode) { _el.parentNode.removeChild(_el); } }
	utils.log = () => {} //console.log.bind(console);
	return utils;
}

// Additional exports for public API
export { placeImage, generateCroppedImage, uploadImage, applyTransform };

