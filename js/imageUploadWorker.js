'use strict';

let offscreenCanvas = null;
let ctx = null;
let currentImageBitmap = null;
let currentImageWidth = 0;
let currentImageHeight = 0;

self.addEventListener('message', function(e) {
	let { type, data } = e.data;
	switch (type) {
		case 'init': initCanvas(data); break;
		case 'updateImage': updateImage(data); break;
		case 'generateImage': generateCroppedImage(data); break;
		case 'updateBackground': updateBackgroundColor(data.backgroundColor); break;
	}
});

function initCanvas({ width, height, backgroundColor }) {
	offscreenCanvas = new OffscreenCanvas(width, height);
	ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
	updateBackgroundColor(backgroundColor);
	self.postMessage({ type: 'ready' });
}

function updateBackgroundColor(backgroundColor) {
	if (!ctx) return;
	self.backgroundColor = backgroundColor;
}

function updateImage({ imageBitmap, imageData, imageWidth, imageHeight }) {
	if (currentImageBitmap) currentImageBitmap.close();
	currentImageWidth = imageWidth;
	currentImageHeight = imageHeight;
	
	if (imageBitmap) {
		currentImageBitmap = imageBitmap;
		self.postMessage({ type: 'imageUpdated' });
	} else if (imageData) {
		let tempCanvas = new OffscreenCanvas(imageWidth, imageHeight);
		let tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
		tempCtx.putImageData(imageData, 0, 0);
		createImageBitmap(tempCanvas).then(bitmap => {
			currentImageBitmap = bitmap;
			self.postMessage({ type: 'imageUpdated' });
		}).catch(error => {
			self.postMessage({ type: 'error', message: 'Failed to create ImageBitmap: ' + error.message });
		});
	} else {
		self.postMessage({ type: 'error', message: 'No image data provided' });
	}
}

function generateCroppedImage({ scale, pos, cropSize, backgroundColor }) {
	if (!ctx || !offscreenCanvas) {
		self.postMessage({ type: 'error', message: 'Canvas not initialized' });
		return;
	}
	if (!currentImageBitmap) {
		self.postMessage({ type: 'error', message: 'No source image available' });
		return;
	}
	
	if (offscreenCanvas.width !== cropSize.width || offscreenCanvas.height !== cropSize.height) {
		offscreenCanvas.width = cropSize.width;
		offscreenCanvas.height = cropSize.height;
	}
	
	ctx.fillStyle = backgroundColor || self.backgroundColor || '#969696';
	ctx.fillRect(0, 0, cropSize.width, cropSize.height);
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, cropSize.width, cropSize.height);
	ctx.clip();
	ctx.drawImage(currentImageBitmap, pos.x, pos.y, currentImageWidth * scale, currentImageHeight * scale);
	ctx.restore();
	
	offscreenCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 }).then(blob => {
		self.postMessage({ 
			type: 'imageReady', 
			blob: blob,
			imageData: ctx.getImageData(0, 0, cropSize.width, cropSize.height)
		});
	}).catch(error => {
		self.postMessage({ type: 'error', message: error.message });
	});
}
